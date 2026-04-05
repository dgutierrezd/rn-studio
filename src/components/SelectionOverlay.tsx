import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  GestureResponderEvent,
  StyleSheet,
  View,
} from 'react-native';
import { appRootRef, useStudio } from '../StudioProvider';
import { autoScrollToComponent } from '../utils/autoScroll';
import type { ComponentNode, SourceLocation, StyleProperty } from '../types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// React Native's built-in inspector data API. Uses the React DevTools
// hook under the hood and works on both the Fabric and legacy
// architectures. We import it lazily so consumers that somehow run
// this file in production don't trip on the dev-only module path.
let getInspectorDataForViewAtPoint:
  | ((
      inspectedView: any,
      x: number,
      y: number,
      cb: (viewData: any) => boolean | void,
    ) => void)
  | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('react-native/src/private/devsupport/devmenu/elementinspector/getInspectorDataForViewAtPoint');
  getInspectorDataForViewAtPoint = (mod && (mod.default || mod)) || null;
} catch (e: any) {
  // eslint-disable-next-line no-console
  console.warn(
    '[rn-studio] Unable to load getInspectorDataForViewAtPoint:',
    e && e.message,
  );
}

function triggerHaptic(type: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Haptic = require('react-native-haptic-feedback').default;
    Haptic.trigger(type, {
      enableVibrateFallback: false,
      ignoreAndroidSystemSettings: false,
    });
  } catch {}
}

function inferStyleType(
  key: string,
  value: string | number,
): StyleProperty['type'] {
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'string') {
    if (
      /color/i.test(key) ||
      /^#[0-9a-f]{3,8}$/i.test(value) ||
      /^rgba?\(/i.test(value) ||
      /^hsla?\(/i.test(value)
    ) {
      return 'color';
    }
    return 'string';
  }
  return 'string';
}

function extractStyles(rawStyle: unknown): StyleProperty[] {
  const flat = (StyleSheet.flatten(rawStyle as any) || {}) as Record<
    string,
    any
  >;
  const out: StyleProperty[] = [];
  for (const key of Object.keys(flat)) {
    const value = flat[key];
    if (value == null) continue;
    if (typeof value === 'object') continue; // skip nested (shadowOffset etc.)
    out.push({ key, value, type: inferStyleType(key, value) });
  }
  return out;
}

/**
 * Excludes known library paths so the AST engine only ever rewrites
 * files in the user's project.
 */
function isUserCodePath(file: string | undefined): boolean {
  if (!file || typeof file !== 'string') return false;
  if (file.indexOf('/node_modules/') !== -1) return false;
  if (file.indexOf('react-native/Libraries/') !== -1) return false;
  if (file.indexOf('react-native/src/') !== -1) return false;
  if (file === 'unknown' || file === '<anonymous>') return false;
  return true;
}

interface ResolvedSource {
  source: SourceLocation;
  props: Record<string, unknown>;
  componentName: string;
}

function sourceFromProps(
  p: Record<string, any> | null | undefined,
  fallbackName: string | null,
): SourceLocation | null {
  if (!p) return null;
  if (p.__rnStudioSource && p.__rnStudioSource.file) {
    return {
      file: p.__rnStudioSource.file,
      line: p.__rnStudioSource.line,
      column: p.__rnStudioSource.column || 0,
      componentName:
        p.__rnStudioSource.componentName || fallbackName || 'Component',
    };
  }
  if (p.__source && p.__source.fileName) {
    return {
      file: p.__source.fileName,
      line: p.__source.lineNumber,
      column: p.__source.columnNumber || 0,
      componentName: fallbackName || 'Component',
    };
  }
  return null;
}

/**
 * Walks a fiber's `.return` chain, reading each fiber's own
 * memoizedProps for a source location. This is the correct strategy
 * because `getInspectorDataForViewAtPoint`'s `hierarchy` items all
 * share the deepest host's props, which is useless for mapping back
 * to user JSX.
 */
function walkFiberForUserSource(fiber: any): ResolvedSource | null {
  let current: any = fiber;
  let libraryFallback: ResolvedSource | null = null;
  let safety = 0;
  while (current && safety < 200) {
    safety++;
    const p = current.memoizedProps;
    if (p && typeof p === 'object') {
      const src = sourceFromProps(
        p,
        (current.type && (current.type.displayName || current.type.name)) ||
          null,
      );
      if (src) {
        const resolved: ResolvedSource = {
          source: src,
          props: p,
          componentName: src.componentName,
        };
        if (isUserCodePath(src.file)) return resolved;
        if (!libraryFallback) libraryFallback = resolved;
      }
    }
    current = current.return;
  }
  return libraryFallback;
}

/**
 * Resolve the nearest user-code JSX source location from the data
 * returned by `getInspectorDataForViewAtPoint`.
 */
function resolveSourceFromViewData(viewData: any): ResolvedSource | null {
  if (!viewData) return null;

  if (viewData.closestInstance) {
    const found = walkFiberForUserSource(viewData.closestInstance);
    if (found && isUserCodePath(found.source.file)) return found;
    if (found) {
      // eslint-disable-next-line no-console
      console.warn(
        '[rn-studio] fiber walk only found library source:',
        found.source.file,
      );
    }
  }

  const topSrc = sourceFromProps(viewData.props, null);
  if (topSrc && isUserCodePath(topSrc.file)) {
    return {
      source: topSrc,
      props: (viewData.props || {}) as Record<string, unknown>,
      componentName: topSrc.componentName,
    };
  }
  // eslint-disable-next-line no-console
  console.warn(
    '[rn-studio] no user-code source found; closestInstance?',
    !!viewData.closestInstance,
    'topLevelSrc=',
    topSrc && topSrc.file,
  );
  return null;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * SelectionOverlay
 *
 * Full-screen overlay that dims the app when selection mode is active
 * and draws an accent-colored highlight box around the selected
 * component. Touches are routed via `getInspectorDataForViewAtPoint`
 * against the app root view (provided by StudioProvider via
 * `appRootRef`). The nearest user-code fiber is then resolved by
 * walking the fiber `.return` chain.
 */
export const SelectionOverlay: React.FC = () => {
  const { isActive, isSelecting, selectedComponent, selectComponent } =
    useStudio();
  const [highlight, setHighlight] = useState<Rect | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: isActive ? 0.3 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isActive, opacity]);

  useEffect(() => {
    if (!selectedComponent) setHighlight(null);
  }, [selectedComponent]);

  const handleTouch = (evt: GestureResponderEvent) => {
    if (!isSelecting) return;
    const { pageX, pageY } = evt.nativeEvent;

    const appRoot = appRootRef && appRootRef.current;
    if (!getInspectorDataForViewAtPoint || !appRoot) {
      // eslint-disable-next-line no-console
      console.warn(
        '[rn-studio] inspector API or app root ref not available',
        {
          hasAPI: !!getInspectorDataForViewAtPoint,
          hasRoot: !!appRoot,
        },
      );
      return;
    }

    try {
      getInspectorDataForViewAtPoint(appRoot, pageX, pageY, (viewData: any) => {
        if (!viewData) return false;

        const resolved = resolveSourceFromViewData(viewData);
        if (!resolved) {
          if (viewData.frame) {
            setHighlight({
              x: viewData.frame.left,
              y: viewData.frame.top,
              width: viewData.frame.width,
              height: viewData.frame.height,
            });
          }
          return true;
        }

        const nodeStyles = extractStyles(
          (resolved.props as Record<string, unknown>).style,
        );
        const node: ComponentNode = {
          id: `${resolved.source.file}:${resolved.source.line}:${resolved.source.column}`,
          componentName: resolved.componentName,
          source: resolved.source,
          props: resolved.props,
          styles: nodeStyles,
          children: [],
        };

        if (viewData.frame) {
          setHighlight({
            x: viewData.frame.left,
            y: viewData.frame.top,
            width: viewData.frame.width,
            height: viewData.frame.height,
          });
          // Auto-scroll the nearest scrollable ancestor so the
          // selected component ends up in the top 40% of the screen
          // (visible above the inspector panel).
          autoScrollToComponent(viewData.closestInstance, viewData.frame);
        }
        selectComponent(node);
        triggerHaptic('impactMedium');
        return true;
      });
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.warn('[rn-studio] hit-test error:', err && err.message);
    }
  };

  if (!isActive) return null;

  return (
    <View
      pointerEvents={isSelecting ? 'box-only' : 'none'}
      style={StyleSheet.absoluteFill}
      onStartShouldSetResponder={() => isSelecting}
      onResponderGrant={handleTouch}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: '#000', opacity },
        ]}
      />
      {highlight && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: highlight.x,
            top: highlight.y,
            width: highlight.width,
            height: highlight.height,
            borderWidth: 2,
            borderColor: '#7C9BFF',
            borderRadius: 4,
          }}
        />
      )}
    </View>
  );
};

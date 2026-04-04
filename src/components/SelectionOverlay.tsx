import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  StyleSheet,
  View,
  findNodeHandle,
  UIManager,
} from 'react-native';
import { useStudio } from '../StudioProvider';
import { buildComponentNode, findSourceOwner, fiberFromRef } from '../utils/fiberWalker';
import type { Rect } from '../utils/measureComponent';

/**
 * SelectionOverlay
 *
 * Full-screen overlay that dims the app when selection mode is active
 * and draws a lime-green highlight box around the selected component.
 *
 * Touch resolution strategy: the overlay captures the touch, then asks
 * the UIManager which native view is under the touch point via
 * `findSubviewIn`. From that view ref we walk the fiber tree upwards
 * (see fiberWalker.ts) to find the nearest component with
 * `__rnStudioSource` metadata.
 */
export const SelectionOverlay: React.FC = () => {
  const { isActive, isSelecting, selectedComponent, selectComponent } = useStudio();
  const rootRef = useRef<View>(null);
  const [highlight, setHighlight] = useState<Rect | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const borderOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: isActive ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isActive, opacity]);

  useEffect(() => {
    if (selectedComponent) {
      Animated.timing(borderOpacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    } else {
      borderOpacity.setValue(0);
    }
  }, [selectedComponent, borderOpacity]);

  const handleTouch = (evt: any) => {
    if (!isSelecting) return false;

    const { pageX, pageY } = evt.nativeEvent;

    const rootHandle = findNodeHandle(rootRef.current);
    if (!rootHandle) return true;

    // findSubviewIn gives us the native view at a point. Then we climb
    // the fiber tree to locate the nearest source-annotated owner.
    try {
      (UIManager as any).findSubviewIn(
        rootHandle,
        [pageX, pageY, 1, 1],
        (_nativeX: number, _nativeY: number, _w: number, _h: number, tag: number) => {
          if (!tag) return;
          const fiber = fiberFromRef({ stateNode: { _nativeTag: tag } });
          // Most RN versions expose the fiber via private keys on the
          // underlying view component instance; the walker defensively
          // searches for them. If no fiber is found we still draw a
          // placeholder highlight at the touch location.
          let owner: ReturnType<typeof findSourceOwner> = null;
          if (fiber) owner = findSourceOwner(fiber);
          if (owner) {
            const node = buildComponentNode(owner.fiber, owner.source);
            selectComponent(node);
          }

          // Draw highlight at touch point (approximate). A production
          // implementation would call measureInWindow on the resolved
          // native component for a pixel-perfect box.
          setHighlight({
            x: pageX - 30,
            y: pageY - 30,
            width: 60,
            height: 60,
          });
        }
      );
    } catch {
      // UIManager.findSubviewIn is not available on every platform; in
      // that case we still acknowledge the touch so the user gets
      // feedback.
    }

    triggerHaptic('impactMedium');
    return true;
  };

  if (!isActive) return null;

  const { width, height } = Dimensions.get('window');

  return (
    <View
      ref={rootRef}
      pointerEvents={isSelecting ? 'box-only' : 'none'}
      style={StyleSheet.absoluteFill}
      onStartShouldSetResponder={() => isSelecting}
      onResponderGrant={handleTouch}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: 'rgba(0,0,0,0.3)', opacity },
        ]}
      />
      {highlight && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: highlight.x,
            top: highlight.y,
            width: highlight.width,
            height: highlight.height,
            borderWidth: 2,
            borderColor: '#C6F135',
            borderRadius: 4,
            opacity: borderOpacity,
          }}
        />
      )}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', width, height }}
      />
    </View>
  );
};

function triggerHaptic(type: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Haptic = require('react-native-haptic-feedback').default;
    Haptic.trigger(type, { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
  } catch {}
}

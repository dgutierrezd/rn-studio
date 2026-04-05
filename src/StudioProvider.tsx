import React, {
  MutableRefObject,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { View } from 'react-native';
import { StudioContext } from './context/StudioContext';
import { WebSocketBridge } from './bridge/WebSocketBridge';
import { FloatingBubble } from './components/FloatingBubble';
import { SelectionOverlay } from './components/SelectionOverlay';
import { InspectorPanel } from './components/InspectorPanel';
import {
  loadLastSelection,
  saveLastSelection,
} from './utils/persistence';
import { findFiberBySource } from './utils/findFiberBySource';
import type {
  BubblePosition,
  ComponentNode,
  SourceLocation,
  StudioConfig,
  StudioContextValue,
  StudioState,
} from './types';

interface Props extends Partial<StudioConfig> {
  enabled?: boolean;
  serverPort?: number;
  bubblePosition?: BubblePosition;
  theme?: 'dark' | 'light';
  children: React.ReactNode;
}

/**
 * Shared mutable ref to the app root view. Populated by
 * `<StudioProvider>` and consumed by `<SelectionOverlay>` for
 * hit-testing via `getInspectorDataForViewAtPoint`.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export const appRootRef: MutableRefObject<any> = { current: null };

export function StudioProvider({
  children,
  enabled = false,
  serverPort = 7878,
  bubblePosition = 'bottom-right',
}: Props) {
  if (!enabled) {
    return <>{children}</>;
  }
  return (
    <StudioProviderInner
      serverPort={serverPort}
      bubblePosition={bubblePosition}
    >
      {children}
    </StudioProviderInner>
  );
}

const StudioProviderInner: React.FC<{
  serverPort: number;
  bubblePosition: BubblePosition;
  children: React.ReactNode;
}> = ({ serverPort, bubblePosition, children }) => {
  const [state, setState] = useState<StudioState>('IDLE');
  const [selectedComponent, setSelectedComponent] =
    useState<ComponentNode | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const bridgeRef = useRef<WebSocketBridge | null>(null);

  if (!bridgeRef.current) {
    bridgeRef.current = new WebSocketBridge(serverPort);
  }

  // Connect + subscribe to server messages.
  useEffect(() => {
    const bridge = bridgeRef.current!;
    bridge.connect();
    const offStack = bridge.on('STACK_STATE', (msg: any) => {
      if (msg.payload) {
        setCanUndo(msg.payload.undo > 0);
        setCanRedo(msg.payload.redo > 0);
      }
    });
    return () => {
      offStack();
      bridge.disconnect();
    };
  }, []);

  // Persist the last-selected source whenever it changes.
  useEffect(() => {
    if (selectedComponent) {
      saveLastSelection(selectedComponent.source).catch(() => {});
    }
  }, [selectedComponent]);

  // On initial mount, attempt to re-select the previously selected
  // component (survives Cmd+R and Fast Refresh). Best-effort only.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await loadLastSelection();
      if (!saved || cancelled) return;
      // Wait a frame for the fiber tree to commit.
      setTimeout(() => {
        if (cancelled) return;
        const fiber = findFiberBySource(saved);
        if (!fiber) return;
        const props = (fiber.memoizedProps || {}) as Record<string, unknown>;
        const node: ComponentNode = {
          id: `${saved.file}:${saved.line}:${saved.column}`,
          componentName: saved.componentName,
          source: saved,
          props,
          styles: [],
          children: [],
        };
        // Silently restore in ACTIVE state so the user can tap the
        // bubble to resume editing, without jarring re-opening the
        // inspector automatically.
        setSelectedComponent(node);
        setState('ACTIVE');
      }, 500);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleActive = useCallback(() => {
    setState((s) => {
      if (s === 'IDLE') return 'ACTIVE';
      setSelectedComponent(null);
      return 'IDLE';
    });
  }, []);

  const selectComponent = useCallback((node: ComponentNode) => {
    setSelectedComponent(node);
    setState('SELECTED');
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedComponent(null);
    setState('ACTIVE');
  }, []);

  const updateStyle = useCallback(
    (key: string, value: string | number) => {
      const current = selectedComponent;
      if (!current) return;
      bridgeRef.current?.send({
        type: 'STYLE_CHANGE',
        payload: { source: current.source, key, value },
      });
      // Optimistically update the local styles list so the editor
      // reflects the new value without a round-trip.
      setSelectedComponent({
        ...current,
        styles: upsertLocalStyle(current.styles, key, value),
      });
    },
    [selectedComponent],
  );

  const addStyleProperty = useCallback(
    (key: string, value: string | number | boolean) => {
      const current = selectedComponent;
      if (!current) return;
      // Booleans aren't writable via AST here yet; skip.
      if (typeof value === 'boolean') return;
      bridgeRef.current?.send({
        type: 'STYLE_CHANGE',
        payload: { source: current.source, key, value },
      });
      setSelectedComponent({
        ...current,
        styles: upsertLocalStyle(current.styles, key, value),
      });
    },
    [selectedComponent],
  );

  const undo = useCallback(() => {
    bridgeRef.current?.send({ type: 'UNDO' });
  }, []);
  const redo = useCallback(() => {
    bridgeRef.current?.send({ type: 'REDO' });
  }, []);

  const setAppRootRef = useCallback((r: any) => {
    appRootRef.current = r;
  }, []);

  const ctx: StudioContextValue = {
    isActive: state !== 'IDLE',
    isSelecting: state === 'SELECTING' || state === 'ACTIVE',
    selectedComponent,
    toggleActive,
    selectComponent,
    clearSelection,
    updateStyle,
    addStyleProperty,
    undo,
    redo,
    canUndo,
    canRedo,
  };

  return (
    <StudioContext.Provider value={ctx}>
      <View ref={setAppRootRef} collapsable={false} style={{ flex: 1 }}>
        {children}
      </View>
      <SelectionOverlay />
      <InspectorPanel />
      <FloatingBubble position={bubblePosition} />
    </StudioContext.Provider>
  );
};

function upsertLocalStyle(
  list: ComponentNode['styles'],
  key: string,
  value: string | number,
): ComponentNode['styles'] {
  const existing = list.findIndex((s) => s.key === key);
  const type: ComponentNode['styles'][number]['type'] =
    typeof value === 'number'
      ? 'number'
      : /color/i.test(key) || /^#[0-9a-f]{3,8}$/i.test(String(value))
        ? 'color'
        : 'string';
  const entry = { key, value, type };
  if (existing >= 0) {
    const next = list.slice();
    next[existing] = entry;
    return next;
  }
  return [...list, entry];
}

// Suppress unused import lint; SourceLocation is referenced via types.
export type { SourceLocation };

/** Hook for any descendant of `<StudioProvider>` to read studio state. */
export function useStudio(): StudioContextValue {
  const ctx = useContext(StudioContext);
  if (!ctx) {
    throw new Error('useStudio must be used inside <StudioProvider>');
  }
  return ctx;
}

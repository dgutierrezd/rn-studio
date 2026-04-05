import React, {
  MutableRefObject,
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
import type {
  BubblePosition,
  ComponentNode,
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
 * Shared mutable ref to the app root view. Populated by `<StudioProvider>`
 * and consumed by `<SelectionOverlay>` for hit-testing via the React
 * DevTools `getInspectorDataForViewAtPoint` API. Exposing it at module
 * scope avoids having to thread it through context (and keeps the
 * context value shape unchanged for consumers).
 */
export const appRootRef: MutableRefObject<any> = { current: null };

/**
 * <StudioProvider>
 *
 * Wrap your App.tsx with this provider. When `enabled` is false (the
 * default, intended for production), it renders children verbatim and
 * introduces zero overhead — no context, no bridge, no overlay.
 *
 * When enabled, it manages the studio state machine, opens a WebSocket
 * connection to the CLI server, and renders the floating bubble,
 * selection overlay, and inspector panel above your app.
 */
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
    <StudioProviderInner serverPort={serverPort} bubblePosition={bubblePosition}>
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
  const bridgeRef = useRef<WebSocketBridge | null>(null);

  if (!bridgeRef.current) {
    bridgeRef.current = new WebSocketBridge(serverPort);
  }

  useEffect(() => {
    const bridge = bridgeRef.current!;
    bridge.connect();
    const off = bridge.on('ACK', () => {
      // Per-editor success feedback is handled via the debounce timers
      // in StyleEditor rows.
    });
    return () => {
      off();
      bridge.disconnect();
    };
  }, []);

  const toggleActive = () => {
    setState((s) => {
      if (s === 'IDLE') return 'ACTIVE';
      setSelectedComponent(null);
      return 'IDLE';
    });
  };

  const selectComponent = (node: ComponentNode) => {
    setSelectedComponent(node);
    setState('SELECTED');
  };

  const clearSelection = () => {
    setSelectedComponent(null);
    setState('ACTIVE');
  };

  const updateStyle = (key: string, value: string | number) => {
    if (!selectedComponent) return;
    bridgeRef.current?.send({
      type: 'STYLE_CHANGE',
      payload: {
        source: selectedComponent.source,
        key,
        value,
      },
    });
  };

  const ctx: StudioContextValue = {
    isActive: state !== 'IDLE',
    isSelecting: state === 'SELECTING' || state === 'ACTIVE',
    selectedComponent,
    toggleActive,
    selectComponent,
    clearSelection,
    updateStyle,
  };

  // Wrap children in a ref'd host View so the SelectionOverlay can
  // hit-test against the user's UI via Fabric's inspector data API.
  // `collapsable={false}` guarantees the View remains a real native
  // node that can be targeted by `getInspectorDataForViewAtPoint`.
  const setAppRootRef = (r: any) => {
    appRootRef.current = r;
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

/** Hook for any descendant of `<StudioProvider>` to read studio state. */
export function useStudio(): StudioContextValue {
  const ctx = useContext(StudioContext);
  if (!ctx) {
    throw new Error('useStudio must be used inside <StudioProvider>');
  }
  return ctx;
}

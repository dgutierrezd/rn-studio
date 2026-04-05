/**
 * rn-studio — shared type definitions
 *
 * These types are consumed by both the runtime (React Native) and
 * the Node.js side (CLI server, AST engine). Keep this file free of
 * runtime imports so it can be used from either environment.
 */

/** Source location injected by the babel plugin. */
export interface SourceLocation {
  file: string;
  line: number;
  column: number;
  componentName: string;
}

/** A node in the component tree reconstructed from React fiber. */
export interface ComponentNode {
  id: string;
  componentName: string;
  source: SourceLocation;
  props: Record<string, unknown>;
  styles: StyleProperty[];
  children: ComponentNode[];
}

/** A single editable style property. */
export interface StyleProperty {
  key: string;
  value: string | number;
  type: 'color' | 'number' | 'string' | 'boolean';
  unit?: 'px' | '%' | 'dp';
}

/** Configuration passed to `<StudioProvider>`. */
export interface StudioConfig {
  enabled: boolean;
  serverPort?: number; // default: 7878
  bubblePosition?: BubblePosition;
  theme?: 'dark' | 'light';
}

export type BubblePosition =
  | 'bottom-right'
  | 'bottom-left'
  | 'top-right'
  | 'top-left';

/** Context value exposed via `useStudio()`. */
export interface StudioContextValue {
  isActive: boolean;
  isSelecting: boolean;
  selectedComponent: ComponentNode | null;
  toggleActive: () => void;
  selectComponent: (node: ComponentNode) => void;
  clearSelection: () => void;
  updateStyle: (key: string, value: string | number) => void;
  /** Add a new style property to the selected component. */
  addStyleProperty: (key: string, value: string | number | boolean) => void;
  /** Undo the last style change across all components. */
  undo: () => void;
  /** Redo the last undone change. */
  redo: () => void;
  /** Current undo/redo stack depths, updated by server ACKs. */
  canUndo: boolean;
  canRedo: boolean;
}

/** WebSocket message protocol — discriminated union. */
export type StudioMessage =
  | { type: 'COMPONENT_SELECTED'; payload: ComponentNode }
  | {
      type: 'STYLE_CHANGE';
      payload: {
        source: SourceLocation;
        key: string;
        value: string | number;
      };
    }
  | {
      type: 'PROP_CHANGE';
      payload: {
        source: SourceLocation;
        propName: string;
        value: unknown;
      };
    }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'STACK_STATE'; payload: { undo: number; redo: number } }
  | { type: 'PING' }
  | { type: 'ACK'; payload: { success: boolean; message?: string } }
  | { type: 'ERROR'; payload: { message: string } };

/** Studio state machine states. */
export type StudioState = 'IDLE' | 'ACTIVE' | 'SELECTING' | 'SELECTED' | 'EDITING';

/**
 * Ambient augmentation so TSX files can safely pass `__rnStudioSource`
 * to host components without type errors. The babel plugin injects this
 * prop on every JSX element.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace React {
    interface DOMAttributes<T> {
      __rnStudioSource?: SourceLocation;
    }
  }
}

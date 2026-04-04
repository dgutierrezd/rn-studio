/**
 * rn-studio — public barrel exports
 *
 * Consumer usage:
 *
 *   import { StudioProvider, useStudio } from 'rn-studio';
 *
 *   export default function App() {
 *     return (
 *       <StudioProvider enabled={__DEV__} bubblePosition="bottom-right">
 *         <YourApp />
 *       </StudioProvider>
 *     );
 *   }
 */
export { StudioProvider, useStudio } from './StudioProvider';
export { WebSocketBridge } from './bridge/WebSocketBridge';
export { FloatingBubble } from './components/FloatingBubble';
export { SelectionOverlay } from './components/SelectionOverlay';
export { InspectorPanel } from './components/InspectorPanel';
export { StyleEditor } from './components/StyleEditor';
export { ComponentTree } from './components/ComponentTree';

export type {
  SourceLocation,
  ComponentNode,
  StyleProperty,
  StudioConfig,
  BubblePosition,
  StudioContextValue,
  StudioMessage,
  StudioState,
} from './types';

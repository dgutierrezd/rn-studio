/**
 * autoScrollToComponent
 *
 * When a component is selected and the inspector panel slides up
 * covering the bottom 60% of the screen, the component itself may be
 * hidden behind the panel. This utility walks the fiber tree to find
 * the nearest scrollable ancestor and scrolls so that the component
 * appears in the top ~25% of the visible area (above the panel).
 */
import { Dimensions, findNodeHandle, UIManager } from 'react-native';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Frame {
  left: number;
  top: number;
  width: number;
  height: number;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;
/** Panel covers the bottom 60% of the screen — visible area is 0..VISIBLE_BOTTOM. */
const VISIBLE_BOTTOM = Math.round(SCREEN_HEIGHT * 0.4);
/** Desired top padding for the selected component inside the visible area. */
const TOP_PADDING = Math.round(SCREEN_HEIGHT * 0.12);

/**
 * Walks a fiber's `.return` chain looking for the nearest ancestor
 * whose stateNode exposes a `scrollTo` method (ScrollView, FlatList,
 * SectionList, KeyboardAwareScrollView, etc.).
 */
function findScrollableAncestor(fiber: any): any | null {
  let current = fiber;
  let safety = 0;
  while (current && safety < 200) {
    safety++;
    const node = current.stateNode;
    if (node) {
      if (typeof node.scrollTo === 'function') return node;
      if (typeof node.scrollToOffset === 'function') {
        return {
          scrollTo: ({ y, animated }: { y: number; animated?: boolean }) =>
            node.scrollToOffset({ offset: y, animated }),
          getInnerViewNode:
            typeof node.getNativeScrollRef === 'function'
              ? () => {
                  const ref = node.getNativeScrollRef();
                  return ref && findNodeHandle(ref);
                }
              : undefined,
        };
      }
      if (typeof node.getScrollResponder === 'function') {
        const r = node.getScrollResponder();
        if (r && typeof r.scrollTo === 'function') return r;
      }
    }
    current = current.return;
  }
  return null;
}

/**
 * Called by SelectionOverlay after a successful selection. `fiber` is
 * the `closestInstance` from `getInspectorDataForViewAtPoint`. `frame`
 * is its measured pageX/Y box. If the component is already visible
 * above the panel, this is a no-op.
 */
export function autoScrollToComponent(fiber: any, frame: Frame): void {
  if (!fiber || !frame) return;

  // Already inside the visible area? Nothing to do.
  if (frame.top >= TOP_PADDING && frame.top + frame.height <= VISIBLE_BOTTOM) {
    return;
  }

  const scrollable = findScrollableAncestor(fiber);
  if (!scrollable || typeof scrollable.scrollTo !== 'function') return;

  // Resolve the scroll content view handle.
  let contentTag: number | null = null;
  try {
    if (typeof scrollable.getInnerViewNode === 'function') {
      contentTag = scrollable.getInnerViewNode();
    } else if (scrollable._innerViewRef) {
      contentTag = findNodeHandle(scrollable._innerViewRef);
    } else {
      contentTag = findNodeHandle(scrollable);
    }
  } catch {
    contentTag = null;
  }
  if (!contentTag) return;

  // Resolve the target host view's handle.
  let targetTag: number | null = null;
  try {
    // Prefer the fiber's stateNode (host fibers have a nativeTag'd stateNode).
    const sn = fiber.stateNode;
    if (sn) {
      targetTag =
        findNodeHandle(sn) ||
        (sn.canonical && sn.canonical.nativeTag) ||
        null;
    }
  } catch {
    targetTag = null;
  }
  if (!targetTag) return;

  // Measure the target's y inside the scroll content, then scroll to
  // that position minus the desired top padding.
  try {
    (UIManager as any).measureLayout(
      targetTag,
      contentTag,
      () => {
        // onFail: silently ignore.
      },
      (_x: number, y: number) => {
        const targetY = Math.max(0, y - TOP_PADDING);
        try {
          scrollable.scrollTo({ y: targetY, animated: true });
        } catch {
          // Some custom scroll components expect different signatures.
        }
      },
    );
  } catch {
    // measureLayout is unavailable on some edge-case architectures;
    // fall back to a best-guess scroll using the page-space delta.
    try {
      scrollable.scrollTo({
        y: Math.max(0, frame.top - TOP_PADDING),
        animated: true,
      });
    } catch {}
  }
}

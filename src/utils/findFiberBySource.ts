/**
 * findFiberBySource
 *
 * Walks all live React fiber trees via the React DevTools hook and
 * returns the first fiber whose memoizedProps carry a
 * `__rnStudioSource` or `__source` matching the supplied coordinates.
 *
 * Used by StudioProvider to re-select the previously selected
 * component after a Metro Fast Refresh or full reload.
 */
import type { SourceLocation } from '../types';

/* eslint-disable @typescript-eslint/no-explicit-any */

function matchesSource(props: any, target: SourceLocation): boolean {
  if (!props || typeof props !== 'object') return false;
  if (
    props.__rnStudioSource &&
    props.__rnStudioSource.file === target.file &&
    props.__rnStudioSource.line === target.line
  ) {
    return true;
  }
  if (
    props.__source &&
    props.__source.fileName === target.file &&
    props.__source.lineNumber === target.line
  ) {
    return true;
  }
  return false;
}

function walkFiber(fiber: any, target: SourceLocation): any | null {
  if (!fiber) return null;
  const queue: any[] = [fiber];
  let safety = 0;
  while (queue.length && safety < 10000) {
    safety++;
    const node = queue.shift();
    if (!node) continue;
    if (matchesSource(node.memoizedProps, target)) return node;
    if (node.child) queue.push(node.child);
    if (node.sibling) queue.push(node.sibling);
  }
  return null;
}

/**
 * Public entry point. Returns the first matching fiber or null. Safe
 * to call even if React DevTools isn't installed.
 */
export function findFiberBySource(target: SourceLocation): any | null {
  const hook = (globalThis as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!hook || !hook.renderers) return null;

  try {
    const renderers = Array.from(hook.renderers.values()) as any[];
    for (const renderer of renderers) {
      // Fiber roots may be exposed via `getFiberRoots(rendererID)` or a
      // Set stored on the renderer itself; defensively handle both.
      const rendererID = [...hook.renderers.keys()].find(
        (k) => hook.renderers.get(k) === renderer,
      );
      let roots: Set<any> | null = null;
      if (typeof hook.getFiberRoots === 'function' && rendererID != null) {
        roots = hook.getFiberRoots(rendererID);
      }
      if (!roots && (renderer as any).getFiberRoots) {
        roots = (renderer as any).getFiberRoots();
      }
      if (!roots) continue;

      for (const root of roots) {
        const fiberRoot = root.current || root;
        const found = walkFiber(fiberRoot, target);
        if (found) return found;
      }
    }
  } catch {
    // DevTools hook internals shift between RN versions; swallow any
    // reflection errors — re-selection is best-effort.
  }
  return null;
}

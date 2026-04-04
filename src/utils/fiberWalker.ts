import type { ComponentNode, SourceLocation, StyleProperty } from '../types';

/**
 * Fiber walker utilities
 *
 * Given a React Native host element (or its measured layout rectangle),
 * walk the React fiber tree to find the nearest owning component that
 * carries a `__rnStudioSource` prop (injected by babel-plugin-rn-studio).
 *
 * Note: React Native does not expose a document-like hit-testing API,
 * so the overlay captures raw touch coordinates and relies on the
 * caller passing a candidate ref — then this walker climbs from there
 * looking for source metadata.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// React fiber internal keys are implementation-detail; we access them
// defensively and type as `any` to avoid coupling to private APIs.
type AnyFiber = any;

function getFiberFromRef(ref: any): AnyFiber | null {
  if (!ref) return null;
  const keys = Object.keys(ref);
  const fiberKey = keys.find(
    (k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')
  );
  if (fiberKey) return ref[fiberKey];
  if (ref._reactInternalFiber) return ref._reactInternalFiber;
  if (ref.stateNode) return ref;
  return null;
}

function getSourceFromFiber(fiber: AnyFiber): SourceLocation | null {
  if (!fiber) return null;
  const props = fiber.memoizedProps || fiber.pendingProps;
  if (props && props.__rnStudioSource) {
    return props.__rnStudioSource as SourceLocation;
  }
  return null;
}

/**
 * Walk up a fiber chain, returning the first ancestor that carries
 * `__rnStudioSource` metadata.
 */
export function findSourceOwner(
  startFiber: AnyFiber
): { fiber: AnyFiber; source: SourceLocation } | null {
  let current = startFiber;
  while (current) {
    const src = getSourceFromFiber(current);
    if (src) return { fiber: current, source: src };
    current = current.return;
  }
  return null;
}

export function fiberFromRef(ref: any): AnyFiber | null {
  return getFiberFromRef(ref);
}

/**
 * Derive a list of editable StyleProperty entries from a raw style prop,
 * which may be an object, an array, or a StyleSheet id (number).
 */
export function extractStyles(rawStyle: unknown): StyleProperty[] {
  const flat: Record<string, string | number> = {};

  const visit = (s: unknown) => {
    if (!s) return;
    if (Array.isArray(s)) {
      s.forEach(visit);
      return;
    }
    if (typeof s === 'object') {
      Object.assign(flat, s as Record<string, string | number>);
    }
  };

  visit(rawStyle);

  return Object.entries(flat).map(([key, value]) => {
    const type: StyleProperty['type'] = inferStyleType(key, value);
    return { key, value, type };
  });
}

function inferStyleType(
  key: string,
  value: string | number
): StyleProperty['type'] {
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'string') {
    // Heuristic: anything that looks like a color becomes 'color'.
    const colorish =
      /color/i.test(key) ||
      /^#[0-9a-f]{3,8}$/i.test(value) ||
      /^rgba?\(/i.test(value) ||
      /^hsla?\(/i.test(value);
    if (colorish) return 'color';
    return 'string';
  }
  return 'string';
}

/**
 * Build a lightweight ComponentNode from a fiber with source metadata.
 * Children are resolved lazily (one level deep) so the tree view can
 * render without traversing the entire app.
 */
export function buildComponentNode(
  fiber: AnyFiber,
  source: SourceLocation
): ComponentNode {
  const props = (fiber.memoizedProps || {}) as Record<string, unknown>;
  const styles = extractStyles(props.style);
  const id = `${source.file}:${source.line}:${source.column}`;

  const children: ComponentNode[] = [];
  let child = fiber.child;
  let safety = 0;
  while (child && safety < 50) {
    const sub = getSourceFromFiber(child);
    if (sub) {
      children.push({
        id: `${sub.file}:${sub.line}:${sub.column}`,
        componentName: sub.componentName,
        source: sub,
        props: (child.memoizedProps || {}) as Record<string, unknown>,
        styles: extractStyles(
          (child.memoizedProps || {} as any).style
        ),
        children: [],
      });
    }
    child = child.sibling;
    safety++;
  }

  return {
    id,
    componentName: source.componentName,
    source,
    props,
    styles,
    children,
  };
}

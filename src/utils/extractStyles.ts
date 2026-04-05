/**
 * extractStyles
 *
 * Converts a raw React Native style prop (object, array, StyleSheet
 * ID, etc.) into a flat `StyleProperty[]` list suitable for rendering
 * in the inspector. Shared between `SelectionOverlay` (building the
 * initial selection) and `StudioProvider` (refreshing the current
 * selection after undo/redo/cancel).
 */
import { StyleSheet } from 'react-native';
import type { StyleProperty } from '../types';

/* eslint-disable @typescript-eslint/no-explicit-any */

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

export function extractStyles(rawStyle: unknown): StyleProperty[] {
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
 * Walks a fiber (and its host children) looking for a `style` prop,
 * then flattens it into an array of StyleProperty entries.
 */
export function extractStylesFromFiber(fiber: any): StyleProperty[] {
  if (!fiber) return [];

  // First try the fiber's own memoizedProps.
  const ownProps = fiber.memoizedProps as Record<string, unknown> | undefined;
  if (ownProps && ownProps.style !== undefined) {
    return extractStyles(ownProps.style);
  }

  // Fall back to the first host-fiber descendant that has a style
  // prop — useful when the selected fiber is a component wrapper
  // whose rendered host actually holds the resolved styles.
  let current = fiber.child;
  let safety = 0;
  while (current && safety < 20) {
    safety++;
    if (typeof current.type === 'string') {
      const p = current.memoizedProps as Record<string, unknown> | undefined;
      if (p && p.style !== undefined) return extractStyles(p.style);
    }
    current = current.child;
  }
  return [];
}

/**
 * measureComponent
 *
 * Thin promise wrapper around React Native's `measureInWindow` for use
 * by the SelectionOverlay when drawing the highlight box around a
 * selected component.
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function measureInWindow(ref: any): Promise<Rect | null> {
  return new Promise((resolve) => {
    if (!ref || typeof ref.measureInWindow !== 'function') {
      resolve(null);
      return;
    }
    try {
      ref.measureInWindow((x: number, y: number, width: number, height: number) => {
        if (
          typeof x !== 'number' ||
          typeof y !== 'number' ||
          typeof width !== 'number' ||
          typeof height !== 'number'
        ) {
          resolve(null);
          return;
        }
        resolve({ x, y, width, height });
      });
    } catch {
      resolve(null);
    }
  });
}

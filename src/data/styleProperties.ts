/**
 * Comprehensive list of React Native style properties, grouped by
 * category, with default values the "+ Add property" flow can use
 * when a style is inserted for the first time.
 *
 * Ordered for UX: most common props appear first within each group.
 */

import type { StyleProperty } from '../types';

export interface StylePropertyDef {
  key: string;
  type: StyleProperty['type'];
  default: string | number | boolean;
  group: StyleGroup;
  /** Optional enum values for smart editors (dropdowns). */
  enum?: string[];
}

export type StyleGroup =
  | 'Layout'
  | 'Flex'
  | 'Spacing'
  | 'Sizing'
  | 'Position'
  | 'Background'
  | 'Border'
  | 'Shadow'
  | 'Typography'
  | 'Transform'
  | 'Visibility';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const STYLE_PROPERTIES: StylePropertyDef[] = [
  // ── Layout ──────────────────────────────────────────────────────
  { key: 'display', type: 'string', default: 'flex', group: 'Layout', enum: ['flex', 'none'] },
  { key: 'overflow', type: 'string', default: 'visible', group: 'Layout', enum: ['visible', 'hidden', 'scroll'] },
  { key: 'aspectRatio', type: 'number', default: 1, group: 'Layout' },
  { key: 'zIndex', type: 'number', default: 0, group: 'Layout' },
  { key: 'direction', type: 'string', default: 'inherit', group: 'Layout', enum: ['inherit', 'ltr', 'rtl'] },

  // ── Flex ────────────────────────────────────────────────────────
  { key: 'flex', type: 'number', default: 1, group: 'Flex' },
  { key: 'flexDirection', type: 'string', default: 'column', group: 'Flex', enum: ['row', 'column', 'row-reverse', 'column-reverse'] },
  { key: 'flexWrap', type: 'string', default: 'nowrap', group: 'Flex', enum: ['wrap', 'nowrap', 'wrap-reverse'] },
  { key: 'flexGrow', type: 'number', default: 0, group: 'Flex' },
  { key: 'flexShrink', type: 'number', default: 1, group: 'Flex' },
  { key: 'flexBasis', type: 'number', default: 0, group: 'Flex' },
  { key: 'justifyContent', type: 'string', default: 'flex-start', group: 'Flex', enum: ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly'] },
  { key: 'alignItems', type: 'string', default: 'stretch', group: 'Flex', enum: ['flex-start', 'flex-end', 'center', 'stretch', 'baseline'] },
  { key: 'alignSelf', type: 'string', default: 'auto', group: 'Flex', enum: ['auto', 'flex-start', 'flex-end', 'center', 'stretch', 'baseline'] },
  { key: 'alignContent', type: 'string', default: 'flex-start', group: 'Flex', enum: ['flex-start', 'flex-end', 'center', 'stretch', 'space-between', 'space-around'] },
  { key: 'gap', type: 'number', default: 8, group: 'Flex' },
  { key: 'rowGap', type: 'number', default: 8, group: 'Flex' },
  { key: 'columnGap', type: 'number', default: 8, group: 'Flex' },

  // ── Spacing ─────────────────────────────────────────────────────
  { key: 'padding', type: 'number', default: 16, group: 'Spacing' },
  { key: 'paddingHorizontal', type: 'number', default: 16, group: 'Spacing' },
  { key: 'paddingVertical', type: 'number', default: 12, group: 'Spacing' },
  { key: 'paddingTop', type: 'number', default: 12, group: 'Spacing' },
  { key: 'paddingRight', type: 'number', default: 16, group: 'Spacing' },
  { key: 'paddingBottom', type: 'number', default: 12, group: 'Spacing' },
  { key: 'paddingLeft', type: 'number', default: 16, group: 'Spacing' },
  { key: 'paddingStart', type: 'number', default: 16, group: 'Spacing' },
  { key: 'paddingEnd', type: 'number', default: 16, group: 'Spacing' },
  { key: 'margin', type: 'number', default: 16, group: 'Spacing' },
  { key: 'marginHorizontal', type: 'number', default: 16, group: 'Spacing' },
  { key: 'marginVertical', type: 'number', default: 12, group: 'Spacing' },
  { key: 'marginTop', type: 'number', default: 12, group: 'Spacing' },
  { key: 'marginRight', type: 'number', default: 16, group: 'Spacing' },
  { key: 'marginBottom', type: 'number', default: 12, group: 'Spacing' },
  { key: 'marginLeft', type: 'number', default: 16, group: 'Spacing' },
  { key: 'marginStart', type: 'number', default: 16, group: 'Spacing' },
  { key: 'marginEnd', type: 'number', default: 16, group: 'Spacing' },

  // ── Sizing ──────────────────────────────────────────────────────
  { key: 'width', type: 'number', default: 100, group: 'Sizing' },
  { key: 'height', type: 'number', default: 100, group: 'Sizing' },
  { key: 'minWidth', type: 'number', default: 0, group: 'Sizing' },
  { key: 'minHeight', type: 'number', default: 0, group: 'Sizing' },
  { key: 'maxWidth', type: 'number', default: 400, group: 'Sizing' },
  { key: 'maxHeight', type: 'number', default: 400, group: 'Sizing' },

  // ── Position ────────────────────────────────────────────────────
  { key: 'position', type: 'string', default: 'relative', group: 'Position', enum: ['absolute', 'relative', 'static'] },
  { key: 'top', type: 'number', default: 0, group: 'Position' },
  { key: 'right', type: 'number', default: 0, group: 'Position' },
  { key: 'bottom', type: 'number', default: 0, group: 'Position' },
  { key: 'left', type: 'number', default: 0, group: 'Position' },
  { key: 'start', type: 'number', default: 0, group: 'Position' },
  { key: 'end', type: 'number', default: 0, group: 'Position' },

  // ── Background ──────────────────────────────────────────────────
  { key: 'backgroundColor', type: 'color', default: '#7C9BFF', group: 'Background' },
  { key: 'opacity', type: 'number', default: 1, group: 'Background' },

  // ── Border ──────────────────────────────────────────────────────
  { key: 'borderRadius', type: 'number', default: 8, group: 'Border' },
  { key: 'borderTopLeftRadius', type: 'number', default: 8, group: 'Border' },
  { key: 'borderTopRightRadius', type: 'number', default: 8, group: 'Border' },
  { key: 'borderBottomLeftRadius', type: 'number', default: 8, group: 'Border' },
  { key: 'borderBottomRightRadius', type: 'number', default: 8, group: 'Border' },
  { key: 'borderWidth', type: 'number', default: 1, group: 'Border' },
  { key: 'borderTopWidth', type: 'number', default: 1, group: 'Border' },
  { key: 'borderRightWidth', type: 'number', default: 1, group: 'Border' },
  { key: 'borderBottomWidth', type: 'number', default: 1, group: 'Border' },
  { key: 'borderLeftWidth', type: 'number', default: 1, group: 'Border' },
  { key: 'borderColor', type: 'color', default: '#2a2a2a', group: 'Border' },
  { key: 'borderTopColor', type: 'color', default: '#2a2a2a', group: 'Border' },
  { key: 'borderRightColor', type: 'color', default: '#2a2a2a', group: 'Border' },
  { key: 'borderBottomColor', type: 'color', default: '#2a2a2a', group: 'Border' },
  { key: 'borderLeftColor', type: 'color', default: '#2a2a2a', group: 'Border' },
  { key: 'borderStyle', type: 'string', default: 'solid', group: 'Border', enum: ['solid', 'dotted', 'dashed'] },

  // ── Shadow (iOS) ────────────────────────────────────────────────
  { key: 'shadowColor', type: 'color', default: '#000000', group: 'Shadow' },
  { key: 'shadowOpacity', type: 'number', default: 0.25, group: 'Shadow' },
  { key: 'shadowRadius', type: 'number', default: 8, group: 'Shadow' },
  { key: 'elevation', type: 'number', default: 4, group: 'Shadow' },

  // ── Typography (Text) ───────────────────────────────────────────
  { key: 'color', type: 'color', default: '#fafafa', group: 'Typography' },
  { key: 'fontSize', type: 'number', default: 14, group: 'Typography' },
  { key: 'fontWeight', type: 'string', default: '400', group: 'Typography', enum: ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'] },
  { key: 'fontFamily', type: 'string', default: 'System', group: 'Typography' },
  { key: 'fontStyle', type: 'string', default: 'normal', group: 'Typography', enum: ['normal', 'italic'] },
  { key: 'lineHeight', type: 'number', default: 20, group: 'Typography' },
  { key: 'letterSpacing', type: 'number', default: 0, group: 'Typography' },
  { key: 'textAlign', type: 'string', default: 'auto', group: 'Typography', enum: ['auto', 'left', 'right', 'center', 'justify'] },
  { key: 'textAlignVertical', type: 'string', default: 'auto', group: 'Typography', enum: ['auto', 'top', 'bottom', 'center'] },
  { key: 'textDecorationLine', type: 'string', default: 'none', group: 'Typography', enum: ['none', 'underline', 'line-through', 'underline line-through'] },
  { key: 'textDecorationStyle', type: 'string', default: 'solid', group: 'Typography', enum: ['solid', 'double', 'dotted', 'dashed'] },
  { key: 'textDecorationColor', type: 'color', default: '#fafafa', group: 'Typography' },
  { key: 'textTransform', type: 'string', default: 'none', group: 'Typography', enum: ['none', 'uppercase', 'lowercase', 'capitalize'] },
  { key: 'textShadowColor', type: 'color', default: '#000000', group: 'Typography' },
  { key: 'textShadowRadius', type: 'number', default: 2, group: 'Typography' },
  { key: 'writingDirection', type: 'string', default: 'auto', group: 'Typography', enum: ['auto', 'ltr', 'rtl'] },
  { key: 'includeFontPadding', type: 'boolean', default: true, group: 'Typography' },

  // ── Transform ───────────────────────────────────────────────────
  { key: 'transformOrigin', type: 'string', default: 'center', group: 'Transform' },
  // Note: the `transform` array form is handled via inline editing, not here.

  // ── Visibility ──────────────────────────────────────────────────
  { key: 'pointerEvents', type: 'string', default: 'auto', group: 'Visibility', enum: ['auto', 'none', 'box-none', 'box-only'] },
];

export const STYLE_GROUPS: StyleGroup[] = [
  'Layout',
  'Flex',
  'Spacing',
  'Sizing',
  'Position',
  'Background',
  'Border',
  'Shadow',
  'Typography',
  'Transform',
  'Visibility',
];

/**
 * Returns the default value we should insert when the user adds a new
 * style property via the "+ Add property" flow.
 */
export function defaultValueFor(key: string): string | number | boolean {
  const def = STYLE_PROPERTIES.find((p) => p.key === key);
  return def ? def.default : 0;
}

export function styleDef(key: string): StylePropertyDef | undefined {
  return STYLE_PROPERTIES.find((p) => p.key === key);
}

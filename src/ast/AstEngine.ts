/**
 * AstEngine
 *
 * Server-side (Node.js) module that rewrites a JSX element's `style`
 * prop in-place on disk, preserving formatting, comments, and
 * surrounding code thanks to recast.
 *
 * Location resolution uses the (line, column) coordinates of the
 * JSXOpeningElement — the same coordinates the babel plugin and the
 * default JSX dev transform embed into `__rnStudioSource` / `__source`
 * at compile time.
 *
 * Handles five forms of the `style` prop:
 *
 *   1. No `style` at all      → adds `style={{ [key]: value }}`
 *   2. `style={{...}}`         → upserts inline
 *   3. `style={[a, {...}]}`    → upserts into the first inline object,
 *                                or appends a new override object
 *   4. `style={styles.foo}`    → resolves to the matching entry in
 *                                `const styles = StyleSheet.create({...})`
 *                                and upserts there
 *   5. Anything else           → wraps into an array with an inline
 *                                override: `style={[expr, { [key]: value }]}`
 *
 * Library source files (anything under `node_modules` or
 * `react-native/Libraries`) are refused — they're often Flow-typed
 * and should never be rewritten by a userland tool anyway.
 */
import * as parser from '@babel/parser';
import * as recast from 'recast';
import * as fs from 'fs';
import { pushEdit } from './UndoStack';

export interface RewriteOptions {
  file: string;
  line: number;
  column: number;
  key: string;
  value: string | number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

const b = recast.types.builders;

function buildLiteral(value: string | number) {
  if (typeof value === 'number') return b.numericLiteral(value);
  return b.stringLiteral(String(value));
}

function getPropertyKeyName(prop: any): string | null {
  if (!prop || !prop.key) return null;
  const k = prop.key;
  if (k.type === 'Identifier') return k.name;
  if (k.type === 'StringLiteral') return k.value;
  if (k.type === 'Literal') return k.value;
  return null;
}

function upsertObjectProperty(
  objExpr: any,
  key: string,
  value: string | number,
): void {
  const props = objExpr.properties as any[];
  const existing = props.find((p: any) => {
    if (!p || (p.type !== 'ObjectProperty' && p.type !== 'Property')) {
      return false;
    }
    return getPropertyKeyName(p) === key;
  });
  const literal = buildLiteral(value);
  if (existing) {
    existing.value = literal;
  } else {
    props.push(b.property('init', b.identifier(key), literal));
  }
}

/**
 * Finds `const <objectName> = StyleSheet.create({...})` in the module
 * body and returns the inner object expression for the entry named
 * `propertyName` (creating it if missing). Returns null if the variable
 * isn't declared via `StyleSheet.create(...)`.
 */
function findStyleSheetEntry(
  ast: any,
  objectName: string,
  propertyName: string,
): any | null {
  let targetObject: any = null;

  recast.visit(ast, {
    visitVariableDeclarator(path) {
      const node = path.node as any;
      if (
        !node.id ||
        node.id.type !== 'Identifier' ||
        node.id.name !== objectName
      ) {
        return this.traverse(path);
      }
      const init = node.init;
      if (!init || init.type !== 'CallExpression') return false;
      const callee = init.callee;
      const isStyleSheetCreate =
        (callee.type === 'MemberExpression' &&
          callee.object &&
          callee.object.name === 'StyleSheet' &&
          callee.property &&
          callee.property.name === 'create') ||
        (callee.type === 'Identifier' && callee.name === 'create');
      if (!isStyleSheetCreate) return false;
      const arg = init.arguments && init.arguments[0];
      if (!arg || arg.type !== 'ObjectExpression') return false;

      let entry = arg.properties.find(
        (p: any) => getPropertyKeyName(p) === propertyName,
      );
      if (!entry) {
        entry = b.property(
          'init',
          b.identifier(propertyName),
          b.objectExpression([]),
        );
        arg.properties.push(entry);
      }
      if (entry.value && entry.value.type === 'ObjectExpression') {
        targetObject = entry.value;
      }
      return false;
    },
  });

  return targetObject;
}

/**
 * Wraps a non-array style expression into an array so we can append
 * an inline override object. Mutates the JSXAttribute in place and
 * returns the appended ObjectExpression for the caller to upsert into.
 */
function convertStyleToArrayOverride(styleAttr: any): any | null {
  const container = styleAttr.value;
  if (!container || container.type !== 'JSXExpressionContainer') return null;
  const originalExpr = container.expression;
  const override = b.objectExpression([]);
  container.expression = b.arrayExpression([originalExpr, override]);
  return override;
}

/**
 * Rewrites (or inserts) a single style key on the JSX element that
 * begins at the supplied (line, column) in the supplied file.
 */
export async function rewriteStyle(opts: RewriteOptions): Promise<void> {
  const { file, line, column, key, value } = opts;

  if (!fs.existsSync(file)) {
    throw new Error(`Source file not found: ${file}`);
  }
  if (
    file.indexOf('/node_modules/') !== -1 ||
    file.indexOf('react-native/Libraries/') !== -1
  ) {
    throw new Error(`Refusing to rewrite library source file: ${file}`);
  }

  const source = fs.readFileSync(file, 'utf-8');
  const isFlow = /@flow/.test(source.slice(0, 500));
  const isTS = /\.tsx?$/.test(file);
  const langPlugin: 'flow' | 'typescript' = isFlow
    ? 'flow'
    : isTS
      ? 'typescript'
      : 'flow';

  const ast = recast.parse(source, {
    parser: {
      parse: (src: string) =>
        parser.parse(src, {
          sourceType: 'module',
          plugins: [langPlugin, 'jsx'],
          tokens: true,
          errorRecovery: true,
        }),
    },
  });

  let matched = false;
  let mutated = false;

  recast.visit(ast, {
    visitJSXOpeningElement(path) {
      const loc = path.node.loc && path.node.loc.start;
      if (!loc || loc.line !== line || loc.column !== column) {
        return this.traverse(path);
      }
      matched = true;

      const attributes = (path.node.attributes || []) as any[];
      let styleAttr = attributes.find(
        (a: any) =>
          a.type === 'JSXAttribute' && a.name && a.name.name === 'style',
      );

      // Case A: no style prop yet — add an inline object.
      if (!styleAttr) {
        const obj = b.objectExpression([
          b.property('init', b.identifier(key), buildLiteral(value)),
        ]);
        styleAttr = b.jsxAttribute(
          b.jsxIdentifier('style'),
          b.jsxExpressionContainer(obj),
        );
        (path.node.attributes as any[]).push(styleAttr);
        mutated = true;
        return false;
      }

      const expr =
        styleAttr.value &&
        styleAttr.value.type === 'JSXExpressionContainer' &&
        styleAttr.value.expression;
      if (!expr) return false;

      // Case B: inline object literal → upsert directly.
      if (expr.type === 'ObjectExpression') {
        upsertObjectProperty(expr, key, value);
        mutated = true;
        return false;
      }

      // Case C: array expression → upsert into first inline object,
      // or push a new override object at the end.
      if (expr.type === 'ArrayExpression') {
        const firstObj = (expr.elements || []).find(
          (el: any) => el && el.type === 'ObjectExpression',
        );
        if (firstObj) {
          upsertObjectProperty(firstObj as any, key, value);
        } else {
          (expr.elements as any[]).push(
            b.objectExpression([
              b.property('init', b.identifier(key), buildLiteral(value)),
            ]),
          );
        }
        mutated = true;
        return false;
      }

      // Case D: MemberExpression like `styles.title` — try to resolve
      // the StyleSheet.create definition and upsert in place.
      if (
        expr.type === 'MemberExpression' &&
        expr.object &&
        expr.object.type === 'Identifier' &&
        expr.property &&
        expr.property.type === 'Identifier'
      ) {
        const objectName = expr.object.name;
        const propertyName = expr.property.name;
        const entry = findStyleSheetEntry(ast, objectName, propertyName);
        if (entry) {
          upsertObjectProperty(entry, key, value);
          mutated = true;
          return false;
        }
        // Fallback: convert to [styles.title, { key: value }]
        const override = convertStyleToArrayOverride(styleAttr);
        if (override) {
          upsertObjectProperty(override, key, value);
          mutated = true;
        }
        return false;
      }

      // Case E: identifier, conditional, call, etc. — fall back to
      // wrapping the expression in an array with an inline override.
      const override = convertStyleToArrayOverride(styleAttr);
      if (override) {
        upsertObjectProperty(override, key, value);
        mutated = true;
      }
      return false;
    },
  });

  if (!matched) {
    throw new Error(
      `Could not locate JSX element at ${file}:${line}:${column}`,
    );
  }
  if (!mutated) {
    throw new Error(
      `Matched JSX at ${file}:${line}:${column} but could not write style "${key}" — unsupported style expression form.`,
    );
  }

  const output = recast.print(ast).code;

  // No-op guard: don't touch the file if nothing actually changed.
  if (output === source) return;

  fs.writeFileSync(file, output, 'utf-8');
  pushEdit({
    file,
    before: source,
    after: output,
    label: `${key} = ${value}`,
  });
}

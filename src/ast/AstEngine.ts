/**
 * AstEngine
 *
 * Server-side (Node.js) module that rewrites a JSX element's `style` prop
 * in-place on disk, preserving formatting, comments, and surrounding code
 * thanks to recast.
 *
 * Location resolution is based on the (line, column) coordinates of the
 * JSXOpeningElement — the same coordinates the babel plugin embeds into
 * `__rnStudioSource` at compile time.
 */
import * as parser from '@babel/parser';
import * as recast from 'recast';
import * as fs from 'fs';

export interface RewriteOptions {
  file: string;
  line: number;
  column: number;
  key: string;
  value: string | number;
}

const b = recast.types.builders;

function buildLiteral(value: string | number) {
  if (typeof value === 'number') return b.numericLiteral(value);
  return b.stringLiteral(String(value));
}

/**
 * Rewrites (or inserts) a single style key on the JSX element that
 * begins at the supplied (line, column). Supports:
 *
 *   - Inline object literal:  style={{ backgroundColor: 'red' }}
 *   - Array with inline obj:  style={[base, { backgroundColor: 'red' }]}
 */
export async function rewriteStyle(opts: RewriteOptions): Promise<void> {
  const { file, line, column, key, value } = opts;

  if (!fs.existsSync(file)) {
    throw new Error(`Source file not found: ${file}`);
  }

  const source = fs.readFileSync(file, 'utf-8');

  const ast = recast.parse(source, {
    parser: {
      parse: (src: string) =>
        parser.parse(src, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx'],
          tokens: true,
        }),
    },
  });

  let matched = false;

  recast.visit(ast, {
    visitJSXOpeningElement(path) {
      const loc = path.node.loc && path.node.loc.start;
      if (!loc || loc.line !== line || loc.column !== column) {
        return this.traverse(path);
      }

      matched = true;

      // Locate the `style` prop.
      const attributes = (path.node.attributes || []) as any[];
      let styleAttr = attributes.find(
        (a: any) =>
          a.type === 'JSXAttribute' && a.name && a.name.name === 'style'
      );

      // If no style prop exists, create one:  style={{ [key]: value }}
      if (!styleAttr) {
        const obj = b.objectExpression([
          b.property('init', b.identifier(key), buildLiteral(value)),
        ]);
        styleAttr = b.jsxAttribute(
          b.jsxIdentifier('style'),
          b.jsxExpressionContainer(obj)
        );
        (path.node.attributes as any[]).push(styleAttr);
        return false;
      }

      const expr =
        styleAttr.value &&
        styleAttr.value.type === 'JSXExpressionContainer' &&
        styleAttr.value.expression;

      if (!expr) return false;

      // Case 1: inline object.
      if (expr.type === 'ObjectExpression') {
        upsertObjectProperty(expr, key, value);
        return false;
      }

      // Case 2: array — look for the first ObjectExpression and upsert.
      if (expr.type === 'ArrayExpression') {
        const firstObj = (expr.elements || []).find(
          (el: any) => el && el.type === 'ObjectExpression'
        );
        if (firstObj) {
          upsertObjectProperty(firstObj as any, key, value);
        } else {
          (expr.elements as any[]).push(
            b.objectExpression([
              b.property('init', b.identifier(key), buildLiteral(value)),
            ])
          );
        }
        return false;
      }

      // Case 3: identifier (e.g. style={styles.foo}) — unsupported for now.
      // A future version could resolve StyleSheet.create definitions.
      return false;
    },
  });

  if (!matched) {
    throw new Error(
      `Could not locate JSX element at ${file}:${line}:${column}`
    );
  }

  const output = recast.print(ast).code;
  fs.writeFileSync(file, output, 'utf-8');
}

function upsertObjectProperty(
  objExpr: any,
  key: string,
  value: string | number
): void {
  const props = objExpr.properties as any[];
  const existing = props.find((p: any) => {
    if (!p || (p.type !== 'ObjectProperty' && p.type !== 'Property')) return false;
    const k = p.key;
    if (!k) return false;
    return (
      (k.type === 'Identifier' && k.name === key) ||
      (k.type === 'StringLiteral' && k.value === key) ||
      (k.type === 'Literal' && k.value === key)
    );
  });

  const literal = buildLiteral(value);

  if (existing) {
    existing.value = literal;
  } else {
    props.push(b.property('init', b.identifier(key), literal));
  }
}

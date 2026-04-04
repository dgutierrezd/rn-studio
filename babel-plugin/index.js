/**
 * babel-plugin-rn-studio
 *
 * Instruments every JSX element at compile time by injecting a
 * `__rnStudioSource` prop that carries source location metadata.
 *
 * The metadata is later used at runtime by the rn-studio overlay to
 * resolve any on-screen component back to its exact location in the
 * source file, so the AST engine can rewrite it.
 *
 * Usage (consumer app babel.config.js):
 *
 *   plugins: [
 *     ...(process.env.NODE_ENV !== 'production' ? ['rn-studio/babel-plugin'] : [])
 *   ]
 */
module.exports = function rnStudioBabelPlugin({ types: t }) {
  return {
    name: 'babel-plugin-rn-studio',
    visitor: {
      JSXOpeningElement(path, state) {
        // Never instrument in production builds.
        if (process.env.NODE_ENV === 'production') return;

        const filename = state.filename || 'unknown';
        const { line, column } = (path.node.loc && path.node.loc.start) || {
          line: 0,
          column: 0,
        };

        const nameNode = path.node.name;
        let componentName = 'Unknown';
        if (t.isJSXIdentifier(nameNode)) {
          componentName = nameNode.name;
        } else if (t.isJSXMemberExpression(nameNode)) {
          const obj = nameNode.object && nameNode.object.name;
          const prop = nameNode.property && nameNode.property.name;
          componentName = `${obj || '?'}.${prop || '?'}`;
        }

        // Skip if already annotated (idempotent across re-runs).
        const already = path.node.attributes.some(
          (a) =>
            t.isJSXAttribute(a) &&
            t.isJSXIdentifier(a.name, { name: '__rnStudioSource' })
        );
        if (already) return;

        const sourceProp = t.jsxAttribute(
          t.jsxIdentifier('__rnStudioSource'),
          t.jsxExpressionContainer(
            t.objectExpression([
              t.objectProperty(t.identifier('file'), t.stringLiteral(filename)),
              t.objectProperty(t.identifier('line'), t.numericLiteral(line)),
              t.objectProperty(t.identifier('column'), t.numericLiteral(column)),
              t.objectProperty(
                t.identifier('componentName'),
                t.stringLiteral(componentName)
              ),
            ])
          )
        );

        path.node.attributes.push(sourceProp);
      },
    },
  };
};

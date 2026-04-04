/**
 * Root babel config for the rn-studio package itself. This is only used
 * when hacking on rn-studio locally; consumer apps do NOT need to copy
 * this file — they only register the plugin:
 *
 *   plugins: ['rn-studio/babel-plugin']
 */
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: '16' } }],
    '@babel/preset-typescript',
  ],
};

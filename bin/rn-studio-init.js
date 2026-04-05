#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * rn-studio init
 *
 * Zero-config bootstrap for consumer apps. Run:
 *
 *   npx rn-studio init
 *
 * This command:
 *   1. Adds `rn-studio/babel-plugin` to the project's babel.config.js
 *      (gated on `process.env.NODE_ENV !== 'production'`)
 *   2. Adds a `"studio": "rn-studio-server"` script to package.json
 *   3. Prints the exact snippet to paste into App.tsx
 */
const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
const INDIGO = '\x1b[38;5;111m';
const GREEN = '\x1b[32m';
const GREY = '\x1b[90m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function log(msg) { console.log(msg); }
function ok(msg) { console.log(`${GREEN}✓${RESET} ${msg}`); }
function info(msg) { console.log(`${INDIGO}→${RESET} ${msg}`); }
function warn(msg) { console.log(`${GREY}! ${msg}${RESET}`); }

function banner() {
  console.log('');
  console.log(`  ${INDIGO}${BOLD}rn-studio init${RESET}`);
  console.log(`  ${GREY}Live UI editor for React Native${RESET}`);
  console.log('');
}

/* ───────────────── package.json ───────────────── */
function patchPackageJson() {
  const pkgPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    warn('No package.json found — skipping script injection.');
    return;
  }
  const raw = fs.readFileSync(pkgPath, 'utf-8');
  const pkg = JSON.parse(raw);
  pkg.scripts = pkg.scripts || {};

  if (pkg.scripts.studio === 'rn-studio-server') {
    ok('package.json already has a "studio" script.');
    return;
  }
  if (pkg.scripts.studio && pkg.scripts.studio !== 'rn-studio-server') {
    warn(`package.json has a different "studio" script (${pkg.scripts.studio}). Leaving untouched.`);
    return;
  }
  pkg.scripts.studio = 'rn-studio-server';
  // Preserve two-space indentation convention.
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  ok('Added `"studio": "rn-studio-server"` to package.json scripts.');
}

/* ───────────────── babel.config.js ───────────────── */
function patchBabelConfig() {
  const candidates = [
    'babel.config.js',
    'babel.config.cjs',
    'babel.config.mjs',
    '.babelrc.js',
    '.babelrc',
  ];
  const found = candidates
    .map((c) => path.join(cwd, c))
    .find((p) => fs.existsSync(p));

  if (!found) {
    warn('No babel.config.js found — creating one.');
    const fresh = `module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    ...(process.env.NODE_ENV !== 'production' ? ['rn-studio/babel-plugin'] : []),
  ],
};
`;
    fs.writeFileSync(path.join(cwd, 'babel.config.js'), fresh, 'utf-8');
    ok('Created babel.config.js with rn-studio plugin registered.');
    return;
  }

  const content = fs.readFileSync(found, 'utf-8');
  if (content.indexOf('rn-studio/babel-plugin') !== -1) {
    ok(`${path.basename(found)} already references rn-studio/babel-plugin.`);
    return;
  }

  // Attempt a light, string-based injection. If the file has a
  // `plugins: [ ... ]` array, append the spread expression; otherwise
  // add a new plugins property after the presets line.
  let patched;
  if (/plugins\s*:\s*\[/.test(content)) {
    patched = content.replace(
      /plugins\s*:\s*\[/,
      `plugins: [\n    ...(process.env.NODE_ENV !== 'production' ? ['rn-studio/babel-plugin'] : []),`,
    );
  } else {
    patched = content.replace(
      /presets\s*:\s*\[[^\]]*\]\s*,?/,
      (m) => `${m.replace(/,?\s*$/, ',')}\n  plugins: [\n    ...(process.env.NODE_ENV !== 'production' ? ['rn-studio/babel-plugin'] : []),\n  ],`,
    );
  }

  if (patched === content) {
    warn(`Could not auto-patch ${path.basename(found)} — add this manually:`);
    console.log(
      `    plugins: [\n      ...(process.env.NODE_ENV !== 'production' ? ['rn-studio/babel-plugin'] : []),\n    ],`,
    );
    return;
  }

  fs.writeFileSync(found, patched, 'utf-8');
  ok(`Patched ${path.basename(found)} to include rn-studio/babel-plugin.`);
}

/* ───────────────── App.tsx snippet ───────────────── */
function printAppSnippet() {
  console.log('');
  info('Add this to your App.tsx (or wherever you mount the root):');
  console.log('');
  console.log(`${GREY}────────────────────────────────────────────────${RESET}`);
  console.log(`${INDIGO}import${RESET} { StudioProvider } ${INDIGO}from${RESET} 'rn-studio';`);
  console.log('');
  console.log(`${INDIGO}export default function${RESET} App() {`);
  console.log('  return (');
  console.log(`    <StudioProvider enabled={__DEV__} bubblePosition="bottom-right">`);
  console.log('      <YourApp />');
  console.log('    </StudioProvider>');
  console.log('  );');
  console.log('}');
  console.log(`${GREY}────────────────────────────────────────────────${RESET}`);
  console.log('');
}

/* ───────────────── run instructions ───────────────── */
function printRunInstructions() {
  console.log(`${BOLD}Next steps:${RESET}`);
  console.log('');
  console.log(`  ${GREY}#${RESET} Terminal 1 — Metro`);
  console.log(`  ${INDIGO}npx${RESET} react-native start`);
  console.log('');
  console.log(`  ${GREY}#${RESET} Terminal 2 — rn-studio server`);
  console.log(`  ${INDIGO}npm run${RESET} studio`);
  console.log('');
  console.log(
    `${GREEN}✓ Setup complete.${RESET} Launch your app, tap the floating bubble,\n  then tap any component to edit its styles live.`,
  );
  console.log('');
}

/* ───────────────── main ───────────────── */
function main() {
  banner();
  try {
    patchPackageJson();
    patchBabelConfig();
    printAppSnippet();
    printRunInstructions();
  } catch (err) {
    console.error(`\n${GREY}!${RESET} rn-studio init failed:`, err && err.message);
    process.exit(1);
  }
}

main();

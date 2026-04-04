# rn-studio

> Live UI editor for React Native — inspect and edit components directly inside your iOS Simulator or Android Emulator.

`rn-studio` is a zero-production-cost devtool that turns your emulator into a live visual editor. Wrap your app, tap the floating bubble, tap any component on screen, and edit its styles from a native inspector panel. Edits are written straight back to your source files via AST rewriting, so Metro Fast Refresh updates the UI instantly and your git diff shows a clean, hand-edited change.

## Features

- 🎨 **Visual selection** — tap any component in your running app.
- 🧩 **Inspector panel** — Styles / Tree / Props tabs, dark native UI.
- ✍️ **Writes back to source** — powered by `@babel/parser` + `recast`, preserves formatting and comments.
- ⚡ **Fast Refresh integrated** — edits are hot-reloaded in milliseconds.
- 🪶 **Zero production overhead** — disabled via `__DEV__`; the provider short-circuits to `children` in release.
- 📱 **Pure RN** — no native modules to link; ships as a pure JS package.

## Installation

```sh
npm install --save-dev rn-studio
# peer deps used for best-in-class UX (all optional)
npm install react-native-reanimated react-native-gesture-handler \
            react-native-safe-area-context react-native-haptic-feedback
```

## Setup

### 1. Register the babel plugin (dev only)

```js
// babel.config.js
module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    ...(process.env.NODE_ENV !== 'production' ? ['rn-studio/babel-plugin'] : []),
  ],
};
```

### 2. Wrap your app

```tsx
// App.tsx
import { StudioProvider } from 'rn-studio';

export default function App() {
  return (
    <StudioProvider enabled={__DEV__} bubblePosition="bottom-right">
      <YourApp />
    </StudioProvider>
  );
}
```

### 3. Add the CLI server script

```json
// package.json
{
  "scripts": {
    "studio": "rn-studio-server"
  }
}
```

### 4. Run both Metro and the studio server

```sh
npx react-native start   # Terminal 1 — Metro
npm run studio           # Terminal 2 — rn-studio server (ws://localhost:7878)
```

Launch your app in the simulator. A floating 🎨 bubble appears in the corner. Tap it, tap any component, and start editing.

## How it works

1. **Babel plugin** — at compile time, every JSX opening element gets a `__rnStudioSource` prop with `{ file, line, column, componentName }`.
2. **Runtime overlay** — when selection mode is on, the overlay captures touches, walks the React fiber tree to find the nearest component with source metadata, then measures it for the highlight box.
3. **WebSocket bridge** — the runtime sends `STYLE_CHANGE` messages over `ws://localhost:7878`.
4. **AST engine** — the CLI server uses `recast` to reparse the target file, finds the exact `JSXOpeningElement` by `(line, column)`, upserts the style property, and writes the file back.
5. **Fast Refresh** — Metro notices the file change and hot-reloads your app.

## State machine

```
IDLE → (tap bubble) → ACTIVE → (tap component) → SELECTED
                                        ↓
                                     EDITING
```

Tapping the bubble again at any time returns to `IDLE` and releases touch interception.

## License

MIT

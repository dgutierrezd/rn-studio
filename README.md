# rn-studio

> Live UI editor for React Native. Inspect and edit any component directly inside the iOS Simulator or Android Emulator — changes are written to your source code automatically.

[![npm version](https://img.shields.io/npm/v/rn-studio.svg)](https://www.npmjs.com/package/rn-studio)
[![license](https://img.shields.io/npm/l/rn-studio.svg)](https://github.com/dgutierrezd/rn-studio/blob/main/LICENSE)
[![platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android-blue.svg)](https://github.com/dgutierrezd/rn-studio)

## What it does

rn-studio adds a floating bubble to your app in DEV mode. Tap it, tap any component, and a panel appears showing all its styles and the internal component tree. Edit a value — the change is written directly to your source file and Metro Fast Refresh updates the UI instantly. Zero impact on production.

## Install

```bash
npm install rn-studio
```

Peer dependencies:

```bash
npm install react-native-gesture-handler react-native-reanimated react-native-haptic-feedback react-native-safe-area-context
```

## Setup

### 1. Add the babel plugin

```js
// babel.config.js
module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    ...(process.env.NODE_ENV !== 'production' ? ['rn-studio/babel-plugin'] : []),
  ],
};
```

### 2. Start the server (alongside Metro)

```bash
# Terminal 1
npx react-native start

# Terminal 2
npm run studio
```

Add to your app's `package.json`:

```json
{
  "scripts": {
    "studio": "rn-studio-server"
  }
}
```

### 3. Wrap your App.tsx

```tsx
import { StudioProvider } from 'rn-studio';

export default function App() {
  return (
    <StudioProvider enabled={__DEV__} bubblePosition="bottom-right">
      <YourApp />
    </StudioProvider>
  );
}
```

## How it works

| Layer | What it does |
|---|---|
| Babel plugin | Annotates every JSX element with file + line metadata at compile time |
| Floating bubble | Toggles selection mode on tap |
| Selection overlay | Tap any component to inspect it |
| Inspector panel | Shows styles, component tree, and editable props |
| WebSocket bridge | Sends changes from the app to the local CLI server |
| AST engine | Locates and rewrites the exact prop in your source file |
| Metro Fast Refresh | Picks up the file change and updates the UI |

## API

### `<StudioProvider>` props

| Prop | Type | Default | Description |
|---|---|---|---|
| `enabled` | `boolean` | `false` | Show the studio UI |
| `serverPort` | `number` | `7878` | CLI server port |
| `bubblePosition` | `'bottom-right' \| 'bottom-left' \| 'top-right' \| 'top-left'` | `'bottom-right'` | Bubble starting corner |
| `theme` | `'dark' \| 'light'` | `'dark'` | Panel theme |

### `useStudio()`

```ts
const {
  isActive,
  isSelecting,
  selectedComponent,
  toggleActive,
  selectComponent,
  clearSelection,
  updateStyle,
} = useStudio();
```

## Contributing

Pull requests are welcome. For major changes, please open an issue first.

## License

MIT © [dgutierrezd](https://github.com/dgutierrezd)

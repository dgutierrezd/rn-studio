import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useStudio } from '../StudioProvider';
import type { BubblePosition } from '../types';

// AsyncStorage is optional — if the consumer does not have it installed,
// we silently fall back to a per-session only position.
let AsyncStorage: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch {}

// Safe-area-context is a declared peer dependency; if missing we fall
// back to zero insets rather than crashing.
let useSafeAreaInsets: () => { top: number; bottom: number; left: number; right: number };
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  useSafeAreaInsets = require('react-native-safe-area-context').useSafeAreaInsets;
} catch {
  useSafeAreaInsets = () => ({ top: 0, bottom: 0, left: 0, right: 0 });
}

interface Props {
  position?: BubblePosition;
}

const SIZE = 52;
const STORAGE_KEY = '@rn-studio/bubble-position';

function initialXY(position: BubblePosition, insets: { top: number; bottom: number; left: number; right: number }) {
  const { width, height } = Dimensions.get('window');
  const pad = 16;
  const right = width - SIZE - pad - insets.right;
  const left = pad + insets.left;
  const top = pad + insets.top;
  const bottom = height - SIZE - pad - insets.bottom;

  switch (position) {
    case 'bottom-left':
      return { x: left, y: bottom };
    case 'top-right':
      return { x: right, y: top };
    case 'top-left':
      return { x: left, y: top };
    case 'bottom-right':
    default:
      return { x: right, y: bottom };
  }
}

export const FloatingBubble: React.FC<Props> = ({ position = 'bottom-right' }) => {
  const { isActive, toggleActive } = useStudio();
  const insets = useSafeAreaInsets();
  const [loaded, setLoaded] = useState(false);

  const pan = useRef(new Animated.ValueXY(initialXY(position, insets))).current;
  const scale = useRef(new Animated.Value(1)).current;

  // Load persisted position.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (AsyncStorage) {
          const raw = await AsyncStorage.getItem(STORAGE_KEY);
          if (raw && mounted) {
            const parsed = JSON.parse(raw);
            if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
              pan.setValue(parsed);
            }
          }
        }
      } catch {}
      if (mounted) setLoaded(true);
    })();
    return () => {
      mounted = false;
    };
  }, [pan]);

  const persist = (x: number, y: number) => {
    if (AsyncStorage) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ x, y })).catch(() => {});
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_evt, g) =>
        Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
      onPanResponderGrant: () => {
        // @ts-ignore — Animated.ValueXY private but stable.
        pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
        pan.setValue({ x: 0, y: 0 });
        Animated.spring(scale, {
          toValue: 0.9,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_evt, g) => {
        pan.flattenOffset();
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          friction: 4,
        }).start();

        // Treat near-zero-distance gestures as taps.
        if (Math.abs(g.dx) < 4 && Math.abs(g.dy) < 4) {
          triggerHaptic('impactLight');
          toggleActive();
          return;
        }

        // Snap to nearest horizontal edge.
        const { width, height } = Dimensions.get('window');
        // @ts-ignore
        const currentX: number = (pan.x as any)._value;
        // @ts-ignore
        const currentY: number = (pan.y as any)._value;
        const leftEdge = 16 + insets.left;
        const rightEdge = width - SIZE - 16 - insets.right;
        const targetX = currentX + SIZE / 2 < width / 2 ? leftEdge : rightEdge;
        const clampedY = Math.max(
          16 + insets.top,
          Math.min(currentY, height - SIZE - 16 - insets.bottom)
        );

        Animated.spring(pan, {
          toValue: { x: targetX, y: clampedY },
          useNativeDriver: false,
          friction: 6,
          tension: 60,
        }).start(() => persist(targetX, clampedY));
      },
    })
  ).current;

  if (!loaded) return null;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      pointerEvents="box-only"
      style={[
        styles.bubble,
        {
          transform: [
            { translateX: pan.x },
            { translateY: pan.y },
            { scale },
          ],
          backgroundColor: isActive ? '#7C9BFF' : '#222',
        },
      ]}
    >
      <Text style={[styles.icon, { color: isActive ? '#111' : '#fff' }]}>
        {isActive ? '✕' : '🎨'}
      </Text>
    </Animated.View>
  );
};

function triggerHaptic(type: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Haptic = require('react-native-haptic-feedback').default;
    Haptic.trigger(type, { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
  } catch {}
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999999,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    ...Platform.select({
      android: { elevation: 12 },
      default: {},
    }),
  },
  icon: {
    fontSize: 22,
    fontWeight: '700',
  },
});

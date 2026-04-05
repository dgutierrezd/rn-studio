/**
 * persistence
 *
 * Lightweight AsyncStorage wrapper for persisting the last-selected
 * component source across full JS reloads (Cmd+R). Falls back to a
 * no-op in environments where AsyncStorage isn't installed.
 */
import type { SourceLocation } from '../types';

/* eslint-disable @typescript-eslint/no-var-requires */
let AsyncStorage: any = null;
try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch {}

const KEY = '@rn-studio/last-selection';

export async function saveLastSelection(source: SourceLocation): Promise<void> {
  if (!AsyncStorage) return;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(source));
  } catch {}
}

export async function loadLastSelection(): Promise<SourceLocation | null> {
  if (!AsyncStorage) return null;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.file && typeof parsed.line === 'number') {
      return parsed as SourceLocation;
    }
  } catch {}
  return null;
}

export async function clearLastSelection(): Promise<void> {
  if (!AsyncStorage) return;
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {}
}

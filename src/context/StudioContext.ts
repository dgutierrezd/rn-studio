import { createContext } from 'react';
import type { StudioContextValue } from '../types';

/**
 * React context carrying the live studio state. Consumers access it via
 * the `useStudio()` hook exported from `StudioProvider`.
 */
export const StudioContext = createContext<StudioContextValue | null>(null);

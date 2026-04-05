/**
 * UndoStack
 *
 * Server-side (Node.js) undo/redo memory for rn-studio edits.
 *
 * Each `push` captures a snapshot of the file BEFORE and AFTER a
 * rewrite. Undo writes the "before" back to disk and pushes the entry
 * onto the redo stack. Any new edit clears the redo stack (the
 * standard linear history model, same as VS Code).
 */
import * as fs from 'fs';

export interface UndoEntry {
  file: string;
  before: string;
  after: string;
  label: string;
  timestamp: number;
}

const MAX_DEPTH = 50;

const undoStack: UndoEntry[] = [];
const redoStack: UndoEntry[] = [];

export function pushEdit(entry: Omit<UndoEntry, 'timestamp'>): void {
  undoStack.push({ ...entry, timestamp: Date.now() });
  if (undoStack.length > MAX_DEPTH) undoStack.shift();
  redoStack.length = 0;
}

export function undo(): UndoEntry | null {
  const entry = undoStack.pop();
  if (!entry) return null;
  try {
    fs.writeFileSync(entry.file, entry.before, 'utf-8');
  } catch (err) {
    // Restore the entry if the write failed so a retry works.
    undoStack.push(entry);
    throw err;
  }
  redoStack.push(entry);
  return entry;
}

export function redo(): UndoEntry | null {
  const entry = redoStack.pop();
  if (!entry) return null;
  try {
    fs.writeFileSync(entry.file, entry.after, 'utf-8');
  } catch (err) {
    redoStack.push(entry);
    throw err;
  }
  undoStack.push(entry);
  return entry;
}

export function canUndo(): boolean {
  return undoStack.length > 0;
}

export function canRedo(): boolean {
  return redoStack.length > 0;
}

export function getStackState(): { undo: number; redo: number } {
  return { undo: undoStack.length, redo: redoStack.length };
}

export function clear(): void {
  undoStack.length = 0;
  redoStack.length = 0;
}

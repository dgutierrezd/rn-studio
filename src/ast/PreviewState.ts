/**
 * PreviewState
 *
 * Server-side state machine for rn-studio's preview mode. While a
 * preview is active, style changes are still written to disk (so
 * Metro Fast Refresh can visually reflect the edit) but they are
 * held back from the main undo stack.
 *
 * The user has two ways out:
 *
 *   - `commit()` — the NET diff between the original and current
 *     file is pushed as a single undo entry labeled "preview", and
 *     the preview buffer is cleared.
 *
 *   - `cancel()` — the original file content is written back to
 *     disk verbatim, and the preview buffer is cleared. From the
 *     user's perspective it is as if the edits never happened: the
 *     file is pristine, the undo stack is untouched.
 */
import * as fs from 'fs';
import { pushEdit } from './UndoStack';

interface PreviewBuffer {
  file: string;
  originalContent: string;
  editCount: number;
}

let active: PreviewBuffer | null = null;

/**
 * Called by the server when the client sends BEGIN_PREVIEW after
 * selecting a component. Captures the file's current on-disk state
 * so it can be restored on cancel. If a preview was already active
 * for a different file, it is auto-committed first.
 */
export function begin(file: string): void {
  if (active && active.file !== file) {
    // Auto-commit the previous preview so we never leak state.
    commit();
  }
  if (active && active.file === file) {
    // Already previewing this file — nothing to do.
    return;
  }
  if (!fs.existsSync(file)) return;
  const originalContent = fs.readFileSync(file, 'utf-8');
  active = { file, originalContent, editCount: 0 };
}

/**
 * Called by AstEngine.rewriteStyle after a successful write. Returns
 * true if the edit was absorbed into the preview buffer (and should
 * therefore NOT be pushed to the main undo stack). Returns false if
 * there is no active preview or the edit targeted a different file.
 */
export function recordEdit(file: string): boolean {
  if (!active || active.file !== file) return false;
  active.editCount++;
  return true;
}

/**
 * Called when the user taps ✓. Consolidates every edit made during
 * the preview into a single undo entry with the label "preview",
 * then clears the buffer.
 */
export function commit(): { file: string; editCount: number } | null {
  if (!active) return null;
  const { file, originalContent, editCount } = active;
  active = null;
  if (editCount === 0) return { file, editCount: 0 };
  try {
    const currentContent = fs.readFileSync(file, 'utf-8');
    if (currentContent !== originalContent) {
      pushEdit({
        file,
        before: originalContent,
        after: currentContent,
        label: `preview (${editCount} edit${editCount === 1 ? '' : 's'})`,
      });
    }
  } catch {
    // File gone / unreadable — nothing to commit.
  }
  return { file, editCount };
}

/**
 * Called when the user taps ↺. Restores the exact original file
 * content and clears the buffer. Metro Fast Refresh picks up the
 * restore automatically. No entry is pushed to the undo stack.
 */
export function cancel(): { file: string; editCount: number } | null {
  if (!active) return null;
  const { file, originalContent, editCount } = active;
  active = null;
  if (editCount === 0) return { file, editCount: 0 };
  try {
    fs.writeFileSync(file, originalContent, 'utf-8');
  } catch {
    // Best-effort; caller surfaces any error back to the client.
  }
  return { file, editCount };
}

export function isActive(): boolean {
  return active !== null;
}

export function getState(): {
  active: boolean;
  file: string | null;
  editCount: number;
} {
  return {
    active: active !== null,
    file: active ? active.file : null,
    editCount: active ? active.editCount : 0,
  };
}

/** Called on disconnect or manual reset. */
export function reset(): void {
  active = null;
}

#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * rn-studio CLI server
 *
 * Run alongside Metro:   npm run studio
 *
 * Handles:
 *   - STYLE_CHANGE → AST engine rewrites the source file
 *   - UNDO / REDO  → pops/pushes the in-memory edit stack
 *   - STACK_STATE broadcast so clients can enable/disable buttons
 */
const { WebSocketServer } = require('ws');

let AstEngine;
let UndoStack;
let PreviewState;
try {
  AstEngine = require('../dist/ast/AstEngine');
  UndoStack = require('../dist/ast/UndoStack');
  PreviewState = require('../dist/ast/PreviewState');
} catch (err) {
  console.error(
    '[rn-studio] Unable to load dist modules. Did you run `npm run build`?',
  );
  console.error(err.message);
  process.exit(1);
}

const PORT = Number(process.env.RN_STUDIO_PORT) || 7878;
const wss = new WebSocketServer({ port: PORT });

console.log(`[rn-studio] Server running on ws://localhost:${PORT}`);
console.log('[rn-studio] Waiting for React Native runtime to connect...');

function broadcastStackState(ws) {
  const state = UndoStack.getStackState();
  const payload = JSON.stringify({ type: 'STACK_STATE', payload: state });
  if (ws) {
    ws.send(payload);
  } else {
    wss.clients.forEach((c) => {
      if (c.readyState === 1) c.send(payload);
    });
  }
}

wss.on('connection', (ws) => {
  console.log('[rn-studio] Client connected');
  // Sync new clients with the current stack depths.
  broadcastStackState(ws);

  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      ws.send(
        JSON.stringify({
          type: 'ERROR',
          payload: { message: 'Invalid JSON payload' },
        }),
      );
      return;
    }

    try {
      if (msg.type === 'PING') {
        ws.send(JSON.stringify({ type: 'ACK', payload: { success: true } }));
        return;
      }

      if (msg.type === 'STYLE_CHANGE') {
        const { source, key, value } = msg.payload;
        await AstEngine.rewriteStyle({
          file: source.file,
          line: source.line,
          column: source.column,
          key,
          value,
        });
        ws.send(JSON.stringify({ type: 'ACK', payload: { success: true } }));
        console.log(
          `[rn-studio] ✓ ${source.componentName} → ${key}: ${value}`,
        );
        broadcastStackState();
        return;
      }

      if (msg.type === 'UNDO') {
        const entry = UndoStack.undo();
        if (entry) {
          console.log(`[rn-studio] ↶ undo: ${entry.label} (${entry.file})`);
          ws.send(
            JSON.stringify({
              type: 'ACK',
              payload: { success: true, message: 'undo' },
            }),
          );
        } else {
          ws.send(
            JSON.stringify({
              type: 'ACK',
              payload: { success: false, message: 'Nothing to undo' },
            }),
          );
        }
        broadcastStackState();
        return;
      }

      if (msg.type === 'REDO') {
        const entry = UndoStack.redo();
        if (entry) {
          console.log(`[rn-studio] ↷ redo: ${entry.label} (${entry.file})`);
          ws.send(
            JSON.stringify({
              type: 'ACK',
              payload: { success: true, message: 'redo' },
            }),
          );
        } else {
          ws.send(
            JSON.stringify({
              type: 'ACK',
              payload: { success: false, message: 'Nothing to redo' },
            }),
          );
        }
        broadcastStackState();
        return;
      }

      if (msg.type === 'BEGIN_PREVIEW') {
        const file = msg.payload && msg.payload.file;
        if (file) {
          PreviewState.begin(file);
          console.log(`[rn-studio] ⋯ preview begin: ${file}`);
        }
        ws.send(JSON.stringify({ type: 'ACK', payload: { success: true } }));
        return;
      }

      if (msg.type === 'COMMIT_PREVIEW') {
        const result = PreviewState.commit();
        if (result && result.editCount > 0) {
          console.log(
            `[rn-studio] ✓ preview commit: ${result.editCount} edit${
              result.editCount === 1 ? '' : 's'
            } (${result.file})`,
          );
        }
        ws.send(
          JSON.stringify({
            type: 'ACK',
            payload: {
              success: true,
              message: result ? `committed ${result.editCount}` : 'nothing to commit',
            },
          }),
        );
        broadcastStackState();
        return;
      }

      if (msg.type === 'CANCEL_PREVIEW') {
        const result = PreviewState.cancel();
        if (result && result.editCount > 0) {
          console.log(
            `[rn-studio] ↺ preview cancel: reverted ${result.editCount} edit${
              result.editCount === 1 ? '' : 's'
            } (${result.file})`,
          );
        }
        ws.send(
          JSON.stringify({
            type: 'ACK',
            payload: {
              success: true,
              message: result ? `reverted ${result.editCount}` : 'nothing to cancel',
            },
          }),
        );
        broadcastStackState();
        return;
      }

      if (msg.type === 'PROP_CHANGE') {
        ws.send(
          JSON.stringify({
            type: 'ACK',
            payload: {
              success: true,
              message: 'PROP_CHANGE not yet implemented',
            },
          }),
        );
        return;
      }
    } catch (err) {
      console.error('[rn-studio] Error:', err);
      ws.send(
        JSON.stringify({
          type: 'ERROR',
          payload: { message: err && err.message ? err.message : String(err) },
        }),
      );
    }
  });

  ws.on('close', () => {
    console.log('[rn-studio] Client disconnected');
    // Abandon any in-flight preview so a stale buffer can't bleed
    // into a later session on a different file.
    if (PreviewState.isActive()) {
      PreviewState.cancel();
      console.log('[rn-studio] (preview auto-cancelled on disconnect)');
      broadcastStackState();
    }
  });
});

process.on('SIGINT', () => {
  console.log('\n[rn-studio] Shutting down...');
  wss.close(() => process.exit(0));
});

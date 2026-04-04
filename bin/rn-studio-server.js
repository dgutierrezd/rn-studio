#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * rn-studio CLI server
 *
 * Run alongside Metro:   npm run studio
 *
 * Responsibilities:
 *   1. Listen on ws://localhost:7878 for messages from the rn-studio runtime.
 *   2. On STYLE_CHANGE, dispatch to the AST engine which rewrites the
 *      source file. Metro's Fast Refresh instantly propagates the edit.
 */
const { WebSocketServer } = require('ws');

let rewriteStyle;
try {
  ({ rewriteStyle } = require('../dist/ast/AstEngine'));
} catch (err) {
  console.error(
    '[rn-studio] Unable to load dist/ast/AstEngine. Did you run `npm run build`?'
  );
  console.error(err.message);
  process.exit(1);
}

const PORT = Number(process.env.RN_STUDIO_PORT) || 7878;
const wss = new WebSocketServer({ port: PORT });

console.log(`[rn-studio] Server running on ws://localhost:${PORT}`);
console.log('[rn-studio] Waiting for React Native runtime to connect...');

wss.on('connection', (ws) => {
  console.log('[rn-studio] Client connected');

  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      ws.send(
        JSON.stringify({
          type: 'ERROR',
          payload: { message: 'Invalid JSON payload' },
        })
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
        await rewriteStyle({
          file: source.file,
          line: source.line,
          column: source.column,
          key,
          value,
        });
        ws.send(JSON.stringify({ type: 'ACK', payload: { success: true } }));
        console.log(
          `[rn-studio] ✓ ${source.componentName} → ${key}: ${value}`
        );
        return;
      }

      if (msg.type === 'PROP_CHANGE') {
        // Reserved for future prop editing. Ack for now.
        ws.send(
          JSON.stringify({
            type: 'ACK',
            payload: { success: true, message: 'PROP_CHANGE not yet implemented' },
          })
        );
        return;
      }
    } catch (err) {
      console.error('[rn-studio] Error:', err);
      ws.send(
        JSON.stringify({
          type: 'ERROR',
          payload: { message: err && err.message ? err.message : String(err) },
        })
      );
    }
  });

  ws.on('close', () => console.log('[rn-studio] Client disconnected'));
});

process.on('SIGINT', () => {
  console.log('\n[rn-studio] Shutting down...');
  wss.close(() => process.exit(0));
});

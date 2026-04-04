import type { StudioMessage } from '../types';

/**
 * WebSocketBridge
 *
 * Runs inside the React Native app (Metro bundle). Maintains a
 * persistent connection to the rn-studio CLI server (default ws://localhost:7878).
 * Automatically reconnects with exponential backoff if the server is
 * not yet running — typical during a fresh `npm run studio`.
 */
export class WebSocketBridge {
  private ws: WebSocket | null = null;
  private port: number;
  private reconnectAttempts = 0;
  private maxAttempts = 10;
  private listeners = new Map<
    StudioMessage['type'],
    Array<(msg: StudioMessage) => void>
  >();
  private manuallyClosed = false;

  constructor(port = 7878) {
    this.port = port;
  }

  connect(): void {
    this.manuallyClosed = false;
    const url = `ws://localhost:${this.port}`;

    try {
      this.ws = new WebSocket(url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.send({ type: 'PING' });
    };

    this.ws.onmessage = (e: MessageEvent) => {
      try {
        const msg: StudioMessage = JSON.parse(
          typeof e.data === 'string' ? e.data : String(e.data)
        );
        const cbs = this.listeners.get(msg.type);
        if (cbs) cbs.forEach((cb) => cb(msg));
      } catch {
        // Malformed message — ignore.
      }
    };

    this.ws.onclose = () => {
      if (!this.manuallyClosed) this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // onclose will follow; reconnection handled there.
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxAttempts) return;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
    this.reconnectAttempts++;
    setTimeout(() => {
      if (!this.manuallyClosed) this.connect();
    }, delay);
  }

  send(msg: StudioMessage): void {
    if (this.ws && this.ws.readyState === 1 /* WebSocket.OPEN */) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  on(
    type: StudioMessage['type'],
    cb: (msg: StudioMessage) => void
  ): () => void {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type)!.push(cb);
    return () => {
      const arr = this.listeners.get(type);
      if (!arr) return;
      const idx = arr.indexOf(cb);
      if (idx >= 0) arr.splice(idx, 1);
    };
  }

  disconnect(): void {
    this.manuallyClosed = true;
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
  }
}

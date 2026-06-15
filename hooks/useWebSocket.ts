// hooks/useWebSocket.ts
// Manages the persistent WebSocket connection to the Matter controller.
// Reconnects automatically with exponential backoff.
// Distributes typed events via a callback registry keyed by nodeId.

import { useEffect, useRef, useCallback } from 'react';
import type { WsEvent } from '../types';

type EventHandler = (event: WsEvent) => void;

// Module-level singleton so the connection survives component re-renders
let ws:          WebSocket | null      = null;
let reconnectMs: number               = 1000;
let handlers:    Map<string, Set<EventHandler>> = new Map();
let globalHandlers: Set<EventHandler>           = new Set();

function getOrConnect(url: string): void {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  ws = new WebSocket(url);

  ws.onopen = () => {
    console.log('[WS] Connected');
    reconnectMs = 1000; // reset backoff on successful connection
  };

  ws.onmessage = (msg) => {
    try {
      const event: WsEvent = JSON.parse(msg.data as string);

      // Dispatch to global handlers
      globalHandlers.forEach(h => h(event));

      // Dispatch to nodeId-specific handlers
      if ('nodeId' in event) {
        const nodeHandlers = handlers.get(event.nodeId);
        nodeHandlers?.forEach(h => h(event));
      }
    } catch {
      // Ignore malformed messages
    }
  };

  ws.onclose = () => {
    console.log(`[WS] Disconnected — reconnecting in ${reconnectMs}ms`);
    ws = null;
    setTimeout(() => getOrConnect(url), reconnectMs);
    reconnectMs = Math.min(reconnectMs * 2, 30_000); // cap at 30s
  };

  ws.onerror = () => {
    ws?.close();
  };
}

// ─────────────────────────────────────────────────────────────────────────────

interface UseWebSocketOptions {
  /** WebSocket server URL — use getWsUrl() from api/config.ts */
  url: string;
  /** If provided, only events for this nodeId are dispatched to onEvent */
  nodeId?: string;
  /** Called on every matching incoming WS event */
  onEvent?: EventHandler;
}

/**
 * useWebSocket
 *
 * Call once near the root of the app (with no nodeId) to establish the
 * connection. Call in individual components (with nodeId) to subscribe
 * to device-specific events.
 */
export function useWebSocket({ url, nodeId, onEvent }: UseWebSocketOptions): void {
  const handlerRef = useRef<EventHandler | undefined>(onEvent);
  handlerRef.current = onEvent;

  // Stable wrapper that always calls the latest handler ref
  const stableHandler = useCallback<EventHandler>((event) => {
    handlerRef.current?.(event);
  }, []);

  useEffect(() => {
    // Ensure connection
    getOrConnect(url);

    if (!onEvent) return;

    if (nodeId) {
      // Register nodeId-scoped handler
      if (!handlers.has(nodeId)) handlers.set(nodeId, new Set());
      handlers.get(nodeId)!.add(stableHandler);
      return () => { handlers.get(nodeId)?.delete(stableHandler); };
    } else {
      // Register global handler
      globalHandlers.add(stableHandler);
      return () => { globalHandlers.delete(stableHandler); };
    }
  }, [url, nodeId, stableHandler, onEvent]);
}

/** Returns current WebSocket readyState (0=CONNECTING,1=OPEN,2=CLOSING,3=CLOSED) */
export function getWsReadyState(): number {
  return ws?.readyState ?? WebSocket.CLOSED;
}

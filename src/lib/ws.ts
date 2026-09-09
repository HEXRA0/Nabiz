import { useEffect } from 'react';

type WsCallback = (event: string, data: any) => void;
const listeners = new Set<WsCallback>();

let socket: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;

function connect() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const wsUrl = `${protocol}//${host}/ws`;

  try {
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('[WebSocket] Connected to Nabız Realtime Stream');
    };

    socket.onmessage = (msg) => {
      try {
        const payload = JSON.parse(msg.data);
        if (payload.event) {
          listeners.forEach((fn) => fn(payload.event, payload.data));
        }
      } catch (e) {}
    };

    socket.onclose = () => {
      socket = null;
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connect();
        }, 3000);
      }
    };

    socket.onerror = () => {
      socket?.close();
    };
  } catch (e) {
    // Retry
  }
}

export function useWebSocket(callback: WsCallback) {
  useEffect(() => {
    if (!socket || socket.readyState === WebSocket.CLOSED) {
      connect();
    }

    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  }, [callback]);
}

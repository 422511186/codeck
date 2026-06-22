export type BrowserSocketLike = {
  addEventListener(type: string, listener: (event: { data?: unknown }) => void): void;
  close(): void;
};

type ReconnectingBrowserSocketHandlers = {
  onMessage(event: unknown): void;
  onClose?(): void;
};

type ReconnectingBrowserSocketOptions = {
  reconnectDelayMs?: number;
  createSocket?: () => BrowserSocketLike;
};

export function createBrowserSocket(onMessage: (event: unknown) => void): WebSocket {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

  socket.addEventListener("message", (event) => {
    onMessage(JSON.parse(event.data as string));
  });

  return socket;
}

function defaultSocketFactory(): BrowserSocketLike {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return new WebSocket(`${protocol}//${window.location.host}/ws`);
}

export function createReconnectingBrowserSocket(
  handlers: ReconnectingBrowserSocketHandlers,
  options: ReconnectingBrowserSocketOptions = {}
): { close(): void } {
  const reconnectDelayMs = options.reconnectDelayMs ?? 1_000;
  const createSocket = options.createSocket || defaultSocketFactory;
  let socket: BrowserSocketLike | null = null;
  let closedByClient = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connect() {
    socket = createSocket();
    socket.addEventListener("message", (event) => {
      const data = "data" in event ? event.data : "{}";
      handlers.onMessage(JSON.parse(String(data)));
    });
    socket.addEventListener("close", () => {
      handlers.onClose?.();
      if (!closedByClient) {
        reconnectTimer = setTimeout(connect, reconnectDelayMs);
      }
    });
  }

  connect();

  return {
    close() {
      closedByClient = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      socket?.close();
    }
  };
}

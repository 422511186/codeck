export type AppServerHealth =
  | "disabled"
  | "idle"
  | "starting"
  | "connecting"
  | "ready"
  | "error";

export type WsHelloEvent = { type: "hello"; status: "connected" };
export type WsHealthEvent = { type: "health"; appServer: AppServerHealth; detail?: string };
export type WsCodexEvent = {
  type: "codex-event";
  event: { kind: string; threadId?: string; turnId?: string; eventId?: string; revision?: number; sequence?: number; [k: string]: unknown };
};
export type WsServerRequestEvent = {
  type: "server-request";
  request: {
    requestId: string;
    kind: string;
    threadId?: string;
    [k: string]: unknown;
  };
};
export type WsServerRequestResolvedEvent = {
  type: "server-request-resolved";
  requestId: string;
};
export type WsTimelineGapEvent = {
  type: "timeline-gap";
  threadId?: string | null;
  lastEventId?: string;
};

export type WsEvent =
  | WsHelloEvent
  | WsHealthEvent
  | WsCodexEvent
  | WsServerRequestEvent
  | WsServerRequestResolvedEvent
  | WsTimelineGapEvent;

export type WsConnectionState = "connecting" | "open" | "closed" | "reconnecting";

type Listener<T> = (event: T) => void;

export interface WsClientOptions {
  url: string;
  createSocket?: (url: string) => WebSocket;
  minBackoffMs?: number;
  maxBackoffMs?: number;
  autoConnect?: boolean;
}

export class WsClient {
  private socket: WebSocket | null = null;
  private state: WsConnectionState = "closed";
  private retries = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closedByCaller = false;
  private readonly eventListeners = new Set<Listener<WsEvent>>();
  private readonly stateListeners = new Set<Listener<WsConnectionState>>();
  private readonly minBackoff: number;
  private readonly maxBackoff: number;
  private readonly createSocket: (url: string) => WebSocket;

  constructor(private readonly options: WsClientOptions) {
    this.minBackoff = options.minBackoffMs ?? 1_000;
    this.maxBackoff = options.maxBackoffMs ?? 30_000;
    this.createSocket = options.createSocket ?? ((url) => new WebSocket(url));
    if (options.autoConnect !== false && typeof window !== "undefined") {
      this.connect();
    }
  }

  get connectionState(): WsConnectionState {
    return this.state;
  }

  connect(): void {
    if (this.socket || this.state === "connecting") return;
    this.closedByCaller = false;
    this.setState("connecting");
    const socket = this.createSocket(this.options.url);
    this.socket = socket;
    socket.addEventListener("open", this.handleOpen);
    socket.addEventListener("message", this.handleMessage);
    socket.addEventListener("close", this.handleClose);
    socket.addEventListener("error", this.handleError);
  }

  close(): void {
    this.closedByCaller = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.setState("closed");
  }

  onEvent(listener: Listener<WsEvent>): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  onState(listener: Listener<WsConnectionState>): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }

  private setState(next: WsConnectionState): void {
    if (this.state === next) return;
    this.state = next;
    for (const listener of this.stateListeners) {
      listener(next);
    }
  }

  private handleOpen = (): void => {
    this.retries = 0;
    this.setState("open");
  };

  private handleMessage = (event: MessageEvent): void => {
    let parsed: WsEvent;
    try {
      parsed = JSON.parse(typeof event.data === "string" ? event.data : "") as WsEvent;
    } catch {
      return;
    }
    for (const listener of this.eventListeners) {
      listener(parsed);
    }
  };

  private handleClose = (): void => {
    this.socket = null;
    if (this.closedByCaller) {
      this.setState("closed");
      return;
    }
    this.scheduleReconnect();
  };

  private handleError = (): void => {
    // close will fire too, no extra reaction needed.
  };

  private scheduleReconnect(): void {
    this.setState("reconnecting");
    const backoff = Math.min(this.minBackoff * 2 ** this.retries, this.maxBackoff);
    this.retries += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, backoff);
  }
}

let singleton: WsClient | null = null;

export function getWsClient(): WsClient {
  if (singleton) return singleton;
  if (typeof window === "undefined") {
    throw new Error("getWsClient must be called in browser environment");
  }
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const url = `${protocol}://${window.location.host}/ws`;
  singleton = new WsClient({ url });
  return singleton;
}

export function resetWsClient(): void {
  if (singleton) singleton.close();
  singleton = null;
}

export type BrowserWsConnectOptions = {
  onState: (state: WsConnectionState) => void;
  onMessage: (event: WsEvent) => void;
};

export function connectBrowserWs(options: BrowserWsConnectOptions): { close: () => void } {
  const client = getWsClient();
  const unsubState = client.onState(options.onState);
  const unsubEvent = client.onEvent(options.onMessage);
  if (client.connectionState === "closed") {
    client.connect();
  }
  return {
    close: () => {
      unsubState();
      unsubEvent();
    }
  };
}

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

type NotificationHandler = (message: { method: string; params?: unknown }) => void;

export class JsonRpcPeer {
  private nextId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly notificationHandlers = new Set<NotificationHandler>();

  constructor(private readonly sendRaw: (message: string) => void) {}

  request(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId++;
    const message = { jsonrpc: "2.0", id, method, params };

    const promise = new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });

    this.sendRaw(JSON.stringify(message));
    return promise;
  }

  onNotification(handler: NotificationHandler): () => void {
    this.notificationHandlers.add(handler);
    return () => this.notificationHandlers.delete(handler);
  }

  handleMessage(raw: string): void {
    const message = JSON.parse(raw) as {
      id?: number;
      method?: string;
      params?: unknown;
      result?: unknown;
      error?: { message?: string };
    };

    if (typeof message.id === "number") {
      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }

      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error.message || "app-server JSON-RPC error"));
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    if (message.method) {
      for (const handler of this.notificationHandlers) {
        handler({ method: message.method, params: message.params });
      }
    }
  }
}

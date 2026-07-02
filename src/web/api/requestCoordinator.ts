type PendingEntry<T> = {
  promise: Promise<T>;
};

export type RequestCoordinator = {
  dedupeRequest: <T>(key: string, run: () => Promise<T>) => Promise<T>;
  runLockedAction: <T>(
    key: string,
    run: () => Promise<T>
  ) => Promise<{ started: true; value: T } | { started: false; value: T }>;
  reset: () => void;
};

export function createRequestCoordinator(): RequestCoordinator {
  const pendingReads = new Map<string, PendingEntry<unknown>>();
  const pendingActions = new Map<string, PendingEntry<unknown>>();

  return {
    dedupeRequest<T>(key: string, run: () => Promise<T>): Promise<T> {
      const existing = pendingReads.get(key);
      if (existing) {
        return existing.promise as Promise<T>;
      }

      const entry = {} as PendingEntry<T>;
      entry.promise = Promise.resolve().then(run).finally(() => {
        if (pendingReads.get(key) === entry) {
          pendingReads.delete(key);
        }
      });
      pendingReads.set(key, entry as PendingEntry<unknown>);
      return entry.promise;
    },

    async runLockedAction<T>(
      key: string,
      run: () => Promise<T>
    ): Promise<{ started: true; value: T } | { started: false; value: T }> {
      const existing = pendingActions.get(key);
      if (existing) {
        const value = await (existing.promise as Promise<T>);
        return { started: false, value };
      }

      const entry = {} as PendingEntry<T>;
      entry.promise = Promise.resolve().then(run).finally(() => {
        if (pendingActions.get(key) === entry) {
          pendingActions.delete(key);
        }
      });
      pendingActions.set(key, entry as PendingEntry<unknown>);
      const value = await entry.promise;
      return { started: true, value };
    },

    reset(): void {
      pendingReads.clear();
      pendingActions.clear();
    }
  };
}

const defaultCoordinator = createRequestCoordinator();

export function dedupeRequest<T>(key: string, run: () => Promise<T>): Promise<T> {
  return defaultCoordinator.dedupeRequest(key, run);
}

export function runLockedAction<T>(
  key: string,
  run: () => Promise<T>
): Promise<{ started: true; value: T } | { started: false; value: T }> {
  return defaultCoordinator.runLockedAction(key, run);
}

export function resetRequestCoordinatorForTests(): void {
  defaultCoordinator.reset();
}

export function isRequestAbort(error: unknown): boolean {
  return (
    error instanceof DOMException && error.name === "AbortError"
  ) || (
    error instanceof Error && error.name === "AbortError"
  );
}

export function createAbortableLatestRunner() {
  let controller: AbortController | null = null;

  return {
    run<T>(request: (signal: AbortSignal) => Promise<T>): Promise<T> {
      if (controller) {
        controller.abort();
      }
      controller = new AbortController();
      const current = controller;
      return request(current.signal).finally(() => {
        if (controller === current) {
          controller = null;
        }
      });
    },
    abort(): void {
      controller?.abort();
      controller = null;
    }
  };
}

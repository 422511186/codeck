import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, stat, unlink } from "node:fs/promises";
import { dirname } from "node:path";

export type FileLockOptions = {
  timeoutMs?: number;
  retryDelayMs?: number;
  staleMs?: number;
};

export class FileLockTimeoutError extends Error {
  readonly code = "CUSTOM_MODEL_LOCK_TIMEOUT" as const;

  constructor(readonly lockPath: string) {
    super(`等待文件锁超时: ${lockPath}`);
    this.name = "FileLockTimeoutError";
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isNodeError(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

async function removeStaleLock(lockPath: string, staleMs: number): Promise<boolean> {
  try {
    const metadata = await stat(lockPath);
    if (Date.now() - metadata.mtimeMs <= staleMs) {
      return false;
    }
    await unlink(lockPath);
    return true;
  } catch (error) {
    if (isNodeError(error, "ENOENT")) {
      return true;
    }
    throw error;
  }
}

export async function withFileLock<T>(
  lockPath: string,
  callback: () => Promise<T>,
  options: FileLockOptions = {}
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 5_000;
  const retryDelayMs = options.retryDelayMs ?? 25;
  const staleMs = options.staleMs ?? 30_000;
  const startedAt = Date.now();
  const token = `${process.pid}:${randomUUID()}`;
  await mkdir(dirname(lockPath), { recursive: true, mode: 0o700 });

  let handle: Awaited<ReturnType<typeof open>> | null = null;
  while (!handle) {
    try {
      handle = await open(lockPath, "wx", 0o600);
      await handle.writeFile(token, "utf8");
      await handle.sync();
    } catch (error) {
      if (!isNodeError(error, "EEXIST")) {
        throw error;
      }
      if (await removeStaleLock(lockPath, staleMs)) {
        continue;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        throw new FileLockTimeoutError(lockPath);
      }
      await delay(retryDelayMs);
    }
  }

  try {
    return await callback();
  } finally {
    await handle.close().catch(() => undefined);
    try {
      if ((await readFile(lockPath, "utf8")) === token) {
        await unlink(lockPath);
      }
    } catch (error) {
      if (!isNodeError(error, "ENOENT")) {
        throw error;
      }
    }
  }
}

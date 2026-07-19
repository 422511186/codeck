import { randomUUID } from "node:crypto";
import { mkdir, open, rename, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

export async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  const directory = dirname(filePath);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporaryPath = join(
    directory,
    `.${basename(filePath)}.${process.pid}.${randomUUID()}.tmp`
  );
  let handle: Awaited<ReturnType<typeof open>> | null = null;

  try {
    handle = await open(temporaryPath, "wx", 0o600);
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporaryPath, filePath);
  } finally {
    await handle?.close().catch(() => undefined);
    await rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}

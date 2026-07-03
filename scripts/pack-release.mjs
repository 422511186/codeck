import { spawn } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertRequiredEntries, releaseEntries, releaseName, releasePruneEntries, sha256File } from "./release-utils.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(await readFile(path.join(rootDir, "package.json"), "utf8"));
const name = releaseName(packageJson.version);
const outputDir = path.join(rootDir, "dist", "releases");
const stagingRoot = path.join(rootDir, "dist", "release-staging");
const stagingDir = path.join(stagingRoot, name);
const tarPath = path.join(outputDir, `${name}.tar.gz`);
const checksumPath = `${tarPath}.sha256`;

await assertRequiredEntries(rootDir);
await rm(stagingRoot, { recursive: true, force: true });
await mkdir(stagingDir, { recursive: true });
await mkdir(outputDir, { recursive: true });

for (const entry of releaseEntries) {
  await cp(path.join(rootDir, entry), path.join(stagingDir, entry), {
    recursive: true,
    dereference: false,
    errorOnExist: false,
    force: true
  });
}

for (const entry of releasePruneEntries) {
  await rm(path.join(stagingDir, entry), { recursive: true, force: true });
}

await rm(tarPath, { force: true });
await run("tar", ["-czf", tarPath, "-C", stagingRoot, name], rootDir);

const checksum = await sha256File(tarPath);
await writeFile(checksumPath, `${checksum}  ${path.basename(tarPath)}\n`, "utf8");

console.log(`Release archive: ${path.relative(rootDir, tarPath)}`);
console.log(`Checksum: ${path.relative(rootDir, checksumPath)}`);

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} failed with ${signal ?? code}`));
    });
  });
}

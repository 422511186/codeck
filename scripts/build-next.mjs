import { spawn } from "node:child_process";
import path from "node:path";

const nextBin = path.join("node_modules", ".bin", process.platform === "win32" ? "next.cmd" : "next");

await new Promise((resolve, reject) => {
  const child = spawn(nextBin, ["build"], {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "production"
    }
  });

  child.on("error", reject);
  child.on("exit", (code, signal) => {
    if (code === 0) {
      resolve();
      return;
    }

    reject(new Error(`next build failed with ${signal ?? code}`));
  });
});

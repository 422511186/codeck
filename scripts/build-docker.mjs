import { spawn } from "node:child_process";
import { DEFAULT_DOCKER_IMAGE } from "./docker-utils.mjs";

const image = process.env.CODEX_WEB_DOCKER_IMAGE || DEFAULT_DOCKER_IMAGE;
const nodeImage = process.env.CODEX_WEB_DOCKER_NODE_IMAGE || "node:22-bookworm-slim";

const child = spawn("docker", ["build", "-t", image, "--build-arg", `NODE_IMAGE=${nodeImage}`, "-f", "Dockerfile", "."], {
  cwd: new URL("..", import.meta.url),
  stdio: "inherit"
});

child.once("error", (error) => {
  if (error && error.code === "ENOENT") {
    console.error("找不到 docker CLI，请先安装 Docker 并确认 docker 在 PATH 中");
    process.exitCode = 1;
    return;
  }

  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

child.once("exit", (code) => {
  process.exitCode = code ?? 1;
});

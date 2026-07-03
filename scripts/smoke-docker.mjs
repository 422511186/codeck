import { spawn } from "node:child_process";
import {
  DEFAULT_DOCKER_SMOKE_HOST,
  DEFAULT_DOCKER_SMOKE_IMAGE,
  DOCKER_CONTAINER_PORT,
  dockerSmokeContainerName,
  findAvailableDockerSmokeHostPort,
  parseDockerSmokeHostPort
} from "./docker-utils.mjs";

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

async function main() {
  const host = process.env.CODEX_WEB_DOCKER_SMOKE_BIND_HOST || DEFAULT_DOCKER_SMOKE_HOST;
  const configuredPort = parseDockerSmokeHostPort(
    process.env.CODEX_WEB_DOCKER_SMOKE_PORT || process.env.CODEX_WEB_BIND_PORT
  );
  const hostPort = configuredPort ?? (await findAvailableDockerSmokeHostPort(host));
  const image = process.env.CODEX_WEB_DOCKER_IMAGE || DEFAULT_DOCKER_SMOKE_IMAGE;
  const nodeImage = process.env.CODEX_WEB_DOCKER_NODE_IMAGE || "node:22-bookworm-slim";
  const containerName = process.env.CODEX_WEB_DOCKER_SMOKE_CONTAINER || dockerSmokeContainerName();
  const timeoutMs = Number(process.env.CODEX_WEB_DOCKER_SMOKE_TIMEOUT_MS || 60000);
  const shouldBuild = process.env.CODEX_WEB_DOCKER_SKIP_BUILD !== "1";

  if (shouldBuild) {
    await run("docker", ["build", "-t", image, "--build-arg", `NODE_IMAGE=${nodeImage}`, "-f", "Dockerfile", "."]);
  }

  await run("docker", [
    "run",
    "--rm",
    "-d",
    "--name",
    containerName,
    "-p",
    `${host}:${hostPort}:${DOCKER_CONTAINER_PORT}`,
    "-e",
    "NODE_ENV=production",
    "-e",
    "CODEX_WEB_APP_SERVER_MODE=mock",
    "-e",
    `CODEX_WEB_ACCESS_TOKEN=${process.env.CODEX_WEB_ACCESS_TOKEN || "docker-smoke-test-token"}`,
    "-e",
    "CODEX_WEB_BIND_HOST=0.0.0.0",
    "-e",
    `CODEX_WEB_BIND_PORT=${DOCKER_CONTAINER_PORT}`,
    "-e",
    "CODEX_WEB_UPLOAD_DIR=/var/lib/codex-web/uploads",
    "-e",
    "CODEX_WEB_AUDIT_LOG_PATH=/var/log/codex-web/audit.jsonl",
    image
  ]);

  try {
    await waitForHealth(`http://${host}:${hostPort}/api/health`, timeoutMs);
    console.log(`Docker smoke test passed on http://${host}:${hostPort}`);
  } catch (error) {
    const logs = await run("docker", ["logs", containerName], { allowFailure: true, quiet: true });
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${logs}`);
  } finally {
    await run("docker", ["rm", "-f", containerName], { allowFailure: true, quiet: true });
  }
}

async function waitForHealth(url, timeout) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // 容器启动期间连接失败是正常的，继续轮询。
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Docker smoke test 超时，未能访问 ${url}`);
}

function run(command, args, options = {}) {
  const { allowFailure = false, quiet = false } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: new URL("..", import.meta.url),
      stdio: quiet ? ["ignore", "pipe", "pipe"] : ["ignore", "inherit", "pipe"]
    });

    let stderr = "";
    let stdout = "";

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      if (!quiet) {
        process.stderr.write(text);
      }
    });

    child.once("error", (error) => {
      if (error && error.code === "ENOENT") {
        reject(new Error(`找不到 ${command} CLI，请先安装 Docker 并确认 docker 在 PATH 中`));
        return;
      }

      reject(error);
    });
    child.once("exit", (code) => {
      if (code === 0 || allowFailure) {
        resolve(`${stdout}${stderr}`.trim());
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}\n${stderr}`));
    });
  });
}

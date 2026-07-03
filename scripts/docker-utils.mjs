import { randomUUID } from "node:crypto";
import {
  CURRENT_SERVICE_PORT,
  DEFAULT_SMOKE_PORT,
  assertSafeSmokePort,
  findAvailableSmokePort,
  parseSmokePort
} from "./release-utils.mjs";

export { CURRENT_SERVICE_PORT };

export const DEFAULT_DOCKER_IMAGE = "codex-web:local";
export const DEFAULT_DOCKER_SMOKE_IMAGE = "codex-web:smoke";
export const DEFAULT_DOCKER_SMOKE_HOST = "127.0.0.1";
export const DEFAULT_DOCKER_SMOKE_HOST_PORT = DEFAULT_SMOKE_PORT;
export const DOCKER_CONTAINER_PORT = 3000;

export function assertSafeDockerSmokeHostPort(port) {
  assertSafeSmokePort(port);
}

export function parseDockerSmokeHostPort(value) {
  return parseSmokePort(value);
}

export function findAvailableDockerSmokeHostPort(
  host = DEFAULT_DOCKER_SMOKE_HOST,
  startPort = DEFAULT_DOCKER_SMOKE_HOST_PORT
) {
  return findAvailableSmokePort(host, startPort);
}

export function dockerSmokeContainerName() {
  return `codex-web-smoke-${randomUUID().slice(0, 8)}`;
}

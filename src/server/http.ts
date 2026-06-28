import { createServer } from "node:http";
import next from "next";
import { loadRuntimeEnvConfig } from "../config/env";
import { getAppServerGateway } from "./app-server/runtime";
import { isCookieHeaderAuthenticated } from "./auth";
import { getRuntimeConfig } from "./runtime";
import { attachBrowserWebSocket } from "./ws";

loadRuntimeEnvConfig();

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();
const config = getRuntimeConfig();

if (config.generatedAccessToken) {
  console.log(`Codex Web 临时登录 token: ${config.accessToken}`);
}

await app.prepare();
const handleUpgrade = app.getUpgradeHandler();

const server = createServer((req, res) => {
  handle(req, res);
});

attachBrowserWebSocket(server, handleUpgrade, {
  isAuthenticated: isCookieHeaderAuthenticated,
  getAppServerStatus: () => getAppServerGateway().getStatus(),
  subscribeToAppServerEvents: (handler) => getAppServerGateway().onBrowserEvent(handler)
});

server.listen(config.bindPort, config.bindHost, () => {
  console.log(`Codex Web 已启动: http://${config.bindHost}:${config.bindPort}`);
});

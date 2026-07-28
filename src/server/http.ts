import { createServer } from "node:http";
import next from "next";
import type { RequestHandler, UpgradeHandler } from "next/dist/server/next";
import { loadRuntimeEnvConfig } from "../config/env";
import { getAppServerGateway } from "./app-server/runtime";
import { isCookieHeaderAuthenticated } from "./auth";
import { getRuntimeConfig } from "./runtime";
import { attachBrowserWebSocket } from "./ws";

loadRuntimeEnvConfig();

type PreparedNextServer = ReturnType<typeof next> & {
  requestHandler: RequestHandler;
  upgradeHandler: UpgradeHandler;
};

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const config = getRuntimeConfig();

if (config.generatedAccessToken) {
  console.log(`codeck 临时登录 token: ${config.accessToken}`);
}

await app.prepare();
const preparedApp = app as PreparedNextServer;
const handle = preparedApp.requestHandler;
const handleUpgrade = preparedApp.upgradeHandler;

const server = createServer((req, res) => {
  handle(req, res);
});

attachBrowserWebSocket(server, handleUpgrade, {
  isAuthenticated: isCookieHeaderAuthenticated,
  getAppServerStatus: () => getAppServerGateway().getStatus(),
  subscribeToAppServerEvents: (handler) => getAppServerGateway().onBrowserEvent(handler)
});

server.listen(config.bindPort, config.bindHost, () => {
  console.log(`codeck 已启动: http://${config.bindHost}:${config.bindPort}`);
});

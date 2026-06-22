import { createServer } from "node:http";
import next from "next";
import { getRuntimeConfig } from "./runtime";
import { attachBrowserWebSocket } from "./ws";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();
const config = getRuntimeConfig();

if (config.generatedAccessToken) {
  console.log(`Codex Web 临时登录 token: ${config.accessToken}`);
}

await app.prepare();

const server = createServer((req, res) => {
  handle(req, res);
});

attachBrowserWebSocket(server);

server.listen(config.bindPort, config.bindHost, () => {
  console.log(`Codex Web 已启动: http://${config.bindHost}:${config.bindPort}`);
});

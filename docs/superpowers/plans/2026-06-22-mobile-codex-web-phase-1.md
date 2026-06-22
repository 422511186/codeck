# Codex 移动端 Web 第一阶段 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建一个移动端优先的 Codex Web 基础闭环：个人 token 登录、移动端工作台壳子、浏览器 WebSocket、后端配置/会话基础、app-server JSON-RPC typed adapter 骨架。

**Architecture:** 使用单仓库 TypeScript 项目。Next.js 负责移动端 UI 和少量 API route，Node.js 自定义 server 负责启动 Next、提供 WebSocket、管理个人登录 token、维护内存态连接，并通过 app-server adapter 与 Codex app-server 通信。第一阶段只完成可运行地基和 mock/健康检查流，不直接实现完整 Codex thread 操作。

**Tech Stack:** TypeScript、Next.js、React、Node.js、ws、Vitest、Playwright、Codex app-server generated TypeScript bindings。

---

## 范围说明

本计划只覆盖第一阶段可运行闭环，不一次实现完整 VS Code 插件级能力。第一阶段完成后应满足：

- 手机浏览器打开后进入移动端工作台，不出现桌面三栏布局。
- 未登录时显示 token 登录页。
- 登录 token 优先读取 `CODEX_WEB_ACCESS_TOKEN`；未配置时启动生成临时随机 token 并打印到控制台。
- 登录成功后写 signed session cookie。
- 前端可以连接后端 WebSocket，看到连接状态和服务健康状态。
- 后端具备 app-server JSON-RPC adapter 骨架，能做 request id 关联、response resolve、notification 分发。
- 所有人工文档保持中文。

不在第一阶段实现：

- 真实 `thread/start`、`turn/start`、审批/question 完整 UI。
- fork、rollback、图片发送、diff/terminal 面板。
- 多用户、数据库、团队权限。

## 文件结构

第一阶段创建或修改这些文件：

- `package.json`：项目脚本和依赖。
- `tsconfig.json`：TypeScript 配置。
- `next.config.mjs`：Next.js 配置。
- `vitest.config.ts`：单元测试配置。
- `playwright.config.ts`：移动端浏览器测试配置。
- `src/config/env.ts`：读取环境变量，生成/返回个人登录 token。
- `src/server/runtime.ts`：进程级 runtime config 单例，确保 server 和 API route 使用同一个登录 token。
- `src/server/session.ts`：签名 session cookie、校验登录态。
- `src/server/http.ts`：自定义 Node HTTP server，挂载 Next 和 WebSocket。
- `src/server/ws.ts`：浏览器 WebSocket hub，广播健康状态。
- `src/server/app-server/json-rpc.ts`：app-server JSON-RPC 基础客户端。
- `src/server/app-server/types.ts`：从生成协议导入 app-server 类型，并封装窄接口。
- `src/app/layout.tsx`：移动端 HTML 根布局。
- `src/app/page.tsx`：移动端工作台入口。
- `src/app/globals.css`：移动端样式基础。
- `src/app/api/auth/login/route.ts`：token 登录接口。
- `src/app/api/auth/session/route.ts`：查询登录态接口。
- `src/app/api/health/route.ts`：健康检查接口。
- `src/components/LoginScreen.tsx`：移动端登录页。
- `src/components/MobileWorkbench.tsx`：移动端工作台壳子。
- `src/components/ConnectionBadge.tsx`：连接状态徽标。
- `src/lib/client-api.ts`：浏览器端 API helper。
- `src/lib/ws-client.ts`：浏览器端 WebSocket helper。
- `tests/unit/env.test.ts`：配置/token 单元测试。
- `tests/unit/session.test.ts`：session cookie 单元测试。
- `tests/unit/json-rpc.test.ts`：JSON-RPC adapter 单元测试。
- `tests/e2e/mobile-shell.spec.ts`：移动端壳子浏览器测试。
- `README.md`：补充运行命令。

## Task 1: 初始化 TypeScript/Next 工程

**Files:**

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`

- [ ] **Step 1: 写入项目脚本和依赖**

在 `package.json` 写入：

```json
{
  "name": "codex-mobile-web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx src/server/http.ts",
    "build": "next build",
    "start": "cross-env NODE_ENV=production tsx src/server/http.ts",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "verify": "npm run typecheck && npm run test"
  },
  "dependencies": {
    "@next/env": "^16.0.0",
    "cookie": "^1.0.2",
    "nanoid": "^5.1.6",
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "ws": "^8.18.3",
    "zod": "^4.1.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.57.0",
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/ws": "^8.5.13",
    "cross-env": "^10.0.0",
    "tsx": "^4.20.0",
    "typescript": "^5.9.0",
    "vitest": "^4.0.0"
  }
}
```

- [ ] **Step 2: 写入 TypeScript 配置**

在 `tsconfig.json` 写入：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@generated/app-server/*": ["docs/generated/app-server-ts/*"]
    },
    "plugins": [{ "name": "next" }]
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: 写入 Next 配置**

在 `next.config.mjs` 写入：

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false
};

export default nextConfig;
```

- [ ] **Step 4: 写入 Vitest 配置**

在 `vitest.config.ts` 写入：

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    restoreMocks: true
  }
});
```

- [ ] **Step 5: 写入 Playwright 移动端配置**

在 `playwright.config.ts` 写入：

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    ...devices["Pixel 7"],
    trace: "on-first-retry"
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
```

- [ ] **Step 6: 安装依赖**

Run: `npm install`

Expected: 生成 `package-lock.json`，无安装错误。

- [ ] **Step 7: 运行初始校验**

Run: `npm run typecheck`

Expected: PASS。此时 TypeScript 会检查配置文件；应用源码会在后续任务加入。

- [ ] **Step 8: 提交**

Run:

```bash
git add package.json package-lock.json tsconfig.json next.config.mjs vitest.config.ts playwright.config.ts
git commit -m "chore: scaffold TypeScript Next project"
```

## Task 2: 配置和个人登录 token

**Files:**

- Create: `src/config/env.ts`
- Create: `src/server/runtime.ts`
- Create: `tests/unit/env.test.ts`

- [ ] **Step 1: 写 failing test**

在 `tests/unit/env.test.ts` 写入：

```ts
import { describe, expect, it } from "vitest";
import { createRuntimeConfig } from "../../src/config/env";

describe("createRuntimeConfig", () => {
  it("优先使用显式配置的登录 token", () => {
    const config = createRuntimeConfig({
      CODEX_WEB_ACCESS_TOKEN: "sk-user-configured",
      CODEX_WEB_WORKSPACE_ROOTS: "C:\\Users\\huang\\workspace",
      CODEX_WEB_BIND_HOST: "0.0.0.0",
      CODEX_WEB_BIND_PORT: "3100"
    });

    expect(config.accessToken).toBe("sk-user-configured");
    expect(config.generatedAccessToken).toBe(false);
    expect(config.workspaceRoots).toEqual(["C:\\Users\\huang\\workspace"]);
    expect(config.bindHost).toBe("0.0.0.0");
    expect(config.bindPort).toBe(3100);
  });

  it("未配置登录 token 时生成临时 token", () => {
    const config = createRuntimeConfig({
      CODEX_WEB_WORKSPACE_ROOTS: "C:\\Users\\huang\\workspace"
    });

    expect(config.accessToken.length).toBeGreaterThanOrEqual(32);
    expect(config.generatedAccessToken).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test -- tests/unit/env.test.ts`

Expected: FAIL，提示找不到 `src/config/env`。

- [ ] **Step 3: 实现配置模块**

在 `src/config/env.ts` 写入：

```ts
import { randomBytes } from "node:crypto";

export type RuntimeConfig = {
  accessToken: string;
  generatedAccessToken: boolean;
  workspaceRoots: string[];
  bindHost: string;
  bindPort: number;
};

export type RuntimeEnv = Partial<Record<string, string>>;

function generateAccessToken(): string {
  return `sk-${randomBytes(32).toString("base64url")}`;
}

function parseWorkspaceRoots(value: string | undefined): string[] {
  if (!value) {
    return [process.cwd()];
  }

  return value
    .split(";")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parsePort(value: string | undefined): number {
  if (!value) {
    return 3000;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`CODEX_WEB_BIND_PORT 无效: ${value}`);
  }

  return port;
}

export function createRuntimeConfig(env: RuntimeEnv = process.env): RuntimeConfig {
  const configuredToken = env.CODEX_WEB_ACCESS_TOKEN?.trim();
  const generatedAccessToken = !configuredToken;

  return {
    accessToken: configuredToken || generateAccessToken(),
    generatedAccessToken,
    workspaceRoots: parseWorkspaceRoots(env.CODEX_WEB_WORKSPACE_ROOTS),
    bindHost: env.CODEX_WEB_BIND_HOST || "127.0.0.1",
    bindPort: parsePort(env.CODEX_WEB_BIND_PORT)
  };
}
```

在 `src/server/runtime.ts` 写入：

```ts
import { createRuntimeConfig, type RuntimeConfig } from "../config/env";

const globalForRuntime = globalThis as typeof globalThis & {
  __codexWebRuntimeConfig?: RuntimeConfig;
};

export function getRuntimeConfig(): RuntimeConfig {
  if (!globalForRuntime.__codexWebRuntimeConfig) {
    globalForRuntime.__codexWebRuntimeConfig = createRuntimeConfig();
  }

  return globalForRuntime.__codexWebRuntimeConfig;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test -- tests/unit/env.test.ts`

Expected: PASS。

- [ ] **Step 5: 提交**

Run:

```bash
git add src/config/env.ts src/server/runtime.ts tests/unit/env.test.ts
git commit -m "feat: add personal runtime config"
```

## Task 3: signed session cookie

**Files:**

- Create: `src/server/session.ts`
- Create: `tests/unit/session.test.ts`

- [ ] **Step 1: 写 failing test**

在 `tests/unit/session.test.ts` 写入：

```ts
import { describe, expect, it } from "vitest";
import { createSessionCookie, readSessionCookie } from "../../src/server/session";

describe("session cookie", () => {
  it("能创建并读取合法 session", () => {
    const cookie = createSessionCookie("secret-token", "cookie-secret");
    const session = readSessionCookie(cookie, "cookie-secret");

    expect(session.authenticated).toBe(true);
  });

  it("签名不匹配时拒绝 session", () => {
    const cookie = createSessionCookie("secret-token", "cookie-secret");
    const session = readSessionCookie(cookie, "other-secret");

    expect(session.authenticated).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test -- tests/unit/session.test.ts`

Expected: FAIL，提示找不到 `src/server/session`。

- [ ] **Step 3: 实现 session 模块**

在 `src/server/session.ts` 写入：

```ts
import { createHmac, timingSafeEqual } from "node:crypto";
import { parse, serialize } from "cookie";

const COOKIE_NAME = "codex_web_session";

export type SessionReadResult = {
  authenticated: boolean;
};

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createSessionCookie(accessToken: string, cookieSecret: string): string {
  const payload = Buffer.from(JSON.stringify({ t: accessToken, v: 1 })).toString("base64url");
  const signature = sign(payload, cookieSecret);

  return serialize(COOKIE_NAME, `${payload}.${signature}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}

export function readSessionCookie(cookieHeader: string | null | undefined, cookieSecret: string): SessionReadResult {
  if (!cookieHeader) {
    return { authenticated: false };
  }

  const value = parse(cookieHeader)[COOKIE_NAME];
  if (!value) {
    return { authenticated: false };
  }

  const [payload, signature] = value.split(".");
  if (!payload || !signature) {
    return { authenticated: false };
  }

  const expected = sign(payload, cookieSecret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length) {
    return { authenticated: false };
  }

  if (!timingSafeEqual(actualBuffer, expectedBuffer)) {
    return { authenticated: false };
  }

  return { authenticated: true };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test -- tests/unit/session.test.ts`

Expected: PASS。

- [ ] **Step 5: 提交**

Run:

```bash
git add src/server/session.ts tests/unit/session.test.ts
git commit -m "feat: add signed session cookie"
```

## Task 4: app-server JSON-RPC adapter 骨架

**Files:**

- Create: `src/server/app-server/json-rpc.ts`
- Create: `src/server/app-server/types.ts`
- Create: `tests/unit/json-rpc.test.ts`

- [ ] **Step 1: 写 failing test**

在 `tests/unit/json-rpc.test.ts` 写入：

```ts
import { describe, expect, it } from "vitest";
import { JsonRpcPeer } from "../../src/server/app-server/json-rpc";

describe("JsonRpcPeer", () => {
  it("能关联 request 和 response", async () => {
    const sent: string[] = [];
    const peer = new JsonRpcPeer((message) => sent.push(message));

    const pending = peer.request("model/list", {});
    const request = JSON.parse(sent[0]!) as { id: number; method: string };

    peer.handleMessage(JSON.stringify({
      jsonrpc: "2.0",
      id: request.id,
      result: { models: [] }
    }));

    await expect(pending).resolves.toEqual({ models: [] });
  });

  it("能分发 notification", () => {
    const received: unknown[] = [];
    const peer = new JsonRpcPeer(() => undefined);

    peer.onNotification((message) => received.push(message));
    peer.handleMessage(JSON.stringify({
      jsonrpc: "2.0",
      method: "thread/status/changed",
      params: { threadId: "abc" }
    }));

    expect(received).toEqual([
      { method: "thread/status/changed", params: { threadId: "abc" } }
    ]);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test -- tests/unit/json-rpc.test.ts`

Expected: FAIL，提示找不到 `json-rpc` 模块。

- [ ] **Step 3: 实现 JSON-RPC peer**

在 `src/server/app-server/json-rpc.ts` 写入：

```ts
type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

type NotificationHandler = (message: { method: string; params?: unknown }) => void;

export class JsonRpcPeer {
  private nextId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly notificationHandlers = new Set<NotificationHandler>();

  constructor(private readonly sendRaw: (message: string) => void) {}

  request(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId++;
    const message = { jsonrpc: "2.0", id, method, params };

    const promise = new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });

    this.sendRaw(JSON.stringify(message));
    return promise;
  }

  onNotification(handler: NotificationHandler): () => void {
    this.notificationHandlers.add(handler);
    return () => this.notificationHandlers.delete(handler);
  }

  handleMessage(raw: string): void {
    const message = JSON.parse(raw) as {
      id?: number;
      method?: string;
      params?: unknown;
      result?: unknown;
      error?: { message?: string };
    };

    if (typeof message.id === "number") {
      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }

      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error.message || "app-server JSON-RPC error"));
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    if (message.method) {
      for (const handler of this.notificationHandlers) {
        handler({ method: message.method, params: message.params });
      }
    }
  }
}
```

在 `src/server/app-server/types.ts` 写入：

```ts
export type { ClientRequest } from "../../../docs/generated/app-server-ts/ClientRequest";
export type { ServerNotification } from "../../../docs/generated/app-server-ts/ServerNotification";
export type { ServerRequest } from "../../../docs/generated/app-server-ts/ServerRequest";
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test -- tests/unit/json-rpc.test.ts`

Expected: PASS。

- [ ] **Step 5: 提交**

Run:

```bash
git add src/server/app-server/json-rpc.ts src/server/app-server/types.ts tests/unit/json-rpc.test.ts
git commit -m "feat: add app-server JSON-RPC adapter"
```

## Task 5: 自定义 HTTP server 和浏览器 WebSocket

**Files:**

- Create: `src/server/http.ts`
- Create: `src/server/ws.ts`
- Modify: `README.md`

- [ ] **Step 1: 写 WebSocket hub**

在 `src/server/ws.ts` 写入：

```ts
import type { Server as HttpServer } from "node:http";
import { WebSocketServer } from "ws";

export type BrowserEvent =
  | { type: "hello"; status: "connected" }
  | { type: "health"; appServer: "not_connected" };

export function attachBrowserWebSocket(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (socket) => {
    const events: BrowserEvent[] = [
      { type: "hello", status: "connected" },
      { type: "health", appServer: "not_connected" }
    ];

    for (const event of events) {
      socket.send(JSON.stringify(event));
    }
  });

  return wss;
}
```

- [ ] **Step 2: 写自定义 server**

在 `src/server/http.ts` 写入：

```ts
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
```

- [ ] **Step 3: 更新 README 运行说明**

在 `README.md` 的“当前状态”后追加：

```md
## 本地运行

安装依赖：

```bash
npm install
```

启动开发服务：

```bash
npm run dev
```

如果没有配置 `CODEX_WEB_ACCESS_TOKEN`，启动日志会打印临时登录 token。手机访问 `http://<后端机器局域网 IP>:3000` 后输入该 token 登录。
```

- [ ] **Step 4: 运行类型检查**

Run: `npm run typecheck`

Expected: PASS。此时 server 源码应能独立通过类型检查。

- [ ] **Step 5: 提交**

Run:

```bash
git add src/server/http.ts src/server/ws.ts README.md
git commit -m "feat: add mobile web server shell"
```

## Task 6: 登录 API 和移动端 UI 壳子

**Files:**

- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`
- Create: `src/app/api/auth/login/route.ts`
- Create: `src/app/api/auth/session/route.ts`
- Create: `src/app/api/health/route.ts`
- Create: `src/components/LoginScreen.tsx`
- Create: `src/components/MobileWorkbench.tsx`
- Create: `src/components/ConnectionBadge.tsx`
- Create: `src/lib/client-api.ts`
- Create: `src/lib/ws-client.ts`

- [ ] **Step 1: 写 API helper**

在 `src/lib/client-api.ts` 写入：

```ts
export async function loginWithToken(token: string): Promise<boolean> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token })
  });

  return response.ok;
}

export async function readSession(): Promise<{ authenticated: boolean }> {
  const response = await fetch("/api/auth/session", { cache: "no-store" });
  if (!response.ok) {
    return { authenticated: false };
  }
  return response.json() as Promise<{ authenticated: boolean }>;
}
```

在 `src/lib/ws-client.ts` 写入：

```ts
export function createBrowserSocket(onMessage: (event: unknown) => void): WebSocket {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

  socket.addEventListener("message", (event) => {
    onMessage(JSON.parse(event.data as string));
  });

  return socket;
}
```

- [ ] **Step 2: 写 API routes**

在 `src/app/api/auth/login/route.ts` 写入：

```ts
import { NextResponse } from "next/server";
import { createSessionCookie } from "../../../../server/session";
import { getRuntimeConfig } from "../../../../server/runtime";

const config = getRuntimeConfig();
const cookieSecret = config.accessToken;

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as { token?: string };

  if (body.token !== config.accessToken) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.headers.append("set-cookie", createSessionCookie(config.accessToken, cookieSecret));
  return response;
}
```

在 `src/app/api/auth/session/route.ts` 写入：

```ts
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { readSessionCookie } from "../../../../server/session";
import { getRuntimeConfig } from "../../../../server/runtime";

const config = getRuntimeConfig();

export async function GET(): Promise<Response> {
  const cookie = (await headers()).get("cookie");
  const session = readSessionCookie(cookie, config.accessToken);
  return NextResponse.json(session);
}
```

在 `src/app/api/health/route.ts` 写入：

```ts
import { NextResponse } from "next/server";

export async function GET(): Promise<Response> {
  return NextResponse.json({
    ok: true,
    appServer: "not_connected"
  });
}
```

- [ ] **Step 3: 写移动端组件**

在 `src/components/LoginScreen.tsx` 写入：

```tsx
"use client";

import { FormEvent, useState } from "react";
import { loginWithToken } from "../lib/client-api";

export function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const ok = await loginWithToken(token);
    if (ok) {
      onLoggedIn();
    } else {
      setError("登录 token 不正确");
    }
  }

  return (
    <main className="login-screen">
      <section className="login-panel">
        <p className="eyebrow">Codex Mobile Web</p>
        <h1>连接你的 Codex</h1>
        <form onSubmit={handleSubmit} className="login-form">
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="输入登录 token"
            autoComplete="off"
            inputMode="text"
          />
          <button type="submit">登录</button>
        </form>
        {error ? <p className="form-error">{error}</p> : null}
      </section>
    </main>
  );
}
```

在 `src/components/ConnectionBadge.tsx` 写入：

```tsx
export function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <span className={connected ? "badge badge-online" : "badge"}>
      {connected ? "已连接" : "未连接"}
    </span>
  );
}
```

在 `src/components/MobileWorkbench.tsx` 写入：

```tsx
"use client";

import { useEffect, useState } from "react";
import { createBrowserSocket } from "../lib/ws-client";
import { ConnectionBadge } from "./ConnectionBadge";

export function MobileWorkbench() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = createBrowserSocket((event) => {
      if (typeof event === "object" && event && "type" in event) {
        if ((event as { type: string }).type === "hello") {
          setConnected(true);
        }
      }
    });

    socket.addEventListener("close", () => setConnected(false));
    return () => socket.close();
  }, []);

  return (
    <main className="workbench">
      <header className="top-bar">
        <div>
          <p className="eyebrow">当前会话</p>
          <h1>新会话</h1>
        </div>
        <ConnectionBadge connected={connected} />
      </header>

      <section className="timeline">
        <article className="empty-state">
          <h2>Codex 已准备好</h2>
          <p>第一阶段先验证移动端壳子、登录和后端连接。下一阶段接入真实会话。</p>
        </article>
      </section>

      <form className="composer">
        <input placeholder="给 Codex 发送消息" disabled />
        <button type="button" disabled>发送</button>
      </form>

      <nav className="bottom-nav" aria-label="移动端导航">
        <button type="button">Chats</button>
        <button type="button">Run</button>
        <button type="button">Files</button>
        <button type="button">Terminal</button>
        <button type="button">Settings</button>
      </nav>
    </main>
  );
}
```

- [ ] **Step 4: 写 App Router 页面和样式**

在 `src/app/layout.tsx` 写入：

```tsx
import "./globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Codex Mobile Web",
  description: "移动端 Codex Web 客户端"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
```

在 `src/app/page.tsx` 写入：

```tsx
"use client";

import { useEffect, useState } from "react";
import { LoginScreen } from "../components/LoginScreen";
import { MobileWorkbench } from "../components/MobileWorkbench";
import { readSession } from "../lib/client-api";

export default function HomePage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    readSession().then((session) => setAuthenticated(session.authenticated));
  }, []);

  if (authenticated === null) {
    return <main className="loading-screen">正在检查登录状态</main>;
  }

  if (!authenticated) {
    return <LoginScreen onLoggedIn={() => setAuthenticated(true)} />;
  }

  return <MobileWorkbench />;
}
```

在 `src/app/globals.css` 写入：

```css
:root {
  color-scheme: dark;
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #101113;
  color: #f2f2f2;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  min-height: 100%;
  background: #101113;
}

button,
input {
  font: inherit;
}

.loading-screen,
.login-screen,
.workbench {
  min-height: 100svh;
}

.login-screen {
  display: grid;
  place-items: center;
  padding: 24px;
}

.login-panel {
  width: min(100%, 420px);
}

.eyebrow {
  margin: 0 0 6px;
  color: #8fb7ff;
  font-size: 12px;
}

.login-panel h1,
.top-bar h1 {
  margin: 0;
  font-size: 24px;
  letter-spacing: 0;
}

.login-form {
  display: grid;
  gap: 12px;
  margin-top: 24px;
}

.login-form input,
.composer input {
  min-width: 0;
  border: 1px solid #343942;
  border-radius: 8px;
  background: #181b20;
  color: #f2f2f2;
  padding: 12px;
}

.login-form button,
.composer button,
.bottom-nav button {
  border: 0;
  border-radius: 8px;
  background: #2f7df6;
  color: white;
  padding: 12px;
}

.form-error {
  color: #ff8b8b;
}

.workbench {
  display: grid;
  grid-template-rows: auto 1fr auto auto;
  max-width: 640px;
  margin: 0 auto;
  background: #101113;
}

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(12px + env(safe-area-inset-top)) 16px 12px;
  border-bottom: 1px solid #242830;
}

.badge {
  border: 1px solid #3c4350;
  border-radius: 999px;
  color: #adb5c2;
  padding: 6px 10px;
  font-size: 12px;
}

.badge-online {
  border-color: #34c759;
  color: #8dffa8;
}

.timeline {
  overflow: auto;
  padding: 16px;
}

.empty-state {
  border: 1px solid #272c35;
  border-radius: 8px;
  background: #171a1f;
  padding: 16px;
}

.empty-state h2 {
  margin: 0 0 8px;
  font-size: 18px;
}

.empty-state p {
  margin: 0;
  color: #b7bfcc;
  line-height: 1.6;
}

.composer {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #242830;
}

.bottom-nav {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
  padding: 8px 8px calc(8px + env(safe-area-inset-bottom));
  border-top: 1px solid #242830;
}

.bottom-nav button {
  background: transparent;
  color: #b7bfcc;
  padding: 10px 4px;
  font-size: 12px;
}
```

- [ ] **Step 5: 运行校验**

Run: `npm run verify`

Expected: PASS。

- [ ] **Step 6: 提交**

Run:

```bash
git add src/app src/components src/lib
git commit -m "feat: add mobile login and workbench shell"
```

## Task 7: 移动端浏览器冒烟测试

**Files:**

- Create: `tests/e2e/mobile-shell.spec.ts`

- [ ] **Step 1: 写 Playwright 测试**

在 `tests/e2e/mobile-shell.spec.ts` 写入：

```ts
import { expect, test } from "@playwright/test";

test("手机端登录后进入工作台", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("连接你的 Codex")).toBeVisible();

  await page.getByPlaceholder("输入登录 token").fill("sk-e2e-token");
  await page.getByRole("button", { name: "登录" }).click();

  await expect(page.getByText("新会话")).toBeVisible();
  await expect(page.getByText("Chats")).toBeVisible();
  await expect(page.getByText("Terminal")).toBeVisible();
});
```

- [ ] **Step 2: 为 E2E 提供固定 token**

修改 `playwright.config.ts` 的 `webServer.command`：

```ts
command: "set CODEX_WEB_ACCESS_TOKEN=sk-e2e-token&& npm run dev",
```

Windows PowerShell 下如果该写法失败，改成：

```ts
command: "powershell -NoProfile -Command \"$env:CODEX_WEB_ACCESS_TOKEN='sk-e2e-token'; npm run dev\"",
```

- [ ] **Step 3: 运行 E2E**

Run: `npm run test:e2e`

Expected: PASS。

- [ ] **Step 4: 提交**

Run:

```bash
git add tests/e2e/mobile-shell.spec.ts playwright.config.ts
git commit -m "test: add mobile workbench smoke test"
```

## Task 8: 第一阶段验收

**Files:**

- Modify: `README.md`

- [ ] **Step 1: 补充 README 第一阶段验收说明**

在 `README.md` 追加：

```md
## 第一阶段验收

运行：

```bash
npm run verify
npm run test:e2e
```

期望：

- 单元测试通过。
- 手机视口 E2E 测试通过。
- `npm run dev` 启动后，手机可以访问 Web 页面。
- 未配置 `CODEX_WEB_ACCESS_TOKEN` 时，控制台会打印临时 token。
- 登录后能看到移动端工作台、底部导航和连接状态。
```

- [ ] **Step 2: 运行完整校验**

Run:

```bash
npm run verify
npm run test:e2e
git status --short
```

Expected:

- `npm run verify` PASS。
- `npm run test:e2e` PASS。
- `git status --short` 只显示 README 修改。

- [ ] **Step 3: 提交**

Run:

```bash
git add README.md
git commit -m "docs: add phase one verification"
```

## 自检清单

- spec 覆盖：第一阶段覆盖移动端壳子、个人 token 登录、无数据库、WebSocket、app-server adapter 骨架、中文文档约定。
- 暂不覆盖：真实会话、审批/question、fork、rollback、图片发送、diff/terminal 面板；这些在第二阶段计划中实现。
- 类型一致性：`createRuntimeConfig`、`createSessionCookie`、`readSessionCookie`、`JsonRpcPeer`、`createBrowserSocket` 在测试和实现步骤中名称一致。
- 执行方式：由于当前会话没有 subagent 工具，实施时使用 inline execution，并在每个任务后运行测试和提交。

# 前端目录与约定

本项目前端只做移动端 web，单一形态。代码放在 `src/web/` 和 `src/app/(mobile)/` 下。

## 目录

| 目录 | 用途 |
| --- | --- |
| `src/app/(mobile)/` | Next.js App Router 页面：登录、项目、会话列表、聊天、设置 |
| `src/web/api/` | 浏览器侧 fetch 封装，统一处理 cookie、401 跳转、`{ ok, error }` 协议 |
| `src/web/ws/` | `/ws` 客户端：单例连接、订阅 dispatch、断线重连 |
| `src/web/storage/` | localStorage 封装（项目列表、草稿等） |
| `src/web/state/` | 前端运行时状态（Zustand store 或自写 hook） |
| `src/web/components/` | 复用组件：卡片、审批卡、输入区、按钮等 |
| `src/web/hooks/` | 自定义 hook |
| `src/web/theme/` | 主题 token、CSS variables |
| `src/web/lib/` | 纯工具函数 |

## 调用规则

- `src/web/**` 是浏览器代码，**不要**导入 `src/server/**`。
- `src/web/**` 只通过 `src/shared/codex.ts` 引用 app-server 协议类型，**不要**直接 `import` `docs/generated/app-server-ts`。
- 后端 API 只暴露 `/api/codex/*` 和 `/ws`；前端的所有外部副作用都通过 `src/web/api` 或 `src/web/ws` 走。
- localStorage 所有 key 必须带 `codex-web:` 前缀，避免和其它站点冲突。

## 路由

```
/login                              登录页
/                                   项目列表（首屏）
/p/<projectId>                      项目内会话列表（tab: active | archived）
/p/<projectId>/t/<threadId>         会话聊天页
/settings                           设置
```

`projectId` 是前端 localStorage 分配的本地 id，不依赖后端。

## 不做的事

- 不做桌面端布局、不做响应式宽屏。
- 不做 Web Push、Service Worker、PWA 离线缓存。
- 不做语音 / Realtime、Share 公开链接、文件树、独立 PTY、跨会话审批 inbox。
- 不做会话/项目搜索、不做下拉刷新。

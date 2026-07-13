# 验证记录

## 自动化验证

- 定向测试：11 个测试文件、381 个测试全部通过。
- 完整测试：59 个测试文件通过、1 个既有测试文件跳过；801 个测试通过、1 个既有测试跳过。
- `npm run typecheck`：通过。
- `npm run build`：Next.js 与 server bundle 构建通过。
- `openspec validate fix-timeline-history-virtualization-and-completeness --strict`：通过。
- `git diff --check`：通过。

## 移动端浏览器验证

- 验证 URL：`http://127.0.0.1:19901/timeline-validation`，仅在验证期间启动，完成后已停止并删除临时路由。
- Web 运行模式：当前源码、mock app-server、独立端口 `19901`；未修改用户的 `compose.production.yaml`，既有 `codex-web-19899` 容器保持不变。
- 浏览器运行环境：`public.ecr.aws/docker/library/node:22-bookworm-slim` 临时容器，挂载本机 Playwright Chromium `1187`，通过 `npx playwright install-deps chromium` 安装临时系统依赖。
- 目标视口：iPhone 等效 `390x844`、Mobile Safari UA；Android 等效 `412x915`、Chrome UA。
- 每个视口采样尾部、75%、中部、25% 和顶部；每次均断言 viewport 内存在真实 timeline row、中心像素采样命中 row、row 无重叠、同一可见 anchor 在 120ms 后偏移不超过 2px。
- 两个视口的有效滚动范围均超过 28,800px，并成功到达最早 block `validation-agent-0`。
- 截图保存在 `artifacts/timeline-validation/`，包含 iPhone/Android 的 tail、middle、top 共 6 张。

临时验证页使用固定时间 fixture，避免开发模式 hydration diagnostics；生产构建不包含该临时路由。

## 完整性与诊断对照

- `TimelineEngineDiagnostics` 覆盖 item truncation、page continuation、event truncation、repair-required 和 full-content completion，相关状态转换测试通过。
- 超过 5 页的 detail continuation、cursor loop、零进展和中断恢复测试通过，不再以固定页数静默结束。
- page/thread/event 均按最终 UTF-8 序列化 bytes 收敛；超大 `arguments` 会作为可选 metadata 在响应超限时移除，避免突破硬预算。
- oversize SSE/WebSocket 事件在生产 runtime 中使用 source-backed opaque contentRef；无安全 resolver 时降级为 scoped `repair-required`，不再生成不可解析的 fallback ref，也不丢失事件 identity/order。

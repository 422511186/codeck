## Why

会话聊天页在长会话和高频流式输出下容易卡死，刷新时也可能长时间停留在加载态；根因是全量读取 turns、全量 normalize、全量渲染 timeline，以及每条 delta 都同步触发 store 和 React 更新。项目只面向手机浏览器，这类主线程压力会直接表现为页面无法滚动、输入延迟和刷新首屏不可用。

## What Changes

- 会话详情首屏读取改为有界最近 turns，不再默认拉取全量 turns；历史内容继续通过现有 cursor 分页向上加载。
- timeline store 和渲染路径改为适合长会话的增量结构，避免 snapshot repair、分页合并和 live delta 追加时反复做全量近似二次扫描。
- timeline event stream 客户端对同一 item 的高频可见 delta 做短窗口批处理，同时保留 `eventId`、`revision`、`sequence`、`generation` 的幂等与 repair 语义。
- 会话页面拆分订阅粒度，避免每条 agent delta 让 header、输入框、菜单和整页状态全部重渲染。
- timeline 渲染改为移动端友好的窗口化或等价裁剪策略，历史 Markdown、Mermaid、代码高亮、diff 和工具长输出采用视口内/用户展开时懒渲染。
- 对超长 agent 输出、命令输出、工具结果和 diff 提供默认展示上限或折叠摘要，保留用户查看完整内容的路径，避免大文本直接进入首屏 DOM。
- app-server 连接生命周期增加可复用单例模式和进程治理：明确 `external` 作为跨 Web 后端复用方式，新增 `spawn-or-connect` 或等价自动复用策略，避免多个 Web 后端重复拉起本机 app-server。
- 增加性能观测与回归测试，覆盖长会话首屏、流式 delta 合并、snapshot repair、分页顺序和移动端渲染预算。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `thread-chat-view`: 会话页首屏加载、历史分页、timeline 渲染窗口、页面订阅粒度和移动端性能预算需要新增要求。
- `timeline-event-stream`: 高频 delta 的客户端批处理、服务端 overlay 聚合和 replay/repair 幂等语义需要新增要求。
- `agent-output-rendering`: Markdown、代码高亮、Mermaid、diff 和工具长输出需要新增懒渲染、截断和展开查看要求。
- `app-server-lifecycle`: app-server 单例复用、spawn 进程清理、固定端口探测、跨进程锁和诊断状态需要新增要求。

## Impact

- 前端：`src/app/threads/[threadId]/page.tsx`、`src/web/components/Timeline.tsx`、`src/web/components/Markdown.tsx`、`src/web/components/cards/*`、`src/web/state/store.ts`、`src/web/events/client.ts`。
- 后端适配层：`src/server/app-server/client.ts`、`src/server/app-server/runtime.ts`、`src/app/api/codex/threads/[threadId]/route.ts`、`src/app/api/codex/threads/[threadId]/turns/route.ts`、`src/app/api/codex/events/route.ts`。
- app-server 进程管理：`src/server/app-server/transport.ts`、`src/config/env.ts`、启动脚本、`.env.example`、`README.md`、`docs/release.md` 和 Docker/external 部署说明。
- API 行为：会话详情读取需要支持有界首屏 timeline 和分页 cursor；snapshot repair 应避免退回全量读取长历史。
- 运行模式：`spawn` 继续保留便捷启动；跨 Web 后端复用应使用 `external` 或新增自动复用模式，不能依赖随机端口 spawn。
- 测试：需要新增长会话 store 性能测试、timeline 渲染预算测试、event stream 批处理幂等测试、分页顺序测试和刷新首屏行为测试。
- 运维验证：需要覆盖重复启动、父进程异常退出、固定端口已有 app-server、陈旧 pid/lock 清理和状态诊断不泄露内部 URL。
- 依赖：可能引入动态高度虚拟列表库；若不引入依赖，则需要实现等价的移动端窗口裁剪组件。

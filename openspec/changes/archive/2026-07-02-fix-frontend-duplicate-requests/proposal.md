## Why

移动端前端目前存在重复请求和重复动作提交风险，已知影响发送消息和打开会话，并可能扩散到新建会话、历史分页、设置变更、归档/压缩等入口。重复请求会导致重复 turn、重复会话、旧请求覆盖新状态、无效的运行态切换，以及移动端连点和快速路由切换下的不稳定体验。

现在需要把防重复逻辑从零散组件状态提升为明确的前端请求纪律：查询请求可复用或可取消，副作用请求必须有动作级互斥，关键创建/发送接口需要幂等兜底。

## What Changes

- 新增前端请求去重能力，覆盖 GET 查询、滚动分页、会话详情读取、恢复请求、发送消息、新建会话和常见会话操作。
- 为发送消息保留现有 `clientUserMessageId` 幂等逻辑，并补齐前端侧同一次用户动作的稳定 operation id 与 in-flight 保护。
- 为打开会话、快照修复、历史分页等读取类请求定义“同 key 复用或取消旧请求”的行为，避免旧响应覆盖新状态。
- 为新建会话、归档/撤销归档、压缩、重命名、中断、模型/模式设置等 mutation 定义 pending 锁和重复点击处理。
- 补充测试覆盖，重点验证移动端连点、快速切换、滚动触顶、开发模式重复 effect 和请求失败后的重试路径。

## Capabilities

### New Capabilities
- `frontend-request-deduplication`: 约束前端请求去重、动作互斥、请求取消和幂等兜底的用户可见行为。

### Modified Capabilities

## Impact

- 影响前端请求封装：`src/web/api/client.ts`、`src/web/api/endpoints.ts`。
- 影响会话页：`src/app/threads/[threadId]/page.tsx`。
- 影响项目会话列表页：`src/app/projects/[projectId]/page.tsx`。
- 可能影响项目页、审批卡片、输入组件等已有局部 pending 逻辑：`src/app/projects/page.tsx`、`src/web/components/ChatInput.tsx`、`src/web/components/cards/ApprovalCard.tsx`。
- 影响 API 幂等兜底：优先复用现有 `turn/start` 幂等缓存，评估是否为 `threads/start` 增加 client operation id。
- 影响测试：新增或调整 `tests/unit/web-thread-page.test.tsx`、`tests/unit/web-project-threads-page.test.tsx`、`tests/unit/web-chat-input.test.tsx`、`tests/unit/web-api-client.test.ts`、`tests/unit/codex-turn-start-route.test.ts`，必要时新增 `threads/start` 路由测试。

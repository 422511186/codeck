## Context

当前 gateway 假设很多 app-server RPC 都运行在“thread 已 live”的前提下：

- 权限切换走 `thread/settings/update`
- 截断正文 rehydrate 走 `thread/items/list`
- 但新进入会话、历史会话冷读、或进程刚起来时，thread 可能只在历史层可见，尚未 `thread/resume`

用户体感是：

1. 新会话切权限：`thread not found`
2. 先切模型（内部常先 resume）后再切权限就成功
3. 同一会话点“读取完整内容”：content API 502

content 路径本身对 invalid/expired contentRef 已有 soft-fail（`repair-required`），但 resolve 阶段的 RPC 异常会直接上抛成 502。settings 路径则没有任何 missing-live-thread 恢复。

约束：

- 不改变 contentRef 的 ephemeral locator 模型与 15 分钟 TTL
- bare resume 不能偷偷带上权限覆盖，避免覆盖用户尚未提交的配置
- 优先 gateway 收敛，避免前端为每个入口分别补 resume

## Goals / Non-Goals

**Goals:**

- 为依赖 live thread 的 gateway 操作提供统一 “detect missing → bare resume → retry once”
- 修复 settings 在冷会话上的失败
- 修复 content rehydrate 在冷会话上的 502，并在仍不可恢复时返回 scoped repair
- 用单元测试锁定两条路径与“只 resume 一次”的边界

**Non-Goals:**

- 不做 content 全文持久化 / 跨进程 contentRef 存储
- 不改 progressive markdown、复制按钮、Enter 发送等已归档 UX
- 不把所有 app-server RPC 都自动 resume；只覆盖本次确认的 settings 与 content rehydrate
- 不在 bare resume 时注入权限/model override

## Decisions

### 1. 在 `AppServerGateway` 增加共享 ensure-live helper

新增内部 helper，语义类似：

```ts
async withLiveThreadRetry<T>(threadId: string, operation: () => Promise<T>): Promise<T>
```

行为：

1. 执行 `operation()`
2. 若错误匹配 missing live thread 模式，则 bare `resumeThread(threadId)` 一次
3. resume 成功后 `operation()` 再执行一次
4. 若 resume 失败或 retry 仍失败，抛出最终错误（content 路径可再映射 soft-fail）

匹配模式至少覆盖：

- `thread not found`
- `not loaded`
- 与现有 unmaterialized/not-loaded 检测兼容，但不把 permission denied 等真实错误吞掉

选择 gateway 而不是 lifecycle-service / 前端的原因：

- content 与 settings 都能复用
- 用户 workaround（先切模型）已经证明 resume 是正确恢复动作
- 避免每个 API route 各自实现

### 2. settings 走 retry，不改请求语义

`updateThreadSettings`：

- 第一次直接 `client.updateThreadSettings(input)`
- missing live thread 时 bare resume，再 update 一次
- 成功后的 identity/permission 广播逻辑保持不变

bare resume 不带 `permissions/approvalPolicy/approvalsReviewer`，确保“恢复 live”与“提交用户设置”分离。

### 3. content rehydrate：先 resume，再 soft-fail

`resolveTimelineContentSource` / `readTimelineContent` 中 app-server 源：

- `listThreadTurnItems` 遇到 missing live thread：bare resume + 再 list 一次
- 若 resume/retry 后仍是 missing/not-found/source-gap：返回 `repair-required`，不抛到 route 层 502
- 其他未知错误仍可上抛，避免把真实故障伪装成 content 问题

session 源（rollout 文件）不需要 live thread resume，保持现有 path/revision 逻辑。

### 4. 错误分类要窄

只对“thread 尚未 live / 未找到 / 未加载”恢复。

明确不恢复：

- permission denied
- invalid params
- source-revision mismatch
- 真正不存在的 thread（resume 也失败）

这样不会把权限问题或坏参数变成静默 retry 风暴。

### 5. 测试优先覆盖用户路径

最小测试集：

1. settings：第一次 `thread/settings/update` 报 thread not found → resume → 第二次 update 成功
2. content：第一次 `thread/items/list` 报 thread not found → resume → 读到完整正文
3. content：resume 后仍失败 → `repair-required`，不抛异常
4. 非 missing-thread 错误不做 resume

## Risks / Trade-offs

- [Risk] bare resume 可能拉起较重的会话状态 → Mitigation：仅在明确 missing-live 错误时触发，且只一次
- [Risk] resume 与用户并发 settings 竞态 → Mitigation：resume 不带权限覆盖；最终仍以用户 settings payload 为准
- [Risk] 错误消息匹配过宽，误 resume → Mitigation：窄模式匹配 + 单测锁定负例
- [Risk] content 仍可能因 TTL/淘汰读不到 → Mitigation：继续返回 repair-required；本次不承诺跨重启持久化
- [Trade-off] 不做全文缓存，换来实现简单与现有 contentRef 设计兼容

## Migration Plan

1. 合并 gateway helper 与 settings/content 接入
2. 跑相关单测与 `npm run typecheck`
3. 手工验证：
   - 新进入历史会话，不先切模型，直接改权限
   - 同会话对 truncated 项点“读取完整内容”
4. 回滚：移除 helper 调用即可回到旧行为；无数据迁移

## Open Questions

- 是否要把 ensure-live 后续扩到更多 RPC（如某些 turn/items 分页入口）？本次不做，等真实报错再扩。
- content 在 resume 成功但 item 已不在 turn 页时，是否尝试 fallback 到 thread detail？本次保持 source-gap/repair-required。

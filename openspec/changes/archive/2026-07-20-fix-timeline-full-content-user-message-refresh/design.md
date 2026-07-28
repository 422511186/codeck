## Context

`TimelineRow` 当前在本地保存 full-content 读取结果，并通过 `renderedEntry = timelineEntryWithFullText(entry, fullContent.text)` 派生完整正文。多数消息分支直接使用 `renderedEntry.body` 渲染，因此读取成功后 preview 会替换为完整内容。

但 `user-message` 分支例外：它在 `switch (body.kind)` 中判断到了 `renderedEntry.body.kind === "user-message"`，随后仍把原始 `entry` 传给 `UserMessage`。这使 truncated 用户消息读取完整内容后，footer/store 与可见气泡正文不一致。

## Goals / Non-Goals

**Goals:**

- truncated `user-message` 的 full-content 读取成功后，用户气泡正文 MUST 使用完整正文。
- `UserMessage` 的重试、回滚、fork 等操作继续绑定当前渲染条目的完整身份和附件元数据。
- 保持 full-content 请求身份校验和 store 写回校验不变。

**Non-Goals:**

- 不修改 full-content 后端 API 或 chunk cursor 协议。
- 不调整 timeline engine 合并规则。
- 不改变用户消息操作菜单、附件 chip 或复制正文逻辑。

## Decisions

1. **让 `UserMessage` 接收 `renderedEntry`**

   选择：在 `user-message` 分支把 `entry={entry}` 改为 `entry={renderedEntry}`，并让 resend/rewind/fork 回调也基于 `renderedEntry`。

   原因：`renderedEntry` 是 `TimelineRow` 内部已经统一生成的当前可见条目；它保留原 entry 的 id、turnId、附件等字段，只替换正文和 completeness。这样 user-message 与 agent/tool/command/diff 的 full-content 语义一致。

   备选：只把 `body.text` 传给 `UserMessage`。该方案会让组件接收拆散后的 entry/body，增加后续消息操作和附件渲染漏字段风险，因此不采用。

2. **测试覆盖 user-message 而非只覆盖 agent-message**

   选择：在 `web-timeline.test.tsx` 增加 truncated `user-message` full-content 用例，模拟 store 中存在匹配 entry、点击读取、断言 preview 被完整正文替换并写回 complete。

   原因：已有测试只覆盖 agent-message，无法发现 user 分支传错 entry 的回归。

## Risks / Trade-offs

- [Risk] 使用 `renderedEntry` 传给 `UserMessage` 可能改变消息操作拿到的正文，从 preview 变为完整正文。→ Mitigation：这是预期行为；full-content 成功后当前可见消息的正文就应是完整正文，重发/rewind/fork 不应继续使用旧 preview。
- [Risk] 若 stale full-content 被错误应用，会让用户消息操作携带旧正文。→ Mitigation：沿用已实现的 identity/contentRef 校验和 store entry 匹配校验，本变更不放宽这些边界。

## Migration Plan

无需数据迁移。前端修复随构建发布；回滚时恢复 user-message 分支传入原始 `entry` 即可。

## Open Questions

无。

## Context

Interrupt route 已支持两种安全输入：客户端显式提供当前 `turnId`，或省略后由 gateway 的 active turn registry 解析。页面当前把 store `activeTurnId` 和 thread detail `lastTurnId` 混用；后者只是历史尾部，并不证明仍在运行。active metadata 尚未补齐 identity、页面刚恢复或 ambiguous start 期间，`lastTurnId` 可能是上一轮终态 turn。

## Goals / Non-Goals

**Goals:**

- 已知 `threadActiveTurnId` 时继续显式中断该 turn。
- identity 未知时省略 `turnId`，让后端按当前 gateway registry 解析。
- 保持现有重复点击锁、失败提示和成功后的本地 idle 更新。

**Non-Goals:**

- 不新增 interrupt operationId 或改变 app-server interrupt 协议。
- 不从 timeline、`lastTurnId`、createdAt 或文本推断 active turn。
- 不改变 active identity 的服务端恢复机制。

## Decisions

1. **仅信任 store active identity**

   `onInterrupt` 只读取 `threadActiveTurnId`。该值来自 `turn/start`、`turn_started` 或权威 active metadata；`detail.lastTurnId` 不再参与中断目标选择。

2. **未知 identity 时发送空 body**

   Web API client 已在 `turnId` 缺省时发送 `{}`，route 会使用 `gateway.getActiveTurnId(threadId)`。如果 gateway 也未知，返回稳定 409，避免误操作历史 turn。

3. **保留 UI 请求锁**

   `runLockedAction("interrupt:<threadId>")` 继续阻止快速连续点击重复发起；只有请求成功后才将本地状态切为 idle。

## Risks / Trade-offs

- [Risk] gateway registry 同样尚未恢复 identity 时中断返回 409 → 页面保留 running 并显示错误，等待 metadata/summary 恢复后重试。
- [Risk] 某些旧流程依赖 `lastTurnId` 兜底 → 该兜底本身无法证明目标仍 active，移除后以失败关闭换取不误中断历史任务。

## Migration Plan

无需数据迁移。前端先部署即可兼容现有 route；回滚只需恢复页面目标选择表达式。

## Open Questions

无。

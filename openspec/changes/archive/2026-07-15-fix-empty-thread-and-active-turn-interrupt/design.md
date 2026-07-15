## Context

当前 thread metadata 与 timeline page 已拆分为两个有界接口。刚创建的 thread 在首条用户消息前可以被 `thread/read includeTurns=false` 读取，但 legacy `thread/turns/list` 会返回明确的未 materialized 错误；会话页无条件请求该 page，因此把合法空会话显示为 502。

active turn identity 也不属于 metadata 协议：`thread/read includeTurns=false` 返回空 turns，`thread/status/changed` 只携带 status 与 active flags。现有代码却从 metadata 的 `lastTurnId` 解析中断目标，并在 active metadata 的该字段为 `null` 时覆盖客户端已知 identity。

## Goals / Non-Goals

**Goals:**

- 未 materialized 的空 thread 返回成功的空 timeline page，保持分页接口有界。
- active turn identity 从 `turn/start` 和 turn lifecycle event 中维护，不依赖消息 timeline。
- metadata 缺失 identity 时保留已有有效值。
- 未显式传入 turnId 的中断请求可使用 gateway 已知 active identity。
- metadata 状态滞后时以有界最新 turn 状态恢复正确的运行态。

**Non-Goals:**

- 不读取完整 thread timeline 或完整 rollout 来解析 turnId。
- 不改变 app-server 协议或持久化 active turn identity。
- 不把任意分页错误吞成空页。

## Decisions

### 1. 在 app-server client 边界归一化空会话分页

只识别同时包含未 materialized/未加载语义和首条用户消息前不可用语义的已知错误。现代 `thread/items/list` 或 legacy `thread/turns/list` 命中该错误时返回 `{items: [], nextCursor: null}`。其他权限、网络、cursor 或协议错误继续抛出。

该选择让所有分页调用方获得一致语义，也避免页面按错误文案做字符串分支。替代方案是在会话页 catch 502，但会把服务端协议细节泄漏到前端，并遗漏其他调用方。

### 2. gateway 维护 active turn identity registry

runtime 使用 `Map<threadId, turnId>` 保存已知 active turn。`startTurn` 成功响应和 `turn_started` event 都写入；匹配该 turn 的 completed、failed、interrupted lifecycle event 清理。清理必须校验 turnId，防止旧 turn 的迟到完成事件清除新 turn；每个 thread 额外保留有界终态 ID 集合，防止迟到的 `turn/start` 响应或 `turn_started` event 复活已经终态的 turn。

该 registry 是状态 identity，不是消息内容，不违反禁止完整 timeline 的约束。进程重启后 registry 可为空，此时 route 返回稳定 409，而不是猜测旧 turn。

### 3. metadata 合并不得用缺失值清空 active identity

页面应用 active thread detail 时，只有 `lastTurnId` 为非空字符串才覆盖 store activeTurnId；`null` 表示该 metadata source 不提供 identity，而不是“没有 active turn”。idle、failed 或 completed 状态仍清空 identity。

### 4. interrupt route 优先显式 turnId，其次 gateway registry

显式 turnId 保持现有行为。缺失时 route 查询 gateway 已知 active turn identity；找不到则返回 `409 暂无可中断的 turn`。route 不再调用 metadata-only `lastTurnId` fallback，也不读取 timeline page。

### 5. active metadata 以有界最新 turn 状态校正

当 `thread/read includeTurns=false` 报告 active 时，gateway 额外调用一次 `thread/turns/list`，固定 `limit=1`、`sortDirection=desc`、`itemsView=notLoaded`。最新 turn 为 completed、failed 或 interrupted 时，将 metadata/summary 校正为 idle 并清理匹配 identity；最新 turn 为 inProgress 时保持 active 并恢复 identity。

该请求不返回任何消息 item，不改变渐进分页约束。若 gateway 已知一个与最新终态 turn 不同的新 active turn，则保留 active，避免 turn 列表短暂滞后时误停新 turn。

## Risks / Trade-offs

- [错误文案变化导致空页识别失效] → 使用聚合语义匹配并覆盖当前两种生产文案，未知错误继续暴露。
- [gateway 重启后无法中断已在运行的 turn] → 返回稳定 409；后续真实 `turn_started` 或新的 `turn/start` 会恢复 registry，不猜测历史消息。
- [迟到 lifecycle event 清除新 turn] → 清理前比较 registry 中的 turnId。
- [极快终态先于 `turn/start` 响应返回] → 以有界终态 ID 集合阻止迟到响应重新写入 active identity。
- [metadata active 但 registry 尚未建立] → UI 保留已有 identity；没有 identity 时不伪造中断成功。
- [metadata 永久滞后为 active] → 通过不含 items 的最新单 turn 状态校正；探针失败时保留 metadata 原状态。

## Migration Plan

随 Web 镜像发布，无数据迁移。部署后用临时空 thread 验证 metadata 与 page 均返回 200，再启动临时 turn，分别验证显式和省略 turnId 的中断请求。

## Open Questions

无。

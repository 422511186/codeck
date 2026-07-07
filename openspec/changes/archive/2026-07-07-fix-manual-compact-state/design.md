## Context

当前手动压缩上下文有两条反馈路径：前端点击确认后本地追加「正在压缩上下文…」，app-server 随后通过 live timeline item / `context_compacted` 事件写入真实压缩进度和完成消息。用户实际看到的结果是本地占位和真实事件重复，甚至刚点击就出现「压缩上下文已完成」。同时后端 compact route 只预检 `active`，`notLoaded` 和 `systemError` 会继续下探到 app-server，容易形成 502 或误导性状态。

## Goals / Non-Goals

**Goals:**

- 只有 `idle` 会话能手动 compact。
- 前端不再本地追加手动 compact 的 timeline 占位或完成条目。
- 运行中的压缩反馈依赖页面已有底部 processing label 与 app-server live timeline。
- summary 轮询不能在 compact HTTP 请求仍 pending 时提前清掉 compact pending 状态。

**Non-Goals:**

- 不改变 app-server compact 协议。
- 不新增自动 resume 后 compact 流程。
- 不重构 timeline 事件归并机制。

## Decisions

- 后端采用 allow-list：`summary.status === "idle"` 才调用 `gateway.compactThread`。相比只拒绝 `active`，allow-list 能覆盖 `notLoaded`、`systemError` 和未来未知状态，避免错误下探。
- 前端采用同样 allow-list 控制入口：`visibleDetail.status === "idle"` 且 store 未 running 时才显示可点击入口。这样详情状态和 store 状态任一侧显示非空闲，都不会暴露 compact。
- 手动 compact 点击只设置 `compactPending`，不调用 `appendEntries`。真实 timeline 继续由 `item_updated` / `context_compacted` 进入 store，避免本地占位与 app-server 事件重复。
- summary 轮询继续负责断线兜底，但当 `compactActionPendingRef` 仍为 true 时，summary idle 不代表 compact 请求完成，不能清空 `compactPending` 或触发完成相关修复。

## Risks / Trade-offs

- 用户点击后 timeline 不再立刻新增一条本地系统消息 → 通过底部「正在压缩上下文…」表达 pending，避免更严重的重复和伪完成。
- 未知状态也会被 compact route 拒绝 → 这是保守策略；如果未来新增可压缩状态，需要显式纳入 allow-list。
- 如果 app-server live 事件丢失，完成消息仍可能需要后续 snapshot repair 补齐 → 本变更不扩大修复面，只避免在请求启动阶段伪造完成。

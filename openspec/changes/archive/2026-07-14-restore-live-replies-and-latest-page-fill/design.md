## Context

生产接口显示多个 legacy 会话首屏仅 1 条 item 但仍有 cursor。当前 fallback 固定 `thread/turns/list limit=1`，不会跨 turn 填满 item 页。另一方面，完成事件触发的 latest-page repair 可能早于 rollout 持久化，首次 repair 只有 user item 后即被清除。

## Goals / Non-Goals

**Goals:**

- legacy 首屏和后续页尽量返回 `limit` 个 items，同时保持条数、字节和请求次数有界。
- assistant item 持久化晚于完成事件时自动恢复，无需刷新。
- 保持 cursor 单调前进、无重复、无漏项。

**Non-Goals:**

- 不全量加载历史，不改变 app-server cursor 语义。
- 不无限轮询完成后的 turn。

## Decisions

### 1. 逐 turn 聚合有界 item 页

legacy fallback 每次仍只请求一个完整 turn，但循环读取更早 turn，直到收集 `pageLimit` 个 items、到达起点或达到 `pageLimit` 次请求。每个 turn 内从最新 item 向前切片，最终按时间正序 prepend 到结果。

### 2. 复用复合 cursor 表示 turn 内偏移

若当前 turn 尚有更早 items，cursor 保留该 turn 的输入 cursor 和累计 offset；若刚好消费完整 turn，则直接返回其 `nextCursor`。这样不会重复请求已消费 items。

### 3. incomplete completion repair 有限重试

completion repair 合并最新页后检查目标 turn 是否有非 user 可见输出。若没有，保留 repair 意图并延迟重试；每个 turn 最多重试固定次数。普通 timeline gap 和已出现输出的 repair 仍一次完成。

## Risks / Trade-offs

- [短 turn 很多时 app-server 请求次数增加] → 单页最多 `pageLimit` 次，通常 30 次，且每次只取一个 turn。
- [assistant 持久化长时间延迟] → 固定次数后停止并保留现有用户消息，避免无限轮询。
- [完成后 reply 通过 live event 已到达] → 输出检查会立即清除 repair，不产生额外请求。

## Migration Plan

随同一 Docker 镜像发布；先验证生产短 turn 会话首屏条数和 cursor，再验证完成事件后的延迟 repair。

## Open Questions

无。

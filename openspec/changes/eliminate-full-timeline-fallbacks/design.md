## Context

项目已经提供 thread-wide cursor 分页和 metadata-only `thread/read`，但旧的 `MobileThreadDetail.timeline` 契约仍被 resume、rollback、steer、review、rename 等接口复用。app-server client 在 `thread/turns/list` 返回空页、抛出错误或 `thread/resume` 缺少 `initialTurnsPage` 时，会回退到上游响应中的 `thread.turns`。这意味着上游只要忽略 `includeTurns: false` / `excludeTurns: true`，完整历史就会重新进入 Web 响应和前端 store。

发送场景尤其容易触发：页面允许缓存 timeline 可见但 detail 尚未加载时发送，此时状态可能为 `notLoaded`，发送流程先调用 resume，再使用返回 detail replace 当前窗口。长会话因此会在一次 mutation 后突然加载全部消息。

## Goals / Non-Goals

**Goals:**

- 让 metadata 和 mutation 响应从运行时与类型层面都无法携带完整消息历史。
- 对不遵守分页参数的上游响应失败关闭，显式丢弃非分页 turns。
- 保证发送、恢复、repair、回滚及其他 mutation 只保留当前分页窗口或合并一页有界消息。
- 对所有可触发 thread 读取的 API 建立统一条数与字节预算回归矩阵。

**Non-Goals:**

- 不改变 app-server 的持久化、turn 排序或 cursor 语义。
- 不为破坏性历史操作实现任意位置服务端搜索。
- 不在本 change 调整 timeline 视觉、虚拟化或滚动锚点。

## Decisions

### 1. metadata 与 timeline page 使用独立返回类型

页面 metadata、状态 mutation 和名称 mutation只返回不含 `timeline` 的 thread metadata；只有 `listThreadTurns` 返回 `MobileTimelinePage`。相比保留可选 `timeline?: []`，独立类型能让未来调用方无法重新把 mutation 响应传入 `applyThreadDetail`。

### 2. resume 只负责 materialize，不提供消息快照

`thread/resume` 仍可向 app-server请求有界 `initialTurnsPage` 以兼容 materialize 行为，但 Web client 不信任 `response.thread.turns`。若存在 `initialTurnsPage`，最多返回显式页；若缺失，则返回 metadata 和空 timeline，由页面另行调用 thread-wide items 页。不会因为缺失字段回退完整 turns。

### 3. 删除所有完整 turns fallback

`readInitialThreadTurns` 在分页空页时返回空页，在协议错误时抛错；绝不读取 `metadataThread.turns`。上游返回的 metadata 对象在进入转换函数前统一覆盖为 `turns: []`。相比按长度裁剪上游 turns，这一策略不会产生伪造 cursor，也不会把“不知道是否完整”的数组误当第一页。

### 4. mutation 只返回操作结果或 metadata

steer 返回 turn/item identity，interrupt 返回空成功，rename/unarchive/fork 返回 metadata，review 返回 review thread metadata。rollback 是唯一需要刷新消息窗口的破坏性操作：它返回 metadata 加显式最新页，且该页受统一预算约束；前端用该页 replace，而不使用 thread detail timeline。

### 5. 前端分页窗口只有两个写入口

首屏/latest-page 和破坏性 rollback page 可以 replace；顶部历史页只能 prepend；live event 只能 merge/append。发送、resume、rename、steer、interrupt、review 和普通 repair 不得 replace 当前窗口。保留 `startTurn.thread` 兼容类型的方案被拒绝，因为它会让同类回归再次出现。

### 6. 以非兼容上游响应作为测试基线

测试主动模拟 app-server 忽略 flags、返回数百 turns、缺少 `initialTurnsPage`、分页返回空页和分页抛错。每个公开 route 除校验功能结果外，还校验 timeline 缺失或消息页在条数与 UTF-8 字节预算内。

## Risks / Trade-offs

- [旧上游不支持 thread-wide items 分页] → 返回局部分页错误，不恢复完整历史；legacy 分页仅允许已有的单 turn + item cursor 有界适配。
- [resume 后页面需要额外一次最新页请求] → 页面已并行使用 metadata + items 页，发送前 resume 只在 `notLoaded` 分支发生，正确性优先于减少一次有界请求。
- [rollback 调用方依赖 detail.timeline] → 在同一镜像中迁移为显式 page 字段并补前后端契约测试。
- [类型迁移涉及多个 route] → 保持操作语义不变，只缩小响应体，逐路由测试避免遗漏。

## Migration Plan

1. 先添加非兼容上游与发送后全量 replace 的失败测试。
2. 收紧 client/gateway 返回类型并删除完整 turns fallback。
3. 迁移 mutation routes、Web API client 和页面状态写入口。
4. 运行 OpenSpec 校验、完整 verify、release verify 和真实长会话响应检查。
5. 前后端随同一 Docker 镜像部署；回滚时整体回滚镜像，不单独恢复完整 timeline fallback。

## Open Questions

无。任何分页不可用场景都必须失败关闭，不允许以兼容性为由全量读取。

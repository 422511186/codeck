## Context

当前 `thread/read(includeTurns=false)` 之后仍会通过 turns 窗口拼装详情，并保留 `includeTurns=true` 的兼容 fallback；页面修复流程也会重新读取详情。长会话因此仍可能产生随历史长度增长的响应。与此同时，项目调用的 `thread/turns/items/list` 已被 app-server 0.144.1 的 `thread/items/list` 取代，协议错误会触发重复 502 与大响应。composer 使用 fixed 定位和动态底部 padding，增高时不会真实缩小 timeline 视口。

## Goals / Non-Goals

**Goals:**

- 让服务端公开接口从类型和实现上都无法返回完整消息历史。
- 使用 thread-wide item cursor 统一首屏和历史分页，首屏只返回最新一页。
- 对每次消息响应施加条数与字节预算，响应大小与会话总长度解耦。
- 消除协议不兼容时的完整详情 fallback 和无界修复循环。
- 让 composer 作为 flex 子元素参与布局，高度变化时保持正确滚动锚点。

**Non-Goals:**

- 不改变 app-server 自身的消息持久化和排序语义。
- 不在本次变更中实现服务端全文搜索或任意消息定位。
- 不重做 timeline 卡片视觉样式或虚拟化算法。

## Decisions

### 1. 详情和消息分页拆分为两个 API 契约

`GET /api/codex/threads/:threadId` 只返回元数据、状态、目标和上下文摘要，不包含 `timeline`。新增或调整 thread items API，接收 `cursor`、受控 `limit` 和排序方向，只返回一页 items 与游标。相比继续在详情中附带“最近窗口”，该方案能在服务端边界禁止全量数据，也避免调用方误把详情当消息快照。

### 2. 统一使用 `thread/items/list`

app-server client 发送 `{ threadId, cursor, limit, sortDirection }`，首屏使用 `desc` 读取最新页，页面按显示顺序归一化后渲染；向上加载沿 `nextCursor` 获取更早页。`turnId` 仅保留给确实需要按 turn 过滤的内部操作，聊天页不使用它分页。相比按 turn 分页，该方案能覆盖跨 turn 的完整时间线且 cursor 语义稳定。

### 3. 服务端强制分页预算

API 忽略或拒绝超出上限的 limit，并对返回 items 施加序列化 UTF-8 字节预算。若单个 item 超预算，允许单项页返回，避免 cursor 无法前进；除此之外不允许响应超过预算。客户端不能传入“全部”或省略分页后获得完整历史。

### 4. 删除完整消息 fallback

删除 `includeTurns=true` 和 turns/full 读取兼容路径。分页协议错误只返回局部错误，前端释放当前 cursor 锁供显式重试，不重新调用 thread detail。修复流程只能刷新元数据或当前缺失页，并对同一 cursor 去重。

### 5. 页面维护分页窗口而非完整快照

页面首次并行读取 thread metadata 与最新 items 页。旧页只在接近顶部时 prepend；实时事件继续 append/merge 到当前窗口。页面只保存已加载窗口和游标，不根据 completeness 自动请求剩余历史。

### 6. composer 使用正常 flex 流

页面保持 `height: 100dvh` 的纵向 flex；timeline 设置 `flex: 1`、`min-height: 0`、`overflow: auto`，composer 设置 `flex: none` 并保留 safe-area padding。移除 fixed 定位和动态 bottom padding。ResizeObserver 仅用于滚动锚点：用户在底部时保持底部贴合，查看历史时保持首个可见内容位置。

## Risks / Trade-offs

- [旧调用方依赖 `ThreadDetail.timeline`] → 通过 TypeScript 类型移除字段并逐个迁移为 metadata 或显式 items 页读取。
- [desc 页的显示顺序与实时事件合并复杂] → 在单一 adapter 中归一化为升序 timeline，并按 item id 去重。
- [字节预算截断导致页条数不固定] → cursor 以 app-server 返回值推进，测试覆盖大 item 与普通 item 混合场景。
- [composer 改为正常流后软键盘行为变化] → 使用 `100dvh`、safe area 和手机视口回归测试验证。
- [发布时前后端版本不一致] → Docker 镜像一次性发布 API 与 Web 变更，旧全量契约不保留兼容 fallback。

## Migration Plan

1. 先更新协议类型、client 与 gateway，并以回归测试证明不再发出 `includeTurns=true` 或旧 method。
2. 修改 Next API 契约和 Web client，迁移 thread 页面及内部调用方。
3. 调整 composer 布局和滚动锚点测试。
4. 运行 `npm run release:verify`，构建并替换 Docker 容器。
5. 使用真实长会话检查首屏响应大小、cursor 翻页和无重复 502。

回滚只能整体回滚镜像；不得单独恢复全量详情 fallback。若分页不可用，应显示局部错误而不是全量读取。

## Open Questions

无。分页条数和字节上限由现有性能测试与实际响应确定为保守常量，并通过测试锁定。

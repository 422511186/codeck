## Context

当前 timeline 的主路径已经比早期版本更稳：`thread/read` 首屏只取 metadata 加最近 turns，分页走 `thread/turns/list`，SSE delta 有 batch，长 timeline 初始只挂最后 80 rows，长输出默认有界预览。但性能风险仍集中在架构边界：

- 服务端 `runtime.ts` 会读取 rollout JSONL 字符串，再由 `session-timeline.ts` 按 allowed turn 过滤；记录数有界，但读取、切行和 parse 仍可能处理完整文件。
- `timeline-engine.ts` 已存在，但 `store.ts` 仍保留旧的 normalize、排序、等价合并、local user 确认和 completion repair 判断，存在双轨归并。
- `ThreadPage` 同时承担请求编排、repair、turn item 补齐、activity 重排、scroll anchor 和多类 UI 状态，timeline 高频更新容易牵动不相关组件。
- `Timeline` 只做尾部初始裁剪和向上扩窗，不会回收已经离开 buffer 的 rows；长时间浏览后 DOM 会持续增长。
- `LongTextPreview`、`DiffView` 和 Markdown 懒渲染减少了 DOM，但仍可能在 render 路径重复 split/parse 完整字符串。

约束：

- 项目只面向手机浏览器，不做桌面端布局；主线程预算和 DOM 数量比桌面更敏感。
- 不改变 app-server 协议字段语义，不新增数据库，不手改 `docs/generated/`。
- 必须保留 event id、generation、revision、snapshot suppression、deleted-turn barrier、rewind/fork 失败关闭和现有移动端活动日志体验。
- 这是架构性能变更，实施时需要 TDD、性能预算测试和分阶段验证。

## Goals / Non-Goals

**Goals:**

- 让 rollout supplement、context usage、snapshot repair、分页和 turn item 补齐保持真正有界，主 timeline 不被补充信息阻塞。
- 让所有 timeline 来源通过统一 engine reducer 归一化，减少 store/page/component 中并行的身份、排序和去重逻辑。
- 将 mobile timeline viewport 升级为可回收窗口，保持 DOM rows 和重渲染范围有界。
- 对长输出派生结果做 entry 级缓存或等价复用，降低 unrelated update 和高频 delta 的 CPU 成本。
- 拆薄会话页订阅边界，让 timeline 更新不重置 composer、sheet/dialog 和 header 相关状态。
- 增加可重复的复杂度/预算测试，覆盖服务端 supplement、store reducer、event batch、viewport DOM 和长输出派生。

**Non-Goals:**

- 不重做聊天页视觉设计和交互信息架构。
- 不引入持久化索引服务或数据库。
- 不改变 Codex app-server 的底层 thread 存储模型。
- 不移除用户查看或复制完整输出的路径；默认渲染有界不等于数据丢弃。
- 不在本变更中处理桌面端布局。

## Decisions

### 1. 先服务端 supplement 有界化，再前端大重构

第一阶段先改 `runtime.ts` / `session-timeline.ts`：rollout supplement 只处理当前 window/page/target turn，读取路径改为文件大小、行数、耗时和记录数预算下的流式扫描或尾部扫描；无法满足预算时跳过 supplement。context usage 优先使用 live/cache/summary 或尾部扫描，不为 header 完整解析 rollout。

备选方案是先统一前端 engine。它能降低浏览器成本，但 Node 端仍可能在每次 detail/page/repair 前读取和 parse rollout，长会话首屏仍会受影响。

### 2. Engine 成为唯一 normalized timeline reducer

store action 保留现有外部 API 名称以降低改动面，但内部只做输入转换：

```text
snapshot / page / live event / overlay / supplement / optimistic user
        │
        ▼
TimelineInput
        │
        ▼
applyTimelineInput
        │
        ▼
normalized entries + indexes + diagnostics
```

旧 `normalizeTimelineEntries`、`mergeEquivalentOutputEntries`、页面层 activity 重排和组件层隐式排序逐步移除或变成 engine helper。identity 以 item id、turn id、generation、clientUserMessageId、tool identity 和 event id 优先；文本包含只保留为受限 fallback。

备选方案是继续修补 store action。短期风险小，但每个新来源仍要重复实现去重和排序，后续 repair/overlay/supplement 还会出现同类回归。

### 3. Recycled viewport 使用动态高度窗口，保留现有滚动语义

Timeline 渲染从“初始最后 80 rows + 向上扩窗”升级为动态高度虚拟窗口。实现可以引入轻量成熟库，也可以先实现本地虚拟器；选择标准是能稳定处理：

- 默认进入会话滚到最新。
- prepend 历史后保持阅读锚点。
- 用户不在底部时 live delta 不强制滚动。
- 跳到最新按钮。
- 长按菜单、图片预览、审批卡片和 composer 底部安全区。

备选方案是继续扩大当前窗口裁剪。实现简单，但用户浏览越久 DOM 越大，不能解决长会话滚动后卡顿。

### 4. 长输出派生缓存绑定 entry identity

Markdown 是否已渲染、diff rows、LongTextPreview preview、activity section summary 等派生结果按 `entry.id + generation + revision/snapshotSequence + text length/hash + status` 缓存。entry 文本变化时只失效该 entry；running 状态、approval、context usage 或其他 entry 更新不应让未变化的大文本重新派生。

备选方案是只使用 `React.memo`。父组件和数组引用变化仍会导致派生函数执行，无法可靠保护 diff/Markdown/preview 这类 CPU 热点。

### 5. 页面层只做请求编排和滚动交互

`ThreadPage` 中的 timeline 数据转换、turn item detail merge、repair 重排、可见输出判断和消息 action 身份解析应下沉到 engine adapter 或 timeline service helper。页面组件拆为更薄的订阅边界：header、plan bar、timeline viewport、composer、sheets/dialogs 分别订阅最小 slice。

备选方案是在现有页面里继续加 `useMemo` 和 selector。它能缓解个别重算，但无法降低文件复杂度，也不能消除 repair 与 UI 状态互相影响的风险。

### 6. 性能验证使用数量级预算而非脆弱毫秒阈值

测试以复杂度和资源预算为主：

- rollout supplement 不完整读取/解析超过预算的文件。
- 1200+ entries 下 200 个 delta 不触发多次全量 normalize。
- 长 timeline DOM row 数保持在 viewport budget 内，向上/向下滚动都会回收窗口外 rows。
- 长 diff/tool/Markdown 在 unrelated update 下不重新派生。
- repair、rollback 和 batch flush 后不会提交旧 generation 或 deleted turn 的 pending delta。

备选方案是只做端到端主观流畅度验证。它难以在 CI 中稳定复现，也无法防止后续小改重新引入近似二次扫描。

## Risks / Trade-offs

- [Risk] Engine 收敛触及 store、page、event stream 和消息操作，改动面较大。→ Mitigation：先补纯函数和 store 预算测试，再逐入口迁移；保留外部 action 名称降低 UI 改动。
- [Risk] 动态高度虚拟窗口可能破坏 scroll anchor、jump latest 或长按菜单。→ Mitigation：先用测试锁住现有滚动语义，再替换渲染器；审批和图片预览保留在窗口外 overlay/dialog 层。
- [Risk] 跳过 rollout supplement 会让部分历史 activity 暂时缺失。→ Mitigation：主 timeline 优先；supplement 可降级；缺失 activity 不阻塞 agent 正文、用户消息和 live 更新。
- [Risk] 派生缓存 key 过粗会显示旧 preview，过细会失去缓存收益。→ Mitigation：使用 entry identity、generation、revision/snapshotSequence、文本长度和轻量 hash 组合；测试覆盖文本变化和 unrelated update。
- [Risk] 页面拆分可能造成 selector 引用不稳定，反而增加 re-render。→ Mitigation：为 store 暴露稳定空数组、派生 selector 和 diagnostics；测试检查 composer/sheet 不因 delta remount。
- [Risk] 流式扫描 rollout 在当前 app-server file API 下可能缺少 offset/tail 能力。→ Mitigation：第一版在 Web 后端本地文件可读时使用 Node fs 流式扫描；不可访问时保守跳过 supplement，不影响主 timeline。

## Migration Plan

1. 为 rollout supplement 有界扫描、context usage 尾部策略和 oversize skip 补红灯测试。
2. 实现服务端 supplement scanner/cache，保持现有 `mergeSessionTimelineItems` 语义但避免完整字符串路径成为默认。
3. 为 timeline engine 增加必要 identity/order/index/diagnostics 测试，覆盖 live/snapshot/overlay/supplement/optimistic user 多来源合并。
4. 逐步把 store action 内部迁移为 `TimelineInput -> applyTimelineInput`，移除重复 normalize/sort/merge。
5. 将会话页的 thread detail mapping、turn item merge、repair reconstruction 下沉到 timeline adapter，拆薄订阅边界。
6. 引入 recycled viewport，先保留现有视觉和行为，再启用 row 回收。
7. 为 Markdown/diff/preview/activity sections 增加 entry 级派生缓存。
8. 跑 timeline 相关单元测试、OpenSpec status、类型检查；必要时跑完整 `npm run verify`。

回滚策略：服务端 supplement 可通过跳过补充快速降级；前端 engine 迁移按入口分阶段提交，单个入口可回退到旧 action；viewport 替换保留旧 Timeline 实现直到滚动锚点测试稳定。

## Open Questions

- app-server 是否能提供 rollout tail/offset 读取，还是 Web 后端只能在本地文件路径可读时流式扫描？
- 是否引入成熟虚拟列表库，还是实现项目内轻量动态高度窗口？需要在依赖体积、滚动锚点复杂度和维护成本之间取舍。
- 长文本缓存是否放在组件局部、store derived cache，还是独立 weak cache helper？需要避免缓存完整大文本副本导致内存反增。

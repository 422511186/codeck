## Context

`thread/items/list` 返回的 `ThreadItem` 没有消息级时间字段。当前分页路径在请求完成时使用 `Date.now() - 10_000` 生成所有历史条目的 `createdAt`，因此历史消息都落入“一分钟内”并显示“刚刚”。snapshot fallback 还直接使用 Unix 秒形式的 `Thread.updatedAt`，与前端毫秒时间约定不一致。

prepend 历史页时，页面层保存 `scrollHeight/scrollTop` 并在一次 layout commit 后立即补偿；Timeline 同时维护基于 render block identity 的锚点。生产长会话证明新内容后续 Markdown 测量和 activity 展开会继续改变高度，而页面层已清除一次性锚点，导致原顶部消息偏移数百至数千像素。

`stream disconnected before completion` 来自 external app-server 请求自定义 Responses 上游后的异步 error notification。Web 只提交一次 `turn/start`，相同 `clientUserMessageId` 还会去重；因此不能在前端自动重发，否则可能在上游已产生部分副作用时重复执行。

## Goals / Non-Goals

**Goals:**

- 历史消息显示接近真实 turn 发生时间，不再使用分页请求时间。
- snapshot、pagination 与 live 条目统一使用毫秒时间。
- prepend 历史页后，加载前顶部消息保持同一 viewport offset，新消息只出现在其上方。
- Timeline 成为唯一滚动锚点控制者，并能处理后续动态高度测量。
- 上游流最终失败时保留失败用户消息、错误信息和显式重试，不自动创建第二个 turn。

**Non-Goals:**

- 不通过完整 thread/timeline 读取补充时间。
- 不修改 app-server 生成的 `ThreadItem` 协议文件。
- 不在 Web 内自动重放可能已有副作用的失败 turn。
- 不宣称 Web 代码能够修复 `apihzy.wbw.pub` 的 SSE、反向代理或 Responses 兼容问题。

## Decisions

### 1. 历史时间使用稳定来源并规范化为毫秒

`timelineItemToEntry` 统一解析条目时间：若 item 明确携带可用时间则使用该值；否则从 UUIDv7 `turnId` 的前 48 位恢复 Unix 毫秒；无法解析时才使用调用方 fallback。fallback 若处于合理 Unix 秒范围则转换为毫秒。

选择 turnId 而非 thread `updatedAt`，因为同一 thread 的更新时间只能代表最后一次更新，无法区分历史 turn。UUIDv7 恢复只作为协议缺失时间时的兼容路径，非 UUID turnId 保持现有 fallback。

### 2. Timeline 独占 prepend 锚点恢复

删除页面层 `pendingPrependAnchorRef`、`scrollHeight` 差值补偿和相关 layout effect。页面只负责分页请求与 prepend 数据，Timeline 继续基于 render block identity、intra-block offset 和 ResizeObserver 高度缓存恢复位置。

备选方案是在页面层长期观察 DOM 高度并反复补偿，但这会与 Timeline 的虚拟窗口和 block regroup 再次形成双控制器，复杂度和竞态都更高。

### 3. 可见进度以消息 identity 和像素 offset 验收

测试不以 `scrollTop` 数值不变作为标准。prepend 后内部 `scrollTop` 必然增加以容纳上方新内容；正确标准是加载前顶部消息 ID 不变，且其相对 scroller 顶部的像素偏移保持稳定。

### 4. 断流恢复必须由用户显式触发

保留现有失败用户消息 `status=failed` 和“重试”操作。测试锁定每次点击只调用一次 startTurn、同 client ID 请求去重、error notification 不触发 Web 自动重发。错误卡继续显示 app-server 原始上游信息，便于排查。

## Risks / Trade-offs

- [Risk] 非 UUIDv7 的旧 turn 无法恢复真实时间。→ 保留规范化 fallback，并且不再使用“当前请求时间”伪装为历史时间。
- [Risk] 同一 turn 内多条消息显示相同相对时间。→ 这是协议只提供 turn identity 时的合理精度，排序仍由 source order 决定。
- [Risk] 删除页面层补偿后暴露 Timeline 锚点缺口。→ 增加短列表、虚拟列表、动态高度和生产 Playwright 组合测试。
- [Risk] 用户认为显式重试未解决上游故障。→ Web 明确保持单 turn 语义；上游服务另行检查 SSE timeout、HTTP/2、缓冲和 app-server 兼容性。

## Migration Plan

1. 先增加历史时间和页面层不得移动 viewport 的失败测试。
2. 实现时间解析和单一 Timeline 锚点控制。
3. 补充断流不自动重发及显式重试测试。
4. 运行完整验证与生产浏览器分页采样。
5. 构建新 Docker 镜像并替换 19899；异常时回滚到 `codex-web:e0ae6e1-timeline-follow-fix`。

## Open Questions

无。上游 Responses 断流的服务端根因不阻塞 Web 侧正确性修复，但必须在部署报告中单独说明。

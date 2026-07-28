## Why

Timeline 的「读取完整内容」会异步按 `contentRef` 分块读取长正文；当前行组件在请求完成前如果对应 entry 的 `contentRef` 被 snapshot、repair、live update 或 pagination 替换，旧请求仍可能把过期全文写回 store。这样会把旧 revision 的正文标记为 complete，覆盖较新的 preview/continuation，造成 timeline 内容与真实历史不一致。

本变更用于让 full-content 读取结果只应用到发起时仍然有效的 thread、entry identity 和 `contentRef`。

## What Changes

- 为 Timeline full-content 读取增加请求快照/取消边界：结果返回时若 thread、entry id、turnId 或 `contentRef` 已变化，则丢弃该结果。
- 避免过期 full-content 响应调用 `replaceOrAddEntry` 写回 store。
- 增加回归测试，覆盖读取过程中 entry `contentRef` 切换后旧响应晚到的场景。
- 不改变 full-content API、chunk cursor 协议或 timeline engine 合并规则。

## Capabilities

### New Capabilities

### Modified Capabilities

- `timeline-content-completeness`: 收紧 full-content 客户端应用语义，要求读取完成只更新仍匹配原始 identity/contentRef 的 entry，过期响应不得覆盖新内容。

## Impact

- 前端渲染：`src/web/components/Timeline.tsx` 的 `TimelineRow.loadFullContent`。
- 状态管理：防止 stale full-content 结果通过 `store.replaceOrAddEntry` 覆盖当前 thread entry。
- 测试：`tests/unit/web-timeline.test.tsx` 增加 stale contentRef 回归用例。
- OpenSpec：更新 `timeline-content-completeness` 对 full-content 完成应用边界的要求。

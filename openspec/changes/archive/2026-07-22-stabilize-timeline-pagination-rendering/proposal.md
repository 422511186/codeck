## Why

移动端会话在向上分页加载历史消息时会出现可见消息换位、滚动位置跳动和历史 warning 被渲染为红色“操作失败”卡片。当前页面层与 Timeline 虚拟列表同时恢复滚动锚点，分页窗口又在渲染后一帧才调整，导致一次 prepend 产生多次位置修正，用户无法确定阅读位置。

## What Changes

- 将 app-server 模型与配置 warning 在所有 timeline 入口统一迁移为 thread notice，分页、live item 与 snapshot 不再产生错误卡片。
- 规定历史页 prepend 只能由一个滚动锚点所有者恢复位置，禁止页面层和虚拟列表重复写入 `scrollTop`。
- 在浏览器绘制前同步调整虚拟可见窗口，避免 prepend 后短暂渲染错误消息区间。
- 让分页合并使用稳定的跨页 turn/item 顺序，并保持同一可见消息在翻页前后的相对位置。
- 增加长 timeline、分页边界 activity group、warning 分页与组合滚动锚点回归测试。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `thread-chat-view`: 强化历史分页的 warning 迁移、跨页顺序、虚拟窗口切换和滚动锚点稳定性要求。

## Impact

- 前端会话分页与滚动：`src/app/threads/[threadId]/page.tsx`、`src/web/components/Timeline.tsx`、`src/web/state/timeline-scroll.ts`。
- timeline 数据入口与排序：`src/web/state/store.ts`、`src/web/state/timeline-adapter.ts`、`src/web/state/timeline-engine.ts`。
- 回归覆盖：thread page、store events、timeline engine、timeline virtualization 相关 Vitest 测试。
- 不改变现有 HTTP API、app-server 协议或依赖。

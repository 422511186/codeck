## Why

长会话目前可能只显示最后一段内容，上滑后出现大面积空白。根因候选集中在 timeline 先按 entry 切片、后合并 activity block，并以固定 72px 将 scroll offset 映射到 entry index；连续 activity、超长消息和动态高度会让 spacer 与真实布局严重偏离。与此同时，turn item detail 最多读取 5 页、session supplement 会静默截断长工具文本，系统缺少明确的内容完整性和字节预算契约，因此历史消息还可能在没有提示的情况下不完整。

## What Changes

- 将 timeline 窗口化单位从原始 entry 改为稳定 render block，连续 activity 在切片前完成分组，避免一个可见 block 被多个 spacer entry 重复估高。
- 使用按 block 类型的初始高度估算、已测量高度缓存、前缀高度索引和二分定位计算可见窗口；scroll range MUST 不再只按固定 72px 除法换算。
- 增加窗口锚点与高度修正策略，prepend 历史、block 高度变化和实时尾部追加时保持用户当前阅读位置，避免空白区和跳动。
- 移除 turn item detail 的 5 页静默停止；分页必须持续到 `nextCursor = null`、达到显式响应预算或返回可继续的 completeness cursor。
- 引入 item/page/response 字节预算、截断元数据、内容摘要、完整内容引用和按需读取能力；超限内容 MUST 不得只以 `...` 静默替换。
- 为 thread snapshot、turn pagination、turn item detail、session supplement 和 realtime event 定义一致的 completeness 状态，区分 complete、partial、truncated、repair-required。
- 对 session supplement、oversize websocket/SSE event 和 raw response fallback 增加显式降级：保留 identity/order/status，提供可继续读取标识，禁止静默丢失整条事件。
- 增加真实移动端滚动、超长 block、连续 activity、分页 continuation、payload budget 和 realtime/refresh 差分测试。
- 不改变移动端视觉信息架构，不新增数据库；允许增加受控的内容读取 API 和共享 completeness 类型。

## Capabilities

### New Capabilities

- `timeline-content-completeness`: 定义 timeline item/page/response 字节预算、截断元数据、continuation、完整内容按需读取和跨来源 completeness 状态。

### Modified Capabilities

- `thread-chat-view`: 长会话必须按 render block 和动态高度稳定窗口化，上滑不得出现空白历史区域，prepend 与高度修正必须保持阅读锚点。
- `timeline-event-stream`: oversize 或不完整事件必须保留 identity/order/completeness，并与 snapshot、pagination、repair 路径收敛。
- `agent-output-rendering`: 长 Markdown、tool output、diff 和 reasoning 在截断时必须显示明确状态并支持读取完整内容，不能以静默省略号冒充完整正文。

## Impact

- 前端窗口化与渲染：`src/web/components/Timeline.tsx`、`src/app/threads/[threadId]/page.tsx`、长内容卡片与 preview 组件。
- timeline 数据模型与 engine：`src/web/state/timeline.ts`、`src/web/state/timeline-engine.ts`、`src/web/state/store.ts`、adapter completeness metadata。
- API 与 server gateway：thread/turn/item 分页 routes、`src/server/app-server/client.ts`、`src/server/app-server/runtime.ts`、session timeline supplement、SSE/WebSocket payload 发送。
- 共享协议：`src/shared/codex.ts` 或邻近共享类型需要新增 truncation/completeness/content reference 字段。
- 测试：Timeline 动态高度窗口、移动端滚动锚点、分页完整性、payload budget、oversize event 和 realtime/refresh 差分覆盖。
- 依赖与部署：原则上不新增运行时依赖；如浏览器真实滚动验证需要，可使用项目现有 Playwright/浏览器工具链并按进度更新 Docker 服务。

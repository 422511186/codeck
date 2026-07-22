## Context

会话页当前有两套滚动锚点：`page.tsx` 在分页请求前后通过真实 DOM row 恢复位置，`Timeline.tsx` 又基于虚拟 block/layout index 恢复位置。长列表 prepend 时两套逻辑会在 layout effect、普通 effect、`requestAnimationFrame` 和 `ResizeObserver` 回调中先后修改 `scrollTop`。同时 `windowRange` 在普通 effect 中更新，prepend 后首个 commit 会用旧索引切片新的 blocks，短暂渲染错误消息区间。

app-server 模型 warning 已有 notice 迁移逻辑，但只覆盖部分 snapshot 和 `turn_error` 路径。历史 pagination、`item.appended`/`item.updated` 和直接 store 写入仍可能把 warning error entry 交给 `ErrorCard`。notice id 又使用完整文本，模型来回切换后会保留互相矛盾的历史提示。

服务端 `thread/items/list` 已请求 `sortDirection: desc` 并在 Web 边界转换为页内正序，因此本变更不修改 app-server 分页协议；重点是浏览器端跨页拼接、presentation grouping 与滚动恢复的一致性。

## Goals / Non-Goals

**Goals:**

- 所有 timeline 数据入口都在进入 engine 前迁移已知 warning，真实错误仍保留在 timeline。
- 同类模型恢复 warning 只保留最新一条，避免同时显示相反的恢复方向。
- 一次历史 prepend 只有一个滚动锚点所有者，并在浏览器绘制前完成窗口与位置收敛。
- 历史页只 prepend 新 identity，不能改写现有可见 entry 的正文或相对顺序。
- 用组合测试覆盖长列表虚拟化、分页边界 activity group、warning 与延迟高度变化。

**Non-Goals:**

- 不改变 app-server 的 cursor、排序方向或 page size 协议。
- 不重写 Timeline 虚拟化实现，也不移除 activity grouping。
- 不把所有英文 app-server 信息都分类为 warning，只处理已有明确模式。
- 不改变用户主动点击“跳到最新”的行为。

## Decisions

### 1. 在 store timeline ingress 统一迁移 warning

`setThreadEntries`、`mergeThreadEntries`、`prependEntries`、`appendEntries`、`replaceLatestWindow` 和 `replaceOrAddEntry` SHALL 在提交 engine 前调用同一 warning 提取函数。已知 warning 不进入 engine，notice 与 timeline entries 在同一个 Zustand commit 中更新，避免先出现错误卡再消失。

备选方案是在每个 API/event caller 中处理；该方案已产生漏点，且新入口容易再次绕过，因此不采用。

### 2. notice identity 按语义类别稳定

模型恢复不一致 warning 使用固定类别 identity，新的恢复方向覆盖旧方向；模型 metadata warning 按模型 identity 去重；长线程 warning 使用固定 identity。dismissal 仍按 notice id 生效。

备选方案继续按完整文本去重会保留互相矛盾的历史状态，因此不采用。

### 3. 根据虚拟化所有权选择唯一滚动锚点

当 Timeline 在 scroller 上声明 `data-timeline-anchor-managed="true"` 时，页面分页层 MUST 不捕获或恢复 DOM anchor，由 Timeline 的 block/layout anchor 独占。短列表未启用虚拟锚点时，页面继续使用真实 DOM row 保持像素位置。

备选方案是删除页面 DOM anchor 并让 Timeline 管理所有长度；这会扩大短列表行为改动和回归范围，本次不采用。

### 4. 在 layout phase 提交可见窗口修正

prepend/appended blocks 的 `windowRange` 修正 SHALL 使用 layout effect，并在滚动恢复前完成。用户不应看到使用旧 range 切片新 blocks 的中间帧。Timeline 的锚点 fallback 顺序继续使用当前 block、成员 entry、相邻 block、绝对 offset。

### 5. pagination 保持输入顺序并只做 identity 去重

Web client 继续负责把服务端 desc page 转为 chronological page。engine pagination merge SHALL 保持 `[older page, current window]` 的稳定顺序；重叠 identity 只从旧页候选中剔除，不得用旧页内容覆盖现有窗口。turn manifest、generation 与 history stamp 仍作为失效屏障。

## Risks / Trade-offs

- [Risk] layout effect 中调整 window range 可能触发额外同步 render → 仅在 blocks 边界变化时更新，并保持 range 相等时返回原值。
- [Risk] notice id 迁移后旧 dismissal key 不再命中 → 新 id 只影响已知模型 warning，用户仍可重新关闭一次；之后保持稳定。
- [Risk] activity group 在分页边界扩展时 block identity 变化 → anchor fallback 使用组内末尾 entry identity，并增加边界组合测试。
- [Risk] 页面 dataset 所有权在首次 effect 前尚未建立 → 长列表 Timeline 在挂载后立即声明；自动补页测试覆盖首屏 underfill 与 ResizeObserver 路径。

## Migration Plan

1. 先增加会失败的 store warning、分页和长列表锚点测试。
2. 收敛 warning ingress 与语义 notice identity。
3. 消除长列表页面 DOM anchor，调整 Timeline layout effect 顺序。
4. 运行 timeline/store/thread-page 定向测试，再执行 `npm run verify` 和生产构建。
5. 若滚动回归，可独立回退锚点所有权改动；warning ingress 与 notice identity 不依赖滚动实现。

## Open Questions

无。

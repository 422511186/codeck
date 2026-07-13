## Context

当前 Timeline 在 `entries.slice(windowRange)` 之后才调用 `deriveTimelineRenderBlocks`。这意味着连续 reasoning/tool/command/diff entries 在布局模型中被当作多行计算 spacer，真正渲染时却可能合并成一个很矮的 inline activity block。窗口定位又用 `scrollTop / 72` 估算 entry index，即使已测得可见 row 高度，也只用于 spacer，不参与 scroll offset 到窗口的映射。长文本、连续 activity 和高度修正会让布局总高度、窗口边界和浏览器 scrollTop 互相不一致，表现为上滑空白、跳动或只看到尾部。

历史完整性也没有统一契约。`threadDetailEntriesWithTurnItems` 最多读取 5 页，仍有 `nextCursor` 时会静默停止；session supplement 将工具文本截成 12,000 字符并只附 `...`；thread/turn/item API 和实时事件没有统一 UTF-8 字节预算、截断元数据、内容引用或 completeness 状态。用户无法判断“当前就是完整内容”还是“系统只返回了一部分”。

约束如下：

- 保持手机浏览器优先，不引入桌面专用布局。
- 不新增数据库；完整内容必须从 app-server、rollout/session 文件或现有 thread/turn/item source 按需重读。
- 不允许为了修空白回退为长会话全量挂载全部 Markdown/diff/tool rows。
- timeline engine 继续拥有 identity、ordering、dedupe 和 completeness 合并语义；组件只消费 normalized blocks/layout metadata。
- 架构设计必须在实施前通过独立 subagent 复核。

## Goals / Non-Goals

**Goals:**

- 长会话上滑过程中任何 viewport 都有真实 row 或明确 loading/completeness UI，不出现由 spacer/window 失真造成的大面积空白。
- 窗口化以最终 render block 为单位，activity 分组不会跨窗口被拆分，也不会按原始 entry 数重复占位。
- 动态高度、长 Markdown、展开 activity、图片载入和 prepend 历史后保持稳定 scroll anchor。
- turn item detail、turn pagination 和 thread snapshot 明确报告 complete/partial/truncated/repair-required，不静默停止。
- item/page/response/event 具备统一 UTF-8 bytes 预算和可测试默认值。
- 截断内容保留 identity、status、order、摘要、原始/已包含 bytes、contentRef 和 continuation cursor。
- realtime 与 refresh 对同一 fixture 产生一致的可见顺序、文本前缀和 completeness 状态。

**Non-Goals:**

- 不引入第三方虚拟列表库，除非实现阶段证明现有 React 方案无法满足动态高度与 anchor 规格。
- 不一次性下载所有完整 tool output、diff 或 reasoning；完整内容按用户展开或显式请求读取。
- 不更改 app-server 原始协议；Web gateway 可以增加兼容层、content reference 和补充分页 API。
- 不把所有长正文永久缩短为 preview；完整内容仍必须可达。

## Decisions

### 1. 先派生全量轻量 render block，再窗口化 blocks

Timeline 首先对 normalized entries 生成只包含 identity、kind、成员引用和派生 key 的 `TimelineRenderBlock[]`。该步骤不得解析 Markdown、diff 或长 tool body。连续 activity 在此阶段完成稳定分组，窗口范围、spacer 和测量缓存全部使用 block key，而不是 entry id。

备选方案继续按 entries 窗口化并修正 activity 数量。该方案仍会在窗口边界拆分连续 activity，并且同一个 activity group 随滚动产生不同 key，不采用。

### 2. 使用动态高度布局索引，不再固定除以 72

新增纯函数/轻量状态 `TimelineLayoutIndex`：

- 每个 block 持有 estimated/measured height。
- 未测量高度按 block kind 估算：普通短消息、长消息、activity、system/error 使用不同基线。
- 维护 prefix height 或 Fenwick tree 等可增量更新的累计高度结构。
- 通过二分查找将 `scrollTop` 和 `scrollTop + clientHeight` 映射到 block indexes，并加前后 buffer。
- row 测量变化只更新对应 block height 和后续累计值，不扫描/重建昂贵内容。

实现优先使用数组前缀和加有界重建；若 profile 证明频繁高度变化导致 O(n) 成本，再升级 Fenwick tree。长会话典型 block 数远低于 delta 数，先保持实现简单。

### 3. scroll anchor 使用 block identity + intra-block offset

在 prepend、窗口切换或测量修正前记录 viewport 顶部第一个可见 block id 及其相对顶部 offset。更新后通过 layout index 恢复该 block 的新累计 offset。若 block 被 authoritative replace 删除，则回退相邻 before/after anchor；尾部跟随状态单独保持“贴底”。

不能仅依赖 `scrollHeight` 差值，因为 activity regroup、截断展开和图片高度变化不一定是纯 prepend。

anchor 恢复采用确定顺序：原 block 仍存在时恢复原 block；原 block 因 regroup 被替换时使用包含原 entry identity 的新 block；仍无法找到时优先恢复原 `beforeEntryId` 对应 block，其次 `afterEntryId`，最后选择更新后相同累计 offset 附近的第一个真实 block。任何 fallback 后 viewport MUST 至少包含一个真实 block 或明确 loading marker。

### 4. completeness 是共享结构化状态

共享类型增加：

```ts
type TimelineCompleteness = {
  status: "complete" | "partial" | "truncated" | "repair-required";
  reason?: "page-budget" | "response-budget" | "item-budget" | "event-budget" | "source-gap";
  nextCursor?: string | null;
  originalBytes?: number;
  includedBytes?: number;
  contentRef?: string;
  contentCursor?: string | null;
};
```

page/response completeness 描述集合是否完整，item completeness 描述正文是否完整。engine 合并同 identity 时采用更权威且更完整的状态，禁止 snapshot 的 truncated item 覆盖 realtime 已拥有的完整正文。

### 5. 使用分层 UTF-8 字节预算

默认预算：

- 单 item 内联正文：96 KiB。
- 单 turn/page JSON：1 MiB。
- thread detail/repair response：2 MiB。
- 单 SSE/WebSocket 可见事件：256 KiB。
- 完整内容读取 chunk：2 MiB。

预算使用 `Buffer.byteLength` 或 `TextEncoder`，不能以 UTF-16 `string.length` 代替。page、response 和 event budget 按最终序列化后的完整 payload 核算，包含 envelope、metadata、cursor、preview 和 completeness；builder 必须在发送前验证最终 bytes 不超过硬上限。环境变量可降低或提高默认值，但必须有编译期/服务端硬上限，且任何截断都必须生成 completeness metadata。

### 6. continuation 替代固定页数和静默截断

turn item detail 不再使用 `TURN_ITEM_DETAIL_MAX_PAGES = 5`。协调器持续读取直到 source cursor 结束，或累计 page/response budget 达到上限。达到预算时返回 `partial` 和 continuation cursor，页面在用户继续上滑、展开目标 turn 或 repair 需要时继续读取。

session supplement 不再只返回 `text.slice(...) + ...`。解析器保留完整 source locator（rollout path、record sequence、field kind），inline item 返回 preview 与 contentRef；content endpoint 从原 source 读取后续 chunk。

所有分页循环维护 seen cursor 集合与新增 identity/bytes 进展。nextCursor 重复、形成环、或连续返回非空 cursor 但零新增内容时立即停止，并返回 scoped `repair-required`，不得继续请求或伪装 complete。

### 7. oversize realtime event 保留 envelope

事件服务在序列化前检查 bytes。超限时发送同 eventId/identity/order/revision 的 `timeline-content-reference` 或等价可见事件，包含 preview、contentRef 和 `event-budget` completeness；不得断开连接后静默丢弃。若 reference event 仍超限，builder 必须继续缩短 preview 和可选 metadata，直到生成小于 event budget 的最小 identity/order/completeness envelope。若 contentRef 无法安全生成，最小 envelope MUST 发送 scoped `repair-required`，不能丢事件或断连。client/engine 将 reference 与后续 completed/snapshot/full-content 输入合并。

### 8. 完整内容读取是 source-backed API

新增受鉴权、workspace/audit 边界保护的 content read route。`contentRef` 是签名或服务端可验证的 opaque token，绑定 threadId、turnId、itemId/source locator、source revision 和允许读取的 field；客户端不能提交任意文件路径。content cursor 同时绑定 contentRef、revision 和 chunk byte offset，并带完整性校验。相同 cursor 重试 MUST 幂等返回相同 chunk；相邻 chunk MUST 不重叠、不跳字节。source revision 改变、token 过期或 cursor 被篡改时返回 scoped `repair-required`。route 支持 cursor/chunk bytes，返回正文 chunk、nextCursor 和 completeness。

## Risks / Trade-offs

- [Risk] 全量派生 render blocks 仍是 O(n)。→ Mitigation：block 派生只访问 identity/kind/引用，不解析正文；通过 entry 引用与稳定 key memo，delta 只重建受影响 turn/block，测试限制派生次数。
- [Risk] 动态高度修正造成 scroll 抖动。→ Mitigation：统一 anchor transaction，在 `useLayoutEffect` 中测量并一次恢复 offset；变化小于 1px 不更新。
- [Risk] activity block key 在成员变化时不稳定。→ Mitigation：key 使用 turnId、首尾 identity 和成员版本摘要；成员 append 只更新对应 block。
- [Risk] contentRef 泄露文件位置或越权读取。→ Mitigation：opaque token、thread ownership 校验、workspace roots、审计日志和短期有效期；不接受客户端原始路径。
- [Risk] 预算过低造成频繁按需读取。→ Mitigation：默认值按移动网络和现有输出规模选择，增加 diagnostics 统计截断率和 full-content 请求率。
- [Risk] app-server 不支持单 item read。→ Mitigation：gateway 通过已有 turn item pagination 定位 item；session source 通过已有 rollout parser 定位，均设置扫描页数/bytes budget 并返回 repair-required 而非无限扫描。
- [Risk] completeness 合并错误导致完整正文被 truncated snapshot 覆盖。→ Mitigation：engine 建立 completeness precedence 和差分测试，完整正文只被更权威完整正文替换。

## Migration Plan

1. 增加红灯测试：连续 activity + 超长 rows 上滑空白、动态高度定位、prepend anchor、5 页 continuation、UTF-8 bytes budget、session truncation metadata、oversize event envelope。
2. 引入共享 completeness/contentRef 类型和纯预算工具，不改变现有 UI。
3. 将 Timeline 派生顺序改为 entries → render blocks → layout index → visible blocks，并保留旧窗口算法作为短期回退开关。
4. 接入 block 测量、prefix height 和 anchor restoration；用真实手机 viewport 截图与滚动脚本验证非空白。
5. 改造 turn/page/detail API 返回 completeness，移除 5 页静默停止并支持 continuation。
6. 改造 session supplement 和 oversize events，增加 source-backed full-content route。
7. 在 engine 中合并 item/page completeness，并在卡片中显示截断状态和读取完整内容命令。
8. 运行定向、完整测试、typecheck、build、OpenSpec validate 和移动端浏览器验证。
9. 请求独立 subagent 最终架构复核，PASS 后归档。

回滚时可切换回旧窗口算法，但 completeness metadata 和服务端预算不得回滚为静默截断；full-content route 可独立保留。

## Open Questions

- 96 KiB item 与 2 MiB response 默认值需要用真实长会话 diagnostics 校准，但实现不得延迟结构化 completeness。
- app-server future protocol 是否会提供原生 item content cursor；若提供，gateway contentRef 应优先代理原生 cursor。
- 图片和二进制附件不纳入文本 bytes budget，仍使用现有上传/preview 路径；其 metadata bytes 计入 response budget。

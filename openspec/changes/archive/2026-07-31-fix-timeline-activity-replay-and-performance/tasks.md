## 1. 锁定真实回归

- [x] 1.1 在 `tests/unit/app-server-session-timeline.test.ts` 增加 canonical base 为 `agent-a, agent-b, cmd-a, cmd-b`、rollout 为 `cmd-a, agent-a, cmd-b, agent-b` 的失败测试，断言最终 identity 顺序和 canonical metadata。
- [x] 1.2 在 `tests/unit/web-store-events.test.ts` 增加同一 turn 先后收到 `turn_diff_updated`、item-scoped file delta 和 completed file item 的失败测试，断言 live timeline 只保留 canonical item activity。
- [x] 1.3 在 `tests/unit/app-server-runtime.test.ts` 与 `tests/unit/web-timeline.test.tsx` 增加 file fallback、多个不同 file itemId、refresh 收敛和 activity 分组数量测试。
- [x] 1.4 在 `tests/unit/codex-client.test.ts` 增加 owner metadata 完整时不得调用 broad `thread/turns/list itemsView: full`，以及 owner 缺失时 resolver 必须受 RPC/item budget 限制的失败测试。
- [x] 1.5 在 `tests/unit/app-server-runtime.test.ts` 增加大 rollout 冷扫描、metadata/page 并发复用、append-only 增量读取、文件 revision 失效和 completion retry 复用测试，并记录 reader 调用次数与读取区间。
- [x] 1.6 在 `tests/unit/web-timeline.test.tsx` 与 `tests/unit/web-timeline-presentation.test.ts` 增加顶层摘要不显示任何状态、展开动作仍显示中文失败状态和错误详情的失败测试。

## 2. 统一文件修改 identity

- [x] 2.1 为 turn-level diff 建立明确的 provisional fallback 语义，使其 identity、HistoryStamp 和 owning turn 可被 store/engine 安全识别与移除。
- [x] 2.2 修改 live event ingress：同 turn 出现稳定 itemId 的 file activity 时移除或抑制 provisional turn diff；item 级 file activity 已存在后忽略新的可见 turn diff。
- [x] 2.3 保持同 itemId 的 file delta、completed item、snapshot 与 repair 原位合并，同时确保不同 itemId 的 file changes 不被路径、diff 或统计值误合并。
- [x] 2.4 更新 runtime overlay 与 snapshot/repair 收敛路径，确认 turn diff fallback 在缺少 item event 时仍可显示，canonical item 到达后刷新前后只剩一条。

## 3. 修复 rollout anchor 重定位

- [x] 3.1 重构 `mergeTurnSessionRecords` 的 tool 匹配结果，使其返回 canonical base index、supplement record 位置和唯一 message-anchor interval，而不是仅返回 consumed 布尔值。
- [x] 3.2 按 supplement record 顺序输出已匹配 canonical tool，并在后续 base 遍历中跳过原位置，保留 canonical body、status、turn metadata、source locator 和 completeness。
- [x] 3.3 保留 missing supplement activity 的现有有界插入能力；message anchor 歧义、metadata-only 相似或 window 外 target 必须保持候选独立或标记 repair-required。
- [x] 3.4 用相同交错 fixture 串联 session supplement、runtime page、timeline adapter/store 和 `deriveTimelineRenderBlocks`，断言 refresh 前后均形成两个被 assistant 边界分开的 activity blocks。

## 4. 收紧 `/turns` 与 owner resolution

- [x] 4.1 修改 `listThreadTurns`：当前 `thread/items/list` page 的所有可见 items 已携带 turnId 时，直接派生 turn ownership/manifest，取消无条件 broad full-turn 请求。
- [x] 4.2 为缺少 turnId 的 page 实现 bounded owner resolver，使用轻量 turn manifest 和按候选 turn 限制的 item pages，在 items 全部归属或 RPC/item/byte budget 耗尽时停止。
- [x] 4.3 owner 无法在预算内解析时返回明确 incomplete/repair-required 语义，并让依赖完整 manifest 的 rewind/rollback/fork 等破坏性动作失败关闭。
- [x] 4.4 保留不支持 `thread/items/list` 的 legacy 逐 turn fallback，但验证单页 item 数、turn RPC 数、字节预算和 cursor 都有硬上限。
- [x] 4.5 让 `/api/codex/threads/[threadId]/turns` 透传 repair reason 或等价诊断上下文，并补充路由级边界与调用测试。

## 5. 增量化 rollout supplement

- [x] 5.1 抽取 gateway 级 bounded rollout supplement index/cache，按 canonical path 与文件 revision 保存 scan offset、尾部残行、per-turn records、context usage 和 in-flight promise。
- [x] 5.2 实现有界冷扫描：只读取尾部或目标范围，预算内找不到 window turn 时跳过 supplement，不因文件小于 source cap 就读取完整文件。
- [x] 5.3 实现 append-only 增量更新以及文件截断、替换、mtime/size 回退时的 cache 失效，确保不重复读取已确认前缀。
- [x] 5.4 让 metadata context usage、latest page、pagination 和 turn detail supplement 共享同一 revision 的 scan/index 结果，并为并发请求做 promise coalescing。
- [x] 5.5 为 cache 增加 per-thread record、文件数量、字节和空闲时间淘汰上限；补充 diagnostics 以验证 scan 次数、读取 bytes、cache hit 和降级次数。
- [x] 5.6 验证 completion repair 的固定上限重试复用未变化 revision 的索引，不形成重复 rollout 扫描或新的轮询链路。

## 6. 调整 activity 第一层状态展示

- [x] 6.1 修改 `Timeline.tsx` 顶层 disclosure，移除 `presentation.failed` 对可见文案、失败图标和 aria-label 的影响，只保留动作摘要与展开图标。
- [x] 6.2 保留展开后具体动作行的中文失败标识，以及 command/tool detail 中的状态、参数、stderr/result/output；不得回退为英文 `Failed`。
- [x] 6.3 更新 presentation/component tests，覆盖 running、success、failed 混合组、纯失败组和通用工具组在折叠态都保持中性。

## 7. 跨层验证与收尾

- [x] 7.1 运行 `app-server-session-timeline`、`app-server-runtime`、`codex-client`、`web-store-events`、`web-thread-page`、`web-timeline-engine`、`web-timeline-adapter`、`web-timeline-presentation` 和 `web-timeline` 定向测试。
- [x] 7.2 对真实错误规模的长 rollout fixture 验证首屏、completion repair、刷新和向上分页的 RPC 次数、读取 bytes、visible identity 顺序及重复 activity 数量。
- [x] 7.3 运行 `npm run verify` 与 `npm run build`，确认 TypeScript 严格检查、完整 Vitest 和 production bundle 通过。
- [x] 7.4 运行 `openspec validate fix-timeline-activity-replay-and-performance --strict`，检查 artifacts 无占位符、无 `docs/generated/` 修改且 apply-ready。

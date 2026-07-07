## Context

移动端会话页当前有两条实时更新路径：SSE timeline event stream 负责增量内容，HTTP summary 轮询只负责运行状态兜底。上一轮优化已经避免 running 期间固定全量 `readThread` 轮询，但页面仍存在多个 snapshot repair 入口：启动 turn 后 2.5 秒无输出、`turn_completed`、`context_compacted`、summary idle 和 `timeline-gap`。这些入口可能在同一个 turn 或同一次压缩完成附近叠加，导致用户在 Network 中看到 `/api/codex/threads/:threadId` 全量读取夹在 summary 之间。

渲染层当前把 reasoning、tool、command 和 diff 都归入 `InlineActivityLog`。该组件按 activity kind 再分 section，section 展开后还要求用户逐条展开 action row 才能看到正文。这个模式适合多条命令和工具调用，但对 Thinking 与文件变更来说形成了冗余层级。

## Goals / Non-Goals

**Goals:**

- 运行中继续以 event stream 为主，summary 轮询仅作为轻量状态兜底。
- 全量 snapshot repair 必须有明确原因，并对同一 thread、turn、原因和 generation 做去重，避免正常运行时重复读取完整 timeline。
- Thinking 展开后直接显示公开 reasoning 内容，不再显示第二层 Thinking 行。
- 文件变更展开后直接显示 diff 或文件输出内容，不再要求每个文件再点一次。
- 失败活动在摘要行用中文展示，并在展开后优先显示错误输出。

**Non-Goals:**

- 不取消 summary 状态轮询。
- 不改变 app-server 协议或新增后端依赖。
- 不重写 timeline store 排序模型。
- 不把所有工具活动都改成默认展开；多条命令、读取、搜索和工具加载仍保留分组折叠。

## Decisions

1. **把 snapshot repair 从 boolean/timestamp 改为 reasoned request。**

   选择：让 store 的 repair 状态携带 `reason`、`turnId`、`generation`、`requestedAt` 和稳定 `key`。页面 repair effect 根据 key 执行，完成后清除；相同 key 的重复请求不更新时间戳。

   原因：当前 `repairRequestedAt = Date.now()` 会让多个来源不断触发 effect，无法判断是否同一个原因。reasoned key 可以把 `turn-completed:turn-1`、`timeline-gap:event-x`、`compact-completed:turn-2` 区分开，同时对重复事件天然去重。

   替代方案：只在 page 层用 ref 防抖。该方案无法覆盖 store 事件分发，也不利于单元测试。

2. **收窄启动 turn 后“无输出修复”。**

   选择：保留完成事件后的“无可见输出修复”，移除或弱化发送后 2.5 秒直接全量修复。运行中如果事件流仍正常，只靠 live events 和 summary 兜底；只有确认完成且没有可见输出，或确认 `timeline-gap`，才全量修复。

   原因：2.5 秒只是时间猜测，在模型慢启动、网络延迟或前端首个 delta 尚未到达时容易造成运行中全量读取。完成事件是更可靠的收敛点。

3. **summary idle 只作为完成兜底，并与 turn 完成修复共享 key。**

   选择：summary 轮询发现 idle 时，停止 running/compact 状态，并请求 `summary-idle` 修复；如果同一 active turn 已经通过 `turn_completed` 请求过修复，不重复发起等价全量读取。

   原因：summary 的价值是防止完成事件丢失，不应该和完成事件各自独立造成双修复。

4. **Thinking 与 files section 使用单层详情渲染。**

   选择：`InlineActivityLog` 保留 section 折叠，但对 `thinking` 和 `files` section 展开后直接渲染内容详情，不再渲染可点击 action row。commands/tools/skills 仍使用 action row。

   原因：Thinking 和 file change 的用户意图是“看内容”，不是“选择一个动作”。多条文件时可以在同一展开区按文件分块显示，不需要每块再折叠。

5. **失败状态中文化并暴露错误详情。**

   选择：摘要行显示「失败」，颜色沿用 danger；展开详情中把 `arguments`、`result` 或 `output` 合并为可复制/可滚动文本。命令失败仍保留命令摘要，错误输出不被隐藏到第三层。

## Risks / Trade-offs

- [Risk] 去掉 2.5 秒无输出修复后，某些没有任何 live event 且长时间运行的 turn 在完成前看不到进展。→ Mitigation：保留 running footer 和 summary 状态轮询；完成或 gap 后仍会修复最终 timeline。
- [Risk] repair key 过度去重可能吞掉真正需要重试的失败 repair。→ Mitigation：只对 pending/active key 去重；repair 失败不清除请求或允许后续不同 reason 重新触发。
- [Risk] 文件 diff 直接展开可能在单个 files section 中内容较长。→ Mitigation：沿用现有 preview/truncation 和详情区域最大高度，保持内部滚动。
- [Risk] 修改 activity 渲染测试会触及已有快照语义。→ Mitigation：只调整 Thinking/files 的层级预期，commands/tools 旧行为用回归测试保护。

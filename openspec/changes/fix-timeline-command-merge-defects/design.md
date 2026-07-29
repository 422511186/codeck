## Context

命令类事件合并涉及四层：前端快路径 `appendDeltaEntry`、前端慢路径 `mergeEntry`、服务端 session 重建 `applyFunctionOutput`/`nestedExecOutputParts`、服务端 overlay `mergeOverlayItems`/`appendTimelineOverlayText`。各层对 status/result/identity 的取舍规则不一致是缺陷根因。

## Goals / Non-Goals

**Goals**
- 终态保护在所有合并路径上一致生效。
- nestedExec parts 不匹配时不再静默跳过。
- 多源 command_output_delta 可区分、可去重、可按序合并。
- authoritative 截断不覆盖更长 delta 文本。
- working_dir 不被字面量 "command" 覆盖。

**Non-Goals**
- 不重写整个 identity 模型（仅补充 channel/序号字段）。
- 不改变 `timelineItemToEntry` 的 role→kind 映射（保留现状，仅清理死代码分支）。
- 不处理顺序流问题（归入另一变更）。
- 不处理性能问题（归入另一变更）。

## Decisions

### 决策 1：终态保护统一为 helper

抽取 `resolveToolStatus(current, next)`：当 `isFinalStatus(current) && !isFinalStatus(next)` 时返回 current，否则返回 next。`appendDeltaEntry`、`mergeEntry` tool 分支、`mergeOverlayItems` 全部改用此 helper。

**理由**：三处当前规则不一致（快路径无保护、慢路径有保护、overlay 用 `??`），统一为单一函数消除分歧。

### 决策 2：nestedExec parts 不匹配 fallback

当 `groupedRecords.every(nestedExec)` 且 `parts.length !== groupedRecords.length` 且记录数 >1 时：
- parts 多于记录：多出的 parts 合并到最后一条记录。
- parts 少于记录：按位置回填，无对应 part 的记录用末尾 part 推断状态；若 parts 为空则用剥离前的原始 output 推断状态。

**理由**：原代码静默跳过导致整组命令永久 running，是最严重的用户可感知缺陷。

### 决策 3：状态推断前置

`nestedExecOutputParts` 改为先对原始 output（剥离前）调用 `toolStatusFromOutput` 得到 `inferredStatus`，再剥离头行，把 `inferredStatus` 作为参数传入 `applyFunctionOutput`。`applyFunctionOutput` 增加可选 `statusOverride` 参数，优先于从文本二次推断。

**理由**：剥离 "Script failed" 头行后 `toolStatusFromOutput("")` 默认返回 success，丢失失败信号。

### 决策 4：command_output_delta 补充字段

`deltaEvent` 与 `processDeltaEvent` 增加可选字段：
- `sourceChannel`：标识来源（`item-commandExecution` / `command-exec` / `process` / `terminalInteraction`）。
- `streamSequence`：按 (itemId, sourceChannel) 维护的单调递增序号。

前端 `identityKey` tool 分支纳入 `sourceChannel`，使多源输出落到不同 entry。`applyLiveDeltaInput` 的 fragmentSequence 校验对 command delta 生效。

**理由**：当前多源都映射为同一 `kind:command_output_delta` 且 identity 仅按 itemId，itemId 相同时输出翻倍。

### 决策 5：authoritative 截断不覆盖

`mergeEntry` tool 分支 result 取值增加判断：当 `next.completeness?.contentRef` 存在（表示被截断）时，不采用 `next.body.result` 直接覆盖，保留 `current.body.result`，仅采纳 next 的 status 与 contentRef。

**理由**：authoritative 截断后 next.result 比 current.result 短，直接覆盖导致可见文本回缩。

### 决策 6：server/tool 用 authoritative 覆盖而非 `||`

`appendDeltaEntry` tool 分支的 `server: delta.body.server || current.body.server` 改为：delta 携带明确 server（非默认 "command"）时采用 delta，否则保留 current。`mergeEntry` 中 server/tool 采用 authoritative 覆盖（next.authoritative 时强制用 next）。

**理由**：`||` 短路使字面量 "command" 覆盖真实 working_dir。

### 决策 7：清理 command 分支死代码

`mergeEntry` 的 `kind:"command"` 分支（L1624）当前无产出路径（`timelineItemToEntry` 永不生成 kind:command）。将该分支的 output 取值改为 `longerText` 与 tool 分支对齐，或确认无产出后删除。

**理由**：避免未来一旦有路径产出 command entry 时立即暴露 `||` 短路问题。

## Risks / Trade-offs

- **identityKey 纳入 sourceChannel 可能导致历史 entry 无法合并**：仅对新生成的 entry 生效，历史 entry 的 sourceChannel 为 undefined，需保证 undefined 与具体值仍可匹配（fallback 到原 identity）。
- **streamSequence 引入可能改变现有 delta 流行为**：需保证未携带 streamSequence 的旧事件仍走原路径，不触发 fragmentSequence 校验。
- **nestedExec fallback 可能误判状态**：parts 不匹配是异常情况，fallback 比静默跳过更优，但仍需日志诊断便于排查。

## Migration Plan

- 所有改动向后兼容：新字段可选，旧事件不携带时走原路径。
- 终态保护、authoritative 截断、server/tool 覆盖规则变更不影响已稳定 entry（仅影响后续合并）。
- 无数据迁移。

## Open Questions

- `sourceChannel` 是否需要纳入 `MobileTimelineItem` 持久化字段，还是仅作为运行时 event 字段？倾向后者（仅运行时），避免持久化层变更。

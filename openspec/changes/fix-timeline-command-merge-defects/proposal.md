## Why

命令类（local_shell_call / tools.exec_command / process）事件的合并链路存在多处已核实缺陷，导致命令卡片在常规场景下出现"永久转圈""失败显示成功""输出翻倍/串接""终态被中间态覆盖""工作目录被字面量覆盖"等用户可感知错乱。根因集中在三处：

1. 前端快路径 `appendDeltaEntry` 与慢路径 `mergeEntry` 对 status/result 的取舍规则不一致，快路径无终态保护。
2. 服务端 `nestedExec` 静态分析与运行时 output parts 数量不匹配时静默跳过，且剥离 "Script X" 头行后状态判定丢失失败信号。
3. `command_output_delta` 事件缺乏 identity 区分字段（server/tool/channel）与序号字段，多源输出叠加到同一 entry。

所有问题均已通过逐行核实确认存在（见前序核实报告，13 项中 12 项完全成立、1 项部分成立但核心结论成立）。

## What Changes

- 统一 `appendDeltaEntry` 与 `mergeEntry` 的 status 取舍规则：终态一旦确立，非终态 delta 不得覆盖。
- 统一 result/output 取舍规则：authoritative 截断（带 contentRef）时不覆盖更长 delta 文本；command 分支与 tool 分支语义对齐。
- 修复 `nestedExec` parts 数量不匹配时的静默跳过：提供 fallback 回填与状态推断，不再让整组记录停留 running。
- 修复 `nestedExecOutputParts` 剥离头行后状态丢失：剥离前先推断状态，显式传入 `applyFunctionOutput`，不再从剥离后文本二次推断。
- 修复同 callId 多记录（非 nested）只回填首条：按记录顺序切分或显式标记 orphan。
- 为 `command_output_delta` 事件补充 identity 区分字段与序号字段，使多源输出可区分、可去重、可按序合并。
- 修复 `mergeOverlayItems` status 用 `??` 导致 running 覆盖 success；与 `mergeEntry` 终态保护对齐。
- 修复 `appendDeltaEntry` 中 server/tool 用 `||` 短路导致 working_dir 被字面量 "command" 覆盖。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `timeline-event-stream`：明确 command 类事件的 identity 必须区分 source channel；明确 delta 事件应携带序号字段以支持乱序重排与重放去重；明确 authoritative 截断事件不得覆盖更长 delta 文本。
- `timeline-message-actions`：明确 command/tool entry 的 status 一旦进入终态（success/failed）不得被非终态 delta 回退；明确 result/output 取舍在 authoritative 与 delta 之间的一致性要求。

## Impact

- 前端合并引擎：`src/web/state/timeline-engine.ts`（`appendDeltaEntry`、`mergeEntry`、`selectContentCandidate`、`shouldSuppressSnapshotDeltaReplay`）。
- 前端 entry 模型：`src/web/state/timeline.ts`（确认 `timelineItemToEntry` 不产出 `kind:"command"`，清理或保留 command 分支）。
- 服务端 session 合并：`src/server/app-server/session-timeline.ts`（`nestedExecOutputParts`、`applyFunctionOutput`、`nestedExecCommandRecords`、同 callId 多记录回填）。
- 服务端事件转换：`src/server/app-server/events.ts`（`deltaEvent`、`processDeltaEvent` 补充 identity/序号字段）。
- 服务端 overlay：`src/server/app-server/runtime.ts`（`mergeOverlayItems`、`appendTimelineOverlayText`、`command_output_delta` overlay 默认值）。
- 补充单元测试覆盖：终态保护、nestedExec parts 不匹配 fallback、多源 delta 去重、authoritative 截断不覆盖、working_dir 保留。
- 不改变公开 API；不引入新的全量 timeline 读取。

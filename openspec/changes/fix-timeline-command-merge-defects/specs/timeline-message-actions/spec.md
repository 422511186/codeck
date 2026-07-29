# timeline-message-actions Delta

## Modified Requirements

### Requirement: Tool/command entry final status is protected from non-final delta

command 与 tool 类 timeline entry 一旦通过 authoritative 事件进入终态（`success` 或 `failed`），后续非终态 delta（`running`）MUST NOT 回退该状态。所有合并路径（快路径 `appendDeltaEntry`、慢路径 `mergeEntry`、服务端 overlay `mergeOverlayItems`）MUST 对终态保护使用一致规则。

#### Scenario: Late command_output_delta does not regress completed status

- **WHEN** 某 command tool entry 已通过 `item_updated` 到达 `success` 或 `failed` 终态
- **AND** 随后收到迟到的 `command_output_delta`，其 status 为 `running`
- **THEN** 快路径 `appendDeltaEntry` MUST 保留 current 的终态 status
- **AND** MUST NOT 用 `running` 覆盖终态
- **AND** delta 的 result 文本仍 MAY 被追加（若未被 suppression 命中）

#### Scenario: Overlay item_updated with running does not regress success

- **WHEN** overlay 中某 item 已处于 `success` 状态
- **AND** 随后到达的 `item_updated` 事件携带显式 `status: "running"`
- **THEN** `mergeOverlayItems` MUST 保留 current 的 `success` 状态
- **AND** MUST NOT 因 `next.status ?? current.status` 的 `??` 语义而用 `running` 覆盖

#### Scenario: Final status from authoritative event still wins

- **WHEN** current 处于 `running`，next 是 authoritative 事件且携带终态 `success` 或 `failed`
- **THEN** 合并层 MUST 采纳 next 的终态
- **AND** 此行为 MUST 在快路径、慢路径、overlay 三处一致生效

### Requirement: Tool/command result and output text use consistent selection rule

command 与 tool 类 entry 合并时，`result`/`output` 文本的取舍规则 MUST 在 `mergeEntry` 的 command 分支与 tool 分支保持一致。当 `next` 为 authoritative 且未被截断时，next 文本胜出；否则取更长文本（`longerText`）。`appendDeltaEntry` 的快路径 MUST 对 delta 文本做追加拼接，且不得与慢路径的取舍规则冲突。

#### Scenario: command branch uses longerText like tool branch

- **WHEN** `mergeEntry` 合并两个 `kind: "command"` entry
- **AND** next 提供了较短但非空的 output
- **THEN** 合并层 MUST 取 `longerText(current.output, next.output)`
- **AND** MUST NOT 因 `next.body.output || current.body.output` 的 `||` 语义用较短 output 覆盖较长 output

#### Scenario: Delta result appends to current in fast path

- **WHEN** `appendDeltaEntry` 处理 tool/command delta
- **THEN** delta 的 result 文本 MUST 被追加到 current 文本末尾
- **AND** 当 current 已通过 suppression 命中时，delta MUST NOT 被追加

### Requirement: Tool/command server and tool fields preserve authoritative working directory

command 类 entry 的 `server` 字段（表示工作目录）与 `tool` 字段（表示命令文本）MUST 保留 authoritative 来源的真实值，不得被 delta 默认值（字面量 `"command"`）通过 `||` 短路覆盖。

#### Scenario: command_output_delta default server does not overwrite working_dir

- **WHEN** 某 command entry 已通过 `local_shell_call` 的 `item_updated` 设置 `server` 为真实 working_directory
- **AND** 随后收到 `command_output_delta`，其 overlay 默认 `server: "command"`
- **THEN** `appendDeltaEntry` MUST 保留 current 的 working_directory
- **AND** MUST NOT 因 `delta.body.server || current.body.server` 的 `||` 短路而用 "command" 覆盖

#### Scenario: Authoritative server/tool refresh overrides delta default

- **WHEN** current 的 `server` 为字面量 "command"（来自早期 delta 默认值）
- **AND** 随后收到 authoritative `item_updated` 携带真实 working_directory
- **THEN** 合并层 MUST 用 authoritative 的 working_directory 覆盖 current
- **AND** MUST NOT 因 `||` 短路保留字面量 "command"

## New Requirements

### Requirement: Nested exec command output must be applied even when parts count mismatches

服务端 session timeline 重建时，当 `nestedExec` 静态分析识别出 N≥2 条嵌套命令记录，但运行时 `function_call_output` 的 output parts 数量与 N 不一致时，系统 MUST 提供回填 fallback，MUST NOT 静默跳过整组记录。

#### Scenario: Parts more than records merges excess into last record

- **WHEN** `nestedExec` 识别出 2 条记录，但 output parts 数量为 3
- **THEN** 系统 MUST 按位置回填前 2 条记录
- **AND** 多出的第 3 个 part MUST 被合并到最后一条记录的 output

#### Scenario: Parts fewer than records infers status from tail

- **WHEN** `nestedExec` 识别出 3 条记录，但 output parts 数量为 2
- **THEN** 系统 MUST 按位置回填前 2 条记录
- **AND** 第 3 条记录 MUST 用末尾 part 推断状态，或用剥离前的原始 output 推断状态
- **AND** MUST NOT 让第 3 条记录停留在初始 running 状态

#### Scenario: Single nested record with multiple parts joins prudently

- **WHEN** `nestedExec` 识别出 1 条记录，但 output parts 数量为多个
- **THEN** 系统 MUST 用 `parts.join("\n")` 合并为单条 output
- **AND** MUST 在该 output 上推断状态

### Requirement: Nested exec status inference must use original output before header stripping

`nestedExecOutputParts` 剥离 "Script completed/failed/running" 头行后，状态推断 MUST 基于剥离前的原始 output，MUST NOT 基于剥离后可能为空的文本二次推断。

#### Scenario: Script failed header preserves failed status

- **WHEN** 原始 output 仅含 `["Script failed"]` 头行
- **THEN** 剥离后 parts 为空
- **AND** 状态推断 MUST 基于原始 output 返回 `failed`
- **AND** MUST NOT 因 `toolStatusFromOutput("")` 默认返回 `success`

#### Scenario: Script running header preserves running status

- **WHEN** 原始 output 仅含 `["Script running..."]` 头行
- **THEN** 剥离后 parts 为空
- **AND** 状态推断 MUST 基于原始 output 返回 `running`
- **AND** MUST NOT 因 `toolStatusFromOutput("")` 默认返回 `success`

### Requirement: Same callId multiple non-nested records must all receive output

服务端 session timeline 重建时，当同一 `call_id` 下挂了多条非 nested 的 tool 记录，`function_call_output` 的 output MUST NOT 只回填首条记录，其余记录 MUST NOT 停留在初始 running 状态。

#### Scenario: Non-nested multi-record splits output by record order

- **WHEN** 同一 `callId` 下有 2 条非 nested tool 记录
- **AND** 收到该 callId 的 `function_call_output`
- **THEN** 系统 MUST 按记录顺序切分 output 或显式标记其余记录为 orphan
- **AND** MUST NOT 仅回填 `groupedRecords[0]` 而让第 2 条记录永久 running

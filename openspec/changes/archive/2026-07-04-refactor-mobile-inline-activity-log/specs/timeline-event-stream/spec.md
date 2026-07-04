## ADDED Requirements

### Requirement: Runtime activity events are semantically classified
timeline event stream SHALL preserve enough structured semantics for runtime activity rendering. Browser-visible historical items and realtime notifications that represent tool loading, Skill reading, file reads, directory listing, search, command execution, file changes, MCP/dynamic tools, web/image operations, public reasoning, and raw response tool calls MUST be classified so the mobile timeline can render Codex App style inline activity logs.

#### Scenario: Loaded tools activity has runtime scope
- **WHEN** app-server history or live notifications contain a turn-scoped activity representing loaded tools, loaded Skill instruction files, or equivalent runtime tool preparation
- **THEN** browser events or timeline items MUST preserve the `threadId`, `turnId`, stable item identity, loaded count, and known tool or Skill names
- **AND** the mobile timeline MUST be able to render a `Loaded N tools` inline activity log without relying on ownerless cache invalidation events

#### Scenario: Read search command activity keeps action kind
- **WHEN** app-server history or live notifications contain read, list, search, grep, shell, bash, process, MCP or dynamic tool activity
- **THEN** browser-visible events MUST preserve or derive an action kind suitable for `Read files`、`Searched files`、`Ran commands` 或等价摘要
- **AND** full output and low-priority metadata MUST remain available for expanded details when provided

#### Scenario: Unknown runtime activity falls back readably
- **WHEN** app-server emits a newer runtime activity variant not yet fully recognized by the Web adapter
- **THEN** timeline event stream MUST expose a readable fallback with type, name, status and available text
- **AND** the fallback MUST remain eligible for inline activity rendering instead of being silently dropped

### Requirement: Skills cache invalidation is not runtime activity
ownerless Skills change notifications SHALL be treated as cache invalidation, not as visible timeline runtime activity. A Skills-related event MAY become visible only when it has reliable `threadId`/`turnId` ownership and represents work performed during a turn, such as runtime Skill/tool loading or reading.

#### Scenario: Ownerless skills changed event only invalidates cache
- **WHEN** app-server sends `skills/changed` without reliable thread or turn ownership
- **THEN** browser state MUST invalidate the Skills picker cache
- **AND** timeline MUST NOT append `Loaded tools`、`Skills loaded` 或任何 visible activity to the active thread

#### Scenario: Thread scoped runtime skill loading is visible
- **WHEN** app-server sends or history returns a Skills/tool loading event with reliable `threadId` and `turnId`
- **AND** the event represents runtime work performed for that turn
- **THEN** timeline MUST render it as an inline activity log
- **AND** the log MUST include known Skill/tool names or a count

#### Scenario: Ambiguous skills event is conservative
- **WHEN** a Skills-related event contains names but does not prove it belongs to the active turn
- **THEN** browser state MUST treat it as cache invalidation only
- **AND** MUST NOT infer ownership from the currently open page

### Requirement: Inline activity ordering preserves event order
timeline event stream and browser store SHALL preserve the relative order between assistant messages and runtime activity entries within the same turn. Sorting, repair, completion merging, or equivalent-output merging MUST NOT reorder activity entries ahead of assistant messages solely because of role or kind.

#### Scenario: Activity remains between assistant messages
- **WHEN** live events or repaired history arrive in the order assistant A, command activity, assistant B, file change activity, assistant C
- **THEN** browser timeline MUST preserve that order
- **AND** inline activity logs MUST render between the corresponding assistant messages

#### Scenario: Snapshot repair does not bucket activities
- **WHEN** snapshot repair merges main timeline entries with turn item details
- **THEN** repair MUST use the most precise available item order as the skeleton
- **AND** MUST NOT group all tool/diff/reasoning entries before all assistant messages in the same turn

#### Scenario: Equivalent item merge keeps position
- **WHEN** a live delta entry and a later completed item are equivalent
- **THEN** browser store MUST merge them without moving the visible entry across unrelated assistant or activity entries
- **AND** the resulting inline activity log order MUST remain stable

### Requirement: Inline activity event identity is deduplicated
All events that can produce inline activity logs SHALL participate in the same event id, generation, revision, snapshot suppression and equivalent-output deduplication model as agent messages and reasoning. Reconnect, live completion, and snapshot repair MUST NOT duplicate visible inline activity rows or inflate activity counts.

#### Scenario: Duplicate loaded tools event is ignored
- **WHEN** browser receives the same turn-scoped loaded tools event twice due to reconnect or dual channel delivery
- **THEN** timeline MUST render one inline activity log row for that event
- **AND** loaded count and visible detail rows MUST NOT be doubled

#### Scenario: Repair and delayed live activity render once
- **WHEN** snapshot repair inserts a command/read/file activity
- **AND** a delayed live event for the same item arrives later
- **THEN** browser store MUST merge or ignore the delayed event
- **AND** inline activity logs MUST NOT show duplicate command, read or file change rows

#### Scenario: Old generation activity is rejected
- **WHEN** rollback、rewind 或 fork 后 timeline generation 已推进
- **AND** browser receives an inline-activity-producing event from an older generation
- **THEN** browser store MUST ignore that visible activity event
- **AND** timeline MUST NOT reintroduce deleted turn activity

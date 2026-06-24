# config-management Specification

## Purpose
TBD - created by archiving change appserver-spec-as-is. Update Purpose after archive.
## Requirements
### Requirement: Config write key whitelist
系统 SHALL 仅允许写入以下配置键：`model`、`model_reasoning_effort`、`approval_policy`、`sandbox_mode`。其他键 MUST 返回 `"该配置项暂不支持在移动端写入"` 错误。

#### Scenario: Write allowed config key
- **WHEN** 已认证用户 POST `/api/codex/config/value` 提供 `keyPath: "model"` 和 `value`
- **THEN** 校验通过，调用 `gateway.writeConfigValue("model", value)`

#### Scenario: Write disallowed config key
- **WHEN** 已认证用户 POST `/api/codex/config/value` 提供 `keyPath: "some_other_key"`
- **THEN** 返回 HTTP 400 和 `"该配置项暂不支持在移动端写入"`

### Requirement: Config value type validation
系统 SHALL 校验配置值为 JSON 基础类型：`null`、`string`、`number`、`boolean`，或这些类型的数组。

#### Scenario: Valid primitive value
- **WHEN** value 为 `"gpt-5-codex"` 或 `42` 或 `true` 或 `null`
- **THEN** 校验通过

#### Scenario: Valid array value
- **WHEN** value 为 `["a", 1, true, null]`
- **THEN** 校验通过

#### Scenario: Invalid object value
- **WHEN** value 为 `{nested: true}`
- **THEN** 返回 `"value 必须是 JSON 基础值"` 错误

### Requirement: Config write audit
系统 SHALL 在写入配置时记录审计日志，仅记录 `keyPath`，不记录 value 内容。

#### Scenario: Audit on config write
- **WHEN** 配置写入成功
- **THEN** 审计日志记录 `{keyPath: "model"}`

### Requirement: Config batch write
系统 SHALL 支持批量写入多个配置项。每个 edit MUST 通过相同的 keyPath 白名单校验。

#### Scenario: Batch write
- **WHEN** 已认证用户 POST `/api/codex/config/batch` 提供多个 edits
- **THEN** 对每个 edit 调用 `assertConfigEdit` 校验，通过后调用 `gateway.writeConfigBatch()`

### Requirement: Config read
系统 SHALL 支持读取当前配置（通过 `config/read`）。

#### Scenario: Read config
- **WHEN** 已认证用户 GET `/api/codex/config/value`
- **THEN** 调用 app-server 的 `config/read`，返回配置对象

### Requirement: Config requirements read
系统 SHALL 支持读取配置需求（允许的 approval policies、sandbox modes、permission profiles 等）。

#### Scenario: Read config requirements
- **WHEN** 已认证用户 GET `/api/codex/config/requirements`
- **THEN** 调用 `gateway.getConfigRequirements()`，返回需求视图

### Requirement: Settings aggregation
系统 SHALL 在读取 settings 时并行请求 14 个 app-server 方法：config/read、remoteControl/status/read、permissionProfile/list、account/read、getAuthStatus、account/rateLimits/read、mcpServerStatus/list、modelProvider/capabilities/read、collaborationMode/list、skills/list、hooks/list、plugin/list、thread/loaded/list、experimentalFeature/list。如果 remoteControl 有 environmentId，还需请求 remoteControl/client/list。

#### Scenario: Read settings
- **WHEN** 已认证用户 GET `/api/codex/settings`
- **THEN** 并行发起上述请求，聚合为 `MobileSettingsView` 返回

**Open Questions**

1. **batchWrite 是否复用了 assertConfigEdit**：从代码看 `config/batch/route.ts` 调用了 `assertConfigEdit`，但需要确认是否对每个 edit 都做了白名单校验。
2. **Settings 聚合请求失败处理**：14 个并行请求中如果部分失败，`Promise.all` 会导致整个 settings 读取失败。是否需要降级（如部分字段为 null）？
3. **Config 写入无乐观锁**：`writeConfigValue` 传递 `expectedVersion: null`，不做版本冲突检测。并发写入可能导致后写覆盖先写。是否需要版本控制？


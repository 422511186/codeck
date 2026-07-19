## ADDED Requirements

### Requirement: Catalog-backed reasoning capabilities

会话模型状态 SHALL 使用统一模型目录中与当前来源身份匹配的完整 `supportedReasoningEfforts` 和 `defaultReasoningEffort`。当前选中的 reasoning 值 MUST 只用于标记选中项；系统 MUST NOT 将当前值单独构造成支持列表。

#### Scenario: Empty thread uses complete app-server capabilities

- **WHEN** 新会话尚无 rollout，thread 元数据只有当前 model/reasoning 或 modelState 尚未生成
- **THEN** 会话状态 MUST 从统一 app-server 模型目录补齐该模型的完整 reasoning 能力
- **AND** `gpt-5.6-sol` 的选择器 MUST 显示目录返回的 `low`、`medium`、`high`、`xhigh`、`max` 和 `ultra`

#### Scenario: Custom binding capabilities remain authoritative

- **WHEN** 当前选择来源为 custom
- **THEN** 推理强度列表 MUST 使用 binding 快照的能力声明
- **AND** 同名 app-server 模型的能力 MUST NOT 覆盖 custom binding

#### Scenario: Unknown current model does not invent efforts

- **WHEN** 当前 model 不在 app-server 目录且没有 custom binding
- **THEN** 系统 MUST 保留原始当前 reasoning 作为选中值（若存在）
- **AND** 系统 MUST NOT 猜测或补全目录外的标准 effort

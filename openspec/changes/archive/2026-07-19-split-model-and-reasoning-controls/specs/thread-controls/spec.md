## MODIFIED Requirements

### Requirement: 模型切换粒度

模型 SHALL 有全局默认值（设置页可改）；每个会话 MUST 在 composer 底部提供独立的模型 chip 和推理强度 chip。模型 chip 只负责模型切换，推理强度 chip 只负责当前模型的 effort 调整；模型切换器列表 SHALL 每次打开时调用 `GET /api/codex/models` 拉取。

#### Scenario: 全局默认
- **WHEN** 用户在设置页设置全局默认模型
- **THEN** 之后新建的会话 MUST 默认使用该模型

#### Scenario: 会话内切换模型
- **WHEN** 用户点击 composer 中的模型 chip
- **THEN** 系统 MUST 调用模型目录接口拉取最新列表
- **AND** 用户选定模型后 MUST 使用现有模型切换流程持久化
- **AND** 模型 chip MUST 更新显示当前模型

#### Scenario: 会话内调整推理强度
- **WHEN** 用户点击 composer 中的推理强度 chip 并选择一个档位
- **THEN** 系统 MUST 只提交 reasoning effort 更新
- **AND** MUST NOT 触发模型切换
- **AND** 推理强度 chip MUST 更新显示新档位

#### Scenario: Header does not duplicate model picker
- **WHEN** 会话页渲染空闲态 composer
- **THEN** 模型 chip 和推理强度 chip MUST 在 composer 底部工具栏可见
- **AND** 会话头部 MUST 不重复显示模型选择按钮

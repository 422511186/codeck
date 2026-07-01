## ADDED Requirements

### Requirement: Skill reference picker
会话页底部 composer SHALL 提供 skill 引用入口。用户可在不记忆 skill 名称的情况下从已启用 skill 列表中选择一个或多个 skill；已选择 skill MUST 以 chip 形式显示在 composer 上方，并可单独移除。skill 引用 MUST 作为本次 turn 的结构化输入发送，不得通过拼接自然语言提示词模拟。

#### Scenario: Open skill picker
- **WHEN** thread 静止且底部 composer 渲染
- **THEN** composer MUST 显示 skill 引用入口
- **AND** 用户点击后 MUST 从屏幕底部打开移动端选择器
- **AND** 同一次打开过程 MUST 复用进行中的 skill 列表请求，不得因为 sheet 挂载或重复点击发起重复请求

#### Scenario: Search and select skill
- **WHEN** skill 选择器打开
- **THEN** 系统 MUST 按当前会话 `cwd` 拉取已启用 skill 列表
- **AND** 用户 MUST 能按 skill 名称、短描述或描述搜索
- **AND** 用户选择某个 skill 后，该 skill MUST 显示为 composer 上方的 chip

#### Scenario: Remove selected skill
- **WHEN** composer 已选择一个 skill
- **AND** 用户点击该 skill chip 的移除操作
- **THEN** 系统 MUST 从本次待发送输入中移除该 skill

#### Scenario: Send with selected skills
- **WHEN** 用户输入非空文本并选择一个或多个 skill
- **AND** 用户点击发送
- **THEN** 标准发送流程 MUST 携带这些 skill 引用
- **AND** 成功发送后 MUST 清空本次已选 skill
- **AND** MUST 清空输入框和对应草稿

#### Scenario: Skill list load failure
- **WHEN** skill 选择器拉取列表失败
- **THEN** 选择器 MUST 显示错误状态和重试入口
- **AND** 普通文本和图片发送 MUST 继续可用

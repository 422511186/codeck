## MODIFIED Requirements

### Requirement: Chat Skill 引用在 timeline 中保持可回放
通过聊天输入区选择的 Skill 引用 SHALL 作为结构化输入发送，并在后续 timeline 展示、历史分页、刷新修复中保持可识别。系统 SHALL 使用 Skill `name/path` 作为稳定身份，使用由 `name` 派生的可读名称展示。结构化引用是权威来源；仅当结构化引用为空时，系统 SHALL 严格恢复历史正文中独占整行且指向绝对 `SKILL.md` 路径的兼容引用。发送失败后的重试 SHALL 保留原用户消息中的 Skill 引用。

#### Scenario: 发送结构化 Skill 引用
- **WHEN** 用户通过聊天输入区选择 Skill 后发送消息
- **THEN** start turn 请求 MUST 包含对应 Skill 的 `name` 和 `path`
- **AND** 用户消息 timeline item MUST 保留该 Skill 引用
- **AND** picker MUST 不把 Skill 引用插入正文行

#### Scenario: 历史结构化消息恢复 Skill 引用
- **WHEN** 页面从服务端历史或 snapshot 中读取包含 `type: "skill"` 的用户消息内容
- **THEN** 系统 MUST 将其转换为结构化 Skill 引用
- **AND** MUST 不把该内容转换成 `[skill]` 文本

#### Scenario: 从隐藏 rollout Skill 输入恢复
- **WHEN** Codex 历史接口返回的可见用户消息没有结构化 Skill 引用
- **AND** 受限 rollout 中同 turn、紧随该可见用户输入之后存在严格 `<skill>` 包，包含非空名称和指向绝对 `SKILL.md` 的路径
- **THEN** 服务端历史投影 MUST 将 `name/path` 恢复到对应用户 timeline item
- **AND** thread detail、历史分页和刷新修复 MUST 返回一致的 Skill 引用
- **AND** 完整 Skill 正文 MUST 不进入 timeline supplement 或 Web API

#### Scenario: 隐藏 rollout Skill 输入保守绑定
- **WHEN** `<skill>` 包缺少合法头部、使用非绝对路径、无法找到唯一相邻用户锚点或与已有用户项匹配存在歧义
- **THEN** 系统 MUST 不创建 Skill 引用
- **AND** MUST 不把隐藏 Skill 正文显示为用户消息

#### Scenario: 历史兼容引用恢复
- **WHEN** 用户消息没有结构化 Skill 引用
- **AND** fenced code 外某一整行完整匹配带名称与绝对 `SKILL.md` 路径的 Skill Markdown 引用
- **THEN** 系统 MUST 将该行恢复为结构化 Skill 引用并从正文移除
- **AND** MUST 使用 `name/path` 保持稳定身份

#### Scenario: 类似文本保持正文
- **WHEN** Skill 形式的 Markdown 出现在正文句子、引用块、代码块、普通链接或不完整路径中
- **THEN** 系统 MUST 保留原始 Markdown 正文
- **AND** MUST 不创建 Skill 引用

#### Scenario: 结构化引用保持权威
- **WHEN** 用户消息已经包含至少一个结构化 Skill 引用
- **THEN** 系统 MUST 使用结构化引用
- **AND** MUST 不再从正文猜测或合并兼容 Skill 引用

#### Scenario: 多个 Skill 引用
- **WHEN** 一条用户消息包含多个结构化或可恢复的 Skill 引用
- **THEN** timeline MUST 展示每个 Skill 的可读名称
- **AND** 每个 Skill MUST 使用其原始 `name/path` 组合稳定去重

#### Scenario: 失败消息重试保留 Skill 引用
- **WHEN** 包含 Skill 引用的用户消息发送失败
- **AND** 用户从失败消息触发重试
- **THEN** 重试请求 MUST 继续携带原消息的 Skill 引用
- **AND** timeline 中的新用户消息 MUST 继续展示这些 Skill 胶囊

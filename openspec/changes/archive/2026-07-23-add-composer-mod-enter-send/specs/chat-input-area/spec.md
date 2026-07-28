## MODIFIED Requirements

### Requirement: 普通输入框回车不发送
会话页底部普通输入框 SHALL NOT 使用单独的 `Enter` 触发标准发送流程；单独 `Enter` MUST 保持文本输入换行行为。系统 MAY 在可发送状态下使用 `Meta+Enter`（macOS Command）或 `Ctrl+Enter` 触发与发送按钮相同的标准发送流程。IME 组字过程中的 `Enter` 与修饰键 `Enter` MUST NOT 触发发送。

#### Scenario: 普通输入框回车不发送
- **WHEN** thread 静止且普通输入框包含可发送文本
- **AND** 用户在普通输入框按下单独的 `Enter`
- **THEN** 系统 MUST NOT 触发标准发送流程
- **AND** MUST NOT 清空输入框或对应草稿
- **AND** MUST NOT 阻止输入框的默认回车换行行为

#### Scenario: 普通输入框不可发送时按回车
- **WHEN** 普通输入框为空白、图片正在上传、仅有图片无文本或 thread 正在运行
- **AND** 用户按下单独的 `Enter`
- **THEN** 系统 MUST NOT 触发发送
- **AND** MUST 保持现有内容和控件状态

#### Scenario: 普通输入框发送按钮发送
- **WHEN** thread 静止且普通输入框包含可发送文本
- **AND** 用户点击底部 composer 的“发送”按钮
- **THEN** 系统 MUST 触发标准发送流程
- **AND** 成功发送后 MUST 清空输入框和对应草稿

## ADDED Requirements

### Requirement: Composer modifier-enter sends message
底部 composer 在可发送状态下 SHALL 支持 `Meta+Enter` 与 `Ctrl+Enter` 触发标准发送流程。该快捷键 MUST 复用发送按钮的可发送条件与提交流程，MUST NOT 在 running、上传中、空文本或被兼容性阻断时绕过限制。

#### Scenario: Cmd+Enter sends on macOS-style keyboard
- **WHEN** thread 静止且普通输入框包含可发送文本
- **AND** 用户按下 `Meta+Enter`
- **THEN** 系统 MUST 触发标准发送流程
- **AND** 成功发送后 MUST 清空输入框和对应草稿

#### Scenario: Ctrl+Enter sends on non-mac keyboard
- **WHEN** thread 静止且普通输入框包含可发送文本
- **AND** 用户按下 `Ctrl+Enter`
- **THEN** 系统 MUST 触发标准发送流程
- **AND** 成功发送后 MUST 清空输入框和对应草稿

#### Scenario: Modifier-enter respects send guards
- **WHEN** 输入框为空、附件仍在上传、存在发送阻断原因或 thread 正在运行
- **AND** 用户按下 `Meta+Enter` 或 `Ctrl+Enter`
- **THEN** 系统 MUST NOT 触发标准发送流程
- **AND** MUST 保持现有草稿与附件状态

### Requirement: Composer enter ignores IME composition
composer 在 IME 组字期间 SHALL 忽略所有基于 `Enter` 的发送意图。无论是否带有 `Meta` 或 `Ctrl` 修饰键，组字中的 `Enter` MUST 只服务输入法上屏或默认输入行为，MUST NOT 触发标准发送流程。

#### Scenario: Enter during IME composition does not send
- **WHEN** 用户正在中文或其他 IME 组字
- **AND** 输入框触发带有 composing 状态的 `Enter`
- **THEN** 系统 MUST NOT 触发标准发送流程
- **AND** MUST 允许输入法完成上屏或默认组字行为

#### Scenario: Modifier-enter during IME composition does not send
- **WHEN** 用户正在 IME 组字
- **AND** 输入框触发 composing 状态的 `Meta+Enter` 或 `Ctrl+Enter`
- **THEN** 系统 MUST NOT 触发标准发送流程

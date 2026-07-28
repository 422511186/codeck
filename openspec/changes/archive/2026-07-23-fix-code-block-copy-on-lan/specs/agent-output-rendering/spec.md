## ADDED Requirements

### Requirement: Code block copy works outside secure contexts
Markdown 代码块复制 SHALL 在 secure context 与非 secure context（如局域网 HTTP）下都可用。系统 MUST 优先使用 Clipboard API，并在其不可用或失败时回退到兼容复制路径；无论成功或失败，复制按钮 MUST 给出可见反馈，MUST NOT 静默失败。

#### Scenario: Clipboard API unavailable on LAN HTTP
- **WHEN** 页面运行在非 secure context 且 `navigator.clipboard.writeText` 不可用
- **AND** 用户点击代码块复制按钮
- **THEN** 系统 MUST 通过兼容回退路径尝试复制完整代码原文
- **AND** 成功时按钮 MUST 显示复制成功状态

#### Scenario: Copy failure is visible
- **WHEN** 用户点击代码块复制按钮
- **AND** Clipboard API 与兼容回退路径都失败
- **THEN** 按钮 MUST 显示复制失败状态
- **AND** MUST NOT 假装复制成功

### Requirement: Code block copy control does not cover code text
Markdown 代码块的复制控件 SHALL 以独立工具栏或同等非覆盖布局呈现，MUST NOT 以浮层方式遮挡代码正文。用户在默认窄屏宽度下阅读代码时，首行与后续正文 MUST 保持完整可见。

#### Scenario: Copy button stays outside code content
- **WHEN** agent 消息渲染包含 fenced code block
- **THEN** 复制按钮 MUST 位于代码正文之外的独立区域
- **AND** 代码正文区域 MUST NOT 被复制按钮覆盖

#### Scenario: Narrow mobile width keeps first line readable
- **WHEN** 用户在移动端宽度查看较短代码块
- **THEN** 代码首行文本 MUST 完整可读
- **AND** MUST NOT 因为复制按钮占位而被裁切或遮挡

## MODIFIED Requirements

### Requirement: Markdown code copy button remains visible
Markdown 代码块的复制按钮 SHALL 在明亮主题和暗黑主题下都清晰可见、可点击，并使用当前主题 token 表达默认状态、复制成功状态和复制失败状态。复制按钮 MUST 与代码正文分区布局，不得依赖覆盖在代码右上角的 absolute 浮层作为唯一布局。

#### Scenario: Light theme code copy button
- **WHEN** 用户在明亮主题下查看代码块
- **THEN** 复制按钮 MUST 与代码块背景有足够视觉区分

#### Scenario: Dark theme code copy button
- **WHEN** 用户在暗黑主题下查看代码块
- **THEN** 复制按钮 MUST 与代码块背景有足够视觉区分

#### Scenario: Copy success state
- **WHEN** 用户点击代码块复制按钮且复制成功
- **THEN** 按钮 MUST 显示复制成功状态

#### Scenario: Copy failure state
- **WHEN** 用户点击代码块复制按钮且复制失败
- **THEN** 按钮 MUST 显示复制失败状态

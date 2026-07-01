## Why

当前聊天输入区无法选择或引用 Codex skill，用户必须记住 skill 名称并手动输入，移动端使用成本高且容易输错。app-server 协议已经支持结构化 `UserInput.skill`，本变更把前端引用体验接到官方结构化输入，而不是把 skill 名称伪装成普通提示词。

## What Changes

- 在会话聊天输入区新增移动端友好的 skill 引用入口，用户可搜索并选择已启用 skill。
- 新增轻量 skill 列表 API，避免聊天页为了选择 skill 拉取完整 settings 聚合。
- skill 选择器按当前会话 `cwd` 拉取列表，保证项目内 repo-scoped skills 可见。
- `MobileSkillView` 暴露 skill `path`，用于构造 app-server 需要的 `{type: "skill", name, path}` 输入。
- `turn/start` 和 gateway 输入链路支持随用户文本、图片一起发送结构化 skill 引用。
- 输入区以 chip 形式展示已选择 skill，成功发送后清空本次 skill 引用；草稿文本仍按现有规则保存。

## Capabilities

### New Capabilities

### Modified Capabilities

- `chat-input-area`: 聊天输入区新增 skill 引用选择器和已选引用展示。
- `turn-interaction`: 用户输入构造支持 app-server 官方 `UserInput.skill` 元素。
- `plugin-mcp-skills`: skill 列表能力暴露 path，并提供聊天输入区使用的轻量列表接口。

## Impact

- 影响前端聊天输入组件、会话发送参数、Web API client 类型。
- 影响 `/api/codex/turns/start` 请求体、server gateway 的 `StartTurnInput` 和 `createTurnUserInput`。
- 影响 skill 视图类型、settings 聚合映射和新增轻量 skill route。
- 需要补充 ChatInput、turn input construction、turn start route/client 相关单元测试。

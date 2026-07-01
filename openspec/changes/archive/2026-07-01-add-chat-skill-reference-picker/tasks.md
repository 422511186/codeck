## 1. 后端协议与 API

- [x] 1.1 扩展 `MobileSkillView`、skill 映射和 gateway，暴露 skill `path` 并提供轻量 `listSkills({enabledOnly})`。
- [x] 1.2 新增 `GET /api/codex/skills`，返回聊天选择器需要的 skills 和 skillErrors。
- [x] 1.3 扩展 `StartTurnInput`、`/api/codex/turns/start` 和 `createTurnUserInput()`，按 `UserInput.skill` 传递 `{name,path}`。

## 2. 前端聊天输入 UI

- [x] 2.1 为 Web API client 增加 skill 类型、列表方法和 startTurn 的 skillReferences 参数。
- [x] 2.2 在 `ChatInput` 增加 skill 图标入口、底部半屏选择器、搜索、加载失败重试和已选 chip。
- [x] 2.3 将已选 skill 传入会话页 `onSend`，成功发送后清空，失败时保留以便重试。

## 3. 测试与验证

- [x] 3.1 补充 `createTurnUserInput` 和 turn start route 单元测试，覆盖结构化 skill 引用和空引用拒绝。
- [x] 3.2 补充 `ChatInput` 单元测试，覆盖打开选择器、搜索选择、移除和发送携带 skill。
- [x] 3.3 运行相关单元测试、typecheck 和 OpenSpec 校验。

## 4. Review 修复

- [x] 4.1 `skills/list` 支持传入当前会话 `cwd`，聊天选择器按项目范围列出 repo-scoped skills。
- [x] 4.2 `turn/start` 的 skill allow-list 使用当前 thread `cwd` 校验 `{name,path}`。
- [x] 4.3 将 skill 列表加载移动到点击入口并复用进行中的请求，避免同一次打开触发重复请求。

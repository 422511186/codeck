## Context

移动端聊天输入区目前只支持文本和单张图片。后端 app-server 的 generated protocol 已经定义 `UserInput` 可包含 `{type: "skill", name, path}`，但本项目的 `createTurnUserInput()` 只生成 `text` 和 `localImage`。因此用户即使知道 skill 名称，也只能把它作为普通文本输入，无法让 Web 端按 app-server 官方结构表达 skill 引用。

现有 `settings-minimal` 要求设置页不暴露插件、MCP、skill 管理入口。本变更不改变设置页，只在聊天输入区提供“引用已启用 skill”的轻量选择能力；启用/禁用、extra roots 和插件管理仍保持在后端 API 或未来高级设置能力内。

## Goals / Non-Goals

**Goals:**

- 聊天输入区可打开移动端底部选择器，搜索并选择已启用 skill。
- 已选择 skill 在 composer 上方显示为可移除 chip，用户无需记忆完整名称。
- 发送 turn 时通过 app-server 官方 `UserInput.skill` 结构注入 skill 引用。
- 使用轻量 skill 列表 API，避免聊天页依赖完整 settings 聚合。
- 成功发送后清空本次 skill 引用，不影响已有草稿文本持久化。

**Non-Goals:**

- 不在设置页新增 skill、MCP 或插件管理入口。
- 不实现 skill 启用/禁用、extra roots 编辑或插件安装流程。
- 不改变 Codex CLI/agent 对 skill 内容的读取策略，只正确传递结构化引用。
- 不把 skill 内容、`SKILL.md` 全文或自然语言前缀拼进用户文本。

## Decisions

1. 使用结构化 `UserInput.skill`，不拼接提示词。

   `UserInput` 协议已经包含 `type: "skill"`，且字段要求 `name` 和 `path`。Web 发送链路应扩展 `StartTurnInput`，把 selected skills 传到 server，再由 `createTurnUserInput(text, imagePaths, skills)` 生成 `[text, skill..., localImage...]`。这样 timeline 和 app-server 都能区分真实文本和引用元素。

2. `MobileSkillView` 暴露 `path`。

   当前 mobile skill 视图只有 `cwd/name/description/shortDescription/scope/enabled`，无法构造 `UserInput.skill`。服务端映射应把 `SkillMetadata.path` 作为字符串暴露给前端。前端选择器只发送从后端返回的 `{name, path}`，不接受用户手写 path。

3. 新增轻量 `/api/codex/skills`。

   `/api/codex/settings` 聚合会并行读取账号、MCP、插件、remote control 等数据，聊天页只需要 skill 列表。新增 GET route 调用 gateway 的轻量 skill list 方法，默认只返回 enabled skills，可用查询参数控制是否包含禁用项。聊天页打开选择器时传入当前会话 `cwd`，route 使用 app-server `skills/list` 的 `cwds` 参数列出该项目可见的 user/repo skills；未传 `cwd` 时保留 app-server 默认行为。settings 聚合继续保留已有数据。

4. UI 采用底部半屏选择器和 composer chip。

   移动端不适合桌面式下拉 autocomplete。composer 左侧新增 skill 图标按钮，点击后从底部弹出约半屏高度的 sheet，顶部为搜索输入，下面是 skill 列表；列表项显示名称、短描述/描述和 scope。选择后关闭或保持可继续选择均可，但已选项必须清楚显示并可移除。skill 列表加载由点击入口触发并复用同一个进行中的请求，sheet 挂载本身不发起请求，避免开发模式或重复点击造成同一次打开发送多次列表请求。

5. 发送后清空 skill 引用。

   skill 引用是本次 turn 的输入上下文，不应像文本草稿一样跨会话持久化。发送失败时保留已选 skill，方便用户重试。

## Risks / Trade-offs

- 轻量 skills route 与 settings 聚合存在数据映射重复 → 复用同一个 gateway list 方法和 `skillViews()` 映射，避免两份逻辑分叉。
- skill path 暴露到前端 → 这是 app-server `UserInput.skill` 的必需字段；route 只返回已认证用户可见的 app-server skill 元数据，不读取 skill 内容。
- 选择器加载失败导致用户无法引用 skill → UI 显示失败态和重试入口，但不阻塞普通文本发送。
- 用户选择已禁用 skill 的竞态 → 默认列表过滤 enabled；发送时基于当前会话 `cwd` 的 enabled skill 列表校验 `{name,path}`，app-server 仍是最终权威。

## Migration Plan

- 后端新增字段和 route 均为向后兼容；现有 startTurn 调用不传 skills 时保持原行为。
- 若前端回滚，新增后端能力不影响既有聊天流程。
- 若后端回滚，前端应在 API 失败时只隐藏/报错 skill 选择器，普通发送仍可用。

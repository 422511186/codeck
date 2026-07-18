## Why

Codex App 能展示会话 Markdown 中引用的本机图片和语义化 Skill 引用，而 Codex Web 目前会把绝对图片路径直接交给浏览器导致破图，并把部分历史 Skill 引用显示为原始 Markdown 路径。两者都会让同一真实会话在 Web 端丢失关键信息或暴露不适合展示的实现细节。

## What Changes

- 让 agent Markdown 中受支持的 macOS、Linux 和 Windows 绝对图片路径复用现有受控图片预览 API，并保留网络 URL、`data:`、`blob:` 与现有 API URL 的原有行为。
- 为 Markdown 图片提供稳定的正文布局、加载失败占位、重试与全屏预览，避免浏览器原生破图和绝对路径泄露。
- 将用户主动选择的 Skill 引用展示为同一用户消息气泡内的只读语义上下文行，提供可读名称、语义图标和多项换行，不显示本机路径。
- 优先使用结构化 `skillReferences`；仅对完整占据一整行且指向绝对 `SKILL.md` 路径的历史 Markdown 引用做兼容恢复，保留普通链接、代码、引用块和正文中的类似文本。
- 当 Codex 历史接口遗漏结构化 Skill、但 rollout 保留同 turn 的隐藏 `<skill>` 输入时，在服务端历史投影层严格恢复 `name/path`，不返回或展示完整 Skill 正文。
- 当用户消息仅包含 Skill 引用时仍渲染一个正常用户消息气泡；同时包含正文时，Skill 上下文与正文组合在同一气泡内，避免视觉上被误解为两条消息。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `agent-output-rendering`: agent Markdown 中的受支持本机图片引用必须通过安全预览链路展示，并提供稳定失败与全屏预览交互。
- `thread-chat-view`: 用户消息中的 Skill 引用必须在同一用户消息气泡内使用只读语义上下文展示，且不得拆成视觉消息或暴露绝对路径。
- `plugin-mcp-skills`: Skill 引用回放必须结构化优先，并能严格恢复历史消息中独占整行的兼容引用格式。
- `audit-and-security`: 图片预览读取必须在词法白名单之外校验真实文件路径，拒绝通过符号链接逃逸允许目录。

## Impact

- 影响 Markdown 渲染组件、图片预览组件复用边界、timeline 用户消息归一化、rollout 历史补全与展示组件。
- 复用现有 `/api/codex/images/preview`、工作区根目录白名单、图片类型校验与认证，不新增任意文件读取入口。
- 强化图片预览读取的真实路径校验与响应嗅探防护。
- 补充 Markdown、timeline 转换和用户消息组件测试，并在桌面与 390px 手机视口使用真实会话验收。

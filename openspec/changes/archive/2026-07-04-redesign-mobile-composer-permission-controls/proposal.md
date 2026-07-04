## Why

当前移动端会话输入区把图片、Skill、半屏编辑和发送动作铺在同一行，随着权限模式、模型/思考档位等发送前状态进入界面，底部区域会变得拥挤且难以扫读。需要把 composer 重构为更适合手机浏览器的两层输入台，让用户在发送前能清楚看到本次请求携带的内容、权限模式和模型状态。

同时，移动端还缺少可见的权限模式切换入口。Codex app-server 已支持 named permission profile，但 Web 端尚未把它转化为用户可理解、可切换、可恢复到 `config.toml` 默认的移动端控件。

## What Changes

- 将会话底部空闲态 composer 重构为移动端两层卡片：上层为自动增高文本输入区，下层为工具栏。
- 移除半屏编辑器入口；文本框随内容自动增高，并在达到最大高度后改为内部滚动。
- 将图片和 Skill 一级按钮收进左下角 `+` 添加面板；添加面板浮在输入框上方，优先展示「图片」「引用 Skill」，并为目标、计划模式、插件等后续入口预留一致布局。
- 已选图片缩略图和 Skill chip 显示在 composer 内部、文本区下方、底部工具栏上方。
- 将权限模式 chip 常驻在 composer 底部工具栏，点击后打开权限模式选择面板。
- 将模型/思考档位 chip 常驻在 composer 底部工具栏，作为发送前状态展示与选择入口。
- 支持按会话选择权限 profile，并支持「自定义 config.toml」语义以清除会话级权限 override。
- 调整会话头部职责，避免头部和 composer 重复承载模型选择；头部继续保持会话导航和 Plan/Build 等会话级入口。

## Capabilities

### New Capabilities

- `permission-mode-controls`: 移动端权限模式展示、选择、持久化和回退到 `config.toml` 默认权限的行为。

### Modified Capabilities

- `chat-input-area`: 底部 composer 结构、添加面板、自动增高输入、图片与 Skill 入口位置、发送前状态展示发生变化。
- `thread-controls`: 会话头部与 composer 的控制职责重新分配，模型选择从头部移到 composer 底部工具栏，权限模式成为会话内发送前控制。
- `thread-chat-view`: 会话聊天页整体布局中的头部固定元素与 Plan/Build 语义需要同步，避免继续把模型选择和权限语义绑在头部。

## Impact

- 前端组件：`src/web/components/ChatInput.tsx`、`src/app/threads/[threadId]/page.tsx` 及相关样式常量。
- 前端状态与存储：需要保存每会话权限模式，并扩展全局 Web settings 中必要的默认值或读取逻辑。
- 前端 API 类型：`permissions` 需要支持 `string | null`，以表达清除会话级权限 override。
- 后端路由与 gateway：`POST /api/codex/threads/:threadId/settings`、`POST /api/codex/turns/start`、`POST /api/codex/threads/start` 的权限字段需要保持与 app-server 的 named permission profile 语义一致。
- 测试：需要覆盖 composer 自动增高、`+` 添加面板、图片/Skill 选择、权限模式切换、模型选择入口迁移、发送参数和运行态切换。

## 1. 测试基线与类型建模

- [ ] 1.1 梳理现有 `ChatInput`、`ThreadPage`、API route 和 app-server gateway 测试，确认需要更新的断言范围。
- [ ] 1.2 为 `permissions` 相关前后端类型补充测试用例，覆盖 `string` profile id 和 `null` 清除 override。
- [ ] 1.3 为 `MobileThreadDetail` / thread settings 读取路径补充 active permission profile 映射测试。

## 2. 权限模式数据流

- [ ] 2.1 扩展 shared/frontend/server 类型，使 `permissions` 支持 `string | null` 并能表达「自定义 config.toml」。
- [ ] 2.2 在 app-server client/gateway 映射中透出 `activePermissionProfile`，并在 mock runtime 中提供可测试数据。
- [ ] 2.3 在前端 API client 中提供读取权限 profile 列表或复用 settings 聚合的能力。
- [ ] 2.4 在 thread state/localStorage 中加入每会话权限模式状态，并实现以后端 active profile 优先、本地状态兜底的合并逻辑。
- [ ] 2.5 实现权限模式切换时调用 `POST /api/codex/threads/:threadId/settings`，并同步下一次 `turn/start` 的权限参数。

## 3. Composer 结构重构

- [ ] 3.1 将 `ChatInput` 空闲态重构为两层 composer 卡片：自动增高文本区、已选上下文区、底部工具栏。
- [ ] 3.2 移除半屏编辑器入口和半屏编辑器组件路径，保留 Enter 换行、不触发发送的行为。
- [ ] 3.3 实现 textarea 自动增高和最大高度内部滚动，确保底部工具栏固定可见。
- [ ] 3.4 将已选图片缩略图和 Skill chip 移入 composer 内部的文本区与工具栏之间。
- [ ] 3.5 保持运行态中断栏逻辑，运行时隐藏普通输入、`+`、权限 chip、模型 chip 和发送按钮。

## 4. `+` 添加面板

- [ ] 4.1 新增 `+` 添加入口，点击后在 composer 上方打开移动端添加面板。
- [ ] 4.2 将图片入口移入添加面板，继续复用现有单图相册选择、上传、替换、重试和移除流程。
- [ ] 4.3 将 Skill 入口移入添加面板，点击后关闭添加面板并打开现有 Skill 选择器。
- [ ] 4.4 为添加面板设置手机宽度、最大高度、内部滚动和点击外部关闭行为。
- [ ] 4.5 在添加面板中保留后续扩展入口的视觉结构，但不实现未纳入本次范围的文件、目标、计划模式和插件功能。

## 5. 权限与模型控制 UI

- [ ] 5.1 在 composer 底部工具栏渲染权限模式 chip，并实现常见 profile 的中文标签和未知 profile 回退显示。
- [ ] 5.2 实现权限模式选择面板，包含 app-server profiles 和「自定义 config.toml」选项。
- [ ] 5.3 在 composer 底部工具栏渲染模型/思考档位 chip，并复用现有模型选择器与 reasoning effort 更新逻辑。
- [ ] 5.4 从会话头部移除模型按钮，保留返回、会话名、Plan/Build 和 `⋮` 菜单。
- [ ] 5.5 确保 Plan/Build 只更新 collaboration mode，不写入 named permission profile。

## 6. 单元测试与交互回归

- [ ] 6.1 更新 `tests/unit/web-chat-input.test.tsx`，覆盖两层 composer、自动增高、`+` 添加面板、图片入口迁移、Skill 入口迁移和运行态中断栏。
- [ ] 6.2 更新 `tests/unit/web-thread-page.test.tsx`，覆盖权限切换、`permissions: null`、模型 chip 迁移、头部不显示模型按钮、发送参数和 Plan/Build 语义。
- [ ] 6.3 更新 API/gateway 相关测试，覆盖 `thread/settings/update`、`turn/start`、`thread/start` 对 `permissions` profile id 和 `null` 的传递。
- [ ] 6.4 更新 store/event 测试，覆盖 active permission profile 后端优先和本地状态兜底。
- [ ] 6.5 运行相关 unit tests，修复因 UI 文案和入口位置变化导致的旧断言。

## 7. 移动端验证与收尾

- [ ] 7.1 运行 `npm run typecheck`。
- [ ] 7.2 运行 `npm run test` 或变更相关的 Vitest 子集后再补全全量测试。
- [ ] 7.3 使用手机尺寸视口验证 composer 空闲态、输入自动增高、添加面板、图片缩略图、Skill chip、权限面板、模型选择、运行态中断和 safe-area。
- [ ] 7.4 检查中文文案、按钮尺寸、chip 溢出、键盘弹出时的滚动行为和底部遮挡。
- [ ] 7.5 更新必要的中文文档或测试说明，避免保留半屏编辑器和头部模型按钮的旧描述。

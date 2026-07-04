## Context

当前移动端会话页的底部 composer 由 `ChatInput` 承载，已有文本草稿、单张图片上传、Skill 引用、半屏编辑器、发送与中断状态。会话页 `ThreadPage` 负责模型选择、Plan/Build 切换、发送参数组装和 `thread/settings/update` 的同步。

app-server 协议已经支持 named permission profile：`thread/start`、`turn/start`、`thread/settings/update` 都有 `permissions` 字段，`permissionProfile/list` 可列出 profile，`ThreadStartResponse` / `ThreadResumeResponse` 也有 `activePermissionProfile` 用于表达当前权限来源。当前 Web 端尚未把这些能力映射为移动端可见控件。

本项目只做移动端 Web；设计和测试默认以手机浏览器为目标。此次变更不引入电脑端布局，不做桌面宽屏优化。

## Goals / Non-Goals

**Goals:**

- 将空闲态 composer 改为移动端两层输入卡片：自动增高文本区 + 固定底部工具栏。
- 用 `+` 添加面板承载图片和 Skill 入口，并为后续「目标」「计划模式」「插件」「文件和聊天」类入口保留视觉结构。
- 去掉半屏编辑器，让普通输入框负责多行编辑；达到最大高度后内部滚动。
- 在 composer 底部常驻展示权限模式 chip 和模型/思考档位 chip。
- 支持按会话选择 permission profile，并支持选择「自定义 config.toml」清除会话级权限 override。
- 让发送、线程设置更新、新建会话和恢复会话都使用同一套权限状态语义。

**Non-Goals:**

- 不新增桌面端布局。
- 不实现真实文件/文件夹选择、远程文件、文件和聊天搜索、目标管理或插件市场入口；这些只作为添加面板的后续扩展位。
- 不新增设置页里的全局默认权限选择器；新会话默认权限继续来自 app-server 的 `defaultPermissions` / `config.toml`。
- 不改变 app-server permission profile 的协议定义，不在前端手工拼 `approval_policy` 和 `sandbox_mode`。
- 不允许仅图片无文本发送，保持现有发送规则。

## Decisions

1. **Composer 使用两层卡片，而不是继续一行工具栏。**

   选择：底部空闲态 composer 由一个圆角卡片组成，上半部分是自动增高 `textarea`，下半部分是固定工具栏；已选图片和 Skill chip 放在两者之间。

   理由：权限、模型、附件都属于发送前状态，手机上需要一眼扫到；单行工具栏无法继续承载这些信息。两层结构可以让文本输入和发送配置分区明确。

   备选：继续保留当前一行输入。该方案改动少，但权限 chip、模型 chip、图片和 Skill 会挤在同一行，移动端误触风险高。

2. **`+` 打开添加面板，而不是小气泡菜单或底部全屏 sheet。**

   选择：点击左下角 `+` 后，在 composer 上方弹出同宽或近似同宽的添加面板，面板最高约 `50dvh`，内容过多时内部滚动。

   理由：它和输入框视觉上属于同一个输入台，能表达「给本次请求添加上下文」；比小气泡更适合手机点击，也比全屏 sheet 更轻。

   备选：底部 sheet。该方案适合复杂选择器，但图片和 Skill 这种入口级动作不需要打断输入上下文。

3. **移除半屏编辑器，改用自动增高 textarea。**

   选择：textarea 随内容增高，最大高度建议使用 `min(220px, 35dvh)` 一类约束；超过后 textarea 内部滚动，底部工具栏保持可见。

   理由：用户要求不再需要半屏展示。自动增高可以保留长文本编辑能力，同时不遮住权限和模型状态。

   备选：保留半屏入口作为高级编辑。该方案会让两个编辑入口并存，增加交互负担。

4. **权限模式使用 named permission profile，不在前端组合沙箱策略。**

   选择：权限 chip 保存和发送 `permissions` profile id；「自定义 config.toml」使用 `permissions: null` 清除会话级 override。profile 列表来自 app-server settings 聚合或 `permissionProfile/list` 等价数据。

   理由：协议已经把权限 profile 作为稳定抽象，并明确不能和 `sandboxPolicy` 混用。前端只做用户友好标签和选择，不复制后端安全策略。

   备选：前端直接写 `approval_policy` / `sandbox_mode`。该方案会把安全策略组合逻辑放到 Web 端，且难以覆盖用户自定义 profile。

5. **权限状态按会话生效，并在发送时显式带入。**

   选择：会话内选择权限后，前端调用 `thread/settings/update`；后续 `turn/start` 也使用当前权限状态。进入已有会话时优先使用后端返回的 `activePermissionProfile`，本地缓存只作为显示和刷新恢复的兜底。

   理由：`thread/settings/update` 表达后续 turn 的会话设置，`turn/start` 显式参数能避免 UI 状态和下一条消息不一致。优先信任后端可以处理其他客户端或 app-server 侧变更。

   备选：仅在 `turn/start` 带权限。该方案能影响下一条消息，但会话设置不持久，刷新或后续消息容易漂移。

6. **模型选择入口移到 composer，头部不重复展示模型。**

   选择：会话头部保留返回、标题、Plan/Build 和更多菜单；模型/思考档位作为发送前状态在 composer 底栏展示，点击后复用现有模型选择器。

   理由：手机头部空间紧张，模型属于下一次发送的配置，放在发送按钮旁边更符合用户确认路径。

   备选：头部和 composer 都展示模型。该方案信息重复，会让用户误以为两个入口有不同作用。

## Risks / Trade-offs

- [Risk] composer 高度增大后挤压 timeline 可视区域。→ Mitigation：给 textarea 和添加面板设置最大高度；只在空闲态显示完整 composer，运行态仍切换为紧凑中断栏。
- [Risk] 权限 chip 的中文标签与 profile id 映射不准确。→ Mitigation：常见 profile 使用前端友好文案，未知 profile 退回显示 id 和 app-server description。
- [Risk] `permissions: null` 在 Web 类型或路由中被误删，导致无法回到 `config.toml`。→ Mitigation：前端、API route、gateway 类型统一支持 `string | null`，测试覆盖清除 override。
- [Risk] 模型入口迁移导致用户找不到模型切换。→ Mitigation：composer 底栏常驻模型 chip，并复用现有模型选择面板；相关测试更新头部不再要求模型按钮。
- [Risk] 添加面板和 Skill picker 都是浮层，状态容易冲突。→ Mitigation：`+` 面板只做入口；点击 Skill 后关闭添加面板并打开现有 Skill 选择器。
- [Risk] 自动增高 textarea 在移动端键盘弹出时抖动。→ Mitigation：使用 `dvh` 和固定底部工具栏约束，测试手机视口下的输入、滚动和 safe-area。

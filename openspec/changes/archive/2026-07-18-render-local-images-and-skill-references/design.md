## Context

`ReactMarkdown` 当前没有自定义图片渲染器，POSIX 绝对路径会被浏览器当作站内 URL，Windows、`data:` 与 `blob:` 地址还可能被默认 URL 转换提前清空。项目已有认证后的 `/api/codex/images/preview`、图片缩略图失败态和全屏预览，但该读取链路只做词法路径校验，跟随符号链接时可能离开允许根目录。

Skill picker 已把选择结果作为结构化 `skillReferences` 发送并保存在实时 timeline；历史 Codex App 消息有时只留下独占一行的 `[$name](/absolute/path/SKILL.md)`。Codex CLI 0.144.5 还会把结构化 Skill 持久化为同 turn、紧随可见用户消息之后的隐藏 `<skill>` 用户消息，而 `thread/items/list` 只返回可见消息。初版实现把结构化 Skill 胶囊移到正文气泡外，虽然数据仍属于同一个 timeline item，但真实页面会把它理解为一条独立消息，因此需要恢复单一视觉消息边界。

## Goals / Non-Goals

**Goals:**

- 可靠展示 agent Markdown 中的 POSIX 与 Windows 绝对图片路径，并复用现有全屏预览和失败重试交互。
- 保持所有既有网络、内嵌和 API 图片 URL 行为，同时不把相对路径交给本机文件预览接口。
- 将结构化与严格恢复的 Skill 引用统一展示为同一用户消息气泡内、只读且移动端友好的语义上下文。
- 在历史接口遗漏 Skill 时，从受限 rollout 补充数据恢复同一用户输入的 `name/path`，刷新、分页和重启后保持一致。
- 对图片真实路径做二次安全校验，拒绝文件或目录符号链接逃逸。
- 用单元测试覆盖转换、渲染、失败、安全和历史兼容边界，并用真实会话做桌面与手机视口验收。

**Non-Goals:**

- 不支持相对本机图片路径，因为消息没有可信 `cwd`。
- 不把 Skill 胶囊做成本机文件链接，也不在 UI 暴露绝对 `SKILL.md` 路径。
- 不恢复正文、引用块、代码块或普通 Markdown 链接中的类 Skill 文本。
- 不改变外部 HTTP 图片的既有加载策略，不新增图片上传或缓存系统。

## Decisions

### 1. 在 Markdown URL 与组件边界适配本机图片

为 `ReactMarkdown` 提供自定义 `urlTransform`：先识别 POSIX 绝对路径和 Windows 盘符绝对路径，安全解码一次后交给 `imagePreviewSrc`；`http:`、`https:`、`/api/`、`blob:`、受支持的 `data:` 和协议相对 URL 保持既有语义，其余输入继续委托 `defaultUrlTransform`。自定义 `img` 组件负责自然比例、容器限宽、失败占位、重试和打开 `ImagePreviewDialog`。

选择该方案是因为它在 ReactMarkdown 丢弃 Windows/内嵌 URL 之前完成受控转换，又不改写原始 Markdown。备选的整段正则预处理会误伤代码与转义；服务端改写会污染会话事实源并把展示策略扩散到协议层，因此不采用。

### 2. 图片失败与预览使用现有交互语言

正文图片加载成功后可点击进入现有全屏预览；失败时隐藏原生破图，显示通用“图片加载失败”与重试操作。`alt` 保留无障碍含义，但失败 UI 不展示路径或服务端错误。图片源变化时重置失败状态，避免虚拟化复用旧状态。

### 3. Skill 兼容恢复发生在 timeline 归一化层

结构化 `skillReferences` 是权威来源；仅在结构化引用为空时，归一化器逐行扫描用户正文。在 fenced code 外，只有整行完整匹配 `[$name](<absolute-path>/SKILL.md)` 或等价 Windows 绝对路径时才恢复为 Skill 引用并从正文移除。多行引用按 `name/path` 去重，普通链接、行内文本、引用块、代码块和不完整路径保持原样。

选择归一化层是因为 snapshot、分页、修复和乐观消息最终都经过统一数据模型，UI 不需要猜来源。备选的 JSX 即时解析会让复制、重试和虚拟化看到不同数据。服务端只补全返回给 Web 的历史投影，不修改 rollout 或 Codex 原始历史记录。

### 4. 从隐藏 Skill rollout 输入补全历史投影

现有 session timeline supplement 已在允许路径、允许 turn、读取字节数、行数和耗时预算内扫描 rollout。扫描器仅对 `role=user` 且以固定 `<skill>`、`<name>`、`<path>` 头部开头的输入做兼容恢复；路径必须是 POSIX 或 Windows 绝对路径并以 `SKILL.md` 结尾。恢复后只保留 `name/path`，完整 Skill 正文不得进入 supplement record 或 Web API。

隐藏 Skill 与同 turn 中紧邻的前一条普通用户消息组成一个输入组。合并器使用 turn、严格正文和顺序将该组绑定到基础历史中的用户 item；已有结构化 `skillReferences` 时保持其权威性，多个隐藏 Skill 按 `name/path` 去重。找不到唯一用户锚点、格式不完整、路径不合法或只有其他隐藏上下文时不做恢复，宁可漏显也不误绑。

该补全发生在服务端历史投影层，因此 thread detail、历史分页和刷新共用同一结果，且跨浏览器和服务重启有效。仅依赖浏览器本地乐观状态无法覆盖这些场景；把 Markdown 引用写回可见正文会污染用户输入，因此均不采用。

### 5. Skill 上下文与正文共用用户消息气泡

每个用户 timeline item 只渲染一个右对齐消息气泡。所有 Skill 固定在气泡最上方的独立上下文区，其下依次显示图片与正文。多个 Skill 只在完整胶囊之间换行；单个 Skill 名称不拆字换行，超过可用宽度时省略。Skill 使用 Lucide 语义图标和由 kebab-case 派生的可读名称，但 key、重试和协议仍保留原始 `name/path`。Skill 不可点击，不设置含路径的 tooltip。仅有 Skill 时仍渲染包含该上下文的正常气泡，不生成空正文区域；复制操作继续只复制用户正文，消息菜单和失败重试作用于整个气泡。

该方案让视觉边界与数据边界保持一致。备选的“外部胶囊缩小间距”仍可能被理解成两条消息；把 Skill 名称写入正文则会丢失结构化身份，因此不采用。

### 6. 图片读取校验真实路径

预览服务先沿用扩展名和词法根目录校验，再对允许根目录与候选文件执行 `realpath`，用 canonical roots 二次执行 `assertPathAllowed`，并确认结果是普通文件。文件或中间目录符号链接只要最终落到允许根目录外就拒绝；响应增加 `X-Content-Type-Options: nosniff`。

## Risks / Trade-offs

- [历史 Skill 文本存在更多非标准格式] → 只恢复已确认的严格整行格式，宁可保留文本也不误分类；后续用真实样本扩展解析器。
- [隐藏 Skill rollout 格式属于 Codex 持久化细节] → 保留结构化历史为权威路径，只对已确认的严格头部做受限兼容恢复；格式变化时安全降级为不显示。
- [同一 turn 存在多条用户输入] → 用紧邻顺序与严格正文建立用户锚点；匹配不唯一时不绑定。
- [Windows Markdown URL 已被百分号编码] → 仅在判定为 Windows 本机路径后解码一次，并用测试覆盖空格、正斜杠与反斜杠。
- [大图改变虚拟化行高] → 使用稳定尺寸约束并依赖现有 ResizeObserver 行高更新，桌面与 390px 视口验证滚动锚点。
- [真实路径校验增加一次文件系统访问] → 仅发生在认证后的单张图片请求上，安全收益高于微小开销。
- [Markdown 图片嵌套在链接中产生交互嵌套] → 图片自身不使用嵌套 button；由语义容器和键盘处理打开预览，并补回归测试。
- [多个或过长 Skill 名称挤压正文] → Skill 上下文区只在完整胶囊之间换行，单个名称保持一行并省略；气泡和标签均限制最大宽度，并在 390px 视口验证无横向溢出。

## Migration Plan

无需数据迁移。部署后刷新会话即可重新归一化历史 Skill 引用并重新渲染本机 Markdown 图片。回滚时移除自定义图片 renderer、Skill 兼容恢复和真实路径增强，不修改任何持久化会话数据。

## Open Questions

无。

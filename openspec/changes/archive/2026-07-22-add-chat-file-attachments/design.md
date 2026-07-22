## Context

现有聊天附件链路只覆盖图片。`ChatInput` 已经能维护多张图片的本地 `File`、预览 URL、上传状态和服务端路径，`POST /api/codex/uploads/images` 将图片保存到 `CODEX_WEB_UPLOAD_DIR`，turn/start 再把 `imagePaths[]` 映射为 app-server `localImage`。timeline、乐观消息和失败重试只认识 `imagePaths` 与 `skillReferences`。

Codex app-server `0.144.5` 的 `UserInput` 不包含普通本地文件类型；`mention` 是 App、Plugin、Skill 等结构化工具引用，也不能承载任意文件。普通文件因此不能伪装成现有协议元素。仓库已经能识别并隐藏 `# Files mentioned by the user:` 与 `## My request for Codex:` 组成的可信附件包装，可将它扩展为当前协议下的兼容桥接层。

上传目录是受控临时目录，不属于 Web Files/Terminal 的默认工作区 allowlist。实现必须保持这一边界，不能为了让 agent 读取附件而静默扩大浏览器文件 API 或终端 API 的访问范围。附件由已认证用户主动提供，保存 24 小时后清理；会话历史本身可能比附件存活更久。

## Goals / Non-Goals

**Goals:**

- 支持手机文件选择器一次选择多个普通文件，并允许后续追加。
- 复用图片链路的逐项上传、独立失败、重试、移除和发送阻塞体验。
- 用结构化 Web 数据模型保留文件名称、路径、MIME、大小与稳定身份。
- 在不修改生成协议、不伪造 `UserInput` 的前提下，让 Codex 获得经校验的附件路径。
- 让乐观消息、服务端确认、snapshot repair、历史分页、失败重试、rewind/fork 和模型切换都保留文件附件语义。
- 对上传体积、数量、路径逃逸、符号链接、审计和过期行为建立可测试边界。

**Non-Goals:**

- 不提供通用文件在线预览、浏览器下载、永久文件库或跨用户共享。
- 不在服务端解析 PDF、Office、压缩包或把任意文件内容自动内联到模型上下文。
- 不新增或手改 `docs/generated/` 中的 app-server 协议产物。
- 不把 uploadDir 加入 Web Files/Terminal 的 workspace roots，也不把普通文件目录授予默认写权限。
- 不改变“消息必须包含非空文本”的发送规则。

## Decisions

### 1. Web 使用独立的文件附件模型

新增共享 `FileReference`，至少包含稳定 `id`、原始展示名 `name`、服务端绝对 `path`、`mimeType` 和 `size`。上传 API 返回相同元数据；composer 的本地状态另外保留原始 `File`、状态 `uploading | ready | failed` 和可选错误信息。

`fileReferences` 作为独立字段加入 Web API `StartTurnInput`、服务端 `StartTurnInput`、`MobileTimelineItem`、Web `TimelineItem` 与 `UserMessageEntry`。它不与 `imagePaths` 或 `skillReferences` 合并。发送幂等指纹、重复发送防护和 retry payload MUST 纳入稳定排序后的文件身份，实际展示与包装顺序仍保持用户选择顺序。

替代方案是只把路径拼入正文或复用 `mention`。前者会丢失乐观回显、重试和历史身份，后者违反 app-server 协议语义，因此不采用。

### 2. 多选在前端展开为有界的单文件上传队列

新增 `POST /api/codex/uploads/files`，每个请求只接收一个 `file`。用户一次多选或重复选择时，文件追加到同一 draft 队列；客户端最多并发 3 个上传，其余排队。逐文件请求可以复用现有认证、审计、清理和失败重试模式，也能避免批量请求中部分失败后重新上传全部文件。

默认限制为每条消息最多 10 个普通文件、单文件最多 20 MiB、普通文件合计最多 50 MiB。客户端在入队前提供即时反馈；服务端在读取 multipart 前检查可用的 `Content-Length`，解析后再次检查 `File.size`，turn/start 再按 `fileReferences` 复核数量与总大小。服务端限制是权威边界，客户端限制仅用于体验。

保存路径使用服务端生成的 UUID 与受限扩展名，不直接使用原始文件名；原始文件名只作为经过控制字符清理和长度限制的展示元数据。空文件、超限文件、非普通文件和路径逃逸均失败关闭。文件与图片共用 uploadDir 和 24 小时清理器。

文件选择器不设置普通文件类型白名单。若文件 MIME 与扩展名匹配现有图片白名单，则交给现有图片队列和 `/uploads/images`，不创建普通 `fileReference`，从而继续获得视觉输入和模型 image modality 校验。

### 3. 网关以可信附件包装兼容 app-server

turn/start route 先验证 `fileReferences` 的字段、数量、总大小、uploadDir 词法路径、canonical real path 和 `lstat().isFile()`。只有通过验证的引用才能进入网关。网关在创建 `type: "text"` 的 `UserInput` 前构造：

```text
# Files mentioned by the user:

## <sanitized-name>: <validated-absolute-path>

## My request for Codex:
<trimmed-user-text>
```

多个文件按选择顺序生成多行 `## name: path`。用户原始文本不负责构造或声明附件，浏览器也不能通过正文绕过后端路径校验。Skill 继续使用原生 `skill`，图片继续使用原生 `localImage`。

选择该方案是因为它保留任意二进制文件本体，且与仓库已有的附件包装隐藏逻辑一致。将文本文件内容内联会消耗上下文并排除二进制；复制到 thread cwd 会污染用户仓库；注册动态工具或内置 MCP 需要改变所有现有 thread 的工具配置，超出本次范围。

该包装只向模型提供路径，Codex 仍需通过自身工具读取文件。真实 app-server smoke MUST 覆盖 `:workspace` 和 `:danger-full-access`。若权限策略拒绝读取，应通过 app-server 现有权限请求呈现给用户；实现不得把 uploadDir 静默加入 runtime workspace roots，亦不得绕过审批自动读取并内联内容。

### 4. 附件包装解析与 timeline 身份在共享边界完成

服务端 user message 转换和 Web timeline fallback 使用同一组保守解析规则：仅识别完整 header、一个 request marker、格式合法的附件行，并只恢复 uploadDir 内符合服务端上传命名规则的普通文件。解析后用户气泡只显示 marker 后的原始请求，绝对路径不得进入可见正文或复制内容。

归一化结果把普通附件放入 `fileReferences`。timeline engine 在同 turn server item 确认 optimistic item 时，与图片和 Skill 一样保留本地已知的文件元数据；服务端已经恢复出文件元数据时，以稳定 id/path 去重并补齐缺失字段。纯文本 fallback 的身份限制保持不变。

用户消息气泡在 Skill 与图片之后、正文之前展示紧凑文件 chip，包含文件语义图标和经过截断的名称，不显示绝对路径，也不提供点击预览或下载。composer 中的 chip 额外显示格式化大小和状态操作。固定图标与操作尺寸、名称省略和换行规则必须保证手机宽度不产生横向滚动。

### 5. 过期文件保留历史展示但禁止无效重发

24 小时清理只删除 uploadDir 中的文件本体，不改写 app-server 历史。历史解析仍可从包装恢复名称和路径，因此文件 chip 继续显示；是否存在不作为渲染 chip 的前置条件。

用户重试失败 turn 或重发历史消息时，turn/start MUST 重新执行 canonical regular-file 校验。文件不存在时返回稳定的附件过期错误，前端保留原消息并提示重新选择文件，不得启动缺少附件的 turn，也不得静默删掉 `fileReferences` 后发送。

### 6. 审计记录元数据，不记录内容

成功普通文件上传记录 `upload.file`，包含上传 id、受控服务端路径、MIME 和大小；不记录原始字节或正文内容。`turn.start` 增加 `fileCount` 与 `fileBytes`，仍只记录原始用户 `textLength`，不把包装后的路径长度算作用户文本，也不记录附件文件名列表。

路径校验复用 workspace policy 的跨平台语义，并增加异步 canonical 检查。候选路径或父目录经过符号链接逃出 uploadDir、目标是目录/设备/符号链接、文件已消失时全部失败关闭。

### 7. 草稿、运行态和模型切换沿用现有附件生命周期

composer 在 agent 运行中仍允许选择和上传文件，这些文件只属于下一次手动发送。切换 thread 时当前组件实例按既有行为清理内存附件；同一 thread 的 timeline 高频更新、repair 和模型切换不得重置本地文件队列。

普通文件引用不是模型 image modality。切换到 text-only 模型时保留文件且不因文件本身阻止发送；同一草稿中的图片仍按现有规则阻止不兼容发送。

## Risks / Trade-offs

- [Risk] app-server 没有原生普通文件输入，附件路径依赖 agent 工具读取，某些权限配置可能要求额外审批。 → 使用标准附件包装并增加两种权限模式的真实 smoke；拒绝时走现有权限请求，不静默降权或扩权。
- [Risk] `request.formData()` 可能在 `File.size` 校验前占用内存。 → 在解析前拒绝已知超限 `Content-Length`，限制单请求只含一个文件，并在部署文档中同步请求体上限；解析后仍做权威大小校验。
- [Risk] 24 小时清理会使历史消息中的文件无法再次读取。 → 历史 chip 保留，重试/重发前检查存在性并返回明确过期状态，不发送残缺 turn。
- [Risk] 恶意文件名可能伪造 Markdown 包装或注入提示。 → 服务端限制名称长度、移除控制字符并转义包装分隔字符；包装只由服务端从已验证结构生成。
- [Risk] 多文件并发可能占满移动网络或服务端内存。 → 客户端并发上限 3、文件/总量/数量三重限制，失败按文件隔离。
- [Risk] server item 与 optimistic item 的元数据完整度不同，可能导致重复气泡或附件丢失。 → 把 `fileReferences` 纳入强身份合并、幂等指纹和现有附件保留测试矩阵。
- [Trade-off] 首版不预览或下载普通文件。 → 保持安全面和实现范围可控；后续若需要下载，应单独设计带 canonical allowlist、响应头和过期语义的接口。

## Migration Plan

1. 先增加共享类型、包装编解码器、路径校验和失败测试，不改变现有图片行为。
2. 增加普通文件上传 route 与 API client，并在 composer 内接入有界上传队列。
3. 扩展 turn/start、app-server 网关、timeline 归一化和 engine 合并，再启用消息气泡文件 chip。
4. 更新审计目录、README、环境变量说明和 Docker/发布 smoke，执行 typecheck、全量测试与 build。
5. 在真实 app-server 中分别用 `:workspace`、`:danger-full-access` 发送文本文件并确认读取行为；无法读取时发布前失败关闭。

回滚时可移除「文件」入口和 `/uploads/files` route，同时保留新增类型的可选读取兼容，使已存在历史包装仍能降级为纯用户正文而不影响图片、Skill 或旧会话。上传目录无需数据迁移，过期清理会自然删除遗留普通文件。

## Open Questions

无。文件语义、默认配额、图片分流、24 小时保留、无预览/下载和必须包含文本均已由用户确认。

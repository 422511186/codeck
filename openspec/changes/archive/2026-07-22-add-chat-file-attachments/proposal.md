## Why

当前移动端聊天只支持图片附件，添加面板还明确隐藏「文件」入口，用户无法把代码、文档、压缩包等普通文件作为本轮上下文交给 Codex。现有图片多选链路已经具备逐项上传、失败重试和乐观消息基础，现在需要在不扩大 Web 文件系统访问边界、也不伪造 app-server 协议类型的前提下补齐普通文件附件闭环。

## What Changes

- 在 composer 添加面板中启用「文件」入口，调用手机系统文件选择器，支持一次多选和再次选择时追加。
- 为每个待发送文件展示名称、大小、上传中、失败和完成状态，并支持逐项移除、重试；任一文件未完成时阻止发送。
- 新增认证普通文件上传 API，继续采用“前端多选、单文件逐个上传”的方式，保存到既有 `CODEX_WEB_UPLOAD_DIR`，并复用 24 小时临时清理语义。
- 普通文件默认最多 10 个、单文件最多 20 MiB、单条消息合计最多 50 MiB、客户端最多 3 个并发上传；服务端独立执行不可绕过的数量与大小校验。
- 文件入口接受普通文件；若选中现有图片上传能力支持的图片，则自动转入图片附件流程，继续使用 `localImage` 和模型图片能力校验。
- 在 Web 自有协议中增加结构化 `fileReferences`，贯穿 turn/start、发送幂等指纹、乐观消息、失败重试、timeline 合并、历史恢复和消息操作。
- 鉴于 Codex app-server `0.144.5` 没有普通本地文件 `UserInput` 类型，网关 SHALL 将经服务端校验的文件引用编码为受控的 `# Files mentioned by the user:` 上下文包装，并保留用户原始请求边界；不得把普通文件伪装为 `localImage` 或工具 `mention`。
- 会话消息以紧凑文件 chip 展示普通附件；首版不提供通用文件预览或下载。历史文件超过 24 小时被清理后仍保留名称展示，但重试或重发 MUST 明确提示附件已过期并要求重新上传。
- 上传与 turn/start 路径均校验 uploadDir allowlist、canonical real path 和普通文件类型，拒绝符号链接逃逸；新增 `upload.file` 审计操作，并确保 turn 审计只记录文件数量与大小等元数据，不记录文件内容。
- 保持现有发送规则：仅有文件而没有非空文本时不得发送；运行中的 composer、会话切换、模型切换和 timeline 高频更新不得丢失待发送文件。
- 增加单元、路由、timeline 和真实 app-server smoke 覆盖，验证 `:workspace` 与 `:danger-full-access` 权限下 Codex 能按附件路径读取文件；若受限权限拒绝读取，MUST 走现有权限请求流程，不得静默扩大 Files/Terminal 工作区范围。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `chat-input-area`: 启用普通文件入口、多选追加、逐项上传状态、默认配额、发送阻塞和草稿保持行为。
- `turn-interaction`: 增加普通文件上传与 `fileReferences` 输入校验、附件上下文构造、幂等指纹和过期失败语义。
- `thread-chat-view`: 增加普通文件 chip、历史恢复、过期降级和 timeline 更新期间的附件稳定性要求。
- `timeline-message-actions`: 让确认合并、失败重试、重发、rewind 和 fork 保留普通文件附件身份。
- `agent-output-rendering`: 扩展可信附件包装的解析与隐藏规则，恢复普通文件元数据且不把路径泄露为消息正文。
- `audit-and-security`: 增加普通文件上传审计、大小限制、canonical allowlist、普通文件及符号链接校验要求。
- `thread-model-switching`: 模型切换保留普通文件草稿，普通文件引用不按图片输入模态阻断切换。

## Impact

- 前端组件与状态：`src/web/components/ChatInput.tsx`、`src/app/threads/[threadId]/page.tsx`、`src/web/components/Timeline.tsx`、`src/web/state/timeline.ts`、`src/web/state/timeline-engine.ts`。
- Web API：新增 `/api/codex/uploads/files`，扩展 `/api/codex/turns/start` 与 `src/web/api` 的请求、响应和附件类型。
- 服务端：扩展 `src/server/uploads.ts`、app-server `StartTurnInput`、用户输入构造、user message 归一化、路径安全和审计目录。
- 协议兼容：不修改 `docs/generated/`，不向 app-server 发送未知 `UserInput`；通过受控文本包装兼容当前 Codex `0.144.5`。
- 配置与部署：继续复用 `CODEX_WEB_UPLOAD_DIR` 及现有持久卷，不新增敏感配置；README 和中文部署说明需把“图片暂存目录”更新为“附件暂存目录”。
- 测试：扩展上传、turn route、user-input、composer、thread page、timeline 转换/合并、权限边界和 release smoke 测试。

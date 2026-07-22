## 1. 类型、边界与测试基线

- [x] 1.1 在共享 API/timeline 类型中定义 `FileReference`、文件计数/大小常量和 `fileReferences` 可选字段，确认不修改 `docs/generated/`。
- [x] 1.2 先为文件引用字段校验、名称清理、数量/总大小限制和 payload fingerprint 编写失败测试。
- [x] 1.3 先为 Files-mentioned 包装的编码、严格解析、路径行转义和用户正文恢复编写单元测试。
- [x] 1.4 扩展 `createTurnUserInput` 相关测试，锁定普通文件只进入文本包装、不生成未知 `UserInput` 类型的协议边界。

## 2. 服务端上传与安全校验

- [x] 2.1 扩展 `src/server/uploads.ts`，实现普通文件保存、UUID/扩展名命名、原始名称清理、空文件/大小校验，并保持图片保存行为不变。
- [x] 2.2 为普通文件上传、超限文件、空文件、图片误投、路径越界、符号链接和 24 小时清理补充 `tests/unit/uploads.test.ts` 覆盖。
- [x] 2.3 增加 canonical regular-file 校验 helper，覆盖 uploadDir 词法路径、真实路径、父目录/文件符号链接和非普通文件拒绝。
- [x] 2.4 实现认证 `POST /api/codex/uploads/files` route，处理 `Content-Length` 预检、multipart 文件解析、错误映射和 `upload.file` 审计。
- [x] 2.5 增加 Web API client 的 `uploadFile` 方法及 `UploadedFile` 类型，并为 route 的鉴权、响应元数据、大小限制和审计字段补充测试。

## 3. Turn 与 app-server 兼容桥接

- [x] 3.1 扩展 `/api/codex/turns/start` 的 `fileReferences` 校验、10 文件/50 MiB 聚合限制、过期文件错误和 `fileCount/fileBytes` 审计字段。
- [x] 3.2 将文件引用纳入 start-turn payload fingerprint、重复请求冲突检测和 ambiguous retry 的 identity 测试。
- [x] 3.3 扩展 app-server `StartTurnInput` 与网关输入构造，生成受控 `# Files mentioned by the user:` / `## My request for Codex:` 文本包装，并保持图片与 Skill 的原生输入顺序和语义。
- [x] 3.4 扩展服务端 user message 转换，解析合法文件包装并返回 `fileReferences`；为不可信路径、重复行和缺失 metadata 添加回归测试。
- [x] 3.5 使用真实 app-server 分别在 `:workspace` 与 `:danger-full-access` 权限下发送小型文本附件，验证 agent 可按路径读取；拒绝时验证现有权限请求流程且不扩大 workspace roots。

## 4. Composer 多文件体验

- [x] 4.1 在 `ChatInput` 添加面板加入「文件」入口和独立多选 input，保持图片入口独立并支持重复选择追加。
- [x] 4.2 实现普通文件本地状态、最多 3 并发上传队列、单文件/数量/总量预检、逐项移除、失败重试和上传完成引用绑定。
- [x] 4.3 对文件选择中的受支持图片执行现有图片上传分流，并验证 text-only 模型的图片兼容性提示不误伤普通文件。
- [x] 4.4 扩展 composer `onSend` contract、发送按钮阻塞规则、运行态草稿生命周期和 thread 切换清理，保证仅文件无文本仍不可发送。
- [x] 4.5 为 `tests/unit/web-chat-input.test.tsx` 增加多选追加、并发上限、配额拒绝、混合图片分流、失败重试、移除和运行态保持测试。

## 5. Timeline、消息气泡与状态合并

- [x] 5.1 扩展 `MobileTimelineItem`、`TimelineItem`、`UserMessageEntry` 和消息发送 payload，使 `fileReferences` 在 optimistic、snapshot、pagination 和 live event 间可传递。
- [x] 5.2 实现严格附件包装解析与可见正文归一化，普通文件 chip 只显示名称/图标，不显示绝对路径，复制正文不包含包装内容。
- [x] 5.3 在 `Timeline` 用户消息气泡中按 Skill、图片、普通文件、正文顺序渲染稳定宽度 chip，并处理过期历史附件与移动端长文件名。
- [x] 5.4 扩展 timeline engine 的同 turn 确认、补齐、去重和附件保留逻辑，按稳定 id/path 合并文件 metadata，不跨 turn 合并相同文本附件。
- [x] 5.5 为 timeline 转换、包装恢复、气泡渲染、snapshot repair、server confirmation 和长消息布局补充单元测试。

## 6. 消息操作与模型切换

- [x] 6.1 扩展 thread page 的发送、失败重试、重发、rewind 和 fork payload，使原文本、图片、Skill 与普通文件引用保持一致。
- [x] 6.2 对重试/重发/rewind 的过期文件增加失败关闭 UI，保留历史 chip 并提示重新上传，不启动缺少附件的 turn。
- [x] 6.3 更新模型切换兼容性逻辑：普通文件不触发 image modality 阻断，混合图片时只提示图片原因，并保留全部草稿附件。
- [x] 6.4 为 `web-thread-page`、`web-store-events`、`timeline-message-actions` 和 `thread-model-switching` 补充重复文本、附件保留、过期重试与跨 thread 身份测试。
- [x] 6.5 fork 成功后恢复普通文件草稿并保持独立 thread 草稿状态，避免 fork 只恢复文本而丢失附件引用。

## 7. 审计、文档与部署

- [x] 7.1 将 `upload.file` 加入审计操作目录，验证日志只含 id/path 范围、MIME、大小、fileCount/fileBytes，不含文件内容、原始文件名或正文。
- [x] 7.2 更新中文 README、`.env.example`、Docker 部署说明和配置注释，将图片暂存目录表述改为附件暂存目录并记录默认限制与临时保留策略。
- [x] 7.3 增加 release/docker smoke 对上传目录挂载、过期清理、普通文件排除和敏感产物打包边界的覆盖。

## 8. 完整验证与交付

- [x] 8.1 按 TDD 顺序运行新增单元/集成测试，修复失败后执行 `npm run typecheck`。
- [x] 8.2 执行 `npm run test`，确认图片、Skill、文本-only 和现有 timeline 行为无回归。
- [x] 8.3 执行 `npm run build` 与必要的 release smoke，确认生产 bundle 不包含测试/上传目录且 API 路由可用。
- [x] 8.4 汇总移动端视口验收：添加面板、多个文件 chip、上传失败/重试、发送阻塞、运行态草稿、历史恢复和过期提示均无重叠或横向溢出。
  - 2026-07-21：使用临时 esbuild fixture + headless Chrome，在 390px phone 容器中渲染真实 `ChatInput`/`Timeline` 组件；覆盖添加面板、多文件 chip、上传失败/重试、仅文件阻塞、运行态草稿、历史恢复与过期提示，未发现受测节点横向溢出或绝对路径泄露。

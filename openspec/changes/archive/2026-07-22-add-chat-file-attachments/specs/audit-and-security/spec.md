## ADDED Requirements

### Requirement: 普通文件上传与引用路径安全
普通文件上传和 turn 文件引用 SHALL 使用 uploadDir 作为唯一临时存储边界。服务端 MUST 同时校验词法路径、canonical real path、普通文件类型、文件存在性和大小；MUST 拒绝文件或父目录符号链接逃逸。浏览器提供的路径 MUST NOT 自动扩大 Web Files/Terminal 或 app-server runtime workspace roots。

#### Scenario: Valid uploaded regular file
- **WHEN** 候选文件的词法路径和真实路径都位于 uploadDir 内
- **AND** 目标是存在的普通文件且满足大小限制
- **THEN** 系统 MUST 允许其成为 turn 的 fileReference

#### Scenario: File symlink escapes uploadDir
- **WHEN** uploadDir 内候选路径是指向目录外目标的符号链接
- **THEN** 系统 MUST 拒绝引用
- **AND** MUST NOT 读取目标内容或启动 turn

#### Scenario: Directory symlink escapes uploadDir
- **WHEN** 候选路径经过 uploadDir 内指向目录外的目录符号链接
- **THEN** canonical allowlist 校验 MUST 拒绝引用
- **AND** MUST NOT 读取目标内容或启动 turn

#### Scenario: Candidate is not a regular file
- **WHEN** 候选真实路径是目录、设备、socket 或其他非普通文件
- **THEN** 系统 MUST 拒绝上传或 turn 引用

#### Scenario: Missing Content-Length does not bypass size limit
- **WHEN** 上传请求省略或伪造 `Content-Length`
- **THEN** 服务端 MUST 仍按解析后的实际 `File.size` 执行 20 MiB 限制
- **AND** 超限文件 MUST NOT 被持久保存

#### Scenario: Browser path cannot expand workspace
- **WHEN** 浏览器提交 uploadDir 内的 fileReference
- **THEN** 系统 MUST 只把该路径用于当前消息的附件上下文与校验
- **AND** MUST NOT 将 uploadDir 加入 Files/Terminal allowlist 或 thread runtime workspace roots

### Requirement: 普通文件上传敏感数据最小化
系统 SHALL 只在内存和 uploadDir 中处理用户上传的普通文件。审计与错误响应 MUST NOT 包含文件字节、提取内容或用户消息正文；服务端文件名 MUST 使用随机 id，原始名称只作为清理后的展示元数据。

#### Scenario: Upload audit excludes content
- **WHEN** 普通文件上传成功
- **THEN** `upload.file` 审计事件 MAY 包含上传 id、受控路径、MIME 和大小
- **AND** MUST NOT 包含文件字节、解析内容或用户消息正文

#### Scenario: Malicious original filename
- **WHEN** 原始文件名包含换行、控制字符或附件包装分隔符
- **THEN** 服务端 MUST 清理或转义这些字符并限制名称长度
- **AND** 保存路径 MUST 继续使用随机 id
- **AND** 生成的附件包装 MUST 保持结构完整

## MODIFIED Requirements

### Requirement: Audit operations catalog
系统 SHALL 对特定操作记录审计日志，包含操作名称和上下文相关字段。以下操作 MUST 记录审计日志：thread.start、turn.start、fs.file.write、fs.directory.create、fs.path.remove、fs.path.copy、fs.watch、fs.unwatch、commandExec.spawn、process.spawn、process.stdin.write、process.resizePty、process.kill、config.value.write、request.resolve、account.login.chatgpt、account.login.apiKey、account.logout、remoteControl.enable、remoteControl.disable、upload.image、upload.file、thread.delete、thread.name.set、customModel.create、customModel.replace、customModel.delete、thread.model.switch.request、thread.model.switch.result、thread.model.binding.update、thread.model.binding.recover。模型切换请求与终态 MUST 使用同一 `operationId` 关联。以下操作当前不记录审计日志：thread.list/read/search、自定义模型目录读取、统一模型目录读取、fs.readFile、fs.readDirectory、fs.getMetadata、fs.search、plugin.install/uninstall、mcpServer/oauth/login、mcpServer/resource/read、windowsSandbox/*、experimentalFeature/*。

#### Scenario: Audited operation records event
- **WHEN** 用户执行 `thread.start` 操作
- **THEN** 审计日志记录 `{action: "thread.start", detail: {cwd, workspaceRoots, model, permissions}}`

#### Scenario: Ordinary file upload is audited
- **WHEN** 普通文件上传成功
- **THEN** 审计日志 MUST 记录 `upload.file` 与受控元数据
- **AND** MUST NOT 记录原始字节、文件内容或消息正文

#### Scenario: Custom model mutation is audited
- **WHEN** 自定义模型创建、替换或删除成功
- **THEN** 审计日志 MUST 记录 action、`customModelId`、模型标识和旧/新目录修订号
- **AND** MUST NOT 记录任何 provider 凭据或接口鉴权值

#### Scenario: Model switch terminal outcome is audited
- **WHEN** 模型切换结束为 `switched`、`recovered` 或 `recovery_failed`
- **THEN** 审计日志 MUST 使用请求的 `operationId` 记录 threadId、来源敏感旧/新选择、reasoning、上下文窗口、当前 provider 标识和终态
- **AND** 错误 MUST 仅保存清理后的摘要

#### Scenario: Non-audited operation skips logging
- **WHEN** 用户执行 `fs.readFile` 操作
- **THEN** 审计日志不产生任何记录

#### Scenario: API Key login records key length only
- **WHEN** 用户使用 API Key 登录
- **THEN** 审计日志记录 `{action: "account.login.apiKey", detail: {keyLength: N}}`，不记录 key 值

## MODIFIED Requirements

### Requirement: Audit operations catalog
系统 SHALL 对特定操作记录审计日志，包含操作名称和上下文相关字段。以下操作 MUST 记录审计日志：thread.start、turn.start、fs.file.write、fs.directory.create、fs.path.remove、fs.path.copy、fs.watch、fs.unwatch、commandExec.spawn、process.spawn、process.stdin.write、process.resizePty、process.kill、config.value.write、request.resolve、account.login.chatgpt、account.login.apiKey、account.logout、remoteControl.enable、remoteControl.disable、upload.image、thread.delete、thread.name.set、customModel.create、customModel.replace、customModel.delete、thread.model.switch.request、thread.model.switch.result、thread.model.binding.update、thread.model.binding.recover。模型切换请求与终态 MUST 使用同一 `operationId` 关联。以下操作当前不记录审计日志：thread.list/read/search、自定义模型目录读取、统一模型目录读取、fs.readFile、fs.readDirectory、fs.getMetadata、fs.search、plugin.install/uninstall、mcpServer/oauth/login、mcpServer/resource/read、windowsSandbox/*、experimentalFeature/*。

#### Scenario: Audited operation records event
- **WHEN** 用户执行 `thread.start` 操作
- **THEN** 审计日志记录 `{action: "thread.start", detail: {cwd, workspaceRoots, model, permissions}}`

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

## ADDED Requirements

### Requirement: Custom model data files stay inside the configured data directory
自定义模型目录与会话绑定文件 SHALL 仅写入专用可配置 Codex Web 数据目录。文件路径 MUST 由后端配置解析，浏览器 MUST NOT 提供任意路径；Docker 部署 MUST 能通过持久卷保存该目录。

#### Scenario: Browser cannot choose persistence path
- **WHEN** 用户调用任一自定义模型或切换 API
- **THEN** route MUST 忽略或拒绝浏览器提供的文件路径
- **AND** MUST 只使用服务端解析后的目录文件与绑定文件路径

#### Scenario: Persistence excludes credentials
- **WHEN** 后端写入自定义模型目录、绑定或操作记录
- **THEN** 文件 MUST NOT 包含 API key、authorization header、环境变量值、provider base URL 或完整 provider 配置

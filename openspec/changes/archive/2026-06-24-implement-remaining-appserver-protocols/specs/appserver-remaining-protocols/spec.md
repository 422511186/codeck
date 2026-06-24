## ADDED Requirements

### Requirement: Complete remaining app-server method coverage
系统 SHALL 接入当前 `ClientRequest` 中尚未由源码覆盖的剩余 app-server method，并且 MUST 不再依赖临时排除规则来隐藏这些 method 的缺口。

#### Scenario: Protocol coverage has no remaining excluded gap
- **WHEN** 运行 app-server 协议覆盖测试
- **THEN** `environment/add`、`externalAgentConfig/detect`、`externalAgentConfig/import`、`feedback/upload`、`marketplace/add`、`marketplace/remove`、`marketplace/upgrade`、`mcpServer/tool/call`、`plugin/installed`、`plugin/share/checkout`、`plugin/share/delete`、`plugin/share/list`、`plugin/share/save`、`plugin/share/updateTargets`、`thread/realtime/appendAudio`、`thread/realtime/appendSpeech`、`thread/realtime/appendText`、`thread/realtime/listVoices`、`thread/realtime/start` 和 `thread/realtime/stop` MUST 都能在源码接入点中被发现
- **AND** 非机器生成源码中不应只通过测试排除正则声明这些 method 已完成

### Requirement: Environment and external agent config protocols
系统 SHALL 为移动端 Web 提供环境接入与 external agent config 检测/导入 API，并通过 typed app-server gateway 调用 `environment/add`、`externalAgentConfig/detect` 和 `externalAgentConfig/import`。

#### Scenario: Add environment through mobile API
- **WHEN** 已认证的手机浏览器提交环境接入请求
- **THEN** 后端 MUST 校验请求体并调用 `environment/add`
- **AND** 响应 MUST 返回移动端可继续展示或轮询的环境接入结果

#### Scenario: Detect and import external agent config
- **WHEN** 已认证的手机浏览器请求检测或导入 external agent config
- **THEN** 后端 MUST 分别调用 `externalAgentConfig/detect` 或 `externalAgentConfig/import`
- **AND** 导入结果 MUST 保留成功项、失败项和完成通知所需的关键信息

### Requirement: Feedback upload protocol
系统 SHALL 暴露移动端 feedback 上传 API，并通过 typed gateway 调用 `feedback/upload`，使用户可以从手机浏览器提交问题反馈所需的数据。

#### Scenario: Upload feedback
- **WHEN** 已认证的手机浏览器提交 feedback payload
- **THEN** 后端 MUST 调用 `feedback/upload`
- **AND** 成功响应 MUST 标识上传已被 app-server 接收

#### Scenario: Reject invalid feedback payload
- **WHEN** feedback 请求体缺少必需字段或字段类型不合法
- **THEN** 后端 MUST 返回统一失败响应
- **AND** MUST 不调用 app-server

### Requirement: Marketplace and plugin sharing protocols
系统 SHALL 为移动端 Web 接入 marketplace 管理、插件已安装通知查询和 plugin share 工作流，并调用对应 app-server method：`marketplace/add`、`marketplace/remove`、`marketplace/upgrade`、`plugin/installed`、`plugin/share/save`、`plugin/share/updateTargets`、`plugin/share/list`、`plugin/share/checkout` 和 `plugin/share/delete`。

#### Scenario: Manage marketplace entries
- **WHEN** 已认证的手机浏览器请求添加、移除或升级 marketplace
- **THEN** 后端 MUST 调用对应 marketplace app-server method
- **AND** 响应 MUST 保留状态、错误信息和移动端后续刷新所需字段

#### Scenario: Manage plugin shares
- **WHEN** 已认证的手机浏览器保存、更新目标、列出、checkout 或删除 plugin share
- **THEN** 后端 MUST 调用对应 `plugin/share/*` app-server method
- **AND** 列表响应 MUST 支持移动端分页或空列表展示

#### Scenario: Read installed plugin result
- **WHEN** 已认证的手机浏览器查询插件安装完成结果
- **THEN** 后端 MUST 调用 `plugin/installed`
- **AND** 响应 MUST 返回安装结果和需要用户继续处理的认证信息

### Requirement: MCP tool call protocol
系统 SHALL 暴露受控的 MCP tool call API，并通过 typed gateway 调用 `mcpServer/tool/call`，让移动端 Web 可以触发已配置 MCP server 的工具调用。

#### Scenario: Call MCP server tool
- **WHEN** 已认证的手机浏览器提交 server、tool name 和 arguments
- **THEN** 后端 MUST 调用 `mcpServer/tool/call`
- **AND** 响应 MUST 返回 tool call 状态、结果内容或错误信息

#### Scenario: MCP tool call validation fails
- **WHEN** MCP tool call 请求缺少 server 或 tool name
- **THEN** 后端 MUST 返回统一失败响应
- **AND** MUST 不调用 app-server

### Requirement: Thread realtime protocols
系统 SHALL 为移动端 Web 接入 thread realtime 控制协议，并调用 `thread/realtime/start`、`thread/realtime/appendAudio`、`thread/realtime/appendText`、`thread/realtime/appendSpeech`、`thread/realtime/stop` 和 `thread/realtime/listVoices`。

#### Scenario: Start and stop realtime session
- **WHEN** 已认证的手机浏览器请求启动或停止 thread realtime
- **THEN** 后端 MUST 调用对应 `thread/realtime/*` app-server method
- **AND** 响应 MUST 返回移动端识别 realtime 会话状态所需字段

#### Scenario: Append realtime input
- **WHEN** 已认证的手机浏览器向 realtime 会话追加 audio、text 或 speech 输入
- **THEN** 后端 MUST 调用对应 append method
- **AND** 二进制或文本输入 MUST 按 generated params 要求转换后发送给 app-server

#### Scenario: List realtime voices
- **WHEN** 已认证的手机浏览器请求可用 realtime voices
- **THEN** 后端 MUST 调用 `thread/realtime/listVoices`
- **AND** 响应 MUST 返回手机端可直接渲染的 voice 列表

### Requirement: Notifications and pending event flow
系统 SHALL 将新增协议产生的 app-server notification 归一化为现有 WebSocket 事件流可分发的移动端事件。

#### Scenario: Realtime notification is forwarded
- **WHEN** app-server 发送 thread realtime 相关 notification
- **THEN** 后端 MUST 通过 `/ws` 发送 `codex-event`
- **AND** 事件 MUST 包含前端区分 realtime session、transcript、audio、error 或 closed 状态所需字段

#### Scenario: External agent import completion is forwarded
- **WHEN** app-server 发送 external agent config import completion notification
- **THEN** 后端 MUST 通过 `/ws` 发送可被移动端分发的 `codex-event`
- **AND** 事件 MUST 保留导入成功和失败摘要

### Requirement: Auth, audit, docs, and mock behavior
系统 SHALL 对所有新增 HTTP API 执行现有 session 认证、敏感操作审计、mock 模式覆盖和中文后端 API 文档更新。

#### Scenario: Unauthenticated request is rejected
- **WHEN** 未认证浏览器调用任一新增 `/api/codex/*` API
- **THEN** 后端 MUST 返回未登录响应
- **AND** MUST 不调用 app-server

#### Scenario: Sensitive operation is audited
- **WHEN** 已认证浏览器执行 marketplace 写操作、plugin share 写操作、MCP tool call、feedback upload、environment add、external agent import 或 realtime control
- **THEN** 后端 MUST 写入审计日志

#### Scenario: Mock mode supports all new methods
- **WHEN** app-server gateway 运行在 mock 模式
- **THEN** 所有新增方法 MUST 返回确定性 mock 响应
- **AND** 单元测试 MUST 覆盖这些 mock 响应

#### Scenario: Backend API documentation is updated
- **WHEN** 开发者阅读 `docs/backend-api.md`
- **THEN** 文档 MUST 使用中文说明新增 API 的路径、用途、关键请求体和响应形状

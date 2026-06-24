## Why

后端 app-server 层承载了认证、会话、文件系统、进程执行、远程控制等核心能力，但业务规则散布在 90+ 个 route handler、Gateway 方法和 Peer 实现中，缺乏统一的规格视图。本次变更的目的是**将现有行为和待确认问题文档化**，为后续安全加固或功能迭代提供事实基线，不涉及任何代码改造。

## What Changes

- 新增 9 份能力规格文件，分别记录 app-server 各业务域的现状规则（认证、会话、文件系统、进程执行、配置、远程控制、插件与 MCP 与技能、审计与安全）
- 每份规格只记录代码中**已经实现的**行为约束，不预设未来行为
- 每份规格末尾列出**待确认问题**（标记为 OPEN QUESTION），这些是代码中存在但语义不明确或可能有安全隐忧的行为
- 不修改任何现有代码、配置或类型定义

## Capabilities

### New Capabilities
- `auth-session`: 认证与会话管理——cookie 签名、登录/登出流程、app-server 认证透传的现状规则
- `thread-lifecycle`: Thread 生命周期——创建/读取/删除/归档/fork/rollback 等操作的业务规则与路径校验
- `turn-interaction`: Turn 交互——消息发送/中断/追加、图片上传与路径白名单
- `fs-operations`: 文件系统操作——读写/删除/复制/监控/搜索的路径校验与审计规则
- `process-exec`: 进程与命令执行——spawn/exec 的 cwd 校验、终端会话追踪与输出推送
- `config-management`: 配置管理——可写键白名单、批量写入、配置需求读取
- `remote-control`: 远程控制——启用/禁用/配对/客户端撤销的流程与审计
- `plugin-mcp-skills`: 插件、MCP 服务器与技能——安装/卸载、OAuth 登录、资源读取、模型/协作模式/权限配置
- `audit-and-security`: 审计与工作区安全——审计日志写入、敏感字段脱敏、工作区路径策略、审批请求追踪

### Modified Capabilities
<!-- 无——本次不修改任何现有规格 -->

## Impact

- 仅新增文档文件，不影响任何代码、API 或运行时行为
- 新增规格位于 `openspec/changes/appserver-spec-as-is/specs/`，共 9 份 spec.md
- 后续任何安全加固或功能改造应以这些规格为起点

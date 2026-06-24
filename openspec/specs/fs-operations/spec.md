# fs-operations Specification

## Purpose
TBD - created by archiving change appserver-spec-as-is. Update Purpose after archive.
## Requirements
### Requirement: File read with path validation
系统 SHALL 在读取文件前校验请求路径在允许的工作区范围内。路径校验 MUST 使用 `assertRuntimePathAllowed`。

#### Scenario: Read file
- **WHEN** 已认证用户 GET `/api/codex/fs/file?path=/workspace/src/app.ts`
- **THEN** 校验路径在工作区内，调用 `gateway.readFile(allowedPath)`，返回 `{ok: true, file: {path, text}}`

#### Scenario: Read file with invalid path
- **WHEN** 请求路径不在工作区范围内
- **THEN** 返回 HTTP 502 和路径越界错误

### Requirement: File write with path validation and audit
系统 SHALL 在写入文件前校验路径并记录审计日志（包含路径和文本长度）。文件内容 MUST 通过 base64 编码传递给 app-server。

#### Scenario: Write file
- **WHEN** 已认证用户 PUT `/api/codex/fs/file` 并提供 `path` 和 `text`
- **THEN** 校验 path 和 text 类型，校验路径在工作区内，记录审计日志，调用 `gateway.writeFile(allowedPath, text)`

#### Scenario: Missing path or text
- **WHEN** 请求缺少 `path` 或 `text` 字段
- **THEN** 返回 HTTP 400 和对应错误信息

### Requirement: Directory listing with path validation
系统 SHALL 支持列出目录内容，路径 MUST 通过校验。

#### Scenario: List directory
- **WHEN** 已认证用户 GET `/api/codex/fs/directory?path=/workspace/src`
- **THEN** 校验路径，调用 `gateway.readDirectory(allowedPath)`，返回文件条目列表

### Requirement: Directory creation with path validation
系统 SHALL 支持递归创建目录（`recursive: true`）。

#### Scenario: Create directory
- **WHEN** 已认证用户 POST `/api/codex/fs/directory` 并提供 `path`
- **THEN** 校验路径，调用 `gateway.createDirectory(allowedPath)`

### Requirement: File or directory removal with path validation
系统 SHALL 支持删除文件或目录。app-server 调用 MUST 使用 `recursive: true, force: true` 硬编码参数。

#### Scenario: Remove path
- **WHEN** 已认证用户 POST `/api/codex/fs/remove` 并提供 `path`
- **THEN** 校验路径，调用 `gateway.removePath(allowedPath)`（底层参数：`recursive: true, force: true`）

### Requirement: File or directory copy with path validation
系统 SHALL 支持复制文件或目录。app-server 调用 MUST 使用 `recursive: true` 硬编码参数。

#### Scenario: Copy path
- **WHEN** 已认证用户 POST `/api/codex/fs/copy` 并提供 `sourcePath` 和 `destinationPath`
- **THEN** 校验两个路径，调用 `gateway.copyPath(sourcePath, destinationPath)`

### Requirement: File metadata with path validation
系统 SHALL 支持获取文件/目录的元数据（是否目录、是否文件、是否符号链接、创建/修改时间）。

#### Scenario: Get metadata
- **WHEN** 已认证用户 GET `/api/codex/fs/metadata?path=/workspace`
- **THEN** 校验路径，调用 `gateway.getMetadata(allowedPath)`

### Requirement: File system watch
系统 SHALL 支持监控指定路径的文件变更。watchId 由 Gateway 递增生成（`mobile-watch-{counter}`）。

#### Scenario: Watch path
- **WHEN** 已认证用户 POST `/api/codex/fs/watch` 并提供 `path`
- **THEN** 生成 watchId，调用 `gateway.watchPath(watchId, path)`，返回 `{watchId, path}`

#### Scenario: Unwatch path
- **WHEN** 已认证用户 POST `/api/codex/fs/unwatch` 并提供 `watchId`
- **THEN** 调用 `gateway.unwatchPath(watchId)`

### Requirement: File search
系统 SHALL 支持模糊文件搜索，包括单次搜索和会话式搜索（sessionStart / sessionUpdate / sessionStop）。

#### Scenario: One-shot file search
- **WHEN** 已认证用户 GET `/api/codex/fs/search` 并提供 `query` 和 `roots`
- **THEN** 调用 `gateway.searchFiles({query, roots})`，返回搜索结果

#### Scenario: Session-based file search
- **WHEN** 已认证用户使用 search-session 系列端点
- **THEN** Gateway 生成递增 sessionId，调用对应的 app-server 方法，通知通过 WebSocket 推送

### Requirement: Workspace path policy
系统 SHALL 确保所有文件系统操作的路径在允许的工作区范围内。至少 MUST 配置一个 workspaceRoot。路径校验 MUST 支持 Windows 和 POSIX 两种路径风格。Windows 路径比较 MUST 大小写不敏感。

#### Scenario: Path inside workspace
- **WHEN** 候选路径是某个 workspaceRoot 的子路径或自身
- **THEN** 校验通过，返回标准化后的路径

#### Scenario: Path outside workspace
- **WHEN** 候选路径不在任何 workspaceRoot 下
- **THEN** 抛出 `"路径不在允许的工作区范围内"`

#### Scenario: Empty path rejected
- **WHEN** 候选路径为空或仅空白
- **THEN** 抛出 `"路径不能为空"`

**Open Questions**

1. **fs/remove 的 `recursive: true, force: true` 硬编码**：这些参数意味着可以递归强制删除工作区内的任意目录（包括整个项目根目录），无需二次确认。是否应该对删除操作增加保护（如禁止删除 workspaceRoot 本身、要求确认、或限制 recursive 范围）？
2. **fs/writeFile 可覆盖任意已有文件**：只要路径在 workspace 内，就可以覆盖任何文件（包括 `.git/` 下的文件）。是否需要对特定目录（如 `.git/`、`node_modules/`）设保护？
3. **文件操作审计覆盖不完整**：`fs/readFile` 和 `fs/readDirectory` 不记录审计日志，但 `fs/remove`、`fs/copy`、`fs/directory.create`、`fs/watch`、`fs/unwatch` 实际上记录了审计日志。`fs/search` 和 `fs/metadata` 不记录。读操作的审计是否必要？
4. **watchId 由 Gateway 内存递增生成**：Gateway 重启后 counter 重置，可能产生重复 watchId。app-server 侧是否有冲突风险？


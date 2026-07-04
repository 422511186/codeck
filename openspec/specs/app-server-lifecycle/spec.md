# app-server-lifecycle Specification

## Purpose
TBD - created by archiving change optimize-thread-chat-performance. Update Purpose after archive.
## Requirements
### Requirement: App-server 跨 Web 后端复用使用显式 external 模式
系统 SHALL 支持通过 `external` 模式连接一个已启动的 Codex app-server，以便多个 Web 后端或生产部署复用同一个 app-server 实例。文档和示例 MUST 明确说明 `spawn` 只表示当前 Web 后端按需拥有子进程，不提供跨 Web 后端复用保证。

#### Scenario: 多个 Web 后端连接同一 external app-server
- **WHEN** 运维人员先启动 `codex app-server --listen ws://127.0.0.1:<port>`
- **AND** 多个 Web 后端配置相同的 `CODEX_WEB_APP_SERVER_MODE=external` 和 `CODEX_WEB_APP_SERVER_URL`
- **THEN** 每个 Web 后端 MUST 只连接该 app-server
- **AND** MUST NOT 再自动启动额外 app-server 子进程

#### Scenario: Spawn mode does not imply reuse
- **WHEN** 多个 Web 后端使用 `CODEX_WEB_APP_SERVER_MODE=spawn`
- **THEN** 系统和文档 MUST 不承诺这些 Web 后端会复用同一个 app-server
- **AND** 若需要复用，MUST 指引用户改用 `external` 或自动复用模式

### Requirement: 自动启动模式先连接后启动
系统 MAY 提供 `spawn-or-connect` 或等价自动复用模式。该模式在配置固定 host/port 时 SHALL 先尝试连接已有 app-server；只有连接失败且成功取得启动权后，才 SHALL 启动新的 app-server。

#### Scenario: 固定端口已有可用 app-server
- **WHEN** 自动复用模式配置了 `CODEX_WEB_APP_SERVER_HOST` 和 `CODEX_WEB_APP_SERVER_PORT`
- **AND** 该地址已有可用 Codex app-server
- **THEN** Web 后端 MUST 连接已有 app-server
- **AND** MUST NOT 启动新的 `codex app-server` 进程

#### Scenario: 固定端口没有可用 app-server
- **WHEN** 自动复用模式配置了固定 host/port
- **AND** 该地址没有可连接的 app-server
- **THEN** Web 后端 MUST 在取得跨进程启动锁后启动新的 app-server
- **AND** 启动完成后 MUST 连接该 app-server

#### Scenario: 端口被非 app-server 占用
- **WHEN** 自动复用模式发现固定端口已被占用但 app-server 握手失败
- **THEN** Web 后端 MUST 返回明确的配置或端口占用错误
- **AND** MUST NOT 静默改用随机端口导致复用失效

### Requirement: 自动启动使用跨进程锁防止重复拉起
自动复用模式 SHALL 使用跨进程锁或等价机制协调并发 Web 后端启动。锁元数据 SHOULD 包含 endpoint、owner pid、启动时间和由当前 Web 后端是否拥有子进程等诊断信息。

#### Scenario: 两个 Web 后端同时启动
- **WHEN** 两个 Web 后端几乎同时进入自动复用启动流程
- **THEN** 最多一个 Web 后端 MUST 获得启动权并启动 app-server
- **AND** 其他 Web 后端 MUST 等待该 endpoint 可连接后复用它

#### Scenario: 启动锁陈旧
- **WHEN** 锁文件或元数据指向的 owner pid 已不存在
- **THEN** 后续 Web 后端 MUST 能识别陈旧锁
- **AND** MUST 清理或替换陈旧锁后继续连接或启动流程

### Requirement: Spawned app-server 子进程具备清理和残留识别
由 Web 后端启动的 app-server 子进程 SHALL 在 Web 后端正常关闭时被关闭。若 Web 后端异常退出导致 app-server 残留，后续启动 MUST 能识别该 endpoint 是否仍可复用；不可复用时 MUST 标记为陈旧并给出可诊断错误。

#### Scenario: Web 后端正常退出
- **WHEN** Web 后端收到 `SIGINT`、`SIGTERM` 或主动 close
- **AND** app-server 子进程由当前 Web 后端拥有
- **THEN** 系统 MUST 尝试关闭该 app-server 子进程
- **AND** MUST 清理对应的 owner 元数据

#### Scenario: 父进程异常退出后残留 app-server
- **WHEN** 之前由 Web 后端启动的 app-server 仍在固定 endpoint 上监听
- **AND** 原 owner pid 已不存在
- **THEN** 后续 Web 后端 SHOULD 复用该可用 app-server
- **AND** MUST 更新 owner/复用诊断状态，避免再启动重复进程

### Requirement: App-server 状态诊断不泄露敏感连接信息
系统 SHALL 在开发或状态诊断路径提供 app-server lifecycle 状态，用于判断当前模式、连接状态、是否复用已有服务、是否拥有子进程、最近错误和清理状态。对浏览器暴露的状态 MUST NOT 包含原始 app-server URL、token、认证信息或其它敏感连接细节。

#### Scenario: 查看状态诊断
- **WHEN** 已认证用户或测试读取 app-server 状态
- **THEN** 响应 MAY 包含 `mode`、`state`、`managedByCurrentProcess`、`reusedExisting`、`pidKnown` 和安全错误摘要
- **AND** 响应 MUST NOT 包含完整 `CODEX_WEB_APP_SERVER_URL`

#### Scenario: 连接失败诊断
- **WHEN** Web 后端无法连接 app-server
- **THEN** 状态诊断 MUST 能区分连接超时、端口占用、握手失败、启动失败和锁陈旧等主要类别
- **AND** 错误信息 MUST 可用于中文文档中的排查流程


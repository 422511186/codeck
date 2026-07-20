# test-runtime-portability Specification

## Purpose
TBD - created by archiving change fix-transient-turn-error-recovery. Update Purpose after archive.
## Requirements
### Requirement: Unit tests are independent from the host machine

单元测试 SHALL 只依赖测试显式构造的输入和仓库声明的依赖。测试 MUST NOT 绑定用户名、HOME、固定盘符、固定 POSIX 临时目录、宿主 `NODE_ENV`、实际 Codex 安装路径或当前平台的进程包装形式。

#### Scenario: External production environment does not change tests
- **WHEN** 调用者 shell 设置 `NODE_ENV=production` 或其他非测试值
- **THEN** `npm run test` MUST 仍以 test 环境运行
- **AND** React 与 Testing Library MUST 使用可执行测试 API

#### Scenario: Paths are constructed portably
- **WHEN** 路径安全测试在不同操作系统或临时目录根上执行
- **THEN** fixture MUST 使用 `tmpdir()`、`join()`、`resolve()` 或等价结构化 API 构造路径
- **AND** 断言 MUST NOT 假设 `/tmp`、盘符或路径分隔符

#### Scenario: Process invocation assertions accept platform wrappers
- **WHEN** runtime 为同一受控 `codexBin` 使用直接执行或平台 wrapper
- **THEN** 测试 MUST 验证 app-server 子命令、listen endpoint 和生命周期结果
- **AND** MUST NOT 把实际 executable 名称绑定为当前电脑上的某一种包装形式

#### Scenario: Filesystem metadata assertions use portable semantics
- **WHEN** 文件初始化测试运行在 POSIX、Windows 或不同文件系统上
- **THEN** 测试 MUST 验证文件存在、类型和持久化内容
- **AND** MUST NOT 对跨平台含义不同的合成 POSIX mode 做精确等值断言


## ADDED Requirements

### Requirement: Production Build Produces Runtime Artifacts
项目 SHALL 提供第一版 release 所需的生产构建流程，生成 Next.js 生产产物和可由 Node.js 直接启动的自定义 server JavaScript 产物。

#### Scenario: Build creates Next and server artifacts
- **WHEN** 维护者在干净依赖环境中运行生产构建命令
- **THEN** 构建 MUST 完成类型检查并生成 `.next/` 生产产物
- **AND** 构建 MUST 生成可执行的自定义 server 产物，例如 `dist/server/http.js`

#### Scenario: Production start does not require tsx
- **WHEN** 使用 release 产物以 `NODE_ENV=production` 启动服务
- **THEN** 启动命令 MUST 使用 Node.js 运行已编译 JavaScript
- **AND** 生产启动 MUST NOT 依赖 `tsx` 或运行时 TypeScript 转译

### Requirement: Release Archive Contains Only Runtime Needed Files
项目 SHALL 提供第一版 release 打包流程，生成适合宿主机自托管部署的 tarball，并只包含运行和部署文档所需文件。

#### Scenario: Tarball includes runtime files
- **WHEN** 维护者运行 release 打包命令
- **THEN** 产物 MUST 包含 `.next/`、已编译 server、`public/`、`package.json`、lockfile、`.env.example`、README 和发布文档
- **AND** tarball 文件名 MUST 能表达版本或构建标识

#### Scenario: Tarball excludes local and sensitive files
- **WHEN** release tarball 生成完成
- **THEN** 产物 MUST NOT 包含 `.env`、`.env.*`、`node_modules/`、`logs/`、`uploads/`、`coverage/`、`test-results/`、`nohup.out` 或本地开发缓存

### Requirement: Release Verification Covers Build And Smoke Test
项目 SHALL 提供第一版 release 验证流程，覆盖自动化测试、生产构建和最小运行态 smoke test。

#### Scenario: Release verification succeeds before packaging
- **WHEN** 维护者准备发布 release
- **THEN** 验证流程 MUST 运行类型检查和单元测试
- **AND** 验证流程 MUST 运行生产构建

#### Scenario: Smoke test runs in mock mode
- **WHEN** release 产物被用于本机 smoke test
- **THEN** 服务 MUST 能在 `CODEX_WEB_APP_SERVER_MODE=mock` 和 `NODE_ENV=production` 下启动
- **AND** `/api/health` MUST 返回可用于确认服务可用的成功响应

### Requirement: Release Verification Is Isolated From Current Service
项目 SHALL 保证 release 构建、打包和运行态验证不会影响当前正在 `23000` 端口服务手机会话的实例。

#### Scenario: Smoke test uses a non-current port
- **WHEN** release smoke test 需要启动 Codex Web 服务
- **THEN** 验证流程 MUST 显式配置 `CODEX_WEB_BIND_PORT` 为非 `23000` 端口
- **AND** 验证流程 MUST NOT 绑定、复用或抢占 `23000` 端口

#### Scenario: Current service is not stopped during release verification
- **WHEN** 维护者执行 release 构建、打包或 smoke test
- **THEN** 验证流程 MUST NOT 停止、重启或杀死当前运行在 `23000` 端口的服务进程
- **AND** 验证流程 MUST 使用独立进程和独立端口完成运行态检查

### Requirement: Release Documentation Describes Host Deployment
项目 SHALL 提供中文发布文档，说明第一版 release 在宿主机上的部署、配置、启动、升级、回滚和安全边界。

#### Scenario: User deploys release on a host machine
- **WHEN** 用户阅读发布文档准备部署
- **THEN** 文档 MUST 说明 Node.js 版本要求、安装依赖、环境变量、启动命令和服务管理示例
- **AND** 文档 MUST 说明 `spawn` 和 `external` app-server 模式的适用场景

#### Scenario: User exposes service to a phone browser
- **WHEN** 用户希望从手机浏览器访问 Codex Web
- **THEN** 文档 MUST 说明 `CODEX_WEB_BIND_HOST`、`CODEX_WEB_BIND_PORT`、访问 token、workspace allowlist、上传目录和审计日志路径的配置方式
- **AND** 文档 MUST 提醒公网访问前需要 TLS、反向代理访问控制、IP allowlist 或更强认证

### Requirement: External Environment File Is Loaded By Launch Path
项目 SHALL 明确 `/etc/codex-web.env` 或等价外部环境文件必须由启动方式加载到进程环境中，而不是假定应用会自动扫描该路径。

#### Scenario: systemd loads environment file
- **WHEN** 用户使用 systemd 启动 release 服务
- **THEN** 文档和示例 unit MUST 包含 `EnvironmentFile=/etc/codex-web.env` 或等价配置
- **AND** 服务进程 MUST 能通过 `process.env` 读取 `CODEX_WEB_*` 配置

#### Scenario: shell launch loads environment file
- **WHEN** 用户不使用 systemd 而是通过 shell 手动启动 release 服务
- **THEN** 文档 MUST 提供先导出 `/etc/codex-web.env` 再执行生产启动命令的示例
- **AND** 文档 MUST 说明 Node.js/Next.js 不会自动读取 `/etc/codex-web.env`

#### Scenario: package scripts do not hide required environment loading
- **WHEN** release 包提供 `npm run start` 或等价启动命令
- **THEN** 启动命令 MUST 依赖已经注入的进程环境变量
- **AND** 文档 MUST 明确外部环境文件由 systemd、shell 启动脚本或部署平台负责加载

### Requirement: First Release Scope Excludes Docker Image Publishing
第一版 release SHALL 以宿主机 tarball 自托管为主路径，Docker 镜像发布不纳入本次交付范围。

#### Scenario: Release artifacts are inspected
- **WHEN** 第一版 release 构建完成
- **THEN** 产物 MUST NOT 要求 Docker 才能运行
- **AND** 产物 MUST NOT 宣称已经提供正式 Docker 镜像发布能力

#### Scenario: Docker is mentioned as future work
- **WHEN** 发布文档讨论容器化
- **THEN** 文档 SHALL 将 Docker 定位为后续阶段
- **AND** 文档 SHALL 说明后续 Docker 更适合搭配 `CODEX_WEB_APP_SERVER_MODE=external`

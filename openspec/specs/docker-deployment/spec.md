# docker-deployment Specification

## Purpose
TBD - created by archiving change add-docker-compose-deployment. Update Purpose after archive.
## Requirements
### Requirement: Docker Image Builds Production Runtime
项目 SHALL 提供生产 Docker 镜像构建方式，镜像内使用 Next.js 生产产物和已编译 server JavaScript 启动 codeck。

#### Scenario: Docker image builds from source
- **WHEN** 维护者在项目根目录运行 Docker 镜像构建命令
- **THEN** 构建 MUST 安装依赖并执行现有生产构建流程
- **AND** 镜像 MUST 包含 `.next/` 和 `dist/server/` 运行产物

#### Scenario: Docker runtime does not require development transpilers
- **WHEN** 容器以生产模式启动 codeck
- **THEN** 启动命令 MUST 使用 Node.js 运行已编译 JavaScript
- **AND** 运行镜像 MUST NOT 依赖 `tsx` 或运行时 TypeScript 转译

### Requirement: Docker Build Context Excludes Local And Sensitive Files
项目 SHALL 提供 Docker build context 排除规则，避免把本地依赖、运行数据、日志、上传文件、测试产物或敏感环境文件复制进镜像。

#### Scenario: Docker context is prepared
- **WHEN** Docker 构建读取项目上下文
- **THEN** 上下文 MUST 排除 `.env`、`.env.*`、`node_modules/`、`logs/`、`uploads/`、`coverage/`、`test-results/`、`nohup.out` 和本地开发缓存
- **AND** 上下文 MUST 保留构建所需源码、配置、lockfile、public assets 和 release 脚本

#### Scenario: Runtime image is inspected
- **WHEN** 维护者检查 Docker 运行镜像内容
- **THEN** 镜像 MUST NOT 包含真实本地环境文件或运行日志
- **AND** 镜像 MUST NOT 依赖宿主机 `node_modules/`

### Requirement: Docker Compose Provides Self-Hosted Deployment
项目 SHALL 提供 Docker Compose 部署示例，说明手机浏览器可访问的 Web 服务端口、环境变量、上传目录、审计日志和 workspace bind mount 配置。

#### Scenario: User starts service with Compose
- **WHEN** 用户根据文档创建本地 Compose 环境文件并运行 Compose 启动命令
- **THEN** Compose MUST 启动 codeck 容器
- **AND** 宿主机端口 MUST 映射到容器内 Web 服务端口
- **AND** 手机浏览器 MUST 能通过宿主机局域网 IP 和映射端口访问服务

#### Scenario: Compose loads environment explicitly
- **WHEN** 用户使用 Compose 部署 codeck
- **THEN** Compose 配置 MUST 通过 `env_file`、`environment` 或部署平台等启动层显式注入 `CODEX_WEB_*` 环境变量
- **AND** 文档 MUST 说明 Node.js、Next.js 和容器不会自动读取宿主机 `/etc/codex-web.env`

#### Scenario: Compose persists runtime data
- **WHEN** 用户重建或升级 codeck 容器
- **THEN** 上传目录和审计日志路径 MUST 通过 bind mount 或 Docker volume 持久化
- **AND** `CODEX_WEB_WORKSPACE_ROOTS` MUST 只指向用户允许 codeck 操作的 workspace 路径

#### Scenario: Compose constrains runtime resources and restarts safely
- **WHEN** 用户使用 Docker Compose 部署 codeck
- **THEN** Compose 配置 MUST 设置 `restart: unless-stopped`
- **AND** Compose 配置 MUST 提供可通过环境变量覆盖的内存限制
- **AND** Compose 配置 MUST 提供可通过环境变量覆盖的 memory-swap 限制
- **AND** Compose 配置 MUST 提供可通过环境变量覆盖的 CPU 限制
- **AND** 文档 MUST 说明修改资源限制后需要重新创建容器才会生效

### Requirement: Docker Compose Supports External App Server Mode
Docker Compose 部署 SHALL 默认推荐 `CODEX_WEB_APP_SERVER_MODE=external`，让 Web 容器连接宿主机或独立进程中的 Codex app-server。

#### Scenario: Container connects to host app-server
- **WHEN** 用户在宿主机启动 Codex app-server 并使用 Compose 启动 Web 容器
- **THEN** Compose 示例 MUST 配置 `CODEX_WEB_APP_SERVER_MODE=external`
- **AND** Compose 示例 MUST 配置 `CODEX_WEB_APP_SERVER_URL` 指向宿主机或独立 app-server 的 WebSocket 地址

#### Scenario: Linux host resolves host gateway
- **WHEN** 用户在 Linux Docker 环境中使用 Compose 连接宿主机 app-server
- **THEN** Compose 示例 MUST 提供 `host.docker.internal` 到 host gateway 的解析配置或等价说明
- **AND** 文档 MUST 说明 Docker Desktop 和 Linux 环境的差异

#### Scenario: Workspace paths remain consistent
- **WHEN** Web 容器使用 external app-server 并校验 workspace allowlist
- **THEN** 文档 MUST 推荐把宿主 workspace bind mount 到容器内相同绝对路径
- **AND** `CODEX_WEB_WORKSPACE_ROOTS` MUST 与 Web 容器和 app-server 都能访问的路径保持一致

### Requirement: Docker Verification Is Isolated From Current Service
项目 SHALL 提供 Docker/Compose 验证流程，并保证验证不会影响当前正在 `23000` 端口服务手机会话的实例。

#### Scenario: Docker smoke test uses non-current host port
- **WHEN** Docker smoke test 需要启动 codeck 容器
- **THEN** 验证流程 MUST 显式使用非 `23000` 的宿主机端口映射
- **AND** 默认端口选择 MUST 从 `23001` 起寻找可用端口并跳过 `23000`

#### Scenario: Docker smoke test runs in mock mode
- **WHEN** Docker smoke test 启动容器验证服务可用性
- **THEN** 容器 MUST 使用 `CODEX_WEB_APP_SERVER_MODE=mock`
- **AND** `/api/health` MUST 返回可用于确认服务可用的成功响应

#### Scenario: Current service is not controlled by Docker verification
- **WHEN** 维护者执行 Docker 构建、Compose 配置校验或 Docker smoke test
- **THEN** 验证流程 MUST NOT 停止、重启、杀死、绑定、复用或抢占当前运行在 `23000` 端口的服务进程
- **AND** 验证流程 MUST 只清理自己创建的容器、网络和临时目录

### Requirement: Docker Deployment Documentation Is Chinese And Complete
项目 SHALL 提供中文 Docker/Compose 部署文档，说明构建、配置、启动、验证、升级、回滚和安全边界。

#### Scenario: User reads Docker deployment documentation
- **WHEN** 用户阅读 Docker/Compose 部署文档
- **THEN** 文档 MUST 说明镜像构建命令、Compose 启动命令、环境变量示例、端口映射、数据持久化、workspace bind mount 和 app-server 模式
- **AND** 文档 MUST 说明 Docker 部署与宿主机 tarball 部署的区别和适用场景

#### Scenario: User exposes container service to phone browser
- **WHEN** 用户希望从手机浏览器访问 Compose 部署的 codeck
- **THEN** 文档 MUST 说明 `CODEX_WEB_BIND_HOST`、容器端口、宿主机端口映射、访问 token 和局域网访问方式
- **AND** 文档 MUST 提醒公网访问前需要 HTTPS/TLS、反向代理访问控制、IP allowlist 或更强认证


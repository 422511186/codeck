## MODIFIED Requirements

### Requirement: First Release Scope Excludes Docker Image Publishing
第一版 release SHALL 继续以宿主机 tarball 自托管为已完成主路径；Docker/Compose SHALL 作为后续新增部署路径提供，并且不得改变 tarball release 的可运行性、打包边界或验证隔离要求。

#### Scenario: First release artifacts are inspected
- **WHEN** 第一版 release tarball 构建完成
- **THEN** 产物 MUST NOT 要求 Docker 才能运行
- **AND** tarball 宿主机部署流程 MUST 继续可按发布文档独立完成

#### Scenario: Docker deployment is documented as an additional path
- **WHEN** Docker/Compose 部署能力完成后用户阅读发布文档
- **THEN** 文档 SHALL 将 Docker/Compose 说明为新增部署路径
- **AND** 文档 SHALL 不再把 Docker 仅描述为未提供的未来工作
- **AND** release tarball MUST 包含通用 Docker/Compose 部署所需的 `Dockerfile`、`.dockerignore`、`compose.yaml` 和 `.env.docker.example`

#### Scenario: Host and Docker release verification remain isolated
- **WHEN** 维护者执行 tarball release 验证或 Docker/Compose 验证
- **THEN** 两类验证流程 MUST 使用独立进程或容器完成运行态检查
- **AND** 两类验证流程 MUST NOT 停止、重启、绑定、复用或抢占当前运行在 `23000` 端口的服务

#### Scenario: Release tarball excludes real local environment files
- **WHEN** release tarball 生成完成
- **THEN** 产物 MUST NOT 包含真实本地环境文件 `.env` 或 `.env.docker`
- **AND** 产物 MAY 包含不含真实密钥的示例文件 `.env.example` 和 `.env.docker.example`

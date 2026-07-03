## Why

当前 release 只覆盖宿主机 tarball 部署，用户仍需要手工安装 Node.js、依赖和 systemd 服务。增加 Docker 和 Docker Compose 部署方式，可以降低自托管安装成本，并把运行环境、端口、卷挂载和 app-server 连接方式固化为可复现配置。

## What Changes

- 新增 Docker 镜像构建能力，提供适合生产运行的 `Dockerfile`、`.dockerignore` 和镜像内启动路径。
- 新增 Docker Compose 部署能力，提供可直接复制调整的 `compose.yaml` 示例、环境变量示例和卷挂载约定。
- 新增 Docker/Compose 的验证流程，构建和 smoke test 必须使用非 `23000` 端口，不能影响当前手机正在使用的服务。
- 更新中文部署文档，说明宿主机 tarball 与 Docker/Compose 两条部署路径的适用场景、配置方式、升级和回滚方式。
- 不改变现有 tarball release 流程；Docker 是新增部署方式，不替代当前宿主机部署。

## Capabilities

### New Capabilities

- `docker-deployment`: 定义 Docker 镜像构建、Docker Compose 部署、环境变量加载、卷挂载、app-server 模式、安全边界和隔离验证要求。

### Modified Capabilities

- `release-packaging`: 更新 release 文档和规格中关于 Docker 的定位，保留宿主机 tarball 路径，同时允许正式提供 Docker/Compose 部署文档和验证流程。

## Impact

- 新增或更新根目录部署文件：`Dockerfile`、`.dockerignore`、`compose.yaml`、`.env.docker.example` 或等价文件。
- 更新 `package.json` scripts，增加 Docker 构建和 Docker smoke test 入口。
- 更新 `docs/release.md`，必要时新增 `docs/docker-deployment.md` 并在 README 中链接。
- 可能新增 release 脚本和单元测试，用于校验 Docker 上下文、Compose 配置、敏感文件排除和端口隔离。
- 运行时仍依赖 `CODEX_WEB_*` 环境变量；容器内更推荐 `CODEX_WEB_APP_SERVER_MODE=external`，也可明确说明 `mock` 仅用于验证。

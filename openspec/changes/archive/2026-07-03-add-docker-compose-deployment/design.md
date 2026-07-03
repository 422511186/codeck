## Context

当前 release 已经具备宿主机 tarball 打包、生产启动和 mock 模式 smoke test。它适合直接在宿主机安装 Node.js 和 systemd 的场景，但用户还需要一套更低操作成本的 Docker/Compose 部署方式。

项目运行时包含两个边界：Codex Web 服务和 Codex app-server。容器化时如果把 Codex CLI、宿主工作区和 Web 服务全部塞进同一个容器，会放大权限、路径和登录态问题。因此 Docker 首版应把 Web 容器作为主要交付物，并优先连接宿主机或独立进程中的 app-server。

另一个约束是当前手机会话正在使用 `23000` 端口。所有 Docker 构建验证、Compose 验证和 smoke test 都不能停止、重启、绑定、复用或抢占 `23000`。

## Goals / Non-Goals

**Goals:**

- 提供生产可用的 Docker 镜像构建方式，镜像内使用已编译 server 和 Next.js 生产产物启动。
- 提供 Docker Compose 示例，覆盖环境变量、端口映射、上传目录、审计日志和 workspace bind mount。
- 明确容器内环境变量来源：由 Compose `env_file`、`environment` 或部署平台注入，不假定 Node.js 自动读取外部文件。
- 提供 Docker/Compose smoke test，默认使用 mock app-server 和非 `23000` 端口验证 `/api/health`。
- 更新中文发布文档，把宿主机 tarball 和 Docker/Compose 两条路径讲清楚。

**Non-Goals:**

- 不在本次实现中发布远端镜像仓库、自动打 tag 或推送 registry。
- 不在容器内默认安装、登录或托管 Codex CLI。
- 不引入 Kubernetes、Traefik/Caddy/Nginx 模板或公网 TLS 自动签发方案。
- 不改变移动端 Web 产品方向，也不新增桌面端布局。

## Decisions

1. 使用多阶段 `Dockerfile` 构建生产镜像。

   构建阶段运行 `npm ci` 和 `npm run build`，运行阶段只安装生产依赖并复制 `.next/`、`dist/server/`、`public/`、`package.json`、lockfile、`next.config.mjs` 和启动脚本。这样镜像不依赖 `tsx`，也不会把完整源码和开发依赖放进运行层。

   备选方案是先生成 tarball 再在 Dockerfile 中解包运行。该方案复用现有打包逻辑，但 Docker build 上下文和 tarball 生成顺序更绕，不利于普通用户直接 `docker build`。

2. Compose 默认采用 `CODEX_WEB_APP_SERVER_MODE=external`。

   Compose 示例通过 `CODEX_WEB_APP_SERVER_URL=ws://host.docker.internal:31317` 连接宿主机 app-server，并在 Linux 上配置 `extra_hosts: host.docker.internal:host-gateway`。这能保持 Codex CLI 登录态、终端权限和宿主工作区在宿主侧，容器只负责 Web 服务。

   备选方案是容器内 `spawn`。它要求镜像包含 Codex CLI、用户登录态、shell 环境和工作区权限，首版不默认支持；文档可以说明高级用户自行扩展镜像。

3. workspace bind mount 采用“同路径挂载”作为推荐方式。

   当 external app-server 在宿主机处理路径时，Web 容器和宿主 app-server 需要看到一致的绝对路径。Compose 文档应推荐把宿主 workspace 挂载到容器内相同路径，并把 `CODEX_WEB_WORKSPACE_ROOTS` 设置为该路径。

   备选方案是容器内使用不同路径再做映射，但这会让 Web 层和 app-server 层路径语义分裂，容易出现 allowlist 通过但 app-server 无法访问的情况。

4. Docker 配置文件使用示例 env 文件，不提交真实运行 env。

   提供 `.env.docker.example` 或等价文件，说明用户复制为本地 `.env.docker` 后由 Compose 加载。`.env.docker`、`.env`、日志、上传目录、缓存和 `node_modules` 必须被 `.gitignore`/`.dockerignore` 排除。

5. Docker smoke test 必须与当前服务隔离。

   新增验证脚本应构建本地镜像，以 mock 模式启动容器，并把容器内端口映射到宿主机非 `23000` 端口。默认从 `23001` 起寻找可用端口，并显式跳过 `23000`。测试结束只停止自己启动的容器。

## Risks / Trade-offs

- [Risk] Linux 上 `host.docker.internal` 默认不可用 -> Compose 示例使用 `extra_hosts: ["host.docker.internal:host-gateway"]`，文档说明 Docker Desktop 与 Linux 的差异。
- [Risk] workspace 路径在容器和宿主不一致 -> 文档要求 external 模式优先使用同路径 bind mount，并在示例中保持一致。
- [Risk] 镜像误包含敏感文件 -> 使用 `.dockerignore` allowlist/denylist，并增加测试检查 `.env`、日志、上传目录和本地缓存不会进入 Docker build 上下文或镜像。
- [Risk] Docker 验证影响手机当前会话 -> 验证脚本禁止使用 `23000`，只管理自己创建的容器、网络和临时目录。
- [Risk] 用户误以为 Docker 自动读取 `/etc/codex-web.env` -> 文档明确 Compose 只读取配置的 `env_file` 或 `environment`，容器内 Node.js 不会自动扫描宿主 `/etc` 文件。

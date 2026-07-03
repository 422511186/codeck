# Docker 和 Docker Compose 部署

本文档说明 Codex Web 的 Docker 镜像构建、Docker Compose 部署、验证、升级、回滚和安全边界。

宿主机 tarball 部署仍见 `docs/release.md`。Docker/Compose 是新增部署路径，不替代宿主机部署。

## 适用范围

Docker 首版推荐只把 Codex Web 放进容器：

- Web 容器运行 Next.js 生产产物和已编译 server。
- Codex app-server 推荐运行在宿主机或独立进程中。
- Web 容器通过 `CODEX_WEB_APP_SERVER_MODE=external` 连接 app-server。
- 手机浏览器通过宿主机局域网 IP 和 Compose 映射端口访问 Codex Web。

不建议首版在容器内默认 `spawn` Codex CLI。那会把 Codex 登录态、shell 环境、宿主工作区和执行权限都放入容器，需要额外镜像和权限设计。

## 前置条件

宿主机需要：

- Docker Engine 或 Docker Desktop。
- Docker Compose v2。
- 已安装并配置 Codex CLI，或已单独启动 Codex app-server。
- 一个只包含你愿意让 Codex Web 操作内容的 workspace 目录。

## 构建镜像

在项目根目录运行：

```bash
npm run docker:build
```

等价命令：

```bash
docker build -t codex-web:local -f Dockerfile .
```

如果 Docker Hub 访问不稳定，可以使用兼容 Docker Official Images 的公共镜像源作为基础镜像：

```bash
CODEX_WEB_DOCKER_NODE_IMAGE=public.ecr.aws/docker/library/node:22-bookworm-slim npm run docker:build
```

`Dockerfile` 使用多阶段构建：

- 构建阶段运行 `npm ci` 和 `npm run build`。
- 运行阶段只安装生产依赖并复制 `.next/`、`dist/server/`、`public/`、`scripts/`、`package.json`、`package-lock.json` 和 `next.config.mjs`。
- 容器启动使用 `npm run start`，不会依赖 `tsx` 或运行时 TypeScript 转译。

`.dockerignore` 会排除 `.env`、`.env.*`、`node_modules/`、日志、上传目录、测试产物和本地缓存，避免敏感文件进入 build context 或镜像。

## 准备环境文件

复制示例文件：

```bash
cp .env.docker.example .env.docker
```

编辑 `.env.docker`：

```env
CODEX_WEB_ACCESS_TOKEN=替换成你的登录token
CODEX_WEB_WORKSPACE_ROOTS=/home/你的用户名/workspace
CODEX_WEB_UPLOAD_DIR=/var/lib/codex-web/uploads
CODEX_WEB_AUDIT_LOG_PATH=/var/log/codex-web/audit.jsonl
CODEX_WEB_BIND_HOST=0.0.0.0
CODEX_WEB_BIND_PORT=3000
CODEX_WEB_APP_SERVER_MODE=external
CODEX_WEB_APP_SERVER_URL=ws://host.docker.internal:31317
CODEX_WEB_MEMORY_LIMIT=2g
CODEX_WEB_MEMORY_SWAP_LIMIT=2g
CODEX_WEB_CPU_LIMIT=2.0
```

`.env.docker` 是本地运行配置，已被 `.gitignore` 排除，不要提交。

Compose 需要显式加载环境文件。容器内 Node.js 和 Next.js 不会自动读取宿主机 `/etc/codex-web.env`，也不会自动扫描 `.env.docker`；必须由 Compose `env_file`、`environment` 或部署平台注入到进程环境。

## 启动 app-server

Docker Compose 示例默认使用 external 模式。先在宿主机启动 Codex app-server，例如：

```bash
codex app-server --listen ws://127.0.0.1:31317
```

Compose 中配置了：

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

这让 Linux Docker 环境中的容器可以通过 `host.docker.internal` 访问宿主机。Docker Desktop 通常已经支持这个名称；Linux Engine 需要 `host-gateway` 或等价网络配置。

## 启动 Web 容器

运行：

```bash
docker compose --env-file .env.docker up -d --build
```

查看状态：

```bash
docker compose ps
docker compose logs -f codex-web
```

`compose.yaml` 默认把宿主机 `3000` 端口映射到容器内 `3000` 端口。手机浏览器访问：

```text
http://<宿主机局域网 IP>:3000
```

登录 token 使用 `.env.docker` 中的 `CODEX_WEB_ACCESS_TOKEN`。

## 自动重启和资源限制

`compose.yaml` 默认配置：

```yaml
restart: unless-stopped
mem_limit: ${CODEX_WEB_MEMORY_LIMIT:-2g}
memswap_limit: ${CODEX_WEB_MEMORY_SWAP_LIMIT:-2g}
cpus: "${CODEX_WEB_CPU_LIMIT:-2.0}"
```

`restart: unless-stopped` 表示容器异常退出或 Docker daemon 重启后会自动拉起；如果你手动 `docker compose stop` 或 `docker compose down`，Docker 不会在未收到启动命令时强行恢复。

内存和 CPU 限制可以在 `.env.docker` 中调整：

```env
CODEX_WEB_MEMORY_LIMIT=2g
CODEX_WEB_MEMORY_SWAP_LIMIT=2g
CODEX_WEB_CPU_LIMIT=2.0
```

默认 `CODEX_WEB_MEMORY_SWAP_LIMIT` 与 `CODEX_WEB_MEMORY_LIMIT` 相同，表示不为容器额外放大 swap 总量。如果你明确希望允许更多 swap，可以把它调高；如果宿主机内存紧张，建议保持两者一致，避免容器占用过多 swap 影响整机响应。

修改资源限制后，需要重新创建容器才会生效：

```bash
docker compose --env-file .env.docker up -d
```

## workspace 挂载

external app-server 在宿主机处理路径，Web 容器也会校验 `CODEX_WEB_WORKSPACE_ROOTS`。推荐把宿主 workspace bind mount 到容器内相同的绝对路径：

```yaml
source: ${CODEX_WEB_WORKSPACE_ROOTS}
target: ${CODEX_WEB_WORKSPACE_ROOTS}
```

因此 `.env.docker` 里的 `CODEX_WEB_WORKSPACE_ROOTS` 应该是单个宿主机绝对路径，例如：

```env
CODEX_WEB_WORKSPACE_ROOTS=/home/你的用户名/workspace
```

如果需要多个 workspace root，需要在 Compose 里为每个绝对路径增加对应 bind mount，并确认宿主 app-server 也能访问相同路径。

## 数据持久化

Compose 使用 Docker volume 持久化：

- `codex-web-uploads` -> `/var/lib/codex-web/uploads`
- `codex-web-logs` -> `/var/log/codex-web`

对应环境变量：

```env
CODEX_WEB_UPLOAD_DIR=/var/lib/codex-web/uploads
CODEX_WEB_AUDIT_LOG_PATH=/var/log/codex-web/audit.jsonl
```

重建容器不会删除这些 volume。需要备份时使用 Docker volume 的标准备份流程。

## 验证

静态和单元测试：

```bash
npm run verify
```

Docker smoke test：

```bash
npm run docker:smoke
```

`docker:smoke` 会构建本地 smoke 镜像，以 `CODEX_WEB_APP_SERVER_MODE=mock` 启动临时容器，并访问 `/api/health`。

运行态验证必须使用非 `23000` 宿主机端口，不能影响当前正在 `23000` 端口服务手机会话的实例。默认从 `23001` 起寻找可用端口，并显式跳过 `23000`。如果需要指定端口：

```bash
CODEX_WEB_DOCKER_SMOKE_PORT=23002 npm run docker:smoke
```

不要把 `CODEX_WEB_DOCKER_SMOKE_PORT` 或 `CODEX_WEB_BIND_PORT` 设置为 `23000`。

如果 Docker Hub 拉取基础镜像超时，可以同样指定基础镜像源：

```bash
CODEX_WEB_DOCKER_NODE_IMAGE=public.ecr.aws/docker/library/node:22-bookworm-slim npm run docker:smoke
```

## 升级

拉取或解包新版本后：

```bash
npm run docker:build
docker compose --env-file .env.docker up -d --build
```

如果使用自定义镜像 tag，可以先构建：

```bash
docker build -t codex-web:0.1.1 -f Dockerfile .
```

然后更新 `compose.yaml` 中的 `image`，再执行：

```bash
docker compose --env-file .env.docker up -d
```

## 回滚

把 `compose.yaml` 中的 `image` 改回上一版 tag，然后运行：

```bash
docker compose --env-file .env.docker up -d
```

如果使用本地源码构建，回到上一版源码或 release tag 后重新构建：

```bash
npm run docker:build
docker compose --env-file .env.docker up -d
```

## 停止

停止 Web 容器：

```bash
docker compose down
```

这不会删除 named volumes。需要删除持久化数据时才使用：

```bash
docker compose down -v
```

## 安全边界

Codex Web 当前是个人自用模式，不包含多用户隔离、数据库权限模型或公网账号系统。公网访问前必须额外配置：

- HTTPS / TLS。
- 反向代理访问控制。
- IP allowlist 或 VPN。
- 更强认证策略。

不要把未加保护的容器服务直接暴露到公网。`CODEX_WEB_WORKSPACE_ROOTS` 只应配置你愿意让 Codex Web 操作的目录。

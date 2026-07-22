# Docker 和 Docker Compose 部署

本文档说明如何用预构建的 Codex Web 镜像通过 Docker 或 Docker Compose 完成自托管部署。

只讲部署。如何构建镜像、验证和 smoke test 见仓库的开发文档，不在本文范围内。
宿主机 tarball 部署见 `docs/release.md`。

## 镜像地址

预构建镜像发布在阿里云容器镜像服务：

```text
registry.cn-shanghai.aliyuncs.com/huangzhenyu_2532/codex-web
```

拉取指定版本（推荐固定 tag）：

```bash
docker pull registry.cn-shanghai.aliyuncs.com/huangzhenyu_2532/codex-web:0.1.0
```

## 适用范围

Docker 部署推荐只把 Codex Web 放进容器：

- Web 容器运行 Next.js 生产产物和已编译 server。
- Codex app-server 推荐运行在宿主机或独立进程中。
- Web 容器通过 `CODEX_WEB_APP_SERVER_MODE=external` 连接 app-server。
- 手机浏览器通过宿主机局域网 IP 和映射端口访问 Codex Web。

不建议在容器内默认 `spawn` Codex CLI。那会把 Codex 登录态、shell 环境、宿主工作区和执行权限都放入容器，需要额外镜像和权限设计。

## 前置条件

宿主机需要：

- Docker Engine 或 Docker Desktop。
- Docker Compose v2。
- 已安装并配置 Codex CLI，或已单独启动 Codex app-server。
- 一个只包含你愿意让 Codex Web 操作内容的 workspace 目录。

## 安全边界

Codex Web 当前是个人自用模式，不包含多用户隔离、数据库权限模型或公网账号系统。公网访问前必须额外配置：

- HTTPS / TLS。
- 反向代理访问控制。
- IP allowlist 或 VPN。
- 更强认证策略。

不要把未加保护的容器服务直接暴露到公网。`CODEX_WEB_WORKSPACE_ROOTS` 只应配置你愿意让 Codex Web 操作的目录。

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
# 图片和普通文件附件暂存目录，应用会清理超过 24 小时的上传。
CODEX_WEB_AUDIT_LOG_PATH=/var/log/codex-web/audit.jsonl
CODEX_WEB_DATA_DIR=/var/lib/codex-web/data
CODEX_WEB_BIND_HOST=0.0.0.0
CODEX_WEB_BIND_PORT=3000
CODEX_WEB_APP_SERVER_MODE=external
CODEX_WEB_APP_SERVER_URL=ws://host.docker.internal:31317
CODEX_WEB_MEMORY_LIMIT=2g
CODEX_WEB_MEMORY_SWAP_LIMIT=2g
CODEX_WEB_CPU_LIMIT=2.0
```

`.env.docker` 是本地运行配置，不要提交到仓库。

容器内 Node.js 和 Next.js 不会自动读取宿主机 `/etc/codex-web.env`，也不会自动扫描 `.env.docker`；环境变量必须由 Compose `env_file`、`environment`、`docker run --env-file` 或部署平台注入到进程环境。

## 启动 app-server

先在宿主机启动 Codex app-server，例如：

```bash
codex app-server --listen ws://127.0.0.1:31317
```

容器通过 `host.docker.internal` 访问宿主机上的 app-server。Docker Desktop 通常已经支持这个名称；Linux Engine 需要 `host-gateway` 或等价网络配置（Compose 示例已配置 `extra_hosts`）。

## 方式一：Docker Compose（推荐）

`compose.yaml` 默认使用本地构建。使用预构建镜像时，把 `image` 指向阿里云地址并去掉 `build`，例如：

```yaml
services:
  codex-web:
    image: registry.cn-shanghai.aliyuncs.com/huangzhenyu_2532/codex-web:0.1.0
    restart: unless-stopped
    init: true
    env_file:
      - .env.docker
    ports:
      - "3000:3000"
    volumes:
      - codex-web-data:/var/lib/codex-web/data
```

启动：

```bash
docker compose --env-file .env.docker up -d
```

查看状态：

```bash
docker compose ps
docker compose logs -f codex-web
```

Compose 默认把宿主机 `3000` 端口映射到容器内 `3000` 端口。手机浏览器访问：

```text
http://<宿主机局域网 IP>:3000
```

登录 token 使用 `.env.docker` 中的 `CODEX_WEB_ACCESS_TOKEN`。

### 自动重启和资源限制

`compose.yaml` 默认配置：

```yaml
restart: unless-stopped
mem_limit: ${CODEX_WEB_MEMORY_LIMIT:-2g}
memswap_limit: ${CODEX_WEB_MEMORY_SWAP_LIMIT:-2g}
cpus: "${CODEX_WEB_CPU_LIMIT:-2.0}"
```

`restart: unless-stopped` 表示容器异常退出或 Docker daemon 重启后会自动拉起；手动 `docker compose stop` 或 `docker compose down` 后不会强行恢复。

内存和 CPU 限制可以在 `.env.docker` 中调整：

```env
CODEX_WEB_MEMORY_LIMIT=2g
CODEX_WEB_MEMORY_SWAP_LIMIT=2g
CODEX_WEB_CPU_LIMIT=2.0
```

默认 `CODEX_WEB_MEMORY_SWAP_LIMIT` 与 `CODEX_WEB_MEMORY_LIMIT` 相同，表示不为容器额外放大 swap 总量。如果宿主机内存紧张，建议保持两者一致，避免容器占用过多 swap 影响整机响应。

修改资源限制后，需要重新创建容器才会生效：

```bash
docker compose --env-file .env.docker up -d
```

## 方式二：docker run

不使用 Compose 时可以直接运行：

```bash
docker run -d \
  --name codex-web \
  --restart unless-stopped \
  --env-file .env.docker \
  -p 3000:3000 \
  --add-host host.docker.internal:host-gateway \
  -v codex-web-uploads:/var/lib/codex-web/uploads \
  -v codex-web-logs:/var/log/codex-web \
  -v codex-web-data:/var/lib/codex-web/data \
  -v "$CODEX_WEB_WORKSPACE_ROOTS:$CODEX_WEB_WORKSPACE_ROOTS" \
  registry.cn-shanghai.aliyuncs.com/huangzhenyu_2532/codex-web:0.1.0
```

`workspace` 目录建议 bind mount 到容器内相同的绝对路径，与宿主机 app-server 保持一致。

## workspace 挂载

external app-server 在宿主机处理路径，Web 容器也会校验 `CODEX_WEB_WORKSPACE_ROOTS`。推荐把宿主 workspace bind mount 到容器内相同的绝对路径：

```yaml
volumes:
  - type: bind
    source: ${CODEX_WEB_WORKSPACE_ROOTS}
    target: ${CODEX_WEB_WORKSPACE_ROOTS}
```

因此 `.env.docker` 里的 `CODEX_WEB_WORKSPACE_ROOTS` 应该是单个宿主机绝对路径，例如：

```env
CODEX_WEB_WORKSPACE_ROOTS=/home/你的用户名/workspace
```

如果需要多个 workspace root，需要为每个绝对路径增加对应 bind mount，并确认宿主 app-server 也能访问相同路径。

## 数据持久化

Compose 使用 Docker volume 持久化：

- `codex-web-uploads` -> `/var/lib/codex-web/uploads`
- `codex-web-logs` -> `/var/log/codex-web`
- `codex-web-data` -> `/var/lib/codex-web/data`

对应环境变量：

```env
CODEX_WEB_UPLOAD_DIR=/var/lib/codex-web/uploads
CODEX_WEB_AUDIT_LOG_PATH=/var/log/codex-web/audit.jsonl
CODEX_WEB_DATA_DIR=/var/lib/codex-web/data
```

`codex-web-data` 中包含自定义模型目录 `custom-models.json` 和已有会话模型绑定 `thread-model-bindings.json`。重建容器不会删除这些 volume；多个 Web 实例共享同一目录时，底层存储必须支持可靠的独占创建、原子 rename 和 fsync 语义，不能使用破坏这些语义的对象存储挂载。

备份前停止目录 mutation 和模型切换，再执行：

```bash
docker run --rm \
  -v codex-web-data:/data:ro \
  -v "$PWD:/backup" \
  alpine tar -czf /backup/codex-web-data.tgz -C /data .
```

恢复时先停止 Web 容器，使用同一 schema 兼容版本将备份解压回 volume，然后再启动服务。不要只恢复 `custom-models.json` 而遗漏绑定文件，否则已有自定义会话会按 Codex 目录模型解释。

## 大窗口模型前置条件

自定义模型窗口默认 `200000`，可配置到 `1000000`。当窗口大于 `272000` 时，保存目录仍然允许，但新建会话、已有会话切换和重新应用配置前，模型标识必须精确存在于 app-server `model/list` 权威目录。部署侧需要在 Codex 配置中维护该目录；Codex Web 不会写入或热重载 `model_catalog_json`。

## 升级

升级前先备份 `codex-web-data`。如果新版本引入了绑定 schema 变化，必须先确认回滚版本仍能读取当前 schema。

拉取新版本镜像后重新创建容器：

```bash
docker pull registry.cn-shanghai.aliyuncs.com/huangzhenyu_2532/codex-web:0.1.1
```

Compose：把 `image` tag 改为新版本，然后运行：

```bash
docker compose --env-file .env.docker up -d
```

docker run：停止并删除旧容器后，用新 tag 重新 `docker run`：

```bash
docker rm -f codex-web
docker run -d ... registry.cn-shanghai.aliyuncs.com/huangzhenyu_2532/codex-web:0.1.1
```

## 回滚

把镜像 tag 改回上一版，然后重新创建容器：

```bash
# Compose：改回上一版 tag 后
docker compose --env-file .env.docker up -d
```

named volume 中的上传和日志数据不受镜像回滚影响。

`codex-web-data` 同样不会随镜像回滚自动删除。回滚前应停止自定义目录 mutation 和模型切换；如果旧后端不认识当前 binding schema，先在新版本中把活跃自定义会话显式切回 Codex 目录模型，或保留能够读取当前 schema 的兼容后端。不要通过删除绑定文件强行回滚，这会让已有会话失去来源身份和恢复快照。

## 停止

停止 Web 容器：

```bash
docker compose down
```

这不会删除 named volumes。需要删除持久化数据时才使用：

```bash
docker compose down -v
```

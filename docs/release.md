# 宿主机部署（release tarball）

本文档说明如何用 codeck 的 release tarball 在宿主机上完成自托管部署。

只讲部署。如何构建、验证和打包 release 见仓库的开发文档，不在本文范围内。
容器化部署见 `docs/docker-deployment.md`。

## 适用范围

release tarball 面向个人自托管场景：

- 在宿主机上直接运行 codeck 生产产物。
- 宿主机已安装 Node.js 22 或更高版本。
- 宿主机已安装并配置 Codex CLI，或已单独启动 Codex app-server。
- 手机浏览器通过局域网或受控反向代理访问 codeck。

tarball 内已包含 `.next/`、`dist/server/` 等构建产物，解压后无需再执行任何构建步骤，只需安装生产依赖并配置环境变量即可启动。

## 安全边界

codeck 当前是个人自用模式，不包含多用户隔离、数据库权限模型或公网账号系统。公网访问前必须额外配置：

- HTTPS / TLS。
- 反向代理访问控制。
- IP allowlist 或 VPN。
- 更强认证策略。

不要把未加保护的服务直接暴露到公网。

## 校验 tarball

部署前建议先校验压缩包完整性：

```bash
sha256sum -c codex-web-v0.1.0.tar.gz.sha256
```

输出 `OK` 表示 tarball 未损坏。

## 宿主机部署

示例目录：

```bash
sudo mkdir -p /opt/codex-web/releases
sudo tar -xzf codex-web-v0.1.0.tar.gz -C /opt/codex-web/releases
sudo ln -sfn /opt/codex-web/releases/codex-web-v0.1.0 /opt/codex-web/current
cd /opt/codex-web/current
npm ci --omit=dev
```

`npm ci --omit=dev` 只安装运行时依赖，不会安装构建工具。

创建环境文件，例如 `/etc/codex-web.env`：

```env
CODEX_WEB_ACCESS_TOKEN=替换成你的登录token
CODEX_WEB_WORKSPACE_ROOTS=/home/你的用户名/workspace
CODEX_WEB_UPLOAD_DIR=/var/lib/codex-web/uploads
CODEX_WEB_AUDIT_LOG_PATH=/var/log/codex-web/audit.jsonl
CODEX_WEB_BIND_HOST=0.0.0.0
CODEX_WEB_BIND_PORT=3000
CODEX_WEB_APP_SERVER_MODE=spawn
CODEX_WEB_CODEX_BIN=codex
```

`/etc/codex-web.env` 不会被 Node.js 或 Next.js 自动读取，必须由启动层加载到进程环境中。手动启动时先用 shell 导出变量；systemd 启动时使用 `EnvironmentFile=/etc/codex-web.env`。

启动：

```bash
set -a
. /etc/codex-web.env
set +a
npm run start
```

如果只是本机反向代理访问，可以把 `CODEX_WEB_BIND_HOST` 设为 `127.0.0.1`。

## systemd 示例

```ini
[Unit]
Description=codeck
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/codex-web/current
EnvironmentFile=/etc/codex-web.env
ExecStart=/usr/bin/npm run start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

启用：

```bash
sudo systemctl daemon-reload
sudo systemctl enable codex-web
sudo systemctl start codex-web
sudo systemctl status codex-web
```

## 手机浏览器访问

局域网访问通常需要：

```env
CODEX_WEB_BIND_HOST=0.0.0.0
CODEX_WEB_BIND_PORT=3000
```

然后在手机浏览器打开：

```text
http://<宿主机局域网 IP>:3000
```

登录 token 使用 `CODEX_WEB_ACCESS_TOKEN`。如果未配置该变量，服务会在启动时生成临时 token 并打印到控制台；生产部署建议显式配置固定 token。

`CODEX_WEB_WORKSPACE_ROOTS` 只应配置你愿意让 codeck 操作的目录。多个目录用英文分号分隔。

## app-server 模式

### spawn

默认模式：

```env
CODEX_WEB_APP_SERVER_MODE=spawn
CODEX_WEB_CODEX_BIN=codex
CODEX_WEB_APP_SERVER_HOST=127.0.0.1
# CODEX_WEB_APP_SERVER_PORT=31317
```

Web 后端会按需启动本机 `codex app-server`。如果 `codex` 不在 PATH 中，设置 `CODEX_WEB_CODEX_BIN` 为绝对路径。`spawn` 只表示当前 Web 后端拥有这个子进程，适合单个本机服务；如果同一机器启动了多个 Web 后端，不要假设它们会自动复用同一个 app-server。

### external

如果你已经自行启动 app-server，或者需要多个 Web 后端复用同一个 app-server：

```env
CODEX_WEB_APP_SERVER_MODE=external
CODEX_WEB_APP_SERVER_URL=ws://127.0.0.1:31317
```

### spawn-or-connect

本机开发可用自动复用模式：

```env
CODEX_WEB_APP_SERVER_MODE=spawn-or-connect
CODEX_WEB_CODEX_BIN=codex
CODEX_WEB_APP_SERVER_HOST=127.0.0.1
CODEX_WEB_APP_SERVER_PORT=31317
# 可选，保存跨进程锁、owner pid 和 endpoint 元数据
CODEX_WEB_APP_SERVER_STATE_DIR=/tmp/codex-web-app-server
```

该模式在固定 host/port 上先连接已有 app-server；不可连接时才获取跨进程锁并启动。拿不到锁的 Web 后端会等待持锁进程启动完成后复用同一 endpoint。若固定端口被非 app-server 占用或握手失败，启动会失败并提示端口问题，不会改用随机端口。

Web 后端正常退出时会关闭自己启动的子进程并清理 owner 元数据。异常退出后留下的可用 app-server 会被后续 Web 后端复用；不可用且 owner pid 已不存在时，陈旧锁会被清理后重新启动。

## 升级与回滚

推荐使用版本化目录：

```text
/opt/codex-web/releases/codex-web-v0.1.0
/opt/codex-web/releases/codex-web-v0.1.1
/opt/codex-web/current -> /opt/codex-web/releases/codex-web-v0.1.1
```

升级：

```bash
sudo tar -xzf codex-web-v0.1.1.tar.gz -C /opt/codex-web/releases
cd /opt/codex-web/releases/codex-web-v0.1.1
npm ci --omit=dev
sudo ln -sfn /opt/codex-web/releases/codex-web-v0.1.1 /opt/codex-web/current
sudo systemctl restart codex-web
```

回滚：

```bash
sudo ln -sfn /opt/codex-web/releases/codex-web-v0.1.0 /opt/codex-web/current
sudo systemctl restart codex-web
```

## 常见问题

### 启动时报找不到 codex

确认宿主机已安装 Codex CLI，并设置：

```env
CODEX_WEB_CODEX_BIN=/path/to/codex
```

或者改用 external 模式。

### 手机无法访问

检查：

- `CODEX_WEB_BIND_HOST=0.0.0.0`
- 防火墙允许 `CODEX_WEB_BIND_PORT`
- 手机和宿主机在同一网络
- 访问地址使用宿主机局域网 IP

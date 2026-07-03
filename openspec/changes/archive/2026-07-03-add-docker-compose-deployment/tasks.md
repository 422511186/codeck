## 1. 测试与约束准备

- [x] 1.1 为 Docker 配置新增单元测试，校验 `.dockerignore` 排除 `.env`、`.env.*`、`node_modules/`、`logs/`、`uploads/`、`coverage/`、`test-results/`、`nohup.out` 和本地缓存。
- [x] 1.2 为 Docker smoke 端口选择新增单元测试，确认默认从 `23001` 起寻找可用端口并显式跳过 `23000`。
- [x] 1.3 为 Compose 示例新增静态校验测试，确认使用 `CODEX_WEB_APP_SERVER_MODE=external`、显式环境变量加载、数据卷挂载和 `host.docker.internal` host gateway 配置。

## 2. Docker 镜像实现

- [x] 2.1 新增多阶段 `Dockerfile`，构建阶段运行 `npm ci` 和 `npm run build`，运行阶段只保留生产依赖与运行所需产物。
- [x] 2.2 新增 `.dockerignore`，排除本地依赖、敏感环境文件、日志、上传目录、测试产物和缓存，同时保留构建所需源码、配置、lockfile 和 public assets。
- [x] 2.3 确认容器启动命令使用 `npm run start` 或 `node scripts/start-production.mjs`，生产运行不依赖 `tsx`。

## 3. Docker Compose 部署配置

- [x] 3.1 新增 `compose.yaml`，提供 Codex Web 服务、端口映射、`env_file`、持久化目录、workspace bind mount 和 host gateway 配置。
- [x] 3.2 新增 `.env.docker.example`，说明 `CODEX_WEB_ACCESS_TOKEN`、`CODEX_WEB_WORKSPACE_ROOTS`、`CODEX_WEB_UPLOAD_DIR`、`CODEX_WEB_AUDIT_LOG_PATH`、`CODEX_WEB_BIND_HOST`、`CODEX_WEB_BIND_PORT`、`CODEX_WEB_APP_SERVER_MODE` 和 `CODEX_WEB_APP_SERVER_URL`。
- [x] 3.3 更新 `.gitignore`，确保本地 `.env.docker`、Compose 临时数据、日志和上传目录不会被提交。
- [x] 3.4 为通用 Compose 和当前生产 Compose 配置 `restart: unless-stopped`、内存限制、memory-swap 限制和 CPU 限制，并允许通过环境变量覆盖。

## 4. Docker 验证脚本

- [x] 4.1 新增 Docker smoke 脚本，构建本地镜像并以 `CODEX_WEB_APP_SERVER_MODE=mock` 启动临时容器。
- [x] 4.2 Docker smoke 脚本必须把容器端口映射到非 `23000` 宿主机端口，并只清理自己创建的容器和临时目录。
- [x] 4.3 更新 `package.json` scripts，增加 `docker:build`、`docker:smoke` 或等价命令，并将必要验证接入 release 验证说明。
- [x] 4.4 将 Docker/Compose 部署必需文件纳入 release tarball allowlist，并通过测试确认 release 包内文档引用的 Docker 文件实际存在。

## 5. 中文文档

- [x] 5.1 新增或更新中文 Docker/Compose 部署文档，说明镜像构建、Compose 启动、环境变量加载、端口映射、数据持久化、workspace bind mount 和 app-server 模式。
- [x] 5.2 更新 `docs/release.md`，把 Docker/Compose 改为新增部署路径，同时保留宿主机 tarball 部署为已完成路径。
- [x] 5.3 更新 `README.md` 的发布/部署入口，链接宿主机 release 文档和 Docker/Compose 部署文档。
- [x] 5.4 文档必须明确 Docker/Compose 验证和本地 smoke test 不能停止、重启、绑定、复用或抢占当前 `23000` 服务。
- [x] 5.5 文档必须说明 Docker Compose 的自动重启策略、默认资源限制、覆盖方式和重新创建容器后生效的要求。

## 6. 最终验证

- [x] 6.1 运行 `npm run verify`，确认类型检查和单元测试通过。
- [x] 6.2 运行 `npm run build`，确认生产构建通过。
- [x] 6.3 在非 `23000` 端口运行 Docker smoke test，确认 `/api/health` 可访问且不影响当前手机服务。
- [x] 6.4 运行 `openspec validate add-docker-compose-deployment --strict`，确认 OpenSpec change 有效。

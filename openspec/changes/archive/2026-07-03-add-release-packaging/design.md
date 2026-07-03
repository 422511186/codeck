## Context

项目当前是 Next.js 16 app router + 自定义 Node HTTP server 的组合。`src/server/http.ts` 负责加载运行时环境、准备 Next 应用、挂载浏览器 WebSocket，并连接 Codex app-server runtime。现有 `package.json` 中 `build` 只执行 `npm run typecheck`，`start` 使用 `tsx src/server/http.ts`，因此当前运行方式更接近开发部署，不适合作为第一版 release。

第一版 release 的核心用户是个人自托管用户：在一台已经安装 Node.js 和 Codex CLI 的宿主机上运行 Codex Web，并从手机浏览器访问该服务。服务仍依赖本机 workspace、Codex 配置、上传目录和审计日志目录，所以第一版优先采用宿主机 tarball 部署，而不是 Docker 镜像。

## Goals / Non-Goals

**Goals:**

- 提供可重复执行的生产构建流程：类型检查、Next 生产构建、自定义 server 编译。
- 提供可直接部署的 release tarball，包含运行所需文件和中文部署文档。
- 生产启动使用 Node.js 运行编译后的 JavaScript，不依赖 `tsx`。
- 提供本地 release 验证路径：`npm run verify`、生产构建、mock 模式 smoke test。
- release 验证必须隔离当前正在 `23000` 端口服务手机会话的实例，不停止、不重启、不抢占该端口。
- 文档覆盖宿主机部署、局域网手机访问、安全边界、升级和回滚。
- 明确 `/etc/codex-web.env` 等外部环境文件必须由 systemd、shell 启动脚本或部署平台加载到进程环境中，应用不会自动扫描该路径。

**Non-Goals:**

- 不在第一版提供 Docker 镜像发布。
- 不改变 Codex app-server 协议、不改变现有 API 行为、不引入数据库或多用户权限模型。
- 不把服务设计成公网多租户产品；公网访问仍需要额外反向代理、TLS、IP allowlist 或更强认证。
- 不把 `node_modules/` 打进 release 包；目标机器通过 lockfile 安装生产依赖。

## Decisions

### Decision: 第一版采用宿主机 tarball 发布

第一版 release 产物采用 `codex-web-v<version>.tar.gz` 或等价命名，包含 `.next/`、已编译 server、`public/`、`package.json`、`package-lock.json`、`.env.example`、README 和 `docs/release.md`。

选择原因：

- 与项目个人自用定位一致，目标机器通常已经具备 Codex CLI、Codex 登录态和 workspace。
- 避免 Docker 首版必须处理宿主机文件挂载、用户权限、Codex 配置、登录态和 app-server 访问方式。
- tarball 便于 systemd/pm2 管理，也便于通过替换目录实现升级和回滚。

备选方案：

- Docker 镜像：后续可以做，但第一版会扩大环境边界。
- 纯源码包：简单但不满足生产构建和可验证 release 的目标。

### Decision: 自定义 server 单独编译到 `dist/server/http.js`

生产启动应使用 `node dist/server/http.js` 或等价路径。Next 继续通过 `.next/` 提供生产构建产物，自定义 HTTP/WebSocket server 通过独立构建配置编译为 ESM JavaScript。

选择原因：

- 保留现有自定义 server 架构，避免重写 WebSocket 和 Next upgrade 处理。
- 移除生产运行对 `tsx` 的依赖，降低启动路径的不确定性。
- 与当前 `"type": "module"` 保持一致。

备选方案：

- 使用 `next start`：不适合当前自定义 WebSocket 和 HTTP server 入口。
- 继续用 `tsx`：部署简单，但不符合正式 release 对生产产物的预期。

### Decision: release 包不包含 `node_modules/`

release tarball 带 lockfile，由目标机器执行 `npm ci --omit=dev` 安装生产依赖。

选择原因：

- 包体更小，避免跨平台 native dependency 或 Node ABI 问题。
- lockfile 提供可复现依赖解析。
- 与 Node.js Web 项目常规部署方式一致。

备选方案：

- 打包 `node_modules/`：省去目标机器安装步骤，但容易引入平台差异和体积问题。

### Decision: smoke test 使用 mock app-server 模式

release smoke test 使用 `CODEX_WEB_APP_SERVER_MODE=mock` 和 `NODE_ENV=production` 启动服务，并检查 `/api/health`。

选择原因：

- 不要求测试环境有真实 Codex 登录态或真实 app-server。
- 能验证生产构建产物、server 启动、环境加载和基础 API 可用性。
- 真实 `spawn`/`external` 验收仍放到人工部署文档中。

备选方案：

- 每次 release 强制真实 app-server 集成测试：覆盖更深，但对发布环境要求过高，容易误失败。

### Decision: release 验证必须使用非 `23000` 端口

当前开发/协作会话依赖正在 `23000` 端口运行的服务，release 构建和验证不得中断该实例。所有需要启动服务的 release smoke test 必须显式配置 `CODEX_WEB_BIND_PORT` 为非 `23000` 端口，例如固定使用 `23001`，或由脚本探测可用端口后注入环境变量。验证脚本不得通过杀进程、重启服务或复用 `23000` 的方式完成检查。

选择原因：

- 用户当前通过手机浏览器连接现有服务，停止或抢占 `23000` 会直接中断当前对话和操作。
- 独立端口验证可以同时检查 release 产物，又不影响现有服务。
- 端口隔离是本项目移动端自用场景下的发布安全底线。

备选方案：

- 复用 `23000` 做 smoke test：会影响当前服务，不接受。
- 先停止当前服务再启动 release 产物：验证更接近真实切换，但不适合当前在线协作场景。

### Decision: Docker 只记录为后续阶段

第一版文档可以解释 Docker 未来方向，但不交付正式镜像。后续 Docker 更适合让 Web 容器连接宿主机或独立进程中的 `external` app-server，而不是在容器内隐式管理 Codex CLI、登录态和 workspace。

选择原因：

- 明确首版边界，优先让宿主机部署稳定。
- 避免用户误以为 Docker 是首版受支持路径。

### Decision: 外部环境文件由启动层加载

应用当前通过 `process.env` 和项目目录 `.env*` 获取配置，不会自动扫描 `/etc/codex-web.env`。因此第一版 release 不能只告诉用户“创建 `/etc/codex-web.env`”，还必须提供能加载该文件的启动方式：

- systemd 部署使用 `EnvironmentFile=/etc/codex-web.env`。
- shell 手动启动使用 `set -a; . /etc/codex-web.env; set +a` 或等价方式导出变量。
- `npm run start` 或 `node dist/server/http.js` 只负责启动应用，默认读取已经注入的进程环境。

选择原因：

- 保持应用配置读取逻辑简单，不引入固定 Linux 路径作为应用层默认配置源。
- 符合 systemd 和 shell 部署的常规约定。
- 避免用户误以为 `/etc/codex-web.env` 只要存在就会被 Node.js 自动读取。

备选方案：

- 在应用代码中固定读取 `/etc/codex-web.env`：会把 Linux system path 写入应用逻辑，不适合跨平台，也会与现有 `.env` 加载行为混杂。
- 提供 wrapper 启动脚本自动读取 `/etc/codex-web.env`：可以作为可选增强，但仍需要文档说明 systemd/shell 的加载边界。

## Risks / Trade-offs

- [Risk] 目标机器 `npm ci --omit=dev` 需要网络或可用 npm 缓存 → Mitigation：文档说明依赖安装前置条件，后续可考虑离线包或镜像源说明。
- [Risk] Next 生产构建与自定义 server 编译输出路径不一致导致启动失败 → Mitigation：构建脚本和 smoke test 必须同时验证 `.next/` 与 `dist/server/http.js`。
- [Risk] release smoke test 误用 `23000` 端口导致当前手机会话中断 → Mitigation：脚本和文档必须强制使用非 `23000` 端口，并禁止停止或重启当前服务进程。
- [Risk] 用户创建 `/etc/codex-web.env` 但服务读取不到配置 → Mitigation：systemd 示例必须包含 `EnvironmentFile`，shell 示例必须显式导出该文件，文档说明应用不会自动扫描 `/etc/codex-web.env`。
- [Risk] 用户在公网直接暴露服务 → Mitigation：发布文档必须强调个人模式安全边界，并明确 TLS、反向代理访问控制和 IP allowlist 要求。
- [Risk] `spawn` 模式依赖目标机器 PATH 中存在 `codex` → Mitigation：文档说明 `CODEX_WEB_CODEX_BIN` 和 `external` 模式 fallback。
- [Risk] release 包排除规则误打包敏感文件 → Mitigation：打包脚本使用明确 allowlist，而不是宽泛复制整个项目目录。

## Migration Plan

1. 新增生产构建和 server 编译脚本。
2. 调整 `start` 为生产启动命令，并保留 `dev` 作为源码开发入口。
3. 新增 release 打包脚本，使用 allowlist 复制运行文件并生成 tarball。
4. 新增 mock 模式 smoke test 命令或文档化 smoke test 步骤，明确使用非 `23000` 端口并不得影响当前运行实例。
5. 新增 `docs/release.md`，明确 `/etc/codex-web.env` 由 systemd `EnvironmentFile`、shell 导出或部署平台注入。
6. 在 README 中加入发布文档入口。
7. 本地验证：`npm run verify`、生产构建、release 打包、解包后 smoke test。

回滚策略：

- 如果生产启动或打包脚本出现问题，保留现有 `npm run dev` 源码运行方式作为临时回退。
- 部署层面建议 release 解包到版本化目录，通过 systemd `WorkingDirectory` 或 symlink 切换版本，失败时切回上一版本目录。

## Open Questions

- server 编译工具优先选择 `tsc`、`tsup` 还是 `esbuild`，实现阶段应以最少依赖和 ESM 兼容性为准。
- release tarball 是否需要在第一版生成 checksum；如果成本低，可以一并提供。
- smoke test 是否需要新增自动脚本，还是先在文档中提供命令序列；实现阶段可根据复杂度决定。

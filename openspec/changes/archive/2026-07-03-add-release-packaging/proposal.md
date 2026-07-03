## Why

当前项目已经具备移动端 Web 与后端代理能力，但发布形态仍停留在源码开发运行：`npm run build` 只做类型检查，`npm run start` 仍依赖 `tsx` 运行 TypeScript 源码。第一版 release 需要提供可复现、可验证、可部署的生产包，让个人自托管用户能在宿主机上稳定运行 Codex Web。

这次变更优先解决“如何打包并部署第一版 release”的基础问题，不把 Docker 作为第一版主路径，避免过早引入 Codex CLI、用户配置、workspace 挂载和文件权限的复杂度。

## What Changes

- 新增生产构建流程，生成 Next.js 生产产物和可由 Node.js 直接运行的自定义 server 产物。
- 调整发布启动约定，使生产启动不再依赖运行时 TypeScript 转译。
- 新增 release 打包能力，生成第一版宿主机自托管 tarball，并排除 `.env`、日志、上传目录、本地缓存、测试结果和依赖目录。
- 新增 release 验证流程，覆盖类型检查、单元测试、生产构建和 mock 模式 smoke test。
- 新增 release 验证隔离约束：构建、打包和 smoke test 期间不得停止、重启、占用或影响当前正在 `23000` 端口服务手机会话的实例；运行态验证必须使用非 `23000` 端口。
- 明确外部环境文件加载边界：如果文档推荐 `/etc/codex-web.env`，必须同时提供 systemd `EnvironmentFile` 或 shell 导出方式，不能假定应用会自动读取该路径。
- 新增中文发布文档，说明环境要求、配置项、打包、部署、启动、升级、回滚和安全边界。
- 第一版不新增 Docker 镜像发布；Docker 仅作为后续阶段设计方向记录。

## Capabilities

### New Capabilities

- `release-packaging`: 定义第一版 release 的生产构建、打包产物、部署文档和发布验证要求。

### Modified Capabilities

## Impact

- 影响 `package.json` scripts：`build`、`start` 以及可能新增的 `release`、`smoke` 或 server 编译脚本。
- 可能新增 server 编译配置，例如 `tsconfig.server.json`、`tsup.config.ts` 或等价构建配置。
- 可能新增 release 打包脚本，例如 `scripts/build-release.*` 或 `scripts/pack-release.*`。
- 影响 Next.js 生产构建产物和自定义 server 启动方式。
- 新增或更新中文文档，例如 `docs/release.md` 和 README 中的发布入口说明。
- 发布验证脚本和文档必须显式避开当前服务端口 `23000`，避免影响通过手机访问的现有会话。
- 发布文档和启动示例必须说明 `/etc/codex-web.env` 由启动层加载到进程环境，应用不会自动扫描该路径。
- 影响 CI/本地验证命令，但不改变移动端 Web 产品边界，不改变现有 API 行为，不改变 Codex app-server 协议行为。

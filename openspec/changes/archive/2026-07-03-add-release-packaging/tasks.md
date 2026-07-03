## 1. 构建入口

- [x] 1.1 确认 server 编译工具方案，优先选择最少配置且兼容 ESM 的方案，并在 `package.json` 中显式声明所需 devDependency
- [x] 1.2 新增 server 编译配置或脚本，将 `src/server/http.ts` 构建为 `dist/server/http.js` 或等价生产入口
- [x] 1.3 调整 `package.json` scripts，使 `npm run build` 执行类型检查、`next build` 和 server 编译
- [x] 1.4 调整 `npm run start` 为生产启动命令，使用 Node.js 运行已编译 server，并保留 `npm run dev` 作为开发入口
- [x] 1.5 验证生产启动路径不依赖 `tsx` 或运行时 TypeScript 转译

## 2. Release 打包

- [x] 2.1 新增 release 打包脚本，使用 allowlist 收集 `.next/`、已编译 server、`public/`、`package.json`、lockfile、`.env.example`、README 和发布文档
- [x] 2.2 确保打包脚本排除 `.env`、`.env.*`、`node_modules/`、`logs/`、`uploads/`、`coverage/`、`test-results/`、`nohup.out` 和本地开发缓存
- [x] 2.3 让 release tarball 文件名包含版本号或构建标识，例如来自 `package.json` version
- [x] 2.4 如实现成本低，生成 release tarball 的 checksum；否则在文档中明确第一版暂不提供 checksum

## 3. Release 验证

- [x] 3.1 新增或文档化 release 验证命令，覆盖 `npm run verify`、`npm run build` 和 release 打包
- [x] 3.2 新增 mock 模式 smoke test 命令或脚本，以 `CODEX_WEB_APP_SERVER_MODE=mock` 和 `NODE_ENV=production` 启动 release 产物
- [x] 3.3 smoke test 必须显式使用非 `23000` 的 `CODEX_WEB_BIND_PORT`，不得停止、重启、复用或抢占当前运行在 `23000` 的服务
- [x] 3.4 smoke test 检查对应非 `23000` 端口上的 `/api/health` 成功响应，并在完成后只清理本次验证启动的独立进程
- [x] 3.5 补充必要的脚本单元测试或轻量验证，覆盖打包 allowlist、敏感文件排除规则和 smoke test 端口隔离规则
- [x] 3.6 验证 release 文档或启动示例不会暗示应用自动读取 `/etc/codex-web.env`，而是通过启动层注入进程环境

## 4. 发布文档

- [x] 4.1 新增 `docs/release.md`，用中文说明第一版 release 的适用范围、环境要求和非目标
- [x] 4.2 在发布文档中说明宿主机部署流程：安装依赖、配置 `.env`、启动服务、systemd/pm2 示例
- [x] 4.3 在发布文档中说明手机浏览器访问配置：`CODEX_WEB_BIND_HOST`、`CODEX_WEB_BIND_PORT`、访问 token、workspace allowlist、上传目录和审计日志路径
- [x] 4.4 在发布文档中说明 `spawn` 与 `external` app-server 模式、`CODEX_WEB_CODEX_BIN` 和常见排障路径
- [x] 4.5 在发布文档中说明升级、回滚和安全边界，明确公网访问前需要 TLS、反向代理访问控制、IP allowlist 或更强认证
- [x] 4.6 在发布文档中明确 release 验证不得影响当前 `23000` 服务，所有 smoke test 示例必须使用非 `23000` 端口
- [x] 4.7 在发布文档中将 Docker 定位为后续阶段，并说明后续 Docker 更适合搭配 `CODEX_WEB_APP_SERVER_MODE=external`
- [x] 4.8 在 README 中增加发布文档入口，保持 README 正文为中文
- [x] 4.9 在发布文档中明确 `/etc/codex-web.env` 必须由 systemd `EnvironmentFile`、shell 导出或部署平台加载，并提供 systemd 与 shell 示例

## 5. 验收

- [x] 5.1 运行 `npm run verify`
- [x] 5.2 运行 `npm run build`，确认 `.next/` 和 `dist/server/http.js` 或等价 server 产物存在
- [x] 5.3 运行 release 打包命令，检查 tarball 内容符合 allowlist 且不包含敏感或本地文件
- [x] 5.4 解包 release tarball，在临时目录执行生产依赖安装和 mock 模式 smoke test，确认验证端口不是 `23000`
- [x] 5.5 执行验收期间确认当前 `23000` 服务未被停止、重启或占用，手机会话不受影响
- [x] 5.6 人工复核 `docs/release.md` 覆盖宿主机部署、局域网手机访问、升级回滚、安全边界和 `23000` 端口保护要求
- [x] 5.7 运行 `openspec validate add-release-packaging --strict`
- [x] 5.8 人工复核 `docs/release.md` 中 `/etc/codex-web.env` 的说明，确认用户能理解该文件不会被应用自动扫描

# Repository Guidelines

## 项目结构与模块组织

本仓库是移动端 Web 项目，默认面向手机浏览器，不做桌面端布局。主要源码在 `src/`：

- `src/app/`：Next App Router 页面与 API routes，页面文件使用 `page.tsx`，接口文件使用 `route.ts`。
- `src/web/`：前端组件、状态、API client、主题与本地存储。
- `src/server/`：HTTP/WebSocket 服务、Codex app-server 连接、鉴权、安全与审计逻辑。
- `src/shared/`：前后端共享类型与工具。
- `tests/unit/` 与 `tests/integration/`：Vitest 单元测试和集成测试。
- `docs/`：人工文档与生成协议文件；`docs/generated/` 下内容视为机器生成。
- `openspec/`：需求、设计与变更归档。

## 构建、测试与开发命令

- `npm run dev`：启动本地开发服务。
- `npm run typecheck`：执行 TypeScript 严格类型检查。
- `npm run test`：运行 Vitest 测试套件。
- `npm run test:watch`：以 watch 模式运行测试。
- `npm run verify`：先类型检查再跑测试，提交前优先使用。
- `npm run build`：构建 Next 前端与 server bundle。
- `npm run release:verify`：发布前完整验证、构建、打包与 smoke 测试。

## 编码风格与命名约定

项目使用 TypeScript、ES modules、React 19 与严格类型检查。保持现有 2 空格缩进和双引号风格。React 组件使用 PascalCase，例如 `ChatInput.tsx`；普通工具函数和变量使用 camelCase；API 路由遵循 Next 目录约定。优先使用 `@/` 与 `@/web/` 路径别名。不要手改 `docs/generated/` 下的协议产物。

## 测试指南

测试框架为 Vitest，默认 `jsdom` 环境，初始化文件为 `tests/setup.ts`。测试命名使用 `*.test.ts` 或 `*.test.tsx`，按领域放入 `tests/unit/` 或 `tests/integration/`。新增业务逻辑应补充邻近测试；涉及真实 app-server 的集成测试需显式启用相关环境变量，避免默认验证误失败。

## 提交与 PR 指南

Git 历史同时使用 `fix: ...`、`feat: ...`、`docs: ...` 等前缀和简短祈使句。推荐格式为 `<type>: 中文说明`，例如 `fix: 修复移动端输入区布局`。PR 应说明变更目的、关键实现、验证命令；涉及 UI 时附手机视口截图；有关需求变更时链接对应 `openspec/changes/...` 或 issue。

## 文档、配置与安全约定

所有人工编写文档必须使用中文，包括 `README.md`、`docs/` 下设计/实施/测试/部署说明。代码标识符、命令、路径、第三方包名和外部错误输出可保留原文。配置以 `.env.example` 为准，敏感 token 不提交。涉及文件系统或终端能力时，必须尊重 `CODEX_WEB_WORKSPACE_ROOTS`、审计日志和访问控制边界。

## 1. 服务端项目目录

- [x] 1.1 为共享项目类型、路径规范化、服务端目录 schema 和错误码补充单元测试
- [x] 1.2 实现 `ProjectCatalogStore` 的初始化、校验、原子写入、文件锁、revision 冲突和单调 `lastUsedAt`
- [x] 1.3 实现项目目录 runtime 单例并确认数据只写入 `CODEX_WEB_DATA_DIR/projects.json`

## 2. 服务端项目 API

- [x] 2.1 为项目目录 collection、item、touch 和默认存储位置 routes 编写认证、校验、冲突与审计测试
- [x] 2.2 实现 `/api/codex/projects*` routes、workspace allowlist 校验和稳定错误响应
- [x] 2.3 验证移除项目只删除目录记录，不调用文件系统删除或 thread API

## 3. 客户端数据层

- [x] 3.1 更新本地项目存储测试，覆盖旧 schema 迁移为 `client`、保留 ID upsert 和路径冲突
- [x] 3.2 扩展 Web API client，支持读取/创建/重命名/删除/touch 项目及修改共享默认值
- [x] 3.3 实现客户端与服务端项目合并、排序、路径碰撞检测和服务端失败的部分降级状态

## 4. 项目管理界面

- [x] 4.1 更新项目页测试，覆盖双存储标识、共享默认值、新增选择器、服务端错误和重试
- [x] 4.2 实现项目页合并列表、服务端项目操作、全局 touch 和新增项目双存储流程
- [x] 4.3 实现保留 ID 的存储位置移动、失败回滚和同路径显式冲突处理
- [x] 4.4 更新项目会话页，使其在本地查找失败时从服务端目录解析项目 ID

## 5. 设置与文档

- [x] 5.1 更新设置页测试并增加“项目”分组的服务端共享默认存储位置选择器
- [x] 5.2 更新 README、`.env.example` 或部署文档中 `CODEX_WEB_DATA_DIR/projects.json` 的持久化与备份说明
- [x] 5.3 核对 ADR、术语表与 OpenSpec artifacts 的术语、错误语义和迁移规则一致

## 6. 验证

- [x] 6.1 运行项目目录、routes、项目页、项目会话页和设置页相关 Vitest 测试
- [x] 6.2 运行 `npm run typecheck` 和 `npm run verify`
- [x] 6.3 运行 `openspec validate add-server-project-storage --strict` 并确认所有任务完成

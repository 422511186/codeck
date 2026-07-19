## 1. 共享契约与运行时配置

- [x] 1.1 先为 `ModelSelection`、`CustomModelConfig`、统一目录条目、绑定快照、操作记录和稳定错误终态补充共享类型编译测试与边界 fixture
- [x] 1.2 在 `src/shared/` 定义来源敏感模型契约、catalog/binding schema version、switch outcome 与错误 code，并保持前后端使用同一类型
- [x] 1.3 先为 `CODEX_WEB_DATA_DIR` 默认值、绝对路径解析和浏览器不可覆盖路径补充 runtime config 单元测试
- [x] 1.4 在 `src/config/env.ts`、`.env.example` 与 `.gitignore` 增加 `CODEX_WEB_DATA_DIR`，默认使用项目 `data/` 且不提交运行时 JSON

## 2. 自定义模型校验与目录存储

- [x] 2.1 先为默认 200000 窗口、1..1000000 范围、model/label 长度、text/image 模态、开放 reasoning、默认档位和 200 条上限补充失败测试
- [x] 2.2 实现纯自定义模型规范化与完整校验器，拒绝 provider、URL、凭据、控制字符、重复 model 和非法交叉字段
- [x] 2.3 先为目录文件首次初始化、schema/revision 校验、损坏失败关闭、临时文件原子替换和锁内重读补充文件系统测试
- [x] 2.4 选择并接入跨平台跨进程文件锁实现，覆盖锁超时与 stale 恢复；不得只使用进程内 mutex
- [x] 2.5 实现 `custom-models.json` store 的读取、创建、完整替换和删除，以及成功后 revision 递增
- [x] 2.6 为并发 mutation、revision 冲突返回最新完整目录、写入失败保留旧文件和达到上限后仍可编辑删除补充集成测试

## 3. 自定义模型 API 与统一目录

- [x] 3.1 先为自定义目录 GET/POST/PUT/DELETE 的认证、malformed JSON、字段错误、404、409 和完整目录响应补充 route 测试
- [x] 3.2 实现 `/api/codex/custom-models` 与 `/{customModelId}` routes，PUT 使用完整替换，所有 mutation 要求 `expectedRevision`
- [x] 3.3 先为 app-server 模型适配保留真实 `model`、来源身份、精确同名覆盖、大小写差异和自定义优先顺序补充测试
- [x] 3.4 扩展 app-server model adapter 和 `GET /api/codex/models`，由后端输出统一目录与 `catalogRevision`
- [x] 3.5 为大于 272000 的未知模型阻断、已存在 app-server 权威条目放行，以及不修改 `model_catalog_json` 补充测试并实现目录前置检查

## 4. 会话模型绑定与操作日志存储

- [x] 4.1 先为 `thread-model-bindings.json` schema、bindingVersion、provider 排除、绑定快照和 operation old/target 状态补充单元测试
- [x] 4.2 实现独立 binding store 的读取、原子 mutation、按 threadId 查询、创建替换、删除、fork 复制和 reasoning 更新
- [x] 4.3 先为操作记录先写后提交、进程中断残留、损坏失败关闭及目录 revision 不受绑定 mutation 影响补充文件系统测试
- [x] 4.4 实现 operation 的 begin/commit/retain/clear API，并确保绑定提交和 operation 清除在一次原子文件替换中完成
- [x] 4.5 为 Web delete 清理、archive 保留、无绑定旧会话不自动认领和明确不存在 thread 的孤儿绑定审计清理补充测试

## 5. App-server 模型运行时原语

- [x] 5.1 先为 thread start/resume 透传 `model`、`modelProvider`、`model_context_window`、reasoning 及 app-server 目标省略窗口覆盖补充 client/runtime 测试
- [x] 5.2 扩展 gateway start/resume 输入和返回类型，使调用方可设置覆盖并核验实际 model/provider/reasoning
- [x] 5.3 先为读取 Codex 当前 provider、loaded idle thread unsubscribe 后冷 resume、running/其他订阅者导致覆盖未生效补充 mock app-server 测试
- [x] 5.4 实现当前 provider 解析、thread 空闲检查、取消订阅与冷 resume 原语，并将返回不一致暴露为稳定核验失败

## 6. 统一模型切换状态机

- [x] 6.1 先为 `expectedCatalogRevision`、当前来源身份、reasoning 和 bindingVersion 的锁内前置校验及过期 409 补充服务测试
- [x] 6.2 实现按 threadId 串行的 switch service，并保证所有前置校验发生在 operation 写入和 unsubscribe 之前
- [x] 6.3 先为 running turn 409、已知用量达到目标 90% 阻断、未知用量放行和不自动 compact 补充容量预检测试
- [x] 6.4 实现目标解析、reasoning 沿用/默认规则、容量预检和自定义/app-server 窗口覆盖策略
- [x] 6.5 先为 custom→custom、custom→app-server、app-server→custom、同名不同来源和重新应用配置补充成功路径测试
- [x] 6.6 实现 operation 写入、unsubscribe、target resume、model/provider 核验、目标 binding 提交或移除，并仅返回 `200 switched` 后更新状态
- [x] 6.7 先为目标失败后旧状态恢复的 `502 recovered`、双重失败的 `500 recovery_failed`、operationId 关联和最新状态响应补充失败路径测试
- [x] 6.8 实现旧状态恢复、阻塞状态以及稳定 HTTP/outcome/error code 映射，禁止通过错误文本判断终态
- [x] 6.9 先为残留 operation 下次访问自动恢复、“恢复原模型”和“重试目标模型”使用原快照补充重启恢复测试
- [x] 6.10 实现 `/api/codex/threads/{threadId}/model/switch` 与恢复 API，并在 operation 清除前阻止 resume 正常完成和 turn start

## 7. Thread 生命周期集成

- [x] 7.1 先为结构化默认选择解析、自定义 thread/start 直接传目标配置、失效默认回退和返回前提交 binding 补充 route/gateway 测试
- [x] 7.2 修改 thread start API 与前端创建流，禁止“先默认创建再切换”，并在自定义 start 成功后写绑定
- [x] 7.3 先为自定义绑定 resume 使用当前 provider 与快照窗口/reasoning、app-server 无绑定兼容和 pending operation 阻塞补充测试
- [x] 7.4 集成 binding-aware resume，并保证无绑定旧会话即使同名也继续作为 app-server 来源
- [x] 7.5 先为 fork 继承独立 bindingVersion、archive/unarchive 保留和 delete 清理 binding/operation 补充生命周期测试
- [x] 7.6 将绑定语义接入 fork、rollback 后续、archive/unarchive 和 delete，保持原 timeline 与分页行为不变
- [x] 7.7 先为 settings route 拒绝 model、custom reasoning ack 后更新 binding、失败不更新 binding 补充测试
- [x] 7.8 从普通 thread settings model 更新中移除模型切换路径，并原子同步自定义绑定的 reasoning 与 bindingVersion

## 8. 前端 API、设备默认与状态模型

- [x] 8.1 先为旧 localStorage 模型字符串迁移成 app-server 身份、不可解析清除、同名自定义不自动迁移补充存储测试
- [x] 8.2 实现带 schema version 的设备默认 `ModelSelection` 存储与失效默认清理
- [x] 8.3 扩展前端 API client 解析完整目录、catalog 409、switch 200/409/502/500 和恢复终态，非 2xx 仍保留结构化 response body
- [x] 8.4 扩展 thread store 保存当前来源身份、bindingVersion、sourceUpdatedAt、pending/recovery_failed 状态和标称窗口
- [x] 8.5 为切换成功才提交 UI、recovered 保持旧模型、recovery_failed 禁止发送和过期 409 保留草稿补充 store/page 测试

## 9. 手机端自定义模型管理

- [x] 9.1 先为设置页新增自定义模型入口且仍不显示 provider、URL、凭据或其他管理能力补充组件测试
- [x] 9.2 实现 `/settings/custom-models` 手机列表页，显示 label、model、窗口和能力摘要并支持加载、空状态、错误与重试
- [x] 9.3 先为创建/编辑表单默认值、完整校验、开放 reasoning、字段级错误、revision 冲突保留表单补充交互测试
- [x] 9.4 实现创建与编辑表单，使用文本输入、数值输入、image 开关、reasoning 列表和默认值选择，不暴露 provider 字段
- [x] 9.5 先为删除确认、已有绑定不受影响说明、成功后完整目录刷新和冲突处理补充测试
- [x] 9.6 实现列表编辑/删除图标、确认对话框和基于服务端完整目录响应的状态替换

## 10. 会话模型选择与恢复 UI

- [x] 10.1 先为选择器“当前会话/自定义/Codex”分组、label/model 搜索、管理图标、同名临时项和每次打开刷新补充移动组件测试
- [x] 10.2 重构 composer 模型选择器使用统一目录与来源身份，选择只调用后端 switch，不再调用 settings model update
- [x] 10.3 先为 reasoning 仅在当前模型下展示、保留精确未知值、配置更新时间提示和“重新应用”补充交互测试
- [x] 10.4 实现 reasoning 选择与配置重新应用入口，并在绑定已是最新时避免无效重建
- [x] 10.5 先为 text-only 切换保留草稿图片并阻止发送、移除图片或切回 image 后恢复、历史图片不阻断补充测试
- [x] 10.6 实现基于当前绑定能力的草稿兼容状态和发送门禁，不清除文本、图片或 Skill
- [x] 10.7 先为配置/实际窗口偏差、provider 重建后旧观察失效和实际窗口驱动进度补充 thread view 测试
- [x] 10.8 实现上下文偏差展示与审计触发，保持目录标称值不被 token usage 回写
- [x] 10.9 先为 recovery_failed 保留历史草稿、禁用发送、恢复原模型和重试目标模型补充页面测试
- [x] 10.10 实现阻塞恢复界面和两个恢复命令，失败时不提供忽略继续路径

## 11. 审计、安全与部署文档

- [x] 11.1 先为目录 mutation、switch request/result、binding update/recover 的 operationId、revision、bindingVersion 和敏感字段脱敏补充审计测试
- [x] 11.2 接入新增审计 action 与 context mismatch 诊断，确保不记录 base URL、token、secret、header 或环境变量值
- [x] 11.3 为浏览器路径注入、数据文件权限边界、损坏文件、锁超时和多实例共享目录补充安全与集成测试
- [x] 11.4 更新 `.env.example`、README、中文部署/测试文档和 Docker volume 示例，说明 `CODEX_WEB_DATA_DIR`、272k 大窗口前置条件、备份与回滚流程

## 12. 验证与验收

- [x] 12.1 运行自定义目录、binding store、app-server client/runtime、thread lifecycle、API routes、前端存储与组件的定向 Vitest
- [x] 12.2 运行 `npm run typecheck` 与 `npm run test`，修复所有回归且不改动生成协议文件
- [x] 12.3 运行 `npm run build`，验证 Next routes 与 server bundle 均包含新增数据目录和 switch 模块
- [x] 12.4 启动本地服务，使用 mock 或隔离 app-server 验证创建 `mimo-v2.5-pro`、新会话直启、老会话切换、重启恢复、fork、删除和失败回滚
- [x] 12.5 使用 Playwright 在 390px 手机视口验证设置列表、创建编辑、目录冲突、模型分组、草稿图片门禁、上下文偏差和 recovery_failed，保存截图到 `artifacts/screenshots/`
- [x] 12.6 运行 `openspec validate add-custom-model-catalog --strict`、`npm run verify` 并自审 diff，确认未引入 provider 管理、自动 compact 或通用模型字符串推断

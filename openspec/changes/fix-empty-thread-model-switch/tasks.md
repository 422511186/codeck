## 1. 权限快照与恢复基础

- [x] 1.1 为 binding operation 权限快照补充失败测试，覆盖完整三元组、旧记录兼容和非法字段失败关闭
- [x] 1.2 扩展共享类型与 binding store 校验/写入逻辑，使新 operation 持久化完整 `permissionSelection`
- [x] 1.3 为 app-server resume 权限覆盖补充失败测试，并让 `ThreadRuntimeOverrides` 与 resume 参数携带权限三元组

## 2. 空会话模型切换状态机

- [x] 2.1 为未物化空会话成功切模补充失败测试，证明使用 settings update、保持订阅并在核验后提交 binding
- [x] 2.2 实现权威空会话判定与原地模型设置/无覆盖 resume 核验路径
- [x] 2.3 为目标失败原地回滚与双重失败保留 operation 补充失败测试并实现稳定终态
- [x] 2.4 补充已有历史会话继续冷 resume 且携带权限快照的回归测试
- [x] 2.5 让重启恢复、显式恢复和旧状态回滚复用 operation 中的权限快照

## 3. Timeline 提示分层

- [x] 3.1 为 warning system entry 与紧凑 error alert 补充失败渲染测试
- [x] 3.2 扩展 timeline system kind 并实现紧凑 warning 与“操作失败” error 组件
- [x] 3.3 将模型前置条件、已恢复切换失败和权限更新失败迁移为 warning，并保持 `recovery_failed` 阻塞错误语义

## 4. 验证与交付

- [x] 4.1 运行切换服务、binding store、app-server resume、会话页和 timeline 组件定向测试
- [x] 4.2 运行 `npm run verify`、`npm run build`、`openspec validate fix-empty-thread-model-switch --strict` 与 `git diff --check`
- [x] 4.3 启动本地服务，在 390px 手机视口验证新空会话切模、权限保持以及 warning/error 视觉和控制台状态

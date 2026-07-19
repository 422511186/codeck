## 1. Runtime identity and materialization

- [x] 1.1 先为 `AppServerGateway` 的 start/resume/settings identity 登记、元数据补全和最新 turn 状态读取编写失败测试
- [x] 1.2 实现按 thread ID 登记运行时 model/provider/reasoning，并在 settings notification 与成功 update 后更新登记
- [x] 1.3 暴露有界的 materialization 查询，区分无 turn、已有 turn 和无法确认三种结果；元数据读取不得伪造未知运行时身份

## 2. Empty-thread model switching

- [x] 2.1 先补充空会话目标切换、目标失败原地恢复、双失败保留 operation 的失败测试，证明不会调用 `resumeThread` 或 `unsubscribe`
- [x] 2.2 修改 `ThreadModelSwitchService`，先读取元数据和 materialization 状态；空会话只执行 settings update 与登记状态核验，历史会话保持冷 resume
- [x] 2.3 更新 pending operation recovery，使空会话恢复复用原地路径，并保持完整权限快照与 `recovery_failed` 语义

## 3. Server model state

- [x] 3.1 为新建空会话的 thread detail/API 编写失败测试，要求返回当前 app-server modelState 及完整模型能力
- [x] 3.2 在 lifecycle service 中用 gateway runtime identity 与 app-server model list 构造目录驱动的 modelState，并覆盖默认 Xhigh 但支持多档的场景

## 4. Frontend reasoning capabilities

- [x] 4.1 为会话页空状态和 reasoning picker 编写失败测试，验证 `gpt-5.6-sol` 显示 low/medium/high/xhigh/max/ultra 且当前值仅为选中项
- [x] 4.2 让会话页按当前来源身份合并统一模型目录能力；服务端缺少完整 state 时不得从当前 effort 构造单项列表
- [x] 4.3 保持 custom binding 能力优先级、未知模型原始 effort 保留和无 effort 模型隐藏 chip 的现有行为

## 5. Persisted warning recovery

- [x] 5.1 为 `Heads up: Long threads and multiple compactions...` 的刷新恢复、空白归一化、重复来源去重和真实 error 保留编写失败测试
- [x] 5.2 扩展历史 warning 识别器，将匹配文案转为 app-server warning notice，并保持实时 warning 与真实 turn error 语义不变

## 6. Verification

- [x] 6.1 运行 runtime、switch service、lifecycle route、timeline adapter、store 和会话页定向测试
- [x] 6.2 运行 `npm run verify`、`npm run build`、`openspec validate fix-empty-thread-model-controls --strict` 与 `git diff --check`
- [x] 6.3 检查变更 diff，确认没有修改 e3 配置、生成协议文件或引入敏感信息

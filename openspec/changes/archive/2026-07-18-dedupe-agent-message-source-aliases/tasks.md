## 1. 来源证据与共享 alias resolver

- [x] 1.1 先为显式 ID raw-response 仍保留 `sourceLocator`，以及 resolver 的相等、前缀、跨 turn、双 canonical、冲突和歧义边界补充失败测试
- [x] 1.2 实现 raw-response provenance 保留与共享纯 agent alias resolver，保持现有强 `identityKey` 不变

## 2. Server overlay 收敛

- [x] 2.1 先为 raw→canonical、canonical→raw、snapshot/overlay 刷新和同 turn 两条正式同文消息补充失败测试
- [x] 2.2 在 runtime overlay 使用 resolver 消费 provisional/raw alias，并以 canonical ID、完整正文和最早位置原位收敛

## 3. Web timeline engine 收敛

- [x] 3.1 先将不同 ID 的 live provisional→canonical agent 回归测试改为只保留 canonical 一条，并保留 reasoning、跨 turn、双 canonical 与歧义候选的独立性测试
- [x] 3.2 实现有界 per-turn provisional agent ledger、双向 alias 协调、canonical re-key、revision/sequence 索引迁移与 generation/terminal/delete 清理
- [x] 3.3 增加 `agentAliasReconciliations`、`agentAliasAmbiguities` 等诊断，并验证冲突 fail closed 与 bounded repair 语义

## 4. 验证与真实会话验收

- [x] 4.1 运行 app-server event/runtime、timeline engine、Store 和展示相关定向测试
- [x] 4.2 运行全量 `npm run verify`、`npm run build` 与 `openspec validate dedupe-agent-message-source-aliases --strict`
- [x] 4.3 重启开发服务，在当前真实会话验证发送完成、刷新与 repair 后 assistant 回复只显示一次，并确认桌面和 390px 视口无回归
- [x] 4.4 自审 diff，确认未引入通用文本去重、未修改 reasoning/tool/diff 身份规则，并复核全部 tasks 已完成

## 5. History snapshot 与 completed overlay 物化收敛

- [x] 5.1 先补失败测试，复现 e3 的 `item-*` history agent/user 与 `msg_*`/UUID completed overlay 同 turn、同 generation、不同 ID 重复，并覆盖刷新分页响应
- [x] 5.2 增加同来源双 canonical、跨 turn 同文、completed/history 多候选、仅前缀兼容和缺少 `clientUserMessageId` 的失败关闭测试
- [x] 5.3 实现 history/completed-overlay 互补来源的一对一精确物化索引：history ID 胜出，user 使用唯一 `clientUserMessageId`，未物化 overlay 保持现有插入语义
- [x] 5.4 将目标路径限制为 page 与有界 overlay 的线性遍历，增加长 page/满 overlay 回归用例并自审不存在全量候选两两正文比较

## 6. 验证、构建与 e3 部署

- [x] 6.1 运行 app-server runtime、timeline engine、Store、分页与展示相关定向测试
- [x] 6.2 运行全量 `npm run verify`、`npm run build` 与 `openspec validate dedupe-agent-message-source-aliases --strict`
- [x] 6.3 生成 release，核对本地 tarball 内容与校验值并部署到 e3 目标目录；按用户要求不启动服务、不执行远端运行验收
- [x] 6.4 自审最终 diff、OpenSpec artifacts 与部署产物，确认没有通用文本去重、没有 React 展示层补丁、性能路径保持线性且未覆盖用户其他改动

## 7. 实时完成事件的 envelope 身份继承

- [x] 7.1 先补 HAR 顺序回归测试：空 `item_updated`、同 item live delta、完整 `item_updated` 在相同 `bootId`/generation 下只能形成一个 Store entry
- [x] 7.2 在 Web event adapter 中将外层 event 的缺失 identity/provenance 元数据继承到嵌套 `item`/`entry`，保持嵌套字段优先并不改变强 identity 规则
- [x] 7.3 运行 Store、timeline engine、分页/展示定向测试与全量验证，重新生成 release 并部署 e3；按用户要求不启动服务、不做远端运行验收

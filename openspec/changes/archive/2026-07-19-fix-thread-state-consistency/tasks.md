## 1. 测试基线与协议夹具

- [x] 1.1 在开始实现前检查当前 worktree 与 `add-custom-model-catalog` 的最新状态，记录共享文件中的现有改动并确保后续补丁不覆盖自定义模型需求。
- [x] 1.2 扩展 app-server mock、Web API fixture 与共享测试 builder，使其能表达 `approvalPolicy`、`activeTurnId`、权威 turn manifest、rollback `operationId` / precondition 和 SSE baseline 控制事件。
- [x] 1.3 先补权限失败测试，覆盖完全访问仍为 `on-request`、三元组透传、unknown 与显式 `null`、notLoaded resume 后发送，以及后端回读不匹配时不得显示完全访问。
- [x] 1.4 先补 rollback 失败测试，覆盖 mutation response 已删除但紧随 page 仍陈旧、第一次 rollback 后目标不得复活、重复 operation、tail conflict、旧 completed overlay、synthetic `rollout-*` 与跨虚拟窗口 steer。
- [x] 1.5 先补事件恢复失败测试，覆盖 no-cursor + existing backlog、fresh active metadata、initial 请求被 SSE 失效后重新基线、partial output 后漏失尾部再进入 idle，以及两个客户端共享同一 gateway 的收敛。

## 2. 权限三元组契约

- [x] 2.1 在 shared/Web API/store 类型中引入完整 `PermissionSelection`，加入 `approvalPolicy` 并用显式状态区分 unknown、已知 override 和 config-default 清除。
- [x] 2.2 更新 thread settings、thread start 与 turn start routes，严格校验并审计 `approvalPolicy`，保留 `undefined` 与显式 `null` 的区别。
- [x] 2.3 更新 app-server client/gateway 的 start、settings、resume/read 映射与 settings event normalization，向协议字段 `approvalPolicy` 透传并回读实际 profile、policy 和 reviewer。
- [x] 2.4 更新四种权限模式映射，使请求批准/替我审批使用 `on-request`，完全访问使用 `:danger-full-access` + `never`，config-default 对三个 override 发送显式 `null`。
- [x] 2.5 修正权限 chip 与乐观状态合并：不完整后端状态不得覆盖完整本地选择，`:danger-full-access` + 非 `never` 不得显示为完全访问，并呈现可理解的未生效反馈。
- [x] 2.6 修正 notLoaded 发送路径，消费 `thread/resume` 返回的完整权限状态后再构造 `turn/start`，禁止把 unknown 归一化为 config-default。
- [x] 2.7 运行权限页面、store、route、client 与 event normalization 的测试子集，确认失败测试转绿且既有四模式行为未回归。

## 3. 权威 turn manifest

- [x] 3.1 为 bounded latest page、thread state 与 timeline engine 增加 generation-scoped authoritative turn manifest / stamp，明确其来源与序列化边界。
- [x] 3.2 让 app-server page、`turn/start` response 和 `turn_started` lifecycle 更新 manifest；overlay、rollout supplement 和 content repair 只能附着到已证明的 turn identity。
- [x] 3.3 修正 runtime overlay 生命周期：completed overlay 在对应内容 materialize 或离开权威窗口后清理，旧 overlay 不得被追加成当前尾部 turn。
- [x] 3.4 修正 rollout supplement 与 synthetic identity 适配，无法映射到 app-server turn 的 `rollout-*` 内容不得进入 ordered distinct rollback turns。
- [x] 3.5 更新 timeline engine rollback selector 与消息菜单资格，使用完整 normalized state + manifest，禁止从 `visibleEntries`、文本、时间或数组末尾推断破坏范围。
- [x] 3.6 增加 manifest/page/overlay/virtualization 单元测试，覆盖超过最近页限制的长 thread、同 turn steer 和 owner 不明内容的失败关闭。

## 4. 事务化与幂等 rollback

- [x] 4.1 扩展浏览器 rollback 请求，携带稳定 `operationId`、目标 `turnId`、`HistoryStamp` 与 `expectedTailTurnIds`；HTTP route 对旧或不完整破坏性请求返回明确校验错误。
- [x] 4.2 在 gateway 增加 per-thread mutation lock 与 `{bootId, threadId, operationId}` 幂等缓存，校验 payload fingerprint，并为重复成功请求返回相同结果。
- [x] 4.3 在锁内读取权威 bounded manifest，比较 stamp、target 和 expected tail 后再导出 `numTurns`；冲突必须在调用 app-server 前返回并记录原因。
- [x] 4.4 重构 app-server client rollback，保留 RPC response 的权威 turn membership；后续 bounded page 只在 manifest 兼容时补内容与 cursor，陈旧时有界重试并在耗尽后返回 repair-required。
- [x] 4.5 在 rollback 成功后原子推进 generation、建立 deleted-turn/backlog barrier 并清理相关 overlay，再暴露新 generation response 或事件。
- [x] 4.6 让 browser timeline snapshot replace、repair、supplement 与 late event 全部应用 deleted-turn barrier，旧输入不得复活已删除 turn。
- [x] 4.7 更新 rewind/fork UI 的 pending lock、ambiguous outcome 与 conflict 流程：重复触发复用 operation，conflict 只刷新 bounded baseline，不自动把旧 count 应用于新尾部。
- [x] 4.8 运行 rollback route、client、gateway、timeline engine、ThreadPage 与 fork/rewind 测试子集，确认 stale page、`1 -> 2` 范围膨胀和双击/多设备重复执行均被阻断。

## 5. 跨设备事件基线与最终收敛

- [x] 5.1 为浏览器 SSE 定义并实现 baseline-required 控制事件，包含 `bootId` 与 stream cursor/watermark；无 `Last-Event-ID` 时不得静默返回空 backlog 且无恢复信号。
- [x] 5.2 更新事件客户端保存和消费 stream baseline；fresh 页面用 metadata + bounded latest page 建基线，已有 cached/tracked thread 的无 cursor 重连触发 scoped/all-tracked bounded repair。
- [x] 5.3 保证 baseline 加载期间的 live events 继续按 delivery order 缓存，并通过 page watermark、event identity 与 `HistoryStamp` 在 snapshot 提交后去重合并。
- [x] 5.4 在 thread metadata / summary Web 契约中显式返回 `activeTurnId`，gateway 从 start/lifecycle/latest-turn state 恢复该 identity，页面不再依赖本设备历史事件。
- [x] 5.5 修正 initial request guard：旧响应被 live delivery、mutation、generation 或 boot barrier 拒绝后，保留并按当前 stamp 重新安排有界 baseline，设置重试预算并避免完整 timeline fallback。
- [x] 5.6 将 active 阶段 missing-output recovery 与 active-to-idle final reconcile 分离；summary 确认 idle 后按 `{threadId, HistoryStamp, activeTurnId}` 去重执行一次 bounded latest-page reconcile，即使已有 partial agent/tool output。
- [x] 5.7 在 `visibilitychange` / `pageshow` 等页面恢复入口检查 stream baseline 与当前 running/unknown thread，必要时触发一次有界 summary/baseline 恢复，不引入固定 timeline polling。
- [x] 5.8 运行 SSE route/client、store、ThreadPage、runtime 和双客户端集成测试，确认设备 B 能从旧或 partial 记录收敛到设备 A 的完成态。

## 6. 审计、兼容与错误处理

- [x] 6.1 扩展审计字段，记录实际权限三元组、rollback operation/precondition/actual tail/conflict、stream baseline scope 与 final reconcile reason，继续排除正文、token 和敏感配置。
- [x] 6.2 为旧客户端或旧缓存状态提供明确兼容行为：缺少 `approvalPolicy` 的权限状态视为 incomplete，缺少 rollback precondition 的破坏性请求失败关闭，boot 变化后的 ambiguous operation 返回 unresolved。
- [x] 6.3 增加结构化错误码与前端中文反馈，区分 permission-not-applied、rollback-conflict、rollback-unresolved、baseline-required 和 repair-exhausted。
- [x] 6.4 为新增审计与错误响应补 route/gateway 测试，验证不会泄露绝对敏感配置、访问 token 或消息正文。

## 7. 完整验证与发布准备

- [x] 7.1 运行所有新增与相邻 Vitest 测试，特别核对当前曾断言“visible output 后不 final repair”的用例已按新契约更新。
- [x] 7.2 运行 `npm run typecheck`，修复所有严格类型错误且不得通过放宽类型绕过 unknown/null 或 manifest 边界。
- [x] 7.3 运行 `npm run verify`，确认完整单元与集成测试通过。
- [x] 7.4 运行 `npm run build`，验证 Next 前端、API routes 和 server bundle 构建成功。
- [x] 7.5 运行 `npm run release:verify` 或记录受环境限制无法执行的步骤，并使用独立端口完成 smoke，禁止影响当前 `23000` 服务。（`verify`、正式构建、release pack 均通过，release smoke 在独立端口 `23001` 完成。）
- [x] 7.6 在手机视口和两个独立浏览器 session 中验证完全访问无审批、rewind 精确落点、后台/换设备执行记录收敛，并保存测试结果供部署检查。

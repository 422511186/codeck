## Context

已部署版本的三个故障共享同一结构性问题：系统缺少“状态是否完整、由谁负责”的明确边界。

- 权限选择器只保存 named permission profile 与审批 reviewer。远端 rollout 证明 `:danger-full-access` 已生效为无沙箱，但 thread 的 `approvalPolicy` 仍为 `on-request`，因此风险命令继续产生审批；`approvalsReviewer: null` 不能替代 `approvalPolicy: "never"`。
- rollback API 最终只能向 app-server 发送 `numTurns`。当前 client 收到包含更新后 turns 的 rollback response 后，又立即用一次可能滞后的分页读取替换 response turns；runtime 再基于这个结果事后推断删除集合。审计中同一目标在第一次 `numTurns=1` 后重新出现，第二次扩大为 `numTurns=2`。
- 新设备或新 EventSource 没有 cursor 时，SSE endpoint 静默返回空 backlog；页面若只拿到 partial output，summary 变 idle 后又因“已有可见输出”跳过 final reconcile，随后清除 running 状态并停止轮询。

实现必须继续遵守移动端、有界 timeline、单一 managed gateway、内存事件 backlog、`HistoryStamp`/bootId 隔离和 app-server 现有 `thread/rollback { numTurns }` 协议。当前正在开发的自定义模型目录不属于本变更，但会修改部分相同 route、client、runtime 与 store 文件，apply 时必须基于届时最新代码合并，不能覆盖该需求。

## Goals / Non-Goals

**Goals:**

- 让四种权限模式对应完整且可验证的执行策略，并保证设置、发送、恢复、事件回读和 chip 展示一致。
- 让 rewind/fork rollback 在执行前验证权威历史版本与尾部 turn manifest，在执行后原子建立删除屏障，并对重复操作保持幂等。
- 将 timeline 内容条目与可参与历史 mutation 的 turn membership 分离；overlay 和 supplement 只能补内容，不能创造 rollback 计数单位。
- 让新设备、页面重新可见和无 cursor 事件连接都能建立有界基线；已看到 partial output 不能阻止确认完成后的最终收敛。
- 保持实时事件为 running 输出主路径，不恢复固定周期完整 timeline polling。

**Non-Goals:**

- 不改变 app-server `thread/rollback` 的 wire protocol，也不承诺回滚本地工作区文件。
- 不把事件 backlog 持久化到数据库，不实现跨服务实例的分布式事件日志或分布式锁。
- 不修复或替换 e3 当前缺失的 `codex-auto-review` 模型；本变更只保证「替我审批」的错误可观察，且「完全访问权限」不依赖该 reviewer。
- 不重构 timeline 渲染样式、模型选择器或自定义模型生命周期。

## Decisions

### 1. 权限模式使用完整三元组

引入统一的权限选择值，包含：

```ts
type PermissionSelection = {
  permissions: string | null;
  approvalPolicy: "untrusted" | "on-request" | "never" | null;
  approvalsReviewer: "user" | "auto_review" | "guardian_subagent" | null;
};
```

四种 UI 模式映射如下：

| 模式 | permissions | approvalPolicy | approvalsReviewer |
|---|---|---|---|
| 请求批准 | `:workspace` | `on-request` | `user` |
| 替我审批 | `:workspace` | `on-request` | `auto_review` |
| 完全访问权限 | `:danger-full-access` | `never` | `null` |
| 自定义 config.toml | `null` | `null` | `null` |

`approvalPolicy` 将贯穿 Web API 类型、route 校验、gateway 输入、app-server params、审计、thread settings event 和 thread detail/summary。完全访问的判定必须同时看到 `:danger-full-access` 与 `never`；reviewer 在 `never` 下不参与审批，但仍保留在完整状态中用于诊断。

选择 `approvalPolicy: "never"` 而不是继续依赖 `approvalsReviewer: null`，因为协议把 reviewer 定义为审批路由对象，关闭审批的正式字段是 `AskForApproval = "never"`。备选方案是让 `:danger-full-access` 隐式覆盖 approval policy，但远端 rollout 已证明当前 app-server 不具备该语义。

前端状态必须区分 `unknown` 与显式 `null`。resume/read 返回完整权限状态时才覆盖本地 optimistic selection；notLoaded 发送流程必须消费 resume 结果，不能把闭包中的 unknown 归一化为 config 默认后再发送。

### 2. rollback 使用条件命令而不是客户端计数提示

浏览器 rollback 请求增加稳定 `operationId`、目标 `turnId`、发起时 `HistoryStamp` 和 `expectedTailTurnIds`。公开 route 不再把客户端 `numTurns` 视为充分依据；gateway 在 per-thread action lock 内读取权威 bounded latest turn manifest，验证：

- history stamp / bootId 与请求兼容；
- target turn 存在且 expected tail 与当前尾部完全一致；
- 每个 expected turn 都来自权威 app-server turn/page，而非 overlay、supplement 或渲染切片；
- `numTurns` 由验证后的 manifest 长度导出。

任一条件不满足时返回可识别的 conflict / repair-required 结果，浏览器保持历史不变并请求新的 bounded baseline。选择失败关闭而不是“尽量回滚”，因为破坏性历史操作无法在多删后可靠补偿。

app-server 目前不支持原子 compare-and-swap。单一 Web gateway 内的 per-thread lock 可以覆盖同一服务上的多设备并发；对绕过 Web 直接修改同一 app-server thread 的外部客户端，只能通过 mutation 前后 manifest 校验检测，不能彻底消除协议级 TOCTOU。该限制必须记录并通过失败关闭降低风险。

### 3. rollback response 的 membership 权威，分页只补内容

`thread/rollback` response 中 `thread.turns` 的 turn membership 和顺序作为本次 mutation 的权威结果。由于 response items 可能 lossy，gateway仍可读取 bounded latest page 补齐可见内容和 cursor，但只有当 page 的 HistoryStamp / turn manifest 与 mutation response 兼容时才能提交。

如果紧随 mutation 的 page 仍包含 expected deleted turn，gateway必须有界重试；仍不一致时返回 repair-required，不能用 stale page 覆盖 mutation response。generation bump、deleted-turn barrier、overlay 清理和 backlog barrier 必须在向浏览器暴露新 generation 内容前完成。

timeline engine 的 snapshot replace 也必须应用 deleted-turn barrier。这样即使旧 page、旧 event 或 supplement 迟到，也不能重新引入已删除 turn。

### 4. turn manifest 与 timeline entries 分离

gateway/page response 和浏览器 engine 维护 generation-scoped authoritative turn manifest。可计数 turn 只能来自：

- app-server turn/ item page 的权威 turn identity；
- 当前 gateway 接收到的 `turn/start` response 或 `turn_started` lifecycle identity；
- 与上述 identity 明确绑定的 mutation response。

runtime overlay、rollout supplement、synthetic `rollout-*` entry 和可见虚拟窗口只能附着到 manifest 中已有 turn。无法证明 owner 的内容可以显示为 repair-required 或触发 bounded repair，但不能追加成新的尾部 turn。消息操作资格必须基于完整 normalized engine state，不得基于 `visibleEntries` 切片判断同 turn steer 是否唯一。

选择独立 manifest 而不是继续从 entries 去重，是因为 entries 是内容投影：它可能分页、被裁剪、由多来源补齐，也可能包含不代表 app-server rollback 单位的 synthetic activity。

### 5. 新事件消费者先建立 stream baseline

SSE 连接必须发送可被客户端消费的 baseline 控制事件，至少包含当前 `bootId` 和全局 stream cursor。无 `Last-Event-ID` 不再等价于“无缺口”：

- fresh 页面以 metadata + bounded latest page 建立 thread baseline，并只接受 page watermark 之后的 live events；
- 已有 cached/tracked thread 的客户端在无 cursor 重连时，为受影响 thread 建立 bounded repair；
- baseline 期间到达的 live events按现有 listener buffer 顺序保留，在 snapshot 提交后通过 watermark/identity 去重。

不选择为无 cursor 客户端无条件重放整个全局 backlog，因为 backlog 混合多个 thread，可能放大首屏流量且仍无法证明窗口之前的完整性。baseline + scoped bounded page 能给出明确覆盖边界。

### 6. final reconcile 与 missing-output repair 分开

“已有可见输出”只抑制 active 阶段的 missing-output fallback，不能抑制确认完成后的 final reconcile。页面观察到已知 active turn 的 summary 从 active 变 idle 时，必须按 `{threadId, HistoryStamp, activeTurnId}` 去重执行一次 bounded latest-page reconcile，无论当前是否已有 agent/tool partial output。

metadata / summary 必须显式返回 `activeTurnId`。页面重新可见、fresh device 打开 active thread、或 initial response 因 delivery/history barrier 被拒绝时，应建立或重新排队一次有界 baseline；不得因本地 `activeTurnId` 为 null 而永久跳过恢复。

### 7. 幂等、审计与诊断共享 operation identity

rollback operation cache 以 `{bootId, threadId, operationId}` 为键，在同一 boot 内向重复请求返回相同结果，不再次调用 app-server。boot 变化且无法从新 history 唯一证明旧 operation outcome 时返回 unresolved，不自动重放。

审计增加：权限三元组实际值；rollback operationId、请求 stamp、expected/actual tail、冲突原因和删除结果；SSE baseline/gap scope；final reconcile reason 与目标 turn。日志不得记录消息正文、token 或敏感配置。

## Risks / Trade-offs

- [Risk] 一个 change 同时涉及权限、历史 mutation 和事件恢复，回归面较大。→ Mitigation：按权限、rollback、cross-device 三条独立任务链先写失败测试，每条完成后运行相邻测试，最后执行 `npm run verify`。
- [Risk] `approvalPolicy: "never"` 会让完全访问真正跳过审批，风险高于当前行为。→ Mitigation：仅由用户显式选择「完全访问权限」触发，UI 文案保持清晰，设置与每个 turn 都携带同一值并记录审计。
- [Risk] app-server 没有 rollback CAS，外部客户端可能在 preflight 与 mutation 之间改变历史。→ Mitigation：managed gateway 内串行化，调用前后都验证 manifest；检测不一致即停止提交并要求 repair，同时保留协议升级的后续空间。
- [Risk] mutation response items lossy，而分页可能存在持久化延迟。→ Mitigation：response 只负责 turn membership / 删除边界，内容使用兼容 page 补齐；不兼容时有界重试并失败关闭。
- [Risk] 无 cursor baseline 会增加 reload 时的 bounded reads。→ Mitigation：只 repair visible/cached thread，按 HistoryStamp 去重，不重放全局 backlog，也不恢复固定 polling。
- [Risk] active→idle final reconcile 对每个 turn 增加一次 latest-page read。→ Mitigation：仅一次、按 turn/stamp 去重，并保持 page limit 与字节预算。
- [Risk] 当前自定义模型开发修改相同文件。→ Mitigation：apply 前重新读取 change status 与最新 diff，基于当前代码合并，不恢复或覆盖现有用户改动。

## Migration Plan

1. 先扩展类型、route 和 mock protocol，保持旧字段兼容；前端在缺少 `approvalPolicy` 时将状态视为 incomplete，而不是自动判定完全访问。
2. 上线权限三元组与审计，验证 thread settings event、turn context 和 UI chip 一致。
3. 上线 rollback precondition、manifest、幂等锁和 response/page 兼容检查；旧客户端缺少 operationId 或 precondition 时返回明确升级错误，不执行破坏性 fallback。
4. 上线 SSE baseline、activeTurnId 和 final reconcile；通过双客户端集成场景验证设备 B 从 partial output 收敛到完成态。
5. 执行类型检查、完整测试、生产构建和 release smoke；部署后观察 rollback conflict、baseline repair 和 permission mismatch 审计。

回滚部署时可以恢复上一 release，不需要数据迁移。内存 operation cache、manifest 和 cursor 随进程清空；bootId 变化会使旧请求失败关闭。若只能部分回退，必须同时回退新前端 rollback 请求与新 route 校验，避免协议两端不一致。

## Open Questions

- app-server 后续是否会为 `thread/rollback` 提供原子 history revision / expected tail 参数？若提供，应替换 gateway 侧有限的 preflight + postflight 校验。
- 是否需要把无 cursor baseline 控制事件纳入上游 app-server 协议，还是继续作为 codex-web 的浏览器 SSE 扩展？本变更默认采用后者。

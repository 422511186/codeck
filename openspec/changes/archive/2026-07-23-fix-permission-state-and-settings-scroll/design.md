## Context

当前权限 chip、浏览器 store、gateway 内存缓存和后续 `turn/start` 共用一份权限三元组。app-server 的 `thread/settings/updated` 只描述当前有效运行时设置，没有携带“这是用户为后续 turn 保存的配置，还是当前 turn 的临时快照”的来源或作用域；现有代码却把每个完整事件都当成持久配置，并回写 localStorage。用户选择完全访问后，新一轮仍收到命令审批，正是该边界缺失的可见结果。

命令审批的协议还允许 `acceptForSession` 以及包含 execpolicy/network amendment 的结构化 decision。当前移动端只提供一个普通“同意”路径，并把非字符串 decision 转成字符串，无法表达协议语义。设置页面受到全局 `body { overflow: hidden }` 约束，却没有路由级滚动容器。

变更必须保持现有移动端 timeline、事件去重、权限三元组和模型切换恢复契约，不修改 app-server wire protocol，也不能因显示完全访问而自动批准安全请求。

## Goals / Non-Goals

**Goals:**

- 把现有 `permissionProfileId`、`approvalPolicy`、`approvalsReviewer` 明确定义为后续 turn 的 configured selection。
- 增加仅用于诊断的 runtime permission observation；原始 settings 事件不再覆盖 configured selection。
- 在显式权限设置成功后广播可排序、可去重的 `thread_permission_configured` 浏览器事件，并让新一轮发送读取 store 最新配置。
- 在完全访问与实际命令审批不一致时失败关闭并给出一次去重提示。
- 保留 app-server 提供的全部可安全表达的审批 decision，结构化 decision 由服务端按选项索引原样回传。
- 为 `/settings` 路由树提供独立的手机滚动容器和安全区底部间距。

**Non-Goals:**

- 不改变 app-server 的权限或审批 wire protocol，不引入自动放行策略。
- 不把 `question`、MCP elicitation 或 dynamic tool 请求改成权限模式变更。
- 不重构 timeline 排序、模型切换、全局 body 锁或其他文档型页面。
- 不在本变更中持久化敏感命令正文、token 或完整审批 payload 到审计日志。

## Decisions

### 1. 用两个状态面避免运行时快照污染配置

继续复用 store 中现有三元组字段作为 configured selection，新增 runtime observation 字段和 `setRuntimePermissionProfile` action。`thread_settings_updated` 只调用 runtime action；新事件 `thread_permission_configured` 才调用现有 `setPermissionProfile`，后者负责保存完整配置。

gateway 将现有 `permissionSelectionsByThread` 视为 configured map，停止在 `recordPermissionSelectionEvent` 和 `withPermissionSelection` 中从普通 settings 事件或任意 read response 写入该 map。以下来源允许写入 configured map：

- `startThread` 成功返回的完整输入/响应；
- 带完整权限覆盖的 `resumeThread` / runtime reload；
- 成功的 `updateThreadSettings`，并广播配置事件；
- 成功的 `startTurn` 输入，用于 gateway 重启后重新建立已使用的配置。

没有 configured map 时，read 结果保持未知；浏览器已有完整 localStorage 记录仍可作为发送前 fallback。这样宁可显示待确认，也不从 active turn 的临时观察猜测后续权限。

备选方案是仅在 `running` 时忽略 settings 事件。该方案无法处理事件乱序、重连和其他设备更新，也会把同一缺陷留在 gateway 缓存，因此不采用。

### 2. 用显式配置事件同步设备，而不复用 app-server 原始事件

`updateThreadSettings` 的 RPC 成功后，gateway 生成 `thread_permission_configured`，携带完整三元组。事件通过现有 `enrichCodexEvent` 获得 `bootId`、`revision` 和 `eventId`，复用现有 SSE/WebSocket 去重路径。前端收到该事件后更新 configured store 并持久化 localStorage；原始 settings 事件仍可更新模型、协作模式和 runtime observation。

该方案不要求上游协议增加字段，也不会把一个无法判断作用域的 app-server notification 伪装成持久配置。显式设置失败时沿用现有回滚逻辑，不广播配置事件。

### 3. 权限不一致只告警，不自动授权

store 收到 `command_approval` 且 configured selection 是 `:danger-full-access + never` 时，按 thread/turn/configured fingerprint 建立一次 notice。审批卡片继续可操作，resolve 结果不修改 configured selection。这样可以同时发现后端设置未生效和前端状态回退，且安全边界保持失败关闭。

### 4. 审批选项使用服务端可验证的索引

`normalizePendingServerRequest` 为 command approval 的每个原始 `availableDecisions` 生成稳定的 request-local option value。字符串 decision 可保持协议值，结构化 decision 使用 `decision:<index>` 形式；服务端 `buildPendingServerRequestResponse` 根据 pending request 的原始数组把索引还原为对象，拒绝不在当前 options 中的 value。

`ApprovalCard` 对普通审批逐项渲染 options，不再只查找一个 accept 和一个 decline。未知结构化 decision 显示不可用提示并禁用，不尝试 JSON 字符串猜测。question 继续使用自己的 option value 和 answers response。

备选方案是把整个原始 response 交给浏览器提交。该方案扩大客户端权限、无法验证请求归属，因此不采用。

### 5. 设置页使用路由级滚动容器

新增 `src/app/settings/layout.tsx`，在 `/settings` 及自定义模型子路由外层设置 `height: 100dvh`、`overflowY: auto`、`overscrollBehaviorY: contain` 和安全区底部间距。保留全局 body 锁定及聊天页自身的 scroll viewport；设置页主内容补充安全区 padding，确保登出按钮可触达。

### 6. 以失败测试驱动实现

先在 store、pending request、ApprovalCard、ThreadPage 和 Settings layout 邻近测试中加入能复现现象的失败用例：临时 settings 事件不得改变完全访问配置；下一轮 payload 必须保持；`acceptForSession` 和结构化对象必须正确提交；设置容器必须声明可滚动。每个红测试只覆盖一个行为，随后以最小实现转绿，再运行权限相关全量测试、`npm run verify` 和 `npm run build`。

## Risks / Trade-offs

- **[Risk]** 普通 settings 事件不再立即改变 configured chip，外部客户端的显式设置可能只先出现在 runtime observation。
  **Mitigation:** Web 自身的成功 settings update 广播配置事件；没有配置来源时保持待确认并在 idle 恢复读取，不静默覆盖用户选择。
- **[Risk]** 审批卡片从两个按钮变为多个选项，移动端垂直空间增加。
  **Mitigation:** 复用现有卡片和选项样式，按协议提供的选项数量渲染，不增加额外 modal。
- **[Risk]** 完全访问与审批不一致时出现告警，用户可能误以为系统自动放行。
  **Mitigation:** 明确保留审批卡片、禁止自动 response，并在 notice 中说明本次操作仍需确认。
- **[Risk]** 新增 settings layout 影响 fixed form overlay。
  **Mitigation:** overlay 继续使用 viewport fixed；为设置页和 custom-models 增加 DOM/样式测试，验证内部表单自身滚动不变。

## Migration Plan

1. 先部署后端 gateway 的 configured/runtime 分离和新浏览器事件；旧前端只会忽略未知 event kind，不影响已有会话。
2. 部署前端 store、composer 和审批卡片；localStorage 旧格式继续按现有三元组读取，不存在数据迁移。
3. 部署 settings layout 与回归测试；若发现布局回归，可单独回退 layout 文件，不触碰权限状态修复。
4. 回滚时同时回退前后端事件消费者；新事件没有持久化外部协议，不需要数据库迁移。

## Open Questions

无。app-server 已提供的 decision 枚举和 `ThreadSettings` 字段均有本地生成 schema 与现有测试作为依据；实现中若发现真实运行时 payload 与 schema 不符，应先增加失败测试并暂停猜测式兼容。

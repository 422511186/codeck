## ADDED Requirements

### Requirement: Runtime model changes preserve complete permission selection
任何会改变或重建 thread 模型运行时的操作 SHALL 保持操作开始时的完整权限选择。完整权限选择 MUST 包含 `permissions`、`approvalPolicy` 与 `approvalsReviewer`，并 MUST 用于目标切换、旧状态回滚、显式恢复和进程中断恢复。

#### Scenario: Historical model switch carries permissions through cold resume
- **WHEN** 已有历史的 thread 使用冷 resume 切换模型
- **THEN** resume 请求 MUST 同时携带操作开始时的 `permissions`、`approvalPolicy` 与 `approvalsReviewer`
- **AND** 模型切换成功后权限 chip 与后续 turn payload MUST 保持同一权限模式

#### Scenario: Recovery uses the original permission snapshot
- **WHEN** 模型目标失败后恢复旧状态，或服务重启后恢复未完成 operation
- **THEN** 系统 MUST 使用 operation 保存的同一完整权限选择
- **AND** 系统 MUST NOT 从浏览器陈旧状态、当前部署默认值或模型目标推断替代权限

### Requirement: Binding operation persists permission selection compatibly
新建 binding operation SHALL 持久化完整合法的可选 `permissionSelection`。读取器 MUST 兼容没有该字段的旧 operation；若新字段存在但缺少成员、包含未知枚举或额外字段，读取 MUST 失败关闭。

#### Scenario: New operation records complete permissions
- **WHEN** 系统在模型运行时变更前创建 binding operation
- **THEN** operation MUST 保存 `permissions`、`approvalPolicy` 与 `approvalsReviewer` 的完整值，包括显式 `null`

#### Scenario: Legacy operation remains readable
- **WHEN** 持久化文件中的旧 operation 不包含 `permissionSelection`
- **THEN** 读取器 MUST 接受该 operation
- **AND** 恢复流程 MUST 使用兼容的部署默认权限行为

#### Scenario: Partial permission snapshot fails closed
- **WHEN** `permissionSelection` 存在但任一成员缺失、枚举非法或包含未允许字段
- **THEN** 绑定存储 MUST 拒绝该文件
- **AND** 系统 MUST NOT 猜测或静默修补权限

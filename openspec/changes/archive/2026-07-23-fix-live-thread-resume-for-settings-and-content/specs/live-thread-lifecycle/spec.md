## ADDED Requirements

### Requirement: Missing live thread is recovered by bare resume
App-server gateway SHALL 在依赖 live thread 的操作遇到 missing/not-found/not-loaded 类错误时，执行一次不带权限覆盖的 `thread/resume`，并对原操作重试一次。bare resume MUST NOT 注入 `permissions`、`approvalPolicy` 或 `approvalsReviewer`。真实权限错误、参数错误或其他非 missing-live-thread 失败 MUST NOT 触发 resume。

#### Scenario: Settings update recovers after bare resume
- **WHEN** `thread/settings/update` 首次因 thread 未 live 失败
- **THEN** gateway MUST 先执行 bare `thread/resume`
- **AND** MUST 使用原始 settings payload 重试一次 update
- **AND** MUST NOT 在 resume 请求中携带权限覆盖

#### Scenario: Content rehydrate recovers after bare resume
- **WHEN** app-server content source 的 `thread/items/list` 首次因 thread 未 live 失败
- **THEN** gateway MUST 先执行 bare `thread/resume`
- **AND** MUST 重试 content rehydrate
- **AND** 成功后 MUST 返回完整或分块正文，而不是 502

#### Scenario: Non-missing errors are not auto-resumed
- **WHEN** 操作失败原因是 permission denied、invalid params 或其他非 missing-live-thread 错误
- **THEN** gateway MUST NOT 自动 resume
- **AND** MUST 保留原始错误语义

### Requirement: Unrecoverable missing thread stays bounded
若 bare resume 失败，或 resume 后原操作仍因 missing/not-found 失败，gateway SHALL 停止重试。content rehydrate 在该边界上 MUST 返回 scoped `repair-required`，MUST NOT 无限 resume，也 MUST NOT 把可分类的 missing-thread 情况包装成 opaque 502。

#### Scenario: Content returns repair-required after resume still fails
- **WHEN** content rehydrate 在 bare resume 后仍无法定位 live thread 或 source item
- **THEN** gateway MUST 返回 `completeness.status = repair-required`
- **AND** MUST 包含可诊断 reason
- **AND** MUST NOT 抛出导致 content API 502 的未处理异常

#### Scenario: Settings surfaces final failure after one resume
- **WHEN** settings update 在 bare resume 后仍失败
- **THEN** gateway MUST 向调用方返回最终错误
- **AND** MUST NOT 再次 resume 同一请求

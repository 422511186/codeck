## ADDED Requirements

### Requirement: Full-content read results are identity-scoped
读取完整内容的客户端 SHALL 将每次 full-content 请求绑定到发起时的 `threadId`、entry identity、`turnId` 和 `contentRef`。只有当响应返回时这些标识仍与当前可见 entry 完全匹配时，客户端 MUST 将 full-content 结果应用到本地 row/state 和 store。若任一标识已变化、entry 已被替换、thread 已切换或内容已被更高权威 snapshot/repair 取代，客户端 MUST 丢弃该响应并 MUST NOT 用过期正文覆盖当前 preview、continuation 或 completeness。

#### Scenario: Content ref changes while loading
- **WHEN** 用户开始读取某条 truncated entry 的完整内容
- **AND** 请求返回前同一 row 被 snapshot/repair 更新为新的 `contentRef`
- **THEN** 客户端 MUST 丢弃旧响应
- **AND** MUST NOT 用旧正文覆盖新 preview 或 continuation

#### Scenario: Thread changes while loading
- **WHEN** 用户在 thread A 中读取完整内容
- **AND** 响应返回前页面已切换到 thread B
- **THEN** 客户端 MUST 丢弃 thread A 的响应
- **AND** MUST NOT 将 thread A 的正文写回 thread B 的 store

#### Scenario: Matching identity allows update
- **WHEN** full-content 响应返回时 threadId、entry identity、turnId 和 contentRef 仍与发起时一致
- **THEN** 客户端 MUST 原位更新该 entry 的正文和 completeness
- **AND** MUST 保持该 entry 的可见顺序不变

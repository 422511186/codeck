## 1. 规格完整性验证

- [x] 1.1 验证 9 份 spec 文件均存在且格式正确：`auth-session`、`thread-lifecycle`、`turn-interaction`、`fs-operations`、`process-exec`、`config-management`、`remote-control`、`plugin-mcp-skills`、`audit-and-security`
- [x] 1.2 验证每份 spec 的每条 Requirement 都至少有一个 `#### Scenario:` 场景
- [x] 1.3 验证所有规范性句子包含 MUST 或 SHALL，所有场景步骤使用 WHEN/THEN 标记

## 2. 规格与代码一致性核查

- [x] 2.1 核查 `auth-session` spec 与 `session.ts`、`auth.ts`、`ws.ts` 的实现一致
- [x] 2.2 核查 `thread-lifecycle` spec 与 `threads/*` route handlers 及 `client.ts` 中对应方法一致
- [x] 2.3 核查 `turn-interaction` spec 与 `turns/*` route handlers、`user-input.ts`、`uploads.ts` 一致
- [x] 2.4 核查 `fs-operations` spec 与 `fs/*` route handlers 及 `workspace-policy.ts` 一致（已修正 Open Question #3 中审计日志描述）
- [x] 2.5 核查 `process-exec` spec 与 `process/*`、`command-exec/*` route handlers 及 `transport.ts` 一致（已记录 command-exec/spawn 校验弱于 process/spawn 的不一致）
- [x] 2.6 核查 `config-management` spec 与 `config/*` route handlers 及 `config-write-policy.ts` 一致
- [x] 2.7 核查 `remote-control` spec 与 `remote-control/*` route handlers 一致
- [x] 2.8 核查 `plugin-mcp-skills` spec 与 `plugins/*`、`skills/*`、`mcp/*` route handlers 一致
- [x] 2.9 核查 `audit-and-security` spec 与 `audit-log.ts`、`security.ts`、`workspace-policy.ts`、`pending-requests.ts` 一致（已修正审计目录中缺失的操作）

## 3. OPEN QUESTION 汇总与分类

- [x] 3.1 汇总所有 spec 中的 OPEN QUESTION，按风险等级分类（高/中/低）
- [x] 3.2 确认每个 OPEN QUESTION 是否需要创建 GitHub Issue 追踪（决定：归档后按需创建，不在本次 scope 内）
- [x] 3.3 确认哪些 OPEN QUESTION 应在后续安全加固 change 中优先处理（决定：高风险 9 项优先，中风险按需）

## 4. OpenSpec 流程收尾

- [x] 4.1 运行 `openspec validate --change appserver-spec-as-is` 验证所有 artifact 格式正确
- [ ] 4.2 归档 change（`openspec archive`），将 specs 写入 `openspec/specs/` 长期目录

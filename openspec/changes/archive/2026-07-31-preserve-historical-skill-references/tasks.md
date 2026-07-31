## 1. 回归测试

- [x] 1.1 在 `tests/unit/app-server-session-timeline.test.ts` 增加缺少 `turnId` 时唯一正文恢复 Skill、重复正文不绑定和结构化 Skill 优先的失败测试
- [x] 1.2 在 `tests/unit/web-store-events.test.ts` 或相邻 timeline 测试中增加刷新 page/detail 合并 Skill、图片和普通文件 metadata 的失败测试，并确认测试先因当前实现失败

## 2. 服务端历史补全

- [x] 2.1 扩展 session supplement 扫描选项，在存在无 `turnId` 用户正文时受限解析未知 turn 的 Skill records，并保持扫描预算与隐藏正文清理
- [x] 2.2 将 Skill 恢复逻辑抽取为全页唯一正文匹配，支持无 `turnId` 用户 item，同时保留结构化引用优先和歧义 fail-closed
- [x] 2.3 修改 `AppServerGateway.applySessionTimelinePageSupplement`，仅在页面存在无 `turnId` 用户 item 时启用 fallback，并补充运行时分页回归验证

## 3. 刷新 metadata 合并

- [x] 3.1 在 timeline ingress 增加 page/detail metadata 合并辅助逻辑，按 id、带 turn 的正文复合键和无 turn 的唯一正文匹配详情 item
- [x] 3.2 仅补齐缺失的 Skill、图片和文件 metadata，保留 page item identity、正文、状态和顺序
- [x] 3.3 修改 thread 初始刷新调用，将详情条目传入现有 `setThreadEntries` 合并路径，并完成对应 store 回归测试

## 4. 验证

- [x] 4.1 运行相关 Vitest 文件，确认服务端和前端回归测试通过
- [x] 4.2 运行 `npm run typecheck` 与 `npm run verify`，检查类型和完整测试套件
- [x] 4.3 运行 `openspec validate --change "preserve-historical-skill-references"` 并确认 change 状态为完成

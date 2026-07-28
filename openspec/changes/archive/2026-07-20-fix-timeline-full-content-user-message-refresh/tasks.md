## 1. 回归测试

- [x] 1.1 在 `tests/unit/web-timeline.test.tsx` 增加失败优先测试：truncated `user-message` 读取完整内容后，用户气泡必须从 preview 替换为完整正文。
- [x] 1.2 在同一测试中确认 store 写回为 complete，且消息仍保留原 id/turnId。

## 2. 修复实现

- [x] 2.1 修复 `src/web/components/Timeline.tsx` 的 `user-message` 分支，使其渲染与操作回调使用 `renderedEntry`。
- [x] 2.2 复查 full-content identity 校验、store 匹配校验和 user-message 附件渲染，确认本修复不放宽 stale 响应边界。

## 3. 验证

- [x] 3.1 运行 `npx vitest run tests/unit/web-timeline.test.tsx`。
- [x] 3.2 运行 `npm run typecheck`。
- [x] 3.3 运行 `openspec validate fix-timeline-full-content-user-message-refresh --strict`。

## 1. 测试先行

- [x] 1.1 在 `tests/unit/web-markdown.test.tsx` 增加 GFM 表格结构、稳定 class 和宽度策略的失败测试
- [x] 1.2 增加 Markdown 表格主题 CSS 选择器与 token 使用的失败测试，并确认专项测试按预期失败

## 2. Markdown 表格实现

- [x] 2.1 为表格滚动容器和 table 增加稳定 class，设置 `min-width: 100%` 并移除限制宽表滚动的 `max-width: 100%`
- [x] 2.2 在 `src/web/theme/tokens.css` 增加 GitHub 风格表格边框、表头背景、单元格内边距和顶部对齐样式
- [x] 2.3 运行 Markdown 与 timeline 相关测试，确认实现满足表格结构、主题和横向滚动契约

## 3. 验证与收尾

- [x] 3.1 运行 `npm run typecheck`
- [x] 3.2 运行 `npm run test -- tests/unit/web-markdown.test.tsx tests/unit/web-timeline.test.tsx`
- [x] 3.3 运行 `npm run verify` 并执行 `openspec validate improve-timeline-markdown-tables --strict`

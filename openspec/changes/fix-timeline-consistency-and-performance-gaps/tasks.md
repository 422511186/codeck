## 1. Completion repair 语义

- [x] 1.1 在 `tests/unit/web-store-events.test.ts` 中先更新/新增红灯用例，证明 tool-only、reasoning/activity-only 可见输出完成后不会触发 completion repair。
- [x] 1.2 调整前端可见输出判定，使 completion/idle repair 只在 active turn 没有 agent、tool、reasoning、diff、raw response、activity 或 error 输出时触发。

## 2. 相对时间展示

- [x] 2.1 在 `tests/unit/web-timeline.test.tsx` 中先新增红灯用例，覆盖用户/agent/activity 消息显示相对时间。
- [x] 2.2 在 `src/web/components/Timeline.tsx` 中补齐移动端相对时间渲染和稳定样式。

## 3. Rollout supplement 有界处理

- [x] 3.1 在 `tests/unit/app-server-session-timeline.test.ts` 中先新增红灯用例，证明 supplement 扫描时按允许 turn window 过滤并避免合并窗口外 entries。
- [x] 3.2 调整 `src/server/app-server/session-timeline.ts` 的 JSONL supplement 逻辑，在扫描/解析过程中按允许 turnId 收集并在预算限制下跳过补充。

## 4. 长文本与派生性能

- [x] 4.1 在 Timeline 邻近测试中先新增红灯用例，证明展开的 inline activity 长文本使用有界预览而不是完整 `<pre>` 直出。
- [x] 4.2 复用 `LongTextPreview` 或等价有界组件渲染 activity 展开详情，并减少显而易见的全量 entries 扫描热点。

## 5. 验证与收尾

- [x] 5.1 运行 timeline 相关单元测试：`npm run test -- tests/unit/web-timeline-engine.test.ts tests/unit/web-timeline.test.tsx tests/unit/web-store-events.test.ts tests/unit/app-server-session-timeline.test.ts`。
- [x] 5.2 运行 `openspec status --change "fix-timeline-consistency-and-performance-gaps"` 和必要的类型/验证命令，确认任务与规格可归档。

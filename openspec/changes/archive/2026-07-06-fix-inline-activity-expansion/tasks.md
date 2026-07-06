## 1. 回归测试先行

- [x] 1.1 更新 `tests/unit/web-timeline.test.tsx`，覆盖 activity block 默认只显示摘要、不显示动作短明细
- [x] 1.2 为展开 activity block 后显示动作列表、且单条动作可独立展开详情写失败测试

## 2. 两级展开实现

- [x] 2.1 调整 `InlineActivityLog`，默认不渲染 `section.details`
- [x] 2.2 在 section 展开后渲染每条 activity 动作的短标题和独立展开按钮
- [x] 2.3 在单条动作展开后复用 `ActivityDetail` 展示完整详情，并保留失败状态和移动端内联日志样式

## 3. 验证

- [x] 3.1 运行相关单测：`npm test -- tests/unit/web-timeline.test.tsx`
- [x] 3.2 运行 `npm run typecheck`
- [x] 3.3 运行 `openspec validate fix-inline-activity-expansion`

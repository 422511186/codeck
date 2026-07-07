## 1. Timeline repair 触发边界

- [x] 1.1 在 `tests/unit/web-store-events.test.ts` 增加失败用例：重复 `turn_completed`、summary idle 等价请求不得为同一 turn 生成多个 repair key。
- [x] 1.2 在 `tests/unit/web-thread-page.test.tsx` 增加失败用例：running 后短时间无可见输出不得调用 `readThread` 全量修复；summary 仍走 `/summary`。
- [x] 1.3 在 `tests/unit/web-thread-page.test.tsx` 增加失败用例：summary idle 与完成事件叠加时，只执行一次等价 snapshot repair。
- [x] 1.4 实现 reasoned snapshot repair 状态和去重逻辑，保留 `timeline-gap`、完成无输出、压缩完成和 summary idle 兜底。
- [x] 1.5 跑相关 store/page 测试，确认新增用例从失败变为通过。

## 2. Activity 展示扁平化和失败状态

- [x] 2.1 在 `tests/unit/web-timeline.test.tsx` 增加失败用例：Thinking 展开后直接显示 reasoning 内容，不出现第二个 Thinking 按钮。
- [x] 2.2 在 `tests/unit/web-timeline.test.tsx` 增加失败用例：文件变更展开后直接显示 diff/文件输出，不需要再点文件子行。
- [x] 2.3 在 `tests/unit/web-timeline.test.tsx` 增加失败用例：失败 activity 摘要显示「失败」且展开后直接显示错误详情。
- [x] 2.4 调整 `src/web/components/Timeline.tsx` 的 `InlineActivityLog`，对 Thinking/files/failed 详情使用单层渲染，保留 commands/tools 的多动作折叠。
- [x] 2.5 跑 timeline 组件测试，确认新增和既有活动排序/折叠行为通过。

## 3. 验证与部署

- [x] 3.1 运行 `openspec validate optimize-timeline-events-and-activity-display --strict`。
- [x] 3.2 运行 `npm run verify`。
- [x] 3.3 检查 `git diff`，确认未回滚用户已有改动且范围符合本 change。
- [x] 3.4 使用生产 compose 重新构建并启动 Docker 实例。
- [x] 3.5 检查健康接口和容器状态。

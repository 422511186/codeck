## 1. 测试覆盖

- [x] 1.1 在 `tests/unit/web-timeline.test.tsx` 增加失败用例：`diff` activity 展开后显示结构化 diff view 的行号、hunk、增删内容和复制完整 diff。
- [x] 1.2 在 `tests/unit/web-timeline.test.tsx` 增加失败用例：`toolKind=file` activity 展开后使用 diff view/fallback 且不出现第二层文件按钮。
- [x] 1.3 在 `tests/unit/web-timeline.test.tsx` 增加失败用例：多文件 `Files changed` 展开后按 entry 顺序直接显示多个 diff block。

## 2. Diff view 抽取和接入

- [x] 2.1 从 `src/web/components/cards/DiffCard.tsx` 抽取可复用的 `DiffView`，保留现有 `DiffCard` 行为。
- [x] 2.2 在 `src/web/components/Timeline.tsx` 的文件 activity 单层详情中渲染 `DiffView`，覆盖 `body.kind=diff` 和 `toolKind=file`。
- [x] 2.3 保持折叠态只显示摘要，展开态才解析并挂载 diff rows；长 diff 继续支持有界预览和复制完整 diff。
- [x] 2.4 收窄 diff view 行号 gutter，避免移动端挤压代码内容。

## 3. 验证与部署

- [x] 3.1 运行相关 timeline/card 测试，确认新增用例从失败变为通过。
- [x] 3.2 运行 `openspec validate add-timeline-diff-view --strict`。
- [x] 3.3 运行 `npm run verify`。
- [x] 3.4 检查 `git diff`，确认改动范围符合本 change。
- [x] 3.5 使用生产 compose 重新构建并启动 Docker 实例。
- [x] 3.6 检查健康接口和容器状态。

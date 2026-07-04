## 1. 测试先行

- [x] 1.1 在 `tests/unit/web-timeline.test.tsx` 增加失败测试：连续活动不再渲染 `Activity` 标题、厚卡片或左侧强调条，改为内联活动日志
- [x] 1.2 在 `tests/unit/web-timeline.test.tsx` 增加失败测试：`Loaded N tools` 标题和 `读取 <name> 技能` 短明细默认可见
- [x] 1.3 在 `tests/unit/web-timeline.test.tsx` 增加失败测试：read/search/list/command 混合活动显示具体组合摘要和默认短明细
- [x] 1.4 在 `tests/unit/web-store-events.test.ts` 增加失败测试：ownerless `skills_changed` 只失效缓存，不追加可见 loaded tools 活动
- [x] 1.5 在 `tests/unit/web-store-events.test.ts` 或 `tests/unit/web-thread-page.test.tsx` 增加失败测试：assistant/activity/assistant/activity 顺序在 live、completion 和 snapshot repair 后保持穿插
- [x] 1.6 在 timeline 渲染测试中覆盖长输出、diff、长 JSON 默认折叠且展开后可见

## 2. 数据语义与事件归一化

- [x] 2.1 审计 `docs/generated/app-server-ts/v2/ThreadItem.ts`、真实 `read_thread` 样本和现有 event adapter，确认 runtime loaded tools / Skill reading / command / read/search/list 的可用数据源
- [x] 2.2 调整 `src/server/app-server/events.ts`，确保 runtime activity 与 ownerless `skills/changed` 分离，后者只作为缓存失效
- [x] 2.3 调整 `src/server/app-server/client.ts` 和 `src/web/state/timeline.ts`，为 loaded tools、read/list/search、command、fileChange、MCP/dynamic、raw response fallback 保留内联日志需要的语义字段
- [x] 2.4 调整 `src/web/state/store.ts`，确保等价 live/completed/snapshot activity 合并时不改变相对位置
- [x] 2.5 确认 generation、revision、eventId 和 snapshot suppression 对 inline activity entries 仍然生效，避免重连或 repair 后重复活动行

## 3. 渲染模型重构

- [x] 3.1 将 `TimelineRenderBlock` 中面向用户的 `activity` block 重构为 `inline-activity-log` 派生块，并只合并同 turn 内连续活动
- [x] 3.2 删除或废弃 `ActivityBlock` 用户可见 UI，新增低强调 `InlineActivityLog` 组件
- [x] 3.3 实现具体标题生成：`Loaded N tools`、read/search/list/command 组合摘要、`Files changed · N · +A -R`、`Thinking...` / `Thinking`
- [x] 3.4 实现短明细生成：Skill/工具读取、短路径、搜索目标、短命令名、文件变更路径摘要默认可见
- [x] 3.5 实现长详情展开：命令完整输出、unified diff、长 JSON、长 reasoning 文本只在展开后显示
- [x] 3.6 调整移动端 spacing、字号、颜色和图标，达到 Codex App 风格的低强调内联日志效果，无厚卡片边框和强调色左条

## 4. 回归与兼容

- [x] 4.1 保留现有 `CommandCard`、`DiffCard`、`ToolCard` 或其详情渲染能力作为展开详情来源，避免丢失完整审计信息
- [x] 4.2 确保 rewind、fork、jump-to-latest、自动滚动和虚拟窗口仍基于底层 `TimelineEntry[]`，不被 render block 重构破坏
- [x] 4.3 更新旧测试中对 `Activity`、`Skills loaded · N`、厚卡片和聚合位置的期望，使其符合新规范
- [x] 4.4 确保权限、模型、输入区、图片和 Skill chip 等非 timeline 功能无行为回退

## 5. 验证

- [x] 5.1 运行 timeline 相关测试：`npm test -- tests/unit/web-timeline.test.tsx tests/unit/web-store-events.test.ts tests/unit/web-thread-page.test.tsx tests/unit/web-timeline-conversion.test.ts`
- [x] 5.2 运行事件归一化相关测试：`npm test -- tests/unit/app-server-events.test.ts tests/unit/app-server-timeline-item.test.ts`
- [x] 5.3 运行完整验证：`npm run verify`
- [x] 5.4 运行生产构建：`npm run build`
- [x] 5.5 使用手机视口检查真实线程，确认不出现 `Activity`，活动以内联日志穿插在 assistant 消息之间
- [x] 5.6 使用真实 Docker 部署类 turn 验证读取、运行命令、文件变更、最终回答无需刷新且顺序与 Codex App 接近
- [x] 5.7 构建并部署 Docker 到 `19899`，让用户在手机浏览器验证线上效果

## 1. 测试先行

- [x] 1.1 在 `tests/unit/app-server-timeline-item.test.ts` 增加用例，覆盖 `userMessage` 中 `type: "skill"` 被转换为结构化 `skillReferences`，且正文不包含 `[skill]`。
- [x] 1.2 在 `tests/unit/web-timeline-conversion.test.ts` 增加用例，覆盖 `TimelineItem.skillReferences` 转换到 `TimelineEntry`。
- [x] 1.3 在 `tests/unit/web-timeline.test.tsx` 或 `tests/unit/web-cards.test.tsx` 增加用例，覆盖用户消息渲染 Skill chip 且复制/正文文本不包含 `[skill]`。
- [x] 1.4 在工具卡测试中增加用例，覆盖 `toolKind: "command"` 的折叠标题优先展示命令而不是 cwd。

## 2. Skill 引用数据链路

- [x] 2.1 扩展 `MobileTimelineItem`、前端 `TimelineEntry` 和 `UserMessageEntry` 类型，增加可选 `skillReferences` 字段。
- [x] 2.2 修改 app-server `userMessageView()`，显式处理 `content.type === "skill"`，收集 `name/path` 并避免输出 `[skill]` 文本。
- [x] 2.3 修改 `timelineItemToEntry()` 和用户消息归一化逻辑，保留服务端回读、分页历史、snapshot repair 中的 Skill 引用。
- [x] 2.4 修改发送乐观消息创建逻辑，把本次 `skillReferences` 写入本地 `user-message` entry。

## 3. 移动端消息与工具卡渲染

- [x] 3.1 在 `UserMessage` 中渲染只读 Skill chip，样式与输入区 chip 语义一致，并保证长名称不会撑出横向滚动。
- [x] 3.2 确保用户消息正文渲染、复制、回滚/Fork 操作使用纯正文文本，不混入 Skill chip 文案。
- [x] 3.3 调整 `ToolCard` 的 `toolKind: "command"` 标题策略，优先展示命令内容，将 cwd 降级到展开内容或次要信息。
- [x] 3.4 检查非命令工具卡标题，确保长路径、长参数不会在移动端折叠态横向溢出。
- [x] 3.5 修复 Skill picker 中再次点击已选 Skill 无法取消选择的问题。

## 4. 验证

- [x] 4.1 运行相关单元测试：`npm test -- tests/unit/app-server-timeline-item.test.ts tests/unit/web-timeline-conversion.test.ts tests/unit/web-timeline.test.tsx tests/unit/web-cards.test.tsx`。
- [x] 4.2 运行 OpenSpec 校验：`openspec validate fix-skill-message-rendering --strict`。
- [x] 4.3 在手机视口手动检查带 Skill 的用户消息、Skill 触发后的命令/工具卡片和普通无 Skill 消息，确认无 `[skill]`、无横向溢出、正文阅读顺序可接受。

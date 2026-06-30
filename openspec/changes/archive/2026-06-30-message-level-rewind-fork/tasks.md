## 1. 测试先行

- [x] 1.1 为 app-server client 增加失败用例：`readThread()` 转换出的 timeline item 必须包含所属 `turnId`，且同一 turn 内多个 item 使用相同 `turnId`
- [x] 1.2 为 `resumeThread()` 和 `listThreadTurns()` 增加失败用例：历史恢复和分页返回的 timeline item 必须保留 turn 元数据
- [x] 1.3 为 Web 状态/辅助函数增加失败用例：给定目标 user entry 时能按 turn 元数据计算应 rollback 的 `numTurns`
- [x] 1.4 为 `ChatInput` 增加失败用例：空闲态不再显示「重发上一条」入口，运行态仍只显示状态和中断
- [x] 1.5 为会话页抽屉增加失败用例：`⋮` 菜单不再显示「Fork 会话」
- [x] 1.6 为 `Timeline` 增加失败用例：长按 user message 显示「复制」「回滚到这里」「从这里 Fork」「取消」，非 user message 不显示回滚/Fork
- [x] 1.7 为会话页增加失败用例：点击「回滚到这里」会调用 rollback、用返回 thread replace timeline，并把目标文本写入输入框
- [x] 1.8 为会话页增加失败用例：点击「从这里 Fork」会 fork 新 thread、在新 thread 上 rollback、原 thread 不变、跳转后回填目标文本
- [x] 1.9 为运行中和无法定位 turn 的场景增加失败用例：不得调用 rollback/fork，并保留现有 timeline 与输入框

## 2. Turn 元数据与回滚计算

- [x] 2.1 扩展 `MobileTimelineItem`、前端 `TimelineItem` 和 `TimelineEntry` 类型，增加 `turnId` 与必要的 turn 顺序元数据
- [x] 2.2 调整 `threadDetail()` 转换逻辑，使从 `thread.turns` 展开的每个 item 都携带所属 turn 元数据
- [x] 2.3 调整 `listThreadTurns()` 转换逻辑，使分页加载的 timeline item 同样携带 turn 元数据
- [x] 2.4 更新 `timelineItemToEntry()` 和 store 合并/replace 路径，确保 turn 元数据不会在前端丢失
- [x] 2.5 新增消息级 rollback 计算 helper：基于目标 entry 的 `turnId` 和当前已知 turns 顺序计算 `numTurns`
- [x] 2.6 对目标不在已知完整尾部范围、缺少 `turnId` 或计算结果小于 1 的情况返回不可操作状态

## 3. 移除旧入口

- [x] 3.1 从 `ChatInput` props 和渲染中删除 `canResendLast` / `onResendLast` 以及「重发上一条」按钮
- [x] 3.2 从会话页删除 `lastUserMessageText` / `onResendLast` 相关逻辑，不再从底部输入区触发 rollback
- [x] 3.3 从 `ActionSheet` 和会话页 `⋮` 抽屉删除「Fork 会话」入口与 `onFork` 透传
- [x] 3.4 更新相关单元测试，确保旧入口不可见且旧 mock 调用不再存在

## 4. 用户消息长按菜单

- [x] 4.1 扩展 `Timeline` props，向 user message 菜单传入 `running`、`onRewindToMessage` 和 `onForkFromMessage`
- [x] 4.2 在 user message 长按菜单中实现「复制」「回滚到这里」「从这里 Fork」「取消」四项
- [x] 4.3 确保运行中 thread 不提供可点击的「回滚到这里」和「从这里 Fork」，但仍可复制文本
- [x] 4.4 确保 agent、reasoning、tool、diff、system、error 等非 user entry 不暴露回滚/Fork 操作
- [x] 4.5 对含图片 user message 采用设计中的第一阶段策略：只回填文本并给出清晰反馈，或禁用该操作并给出不可用反馈
- [x] 4.6 调整移动端长按交互，避免菜单打开后遮挡关键内容或导致文本溢出

## 5. 消息级回滚与 Fork 流程

- [x] 5.1 在会话页实现 `rewindToMessage(entry)`：校验目标 turn、计算 `numTurns`、调用 `codex.rollbackThread()`、replace 当前 timeline、回填输入框草稿
- [x] 5.2 确保 `rewindToMessage()` 成功后不自动调用 `turn/start`
- [x] 5.3 在会话页实现 `forkFromMessage(entry)`：先调用 `codex.forkThread()`，再对新 thread 调用 `codex.rollbackThread(newThreadId, numTurns)`，成功后跳转新会话
- [x] 5.4 Fork 跳转前为新 thread 写入草稿，使新会话打开后输入框显示目标 user message 文本
- [x] 5.5 Fork 回滚失败时不静默跳转到错误历史状态，并在原会话呈现失败反馈
- [x] 5.6 所有 rollback 成功路径必须使用返回的 `ThreadDetail` replace 本地 entries，不使用会保留旧尾部 entry 的 merge

## 6. 验证

- [x] 6.1 运行相关单元测试：`tests/unit/codex-client.test.ts`、`tests/unit/web-chat-input.test.tsx`、`tests/unit/web-thread-page.test.tsx`
- [x] 6.2 运行新增或受影响的 `Timeline` / store helper 单元测试
- [x] 6.3 执行 OpenSpec 校验，确认 `message-level-rewind-fork` artifacts 可用于 apply
- [x] 6.4 在移动端视口手动或自动验证：旧入口消失、长按菜单可用、当前会话回滚、历史 Fork 跳转与草稿回填均符合规格

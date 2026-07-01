## 1. 测试准备

- [x] 1.1 补充 `src/app/projects/[projectId]/page.tsx` 对应的页面测试，覆盖长按会话条目会打开底部操作菜单且不会触发进入会话。
- [x] 1.2 补充「进行中」tab 长按菜单只显示「归档」、成功调用 `codex.archiveThread` 后从当前列表移除条目的测试。
- [x] 1.3 补充「已归档」tab 长按菜单只显示「移出归档」、成功调用 `codex.unarchiveThread` 后从当前列表移除条目的测试。
- [x] 1.4 补充归档和移出归档失败时保留列表条目并展示错误提示的测试。
- [x] 1.5 补充请求 pending 期间重复点击菜单项不会重复提交同一 thread 操作的测试。

## 2. 会话列表长按交互

- [x] 2.1 在 `ThreadRow` 中支持移动端 pointer 长按检测，500ms 后通知父组件打开当前 thread 的操作菜单。
- [x] 2.2 在 `pointerup`、`pointercancel`、离开条目或移动超过阈值时取消长按定时器，避免滚动列表时误触发。
- [x] 2.3 在长按成功后抑制同一次交互产生的 click，确保不会执行 `router.push(/threads/{threadId})`。
- [x] 2.4 为会话列表页新增底部操作菜单状态，菜单内容根据当前 tab 渲染「归档」或「移出归档」。

## 3. 归档状态操作

- [x] 3.1 实现「归档」菜单动作，调用 `codex.archiveThread(threadId)`，成功后从当前「进行中」列表移除该条目。
- [x] 3.2 实现「移出归档」菜单动作，调用 `codex.unarchiveThread(threadId)`，成功后从当前「已归档」列表移除该条目。
- [x] 3.3 为菜单动作增加 pending 状态，操作进行中禁用或忽略同一 thread 的重复提交。
- [x] 3.4 处理 API 失败，保持原列表不变，并使用当前页面错误展示方式显示错误信息。

## 4. 验证

- [x] 4.1 运行相关页面单元测试，确认长按、菜单、成功移除、失败恢复和防重复提交场景通过。
- [x] 4.2 运行 `openspec validate add-thread-list-long-press-archive-actions --strict`，确认变更规范有效。

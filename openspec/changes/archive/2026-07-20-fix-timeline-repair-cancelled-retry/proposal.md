## Why

当前会话页的 snapshot repair 在异步请求失败时，`catch` 分支可能在组件已经卸载或路由已切换后继续安排 completion repair retry。这样会让旧 thread 的 repair 需求泄漏到新页面生命周期里，造成无意义的后台请求，并可能干扰当前 thread 的 repair 标记和重试节奏。

本变更用于收紧 repair effect 的取消语义，确保所有成功、失败和延迟重试路径都只作用于发起时仍然有效的当前 thread。

## What Changes

- 修复会话页 snapshot repair 的失败处理路径：请求已取消、组件卸载或 thread 切换后，不再安排 retry。
- 为该竞态增加回归测试，覆盖 repair 请求失败晚于页面切换/卸载的场景。
- 保持现有 completion persistence-lag retry 能力：当前 thread、request token 和 barrier 仍有效时继续允许有界重试。
- 不改变 app-server 协议、上传文件功能、timeline engine 归一化规则或可见 UI 文案。

## Capabilities

### New Capabilities

### Modified Capabilities

- `thread-chat-view`: 收紧会话页 snapshot repair 生命周期，要求已取消或过期的 repair attempt 不得安排后续 retry，也不得影响新 thread 或新 generation。

## Impact

- 前端会话页：`src/app/threads/[threadId]/page.tsx` 的 snapshot repair effect 失败分支和 retry 调度边界。
- 测试：`tests/unit/web-thread-page.test.tsx` 增加取消后失败不重试的回归用例。
- OpenSpec：为 `thread-chat-view` 增加 cancelled/stale repair retry 边界要求。

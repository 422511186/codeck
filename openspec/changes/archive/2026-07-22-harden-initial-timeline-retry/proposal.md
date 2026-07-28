# 增加首屏 Timeline 加载重试

## Why

Thread 页面首屏 metadata 或 bounded timeline page 失败时会显示错误，但当前只有「返回」操作。移动端用户无法在原会话页重试临时网络、权限恢复或 app-server 重连，必须离开页面或手动刷新，错误恢复路径不完整。

## What Changes

- 在没有可见 thread detail 的首屏错误页提供页内「重试」操作。
- 重试重新建立当前 thread 的 request guard、metadata/page 请求和 loading 状态；不使用失败请求的旧结果。
- 保留未知错误可见语义，重试失败仍显示最新错误；成功后恢复正常 empty/timeline 页面。

## Capabilities

### Modified Capabilities

- `thread-chat-view`: 首屏未知读取错误必须提供不离开会话的有界重试入口。

## Impact

- `src/app/threads/[threadId]/page.tsx` 首屏加载 effect 与错误视图。
- `tests/unit/web-thread-page.test.tsx` 首屏失败恢复回归。
- 不改变分页、实时事件、缓存或 API 契约。

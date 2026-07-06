## Why

用户输入正确登录 Token 后，服务端已经写入 session cookie，但前端仅执行客户端跳转，目标页面可能继续复用登录前的路由缓存或旧状态，导致看起来仍未登录，必须手动刷新一次才恢复。

这会让移动端首次登录体验不可靠，也会让用户误以为 Token 无效或服务端登录失败。

## What Changes

- 登录成功后，前端 SHALL 使用同源文档级 replace 导航跳转到返回目标，确保新写入的 session cookie 被目标页面立即使用。
- 已登录用户访问登录页并被自动带回目标页时，也应使用同样的文档级 replace 导航，避免继续使用旧的登录页/目标页缓存。
- 补充登录页单元测试，覆盖成功登录后触发文档级 replace 导航。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `auth-session`: 增加登录成功后客户端执行文档级 replace 导航的要求，保证 session cookie 写入后无需手动刷新。

## Impact

- 影响 `src/app/login/page.tsx` 的登录成功与已认证自动跳转流程。
- 影响 `tests/unit/web-login-page.test.tsx` 的登录导航 mock 与行为断言。
- 不改变认证 API、cookie 格式、服务端鉴权逻辑或外部依赖。

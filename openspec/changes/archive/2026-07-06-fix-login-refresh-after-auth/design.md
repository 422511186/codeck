## Context

当前登录页在 `auth.login()` 成功后直接调用 `router.replace(returnPath)`。服务端登录接口已经通过 `Set-Cookie` 写入 `codex_web_session`，但 App Router 的客户端路由缓存可能仍保留登录前的状态；目标页面首次渲染或事件流重连时仍可能表现为未登录，用户需要手动刷新浏览器才能恢复。

全局 `AppProviders` 会在 `/login` 页面跳过事件流连接，离开登录页后再重连。因此修复点应靠近登录页的“认证状态发生变化”边界，而不是改动所有受保护页面或 API。

## Goals / Non-Goals

**Goals:**

- 登录成功后无需用户手动刷新，目标页面通过一次自动文档导航立即使用最新 session cookie。
- 已经认证的用户访问登录页并自动跳回目标页时，同样绕开登录前的客户端路由缓存。
- 用登录页单元测试锁定文档级 replace 导航调用。

**Non-Goals:**

- 不改变 `codex_web_session` cookie 格式、签名方式或有效期。
- 不引入服务端 middleware 或新的认证状态 store。
- 不改变 `/api/codex/*` 路由的鉴权规则。

## Decisions

1. 在登录页认证成功后使用 `window.location.replace(returnPath)` 的封装函数进行文档级导航。

   理由：认证边界发生在登录页，问题现象等价于“目标页面需要一次浏览器刷新”。App Router 的 `router.refresh()` 只刷新当前 route 且可能保留客户端 state；对从登录页跳回之前缓存过的目标页来说，它不如文档级 replace 导航确定。登录发生频率低，使用整页 replace 可以直接让浏览器带上最新 cookie 重新请求目标页，同时不把登录页留在历史栈里。

   备选方案：
   - 使用 `router.replace(returnPath)` 后再 `router.refresh()`。SPA 体验更轻，但刷新目标与客户端 state 保留语义不够确定，可能不能彻底消除手动刷新需求。
   - 在所有受保护页面 mount 时主动查询 session。覆盖面大，容易重复，并不能解决路由缓存本身的问题。

2. 将文档导航封装到 `src/web/navigation/location.ts`。

   理由：JSDOM 中 `window.location.replace` 不便直接 mock；封装函数让登录页测试可以断言导航目标，同时保持生产代码只做一件事。

## Risks / Trade-offs

- [Risk] 文档级导航会放弃一次 SPA 软跳转体验。  
  Mitigation：只在登录态确认变化时触发，频率极低；收益是彻底避免目标页继续使用登录前缓存。

- [Risk] 新封装函数可能被误用于外部 URL。  
  Mitigation：登录页继续只传入 `safeLoginReturnPath` 过滤后的站内绝对路径，外部 URL 和 protocol-relative URL 回退到 `/projects`。

## ADDED Requirements

### Requirement: Cookie-based session authentication
系统 SHALL 使用 HMAC-SHA256 签名的 cookie 进行会话认证。cookie 名为 `codex_web_session`，payload 为 base64url 编码的 JSON `{t, v}`，后跟 `.` 分隔的 HMAC 签名。签名验证 MUST 使用 `timingSafeEqual` 防止时序攻击。

#### Scenario: Valid cookie passes authentication
- **WHEN** 请求携带格式正确且签名匹配的 `codex_web_session` cookie
- **THEN** `isRequestAuthenticated` 返回 `true`

#### Scenario: Missing cookie fails authentication
- **WHEN** 请求不携带 `codex_web_session` cookie
- **THEN** `isRequestAuthenticated` 返回 `false`

#### Scenario: Tampered signature fails authentication
- **WHEN** 请求携带的 cookie 签名与预期不匹配
- **THEN** `isRequestAuthenticated` 返回 `false`

#### Scenario: Signature length mismatch fails authentication
- **WHEN** 请求携带的 cookie 签名长度与预期不同
- **THEN** `isRequestAuthenticated` 返回 `false`，不进行 `timingSafeEqual` 比较

### Requirement: Session cookie properties
创建的 session cookie SHALL 设置 `httpOnly=true`、`sameSite=lax`、`path=/`、`maxAge=30天`。

#### Scenario: Cookie attributes on login
- **WHEN** 调用 `createSessionCookie`
- **THEN** 返回的 Set-Cookie 头包含 `HttpOnly`、`SameSite=Lax`、`Path=/`、`Max-Age=2592000`

### Requirement: Access token generation
系统 SHALL 在未配置 `CODEX_WEB_ACCESS_TOKEN` 环境变量时自动生成 `sk-` 前缀的随机 token（32 字节 base64url 编码）。系统 MUST 在 `generatedAccessToken=true` 时将 token 打印到控制台。

#### Scenario: Auto-generated token
- **WHEN** 启动时未设置 `CODEX_WEB_ACCESS_TOKEN`
- **THEN** 自动生成 `sk-{random}` token 并打印到控制台

#### Scenario: Configured token
- **WHEN** 启动时设置了 `CODEX_WEB_ACCESS_TOKEN`
- **THEN** 使用配置值，`generatedAccessToken` 为 `false`，不打印到控制台

### Requirement: WebSocket authentication
WebSocket 连接（路径 `/ws`）MUST 在 upgrade 阶段校验 cookie 认证。未认证的连接 SHALL 返回 `401 Unauthorized` 并销毁 socket。

#### Scenario: Authenticated WebSocket upgrade
- **WHEN** 客户端发起 `/ws` upgrade 且携带有效 session cookie
- **THEN** 升级成功，客户端收到 `{type: "hello", status: "connected"}` 消息

#### Scenario: Unauthenticated WebSocket upgrade
- **WHEN** 客户端发起 `/ws` upgrade 且无有效 cookie
- **THEN** 服务端写入 `HTTP/1.1 401 Unauthorized` 并销毁 socket

### Requirement: API route authentication
所有 `/api/codex/*` 路由 SHALL 在处理请求前调用 `isRequestAuthenticated`。未认证请求 MUST 返回 `{ok: false}` 和 HTTP 401。

#### Scenario: Unauthenticated API request
- **WHEN** 任何 `/api/codex/*` 请求不携带有效 session cookie
- **THEN** 返回 HTTP 401 和 `{ok: false}`

### Requirement: Account login via ChatGPT
系统 SHALL 通过 app-server 的 `account/login/start` 方法（type=chatgpt）发起 ChatGPT 登录流程，返回包含 `loginId` 和 `authUrl` 的结果。操作 MUST 记录审计日志。

#### Scenario: ChatGPT login initiation
- **WHEN** 已认证用户 POST `/api/codex/account/login/chatgpt`
- **THEN** 调用 `gateway.loginWithChatGpt()`，返回 `{ok: true, login: {type: "chatgpt", loginId, authUrl}}`

### Requirement: Account login via API Key
系统 SHALL 通过 app-server 的 `account/login/start` 方法（type=apiKey）使用 API Key 登录。API Key 作为请求参数传递。审计日志 MUST 仅记录 `keyLength` 而不记录 key 值。

#### Scenario: API Key login
- **WHEN** 已认证用户 POST `/api/codex/account/login/api-key` 并提供非空 `apiKey`
- **THEN** 调用 `gateway.loginWithApiKey(apiKey)`，审计日志记录 `{keyLength: N}`

#### Scenario: Empty API Key rejected
- **WHEN** 已认证用户 POST `/api/codex/account/login/api-key` 且 `apiKey` 为空
- **THEN** 返回 HTTP 400 和 `{ok: false, error: "apiKey 不能为空"}`

### Requirement: Account logout
系统 SHALL 通过 app-server 的 `account/logout` 方法登出。操作 MUST 记录审计日志。

#### Scenario: Logout
- **WHEN** 已认证用户 POST `/api/codex/account/logout`
- **THEN** 调用 `gateway.logoutAccount()`，记录审计日志

**Open Questions**

1. **Cookie 无轮换机制**：session cookie 有效期 30 天，无 token 轮换或刷新机制。缺少 CSRF token（依赖 `sameSite: lax`）。是否需要更强的 CSRF 防护？
2. **API Key 明文经过后端**：API Key 在 HTTP 请求体中以明文传递给 app-server。是否需要端到端加密或仅在 TLS 层保护？
3. **WebSocket 认证仅限 upgrade 阶段**：连接建立后不再重新校验。如果 cookie 过期，已建立的 WebSocket 连接不受影响。是否符合预期？

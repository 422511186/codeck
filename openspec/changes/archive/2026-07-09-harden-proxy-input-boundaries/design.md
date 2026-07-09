## Context

移动端 Web 后端承担浏览器到 Codex app-server 的代理职责。现有代码已经有 `readJsonRecord()`、`RouteValidationError`、`assertAllowedPath()` 等 helper，但旧 route 仍混用直接 `request.json()`、宽泛 `catch` 和 `request.json().catch(() => ({}))`。这造成同类客户端错误在不同入口返回 400、502 或被吞掉继续调用 app-server。

路径边界同样存在局部不一致：大部分 cwd/path 输入已经经过 `assertRuntimePathAllowed`，但 plugin installed 的 `cwds` 仍直接透传；图片预览把系统 `tmpdir()` 加入根目录，超过 README 和 turn spec 对图片来源的约束。app-server WebSocket transport 对损坏 JSON-RPC 帧没有隔离，`JSON.parse` 异常可能从 message handler 冒泡。

## Goals / Non-Goals

**Goals:**

- 让所有 `/api/codex/*` JSON body route 对 malformed JSON、非对象 body、字段类型错误和必填字段缺失稳定返回 HTTP 400。
- 确保 malformed JSON 不会触发任何 app-server 调用或配置副作用。
- 校验 plugin installed `cwds`，不允许浏览器把 workspace allowlist 外路径透传给 app-server。
- 将图片预览读取范围收敛到 workspace roots 和 uploadDir。
- 让 app-server JSON-RPC malformed frame 变成可诊断连接错误，而不是未捕获异常。
- 用 Vitest 覆盖关键负向路径，特别是“不调用 app-server”。

**Non-Goals:**

- 不引入 CSRF token、命令白名单、上传大小限制或 fs/remove 二次确认；这些仍属于现有 Open Questions。
- 不改变个人使用模式、登录 cookie 模型或 app-server 协议字段。
- 不重构所有 route 的响应文案，只统一错误分类和副作用边界。
- 不扩大图片预览能力到任意 app-server 临时文件；如未来需要，应单独设计受控临时文件授权。

## Decisions

1. 统一 JSON route 解析入口使用 `readJsonRecord()` 或同等 typed helper。

   理由：项目已有 helper 可以把 JSON 解析失败转换为 `RouteValidationError`，再由 `serverError()` 返回 400。继续在每个 route 手写 `request.json()` 容易遗漏，并导致 502 或吞错副作用。

   替代方案：只修审查中列出的几个 route。拒绝该方案，因为规范覆盖所有使用 JSON body 的 `/api/codex/*` route，局部修复会保留同类缺陷。

2. 字段校验错误统一归类为 route validation，不在校验完成前执行 audit 或 app-server 调用。

   理由：审计日志应反映有效操作尝试；malformed JSON 或类型错误不应留下看似真实业务操作的审计记录，也不应触发配置清空、插件安装等副作用。

   替代方案：保留部分 route 的字段错误为 502。拒绝该方案，因为 `audit-and-security` 已要求字段类型错误和必填字段缺失属于客户端错误。

3. 对 plugin installed `cwds` 使用严格字符串数组校验并逐项调用 `assertAllowedPath()` / `assertRuntimePathAllowed()`。

   理由：`cwds` 语义是 repo-scoped 工作目录，属于本机路径输入。使用严格数组校验可以避免静默丢弃非字符串元素后改变请求含义。

   替代方案：沿用 `optionalStringArray()`。拒绝该方案，因为它会忽略错误类型，且不会做 workspace allowlist 校验。

4. 图片预览只允许 workspace roots 和 uploadDir。

   理由：README 和 turn spec 明确上传目录是图片来源的额外允许根；系统 tmpdir 没有相同授权语义。移除 tmpdir 可避免已认证用户读取 `/tmp` 下任意已知图片路径。

   替代方案：保留 tmpdir 并在文档中声明。拒绝该方案，因为这会扩大本机读取面，且没有当前产品需求证明需要。

5. JSON-RPC malformed frame 在 transport 层隔离。

   理由：transport 层拥有 socket、rpc 和 status，可以在解析失败时拒绝 pending requests、关闭连接并设置诊断。让 `JsonRpcPeer.handleMessage()` 抛出给调用方比在 peer 内吞错更清晰。

   替代方案：让 `JsonRpcPeer.handleMessage()` catch 并忽略。拒绝该方案，因为忽略损坏帧会让调用方无法感知协议状态已经不可信。

## Risks / Trade-offs

- [Risk] 批量迁移 route 时可能改变少数前端依赖的错误状态码。→ Mitigation：只把客户端输入错误改为 400，保留 app-server 失败为 502；为高频 route 增加回归测试。
- [Risk] 移除 `tmpdir()` 后，历史 timeline 中来自系统临时目录的图片可能无法预览。→ Mitigation：当前发送图片只允许 workspace/uploadDir；如 app-server 生成图确需临时目录，后续用受控授权根单独建模。
- [Risk] JSON-RPC malformed frame 关闭连接可能中断正在运行的请求。→ Mitigation：损坏协议帧说明连接已不可信，明确失败 pending request 比挂起或崩溃更可恢复。
- [Risk] 严格 JSON 对象校验可能拒绝历史客户端发送的 `null` 或数组 body。→ Mitigation：所有目标 route 都按对象字段读取；非对象 body 作为 400 更符合当前规格。

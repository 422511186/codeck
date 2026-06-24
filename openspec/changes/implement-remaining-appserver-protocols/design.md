## Context

本项目是面向手机浏览器的 Codex Web 后端。浏览器只访问本项目的 HTTP API 和 WebSocket，真正的 Codex 会话、文件、终端、插件、MCP 和设置能力由后端通过 app-server JSON-RPC 代理。

现状是 `docs/generated/app-server-ts/ClientRequest.ts` 中共有 122 个 client request method，源码已经覆盖其中 102 个；剩余 20 个 method 目前靠 `tests/unit/protocol-coverage.test.ts` 的排除正则跳过。这些 method 集中在环境、external agent config、feedback、marketplace、plugin share、MCP tool call 和 thread realtime。仓库里目前没有已有 OpenSpec capability，因此本变更新增 `appserver-remaining-protocols` 作为完整能力边界。

约束：

- 人工文档使用中文，OpenSpec 结构标题和规范关键字保持英文。
- 机器生成的 app-server 协议文件保持原样。
- 产品只做移动端 Web，新增后端能力不引入电脑端布局。
- 现有后端模式保持：Next route handler 做认证、参数校验和审计；`AppServerGateway` 做 readiness；`CodexAppServerClient` 做 typed JSON-RPC 调用；mock runtime 支持单元测试和移动端联调。

## Goals / Non-Goals

**Goals:**

- 补齐 20 个剩余 app-server method 的 typed client、gateway、mock 和 HTTP API 代理。
- 为每组能力提供稳定的移动端返回结构，避免前端直接依赖 app-server generated 类型的全部细节。
- 更新后端 API 文档和测试，使协议覆盖率测试能在新增 method 未接入时失败。
- 对可能改变本机配置、插件、marketplace、feedback 或远程会话状态的入口保持认证、审计和最小参数校验。

**Non-Goals:**

- 不重生成或手写修改 `docs/generated/app-server-*` 协议文件。
- 不实现完整桌面端交互，也不新增桌面布局。
- 不在本变更内设计复杂的 realtime 音频 UI；后端只提供移动端可调用的会话控制、输入追加和 voice 列表能力。
- 不把 app-server 变成任意 method 的开放代理；本项目仍然显式接入需要暴露给移动端 Web 的协议。

## Decisions

### Decision 1: 继续使用显式 typed gateway，而不是通用 JSON-RPC 透传

实现时为每个剩余 method 在 `CodexAppServerClient` 中新增 typed 方法，并由 `AppServerGateway` 暴露移动端语义方法。HTTP route 只调用 gateway，不直接访问 app-server peer。

备选方案是新增一个 `/api/codex/app-server/request` 通用透传端点。该方案实现更快，但会绕开现有认证、审计、路径校验和 mobile view 转换边界，也会让移动端误用尚未审视的 app-server method。显式 gateway 更啰嗦，但与当前代码风格一致，测试也更容易定位缺口。

### Decision 2: HTTP API 按能力分组，保持移动端友好的薄包装

新增 route 按现有目录习惯分组，例如 marketplace、plugin share、MCP tool call、external agent config、feedback、environment 和 realtime。请求体使用移动端需要的字段，gateway 再转换为 generated params；响应只返回移动端需要展示或继续调用的字段。

对于已经存在基础入口的能力，优先扩展同一命名空间，避免新增孤立路径。对于高风险写操作，route 必须执行认证、基础 schema 校验和 audit 记录。

### Decision 3: Mock runtime 提供确定性结果，不模拟外部副作用

mock app-server 要覆盖所有新增 method，让单元测试、开发模式和 protocol coverage 都能通过。marketplace/plugin share/external agent config/feedback 等能力返回稳定的示例数据或状态；realtime 返回可预测的会话 ID、voice 列表，并通过既有通知归一化路径记录必要事件。

不在 mock 中真的上传反馈、修改 marketplace、安装外部 agent 或处理音频流。这样能保证测试稳定，同时保留真实 app-server 模式的协议形状。

### Decision 4: Realtime 先接后端协议闭环，事件仍走现有 WebSocket 通道

`thread/realtime/start`、`appendAudio`、`appendText`、`appendSpeech`、`stop`、`listVoices` 由 HTTP API 触发，相关 app-server notification 继续通过现有 `normalizeAppServerNotification` 和 `/ws` 下发。后端需要识别新的 realtime notification 并映射为移动端可分发事件，避免前端只能靠轮询确认状态。

这比单独建立 realtime WebSocket 简单，且符合当前浏览器事件流模型。代价是后续若要做低延迟音频播放，可能需要再设计媒体流通道。

### Decision 5: 覆盖率测试改为真实守门

实现完成后收紧 `tests/unit/protocol-coverage.test.ts`：移除或缩小当前排除正则，使这 20 个 method 必须出现在源码中。新增单元测试分别覆盖 typed client method 名称、mock gateway 行为、HTTP route 成功路径和关键失败路径。

## Risks / Trade-offs

- [Risk] 20 个 method 横跨多组能力，单次变更容易变大。→ Mitigation: 按能力组拆任务和测试，每组先补 client/gateway/mock，再补 route 和文档。
- [Risk] 某些 app-server response 字段较复杂，移动端 view 过度抽象可能丢失后续 UI 需要的信息。→ Mitigation: route 响应保留关键 ID、状态、错误和分页字段；复杂原始结果可用 `MobileJsonValue` 暂存，但不开放任意代理。
- [Risk] realtime 音频相关参数和 notification 对移动端浏览器适配要求高。→ Mitigation: 本变更只保证协议闭环和事件下发，媒体采集/播放 UI 留给后续专门变更。
- [Risk] marketplace、plugin share、feedback 等写操作有副作用。→ Mitigation: 所有写 route 均要求 session cookie、审计记录和参数白名单校验，错误统一返回 `{ ok: false, error }`。
- [Risk] 当前文档列出部分预留入口，但未覆盖全部剩余协议。→ Mitigation: 更新 `docs/backend-api.md`，按移动端调用顺序补齐新增 API 表格和关键请求体示例。

## Migration Plan

1. 在实现阶段先补单元测试并确认失败，锁定 20 个 method 的行为缺口。
2. 按能力组实现 client/gateway/mock/route/documentation。
3. 收紧协议覆盖率测试，运行 `npm run typecheck`、`npm run test` 和必要的 HTTP route 单测。
4. 因为本变更只新增后端 API 和 mock 行为，不需要数据迁移。回滚时移除新增 route、gateway 方法、mock 分支、文档段落，并恢复覆盖率测试排除规则。

## Open Questions

- 没有阻塞实施的问题。实现时需要以 generated TS 类型为准核对每个 method 的 request/response 字段，并在移动端 view 中只暴露当前手机 Web 需要的稳定字段。

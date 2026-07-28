## Why

手机通过局域网 HTTP 访问时，Markdown 代码块“复制”按钮点击后完全没有反馈。当前实现只依赖 `navigator.clipboard.writeText`，在非 secure context 下会静默失败；同时复制按钮以 absolute 浮层叠在代码右上角，容易挡住正文。

## What Changes

- 为前端提供可在局域网 HTTP 场景工作的统一复制能力，Clipboard API 不可用时回退到兼容路径
- 代码块复制成功/失败都必须给出可见反馈，禁止静默失败
- 调整代码块布局：复制按钮独立成工具栏行，不再覆盖代码正文
- 代码块复制入口优先复用统一复制 helper；其他已有复制入口可逐步共用，但不扩大到无关 UI 改造

## Capabilities

### New Capabilities

- 无

### Modified Capabilities

- `agent-output-rendering`: 明确代码块复制在非 secure context 下仍须可用，并要求复制按钮不遮挡代码正文

## Impact

- 前端：`src/web/components/Markdown.tsx` 的 `CodeBlock` 布局与复制逻辑
- 可能新增共享复制工具：如 `src/web/lib/clipboard.ts` 或等价位置
- 测试：`tests/unit/web-markdown.test.tsx` 及相关 timeline 渲染测试
- 不影响服务端协议、timeline 事件流和发送链路

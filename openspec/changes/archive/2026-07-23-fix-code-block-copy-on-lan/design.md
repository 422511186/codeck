## Context

项目默认面向手机浏览器，常见使用方式是本机开发服务通过局域网 IP 给其他设备访问，例如 `http://192.168.x.x:port`。当前 Markdown 代码块复制只调用 `navigator.clipboard.writeText`，在非 secure context 下会静默失败；复制按钮又以 absolute 浮层叠在代码右上角，容易挡住正文。

## Goals / Non-Goals

**Goals:**
- 局域网 HTTP 场景下代码块复制可用
- 复制成功和失败都有可见反馈
- 复制按钮不再覆盖代码正文
- 保持现有代码块主题样式和完整原文复制语义

**Non-Goals:**
- 不改造全部 timeline 复制入口的视觉样式
- 不引入第三方 clipboard 库
- 不改动 progressive markdown / live 渲染策略
- 不处理系统级剪贴板权限弹窗之外的原生能力

## Decisions

1. **统一复制 helper，而不是只在 CodeBlock 内联补丁**
   - 优先 `navigator.clipboard.writeText`
   - 失败或不可用时回退到临时 `textarea` + `document.execCommand("copy")`
   - 返回明确成功/失败结果，供 UI 展示状态
   - 备选：只在 CodeBlock 内写 fallback；否决原因是其他复制入口也有同样脆点，至少 helper 应可复用

2. **代码块布局改为 toolbar，而不是继续 absolute + paddingRight**
   - 顶部独立一行放置复制按钮
   - 下方 `<pre><code>` 完整展示正文
   - 备选：保留浮层但加大右侧 padding；否决原因是窄屏和“已复制”文案宽度变化仍会遮挡

3. **失败反馈做就地按钮状态，不引入全局 toast 系统**
   - 成功：`已复制`
   - 失败：`复制失败`
   - 保持与现有主题 token 一致

## Risks / Trade-offs

- [Risk] `execCommand("copy")` 在部分浏览器被弃用 → Mitigation：仅作 Clipboard API 失败后的兼容回退，并保留失败可见反馈
- [Risk] 工具栏占用额外垂直空间 → Mitigation：工具栏高度保持紧凑，优先保证正文不被遮挡
- [Risk] 测试环境剪贴板行为不一致 → Mitigation：对 helper 做单测，组件测试 mock helper 或 clipboard API

## Migration Plan

- 纯前端改动，无数据迁移
- 发布后旧页面刷新即生效
- 若回退，恢复旧 CodeBlock 即可，不影响服务端状态

## Open Questions

- 无。第一版只强制代码块入口使用统一 helper；其他复制入口可后续复用。

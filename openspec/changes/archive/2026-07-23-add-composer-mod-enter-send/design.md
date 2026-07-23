## Context

底部 composer 当前只有发送按钮触发提交；规格和测试都要求普通 `Enter` 不发送，以适配移动端多行输入。用户需要在 macOS / Windows / Linux 外接键盘场景下用修饰键发送，同时保留 Enter 换行和 IME 中文输入安全。

## Goals / Non-Goals

**Goals:**
- 支持 `Cmd+Enter` 与 `Ctrl+Enter` 发送
- 普通 `Enter` 继续换行
- IME 组字期间不误发送
- 快捷键发送与按钮发送共用同一套可发送条件

**Non-Goals:**
- 不把普通 `Enter` 改成发送
- 不做桌面/移动自适应的 Enter 语义切换
- 不新增快捷键帮助面板或设置项
- 不改 running 态 interrupt 快捷键

## Decisions

1. **采用“修饰键发送，Enter 换行”**
   - 已由产品确认
   - 比 Enter 发送更符合移动端优先

2. **同时识别 `metaKey` 与 `ctrlKey`**
   - macOS：`Cmd+Enter`
   - Windows/Linux：`Ctrl+Enter`
   - 不单独区分平台 UA

3. **在 `keydown` 处理，并显式处理 IME**
   - 检查 `isComposing` 与 `keyCode === 229`
   - 仅在确认可发送时 `preventDefault()` 并调用现有 `send()`

4. **快捷键发送完全复用 `canSend` / `sendingRef`**
   - 空文本、上传中、running、blocked 时都不发送

## Risks / Trade-offs

- [Risk] 某些 IME 在组字结束瞬间仍带 composing 标记 → Mitigation：同时检查 `isComposing` 与 `keyCode === 229`，并保留普通 Enter 永不发送
- [Risk] 用户期望普通 Enter 发送 → Mitigation：本 change 明确不支持；若后续需要，另开自适应方案
- [Risk] 测试环境键盘事件差异 → Mitigation：用 `fireEvent.keyDown` 覆盖 meta/ctrl/composing 矩阵

## Migration Plan

- 纯前端改动
- 现有“普通 Enter 不发送”测试继续保留
- 无服务端迁移

## Open Questions

- 无。

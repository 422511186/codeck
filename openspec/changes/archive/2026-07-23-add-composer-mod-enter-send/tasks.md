## 1. 键盘发送行为

- [ ] 1.1 为 `ChatInput` 补充 `Cmd/Ctrl+Enter` 发送、普通 Enter 不发送、IME composing 不发送的失败测试
- [ ] 1.2 在 textarea `onKeyDown` 中实现修饰键发送，复用现有 `canSend` / `send` / `sendingRef`
- [ ] 1.3 确保 running、上传中、空文本、blocked 状态下快捷键不发送

## 2. 验证

- [ ] 2.1 运行 `web-chat-input` 相关测试与必要的类型检查，确认无回归

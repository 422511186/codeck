## 1. 切分与测试

- [ ] 1.1 新增 `splitStreamingMarkdown` 纯函数，按闭合 fence 与段落边界拆出 stable/pending
- [ ] 1.2 为切分函数补充单元测试：完整段落、未闭合代码块、闭合代码块后继续输出

## 2. Live 渲染接入

- [ ] 2.1 修改 `AgentMessage` live 路径：stable 用 Markdown，pending 用 PlainAgentText
- [ ] 2.2 更新 timeline 测试，覆盖 progressive live 渲染与未完成 fence 仍为 plain

## 3. 验证

- [ ] 3.1 运行相关单元测试与类型检查，确认无回归

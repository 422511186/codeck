## 1. 复制 helper

- [x] 1.1 新增统一 `copyText` helper，优先 Clipboard API，失败后回退 `textarea + execCommand("copy")`，并返回成功/失败结果
- [x] 1.2 为 helper 补充单元测试，覆盖 Clipboard API 成功、不可用回退成功、全部失败三类路径

## 2. 代码块 UI 与接入

- [x] 2.1 将 `CodeBlock` 改为独立工具栏布局，复制按钮不再 absolute 覆盖正文
- [x] 2.2 让代码块复制按钮接入统一 helper，并展示“已复制 / 复制失败”可见状态
- [x] 2.3 更新 `web-markdown` 相关测试，覆盖布局不遮挡、成功反馈、失败反馈

## 3. 验证

- [x] 3.1 运行相关单元测试与必要的类型检查，确认无回归

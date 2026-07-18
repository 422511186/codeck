## 1. Markdown 图片渲染

- [x] 1.1 先为本机绝对路径转换、非本机 URL 保持和危险协议过滤补充失败测试
- [x] 1.2 实现 ReactMarkdown 安全 URL 转换与正文图片组件
- [x] 1.3 先为正文图片失败、重试、全屏预览和移动端尺寸补充失败测试，再完成交互

## 2. Skill 引用恢复与展示

- [x] 2.1 先为严格独占整行恢复、代码块保护、结构化优先和去重补充失败测试
- [x] 2.2 实现 timeline Skill 兼容恢复与可读名称派生
- [x] 2.3 先为独立语义胶囊、无空气泡、多项换行和路径隐藏补充失败测试，再完成 UI

## 3. 图片预览安全

- [x] 3.1 先为文件与目录符号链接逃逸、非普通文件和 nosniff 响应补充失败测试
- [x] 3.2 实现 canonical roots 与候选真实路径二次校验及响应头

## 4. 验证与验收

- [x] 4.1 运行相关单元测试、typecheck、全量 verify、build 与 OpenSpec strict 校验
- [x] 4.2 启动开发服务并在当前真实会话完成桌面和 390px 手机视口截图验收
- [x] 4.3 自审 diff、确认未修改 docs/generated/ 且所有 OpenSpec tasks 已完成

## 5. Skill 单一消息视觉边界修复

- [x] 5.1 先将组件测试改为要求 Skill 固定在同一用户消息气泡顶部、图片与正文随后显示，并验证仅含 Skill 时只生成一个正常气泡
- [x] 5.2 实现气泡顶部 Skill 上下文布局，保持胶囊间换行、单项省略、路径隐藏、复制正文、失败重试与消息菜单行为
- [x] 5.3 运行相关测试、全量 verify、build 与 OpenSpec strict，并在当前真实会话完成发送后桌面和 390px 视口截图验收

## 6. Skill 刷新回放修复

- [x] 6.1 先为隐藏 `<skill>` rollout 扫描、多个 Skill、非法格式、结构化优先和用户锚点歧义补充失败测试
- [x] 6.2 在受限 session timeline supplement 中恢复最小 `name/path` 元数据并保守合并到对应用户 item，禁止携带 Skill 正文
- [x] 6.3 运行相关测试、全量 verify、build、发布校验与 OpenSpec strict，并部署到 e3 验证刷新回放

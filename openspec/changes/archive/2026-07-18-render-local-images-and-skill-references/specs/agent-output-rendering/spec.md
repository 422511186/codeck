## ADDED Requirements

### Requirement: Agent Markdown 安全展示本机图片引用
Agent Markdown SHALL 将 POSIX 或 Windows 绝对图片路径通过现有认证图片预览 API 展示，并提供稳定、适合移动端的正文图片交互。系统 MUST 不把相对路径交给本机文件预览 API，也 MUST 不因自定义 URL 转换放宽 ReactMarkdown 对危险协议的过滤。

#### Scenario: POSIX 绝对图片路径
- **WHEN** agent Markdown 包含 `/Users/.../shot.png` 或其他 POSIX 绝对图片路径
- **THEN** 图片 `src` MUST 使用 `/api/codex/images/preview?path=...`
- **AND** 浏览器 MUST 不直接请求该绝对路径对应的站内 URL

#### Scenario: Windows 绝对图片路径
- **WHEN** agent Markdown 包含 `C:\Users\...\shot.png` 或 `C:/Users/.../shot.png`
- **THEN** 系统 MUST 正确恢复路径语义并只进行一次 URL 编码
- **AND** 图片 MUST 通过预览 API 加载

#### Scenario: 非本机图片 URL 保持语义
- **WHEN** agent Markdown 图片使用 `http:`、`https:`、`/api/`、`blob:`、受支持的 `data:` 或协议相对 URL
- **THEN** 系统 MUST 保持既有 URL 语义
- **AND** MUST 不把该 URL 包装成本机文件预览请求

#### Scenario: 相对路径不进入本机预览
- **WHEN** agent Markdown 图片使用相对路径
- **THEN** 系统 MUST 不把该路径发送给本机文件预览 API

#### Scenario: 正文图片加载成功
- **WHEN** Markdown 图片成功加载
- **THEN** 图片 MUST 保持自然宽高比且宽度不得超过消息容器
- **AND** 用户点击图片 MUST 打开现有全屏图片预览

#### Scenario: 正文图片加载失败
- **WHEN** Markdown 图片加载失败
- **THEN** UI MUST 隐藏浏览器原生破图并显示通用失败占位
- **AND** 用户 MUST 能重试加载
- **AND** UI MUST 不显示本机绝对路径或服务端错误详情

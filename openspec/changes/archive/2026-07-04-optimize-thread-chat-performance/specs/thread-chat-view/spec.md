## ADDED Requirements

### Requirement: 会话首屏读取使用有界最近 turns
会话聊天页在浏览器刷新、首次进入或 snapshot repair 时 SHALL 使用有界最近 turns 作为首屏 timeline 数据源，MUST NOT 默认读取完整历史 turns。默认首屏窗口 SHOULD 覆盖最近 30 个 turns 或等价数量级，并保留继续向上分页加载更早历史的 cursor。

#### Scenario: 刷新长会话
- **WHEN** 浏览器刷新并进入一个包含大量历史 turns 的会话
- **THEN** 首次会话详情读取 MUST 只返回最近有界 turns
- **AND** 页面 MUST 在该窗口数据到达后显示聊天界面和输入区
- **AND** 更早历史 MUST 只能通过向上分页继续加载

#### Scenario: Snapshot repair 不全量拉取历史
- **WHEN** timeline event stream 报告某 thread 存在可归属 gap
- **THEN** 页面 MUST 执行有界 snapshot repair 或等价尾部窗口修复
- **AND** repair MUST replace 当前未知尾部
- **AND** repair MUST NOT 因长会话默认拉取完整历史 turns

#### Scenario: 空会话不请求历史窗口
- **WHEN** 会话尚无任何 turns
- **THEN** 页面 MUST 立即显示可用输入区
- **AND** MUST NOT 为了空 timeline 发起无意义的历史分页请求

### Requirement: Timeline 渲染使用窗口化或等价裁剪
会话聊天页 SHALL 只挂载当前可见区域附近的 timeline rows，并为离屏历史内容保留滚动高度或等价定位能力。窗口化实现 MUST 兼容移动端动态高度内容，包括 Markdown、图片、diff、工具卡片、审批卡片和系统消息。

#### Scenario: 长 timeline 初次渲染
- **WHEN** 已加载 timeline 包含大量 entries
- **THEN** DOM 中 MUST 只挂载可见区域及缓冲区内的 rows
- **AND** 离屏 entries MUST NOT 同步创建完整 React/DOM 树

#### Scenario: 向上分页后保持阅读位置
- **WHEN** 用户滚动到顶部并加载更早 turns
- **THEN** 新增历史 entries MUST 插入当前窗口之前
- **AND** 用户当前阅读的可见内容 MUST 保持在原视觉位置附近

#### Scenario: 跳到最新仍可用
- **WHEN** 用户在历史位置阅读且新输出到达
- **THEN** 页面 MUST 保持当前阅读位置
- **AND** 用户点击「跳到最新」后 MUST 滚动到最新输出

### Requirement: Timeline 派生计算不按每行扫描全量 entries
会话聊天页 SHALL 在渲染前预计算 live agent entry、用户消息操作可用性、turn order 和分页边界等派生信息。单个 timeline row MUST NOT 为了判断自身状态反复扫描或过滤完整 entries。

#### Scenario: 用户消息操作状态
- **WHEN** timeline 渲染大量用户消息
- **THEN** 系统 MUST 使用预计算结果判断「回滚到这里」和「从这里 Fork」是否可用
- **AND** MUST NOT 在每条用户消息渲染期间重新遍历完整 entries

#### Scenario: Live agent 状态
- **WHEN** agent 正在输出且 active turn 已知或尚未到位
- **THEN** 系统 MUST 使用预计算 live entry id 判断哪条 agent 消息按 live 方式渲染
- **AND** MUST NOT 在每条 agent 消息渲染期间重新向后扫描完整 entries

### Requirement: 会话页组件订阅粒度隔离 timeline 更新
会话页 SHALL 将 header、timeline、输入区、底部抽屉和弹窗拆分为独立订阅边界。timeline entries 的高频更新 MUST NOT 导致输入框本地草稿、图片选择、Skill 选择、模型菜单或重命名弹窗被重置。

#### Scenario: Delta 到达时输入区保持稳定
- **WHEN** 用户正在输入草稿
- **AND** agent 高频 delta 持续到达
- **THEN** 输入框内容、光标和已选附件 MUST 保持稳定
- **AND** 输入区 MUST NOT 因 timeline entries 变化而重新初始化

#### Scenario: Header 不随每条 delta 重算
- **WHEN** 同一 agent item 连续收到多个文本 delta
- **THEN** 只有 timeline 可见输出和必要 running 状态 SHOULD 更新
- **AND** 会话标题、模型按钮和菜单状态 MUST NOT 因每条文本 delta 重建可见状态

### Requirement: 分页 timeline 顺序跨页面稳定
历史分页和首屏窗口返回的 turns SHALL 在前端合并后保持全局时间顺序和稳定 turn 身份。分页适配层 MUST NOT 使用仅在单页内有效的 `turnIndex` 破坏跨页排序、rewind 或 fork 计算。

#### Scenario: 多页历史合并
- **WHEN** 首屏已加载最近 turns
- **AND** 用户继续向上加载更早一页 turns
- **THEN** 合并后的 timeline MUST 按真实会话顺序排列
- **AND** 每个 entry 的 `turnId` MUST 保持可用于 rewind/fork 计算

#### Scenario: 页面内 turnIndex 重复
- **WHEN** 不同分页返回的 entries 存在重复或页内重置的 `turnIndex`
- **THEN** 前端 MUST 使用更可靠的 turn order 或插入顺序合并
- **AND** MUST NOT 因 `turnIndex` 重复把新旧 turns 排错

### Requirement: 会话聊天性能指标可观测
会话聊天页 SHALL 在开发和测试环境中提供可验证的性能指标或测试钩子，覆盖首屏 entries 数量、timeline store 更新时间、可见 row 数量、delta 批处理 flush 次数和 Markdown 懒渲染数量。

#### Scenario: 长会话性能回归测试
- **WHEN** 测试构造大量历史 entries 和高频 delta
- **THEN** 测试 MUST 能断言可见 store 更新次数、挂载 row 数量或复杂度上限
- **AND** MUST 能防止重新引入全量同步渲染路径

## MODIFIED Requirements

### Requirement: Agent 回复全量渲染 markdown
Agent 回复 SHALL 最终按 GitHub-flavored markdown 全量渲染，包含列表、加粗、表格、链接、内联代码块。为了保证移动端首屏性能，系统 MAY 在消息离屏、尚未进入渲染窗口、浏览器尚未空闲或 agent 仍在流式输出时先展示轻量纯文本占位；当消息进入可见窗口且调度条件满足后，系统 MUST 完成 Markdown 渲染。

#### Scenario: 渲染 markdown 元素
- **WHEN** agent 消息包含 markdown 语法
- **AND** 该消息进入 timeline 可见渲染窗口且 Markdown 渲染已调度完成
- **THEN** 列表、表格、加粗、链接 MUST 渲染为对应可视元素

#### Scenario: 不渲染 LaTeX
- **WHEN** agent 消息包含 `$...$` 或 `\[...\]` 等 LaTeX 公式语法
- **THEN** 系统 MUST 不解析公式
- **AND** MUST 保留原文展示

#### Scenario: 渲染 Mermaid
- **WHEN** agent 消息包含 ```mermaid 代码块
- **AND** 用户展开或查看到该 Mermaid 所在消息
- **THEN** 系统 MUST 渲染为 Mermaid 图

#### Scenario: 离屏历史消息延迟 Markdown
- **WHEN** 会话首屏包含大量历史 agent 消息
- **AND** 某条 agent 消息不在当前渲染窗口内
- **THEN** 系统 MAY 暂时不执行 Markdown 解析、代码高亮或 Mermaid 渲染
- **AND** 该消息进入窗口后 MUST 仍能完成完整 Markdown 渲染

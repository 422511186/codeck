## ADDED Requirements

### Requirement: Timeline 数据读取必须保持有界
会话聊天页 SHALL 在首屏、分页、snapshot repair、turn item 补齐和 rollout supplement 中使用有界 timeline window。系统 MUST NOT 为了补充 activity、context usage、repair 或分页而默认读取完整 turns 历史或完整 rollout JSONL。

#### Scenario: 首屏读取保持最近窗口
- **WHEN** 用户进入包含大量历史 turns 的会话页
- **THEN** 系统 MUST 使用 metadata 加最近 turns window 初始化 timeline
- **AND** MUST NOT 请求 `thread/read includeTurns=true`
- **AND** MUST NOT 因补充 rollout activity 或 context usage 读取完整 rollout JSONL

#### Scenario: 分页读取有默认限制
- **WHEN** 用户向上滚动触发更早历史分页
- **THEN** 前端和后端 MUST 使用默认分页 limit
- **AND** 后端 MUST 对客户端传入的 limit 做上限钳制
- **AND** 单次分页 MUST NOT 返回未受限的完整历史

#### Scenario: Repair 使用有界窗口
- **WHEN** timeline event stream 报告可归属 gap 或 turn completion 需要修复
- **THEN** snapshot repair MUST 读取当前 thread 的最近窗口或目标 turn 相关窗口
- **AND** MUST NOT 因 repair 默认加载完整会话历史

### Requirement: Rollout supplement 不得阻塞主 timeline
会话聊天页 SHALL 把 rollout JSONL supplement 视为可降级补充信息。系统 MUST 优先保证主 timeline 可渲染和可流式更新；当 supplement 无法在有界预算内完成时，MUST 跳过或延后 supplement，而不是阻塞首屏、分页或 repair。

#### Scenario: 大 rollout 文件
- **WHEN** 当前 thread 的 rollout JSONL 很大
- **THEN** 读取 thread detail 或分页 MUST 仍在有界 timeline window 内完成
- **AND** 系统 MAY 暂时缺少部分历史 activity supplement
- **AND** 主 timeline MUST NOT 因完整 JSONL 解析而卡顿

#### Scenario: Supplement 只处理当前窗口
- **WHEN** 当前 timeline window 只包含最近 N 个 turns
- **THEN** rollout supplement MUST 只尝试补齐该窗口内可识别 turn 的 activity/context 信息
- **AND** MUST NOT 为窗口外 turns 生成或合并 timeline entries

### Requirement: 运行中输出无需手动刷新即可收敛
会话聊天页 SHALL 通过 timeline event stream 自动显示运行中 turn 的 agent 回复、reasoning、tool、diff 和完成状态。若 live event 缺失或 listener 空窗导致缺口，系统 MUST 自动触发归属明确的有界 repair，不能要求用户手动刷新页面。

#### Scenario: Live event 正常到达
- **WHEN** 用户发送消息且 app-server 产生 agent/tool/reasoning 输出
- **THEN** 当前会话页 MUST 自动显示这些输出
- **AND** 用户 MUST NOT 需要刷新页面才能看到回复

#### Scenario: Completion 后没有可见输出
- **WHEN** 当前 active turn 收到完成事件
- **AND** timeline 中该 turn 没有任何可见 agent/tool/reasoning/activity 输出
- **THEN** 前端 MUST 对该 turn 或最近窗口触发 bounded repair
- **AND** repair 后 MUST 将真实 thread history 中的输出合并到 timeline

#### Scenario: Listener 空窗恢复
- **WHEN** 底层事件流已消费当前 thread 的可见事件但页面 listener 临时不存在
- **AND** 新 listener 注册或页面重新进入该 thread
- **THEN** 系统 MUST 应用已缓存事件或触发该 thread 的 bounded repair
- **AND** MUST NOT 静默丢失导致用户必须手动刷新

### Requirement: Timeline 更新不得重置非 timeline UI 状态
会话聊天页 SHALL 将 timeline 高频更新与 header、composer、模型/权限选择器、上下文详情、重命名弹窗等 UI 状态隔离。timeline entries 的 delta、repair 或分页更新 MUST NOT 重置输入框草稿、图片选择、Skill 选择或打开中的弹窗。

#### Scenario: 高频 delta 到达
- **WHEN** 当前 turn 高频产生 agent delta
- **THEN** 只有 timeline 可见输出和必要 running 状态 SHOULD 更新
- **AND** composer 本地草稿、图片附件和选择器状态 MUST 保持不变

#### Scenario: Repair replace timeline
- **WHEN** snapshot repair replace 当前 thread timeline
- **THEN** 页面 MUST 保留与 timeline 无关的用户输入状态
- **AND** repair MUST NOT 关闭用户正在操作的模型、权限、目标或上下文面板，除非该面板对应的 thread 已切换

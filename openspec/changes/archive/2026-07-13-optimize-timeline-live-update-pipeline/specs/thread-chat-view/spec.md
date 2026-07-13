## MODIFIED Requirements

### Requirement: Timeline 派生计算不按每行扫描全量 entries
会话聊天页 SHALL 只为当前可见窗口预计算 live agent entry、用户消息操作可用性、turn order、activity blocks 和分页边界等派生信息。单个 timeline row MUST NOT 为了判断自身状态反复扫描或过滤完整 entries；未变化 entry 的引用 MUST 保持稳定，使无关 delta 不触发该 row 的派生和渲染。

#### Scenario: 用户消息操作状态
- **WHEN** timeline 渲染大量用户消息
- **THEN** 系统 MUST 使用预计算结果判断「回滚到这里」和「从这里 Fork」是否可用
- **AND** MUST NOT 在每条用户消息渲染期间重新遍历完整 entries

#### Scenario: Live agent 状态
- **WHEN** agent 正在输出且 active turn 已知或尚未到位
- **THEN** 系统 MUST 使用预计算 live entry id 判断哪条 agent 消息按 live 方式渲染
- **AND** MUST NOT 在每条 agent 消息渲染期间重新向后扫描完整 entries

#### Scenario: Unrelated delta preserves visible row identity
- **WHEN** 当前可见窗口包含多个未变化 rows
- **AND** 其中一个 agent entry 收到文本 delta
- **THEN** 未变化 rows MUST 保持可复用的 entry 引用和派生结果
- **AND** activity block、消息操作状态和 Markdown 派生 MUST 只对受影响 row 或 block 失效

### Requirement: 会话聊天性能指标可观测
会话聊天页 SHALL 在开发和测试环境中提供可验证的性能指标或测试钩子，覆盖首屏 entries 数量、timeline store 提交次数、engine fast-path 次数、结构性 normalization 次数、index rebuild entries、可见 row 数量、delta 批处理 flush 次数和昂贵输出派生次数。

#### Scenario: 长会话性能回归测试
- **WHEN** 测试构造至少 1200 个历史 entries 和同一 item 的 200 个高频 delta
- **THEN** 测试 MUST 能断言可见 store 提交、结构性 normalization 和完整 index rebuild 不随 delta 数量线性重复
- **AND** MUST 能防止重新引入每个 delta 全量同步归一化或整页渲染路径

#### Scenario: 协议 batch 提交预算
- **WHEN** store 接收一个包含多个合法 timeline events 的 `codex-event-batch`
- **THEN** 测试 MUST 能断言同一 thread 的可见 timeline store 提交不超过一次
- **AND** diagnostics MUST 保留接受、丢弃、batch flush 和 barrier revalidation 的计数

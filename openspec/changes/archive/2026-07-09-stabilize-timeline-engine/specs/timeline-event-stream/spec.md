## ADDED Requirements

### Requirement: Timeline event 必须通过统一身份归一化
timeline event stream 客户端 SHALL 将所有可见事件转换为统一 timeline input，并使用稳定 identity key upsert 到 timeline。系统 MUST NOT 仅依赖文本相同、文本包含或数组位置来判断 live event、completed item、snapshot item 是否重复。

#### Scenario: Live delta 与 completed item 同身份
- **WHEN** 客户端先收到某 turn 的 `agent_message_delta`
- **AND** 后续收到同一 generation、turnId 和 itemId 的 completed item
- **THEN** timeline MUST 原位合并为一条 agent message
- **AND** MUST NOT 同时显示 live agent message 和 completed agent message 两条内容

#### Scenario: 文本格式不同但身份相同
- **WHEN** live delta 文本与 completed item 文本存在空白、标点或 Markdown 规范化差异
- **AND** 二者拥有相同 generation、turnId 和 itemId
- **THEN** completed item MUST 替换或补全同一 timeline entry
- **AND** MUST NOT 因文本不互相包含而追加第二条回复

#### Scenario: 缺少稳定身份
- **WHEN** 可见事件缺少可靠 threadId、turnId 或 itemId
- **THEN** 客户端 MUST 使用受限 fallback 或触发 bounded repair
- **AND** MUST NOT 把 ownerless 可见事件默认追加到当前 active thread

### Requirement: Event id 和 revision 账本按 thread generation 隔离
客户端 SHALL 将 processed event id、item revision、snapshot delta suppression 和 deleted-turn barrier 绑定到 thread history generation 或等价历史标识。旧 generation 的幂等账本 MUST NOT 抑制新 generation 中合法复用 item id 的输出。

#### Scenario: Rollback 后复用 item id
- **WHEN** thread rollback 后 generation 增加
- **AND** 新 turn 产生与旧历史相同 itemId 的 agent/reasoning/tool event
- **THEN** 客户端 MUST 按新 generation 独立判断 revision 和 suppression
- **AND** 新输出 MUST 能进入 timeline

#### Scenario: 旧 generation late event
- **WHEN** 客户端已处于较新 generation
- **AND** 收到旧 generation 的可见 event
- **THEN** 客户端 MUST 忽略该 event
- **AND** 被 rollback 删除的旧内容 MUST NOT 重新出现

### Requirement: Delta batch 不得改变事件接受语义
timeline event stream 客户端 SHALL 只把 batch 作为 UI commit 优化。批处理 MUST 保留每条原始 event 的 eventId、generation、revision、sequence、deleted-turn barrier 和 snapshot suppression 判断结果。

#### Scenario: Batch 内既有旧事件又有新事件
- **WHEN** 一个 delta batch 包含旧 generation event 和当前 generation event
- **THEN** 客户端 MUST 逐条应用 generation 判断
- **AND** MUST 只提交当前 generation 中合法的新 delta

#### Scenario: Batch flush 前发生 gap
- **WHEN** 文本 delta 正在 batch window 内等待 flush
- **AND** 同 thread 收到 `timeline-gap` 或 rollback generation bump
- **THEN** 客户端 MUST 丢弃或重新校验该 thread 的未提交 batch
- **AND** MUST NOT 在 repair 或 rollback 后 flush 旧尾部内容

### Requirement: Listener buffer overflow 必须归属到 thread
当底层事件流在没有 listener 时消费可见 timeline event，客户端 SHALL 缓存事件或产生带 threadId 的 repair 信号。buffer overflow MUST NOT 生成无法归属但会破坏 active thread 的 repair；若无法确定归属，MUST 采用非破坏性降级。

#### Scenario: Known thread buffer overflow
- **WHEN** 无 listener 期间当前 buffer 超过安全窗口
- **AND** 被丢弃或压缩的事件能确定 threadId
- **THEN** 客户端 MUST 产生该 thread 的 `timeline-gap` 或等价 repair request
- **AND** 新 listener 注册后 MUST repair 该 thread

#### Scenario: Unknown owner buffer overflow
- **WHEN** buffer overflow 但无法可靠确定事件所属 thread
- **THEN** 客户端 MUST NOT 默认 repair active thread
- **AND** MUST 保留连接异常状态、等待下一条可归属事件或执行不覆盖具体 thread 的恢复策略

### Requirement: Server backlog 不得补发被屏蔽的可见旧事件
服务端 timeline event backlog SHALL 遵守 generation 和 deleted-turn barrier。重连 replay 时，服务端 MUST 不补发会让已 rollback/fork 删除内容重新出现的可见事件；如果无法可靠过滤，MUST 发送归属明确的 `timeline-gap`。

#### Scenario: Backlog 中包含 deleted turn event
- **WHEN** 客户端携带旧 Last-Event-ID 重连
- **AND** backlog 中包含已被 rollback 删除 turn 的可见事件
- **THEN** 服务端 MUST 不补发这些事件
- **AND** 若无法确认过滤结果，MUST 发送带 threadId 的 `timeline-gap`

#### Scenario: Backlog 游标不可恢复
- **WHEN** Last-Event-ID 不在服务端 backlog 可恢复窗口内
- **THEN** 服务端 MUST 发送 `timeline-gap`
- **AND** gap payload SHOULD 包含缺口所属 threadId

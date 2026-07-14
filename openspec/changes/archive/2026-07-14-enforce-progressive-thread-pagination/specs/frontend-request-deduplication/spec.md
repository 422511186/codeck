## MODIFIED Requirements

### Requirement: Read Requests Are Deduplicated Or Cancelled
前端 SHALL 对同一页面生命周期内的高风险读取请求使用稳定 key 去重或取消旧请求，至少覆盖会话元数据读取、局部分页修复、历史分页、模型列表、默认设置和 pending request 恢复读取。任何修复流程 MUST NOT 请求完整会话消息历史。

#### Scenario: Opening a thread triggers one effective metadata read
- **WHEN** 用户打开同一个会话页面且同一 `threadId` 的元数据读取已经进行中
- **THEN** 前端 MUST 复用进行中的读取结果，或取消旧读取并只允许最新读取结果更新页面和 store
- **AND** 元数据响应 MUST 不包含完整 timeline

#### Scenario: Stale thread read cannot overwrite newer state
- **WHEN** 旧的会话元数据或消息页读取在发送消息、局部修复或路由切换之后才返回
- **THEN** 前端 MUST 丢弃旧读取结果，不得覆盖更新后的 timeline、running 状态或 active turn

#### Scenario: Page repair is not amplified
- **WHEN** 多个 timeline gap 或修复信号在同一会话同一 cursor 的修复请求进行中到达
- **THEN** 前端 SHALL 合并为同一轮分页修复请求，直到当前请求完成或被新一代请求取代
- **AND** 修复失败 MUST NOT 触发完整 thread detail 或完整消息读取

### Requirement: Scroll Pagination Uses Cursor Level Locking
前端 SHALL 对历史分页请求按 `threadId` 和 `cursor` 加锁，避免滚动停留在顶部时重复拉取同一页历史；协议错误和服务端错误 SHALL 维持有界请求行为。

#### Scenario: Repeated top scroll while page is loading
- **WHEN** 用户停留在会话顶部且同一 `cursor` 的历史分页请求尚未完成
- **THEN** 前端 MUST NOT 再次请求同一 `threadId` 和 `cursor` 的历史分页

#### Scenario: Pagination failure can be retried
- **WHEN** 历史分页请求失败
- **THEN** 前端 SHALL 释放对应 `cursor` 的分页锁，允许用户显式重试
- **AND** 前端 MUST NOT 自动循环请求失败页
- **AND** 前端 MUST NOT 通过全量会话读取修复失败页

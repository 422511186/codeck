# frontend-request-deduplication Specification

## Purpose
定义移动端 Web 前端在读取请求、副作用动作、发送消息、新建会话和设置变更中的去重、取消、互斥和幂等行为，避免快速点击、滚动、路由切换或并发响应导致重复请求和旧状态覆盖。
## Requirements
### Requirement: Read Requests Are Deduplicated Or Cancelled
前端 SHALL 对同一页面生命周期内的高风险读取请求使用稳定 key 去重或取消旧请求，至少覆盖会话详情读取、会话快照修复、历史分页、模型列表、默认设置和 pending request 恢复读取。

#### Scenario: Opening a thread triggers one effective read
- **WHEN** 用户打开同一个会话页面且同一 `threadId` 的详情读取已经进行中
- **THEN** 前端 MUST 复用进行中的读取结果，或取消旧读取并只允许最新读取结果更新页面和 store

#### Scenario: Stale thread read cannot overwrite newer state
- **WHEN** 旧的会话详情读取在发送消息、快照修复或路由切换之后才返回
- **THEN** 前端 MUST 丢弃旧读取结果，不得覆盖更新后的 timeline、running 状态或 active turn

#### Scenario: Snapshot repair is not amplified
- **WHEN** 多个 timeline gap 或修复信号在同一会话修复请求进行中到达
- **THEN** 前端 SHALL 合并为同一轮修复请求，直到当前修复完成或被新一代请求取代

### Requirement: Scroll Pagination Uses Cursor Level Locking
前端 SHALL 对历史分页请求按 `threadId` 和 `cursor` 加锁，避免滚动停留在顶部时重复拉取同一页历史。

#### Scenario: Repeated top scroll while page is loading
- **WHEN** 用户停留在会话顶部且同一 `cursor` 的历史分页请求尚未完成
- **THEN** 前端 MUST NOT 再次请求同一 `threadId` 和 `cursor` 的历史分页

#### Scenario: Pagination failure can be retried
- **WHEN** 历史分页请求失败
- **THEN** 前端 SHALL 释放对应 `cursor` 的分页锁，允许用户再次滚动触发重试

### Requirement: Mutations Are Guarded By Action Locks
前端 SHALL 对会产生副作用的用户动作使用动作级 pending 锁或等价互斥机制，至少覆盖发送消息、新建会话、中断、归档、撤销归档、压缩、重命名、模型选择、推理强度选择和 Plan/Build 模式切换。

#### Scenario: Duplicate mutation click is ignored while pending
- **WHEN** 用户在同一 mutation 请求完成前重复点击同一动作
- **THEN** 前端 MUST 只发起一次对应 API 请求，并在请求完成前禁用、忽略或复用重复触发

#### Scenario: Failed mutation can be retried
- **WHEN** mutation 请求失败
- **THEN** 前端 MUST 释放对应动作锁，并保留用户可理解的重试路径

#### Scenario: Different resources are independent
- **WHEN** 两个 mutation 作用于不同 `threadId` 或不同资源
- **THEN** 前端 MUST NOT 因一个资源的 pending 锁阻塞另一个资源的合法操作

### Requirement: Sending A Message Is Idempotent Per User Action
发送消息 SHALL 以单次用户发送动作生成的稳定 `clientUserMessageId` 或等价 operation id 作为幂等键，前端和后端 MUST 使用该键避免同一次发送动作启动多个 turn。

#### Scenario: Double tapping send starts one turn
- **WHEN** 用户对同一条待发送消息快速点击发送按钮两次
- **THEN** 前端 MUST 只调用一次 `turn/start`，并且后端 MUST 对相同 `threadId` 与 `clientUserMessageId` 的并发重复请求返回同一个 `turnId`

#### Scenario: Same text can be sent again as a new action
- **WHEN** 用户在上一轮发送完成后再次明确发送相同文本
- **THEN** 前端 SHALL 将其视为新的发送动作，生成新的幂等键，不得因为 payload 相同而永久拦截

#### Scenario: Not loaded thread resume is not duplicated
- **WHEN** 用户在 `notLoaded` 会话中发送消息且恢复请求正在进行中
- **THEN** 前端 SHALL 避免重复调用同一会话的恢复请求，并且发送流程 MUST 在有效恢复结果或已可发送状态后继续

### Requirement: Starting A Thread Is Protected From Duplicate Creation
新建会话 SHALL 对同一项目中的同一次新建动作加 pending 锁，并且移动端 `threads/start` SHALL 支持可选 client operation id；服务端 MUST 在短时间内对相同 operation id 返回同一个 thread。

#### Scenario: Double tapping new thread creates one thread
- **WHEN** 用户在项目会话列表中快速点击“新建会话”两次
- **THEN** 前端 MUST 只发起一次新建会话请求，并只导航到一个新会话

#### Scenario: New thread failure allows retry
- **WHEN** 新建会话请求失败
- **THEN** 前端 MUST 释放新建锁并允许用户再次点击新建会话

#### Scenario: Duplicate start thread operation id is idempotent
- **WHEN** 服务端收到相同 client operation id 的并发或短时间重复新建会话请求
- **THEN** 服务端 MUST 只创建一个 thread，并向重复请求返回同一个 thread

### Requirement: Settings Mutations Resolve To Latest User Choice
模型、推理强度和 Plan/Build 模式设置 SHALL 避免并发乱序导致服务端最终值落后于用户最后选择。

#### Scenario: Rapid mode toggles persist latest mode
- **WHEN** 用户快速切换 Plan/Build 模式多次
- **THEN** 前端 MUST 保证最终发送或最终生效的设置匹配用户最后一次选择

#### Scenario: Stale settings response cannot revert UI
- **WHEN** 较早的设置请求晚于较新的设置请求返回
- **THEN** 前端 MUST NOT 使用较早响应回滚当前 UI 选择或本地 store 状态

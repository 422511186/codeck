## ADDED Requirements

### Requirement: List-triggered thread archive operations
系统 SHALL 支持前端从会话列表直接触发会话归档和取消归档操作，且该入口 MUST 复用既有 thread archive/unarchive API。

#### Scenario: Archive from thread list
- **WHEN** 前端从会话列表对某个 threadId 触发归档
- **THEN** 系统 MUST 调用 `POST /api/codex/threads/{threadId}/archive`
- **AND** 系统 MUST NOT 要求前端先进入会话详情页
- **AND** 系统 MUST NOT 要求前端先读取完整 `ThreadDetail`

#### Scenario: Unarchive from thread list
- **WHEN** 前端从会话列表对某个 threadId 触发移出归档
- **THEN** 系统 MUST 调用 `POST /api/codex/threads/{threadId}/unarchive`
- **AND** 系统 MUST NOT 要求前端先进入会话详情页
- **AND** 系统 MUST NOT 要求前端先读取完整 `ThreadDetail`

#### Scenario: List state after successful archive operation
- **WHEN** 列表入口触发的归档或移出归档请求成功
- **THEN** 前端 MAY 仅基于请求成功结果更新当前列表状态
- **AND** 前端 MUST NOT 依赖返回的完整 timeline 来决定当前 tab 是否移除该条目

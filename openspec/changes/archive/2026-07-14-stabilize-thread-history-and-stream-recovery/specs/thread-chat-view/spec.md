## ADDED Requirements

### Requirement: Historical messages display stable source time
历史分页消息 SHALL 使用消息或 turn 的稳定时间来源，并统一为 Unix 毫秒。客户端 MUST NOT 使用分页请求发生时间作为历史消息时间。

#### Scenario: Historical page lacks item timestamps
- **WHEN** 历史分页 item 没有 `createdAt`，但包含可解析的 UUIDv7 turnId
- **THEN** 客户端 SHALL 从 turnId 恢复 turn 时间
- **AND** 历史消息 MUST NOT 显示为本次请求产生的“刚刚”

#### Scenario: Snapshot fallback uses Unix seconds
- **WHEN** snapshot fallback 时间来自 Unix 秒形式的 thread 时间
- **THEN** 客户端 MUST 在写入 TimelineEntry 前转换为毫秒

### Requirement: Prepending history preserves visible reading progress
加载上一页后，加载前顶部可见消息 SHALL 保持相同 identity 和 viewport 像素偏移。新加载消息 MUST 只出现在当前内容上方，由用户继续上滑查看。

#### Scenario: User loads an older page at the top
- **WHEN** 用户滚动到顶部触发历史分页
- **AND** 新页面 prepend 到现有 timeline
- **THEN** 加载前顶部消息 MUST 保持在相同屏幕位置
- **AND** 页面 MUST NOT 自动替用户上移一页内容

#### Scenario: Prepended content changes height after commit
- **WHEN** prepend 的 Markdown、activity 或图片在初次 commit 后继续改变高度
- **THEN** Timeline SHALL 按原消息 identity 持续恢复锚点
- **AND** 可见文字 MUST NOT 因延迟测量发生跳页或抖动

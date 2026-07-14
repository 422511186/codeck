## ADDED Requirements

### Requirement: Virtualized timeline follows tail without blank windows
长 timeline 的自动贴底 SHALL 由虚拟化 Timeline 在尾部渲染窗口可用后完成。页面 MUST NOT 在虚拟窗口仍指向旧区间时先把滚动容器移动到底部。

#### Scenario: Sending from the bottom of a long thread
- **WHEN** 用户位于长会话 timeline 底部并发送新消息
- **THEN** optimistic user message MUST 立即出现在可见尾部窗口
- **AND** timeline MUST 保持至少一条可见消息
- **AND** 页面 MUST NOT 显示由旧虚拟窗口和新 scrollTop 组合产生的空白区域

#### Scenario: Stream error arrives after sending
- **WHEN** 用户发送消息后收到同一 turn 的 stream disconnected error
- **AND** 用户仍位于 timeline 底部
- **THEN** error entry MUST 出现在可见尾部
- **AND** 既有消息、Files changed 和 optimistic user message MUST 保持可见且顺序稳定

#### Scenario: User is reading history
- **WHEN** 用户不在 timeline 底部并发送前后的 live、repair 或 error 更新到达
- **THEN** Timeline MUST 保持当前阅读 anchor
- **AND** 页面 MUST 显示跳到最新入口
- **AND** 页面 MUST NOT 自动滚到底部或切换为尾部窗口

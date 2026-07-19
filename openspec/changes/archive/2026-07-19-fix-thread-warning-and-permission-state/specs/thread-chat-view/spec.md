## ADDED Requirements

### Requirement: Notices do not affect message ordering

会话 notice MUST 不参与 timeline 排序、虚拟列表索引、底部自动滚动或新消息位置计算。

#### Scenario: Warning arrives after refresh
- **WHEN** 页面刷新后异步收到历史 warning，随后用户发送新消息
- **THEN** warning 固定显示在会话头部区域，新消息仍按正常时间线追加并位于消息列表末端

#### Scenario: Notice is dismissed
- **WHEN** 用户关闭头部 notice
- **THEN** 仅 notice 区域更新，现有消息滚动位置和 timeline 顺序保持不变

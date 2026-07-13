## MODIFIED Requirements

### Requirement: 会话聊天页采用单栏 timeline 布局
会话聊天页 SHALL 使用单栏垂直 timeline 作为主体内容区，timeline 上方是 sticky 头部，下方是参与正常页面布局的底部输入区。

#### Scenario: 默认布局
- **WHEN** 用户进入会话聊天页
- **THEN** 页面 MUST 由「sticky 头部 + 可收缩 timeline + 底部输入区」三段构成
- **AND** timeline MUST 占满头部与输入区之间的剩余区域
- **AND** 输入区 MUST NOT 通过覆盖 timeline 的固定定位实现

### Requirement: 向上无限滚动加载更早消息
timeline SHALL 只通过 thread-wide `cursor + limit` 分页渐进加载消息。任何页面、刷新、恢复、修复、重连或后台同步流程 MUST NOT 全量加载会话消息，服务端接口 MUST NOT 返回完整 timeline。

#### Scenario: 首次进入只加载最新页
- **WHEN** 用户首次进入或刷新会话聊天页
- **THEN** 系统 MUST 只读取不含 turns 的会话元数据和最新一页消息
- **AND** 消息页 MUST 使用 `thread/items/list` 的 thread-wide cursor
- **AND** 单次消息响应大小 MUST 不随会话历史总长度线性增长

#### Scenario: 顶部加载更早消息
- **WHEN** 用户向上滚动接近 timeline 顶部
- **THEN** 系统 MUST 使用当前历史 cursor 请求一页更早消息
- **AND** 加载期间 MUST 在 timeline 顶部显示细 spinner
- **AND** 系统 MUST NOT 为获取更早消息重新读取完整 thread detail

#### Scenario: 到达起点
- **WHEN** 后端返回的下一个 cursor 为空
- **THEN** timeline 顶部 MUST 显示灰色细线 + 文案「会话开始」
- **AND** 系统 MUST 停止继续请求更早页

#### Scenario: 分页协议失败
- **WHEN** 消息分页请求返回协议错误或服务端错误
- **THEN** 页面 MUST 只展示该页的局部错误和重试路径
- **AND** 系统 MUST NOT 回退到包含完整 timeline 的读取方式

#### Scenario: 服务端强制分页边界
- **WHEN** 客户端省略 limit、请求超大 limit 或尝试请求全部消息
- **THEN** 服务端 MUST 使用受控默认值或上限返回有限消息页
- **AND** 响应 MUST 同时受条目数量和序列化字节预算限制

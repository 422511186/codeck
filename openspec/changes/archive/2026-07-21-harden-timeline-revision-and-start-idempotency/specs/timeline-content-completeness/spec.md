## ADDED Requirements

### Requirement: App-server full-content chunks use one source revision
app-server item 的 `contentRef` SHALL 绑定可验证的正文 revision。服务端 MUST 在返回首次 chunk、相同 cursor 重试和每个 continuation chunk 前确认当前解析正文仍属于该 revision；一旦正文 revision 改变，MUST 返回 scoped `repair-required/source-revision`，MUST NOT 返回新 revision 的正文 bytes。完整 item/page source 的 revision MUST 从创建 `contentRef` 时锁定；无法在注册时取得完整正文的 source MUST 最迟在第一次成功读取时锁定，并对所有后续读取保持不变。

#### Scenario: Item changes between chunks
- **WHEN** 用户读取 app-server item 的第一段 full-content 后，同 generation 的 item 正文在下一段请求前改变
- **THEN** continuation 请求 MUST 返回 `repair-required` 且 reason 为 `source-revision`
- **AND** MUST NOT 返回改变后正文在旧 byte offset 处的 chunk

#### Scenario: Item changes before first read
- **WHEN** snapshot/page 或完整 item event 已创建绑定正文 revision 的 `contentRef`
- **AND** item 在第一次 full-content 请求前发生变化
- **THEN** 第一次读取 MUST 返回 `repair-required/source-revision`
- **AND** MUST NOT 把新正文作为旧 reference 的完整内容

#### Scenario: Same cursor retry remains idempotent
- **WHEN** source revision 未改变且客户端用相同 `contentRef` 和 cursor 重试
- **THEN** 服务端 MUST 返回相同 byte range、正文和 next cursor

### Requirement: Full-content reference caches are bounded
服务端 SHALL 对 session 与 app-server full-content source 使用同一过期清理和数量上限，并 SHALL 对 cursor 与位置反向索引设置硬上限。淘汰 source 时 MUST 同步移除所有关联 cursor 和反向索引；淘汰后的 `contentRef` 或 cursor MUST 返回 scoped `repair-required/invalid-content-ref`，MUST NOT 回退到无界缓存或未绑定 revision 的读取。

#### Scenario: App-server source registration reaches the cap
- **WHEN** 持续的截断 app-server items 注册的 source 超过保留上限
- **THEN** 服务端 MUST 淘汰最旧或已过期 source，并保持 source 数量不超过上限
- **AND** 被淘汰 source 的所有 cursor 和位置反向索引 MUST 同步删除

#### Scenario: Cursor registration reaches the cap
- **WHEN** full-content continuation 创建的 cursor 超过硬上限
- **THEN** 服务端 MUST 淘汰最旧 cursor 并同步删除其位置反向索引
- **AND** 后续相同有效位置 MAY 创建新 cursor，但缓存总量 MUST 保持有界

#### Scenario: Read races with source eviction
- **WHEN** full-content 读取已开始等待 app-server source
- **AND** 并发 source 注册淘汰了该 `contentRef`
- **THEN** 原读取 MUST 返回 `repair-required/invalid-content-ref`
- **AND** MUST NOT 为已淘汰 source 创建新的 cursor

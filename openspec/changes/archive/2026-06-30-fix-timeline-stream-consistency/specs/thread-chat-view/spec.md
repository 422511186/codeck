## MODIFIED Requirements

### Requirement: 离开后回到同一会话使用内存缓存
应用 SHALL 在用户离开某个会话切到其他页时，在内存中保留该会话已加载的 timeline；重新进入时 SHALL 直接渲染缓存内容，并在后台连接 timeline event stream。系统 MUST NOT 为了首屏显示缓存而先重新拉取 turns 列表；当事件流断线、补发失败或检测到事件缺口时，系统 SHALL 在缓存已显示后执行必要 snapshot repair。

#### Scenario: 缓存命中
- **WHEN** 用户先后进入会话 A、列表页、再次进入会话 A
- **THEN** 第二次进入 A 时 MUST 立刻渲染上一次的 timeline 缓存
- **AND** MUST 不为了首屏显示重新拉取 turns 列表
- **AND** MUST 在后台连接 timeline event stream

#### Scenario: 缓存不持久化
- **WHEN** 浏览器页面被刷新或关闭
- **THEN** 内存缓存 MUST 丢失
- **AND** 下次进入 MUST 重新拉取最新 turns

#### Scenario: 缓存显示后的修复读取
- **WHEN** 缓存 timeline 已显示
- **AND** 事件流断线、重连补发失败或检测到事件缺口
- **THEN** 页面 MUST 执行一次 snapshot repair
- **AND** repair 结果 MUST replace 或按 revision 合并当前 timeline
- **AND** MUST NOT 保留 repair 结果中已经不存在的旧尾部 entries

## ADDED Requirements

### Requirement: Running chat view uses event stream instead of full-timeline polling
会话聊天页 SHALL 在首屏 snapshot 后使用 timeline event stream 更新 running thread。页面 MUST NOT 在事件流正常时以固定短间隔轮询 `/api/codex/threads/:threadId` 获取完整 timeline。

#### Scenario: Initial snapshot then event stream
- **WHEN** 用户进入会话聊天页
- **THEN** 页面 MAY 调用一次 `readThread` 获取初始 timeline
- **AND** running 状态下后续新增输出 MUST 通过 timeline event stream 更新

#### Scenario: No two-second full timeline polling
- **WHEN** thread 处于 running 状态且事件流连接正常
- **THEN** 页面 MUST NOT 每 2 秒或其他固定短周期调用 `/api/codex/threads/:threadId` 拉取完整 thread detail
- **AND** timeline 增量 MUST 由事件流驱动

#### Scenario: Repair read only after stream gap
- **WHEN** 事件流断线、重连补发失败或检测到事件缺口
- **THEN** 页面 MAY 调用 `readThread` 执行一次 snapshot repair
- **AND** repair 完成后 MUST 回到事件流主路径

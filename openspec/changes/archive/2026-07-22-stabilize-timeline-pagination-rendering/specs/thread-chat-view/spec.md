## MODIFIED Requirements

### Requirement: 分页 timeline 顺序跨页面稳定
历史分页和首屏窗口返回的 turns SHALL 在前端合并后保持全局时间顺序和稳定 turn 身份。每个页面和 opaque cursor MUST 绑定同一 `HistoryStamp`；分页适配层 MUST NOT 使用仅在单页内有效的 `turnIndex` 或 `sourceOrder.ordinal` 破坏跨页排序、rewind 或 fork 计算。旧 generation 的 page、cursor 或请求完成回调 MUST NOT 修改当前窗口。分页候选与当前窗口 identity 重叠时，历史页 MUST 只去重，MUST NOT 用历史候选改写当前可见 entry。

#### Scenario: 多页历史合并
- **WHEN** 首屏已加载最近 turns
- **AND** 用户使用当前 `HistoryStamp` 的 cursor 继续向上加载更早一页 turns
- **THEN** 合并后的 timeline MUST 按真实会话顺序排列
- **AND** 每个 entry 的 `turnId` MUST 保持可用于 rewind/fork 计算

#### Scenario: 页面内 turnIndex 重复
- **WHEN** 不同分页返回的 entries 存在重复或页内重置的 `turnIndex`
- **THEN** 前端 MUST 使用服务端页内正序、稳定 identity 和现有窗口相对顺序合并
- **AND** MUST NOT 因 `turnIndex` 或 page-local ordinal 重复把新旧 turns 排错

#### Scenario: Rollback invalidates an in-flight older page
- **WHEN** generation G1 的历史页请求仍在进行
- **AND** rollback 或 fork rollback 使 thread 进入 generation G2 并建立新的 latest-window 基线
- **THEN** G1 page MUST 被丢弃，不得 prepend 到 G2 timeline
- **AND** G1 的 `nextCursor` MUST NOT 覆盖 G2 cursor

#### Scenario: Cursor belongs to exactly one generation
- **WHEN** 页面持有 generation G1 的 opaque history cursor
- **AND** 当前 `HistoryStamp` 已变为 G2
- **THEN** 页面 MUST NOT 使用 G1 cursor 请求或合并 G2 history
- **AND** 页面 MUST 从 G2 权威 latest page 提供的 cursor 继续分页，或在 cursor 为空时停止

#### Scenario: Prepend keeps the visible message anchored
- **WHEN** 用户上滚触发历史分页，或活动折叠后内容不足一屏而自动补页
- **AND** 更早 entries 被 prepend 到当前 timeline
- **THEN** 补页前首个可见 entry MUST 在补页后保持相同屏幕位置
- **AND** 页面 MUST NOT 因新增内容高度产生可见跳动

#### Scenario: Overlapping history cannot rewrite visible content
- **WHEN** 历史页与当前窗口包含同一强 identity 的 entry
- **AND** 历史页候选正文比当前可见正文更长、更新或完整度不同
- **THEN** pagination merge MUST 只去重该重叠项，不得改写当前窗口中的正文、详情展开状态或显示高度
- **AND** 正文完整性提升 MUST 仅由 live、detail 或权威 repair 路径提交

#### Scenario: Page boundary keeps existing relative order
- **WHEN** 历史页末尾与当前窗口开头属于同一 turn 或同一 activity group
- **THEN** 当前窗口已有 entries 的相对顺序 MUST 保持不变
- **AND** 新历史 entries MUST 只插入到其权威前置位置

### Requirement: Prepending history preserves visible reading progress
加载上一页后，加载前顶部可见消息 SHALL 保持相同 identity 和 viewport 像素偏移。新加载消息 MUST 只出现在当前内容上方，由用户继续上滑查看。一次 prepend MUST 只有一个滚动锚点所有者；虚拟 Timeline 已接管锚点时，页面层 MUST NOT 再次恢复 DOM anchor。可见窗口索引 MUST 在浏览器绘制前完成修正。

#### Scenario: User loads an older page at the top
- **WHEN** 用户滚动到顶部触发历史分页
- **AND** 新页面 prepend 到现有 timeline
- **THEN** 加载前顶部消息 MUST 保持在相同屏幕位置
- **AND** 页面 MUST NOT 自动替用户上移一页内容

#### Scenario: Prepended content changes height after commit
- **WHEN** prepend 的 Markdown、activity 或图片在初次 commit 后继续改变高度
- **THEN** Timeline SHALL 按原消息 identity 持续恢复锚点
- **AND** 可见文字 MUST NOT 因延迟测量发生跳页或抖动

#### Scenario: Virtual timeline owns the anchor
- **WHEN** 长 timeline 已启用虚拟 block/layout 锚点
- **AND** 页面加载并 prepend 更早历史
- **THEN** 只有 Timeline MUST 写入锚点恢复后的 `scrollTop`
- **AND** 页面 requestAnimationFrame MUST NOT 再执行第二次 DOM anchor 校正

#### Scenario: Window changes before paint
- **WHEN** prepend 使虚拟 blocks 的索引整体后移
- **THEN** 可见 window range MUST 在浏览器绘制前同步移动到原 blocks
- **AND** 用户 MUST NOT 短暂看到另一批历史消息后再恢复

### Requirement: Notices do not affect message ordering
会话 notice MUST 不参与 timeline 排序、虚拟列表索引、底部自动滚动或新消息位置计算。已知 app-server 模型、metadata 和长线程 warning SHALL 在 snapshot、pagination、live item、turn error 和直接 store timeline ingress 中统一迁移为 notice，MUST NOT 渲染为 `ErrorCard`。同类模型恢复 warning MUST 由最新状态覆盖旧状态。

#### Scenario: Warning arrives after refresh
- **WHEN** 页面刷新后异步收到历史 warning，随后用户发送新消息
- **THEN** warning 固定显示在会话头部区域，新消息仍按正常时间线追加并位于消息列表末端

#### Scenario: Notice is dismissed
- **WHEN** 用户关闭头部 notice
- **THEN** 仅 notice 区域更新，现有消息滚动位置和 timeline 顺序保持不变

#### Scenario: Warning appears in an older page
- **WHEN** 用户加载的历史分页包含已知模型 warning error item
- **THEN** store MUST 在 pagination commit 中把它迁移为 thread notice
- **AND** timeline MUST NOT 增加红色“操作失败”row 或改变滚动锚点

#### Scenario: Warning arrives as a live item
- **WHEN** `item.appended`、`item.updated` 或 completed item 携带已知 warning error entry
- **THEN** store MUST 迁移该 entry 并保持真实 turn 状态不变
- **AND** MUST NOT 把 warning 当作最终 turn failure

#### Scenario: Latest model resume warning supersedes stale direction
- **WHEN** 会话先收到模型 A 恢复为 B 的 warning，随后又收到模型 B 恢复为 A 的 warning
- **THEN** notice 区域 MUST 只保留最新恢复方向
- **AND** MUST NOT 同时展示互相矛盾的历史恢复提示

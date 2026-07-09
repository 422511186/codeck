# timeline-message-actions Specification

## Purpose
TBD - created by archiving change message-level-rewind-fork. Update Purpose after archive.
## Requirements
### Requirement: 用户消息长按菜单
timeline SHALL 在用户自己的 user message 上提供长按操作菜单，作为复制、回滚到这里和从这里 Fork 的唯一入口。

#### Scenario: 打开用户消息菜单
- **WHEN** thread 静止且用户长按一条 user message
- **THEN** 系统 MUST 显示消息级操作菜单
- **AND** 菜单 MUST 包含「复制」「回滚到这里」「从这里 Fork」「取消」

#### Scenario: 非用户消息无菜单
- **WHEN** 用户长按 agent message、reasoning、tool、diff、system 或 error 条目
- **THEN** 系统 MUST NOT 显示回滚或 Fork 操作

#### Scenario: 运行中禁用历史操作
- **WHEN** thread 处于运行态
- **AND** 用户长按 user message
- **THEN** 系统 MUST NOT 允许触发「回滚到这里」或「从这里 Fork」
- **AND** 系统 MAY 继续提供「复制」操作

### Requirement: 复制用户消息
用户消息菜单中的「复制」SHALL 将该 user message 的文本复制到系统剪贴板，不改变会话历史或输入框草稿。

#### Scenario: 复制文本
- **WHEN** 用户在消息级菜单点击「复制」
- **THEN** 系统 MUST 将该 user message 的文本写入剪贴板
- **AND** MUST 关闭消息级菜单
- **AND** MUST NOT 调用 rollback、fork 或 turn/start 接口

### Requirement: 回滚到这里
用户消息菜单中的「回滚到这里」SHALL 将当前 thread 的历史回滚到目标 user message 所属 turn 之前，并将该 user message 文本回填到输入框供用户编辑后重新发送。

#### Scenario: 回滚历史用户消息
- **WHEN** thread 静止
- **AND** 用户在某条 user message 的消息级菜单点击「回滚到这里」
- **THEN** 前端 MUST 根据该 user message 所属 turn 计算需要删除的尾部 turns 数
- **AND** MUST 调用 `POST /api/codex/threads/:threadId/rollback`
- **AND** rollback 成功后 MUST 使用返回的 thread detail 替换本地 timeline
- **AND** MUST 将该 user message 的文本回填到底部输入框
- **AND** 用户 MUST 能在发送前修改文本

#### Scenario: 回滚不自动发送
- **WHEN** 用户点击「回滚到这里」且 rollback 成功
- **THEN** 系统 MUST NOT 自动调用 `POST /api/codex/turns/start`
- **AND** MUST 等待用户再次点击发送按钮

#### Scenario: 无法定位所属 turn
- **WHEN** 用户点击「回滚到这里」
- **AND** 前端无法可靠定位该 user message 所属 turn 或无法计算尾部 turns 数
- **THEN** 系统 MUST NOT 调用 rollback
- **AND** MUST 保持当前 timeline 和输入框内容不变
- **AND** MUST 向用户呈现操作不可用或需要重新加载的反馈

### Requirement: 从这里 Fork
用户消息菜单中的「从这里 Fork」SHALL 保留当前 thread 不变，创建一个新 thread，并在新 thread 中回滚到目标 user message 所属 turn 之前，再跳转到新 thread 继续编辑发送。

#### Scenario: Fork 历史用户消息
- **WHEN** thread 静止
- **AND** 用户在某条 user message 的消息级菜单点击「从这里 Fork」
- **THEN** 前端 MUST 调用 `POST /api/codex/threads/:threadId/fork`
- **AND** MUST 在 fork 出的新 thread 上回滚目标 user message 所属 turn 及其之后的 turns
- **AND** MUST 保持原 thread timeline 不变
- **AND** MUST 跳转到新 thread 的聊天页
- **AND** MUST 将目标 user message 的文本回填到新 thread 的输入框

#### Scenario: Fork 后不自动发送
- **WHEN** 「从这里 Fork」成功并跳转到新 thread
- **THEN** 系统 MUST NOT 自动调用 `POST /api/codex/turns/start`
- **AND** 用户 MUST 能在新 thread 中编辑回填文本后再发送

#### Scenario: Fork 回滚失败
- **WHEN** fork 已创建但新 thread rollback 失败
- **THEN** 系统 MUST NOT 静默跳转到错误历史状态
- **AND** MUST 向用户呈现失败反馈
- **AND** MUST 保持原 thread 可继续使用

### Requirement: 消息级操作只回滚对话历史
消息级「回滚到这里」和「从这里 Fork」SHALL 只改变 thread history，不还原 agent 已经写入本地工作区的文件变更。

#### Scenario: 文件变更不回滚
- **WHEN** 用户触发「回滚到这里」或「从这里 Fork」
- **THEN** 系统 MUST NOT 承诺或暗示本地工作区文件变更会自动还原
- **AND** 若界面展示确认或说明文案，MUST 明确该操作只回滚对话历史

### Requirement: Message actions require reliable live turn metadata
消息级「回滚到这里」和「从这里 Fork」SHALL 只在前端能可靠定位目标 user message 所属 turn，并能可靠计算目标 turn 到当前尾部 turns 数时启用。实时事件、overlay 和 snapshot 混合后的 timeline entries MUST 保留 `turnId`，否则不得执行 rollback/fork。

#### Scenario: Newly streamed turn remains rewind-addressable after completion
- **WHEN** 用户发送消息并通过 timeline event stream 收到该 turn 的 user、agent、reasoning 或 tool entries
- **AND** turn 完成后 thread 静止
- **THEN** 该 turn 的 user message entry MUST 保留 `turnId`
- **AND** 用户无需刷新页面即可对该 user message 执行「回滚到这里」或「从这里 Fork」

#### Scenario: Missing turn metadata blocks action
- **WHEN** 用户长按某条 user message 并选择 rewind/fork
- **AND** 前端无法可靠获得该 user message 的 `turnId` 或无法确认已知尾部范围
- **THEN** 系统 MUST NOT 调用 rollback 或 fork
- **AND** MUST 提示用户重新加载或稍后重试

### Requirement: Rewind and fork discard old local tail state
消息级 rewind/fork 成功后，前端 SHALL 以服务端返回的 thread detail 作为唯一 timeline 来源。旧本地 entries、旧 overlay、旧 event stream delta 和 rollback 前的本地切片 MUST NOT 被重新写入回滚后的 thread timeline。

#### Scenario: Rewind replace ignores local fallback
- **WHEN** 「回滚到这里」调用 rollback 成功
- **THEN** 前端 MUST 用 rollback 返回的 thread detail replace 当前 timeline
- **AND** MUST 仅把目标 user message 文本写入 draft
- **AND** MUST NOT 把 rollback 前的本地 entriesBeforeTarget 作为 timeline fallback

#### Scenario: Fork rollback initializes new thread from server result
- **WHEN** 「从这里 Fork」先 fork 后 rollback 成功
- **THEN** 新 thread 的初始 timeline MUST 来自 rollback 后服务端 thread detail
- **AND** 原 thread timeline MUST 保持不变
- **AND** 新 thread MUST 不包含被回滚删除的旧 tail entries

#### Scenario: Deleted tail does not reappear after resend
- **WHEN** 用户 rewind 成功并修改 draft 后再次发送
- **THEN** 新 turn 的 event stream MUST 只显示新历史上的输出
- **AND** 被 rewind 删除的旧 user/agent/reasoning/tool entries MUST NOT 通过 late event 或 overlay 再次显示

### Requirement: Freshly sent user message is rewind-addressable
用户发送消息后，前端 SHALL 在 `turn/start` 成功返回时把返回的 `turnId` 绑定到对应 optimistic user message。该 user message 在无需刷新页面的情况下 MUST 可参与消息级 rewind/fork 的 turn 计数。

#### Scenario: Rewind immediately after send completes
- **WHEN** 用户发送消息
- **AND** `turn/start` 返回 `turnId`
- **AND** thread 之后进入静止态
- **THEN** 刚发送的 user message entry MUST 保留该 `turnId`
- **AND** 用户 MUST 能直接对该消息执行「回滚到这里」

#### Scenario: Server user item confirms local message in place
- **WHEN** 本地 optimistic user message 已绑定 `turnId`
- **AND** 后续收到同一 turn 的 server user item
- **THEN** 前端 MUST 原位替换本地 entry 的 id 和 metadata
- **AND** MUST NOT 删除本地 entry 后把 server user item 追加到 agent 输出之后

### Requirement: Rewind updates visible input draft immediately
消息级 rewind 成功后，系统 SHALL 同步更新当前 `ChatInput` 的可见文本状态和持久化草稿。只写 localStorage 但不更新当前输入框 SHALL NOT be sufficient。

#### Scenario: Rewind fills current input
- **WHEN** 用户点击「回滚到这里」且 rollback 成功
- **THEN** 底部输入框 MUST 立即显示目标 user message 文本
- **AND** 用户 MUST 能在不刷新页面的情况下编辑并重新发送

### Requirement: Message actions are disabled without reliable turn metadata
消息级 rewind/fork 菜单 SHALL 仅在目标 user message 有可靠 `turnId` 且当前已知 timeline 能计算尾部 turns 时启用历史操作。缺少元数据时，UI MUST 不呈现可执行的 rollback/fork 入口，或必须将入口置为不可用并给出反馈。

#### Scenario: Local message has no turn id yet
- **WHEN** user message 仍是未绑定 `turnId` 的 optimistic entry
- **THEN** 「回滚到这里」和「从这里 Fork」MUST 不可执行
- **AND** 系统 MUST NOT 调用 rollback 或 fork API

### Requirement: Fork rollback uses fork-local history metadata
消息级 fork SHALL 在 fork 后以新 thread 的服务端历史为准计算和标记 rollback 屏障。系统 MUST NOT 假设新 thread 的 turnId 与原 thread 完全相同，除非 app-server 明确保证。

#### Scenario: Forked thread has different turn ids
- **WHEN** 原 thread fork 后新 thread 的 turnId 与原 thread 不同
- **AND** 客户端需要在新 thread 上 rollback 到目标消息之前
- **THEN** 客户端 MUST 使用 fork 返回或新 thread read/resume 结果定位等价目标 turn
- **AND** MUST NOT 用原 thread 的 turnId 作为新 thread 的唯一删除屏障

### Requirement: Same-text user turns remain distinct
消息级 rewind/fork 所依赖的 user message 身份 SHALL 以 `clientUserMessageId`、`turnId`、server item id 或等价稳定身份为准。系统 MUST NOT 仅因两个 user message 文本和图片相同，就在不同 turn 之间合并、去重或替换其中任意一条。

#### Scenario: User sends identical prompts in consecutive turns
- **WHEN** 用户连续两轮发送相同文本
- **AND** 每轮 `turn/start` 都返回不同 `turnId`
- **THEN** timeline MUST 同时保留两条 user message
- **AND** 每条 user message MUST 绑定各自的 `turnId`
- **AND** rewind/fork MUST 能定位用户实际选择的那一条

### Requirement: Server confirmation does not cross turn boundaries
server user item 确认 optimistic local user message 时，客户端 SHALL 优先按 `clientUserMessageId`、`turnId`、server item id 或等价稳定身份原位替换。已绑定 `turnId` 的 local user message MAY 被同 turn 的 server user item 确认，即使 server item 暂缺 `skillReferences`、图片附件或 `clientUserMessageId`；此时合并结果 MUST 保留本地已知的 Skill/图片附件展示。纯文本 fallback MUST 仅用于未绑定 turn、仍处于 sending 且候选唯一的本地消息；MUST NOT 匹配已经绑定其他 turn 的 sent local message。

#### Scenario: Confirmation for repeated text arrives late
- **WHEN** timeline 中存在两条相同文本的 local user message
- **AND** 它们已经绑定不同 `turnId`
- **AND** 服务端只确认其中一个 turn 的 user item
- **THEN** 客户端 MUST 只替换同 `turnId` 或同 `clientUserMessageId` 的 local entry
- **AND** MUST NOT 删除或覆盖另一条相同文本 user message

#### Scenario: Confirmation preserves local Skill and image attachments
- **WHEN** 本地 optimistic user message 包含图片和 Skill 引用
- **AND** `turn/start` 已经把该 local message 绑定到 `turnId`
- **AND** 同一 turn 的 server user item 到达时缺少 `skillReferences`、图片附件或 `clientUserMessageId`
- **THEN** 客户端 MUST 用该 server user item 原位确认本地 user message
- **AND** 合并后的 user message MUST 继续展示本地已知的 Skill 引用和图片附件
- **AND** timeline MUST NOT 同时显示 local user message 和 server user message 两条用户消息

#### Scenario: Non-adjacent confirmed duplicate is merged
- **WHEN** 本地 optimistic user message 和同 turn server user item 之间夹有 reasoning、tool、command、diff 或 runtime activity entries
- **THEN** 客户端 MUST 仍将两条 user entries 识别为同一用户发送
- **AND** timeline MUST 只保留一条该 turn 的 user message
- **AND** 被夹在中间的 activity entries MUST 保持可见并保留 turn metadata

### Requirement: Fork rollback fails closed when fork-local target is unavailable
消息级 fork SHALL 在 fork 后基于新 thread 的服务端历史定位等价目标 turn。若无法可靠定位 fork-local 目标，系统 MUST NOT 使用原 thread 的 `numTurns` 猜测 rollback 范围。

#### Scenario: Fork target cannot be resolved
- **WHEN** fork API 返回的新 thread timeline 无法匹配原目标 user message
- **THEN** 客户端 MUST NOT 调用 rollback API 删除 forked thread 的 turns
- **AND** MUST 向用户提示无法定位目标消息，请刷新或稍后重试

### Requirement: Message action rollback barriers use reliable tail turns
消息级 rewind/fork 传给 rollback 的 deleted-turn hint SHALL 来自当前可验证的尾部 turn 范围。系统 MUST NOT 允许不属于实际 rollback 删除范围的 turn id 成为当前 thread 的 deleted barrier。

#### Scenario: Client hint contains unrelated turn
- **WHEN** rewind 或 fork rollback 请求携带 `expectedDeletedTurnIds`
- **AND** 其中某个 turn id 不在本次 rollback 删除的尾部范围内
- **THEN** 服务端 MUST 忽略该 id 或拒绝请求
- **AND** 后续该 turn 的合法 timeline event MUST 仍能显示

#### Scenario: Tail live turn is included in rollback hint
- **WHEN** user message action 删除了包含 live overlay 的尾部 turn
- **AND** 客户端提供该 turn id 作为 `expectedDeletedTurnIds`
- **THEN** 服务端 MUST 使用该 id 清理 overlay 和 late-event barrier
- **AND** 被删除尾部 MUST NOT 在 resend 后重新出现在 timeline

### Requirement: Failed message actions preserve repair opportunities
消息级 rewind/fork 在本地或 fork-local 目标解析失败时 SHALL 失败关闭，并且 MUST NOT 破坏正在进行的权威 snapshot 或 repair 机会。错误提示可以追加到 timeline，但不得使用户必须刷新页面才能拿回本来即将到达的 turn metadata。

#### Scenario: Local failure while snapshot is pending
- **WHEN** 初始 `readThread` 或 snapshot repair 正在进行
- **AND** 用户触发的 rewind/fork 在本地解析阶段失败
- **THEN** 系统 MUST 显示失败提示
- **AND** 正在进行的 snapshot/repair MUST 仍可在返回后用于补齐 turn metadata

### Requirement: Rewind resend does not duplicate new turn output
用户 rewind 后重新发送新消息时，新 turn 的输出 SHALL 按当前历史合并显示。旧 turn 的 late event MUST 被屏蔽；新 turn 中来自 live stream、completion 和 refresh snapshot 的同一输出 MUST NOT 重复显示。

#### Scenario: Rewind then resend same prompt
- **WHEN** 用户 rewind 到某条消息后重新发送一个新消息
- **AND** 新 turn 产生 reasoning、tool output 和 agent message
- **THEN** 每个等价输出 MUST 只显示一次
- **AND** 刷新页面后 timeline MUST 仍保持不重复

### Requirement: 消息操作必须使用 engine 派生的稳定 turn 身份
消息级 rewind/fork SHALL 使用 timeline engine 归一化后的稳定身份和 turn metadata 作为唯一计算来源。系统 MUST NOT 直接从渲染文本、数组位置、createdAt 排序或未归一化 snapshot/live 混合条目推断目标 turn。

#### Scenario: Optimistic 用户消息被服务端确认
- **WHEN** 本地 optimistic user message 通过 `turn/start` 和 server user item 被确认
- **THEN** timeline engine MUST 将确认结果合并为一条带稳定 turn 身份的 user entry
- **AND** 消息操作 MUST 使用该 engine entry 计算 rewind/fork 目标

#### Scenario: 渲染层存在重复候选
- **WHEN** 旧代码路径或 repair 暂时产生两个文本相同的 user entry 候选
- **THEN** 消息操作 MUST 只接受 engine 标记为当前有效的 normalized entry
- **AND** MUST NOT 基于用户看到的第一个相同文本猜测 rollback 范围

### Requirement: 尾部 turn 计算必须基于有序且去重的 turns
消息级 rewind/fork 计算需要删除的尾部 turns 时，SHALL 使用 timeline engine 输出的 ordered distinct turns。系统 MUST 去除重复 user/agent/activity entry 对 turn 计数的影响，并 MUST 保留同一 turn 内多个 user/steer item 的真实位置。

#### Scenario: 同一 turn 内存在多个 user item
- **WHEN** 一个 turn 内包含原始 user prompt 和后续 steer user item
- **THEN** rewind/fork MUST 将二者识别为同一个 turn 内不同 item
- **AND** MUST NOT 把后续 steer 当成新的独立 turn 计算尾部数量

#### Scenario: 重复 agent 输出不影响尾部计数
- **WHEN** 同一 turn 的 agent output 因 live/snapshot 重复候选出现多条 raw entry
- **THEN** ordered distinct turns MUST 仍只包含该 turn 一次
- **AND** rewind/fork 删除范围 MUST 不因重复输出而扩大或缩小

#### Scenario: 分页窗口只包含部分历史
- **WHEN** 当前已知 timeline window 不能证明目标 turn 到尾部 turns 的完整范围
- **THEN** rewind/fork MUST 禁用或先触发有界 metadata repair
- **AND** MUST NOT 用不完整窗口猜测 `numTurns`

### Requirement: 同 turn 多 user/steer item 不得被重排或合并
timeline SHALL 保留同一 turn 内多个 user、steer 或 control item 的真实 item 顺序。消息操作必须能区分用户选择的是同 turn 内哪一个 user-visible item，但 rollback/fork 的删除屏障仍以该 item 所属 turn 和合法尾部范围为准。

#### Scenario: 用户选择同 turn 后续 steer
- **WHEN** 同一 turn 内存在 initial user prompt 和后续 steer item
- **AND** 用户长按后续 steer item
- **THEN** 系统 MUST 将菜单目标绑定到该 steer entry 的稳定 item 身份
- **AND** rollback/fork 的 turn 范围 MUST 使用该 entry 所属 turn
- **AND** timeline MUST NOT 因 user phase 排序把 steer item 移到 initial prompt 之前

#### Scenario: 相同文本 user item 不合并
- **WHEN** 同一 turn 或相邻 turns 中存在文本相同的 user-visible item
- **THEN** timeline engine MUST 按稳定 item/turn 身份保留可区分条目
- **AND** 消息操作 MUST 定位用户实际长按的条目

### Requirement: 身份缺失或歧义时消息操作必须失败关闭
当 timeline entry 缺少可靠 turnId、generation、item identity 或当前尾部范围时，消息级 rewind/fork SHALL 失败关闭。系统 MUST 禁用历史操作或显示不可用反馈，MUST NOT 为了保持按钮可用而回退到文本相似、createdAt 或数组下标猜测。

#### Scenario: Ownerless user event
- **WHEN** 某条 user-visible entry 缺少可靠 threadId 或 turnId
- **THEN** 消息级菜单 MUST 不提供可执行的 rewind/fork
- **AND** 系统 MAY 提示需要等待同步或重新加载

#### Scenario: 身份冲突
- **WHEN** 两条 normalized entry 声称拥有相同 turn/item 身份但内容或 generation 冲突
- **THEN** timeline engine MUST 标记诊断或触发 bounded repair
- **AND** 在冲突解决前 rewind/fork MUST 不可执行


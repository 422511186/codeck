## Context

当前移动 Web 会话页存在两类时间线操作：

- 底部输入区的「重发上一条」：只支持最新 user message，调用 rollback 1 个 turn 后把文本填回输入框。
- 头部 `⋮` 抽屉的「Fork 会话」：只支持从当前会话最新状态创建分支。

这两个入口都无法表达“从某条历史用户消息重新开始”。同时当前前端 timeline 是扁平 `TimelineItem[]`，没有把 item 所属 `turnId` 暴露给 UI，因此即使入口移动到用户消息长按菜单，前端也无法可靠知道需要回滚几个 turn。

底层 app-server 已有 `thread/fork` 和 `thread/rollback { numTurns }`。其中 rollback 只修改 thread history，不撤销 agent 已经写入工作区的文件。因此本次设计优先复用既有协议，在 Web 适配层补齐消息到 turn 的定位能力。

## Goals / Non-Goals

**Goals:**

- 移除旧的底部「重发上一条」入口和头部抽屉「Fork 会话」入口。
- 在用户消息长按菜单中提供唯一的消息级入口：「复制」「回滚到这里」「从这里 Fork」「取消」。
- 让前端能从任意已加载用户消息定位其所属 turn，并计算从会话尾部需要删除的 turn 数。
- 「回滚到这里」修改当前会话：删除目标 user message 所属 turn 及其之后的 turns，再把该消息文本回填输入框。
- 「从这里 Fork」保留原会话：先 fork 出新会话，再在新会话上删除目标 user message 所属 turn 及其之后的 turns，跳转后回填该消息文本。
- rollback/fork 后必须用服务端返回的 thread detail replace 本地 timeline，避免旧尾部消息残留。
- 运行中 thread 禁止消息级 rewind/fork。

**Non-Goals:**

- 不实现工作区文件变更回滚。rollback 仍只修改 thread history。
- 不支持对 agent message、tool、diff、reasoning 等非 user message 发起 rewind/fork。
- 不设计桌面端布局，本项目继续只面向移动端 Web。
- 不引入完整分支树 UI；新 fork 仍作为普通 thread 跳转打开。
- 不在本次变更中解决“保留目标消息并从其后继续”的语义；如果未来需要，应作为独立操作命名。

## Decisions

### 1. 消息级菜单作为唯一入口

选择：用户长按自己的 user message 打开操作菜单。菜单包含「复制」「回滚到这里」「从这里 Fork」「取消」。底部输入区不再显示「重发上一条」，头部 `⋮` 抽屉不再显示「Fork 会话」。

理由：rewind/fork 都是基于时间线某个点的操作，把入口绑定到消息本身能让目标明确，避免“到底从哪一轮开始”的歧义。底部和头部入口只能表达最新状态或全局会话操作，不适合历史时间线。

替代方案：保留旧入口并新增消息级入口。该方案会让同一能力有两套语义，用户难以判断“重发上一条”和“回滚到这里”的区别，也会增加测试矩阵。

### 2. 以 user message 所属 turn 为截断点

选择：「回滚到这里」和「从这里 Fork」都删除目标 user message 所属 turn 及其之后的所有 turns，并把目标 user message 文本回填到输入框。

理由：用户长按某条自己的消息时，最常见意图是“改这句话再让 agent 重新回答”。如果保留目标 turn，只删除后续 turns，就无法编辑这条消息本身。当前旧「重发上一条」也是删除最后一轮并回填原文，这次只是把同样语义推广到历史消息。

替代方案：保留目标 turn，只删除其后的 turns。该语义更像“从这里继续”，不适合命名为“回滚到这里”或“重新发送这条消息”。未来如果需要可单独增加「从此处继续」。

### 3. 在 Web 适配层为 timeline item 附加 turn 元数据

选择：扩展移动端 `TimelineItem` / `TimelineEntry`，为从 `thread.turns` 展开的每个 item 附加：

- `turnId`: 所属 turn id。
- `turnIndex`: 该 turn 在当前返回 turns 列表中的顺序。
- `isUserTurnStart` 或等价信息：用于确认 user message 是可回滚目标。

`readThread`、`resumeThread`、`listThreadTurns` 和 rollback/fork 返回转换时都必须保留这些字段。

理由：app-server 的 `thread/rollback` 目前按 `numTurns` 工作，前端只要知道目标 turn 到尾部的距离，就能复用现有协议。相比新增底层 “rollbackToTurnId” 协议，Web 适配层扩展风险更小，且能覆盖历史分页。

替代方案：新增 Web API `rollbackToItem` / `forkFromItem`，由服务端根据 itemId 查找 turn。该方案前端更简单，但需要服务端维护 itemId 到 turn 的索引或全量扫描，并新增更多 API 合约。本次可以作为备选，如果 turns 元数据在分页场景不足以可靠计算时再升级。

### 4. 使用 replace 同步 rollback/fork 后 timeline

选择：任何 rollback 结果都必须用返回的 `ThreadDetail` replace 当前 thread entries，不使用 merge。Fork 后进入新会话时也以 fork/rollback 后的 thread detail 初始化新会话状态。

理由：现有 merge 会保留服务端 snapshot 中不存在的旧 entry，适合流式补全，不适合 rollback 这种删除尾部历史的操作。replace 能保证 UI 与服务端历史一致。

替代方案：在 store 中新增“按 turn 截断”的局部更新。该方案可以减少全量替换，但要求 entry 必须完整带 turnId，且容易和分页缓存、pending live entry 产生边界问题。

### 5. 草稿回填与图片处理

选择：第一阶段只回填 user message 文本。若目标消息有图片，菜单仍可执行，但 UI MUST 明确只回填文本，或在实现中禁用含图片消息的 rewind/fork 并给出不可用提示。

理由：当前输入区图片是本地 File 上传状态，历史消息里的 `imagePaths` 不等同于可重新提交的本地图片。直接复用可能造成引用失效、安全语义不清或后端不接受。为了避免误导，需要先明确降级语义。

替代方案：支持 imagePaths 重新发送。该方案体验更完整，但需要确认 app-server 是否接受历史 image path 作为新 turn 输入，并处理已删除/不可访问图片。

## Risks / Trade-offs

- [Risk] 历史分页只加载了部分 turns，前端无法知道目标 turn 到真实尾部的距离。→ Mitigation：消息级 rewind/fork 仅对已知完整尾部范围内的消息启用；必要时操作前调用 read/resume 获取最新 turns 并重新定位目标 item。
- [Risk] 同一个用户消息文本可能重复，按文本定位会误操作。→ Mitigation：必须按 item id / turn id 定位，不允许按文本匹配。
- [Risk] rollback 不撤销工作区文件变更，用户可能以为回滚了代码。→ Mitigation：菜单或确认文案中明确“只回滚对话历史，不还原工作区文件变更”；需要工作区回滚时另建能力。
- [Risk] fork 后再 rollback 可能短暂显示未截断的新会话。→ Mitigation：Fork 操作在完成 fork+rollback 两步后再跳转，或跳转时显示加载态直到截断后的 thread detail ready。
- [Risk] 长按菜单与移动端文本选择冲突。→ Mitigation：菜单只在用户消息容器长按触发，保留复制按钮；如文本选择体验受影响，后续可改为消息旁更多按钮。
- [Risk] 图片消息重新发送语义不完整。→ Mitigation：第一阶段只支持文本回填，测试覆盖含图片消息的降级行为，后续再设计图片重用。

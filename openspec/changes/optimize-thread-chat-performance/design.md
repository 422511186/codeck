## Context

会话聊天页当前把 `thread/read includeTurns=true` 的完整 timeline 作为刷新入口，并在前端把 snapshot 转成 `TimelineEntry[]` 后执行全量去重、等价输出合并、排序和 snapshot suppression 初始化。运行中输出通过 SSE 逐条进入 Zustand；每个可见 delta 都会同步触发 store 更新，随后 `ThreadPage` 因订阅整个 `threadState` 而整页重渲染，`Timeline` 再全量 map entries。

本项目只做移动端 Web，手机浏览器主线程预算更紧。长会话、短 Markdown 消息很多、命令输出多、diff 多或 agent delta 很密时，会出现刷新首屏慢、滚动卡顿、输入延迟和页面假死。此前已针对“运行中的当前 agent 文本先按纯文本展示”做过局部优化，但它无法解决历史消息全量渲染、全量 snapshot normalize 和高频事件同步提交的问题。

## Goals / Non-Goals

**Goals:**

- 刷新或首次打开长会话时，只加载最近有限 turns，并在手机浏览器上快速显示可交互首屏。
- 在 agent 高频输出时，把 UI 更新频率限制到浏览器可承受范围，同时不破坏 event id、revision、sequence、generation 的幂等语义。
- 让 timeline store 的常见操作从全量扫描转为索引化增量更新，降低 snapshot repair、分页合并和 completion 合并成本。
- 让 timeline 渲染只处理可见窗口附近的内容，历史 Markdown、Mermaid、代码高亮、diff 和工具长输出按需渲染。
- 让 Web 后端到 Codex app-server 的连接生命周期可控，避免多个 Web 后端或异常重启重复拉起 app-server 进程并放大卡死问题。
- 保持现有 rewind、fork、snapshot repair、deleted-turn barrier、duplicate suppression 和 pagination 行为正确。
- 增加性能观测和测试预算，避免后续功能变更重新引入长会话卡死。

**Non-Goals:**

- 不改变 Codex app-server 的会话存储模型，也不要求引入数据库。
- 不做桌面端布局适配。
- 不改变 agent 输出的业务语义，不隐藏用户需要查看的完整输出。
- 不在本变更中重新设计聊天输入、审批 UI、项目列表或设置页。

## Decisions

### 1. 会话首屏使用最近 turns 窗口

普通 `readThread` 路径改为读取 thread metadata 加最近有限 turns，默认窗口建议 30 turns。历史内容继续通过 `thread/turns/list` 向上分页加载。snapshot repair 也应优先修复当前可见尾部窗口，而不是无条件读取完整历史。

选择这个方案的原因是它直接切断刷新白屏的最大输入源：全量 turns payload、全量 normalize 和全量 DOM。备选方案是保留全量读取但优化前端渲染；该方案仍会让 Node 端转换、JSON 传输和浏览器 parse 承担长历史成本，不能解决根因。

### 2. timeline store 引入索引化派生结构

保留对组件暴露的 `entries: TimelineEntry[]` 形态，但内部更新逻辑应使用按 id、turn、等价输出身份的 Map 来定位和合并条目。常见更新路径包括：

- 按 `entry.id` 替换或追加。
- 按 `turnId + body.kind + tool identity` 合并 live/completion/snapshot 等价输出。
- 按 generation 维护 item revision 和 snapshot delta suppression。
- 按 turn order 维护稳定排序。

选择“内部索引 + 外部兼容数组”的原因是能把大多数热点从 O(n²) 降为 O(n) 或 O(1) 定位，同时减少 UI 侧改动范围。备选方案是完全重写 UI 数据结构为 normalized state；收益更大，但会显著扩大实现和回归风险。

### 3. 高频 delta 在进入可见 store 前批处理

SSE 客户端或 store dispatch 层增加 delta batcher。对同一 `threadId + itemId + kind + generation` 的连续文本 delta 在一个 animation frame 或短时间窗口内合并为一次可见 entry 更新。每个原始事件的 `eventId` 仍必须记录，revision、sequence、generation 仍必须逐条参与 stale/suppression 判断。turn lifecycle、timeline-gap、server-request 等非文本可见事件不应被延迟到影响交互语义。

选择前端批处理是因为 app-server 事件语义已经细粒度，前端是 UI 压力发生点。服务端仍应补充 overlay 聚合，但不能只靠服务端节流，因为浏览器重连 replay 和本地 listener buffer 也会产生瞬时事件洪峰。

### 4. 页面按订阅边界拆分

`ThreadPage` 拆成 header、plan bar、timeline viewport、composer、sheet/dialog 等组件，并让每个组件订阅最小 store slice。timeline delta 只应使 timeline viewport 和必要的 running 状态更新，不应重置输入框、重建模型菜单、重算 header callbacks。

选择该方案是因为当前整页订阅 `threadState` 会放大每条 delta 的 React commit 范围。备选方案是只给 `Timeline` 加 `React.memo`；由于父组件仍会重渲染并生成新 callbacks，收益有限。

### 5. timeline 渲染采用动态高度窗口化

优先引入成熟的动态高度虚拟列表库；如果不引入依赖，则实现等价的移动端窗口裁剪：只挂载可见区域和上下 buffer 内的 rows，并维护顶部/底部占位高度。窗口化必须兼容：

- 进入会话默认滚到最新。
- 向上加载更早 turns 后保持阅读位置。
- 用户不在底部时，新 delta 不强制滚动。
- 跳到最新按钮。
- 用户消息长按菜单、图片预览、审批卡片。

动态高度虚拟列表比固定高度裁剪更适合 Markdown、diff、工具卡片和图片。主要代价是滚动锚点和 prepend 历史时的高度测量复杂度。

### 6. 历史 Markdown 和长输出按需渲染

agent 消息最终仍要完整 Markdown 渲染，但历史消息可先显示纯文本占位，进入渲染窗口且浏览器空闲后再执行 Markdown、代码高亮和 Mermaid。工具输出、命令输出、diff 和 reasoning 默认只渲染摘要；展开时才构造长内容 DOM，并对展开区域设置内部滚动和行数/字节上限。

选择分阶段渲染的原因是 Markdown 解析、rehype highlight、Mermaid import/render 和 diff row 构造都是主线程重活，且多数历史内容不在首屏可见。备选方案是 Web Worker 解析 Markdown；对 React element 生成、DOM 和 Mermaid 仍无效，复杂度更高。

### 7. 服务端 overlay 覆盖 agent message

服务端 runtime 的 timeline overlay 当前覆盖 reasoning/tool/file/diff 等 live 内容，但 agent message delta 也应聚合进 overlay。这样刷新或 snapshot repair 能拿到当前 agent 正文尾部，而不是完全依赖 SSE backlog 逐条 replay。

该决策降低长输出期间断线或刷新后触发全量 repair 的概率，也让 bounded snapshot repair 更可靠。

### 8. 性能预算作为测试目标

增加可重复的性能/复杂度测试，不把具体毫秒数绑定到 CI 的不稳定机器上，而是测试数量级和更新次数，例如：

- 1000 条 delta 经过 batcher 后可见 store 更新次数有上限。
- 3000 turns 的 snapshot normalize 不出现近似二次增长。
- 1000 条历史 agent 消息不会同步生成 1000 个 Markdown 渲染树。
- 首屏读取请求不会包含全量 turns。

### 9. app-server 复用优先使用 external，自动模式必须带锁和清理

跨 Web 后端或生产部署复用 app-server 时，应把 `external` 模式作为明确推荐路径：用户单独启动一个 `codex app-server --listen ws://127.0.0.1:<port>`，Web 后端只连接该服务。`spawn` 模式继续用于单个 Web 后端的便捷本地启动，但其语义是“当前 Web 进程拥有子进程”，不应被解释为跨进程复用。

为降低本地开发和重启时的残留进程风险，可以新增 `spawn-or-connect` 或等价自动复用模式：

- 固定 host/port 已配置时，先尝试连接现有 app-server。
- 连接失败后再尝试获取跨进程锁并启动 app-server。
- 拿不到锁时等待持锁进程启动完成并连接，而不是再启动一个。
- lock/pid/endpoint 元数据必须能识别陈旧进程和陈旧锁。
- Web 后端正常退出时应关闭自己启动的子进程；异常退出后的残留必须能被后续启动识别和复用或标记为陈旧。

该设计避免把所有场景都塞进 `spawn`，也避免仅设置固定端口后出现端口竞争。状态接口可暴露模式、状态、是否由当前进程拥有、pid 是否存在、端口是否可连接等诊断字段，但不能向浏览器暴露原始 app-server URL、token 或其它敏感连接信息。

## Risks / Trade-offs

- 分页首屏可能改变 `lastTurnId`、`turnIndex` 和滚动定位语义 → 在适配层保留 thread metadata 的真实 `lastTurnId`，分页 items 使用稳定 turn order，新增分页顺序测试。
- delta 批处理可能破坏 duplicate suppression 或 snapshot suppression → batcher 只合并可见文本提交，原始事件仍逐条执行 eventId、generation、revision、sequence 账本逻辑。
- 虚拟列表可能影响长按菜单、图片预览和滚动锚点 → 先用测试覆盖默认滚到底、prepend 历史保持位置、不在底部时不自动滚动，再替换渲染器。
- 历史 Markdown 延迟渲染可能与“完整 Markdown 展示”预期冲突 → 规范定义为“最终完整渲染”，离屏或首屏期间允许轻量占位，进入窗口后必须完成。
- 截断长输出可能影响排查问题 → 默认 DOM 截断不等于数据丢失；提供展开、复制或查看完整内容路径。
- 引入虚拟列表依赖增加包体和 API 约束 → 评估依赖体积和维护状态；若不合适则实现轻量窗口裁剪。
- 性能测试在 CI 中容易抖动 → 优先测更新次数、渲染节点数量和复杂度趋势，少量毫秒预算仅作为宽松 smoke。
- 自动复用 app-server 引入锁和陈旧状态处理复杂度 → 默认推荐 production/external，自动模式只作为本机开发便利能力，并通过端口竞争、陈旧 pid 和异常退出测试约束行为。
- 复用单个 app-server 会让多个 Web 后端共享同一 app-server 事件源和会话状态 → 需要确保 gateway 初始化、事件订阅和 pending request 处理不会假设“只有当前 Web 后端连接”。

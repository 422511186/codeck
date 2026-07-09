## Context

当前 timeline 已经形成一条相对完整的移动端数据链路：首屏 `thread/read` 只取最近 turns，分页使用 `thread/turns/list`，运行中输出走 SSE，服务端用 overlay 和 rollout JSONL supplement 补齐活动，前端 store 再做去重、repair、rollback 屏障和 UI 渲染裁剪。

探索阶段发现的问题集中在“规格已经写清楚，但实现没有完全对齐”：

- 规格要求每条消息显示相对时间，当前 `Timeline` 未渲染。
- 完成态 repair 的触发应判断是否有任何可见 agent/tool/reasoning/activity 输出，当前前端仍偏向只看 assistant message，导致 tool-only turn 被误判为空。
- rollout supplement 已有文件大小保护，但在允许大小内仍可能先完整解析 JSONL 再过滤窗口 turn，不符合有界窗口的意图。
- 部分派生状态和 inline activity 详情仍存在全量扫描或长文本直接挂载风险。

本变更的约束是移动端优先、保持现有协议和数据模型、采用 TDD 修复，不在同一变更里推进完整 timeline engine 重构。

## Goals / Non-Goals

**Goals:**

- 补齐 timeline 消息相对时间展示，并保持移动端行高、宽度和可读性稳定。
- 让 completion repair 的“无可见输出”判定与规格一致：agent、tool、reasoning、diff、raw response、activity 或 error 任一可见输出存在时，不触发 completion repair。
- 将 rollout supplement 改为按当前窗口 turnId 有界收集，遇到预算限制时降级跳过 supplement，不阻塞主 timeline。
- 降低会话页和 Timeline 常见更新路径中的重复全量扫描，只做低风险局部优化。
- 将展开的 activity 长文本统一走已有有界预览/滚动路径，避免 `<pre>` 直接挂载完整大文本。

**Non-Goals:**

- 不改 app-server 协议字段和 SSE endpoint 语义。
- 不把所有 store action 一次性迁移到统一 timeline engine。
- 不新增数据库、索引服务或长期持久化缓存。
- 不重做聊天页视觉设计或桌面布局。

## Decisions

### 1. 先修规格偏差，暂不重构全入口 engine

本次采用小步修复：保留现有 store 和 `timeline-engine.ts` 边界，仅把明显偏差的判定、渲染和 supplement 解析收紧。备选方案是直接延续 `stabilize-timeline-engine` 的完整统一 reducer 方向，但这会触及大量入口，风险和验证成本明显高于这批缺口本身。

### 2. Completion repair 使用“可见输出”谓词

前端 store/page 层应使用一个明确的可见输出判定，覆盖 agent message、tool output、reasoning、diff、raw response、activity、error 等用户已经能看到的 turn 内容。completion/idle 兜底 repair 只在该 turn 没有这些输出时触发。这样 tool-only、reasoning-only 或 activity-only turn 不会反复请求全量读取。

### 3. 相对时间走纯格式化 helper

Timeline 组件新增或复用纯函数格式化 `createdAt`，始终输出相对时间；无有效时间时隐藏该字段或使用已有 fallback，避免显示绝对时间。测试覆盖近期和久远消息即可，时间推进用固定 fake timer。

### 4. Rollout supplement 在扫描时过滤窗口

`session-timeline.ts` 的 supplement 逻辑应在读取/解析过程中按允许 turnId 过滤和计数，不先构建完整无关事件数组。若文件过大、扫描预算耗尽或 turnId 不在当前窗口内，supplement 可跳过该活动；主 timeline snapshot/page 仍正常返回。

### 5. 性能优化只做能被邻近测试锁住的局部点

优先处理两类低风险点：页面 selector 的 compact completion 状态不在每次 store 更新时全表扫描；Timeline row 派生状态尽量预计算并保持 bounded window。若某项优化需要改变大量组件订阅结构，则保留为后续变更。

### 6. Activity 展开内容复用有界预览组件

inline activity 展开后展示输出、参数、stderr、diff fallback 等长文本时，优先使用现有 `LongTextPreview` 或等价有界组件。完整内容访问通过复制或明确展开更多路径保留，但主 timeline DOM 不挂载完整大文本。

## Risks / Trade-offs

- [Risk] 修正 completion repair 判定可能让某些只有低质量 activity、但缺少最终 agent 文本的 turn 不再自动 repair。→ Mitigation：只有“已有可见输出”才抑制 completion repair；确认 gap、listener buffer overflow 和手动 repair 路径仍可触发 bounded repair。
- [Risk] rollout supplement 有界扫描可能让窗口内部分历史 activity 暂时缺失。→ Mitigation：主 timeline 优先，supplement 可降级；后续可用索引或 offset 改进补全率。
- [Risk] 相对时间会随时间变化，测试容易不稳定。→ Mitigation：使用固定系统时间和纯格式化函数测试。
- [Risk] 性能优化若过度会牵动 store 订阅结构。→ Mitigation：只实现已有测试能验证的局部优化，完整订阅重构另起变更。

## Migration Plan

1. 更新 delta spec 和任务清单，锁定本次增量边界。
2. 先为 completion repair、相对时间、supplement 有界解析和 activity 长文本写失败测试。
3. 逐项实现最小修复，每项绿灯后再进入下一项。
4. 跑 timeline 相关单元测试、类型检查和必要的 OpenSpec 校验。
5. 所有任务完成后保留变更待归档。

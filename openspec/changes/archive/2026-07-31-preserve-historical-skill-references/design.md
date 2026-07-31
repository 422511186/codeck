## Context

当前历史 timeline 有两条补全路径：详情读取和 turns 分页都会从 rollout 中读取受限 session supplement，再把隐藏的 `<skill>` 输入恢复到对应用户消息。现有 supplement 扫描依赖页面 item 的 `turnId` 过滤；当分页用户 item 缺少 `turnId` 时，服务端无法确定需要读取的 turn，直接跳过 supplement。刷新流程随后以分页 items 替换详情窗口，进一步丢弃详情中已经恢复的 Skill、图片或文件 metadata。

约束是保持现有结构化 `skillReferences` 为权威数据，继续限制 rollout 扫描和返回内容，不把隐藏 Skill 正文暴露到 timeline，也不能在相同用户正文重复时把 Skill 错绑到错误消息。

## Goals / Non-Goals

**Goals:**

- 让缺少 `turnId` 的历史用户 item 在有唯一正文锚点时恢复隐藏 Skill 引用。
- 让重复正文、缺少有效 Skill envelope 或无法唯一确定消息的情况 fail closed。
- 刷新时从详情条目补全分页条目的 Skill、图片和文件 metadata，并保持已有更完整值。
- 用回归测试固定服务端恢复、结构化优先级、歧义保护和刷新合并行为。

**Non-Goals:**

- 不修改公开 API 字段，不改变 Skill chip 的渲染样式或交互。
- 不扩大实时事件的 Skill 解析范围，不改变工具活动的 identity 合并策略。
- 不通过无限制读取整个 rollout 或放宽现有 session 扫描预算解决问题。

## Decisions

### 服务端分页 supplement 使用受限的正文回退

分页包含缺少 `turnId` 的用户 item 时，runtime 继续使用已有 turn ID 过滤已绑定 item，同时为本页未绑定用户正文开启受限的 Skill-only fallback。扫描器允许解析未知 turn 的 session records，但最终只把 `skill-reference` records 与页面用户正文做唯一匹配；工具和普通消息不会因为该 fallback 被注入页面。详情中已有 `skillReferences` 的 item 仍然优先，回退只填充空 metadata。

选择该方案是因为它能覆盖真实缺失字段，同时保留已有的权限边界和扫描预算。仅扩大 turn resolver 的历史窗口无法为没有 `turnId` 的 item 建立绑定，也会增加无关历史的扫描量。

### Skill 绑定采用全页唯一正文匹配

回退匹配使用 trim 后的完整用户正文。候选必须在当前 page 中唯一；正文重复、空正文、Skill envelope 不完整或路径不是绝对 `SKILL.md` 时不绑定。匹配完成后按 Skill name/path 去重，并保留 rollout 中的顺序。这样可以恢复缺字段的单条消息，同时避免在相同正文场景中猜测 turn 归属。

### 刷新在 snapshot ingress 前补齐详情 metadata

刷新初始 page 时，页面将详情 timeline 作为 `detailEntries` 一并交给现有 `setThreadEntries` ingress。store 在 snapshot window 提交前按以下优先级寻找详情候选：item `id`，`turnId + role + text`，最后是无 `turnId` 时唯一的 `role + text`。只补充缺失的 Skill、图片和文件 metadata，并保留分页 item 的 identity、正文和顺序。重复正文或冲突候选不会合并。

这使详情与分页仍共用 timeline engine 的幂等和 completeness 规则，不需要页面自行维护另一份合并状态。

### 测试策略

先在 `app-server-session-timeline` 和 store/timeline engine 测试中加入失败用例，再实现最小变更。覆盖唯一无 turn ID 恢复、重复正文 fail-closed、结构化 Skill 优先、刷新详情 metadata 保留，以及图片和文件 metadata 不被分页清空。最后运行相邻测试、类型检查和完整验证命令。

## Risks / Trade-offs

- [回退扫描可能读取比 turn 过滤更多的 rollout 行] → 仅在页面存在无 `turnId` 用户 item 时启用，继续使用既有扫描行数、字节数、时间和 record 上限，且只输出唯一正文匹配的 Skill metadata。
- [不同消息正文相同会导致 Skill 不显示] → 明确 fail closed，保守地避免错误 Skill chip；结构化 item 仍可正常显示自身 metadata。
- [详情与分页 item identity 不一致时可能无法补全] → 依次使用 id、带 turn 的复合键和唯一正文匹配；无法唯一匹配时保留分页结果并等待后续权威 repair。
- [新合并逻辑影响既有 snapshot ingress] → 只合并三类附件 metadata，不覆盖正文、状态、顺序或已有非空 metadata，并用现有 store 测试套件回归。

## Migration Plan

无需数据迁移或 API 版本迁移。部署后新读取请求立即使用回退绑定和刷新 metadata 合并；回滚只需恢复代码版本，历史 rollout 数据保持不变。

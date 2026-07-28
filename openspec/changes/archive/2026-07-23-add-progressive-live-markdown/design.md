## Context

`AgentMessage` 在 `live=true` 时强制 `PlainAgentText`，是为了避免每个 delta 都跑 `react-markdown + remark-gfm + rehype-highlight`。代价是用户体验差：格式在 turn 结束时突然出现。历史消息已有 `LazyAgentMarkdown`，完成后会全量渲染。

## Goals / Non-Goals

**Goals:**
- live 输出中，已完成段落/代码块尽早显示 markdown
- 未完成尾巴保持轻量纯文本，避免半截 fence/表格结构错误
- 不得对每个 delta 强制完整代码高亮重跑
- 完成后仍走现有 Lazy/full Markdown 路径

**Non-Goals:**
- 不做真正的增量 AST/虚拟 DOM diff markdown 引擎
- 不改 reasoning 卡片渲染
- 不在 streaming 中启用 Mermaid 实时重渲染
- 不做桌面端专用渲染策略

## Decisions

1. **稳定前缀 + 未完成尾巴**
   - `splitStreamingMarkdown(text) => { stableMarkdown, pendingPlain }`
   - `stableMarkdown` 用现有 `Markdown` 渲染
   - `pendingPlain` 用 `PlainAgentText`

2. **完成边界规则（第一版）**
   - 优先保护 fenced code：未闭合 fence 全部留在 pending
   - 已闭合 fence 进入 stable
   - 非 code 区域按空行 `\n\n` 切段落；最后一个未以空行结束的块留 pending
   - 单换行列表项若尚未形成稳定段，可随段落规则处理

3. **不在 streaming 中单独禁用 highlight**
   - 第一版复用现有 `Markdown`，因为只在块完成时更新 stable 前缀，频率远低于每个 token
   - 若后续 profiling 显示高亮仍贵，再拆“轻量 Markdown / 完成后增强”

4. **live 判定不变**
   - 继续使用现有 `liveAgentEntryIds`
   - 非 live 仍走 `LazyAgentMarkdown`

## Risks / Trade-offs

- [Risk] plain → markdown 高度跳变影响 stick-to-bottom → Mitigation：只在块边界切换，跳变次数远少于逐 token 渲染
- [Risk] 复杂 GFM（表格）半成品难看 → Mitigation：未完成块留 plain，表格完整空行边界后再进 stable
- [Risk] 长 stable 前缀重复解析 → Mitigation：块级更新而非 token 级；必要时后续 memo/throttle

## Migration Plan

- 纯前端改动
- 刷新后生效
- 若回退，恢复 live 全 plain 即可

## Open Questions

- 无。第一版按“闭合 fence + 空行段落”落地。

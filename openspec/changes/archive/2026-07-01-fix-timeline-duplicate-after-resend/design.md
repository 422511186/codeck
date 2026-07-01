## Context

当前 timeline 可能同时接收以下形态的同一输出：

- live delta：`agent_message_delta`、`reasoning_delta`、`command_output_delta` 等逐段追加。
- item completion：`item_updated` 或 `rawResponseItem/completed` 携带完整 item。
- snapshot/overlay：`readThread` 返回的历史 item 与 app-server 保存的 live overlay 合并。

已有逻辑主要按 `entry.id` 合并，因此当同一 turn 的 live item id 与 completion/snapshot item id 不一致，或 overlay 与 snapshot 中等价输出 id 不一致时，会显示两条内容相同的 reasoning/agent message。刷新后是否消失取决于重复是否只存在于前端 store，还是已经由服务端 overlay 合进 snapshot。

## Goals / Non-Goals

**Goals:**

- 同一 turn 内等价的 agent message、reasoning、tool output 必须只显示一条。
- completion/snapshot 应优先替换 live delta，而不是与 live delta 并列。
- 服务端 overlay 合并时也要避免把等价输出追加成重复项。
- 保留不同 turn 中内容相同的合法输出，不做跨 turn 文本去重。

**Non-Goals:**

- 不改变 rewind/fork 的交互模型。
- 不隐藏同一 turn 中不同 tool call 的不同输出。
- 不用纯文本做跨 turn 全局去重。

## Decisions

1. **前端增加 turn-scoped 等价 key。**  
   对 agent message、reasoning 和 tool output，除 `id` 外使用 `turnId + body kind + normalized text/result` 作为“完成态/快照态替换 live 态”的辅助 key。只有同 turn、同类型且文本非空高度一致时才归并。

2. **completion/snapshot 优先于 live delta。**  
   如果现有 entry 是 live partial，后到的完整 item 应替换并保留更完整 metadata；如果现有 entry 文本更长，则保留现有文本，避免 completion 空文本覆盖 live 文本。

3. **服务端 overlay 合并也应用等价输出去重。**  
   `applyTimelineOverlay` 不仅按 id 替换，还应在 overlay item 与 snapshot item 等价时合并到 snapshot item，避免刷新后重复。

4. **不跨 turn 去重。**  
   所有辅助合并必须要求 `turnId` 相同，避免用户连续问相同问题时误删合法输出。

## Risks / Trade-offs

- [Risk] 过度归并可能隐藏同 turn 内两条相同文本的不同 tool call。→ Mitigation：tool output 还需匹配 `toolKind/server/tool`，不只看 result。
- [Risk] completion 文本可能只是 summary，不完全等于 live 文本。→ Mitigation：只在一方文本包含另一方或完全相等时归并，保留更长文本。
- [Risk] 缺少 turnId 的历史 item 无法安全归并。→ Mitigation：无 turnId 时不使用辅助 key，避免跨历史误删。

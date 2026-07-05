## Context

移动端会话页的 `ChatInput` 当前把 `running` 作为整个 composer 的替换条件：thread 运行中时，组件只渲染“正在生成…”状态和中断按钮。这个实现简单，但会让用户在 agent 执行期间无法继续输入下一句，也无法提前准备图片或 Skill 引用。

现有后端能力已经区分 `turns/start`、`turns/:threadId/interrupt` 和 `turns/:threadId/steer`。本变更只调整移动端 composer 的前端交互，不改变 turn 协议，也不引入排队发送。

## Goals / Non-Goals

**Goals:**

- thread 运行中仍保留底部 composer 的结构和草稿编辑能力。
- 运行中只把 composer 右侧发送按钮切换为中断按钮，降低界面跳变。
- 允许用户在运行中准备下一条文本、图片和 Skill 引用。
- 准备好的内容必须只影响下一次手动发送，不影响当前正在执行的 turn。
- 保持现有图片上传、Skill picker、草稿保存和中断 API 语义。

**Non-Goals:**

- 不实现自动排队发送。
- 不把运行中输入内容映射到 `turn/steer`。
- 不新增后端接口或修改 app-server 协议。
- 不重新设计 composer 的整体视觉结构。

## Decisions

1. 运行中继续渲染同一个 composer 分支，而不是单独渲染状态栏。

   这样可以复用现有文本草稿、图片状态、Skill picker 和工具栏布局。替代方案是保留状态栏并额外加一个“下一句草稿”输入区，但这会复制 composer 能力，且移动端底部空间不足。

2. `running` 只影响右侧主按钮。

   空闲时主按钮是发送；运行中主按钮变为中断，并调用现有 `onInterrupt`。这让用户能在同一位置理解“当前主要动作”。发送逻辑仍在 `running` 时禁止触发，避免产生第二个并发 turn。

3. 运行中准备的文本、图片和 Skill 引用保持为本地草稿。

   草稿仍按 `threadId` 保存。图片上传和 Skill 选择可继续使用；当前 turn 完成后，如果内容满足发送条件，用户手动点击发送。替代方案是当前 turn 完成后自动发送，但移动端误触和未完成输入风险更高。

4. 不提供 steer 入口。

   `turn/steer` 的产品语义是干预当前执行，不是准备下一句。此变更解决的是连续输入准备问题，因此不复用 steer，避免用户输入被发送到错误的 turn。

## Risks / Trade-offs

- [Risk] 运行中允许图片上传可能让用户误以为图片已经影响当前 turn。→ Mitigation：发送按钮在运行中显示为中断，当前 turn 完成后才恢复发送；spec 明确准备内容只属于下一次手动发送。
- [Risk] 中断按钮替换发送按钮后，用户可能找不到运行状态提示。→ Mitigation：按钮使用停止图标和 `aria-label="中断"`，必要时在按钮 title 或无障碍文案中体现运行中状态；timeline 仍展示运行中输出。
- [Risk] 现有测试依赖 running 时 composer 消失。→ Mitigation：更新测试断言为 composer 保留、发送按钮消失、中断按钮出现，并补充运行中可编辑草稿/选择 Skill 的覆盖。

## Migration Plan

1. 更新 `ChatInput` 的 running 渲染分支，保留 composer 并仅切换主按钮。
2. 调整发送禁用条件，确保 running 时不会触发标准发送。
3. 保持中断调用走现有 `onInterrupt`。
4. 更新单元测试，验证 running 时 composer 可编辑、上下文可准备、主按钮为中断。
5. 若出现回归，可回退 `ChatInput` 中 running 分支和对应测试。

## Open Questions

无。

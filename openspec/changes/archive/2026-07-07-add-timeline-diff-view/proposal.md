## Why

当前 timeline 中单独的 diff row 已有 unified diff 样式，但连续活动被聚合到内联 activity log 后，文件变更详情只以纯文本 `<pre>` 展示，缺少行号、增删染色和完整 diff 复制能力。用户在移动端查看 agent 修改文件时难以快速审查变更内容。

## What Changes

- 在 timeline 的文件变更 activity 展开区域引入统一 diff view，直接展示行号、hunk、增删颜色和完整 diff 复制入口。
- 保持文件变更 activity 的单层展开：用户展开 `Files changed` 摘要后即可看到每个文件的 diff 内容，不再出现第二层文件按钮。
- 复用并抽取现有 `DiffCard` 的解析、截断和渲染能力，避免维护两套 diff 展示逻辑。
- 对非标准 unified diff 或 `apply_patch` 文本提供可读 fallback，仍保留路径、统计和复制完整内容。

## Capabilities

### New Capabilities

### Modified Capabilities
- `agent-output-rendering`: timeline 内联文件变更详情需要使用 diff view，而不是纯文本展示。

## Impact

- 前端组件：`src/web/components/Timeline.tsx`、`src/web/components/cards/DiffCard.tsx`，可能新增共享 diff view 组件。
- 前端状态：优先沿用现有 `DiffEntry` 和 `ToolEntry` 数据结构；如需要，仅补充轻量转换 helper。
- 测试：补充 timeline 组件测试，覆盖单文件、多文件、`toolKind=file`、长 diff 截断和复制完整 diff。
- API/后端：不新增 API；继续使用现有 `turn_diff_updated`、历史 `fileChange` 和 file tool activity 数据。

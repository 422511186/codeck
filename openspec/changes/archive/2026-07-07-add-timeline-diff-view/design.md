## Context

timeline 当前有两条 diff 展示路径：单独的 `diff` timeline row 会使用 `DiffCard`，可以展示 unified diff 行号、hunk、增删染色、截断和复制完整 diff；但连续活动被聚合成 `InlineActivityLog` 后，文件变更会进入 `files` section，展开详情由 `ActivityDetailText` 以纯文本 `<pre>` 渲染。这样同一份 diff 在不同 timeline 覆盖面下体验不一致。

相关数据来源已经存在：`turn_diff_updated` 会生成 `DiffEntry`；历史 `fileChange`、`apply_patch` 和 `file_output_delta` 会形成 `toolKind=file` 的 `ToolEntry`。本 change 不改变后端协议，只调整移动端 timeline 渲染。

## Goals / Non-Goals

**Goals:**

- timeline 内联文件变更展开后直接显示 diff view，而不是纯文本 diff。
- 单文件和多文件文件变更都保持单层展开，不恢复文件子行二次点击。
- 复用现有 `DiffCard` 的 diff 解析、行号、染色、截断和复制完整 diff 能力。
- 对 `DiffEntry` 和 `toolKind=file` 都提供一致覆盖。

**Non-Goals:**

- 不新增全局 Git diff 页面或 review 模式。
- 不为 diff 添加采纳、回滚、撤销等操作。
- 不改变 app-server 事件协议、timeline 数据模型或后端 diff 生成逻辑。

## Decisions

1. 抽取共享 `DiffView` 组件，而不是在 `Timeline.tsx` 里复制 diff 渲染逻辑。

   `DiffCard` 继续负责折叠卡片外壳；`DiffView` 负责 diff 内容区域、预览截断、行号和复制完整 diff。timeline 内联详情可以直接使用 `DiffView`，并在外层提供文件标题和统计。这样能保持现有 `DiffCard` 测试价值，也避免两套解析器行为分叉。

2. 文件 activity 展开后按 entry 直接渲染 diff block。

   `InlineActivityLog` 已经把 `section.kind === "files"` 走单层 `DirectActivityDetails`。实现上在 `DirectActivityDetail` 中识别 `body.kind === "diff"` 和 `body.kind === "tool" && toolKind === "file"`，转为统一 diff block。每个文件 block 显示路径、`+N -N` 和 diff view；多文件时在同一展开区域顺序显示多个 block。

3. 只在展开态解析 diff，折叠态保留摘要。

   折叠态只显示 `Files changed · N · +A -R`。`DiffView` 只在展开后挂载，继续使用 `createTextPreview` 限制默认 DOM 行数和字符数。长 diff 通过复制完整 diff 保留完整访问路径。

4. 非 unified diff 使用同一容器的可读 fallback。

   现有解析器遇到无法识别的行会当作 file/context 文本展示。对于 `apply_patch` 这类非 unified patch，本 change 不尝试语义转换，只使用同一滚动容器和复制完整 diff，避免引入不可靠 parser。

## Risks / Trade-offs

- 长 diff 在展开时仍可能产生较多 DOM → 继续沿用 `createTextPreview` 截断，并提供复制完整 diff。
- `toolKind=file` 的文本可能不是标准 unified diff → 使用 fallback 展示，不阻断用户查看原文。
- 多文件 diff 如果后端只提供合并文本，无法精确拆分每个文件 → 以当前 entry 粒度展示，未来如数据模型提供 per-file changes 再细化。

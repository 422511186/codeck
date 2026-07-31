## Why

Timeline 当前能够解析 GitHub-flavored Markdown 表格，但只提供基础的横向滚动容器，没有表头层次、单元格边框和足够的内边距。在手机宽度下，表格容易显得拥挤或缺少结构，影响 agent 输出的阅读和列间对比。

## What Changes

- 为 timeline 中的 Markdown 表格增加 GitHub 风格的完整细边框、表头背景和单元格间距。
- 宽表保持列宽，通过表格专属容器横向滚动，不压缩为难以阅读的窄列。
- 复用现有浅色和深色主题 token，保持表格与 timeline 其他 Markdown 内容一致。
- 增加 Markdown 组件和 timeline 移动端宽表的回归测试。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `agent-output-rendering`: 明确 agent Markdown 表格必须具备可读的 GitHub 风格视觉层次，并在移动端超宽时保留列宽、支持横向滚动。

## Impact

- 影响 `src/web/components/Markdown.tsx` 的表格容器样式和 `src/web/theme/tokens.css` 的 Markdown 表格样式。
- 更新 `tests/unit/web-markdown.test.tsx` 和必要的 `tests/unit/web-timeline.test.tsx`。
- 不改变 Markdown 解析器、timeline 数据结构、API 或服务端协议。

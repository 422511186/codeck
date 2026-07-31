## Context

`Markdown` 已通过 `remark-gfm` 解析表格，并为 `<table>` 提供了可横向滚动的外层容器。但表格本身仍主要依赖浏览器默认样式，缺少表头层次、单元格边框和足够的阅读间距；同时 `max-width: 100%` 会限制宽表的自然列宽。timeline 的 agent 消息容器继续禁止自身横向溢出，因此横向滚动必须由表格专属容器承担。

## Goals / Non-Goals

**Goals:**

- 在浅色和深色主题中提供 GitHub 风格的细边框、淡色表头和紧凑单元格间距。
- 宽表保持内容驱动的列宽，并在移动端通过表格容器横向滚动。
- 保持现有 GFM 解析、语义化 table/thead/th/td 结构和 timeline 虚拟渲染行为。
- 用测试覆盖表格结构、class 契约、宽度策略和主题样式选择器。

**Non-Goals:**

- 不把表格转换为移动端卡片或改变 Markdown 数据语义。
- 不新增依赖、API、服务端逻辑或 timeline 数据字段。
- 不修改代码块、列表、图片或其他 Markdown 元素的视觉规则。

## Decisions

1. **使用现有 ReactMarkdown table 覆盖点配合 CSS class。**
   - `Markdown.tsx` 继续负责包裹滚动容器，并给容器和 table 添加稳定 class；视觉规则集中在 `tokens.css`，便于浅色/深色 token 统一切换。
   - 不为每个 `th`/`td` 添加内联样式，避免把主题规则散落在渲染组件中。

2. **使用内容驱动的宽表和容器级横向滚动。**
   - table 使用 `width: max-content`、`min-width: 100%`，移除会阻止宽表溢出的 `max-width: 100%`。
   - 滚动容器继续使用 `max-width: 100%`、`overflow-x: auto`，确保 timeline 本身不会产生横向滚动。

3. **采用轻量 GitHub 风格而非卡片化视觉。**
   - table、`th` 和 `td` 使用现有 `--cw-border`；表头使用 `--cw-bg-elevated`；单元格统一提供 `8px 10px` 间距并顶端对齐。
   - 保持细边框和无额外阴影/厚重圆角，避免在 agent 正文中形成嵌套卡片。

4. **验证 DOM 契约和 CSS 契约。**
   - Markdown 单测验证 GFM 表格生成 thead/th/td、稳定 class 和 table 宽度 inline 策略。
   - CSS 文本契约测试验证表头、单元格边框/间距和主题 token 选择器存在；timeline 既有宽内容测试继续验证滚动边界。

## Risks / Trade-offs

- [风险] 内容驱动宽度可能使列很多的表格需要明显横向滚动。→ [缓解] 这是移动端保持列对比关系的明确取舍，容器保留原生触控滚动。
- [风险] 表格样式依赖主题 token，新增选择器若覆盖范围过宽可能影响其他 Markdown 内容。→ [缓解] 所有规则限定在 `.cw-markdown-table` 下，并复用既有 token。
- [风险] 仅靠 jsdom 无法验证真实像素布局。→ [缓解] 单测覆盖结构和 CSS 契约，`npm run verify` 负责回归验证；不引入额外浏览器测试依赖。

## Migration Plan

无需数据迁移或发布开关。部署前运行 Markdown 专项测试和项目 `verify`；若需要回滚，只需回退本次 Markdown 组件和主题样式改动。

## Open Questions

无。GitHub 风格完整细边框和宽表横向滚动已由用户确认。

## Context

当前 `Timeline` 会把连续 activity entries 聚合为 `InlineActivityLog`，但 `section.details` 在折叠状态下无条件渲染。结果是长 turn 默认显示大量 `Read`、`Searched`、`已运行` 明细，和用户期望的“默认只看一行摘要”不一致。

现有数据已经包含每条 activity entry 的稳定 `id`、`body.kind`、`toolKind`、`actionKind`、命令文本、参数和结果。本次变更不需要新增数据模型，只需要调整呈现层的展开状态和 DOM 结构。

## Goals / Non-Goals

**Goals:**

- 默认折叠状态只显示 activity block 摘要行、展开入口和失败状态。
- 展开 activity block 后显示每条动作的短标题列表，例如 `Read src/app.ts`、`Searched timeline`、`已运行 npm test`。
- 每条动作可以单独展开，查看原始命令、参数、输出、diff 或错误详情。
- 保持当前连续 activity 聚合、顺序、失败标识和无卡片化视觉风格。

**Non-Goals:**

- 不改变 app-server 事件、timeline entry 类型或 store 归一化逻辑。
- 不重新设计全部 timeline 视觉样式。
- 不新增虚拟滚动、分页或历史读取策略。

## Decisions

1. **使用两级本地展开状态**

   `InlineActivityLog` 保留 section 级 `openKeys`，并新增 entry 级 `openEntryIds`。section 展开只显示动作列表；entry 展开才显示 `ActivityDetail`。

   备选方案是默认显示前 N 条短明细，但长 turn 仍会挤占首屏，且用户明确要求默认只显示第一行摘要。

2. **复用现有 detail 文案生成函数**

   动作列表继续使用 `commandActivityDetail`、`fileChangeDetail`、`genericToolDetail` 生成短标题，避免重新解析命令。完整详情继续使用 `ActivityDetail`，保证原始信息不丢失。

   备选方案是为每种 activity 新建专门组件，但当前需求集中在展开层级，过早拆组件会增加改动范围。

3. **测试覆盖用户可见行为**

   单元测试以 `@testing-library/react` 验证：默认不显示短明细，点击摘要后显示动作列表，点击单条动作后显示详情输出。这样比测试内部状态更稳定。

## Risks / Trade-offs

- **风险：Skill loaded 明细默认不再可见，与旧规范冲突。** 通过 delta spec 明确废弃旧要求，所有 activity 类型统一遵守默认只显示摘要。
- **风险：展开后列表和详情都使用相近文案，测试查询可能不稳定。** 测试优先使用用户可点击的按钮和详情输出文本，避免依赖重复标题。
- **风险：长输出展开后仍可能很高。** 保留现有详情容器 `maxHeight` 和内部滚动，避免撑爆移动端页面。

## Migration Plan

这是前端呈现层变更。部署后新旧 timeline 数据都使用同一渲染逻辑，无需数据迁移。若需要回滚，恢复 `InlineActivityLog` 的旧渲染逻辑即可。

## Open Questions

无。

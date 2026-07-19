## Context

当前 `ChatInput` 只接收一个模型入口，按钮文案把模型和 reasoning effort 拼在一起；`UnifiedModelPicker` 也在当前模型行内渲染推理强度按钮。模型选择和推理强度更新虽然调用了不同的回调，但交互入口和视觉归属混在一起，尤其在自定义模型档位较多时容易误操作。

现有模型目录已经为当前模型提供 `supportedReasoningEfforts`，现有页面也有 `onSelectReasoningEffort` 和 settings 更新逻辑。本次只调整前端入口和组件边界，复用这些状态与 API。

## Goals / Non-Goals

**Goals:**

- 在 composer 中展示独立的模型 chip 和推理强度 chip。
- 模型 chip 打开只负责模型来源/绑定选择的 picker。
- 推理强度 chip 打开独立的底部选择器，只列出当前模型支持的档位。
- 保留自定义模型、未知 effort 值、模型切换恢复和 settings 请求的现有语义。
- 当前模型没有支持档位时隐藏推理强度入口，不制造无效按钮。

**Non-Goals:**

- 不改模型目录协议、模型上下文窗口或 app-server 权威模型目录。
- 不改变模型切换接口、推理强度 settings 接口或 turn start 参数。
- 不在本次变更中重新设计 composer 的整体布局和权限 chip。

## Decisions

### 两个独立的 composer 回调

`ChatInput` 增加 `onOpenReasoningPicker` 和独立的 `reasoningEffortLabel` 展示；模型入口继续使用 `onOpenModelPicker`。两个 chip 由页面分别控制，避免在子组件中根据文本反推交互语义。

### 独立 ReasoningEffortPicker

从 `UnifiedModelPicker` 中移除 `ReasoningOptions`，新增轻量 `ReasoningEffortPicker` 组件，接收当前模型状态、选中回调和关闭回调。这样模型 picker 的加载、搜索、目录错误不会影响档位选择器，且两个 overlay 的行为可独立测试。

### 档位来源与未知值

推理选择器使用 `supportedReasoningEfforts` 去重，并把当前 `reasoningEffort` 追加到列表，确保服务端返回的未知精确值仍可见。标签继续使用现有英文映射；提交仍传原始字符串。

### 模型切换后的档位显示

模型切换成功后沿用 `latestState.reasoningEffort`。如果新模型没有可选档位，页面隐藏 reasoning chip，但不清除后端返回的原始值，避免 UI 改写协议状态。

## Risks / Trade-offs

- [入口增多导致工具栏拥挤] → 两个 chip 都使用可压缩、单行省略样式；移动端 status row 保持横向滚动。
- [模型切换后档位暂时为空] → 根据最新 `ThreadModelStateView` 渲染，选择器没有可用项时显示明确的“当前模型不支持独立推理强度”。
- [旧测试依赖档位在模型 picker 内] → 更新测试契约为两个独立组件，保留相同的 settings 调用断言。

## Migration Plan

不需要数据迁移。发布后已有会话继续使用相同的模型选择和 reasoning effort 状态；仅改变入口位置。回滚只需恢复 composer 的合并 chip 和 `UnifiedModelPicker` 内的档位区块。

## Open Questions

- 后续是否需要在模型 chip 内显示 provider/source 徽标？本次保持现有模型标签，不扩大视觉范围。

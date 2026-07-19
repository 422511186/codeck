## Why

当前 composer 把模型名和推理强度合并在同一个 chip，并把推理强度选项嵌在模型选择器内部，用户无法快速判断点击后会修改哪个维度。拆成两个入口后，模型切换和推理强度调整的作用域更清晰，也减少误操作。

## What Changes

- composer 底部工具栏将“模型 + 推理强度”合并 chip 拆成两个独立 chip。
- 模型 chip 仅展示当前模型并打开模型选择器；模型选择器不再展示推理强度选项。
- 推理强度 chip 仅展示当前档位并打开独立选择器，选项来自当前模型的 `supportedReasoningEfforts`，并保留未知精确值。
- 推理强度更新继续调用现有 thread settings API；模型切换继续使用现有来源敏感的 model switch 流程。
- 当前模型没有可选推理强度时，推理强度入口不显示，避免提供无效操作。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `chat-input-area`: composer 必须用独立 chip 展示模型和推理强度，并分别打开对应选择器。
- `thread-controls`: 会话级模型切换与推理强度调整必须保持独立入口和独立提交语义。

## Impact

- 影响 `src/web/components/ChatInput.tsx`、`UnifiedModelPicker.tsx`、会话页 picker 状态和新增推理强度选择组件。
- 影响 composer、模型选择器、推理强度更新的单元测试和手机视口验证。
- 不改变 app-server、自定义模型目录、模型切换 API 或 thread settings 协议。

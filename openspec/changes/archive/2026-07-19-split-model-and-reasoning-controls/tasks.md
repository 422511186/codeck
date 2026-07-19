## 1. 独立选择器组件

- [x] 1.1 在 `tests/unit/web-reasoning-effort-picker.test.tsx` 增加当前模型档位、未知值、无档位和提交原始值的失败测试
- [x] 1.2 新增 `ReasoningEffortPicker`，复用现有 effort 标签映射并提供关闭、选中态和空状态
- [x] 1.3 移除 `UnifiedModelPicker` 内嵌的 `ReasoningOptions`，更新模型选择器测试验证只展示模型

## 2. Composer 与会话页接线

- [x] 2.1 在 `tests/unit/web-thread-page.test.tsx` 增加模型 chip、推理强度 chip 分别打开对应 picker 的失败测试
- [x] 2.2 扩展 `ChatInput`/`ThreadComposerDock` props，渲染独立模型和 effort chip，并在无可用 effort 时隐藏 effort chip
- [x] 2.3 在会话页增加 reasoning picker 状态和渲染，接入现有 `onSelectReasoningEffort`，保证模型选择仍走原模型切换流程
- [x] 2.4 更新手机端 chip 样式，确保两个入口在窄屏可压缩、可横向滚动且文本不重叠

## 3. 回归与验证

- [x] 3.1 更新模型选择、推理强度更新和 Plan turn 参数测试
- [x] 3.2 运行相关 Vitest、`npm run verify` 和 `openspec validate split-model-and-reasoning-controls --strict`
- [x] 3.3 使用手机视口验证两个 chip 的独立交互、无 effort 模型隐藏入口，以及 warning/权限 bug 没有回归

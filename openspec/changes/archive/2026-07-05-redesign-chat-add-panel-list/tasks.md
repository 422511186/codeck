## 1. 测试先行

- [x] 1.1 在前端测试中增加 `+` 添加面板列表布局、隐藏未支持项、Skill 已选数量和目标状态的失败用例
- [x] 1.2 增加目标编辑 sheet 设置、清除和失败保留输入的失败用例

## 2. Web API 与状态类型

- [x] 2.1 为 Web 侧类型补充 `ThreadGoal` 和 `ThreadDetail.goal`
- [x] 2.2 在 `src/web/api/endpoints.ts` 增加 `setThreadGoal` 和 `clearThreadGoal` 封装

## 3. UI 实现

- [x] 3.1 将 `ChatInput` 的 `AddPanel` 从宫格卡片改为列表式 bottom sheet
- [x] 3.2 在 `AddPanel` 中隐藏未支持的「文件」「插件」，并展示 Skill `已选 N` 状态
- [x] 3.3 接入目标入口动态文案和 `已设置` 状态
- [x] 3.4 在会话页实现目标编辑 sheet，并调用目标设置/清除 API 更新本地 thread detail
- [x] 3.5 从目标编辑 sheet 移除 token budget 输入，并由 Web API 封装清空历史 budget

## 4. 验证

- [x] 4.1 运行相关单元测试并修复失败
- [x] 4.2 运行 OpenSpec 校验和项目验证命令

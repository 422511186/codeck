## Context

聊天页底部 composer 已有 `+` 添加面板，当前以宫格卡片显示「图片」「引用 Skill」以及禁用的「文件」「目标」「插件」。这个布局在手机上占用空间大，禁用项造成半成品观感，并且无法表达 Skill 可多选、目标是否已设置等状态。

后端和 app-server client 已经具备 thread goal 设置和清除能力；本次变更只把目标入口接入 composer 添加面板，不引入完整目标常驻条，也不改变 Plan/Build 协作模式。

## Goals / Non-Goals

**Goals:**

- 将 `+` 添加面板改为列表式 bottom sheet，保持浮在 composer 上方且输入框可见。
- 只展示当前可用动作：图片、引用 Skill、设定目标/编辑目标。
- 在「引用 Skill」行展示 `已选 N` 状态 chip。
- 在「目标」行根据当前 thread goal 展示「设定目标」或「编辑目标」和 `已设置` 状态 chip。
- 提供目标编辑 sheet，支持设置 objective 和清除目标，不向用户暴露 token budget。
- 保持现有图片上传、Skill 选择和发送流程不变。

**Non-Goals:**

- 不把 Goal 做成 Plan/Build 并列的第三种 `ChatMode`。
- 不新增 app-server collaboration mode，不改 turn/start 协议。
- 不实现文件、插件入口。
- 不新增会话目标常驻展示条；该能力可在后续 change 中独立设计。

## Decisions

1. **列表式 bottom sheet 替代宫格卡片**

   每个动作使用一行：左侧轻量图标容器，中间主标题和副标题，右侧可选状态 chip。相比宫格，列表在手机上更省高度，也能承载「已选 N」「已设置」这类状态。

   备选方案是保留宫格但缩小卡片；这仍然会让禁用项和可用项像同等重要，不适合工具型界面。

2. **隐藏未支持动作**

   「文件」「插件」在第一版不展示。未完成入口如果显示禁用态，会降低产品完成度观感，也会增加用户扫描成本。

   备选方案是显示「即将支持」；这适合路线图页面，不适合高频 composer 菜单。

3. **目标入口接入真实 thread goal API**

   「设定目标/编辑目标」不做空壳入口。ThreadPage 读取 `ThreadDetail.goal`，并向 ChatInput 传入目标状态和打开编辑器回调；目标编辑器调用 Web API 封装的 `setThreadGoal` 和 `clearThreadGoal`。Web UI 只传递 objective，`setThreadGoal` 封装会显式发送 `tokenBudget: null`，避免历史目标预算继续生效。

   备选方案是只展示目标入口但禁用；这和隐藏未支持动作的原则冲突。

4. **目标状态只在添加面板显示为短 chip**

   有目标时右侧显示 `已设置`，不在列表里展示长目标文本，避免手机宽度被长 objective 撑乱。更完整的目标摘要条后续单独设计。

5. **Skill 多选状态显示数量**

   右侧显示 `已选 N`，不展示具体 Skill 名称。Skill 名称可能很长，列表中展示名称容易挤压布局。

## Risks / Trade-offs

- [Risk] 目标编辑让本次变更触及 ThreadPage、ChatInput、API 类型和测试，范围大于纯样式调整。  
  Mitigation: 保持目标能力最小闭环，只实现设置、清除和本地状态更新，不引入目标常驻条或新会话目标流程。

- [Risk] 列表项副标题增加高度。  
  Mitigation: 第一版只有三个可用动作，总高度仍显著低于当前宫格；sheet 高度只包内容。

- [Risk] 目标 API 调用失败时用户可能不知道结果。  
  Mitigation: 目标编辑 sheet 内显示错误文本，失败时保持 sheet 打开，不清空输入。

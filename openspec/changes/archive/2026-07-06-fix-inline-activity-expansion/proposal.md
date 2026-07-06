## Why

移动端 timeline 的内联 activity 现在会在默认折叠状态下直接铺出大量 `Read`、`Searched`、`已运行` 明细，长 turn 会挤占首屏并压低对话可读性。用户期望默认只看到一行汇总，展开后再查看具体动作，并且每个动作可单独展开详情。

## What Changes

- 调整内联 activity block 的默认呈现：默认只显示摘要行和失败状态，不显示每条底层命令/读取/搜索明细。
- 将 activity block 展开后的内容改为动作列表，每条动作显示短标题、状态和可展开入口。
- 为单条动作提供独立展开详情，详情中显示原始命令、参数、输出、diff 或错误信息。
- 更新现有 timeline 单元测试，覆盖默认折叠、组展开和单条动作展开。
- 更新 `agent-output-rendering` 规范，废弃“短活动明细默认可见”的旧要求。

## Capabilities

### New Capabilities

- 无

### Modified Capabilities

- `agent-output-rendering`: 修改移动端内联 activity 展开层级和默认可见内容要求。

## Impact

- 影响前端 timeline 呈现层：`src/web/components/Timeline.tsx`。
- 影响单元测试：`tests/unit/web-timeline.test.tsx`。
- 不改变 timeline entry 数据结构、SSE 事件流、store 归一化、后端 API 或部署配置。

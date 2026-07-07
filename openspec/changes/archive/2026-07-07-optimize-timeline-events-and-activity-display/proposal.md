## Why

当前移动端 timeline 在运行中仍可能夹杂高成本全量会话读取，并且活动日志在手机视口里存在层级过深的问题：Thinking 和文件变更需要展开多层才看到有效内容，失败状态也以英文 `Failed` 显示且错误详情埋得较深。

本变更用于收紧全量 timeline 修复入口，同时把 Thinking、文件变更和失败活动改成更直接的内联呈现，降低轮询成本和用户阅读成本。

## What Changes

- 将运行态更新继续保持为事件流主路径和轻量 summary 兜底，限制 `/api/codex/threads/:threadId` 全量修复的触发条件与重复触发。
- 为 snapshot repair 增加触发原因和同一原因的去重边界，避免事件流正常时因短时间无输出、summary idle 或完成事件叠加而反复读取完整 timeline。
- Thinking 活动展开后直接显示 reasoning 内容，不再显示二级 Thinking 行。
- 文件变更活动展开后直接显示文件 diff 或文件输出内容，不再要求逐个文件再展开一次。
- 失败活动用中文状态展示，并在展开后优先暴露失败命令、参数和错误输出。
- 保留多条命令、读取、搜索、工具加载等活动的分组折叠能力。

## Capabilities

### New Capabilities

### Modified Capabilities

- `timeline-event-stream`: 收紧运行态全量 snapshot repair 的触发、去重和事件流主路径要求。
- `agent-output-rendering`: 调整移动端内联活动日志中 Thinking、文件变更和失败状态的展示要求。

## Impact

- 影响 `src/app/threads/[threadId]/page.tsx` 的 snapshot repair 触发、summary 兜底和运行中无输出修复逻辑。
- 影响 `src/web/state/store.ts` 的 repair 请求状态和事件触发边界。
- 影响 `src/web/components/Timeline.tsx` 的内联活动日志渲染层级、失败状态文案和详情内容。
- 影响 timeline 相关单元测试、会话页轮询测试和 OpenSpec 规范。
- 不新增外部依赖，不改变后端 app-server 协议。

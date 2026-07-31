## Why

刷新会话后，历史分页返回的用户消息可能缺少 `turnId`，导致隐藏的 Skill supplement 无法绑定到对应消息；同时，分页结果可能覆盖首次详情读取中更完整的 Skill metadata，最终表现为用户消息顶部的 Skill chip 丢失。需要让历史加载和刷新在信息不完整时仍保留已经确认的 Skill 引用，并避免在正文重复时错误绑定。

## What Changes

- 为历史用户消息增加无 `turnId` 时的受限 Skill supplement 绑定能力。
- 仅在 Skill anchor 文本与用户消息正文形成唯一匹配时恢复 Skill；正文重复或匹配不确定时保持不绑定。
- 刷新合并 thread detail 与历史分页时保留更完整的 Skill、图片和文件 metadata。
- 增加服务端分页解析、前端刷新合并和歧义匹配的回归测试。

## Capabilities

### New Capabilities

- 无

### Modified Capabilities

- `timeline-content-completeness`: 历史分页、详情刷新和 timeline 合并必须保持用户消息的 Skill metadata，不得因缺少 `turnId` 或使用较不完整的分页结果而丢失 Skill chip。

## Impact

- 影响 `src/server/app-server/runtime.ts` 中 session timeline supplement 与分页结果的合并逻辑。
- 影响 `src/app/threads/[threadId]/page.tsx` 中刷新时 initial page 与 thread detail 的 timeline 合并逻辑。
- 增加 `tests/unit/app-server-runtime.test.ts` 及相邻 timeline/page 测试覆盖。
- 不改变公开 API 字段名称，不引入新的依赖，也不改变实时消息的正常 Skill 绑定路径。

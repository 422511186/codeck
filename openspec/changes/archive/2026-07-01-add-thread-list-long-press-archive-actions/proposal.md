## Why

当前项目会话列表只能点击进入会话后再执行归档或移出归档。移动端批量整理历史会话时，这会产生频繁进出详情页的额外路径，尤其在已归档 tab 中恢复会话也不够直接。

本变更让用户在会话管理页面直接长按会话条目完成归档状态切换，减少整理会话的操作成本，并保持移动端列表页为主要管理入口。

## What Changes

- 在项目会话列表的会话条目上新增长按手势，长按超过 500ms 后打开底部操作菜单。
- 在「进行中」tab 中，长按菜单提供「归档」操作，调用现有 thread archive API。
- 在「已归档」tab 中，长按菜单提供「移出归档」操作，调用现有 thread unarchive API。
- 操作成功后不进入会话详情页，当前条目从当前 tab 列表移除，并保留当前 tab 和滚动上下文。
- 操作失败时保留原列表内容，并在列表页展示错误提示。
- 长按触发菜单后不得继续触发行点击进入会话，避免误跳转。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `thread-list-view`: 会话列表条目新增长按底部菜单，并支持在列表内归档或移出归档。
- `thread-lifecycle`: 明确列表内归档和移出归档复用既有 archive/unarchive API，且不要求读取完整会话详情作为前置条件。

## Impact

- 主要影响 `src/app/projects/[projectId]/page.tsx` 的会话列表交互、菜单状态、归档请求和列表更新逻辑。
- 复用现有 `codex.archiveThread`、`codex.unarchiveThread` API，不新增后端路由或协议字段。
- 需要补充会话列表页单元测试，覆盖长按菜单、tab 区分、成功移除、失败恢复和防止误进入会话。

# Timeline 渲染身份修复设计

## 背景

`Timeline` 当前直接使用 `TimelineEntry.id` 作为 React 列表 key。Codex app-server 的 item id 只在特定启动实例、timeline generation 和 turn 范围内唯一，因此不同 turn 或 generation 可能合法地复用 `item-1`。当这些记录同时进入渲染窗口时，React 会报告重复 key，并可能错误复用、遗漏或重复渲染节点。

## 目标

- 不同 turn 或 generation 中复用同一 item id 的记录必须同时显示。
- 完全相同逻辑身份的重复记录只显示最后一个版本。
- React key、虚拟列表高度缓存和滚动锚点使用一致且稳定的块身份。
- 保持现有 activity 分组、长列表虚拟化和局部重渲染行为。

## 非目标

- 不修改 app-server 的 item id 生成规则。
- 不重构 timeline engine 的事件合并协议。
- 不通过数组下标制造仅在单次渲染中唯一的 key。

## 规范身份

普通 timeline entry 的规范身份由以下字段组成：

1. `historyStamp.bootId`，缺失时回退到 `bootId`，再缺失时使用 `legacy`。
2. `historyStamp.generation`，缺失时回退到 `generation`，再缺失时使用 `legacy`。
3. `turnId`，缺失时使用 `none`。
4. `body.kind`。
5. `id`。

对于带有 `clientUserMessageId` 的用户消息，继续以该客户端消息 id 作为跨快照稳定身份，避免乐观消息和权威消息重复。

activity block 优先沿用现有的 turn 与首成员 item id 分组身份，以便 generation 刷新时保留展开状态。若同一渲染窗口中该分组身份发生冲突，则使用首成员规范身份和冲突序号生成唯一后备身份。成员内容变化只更新 block version，不改变无冲突 block 的身份。

## 数据流

`deriveTimelineRenderBlocks` 在创建渲染块前按规范身份去重。若同一身份出现多次，保留最后一个 entry 的内容，同时保持该身份第一次出现的位置，避免重复快照更新造成列表跳动。随后创建的每个 render block 都同时携带原始诊断 id 和唯一的稳定 identity；原始 id 继续用于 DOM 调试属性，identity 供以下位置统一使用：

- React `key`
- `data-timeline-block-identity`
- 行高度缓存
- 滚动锚点匹配

不同 turn、generation 或 body kind 的同名 item 具有不同身份，因此不会被错误合并。

## 错误与兼容处理

缺少 boot、generation 或 turn 元数据的旧记录使用明确的 `legacy` / `none` 回退值。若旧数据中存在完全相同的回退身份，则按重复逻辑记录处理并保留最后版本。该规则比数组下标 key 更稳定，也与 timeline engine 已有的逻辑身份结构保持一致。

## 测试

先增加失败测试，再实现最小修复：

- 不同 turn 的两个 `item-1` 都渲染，且没有 React 重复 key 告警。
- 不同 generation 的两个 `item-1` 都渲染。
- 完全相同身份的重复记录只渲染最后版本。
- activity block 的身份在成员内容更新时保持稳定。
- 现有 Timeline 定向测试和 TypeScript 类型检查通过。

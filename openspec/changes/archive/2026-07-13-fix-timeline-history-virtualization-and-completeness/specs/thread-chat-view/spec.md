## ADDED Requirements

### Requirement: Timeline virtualization uses final render blocks
会话聊天页 SHALL 在窗口切片前派生稳定的 final render blocks。连续 reasoning/tool/command/diff activity MUST 先合并为 inline activity block，再参与 spacer、测量和可见范围计算。

#### Scenario: Long consecutive activity run
- **WHEN** timeline 包含超过 80 个连续 activity entries 且它们渲染为少量 inline activity blocks
- **THEN** spacer height MUST 按最终 blocks 计算
- **AND** MUST NOT 按每个原始 activity entry 重复分配固定高度

#### Scenario: Activity group crosses old window boundary
- **WHEN** 连续 activity 的成员跨越旧 entry window 边界
- **THEN** 新窗口 MUST 保持一个稳定 activity block
- **AND** block MUST 不因滚动被拆成不同摘要或产生空白间隙

### Requirement: Dynamic height index maps scroll offsets to blocks
Timeline SHALL 使用 estimated/measured block heights 的累计索引和二分查找将 scroll offsets 映射到可见 block range。系统 MUST 不仅使用 `scrollTop / fixedRowHeight` 计算窗口。

#### Scenario: Hidden rows have highly variable heights
- **WHEN** 历史包含短消息、数千像素 Markdown、展开 activity 和图片高度混合
- **THEN** 任意 scrollTop 对应窗口 MUST 覆盖 viewport 附近真实 blocks
- **AND** viewport MUST 不只显示 spacer 空白

#### Scenario: Measured height changes
- **WHEN** Markdown、图片或展开详情使 block 高度发生变化
- **THEN** layout index MUST 更新该 block 高度
- **AND** 当前阅读 anchor MUST 保持在相同 block 的相近视觉位置

#### Scenario: Anchor block disappears
- **WHEN** activity regroup、authoritative replace 或删除使原 anchor block id 消失
- **THEN** 页面 MUST 依次尝试包含原 entry identity 的新 block、before anchor、after anchor 和相同累计 offset 附近真实 block
- **AND** 恢复后的 viewport MUST 包含真实 timeline block 或明确 loading marker，不得为空白

### Requirement: Historical scrolling never exposes virtualization blank space
长会话从尾部持续上滑到历史开头时 SHALL 始终渲染 viewport 附近的 timeline blocks 或明确 loading marker。由窗口估算造成的纯空白区域 MUST 不可见。

#### Scenario: Reproduce last-segment-only history
- **WHEN** thread 有大量历史 entries、连续 activity 和超长消息，初始只挂载尾部窗口
- **AND** 用户向上滑动多个 viewport
- **THEN** 更早的用户、agent 和 activity blocks MUST 逐步出现
- **AND** MUST 不出现只有空 spacer、历史内容不挂载的 viewport

#### Scenario: Mobile browser verification
- **WHEN** 在项目支持的手机 viewport 执行自动滚动验证
- **THEN** 每个采样 viewport MUST 包含非空 timeline row pixels 或 loading marker
- **AND** scrollTop MUST 能到达最早已加载 block

### Requirement: Prepend and relayout preserve block anchor
加载更早分页、detail continuation、full-content 展开或 row 重新测量时，会话页 SHALL 使用 block identity 和 intra-block offset 保持阅读 anchor。仅当用户处于贴底状态时才自动跟随尾部。

#### Scenario: Older page prepended
- **WHEN** 用户在顶部附近触发历史分页并 prepend blocks
- **THEN** prepend 前位于 viewport 顶部的 block MUST 保持可见
- **AND** scrollTop 修正 MUST 使用 block layout offset 而不是只比较总 scrollHeight

#### Scenario: Live delta while reading history
- **WHEN** 用户正在阅读历史且尾部收到 live delta 或 full-content 更新
- **THEN** 当前阅读 anchor MUST 不跳到尾部
- **AND** jump-to-latest 控件 MUST 继续可用

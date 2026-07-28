## ADDED Requirements

### Requirement: Visible assistant boundaries split activity groups
timeline 展示层 SHALL 只把 normalized timeline 中连续相邻的 reasoning、tool、command、runtime loading 和 diff entries 聚合为同一个 activity block。可见 assistant message SHALL 构成不可跨越的分组边界；不同强 identity 的工具执行 MUST 保持独立，展示层 MUST NOT 通过重排、按 metadata 折叠或复用前一项位置来隐藏后到工具。

#### Scenario: Assistant text separates two commands
- **WHEN** 同一 turn 的 normalized source order 为 command A、可见 assistant message、command B
- **THEN** timeline MUST 按 command A、assistant message、command B 的顺序渲染
- **AND** command A 与 command B MUST 位于 assistant message 两侧的两个 activity 段，不能合并为同一个连续 activity block

#### Scenario: Identical command metadata remains positionally distinct
- **WHEN** command A 与 command B 具有相同 command metadata 和输出摘要
- **AND** 二者具有不同稳定 item identity，且可见 assistant message 位于二者之间
- **THEN** 展示层 MUST 保留两个独立动作及其原始位置
- **AND** MUST NOT 让 command B 替换 command A 的动作行或被前一个 activity block 吸收

#### Scenario: Refresh preserves the same visible grouping
- **WHEN** live timeline 与后续 bounded repair 或浏览器刷新都表示 command A、assistant message、command B
- **THEN** 三条可见内容的 identity 顺序和 activity 分组边界 MUST 保持一致
- **AND** 页面 MUST NOT 在刷新后把 command B 移到 assistant message 之前

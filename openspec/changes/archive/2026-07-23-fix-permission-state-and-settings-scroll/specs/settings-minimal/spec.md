## ADDED Requirements

### Requirement: Settings routes own their scroll viewport
在全局 body 锁定滚动的移动端布局中，`/settings` 路由树 SHALL 提供独立的视口级纵向滚动容器。容器 MUST 使用手机动态视口高度并为底部安全区预留空间，不得依赖 document/body 滚动。

#### Scenario: Main settings page reaches logout
- **WHEN** 设置页内容高度超过手机视口
- **THEN** 用户 MUST 能在设置路由容器内纵向滚动
- **AND** MUST 能看到并点击「登出 Web」按钮
- **AND** 按钮 MUST 不被底部安全区遮挡

#### Scenario: Custom model settings reuse scroll viewport
- **WHEN** 用户进入 `/settings/custom-models`
- **THEN** 列表页面 MUST 使用同一 settings 路由滚动边界
- **AND** 固定表单 overlay 自身的滚动行为 MUST 保持可用

#### Scenario: Chat viewport remains isolated
- **WHEN** settings 路由增加独立滚动容器
- **THEN** 全局 body 锁和 thread 页面固定 composer/Timeline 滚动 MUST 保持不变

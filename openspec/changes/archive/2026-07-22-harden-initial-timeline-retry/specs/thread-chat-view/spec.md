## ADDED Requirements

### Requirement: Initial timeline read errors are retryable in place

Thread 页面首屏 metadata 或 bounded timeline page 因未知连接、权限或 app-server 错误失败时，页面 SHALL 保留错误反馈并提供页内 retry。retry MUST 重新执行当前 thread 的首屏读取，不得把未知错误伪装为空会话，也不得依赖用户离开页面或浏览器刷新。

#### Scenario: Retry initial page after transient failure

- **WHEN** 首屏 timeline page 第一次读取失败且当前没有可见 detail
- **THEN** 页面 MUST 显示错误反馈和 `重试` 操作
- **AND** 点击 `重试` MUST 重新请求当前 thread 的 metadata 与 bounded latest page
- **AND** 成功后 MUST 显示正常 empty/timeline 页面

#### Scenario: Retry failure remains visible

- **WHEN** 用户点击 `重试` 后请求再次失败
- **THEN** 页面 MUST 显示最新错误反馈
- **AND** MUST 保留 `重试` 操作
- **AND** MUST NOT 清空或伪造 timeline detail

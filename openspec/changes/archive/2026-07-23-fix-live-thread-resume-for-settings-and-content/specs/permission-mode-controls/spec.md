## ADDED Requirements

### Requirement: Permission settings recover missing live thread
用户更新当前会话权限模式时，服务端 SHALL 在 thread 尚未 live 的情况下先恢复 live thread 再提交 settings。前端 MAY 继续直接调用 settings API；gateway MUST 对该路径提供 bare resume + 一次重试。成功后的 configured permission selection 语义保持不变。

#### Scenario: Cold session permission switch succeeds
- **WHEN** 用户进入历史或新会话后直接选择权限模式
- **AND** app-server 首次 `thread/settings/update` 返回 thread not found 或等价 missing-live-thread 错误
- **THEN** 服务端 MUST bare resume 该 thread
- **AND** MUST 使用用户选择的完整权限三元组重试 settings update
- **AND** 前端 MUST 看到设置成功，而不是 `thread not found`

#### Scenario: Model switch workaround is no longer required
- **WHEN** 用户未先切换模型
- **AND** 直接更新权限设置
- **THEN** 系统 MUST 仍能完成权限设置
- **AND** MUST NOT 要求前端先执行 model switch 作为前置条件

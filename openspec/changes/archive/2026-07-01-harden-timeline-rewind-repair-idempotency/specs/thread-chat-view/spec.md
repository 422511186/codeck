## ADDED Requirements

### Requirement: Initial snapshot cannot overwrite post-send local state
会话页在显示 cached timeline 且首屏 `readThread` 仍未完成时 SHALL 允许用户发送消息；但发送后，发送前启动的旧 initial snapshot MUST NOT 以 replace 方式覆盖 optimistic user message、已到达 live delta 或已绑定的新 turn metadata。

#### Scenario: Cached send races initial read
- **WHEN** 页面使用 cached timeline 显示 idle thread
- **AND** initial `readThread` 请求仍在进行
- **AND** 用户发送新消息并收到 `turn/start` 返回
- **AND** initial `readThread` 随后返回发送前的旧 snapshot
- **THEN** 客户端 MUST 忽略该旧 snapshot 的 replace
- **AND** timeline MUST 保留新 user message 和已到达的 live 输出

### Requirement: Repair replace is serialized with local mutations
snapshot repair、rollback replace、fork initialization 和本地 send mutation SHALL 通过 thread-local epoch 或等价机制串行化。旧请求完成后 MUST NOT 回退较新的本地 timeline 状态。

#### Scenario: Repair finishes after a new send
- **WHEN** 客户端因 gap 发起 snapshot repair
- **AND** 用户随后基于当前可用输入发送新消息
- **AND** repair 返回的是发送前状态
- **THEN** 客户端 MUST NOT 用该 repair replace 掉新发送的 optimistic entry
- **AND** 后续 timeline MUST 以新 turn 的事件流为准

# 设计

## 现状与根因

`onSend` 在请求前调用 `setThreadStatus(threadId, "active")`，使 ChatInput 在 start 期间禁止普通发送。请求抛错后，无论错误是 confirmed rejection 还是 start 已发出后的未知网络/5xx 结果，当前 catch 都执行 `setThreadStatus(threadId, "idle", null)`。`isAmbiguousStartError` 已能区分两类错误，但状态写入没有使用这个分类。

当服务端已接受 start 而响应丢失时，原 turn 可能仍在运行；idle 回退会使 `ChatInput` 的 `running` 变为 false，新的消息可在旧 turn 尚未确认结束时提交。该路径不依赖用户重复点击同一按钮，普通新消息即可触发。

## 决策

1. `ambiguous === true` 时不调用 `setThreadStatus(..., "idle")`，保留发送前设置的 active/running 状态。
2. `ambiguous === false` 时维持现有 confirmed rejection 行为，清理本地 active 状态并允许新的 identity。
3. 不在客户端猜测旧 turn 是否存在；现有 active summary 轮询、事件流和显式 ambiguous retry 负责从服务端收敛。
4. 不修改 `pendingSendKeysRef` 的 payload 去重；它仍只防止同一组件生命周期内相同 payload 的重复提交，线程级 fail-closed 由 running 状态负责。

## 状态流

```text
start requested -> active/running
       |
       +-- confirmed rejection -> rejected entry + idle + new identity allowed
       |
       +-- ambiguous result ----> ambiguous entry + active/running retained
                                  |
                                  +-- summary/event says idle -> idle and new send allowed
                                  +-- explicit retry -> same client identity recovery
```

## 风险与验证

- 若服务端实际未创建 turn，active 状态会暂时保守地阻止新发送；summary 轮询成功后会恢复 idle。这是 fail-closed 取舍，避免未知状态下重复执行。
- 测试必须断言 ambiguous 不写入 idle，confirmed rejection 仍写入 idle，并保留原有 identity 复用测试。

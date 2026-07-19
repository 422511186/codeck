## Context

`error` 通知同时表达两种不同状态：`willRetry=true` 表示 app-server 仍会继续当前 turn，`willRetry=false` 才表示本次 turn 已最终失败。当前实现将两者都 materialize 成 `role: "error"`，而成功完成只处理 reasoning/tool 的收尾，因此临时错误会残留在内存 overlay 和浏览器 store 中。

刷新时，服务端会将 overlay 合并到 bounded timeline page。普通 error 不属于 inline activity，`insertOverlayTimelineItem` 无法按 turn 锚定，遂走 append-to-tail 分支。

## Goals / Non-Goals

**Goals:**

- 临时错误在当前 turn 成功后从实时 timeline 和服务端 overlay 消失。
- 刷新或 bounded repair 不再恢复已成功 turn 的临时错误。
- 最终失败仍保留原始错误、失败用户消息和显式重试能力。
- 为 live success、refresh recovery、final failure 建立回归测试。

**Non-Goals:**

- 不修改上游 Responses 的重试次数、退避或 503 处理。
- 不把普通 EventSource reconnect 状态改成 turn error。
- 不改变 `willRetry=false` 的错误展示和用户重试动作。

## Decisions

### 临时错误只存在于 turn 生命周期内

服务端收到 `turn_error` 时，仅在 `willRetry=false` 时写入持久错误 overlay；`willRetry=true` 不创建可见错误项。这样成功完成无需依赖额外的历史删除协议，也避免刷新恢复时重放临时状态。

前端保持同样语义：`willRetry=true` 不写入 `body.kind = "error"`，但不改变 running 状态；最终失败仍走现有错误 entry 和失败用户消息逻辑。

### 成功完成提供防御性清理

即使旧版本或同一进程早已写入 `${turnId}-error`，服务端 `turn_completed` 和前端成功完成事件仍删除该 identity。该清理是幂等的，用于兼容升级期间的旧 overlay/store 状态。

### 最终错误继续使用固定 identity

`willRetry=false` 继续使用 `${turnId}-error`，保证实时事件、snapshot 和 turn detail 可以按同一 identity 去重；不引入新的错误条目类型。

## Risks / Trade-offs

- 重试期间用户不再看到红色“操作失败”卡片，但可从 running/reconnect 状态判断 turn 仍在进行；这是避免成功后残留错误的必要语义。
- 如果最终失败事件丢失，已有 bounded repair 和 summary reconciliation 仍负责恢复历史；本 change 不扩大 repair 范围。

## Verification

- store 测试覆盖 `willRetry=true` 后 `turn_completed` 不留下 error entry。
- runtime 测试覆盖 transient error 不进入 `listThreadTurns`，以及旧 overlay 在成功完成后被清理。
- 最终失败现有测试继续断言 error entry 和失败用户消息。

## Portable Test Decisions

### 测试脚本控制运行环境

`test` 和 `test:watch` 使用 `cross-env NODE_ENV=test`，测试行为不再继承开发机或部署 shell 的 `NODE_ENV=production`。

### 断言业务不变量而非平台表现

- app-server transport 测试检查受控 `codexBin`、`app-server --listen` 和 endpoint 参数存在且顺序正确，不固定实际 executable 是 `codex` 还是平台 wrapper。
- security 测试使用 `tmpdir()` 和 `join()` 构造绝对路径，不写死 `/tmp`、盘符或路径分隔符。
- catalog 初始化测试检查文件存在和持久化内容，不使用跨文件系统含义不一致的 POSIX mode 精确值判断。

### 测试不得读取开发机身份

fixture MUST 显式提供业务输入；断言不得依赖用户名、HOME、全局 Codex 配置、实际安装路径或当前操作系统分支。

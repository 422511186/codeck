# 大窗口自定义模型要求 Codex 权威目录支持

自定义模型配置的 `contextWindow` 是传给 app-server 的标称完整窗口，新建时默认为 `200000`，允许修改为 `1..1000000` 的安全整数。标称窗口不超过 `272000` 时允许未知模型使用 Codex fallback；超过 `272000` 时，创建或重配会话前必须确认模型标识精确存在于 app-server 的权威模型目录，否则拒绝执行并提示部署侧补充模型目录配置。turn 开始后，界面使用 app-server token usage 返回的实际窗口。

当前支持的 Codex `0.144.5` 对未知模型使用 `max_context_window = 272000`、`effective_context_window_percent = 95` 的 fallback 元数据。仅放宽 Web 输入上限会使更大的值被静默截断。`model_catalog_json` 又是 app-server 启动时加载的完整权威目录，不是可由 Web 按会话追加的模型列表，因此仍由部署侧维护，与 provider 配置采用相同的所有权边界。

## Consequences

Web 可以保存最大 `1000000` 的自定义模型标称窗口，但大于 `272000` 的配置在 app-server 不认识该模型时不可执行。模型出现在 app-server 目录中只能排除未知模型 fallback，实际窗口仍以运行时 token usage 为准；若部署目录声明的上限低于 Web 配置，当前会话必须同时呈现配置值与实际值并记录审计摘要，容量进度和后续安全判断使用实际值。系统不能自动修改目录配置或递增目录修订号；provider 改变并重建运行时后，旧的实际窗口观察失效。

系统继续不生成、修改或热重载 `model_catalog_json`。未来若 Codex 协议直接暴露模型上下文元数据或支持增量目录，再重新评估前置条件和可验证性。

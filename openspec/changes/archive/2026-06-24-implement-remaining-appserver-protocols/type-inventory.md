# app-server 剩余协议类型盘点

## 方法与类型

| Method | Params | Response / Notification |
| --- | --- | --- |
| `environment/add` | `EnvironmentAddParams` | `EnvironmentAddResponse` |
| `externalAgentConfig/detect` | `ExternalAgentConfigDetectParams` | `ExternalAgentConfigDetectResponse` |
| `externalAgentConfig/import` | `ExternalAgentConfigImportParams` | `ExternalAgentConfigImportResponse`、`ExternalAgentConfigImportCompletedNotification` |
| `feedback/upload` | `FeedbackUploadParams` | `FeedbackUploadResponse` |
| `marketplace/add` | `MarketplaceAddParams` | `MarketplaceAddResponse` |
| `marketplace/remove` | `MarketplaceRemoveParams` | `MarketplaceRemoveResponse` |
| `marketplace/upgrade` | `MarketplaceUpgradeParams` | `MarketplaceUpgradeResponse` |
| `mcpServer/tool/call` | `McpServerToolCallParams` | `McpServerToolCallResponse` |
| `plugin/installed` | `PluginInstalledParams` | `PluginInstalledResponse` |
| `plugin/share/save` | `PluginShareSaveParams` | `PluginShareSaveResponse` |
| `plugin/share/updateTargets` | `PluginShareUpdateTargetsParams` | `PluginShareUpdateTargetsResponse` |
| `plugin/share/list` | `PluginShareListParams` | `PluginShareListResponse` |
| `plugin/share/checkout` | `PluginShareCheckoutParams` | `PluginShareCheckoutResponse` |
| `plugin/share/delete` | `PluginShareDeleteParams` | `PluginShareDeleteResponse` |
| `thread/realtime/start` | `ThreadRealtimeStartParams` | `ThreadRealtimeStartResponse`、`ThreadRealtimeStartedNotification` |
| `thread/realtime/appendAudio` | `ThreadRealtimeAppendAudioParams` | `ThreadRealtimeAppendAudioResponse` |
| `thread/realtime/appendText` | `ThreadRealtimeAppendTextParams` | `ThreadRealtimeAppendTextResponse` |
| `thread/realtime/appendSpeech` | `ThreadRealtimeAppendSpeechParams` | `ThreadRealtimeAppendSpeechResponse` |
| `thread/realtime/stop` | `ThreadRealtimeStopParams` | `ThreadRealtimeStopResponse`、`ThreadRealtimeClosedNotification` |
| `thread/realtime/listVoices` | `ThreadRealtimeListVoicesParams` | `ThreadRealtimeListVoicesResponse` |

## 移动端 view 字段

- 环境、feedback、realtime 控制类空响应统一返回 `{ ok: true, ... }` 下的简短状态字段，例如 `added`、`accepted`、`started`、`stopped`。
- external agent config 保留 `items`、`importId`、导入成功/失败摘要，复杂 `details` 用 `MobileJsonValue` 透传。
- marketplace 保留 `marketplaceName`、`installedRoot`、`alreadyAdded`、`selectedMarketplaces`、`upgradedRoots`、`errors`。
- plugin installed/share 保留 marketplace 列表、load errors、remote plugin id、share URL、share principals、checkout 路径和列表项。
- MCP tool call 保留 `content`、`structuredContent`、`isError`、`_meta`。
- realtime voices 保留 `v1`、`v2`、`defaultV1`、`defaultV2`；realtime notification 保留 `threadId`、`realtimeSessionId`、`role`、`delta`、`text`、`audio`、`message`、`reason`。

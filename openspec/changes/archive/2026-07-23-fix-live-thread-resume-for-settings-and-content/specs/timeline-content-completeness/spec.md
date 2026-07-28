## ADDED Requirements

### Requirement: Full-content rehydrate recovers missing live thread
对 app-server content source 的 full-content 读取 SHALL 在 live thread 缺失时先 bare resume 再 rehydrate。content API MUST 在可恢复路径成功后返回正文 chunk；若 resume 后仍无法恢复 source，MUST 返回 scoped `repair-required`，MUST NOT 因 missing live thread 直接返回 502。

#### Scenario: Truncated content load after cold session
- **WHEN** 用户点击带有效 contentRef 的“读取完整内容”
- **AND** 对应 thread 尚未 live，首次 `thread/items/list` 失败为 missing-live-thread
- **THEN** gateway MUST bare resume thread
- **AND** MUST 重试 rehydrate
- **AND** 客户端 MUST 能拿到完整或后续 partial chunk

#### Scenario: Missing live thread does not surface as opaque 502
- **WHEN** content rehydrate 因 missing live thread 开始失败
- **AND** bare resume 后仍无法恢复
- **THEN** content API MUST 返回 200 且 chunk completeness 为 `repair-required`
- **OR** 返回明确可诊断错误
- **AND** MUST NOT 仅返回无上下文的 502 Bad Gateway

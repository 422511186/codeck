## ADDED Requirements

### Requirement: Image preview path constraints
系统 SHALL 支持通过 `/api/codex/images/preview` 预览图片。预览路径 MUST 通过 allowlist 校验，仅允许 `CODEX_WEB_WORKSPACE_ROOTS` 和 `CODEX_WEB_UPLOAD_DIR` 内的图片文件。系统 MUST NOT 默认允许整个系统临时目录作为图片预览根目录。

#### Scenario: Preview workspace image
- **WHEN** 已认证用户 GET `/api/codex/images/preview?path=<workspace-image>`
- **AND** path 位于 workspace allowlist 内且扩展名为 `.png`、`.jpg`、`.jpeg`、`.webp` 或 `.gif`
- **THEN** route MUST 返回对应图片内容和正确 content-type

#### Scenario: Preview uploaded image
- **WHEN** 已认证用户 GET `/api/codex/images/preview?path=<uploaded-image>`
- **AND** path 位于 `CODEX_WEB_UPLOAD_DIR` 内且扩展名为支持的图片类型
- **THEN** route MUST 返回对应图片内容和正确 content-type

#### Scenario: Preview tmpdir image rejected
- **WHEN** 已认证用户 GET `/api/codex/images/preview?path=<tmpdir-image>`
- **AND** path 不在 workspace roots 或 uploadDir 内
- **THEN** route MUST 拒绝该请求
- **AND** MUST NOT 读取该文件

#### Scenario: Preview unsupported extension rejected
- **WHEN** 已认证用户 GET `/api/codex/images/preview?path=<non-image>`
- **THEN** route MUST 拒绝该请求
- **AND** MUST NOT 读取该文件

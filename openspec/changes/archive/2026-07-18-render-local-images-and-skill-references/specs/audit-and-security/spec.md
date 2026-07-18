## ADDED Requirements

### Requirement: 图片预览校验真实文件路径
认证图片预览接口 SHALL 在词法路径白名单校验后解析候选文件和允许根目录的真实路径，并再次验证候选文件位于 canonical allowlist 内。接口 MUST 拒绝通过文件或目录符号链接逃逸允许根目录的请求，并 MUST 仅返回普通图片文件。

#### Scenario: 允许根目录内的普通图片
- **WHEN** 候选图片的词法路径和真实路径都位于允许根目录内且目标是普通受支持图片文件
- **THEN** 接口 MUST 返回图片内容与正确 MIME 类型
- **AND** 响应 MUST 包含 `X-Content-Type-Options: nosniff`

#### Scenario: 文件符号链接逃逸
- **WHEN** 允许根目录内的候选文件是指向允许根目录外图片的符号链接
- **THEN** 接口 MUST 拒绝请求
- **AND** MUST 不读取目标图片内容

#### Scenario: 目录符号链接逃逸
- **WHEN** 候选路径经过允许根目录内指向外部目录的符号链接
- **THEN** 接口 MUST 在真实路径二次校验时拒绝请求
- **AND** MUST 不读取目标图片内容

#### Scenario: 非普通文件
- **WHEN** 候选真实路径不是普通文件
- **THEN** 接口 MUST 拒绝请求

## ADDED Requirements

### Requirement: Uploaded local images preview through server API
用户在会话中上传的本地图片 SHALL 在远端浏览器中通过服务端预览 API 展示；前端 MUST NOT 把 Linux/POSIX 绝对本地路径误当作可直接访问的 Web URL。

#### Scenario: Linux absolute upload path
- **WHEN** 用户消息包含 `/home/.../uploads/<id>.png`、`/tmp/.../<id>.jpg` 或其他 Linux/POSIX 绝对本地图片路径
- **THEN** 图片缩略图 MUST 使用 `/api/codex/images/preview?path=...` 作为 `src`
- **AND** 浏览器 MUST NOT 直接请求该绝对路径对应的页面 URL

#### Scenario: Windows absolute upload path
- **WHEN** 用户消息包含 `C:\...` 或 `C:/...` 形式的 Windows 本地图片路径
- **THEN** 图片缩略图 MUST 使用 `/api/codex/images/preview?path=...` 作为 `src`
- **AND** 路径 MUST 被 URL encode 后传给 preview API

#### Scenario: Browser-native image URL
- **WHEN** 图片路径是 `blob:`、`data:`、`http:` 或 `https:` URL
- **THEN** 前端 MAY 直接使用该 URL 作为图片 `src`
- **AND** MUST NOT 再包一层本地文件 preview API

#### Scenario: Preview API enforces existing path policy
- **WHEN** 远端浏览器请求 `/api/codex/images/preview?path=...`
- **THEN** 服务端 MUST 继续使用现有工作区、上传目录和临时目录白名单校验路径
- **AND** 未授权路径 MUST 返回错误而不是读取文件

## 1. 测试基线

- [x] 1.1 为 route JSON 解析新增测试 helper，能够构造 authenticated malformed JSON、非对象 JSON、字段类型错误和有效 JSON 请求。
- [x] 1.2 增加 `/api/codex/skills/extra-roots` malformed JSON 回归测试，断言返回 HTTP 400 且不调用 `setSkillsExtraRoots`。
- [x] 1.3 增加代表性旧 route 回归测试，覆盖 `turns/start`、`threads/start`、`fs/file`、`process/spawn` 或等价高频 route 的 malformed JSON 返回 400。
- [x] 1.4 增加 `/api/codex/plugins/installed` 测试，覆盖 workspace 内 `cwds` 正常透传、workspace 外 cwd 返回 400、`cwds` 类型错误返回 400。
- [x] 1.5 增加图片预览测试，覆盖 workspace/uploadDir 内图片可读、tmpdir 外部图片被拒绝、非图片扩展名不读取文件。
- [x] 1.6 增加 app-server transport 测试，覆盖 malformed JSON-RPC frame 不产生未捕获异常、pending request 被拒绝、合法 frame 仍正常分发。

## 2. JSON Route 校验统一

- [x] 2.1 扩展 `src/app/api/codex/_route-helpers.ts`，提供严格 JSON object 读取、必填字段、严格字符串数组和 route validation 错误复用能力。
- [x] 2.2 迁移使用 `request.json().catch(() => ({}))` 的 route，移除吞错 fallback，确保 malformed JSON 返回 400 且不调用 app-server。
- [x] 2.3 迁移高频直接 `request.json()` 的 JSON body route，至少覆盖 turn/thread start、fs write/create/copy/remove/watch/search、process/command exec、request resolve、thread metadata/settings/name/goal/memory/items。
- [x] 2.4 将字段类型错误和必填字段缺失统一映射为 HTTP 400；保留 app-server 调用失败为 HTTP 502。
- [x] 2.5 确保所有迁移 route 在 JSON 解析和字段校验完成前不执行 audit，也不调用 app-server。

## 3. 路径和图片边界

- [x] 3.1 更新 `/api/codex/plugins/installed`，使用严格字符串数组校验 `cwds`，并逐项通过 workspace allowlist 校验后再调用 `plugin/installed`。
- [x] 3.2 更新 `src/server/image-preview.ts`，移除默认 `tmpdir()` 根目录，仅允许 workspace roots 和 uploadDir。
- [x] 3.3 确认 `turns/start` 的 `imagePaths` 仍只允许 workspace roots 和 uploadDir，不受图片预览收紧影响。

## 4. App-server JSON-RPC 隔离

- [x] 4.1 在 transport message handler 捕获 `JsonRpcPeer.handleMessage()` 抛出的解析错误。
- [x] 4.2 malformed frame 发生时拒绝 pending requests、关闭当前 socket，并设置可诊断的 app-server 状态或错误信息。
- [x] 4.3 保持合法 JSON-RPC response、notification 和 server request 的现有分发行为不变。

## 5. 验证和回归

- [x] 5.1 运行相关 Vitest 子集，覆盖新增 route、image-preview、transport 测试。
- [x] 5.2 运行 `npm run typecheck`。
- [x] 5.3 运行 `npm run test` 或项目约定的完整测试命令。
- [x] 5.4 运行 `openspec status --change harden-proxy-input-boundaries`，确认 artifacts 和任务状态可被 OpenSpec 识别。

## 1. 测试基线

- [x] 1.1 在 `tests/unit/web-thread-page.test.tsx` 增加会话打开重复读取、旧读取结果不得覆盖新状态、快照修复请求合并的失败测试
- [x] 1.2 在 `tests/unit/web-thread-page.test.tsx` 增加历史分页同 `cursor` 重复触顶只请求一次、失败后可重试的测试
- [x] 1.3 在 `tests/unit/web-thread-page.test.tsx` 和 `tests/unit/web-chat-input.test.tsx` 增加同一次发送动作只启动一个 turn、发送完成后相同文本可再次发送的测试
- [x] 1.4 在 `tests/unit/web-project-threads-page.test.tsx` 增加“新建会话”快速连点只创建一个 thread、失败后可重试的测试
- [x] 1.5 在会话页相关测试中覆盖归档和撤销归档的重复点击场景
- [x] 1.6 在会话页相关测试中覆盖压缩、中断、重命名的重复点击场景
- [x] 1.7 在会话页相关测试中覆盖模型、推理强度和 Plan/Build 模式设置的重复点击或乱序响应场景
- [x] 1.8 在会话页相关测试中覆盖模型列表和默认设置读取的重复请求或旧结果丢弃场景

## 2. 前端请求协调基础

- [x] 2.1 设计并实现轻量请求协调工具，支持按 key 复用 in-flight GET promise、取消旧请求或丢弃旧结果
- [x] 2.2 设计并实现动作级 mutation 锁，支持按资源和动作维度忽略或复用重复触发，并在失败后释放
- [x] 2.3 调整 `src/web/api/client.ts` 或调用层，使 `AbortError` 能作为正常取消路径处理，不向用户展示错误
- [x] 2.4 为请求协调工具补充 `tests/unit/web-api-client.test.ts` 或独立单元测试，覆盖复用、释放、失败重试和 abort 行为

## 3. 会话页接入

- [x] 3.1 将初始 `readThread`、快照修复 `readThread`、`listPendingRequests` 接入读取去重或取消机制
- [x] 3.2 为历史分页增加 `threadId + cursor` 级 in-flight 锁，避免滚动触顶重复请求同一页
- [x] 3.3 调整发送消息逻辑，确保同一次用户动作使用稳定 `clientUserMessageId`，并避免 payload 级去重误拦后续相同文本发送
- [x] 3.4 为 `notLoaded` 会话发送前的 `resumeThread` 增加同 `threadId` 去重，避免恢复请求被放大
- [x] 3.5 将 `codex.models()` 和 `codex.settings()` 相关读取接入读取去重或旧结果丢弃机制
- [x] 3.6 为中断增加动作级 pending 保护和失败后重试路径
- [x] 3.7 为归档和撤销归档增加动作级 pending 保护和失败后重试路径
- [x] 3.8 为压缩和重命名增加动作级 pending 保护和失败后重试路径
- [x] 3.9 为模型、推理强度和 Plan/Build 模式设置增加乱序防护，保证最终状态匹配用户最后选择

## 4. 项目和列表页接入

- [x] 4.1 为项目会话列表的 `startNewThread` 增加 pending 锁，快速连点只发起一次新建请求并只导航一次
- [x] 4.2 为项目会话列表读取增加必要的旧请求丢弃或取消，避免快速切换 active/archived tab 后旧结果覆盖新列表
- [x] 4.3 复查项目页 `refresh` 和添加项目校验，确保已有 `submitting` 保护覆盖失败重试并不会引入重复请求

## 5. 后端幂等兜底

- [x] 5.1 复核 `turn/start` 的 `clientUserMessageId` 幂等缓存，补充同 id 串行重复请求和失败后释放缓存的测试
- [x] 5.2 为 `threads/start` 增加可选 client operation id 幂等兜底，保持旧请求不传该字段时的现有行为
- [x] 5.3 补充 `threads/start` 路由单元测试，覆盖并发重复 operation id 返回同一个 thread、失败后允许重试

## 6. 验证

- [x] 6.1 运行相关单元测试：`npm run test -- tests/unit/web-thread-page.test.tsx tests/unit/web-project-threads-page.test.tsx tests/unit/web-chat-input.test.tsx tests/unit/web-api-client.test.ts tests/unit/codex-turn-start-route.test.ts`
- [x] 6.2 运行 `npm run typecheck`
- [x] 6.3 运行 `npm run test`
- [x] 6.4 手动检查移动端关键流程：打开会话、发送消息、重复发送相同文本、新建会话、滚动加载历史、归档/撤销、模式/模型快速切换

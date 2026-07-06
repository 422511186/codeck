## 1. 状态与缓存

- [x] 1.1 先补 `src/web/storage/contextUsage.ts` 的单元测试，覆盖按 `threadId` 读写、无效数据回退和清除行为。
- [x] 1.2 实现上下文用量本地缓存模块，并跑对应测试通过。
- [x] 1.3 先补 `tests/unit/web-store-events.test.ts`，验证 `token_usage_updated` 会更新线程级 `contextUsage` 并忽略无效窗口大小的显示条件。
- [x] 1.4 扩展前端 store 类型和事件处理，把 `token_usage_updated` 写入线程状态与本地缓存，并跑 store 测试通过。

## 2. Header 进度显示

- [x] 2.1 先补 `tests/unit/web-thread-page.test.tsx`，验证有上下文用量时 header 下方显示百分比，缺少窗口大小时不显示百分比。
- [x] 2.2 在会话页 header 下方实现上下文进度线、百分比标签和阈值颜色，并从 store/缓存恢复数据。
- [x] 2.3 跑会话页相关测试，确认 header 进度显示行为通过。
- [x] 2.4 根据实际反馈补充无历史用量时的可见未知占位条，并验证不会打开详情或伪造百分比。
- [x] 2.5 根据实际反馈补充 rollout JSONL 历史 `token_count` 恢复，并使用最近一次请求用量显示真实百分比。

## 3. 详情面板与压缩入口

- [x] 3.1 先补 `tests/unit/web-thread-page.test.tsx`，验证点击进度区域打开详情面板并展示 token 明细。
- [x] 3.2 先补 `tests/unit/web-thread-page.test.tsx`，验证详情面板点击「压缩上下文」会打开现有确认对话框，确认后调用现有 compact 接口。
- [x] 3.3 实现上下文用量详情面板，并复用现有压缩确认流程。
- [x] 3.4 跑会话页相关测试，确认详情和压缩入口行为通过。

## 4. 验证与收尾

- [x] 4.1 跑 `openspec validate show-context-window-progress --strict`，修复 artifact 问题。
- [x] 4.2 跑 `npm run typecheck`，修复类型问题。
- [x] 4.3 跑 `npm run test`，修复测试回归。
- [x] 4.4 检查 `git diff`，确认改动范围只包含本变更需要的 OpenSpec、状态/缓存、会话页和测试文件。

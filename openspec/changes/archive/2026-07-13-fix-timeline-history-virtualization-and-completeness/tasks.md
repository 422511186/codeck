## 1. 根因复现与架构门禁

- [x] 1.1 在 `tests/unit/web-timeline.test.tsx` 增加连续 activity、超长 Markdown 和动态高度混合时上滑空白的红灯测试，断言每个 scroll viewport 都挂载对应 render block
- [x] 1.2 增加 activity group 跨旧 entry window 边界的红灯测试，断言 group key、摘要和成员顺序稳定
- [x] 1.3 增加超过 5 页 turn item detail、UTF-8 多字节预算、session supplement 截断和 oversize realtime event 的红灯测试
- [x] 1.4 请求独立 subagent 评审 proposal/design/spec/tasks，只有 PASS 后才开始生产代码重构

## 2. Render Block 动态窗口化

- [x] 2.1 将 Timeline 数据流改为先派生全量轻量 `TimelineRenderBlock[]`，再按 block window 渲染，禁止先 slice entries 后分组 activity
- [x] 2.2 为 block 定义稳定 identity/version key 和按 kind 的 estimated height，确保 activity 成员 append 只更新所属 block
- [x] 2.3 实现 measured height cache、prefix height index 和 scroll offset 二分定位，移除 `scrollTop / ESTIMATED_TIMELINE_ROW_HEIGHT` 固定映射
- [x] 2.4 实现 viewport 前后 buffer、block spacer 和高度变化增量更新，保持挂载 row 数有界
- [x] 2.5 实现 block identity + intra-block offset 的 scroll anchor transaction，覆盖 prepend、测量变化、activity regroup、图片和长内容展开
- [x] 2.6 验证用户阅读历史时 live delta 不跳尾，贴底状态继续自动跟随且 jump-to-latest 行为不变

## 3. Completeness 与字节预算模型

- [x] 3.1 在共享类型中增加 item/page/response `TimelineCompleteness`、truncation metadata、opaque `contentRef` 和 content cursor
- [x] 3.2 增加统一 UTF-8 byte length、safe prefix/chunk 和预算工具，默认实现 item 96 KiB、page 1 MiB、response 2 MiB、event 256 KiB、content chunk 2 MiB
- [x] 3.3 在 timeline engine 中实现 completeness precedence，保证 complete 正文不被 partial/truncated snapshot 降级覆盖
- [x] 3.4 增加 completeness diagnostics，记录 item/page/event truncation、continuation、repair-required 和 full-content completion

## 4. 历史分页与 Continuation

- [x] 4.1 移除 `TURN_ITEM_DETAIL_MAX_PAGES = 5` 静默停止，持续读取到 source 结束或累计 response budget 达到上限
- [x] 4.2 让 thread snapshot、turn pagination 和 turn item detail API 返回 page completeness、nextCursor 和累计 bytes
- [x] 4.3 页面层保存 detail continuation，并在上滑、展开目标 turn 或 repair 需要时继续读取，禁止把 partial 标记为 reachedBeginning
- [x] 4.4 为 fallback `listThreadTurnItemsFromTurns` 增加明确扫描/bytes budget和 repair-required 返回，禁止 100 页后伪装为空完整结果
- [x] 4.5 实现 seen cursor、cursor loop 和零新增 identity/bytes 进展检测，异常时返回 scoped repair-required
- [x] 4.6 增加 6+ 页、跨页 sourceOrder、重复 cursor、cursor 失效和分页中断恢复测试

## 5. 长内容与 Oversize Event

- [x] 5.1 将 session timeline 的 `truncateToolText` 改为 preview + originalBytes/includedBytes/contentRef，保留 rollout path、record sequence 和 field locator
- [x] 5.2 为 app-server thread/turn/item source 建立 opaque contentRef resolver，禁止客户端提交任意文件路径
- [x] 5.3 新增受鉴权、workspace roots 和审计保护的 full-content chunk API，支持 cursor、bytes budget 和 repair-required
- [x] 5.4 在 SSE/WebSocket 发送前检查 payload bytes，oversize 可见事件改发保留 identity/order/revision/sequence 的 reference event
- [x] 5.5 客户端和 engine 合并 reference、completed、snapshot 和 full-content chunks，避免重复 preview 或完整正文降级
- [x] 5.6 在 agent/reasoning/tool/command/diff 卡片显示 truncated/partial 状态、读取完整内容、失败重试和完整复制语义

## 6. 差分与真实移动端验证

- [x] 6.1 增加同一 fixture 的 realtime full/reference event、snapshot partial/complete、detail continuation 和 full-content completion 差分测试
- [x] 6.2 增加 1000+ entries、长 activity runs、数 MiB 单 item 的 block 派生、layout index 更新和昂贵内容重算预算测试
- [x] 6.3 使用 iOS Safari 与 Android Chromium 目标手机 viewport 运行浏览器滚动脚本，采样从尾部到历史开头的截图和 canvas/DOM 像素，断言无纯空白 viewport、无重叠和 scroll anchor 跳动
- [x] 6.4 如浏览器验证依赖运行环境，更新并重启相关 Docker 服务，记录实际 URL、容器版本和验证步骤

## 7. 完整验证与归档

- [x] 7.1 运行 timeline、store、adapter、events、thread page、server app-client、session timeline 和 API route 定向测试
- [x] 7.2 运行 `npm run typecheck`、`npm run test` 和 `npm run build`，记录并区分既有跳过或无关失败
- [x] 7.3 运行 `openspec validate fix-timeline-history-virtualization-and-completeness --strict` 和 `git diff --check`
- [x] 7.4 对比 diagnostics 和浏览器证据，确认空白历史、5 页静默停止、无 metadata 截断和 oversize event 丢失均已消除
- [x] 7.5 请求独立 subagent 最终架构复核，只有 PASS 后才同步 specs 并归档 change

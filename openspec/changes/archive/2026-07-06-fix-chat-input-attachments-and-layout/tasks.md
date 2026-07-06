## 1. 回归测试先行

- [x] 1.1 为 ChatInput 图片多选和追加选择写失败测试，覆盖多张上传、逐张缩略图和发送 `imagePaths[]`
- [x] 1.2 为引用 Skill 后 idle `startTurn` 快照缺少 Skill 的场景写失败测试，覆盖 timeline 仍保留 Skill chip
- [x] 1.3 为 composer 高度变化写失败测试，覆盖 timeline 底部留白跟随实际高度更新

## 2. 多图上传实现

- [x] 2.1 将 ChatInput 图片状态从单图改为多图数组，并为每张图维护稳定 id、上传状态、preview URL 和 server path
- [x] 2.2 将隐藏文件 input 改为支持多选，选择图片时追加上传而非替换
- [x] 2.3 支持单张移除和单张重试；存在上传中或失败图片时禁止发送
- [x] 2.4 发送成功后清空所有图片，并把所有 ready 图片路径传给 `onSend`

## 3. Skill 引用 timeline 保留

- [x] 3.1 在 idle `startTurn` 快照 replace 前，将本地 optimistic 用户消息中的 `skillReferences` 和 `imagePaths` 合并到对应服务端用户消息
- [x] 3.2 确保匹配逻辑优先使用 `clientUserMessageId`、`turnId`，再使用本次发送文本唯一匹配，避免污染历史同文消息

## 4. 动态 composer 高度

- [x] 4.1 让 ChatInput 上报固定 composer 根节点实际高度
- [x] 4.2 会话页用实际 composer 高度设置 timeline `paddingBottom` 和“跳到最新”按钮 `bottom`
- [x] 4.3 当用户位于底部附近且 composer 变高时，保持最新消息可见

## 5. 验证

- [x] 5.1 运行相关单测：`tests/unit/web-chat-input.test.tsx`、`tests/unit/web-thread-page.test.tsx`
- [x] 5.2 运行 `npm run typecheck`
- [x] 5.3 运行 `openspec validate fix-chat-input-attachments-and-layout`

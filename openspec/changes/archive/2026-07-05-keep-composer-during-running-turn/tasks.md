## 1. 测试先行

- [x] 1.1 更新 `tests/unit/web-chat-input.test.tsx` 中 running 态断言：composer 保持可见，发送按钮隐藏，中断按钮显示并可调用 `onInterrupt`
- [x] 1.2 添加 running 态草稿测试：运行中输入文本后切回空闲态，草稿保留且可手动发送
- [x] 1.3 添加 running 态上下文准备测试：运行中可打开 `+` 添加面板并准备图片或 Skill，且不会触发 `onSend`

## 2. Composer 实现

- [x] 2.1 调整 `ChatInput` 渲染逻辑，移除 running 时整体返回状态栏的分支，保持 composer 主体渲染
- [x] 2.2 将主按钮逻辑拆为运行态中断按钮与空闲态发送按钮，运行态点击调用 `onInterrupt`
- [x] 2.3 调整禁用条件：running 时禁止标准发送，但不禁用文本输入、`+` 添加入口、图片选择、Skill picker 和状态 chip
- [x] 2.4 确保 running 态编辑的文本继续按 `threadId` 写入草稿，已选图片和 Skill 不因 running 状态变化被清空

## 3. 验证

- [x] 3.1 运行 `npm test -- tests/unit/web-chat-input.test.tsx` 验证输入区行为
- [x] 3.2 运行相关会话页测试，至少覆盖 `tests/unit/web-thread-page.test.tsx` 中发送和中断相关用例
- [x] 3.3 运行 `openspec validate keep-composer-during-running-turn --strict` 验证 change artifacts

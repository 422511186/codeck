## 1. 测试先行

- [x] 1.1 更新 `tests/unit/web-chat-input.test.tsx` 的运行态用例：断言运行态显示状态提示和「中断」按钮，不显示普通输入框、图片入口、全屏入口、发送按钮或重发入口。
- [x] 1.2 在 `tests/unit/web-chat-input.test.tsx` 增加普通输入框 `Enter` 发送用例：可发送文本按回车触发 `onSend`、阻止换行并清空草稿。
- [x] 1.3 在 `tests/unit/web-chat-input.test.tsx` 增加不可发送回车用例：空白、仅图片无文本、图片上传中或运行态按回车不得触发 `onSend`。
- [x] 1.4 保留并强化全屏编辑器测试：全屏编辑器中 `Enter` 插入换行、不触发发送；点击顶部「发送」仍发送全屏文本。
- [x] 1.5 增加图片入口保留用例：空闲态图片按钮可见并能打开/触发相册文件选择，已选图片仍按单张替换流程处理。
- [x] 1.6 增加重发能力用例：thread 静止且存在上一条 user 消息时仍可触发重发并填充输入框；运行态不显示重发入口。

## 2. ChatInput 状态与交互

- [x] 2.1 重构 `src/web/components/ChatInput.tsx` 的渲染分支：`running` 时返回运行态状态栏，空闲时返回 composer。
- [x] 2.2 调整空闲态 composer 布局，保持图片入口、普通输入框、全屏编辑入口和发送按钮为主路径；确保触控区适合手机。
- [x] 2.3 为普通输入框添加 `onKeyDown`：`Enter` 在可发送时触发标准发送流程，在不可发送时不提交；全屏编辑器键盘行为保持换行。
- [x] 2.4 保持图片上传、失败重试、移除、发送后清空和草稿恢复逻辑不变。
- [x] 2.5 调整重发入口为次级空闲态操作，确保不在运行态显示、不挤占发送按钮主位置，并继续复用现有 rollback 填充流程。

## 3. 会话页底部避让与视觉检查

- [x] 3.1 检查 `src/app/threads/[threadId]/page.tsx` 中 timeline `paddingBottom`、`jumpBtn`、toast 底部距离，确保新空闲态、运行态和图片缩略图状态不遮挡内容。
- [x] 3.2 确认移动端暗色主题下状态栏、停止按钮、图片按钮、发送按钮和输入框边界对比足够清晰。
- [x] 3.3 确认可访问标签匹配新行为：图片入口、全屏编辑、发送、中断、重发入口均有稳定 `aria-label` 或可读名称。

## 4. 验证

- [x] 4.1 运行 `npx vitest run tests/unit/web-chat-input.test.tsx`。
- [x] 4.2 运行 `npm run typecheck`。
- [x] 4.3 运行 `openspec validate improve-chat-input-composer --strict`。
- [x] 4.4 启动移动端 Web，用手机视口或浏览器移动端模拟检查空闲态、运行态、图片已选、上传失败、全屏编辑和回车发送路径。

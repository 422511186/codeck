## Context

会话页底部 composer 是固定定位，timeline 是独立滚动容器。当前滚动容器使用固定 `144px + safe-bottom` 作为底部留白，但 composer 会因为多行文本、已选图片和 Skill chip 变高，实际高度可能超过固定留白。

图片上传链路后半段已经支持 `imagePaths[]`：`ChatInput` 调用上传接口后把路径交给 `onSend`，`turn/start` 继续传给 app-server 的 `localImage` 输入。当前限制主要在 `ChatInput` 只保存单个 `image`，文件 input 只取 `files[0]`。

Skill 引用发送链路也已经支持结构化 `skillReferences`。问题在发送后处理 `startTurn` 返回的 idle thread 快照时，页面使用 replace 模式整体替换 timeline；如果服务端快照里的 user item 不包含本地选择的 Skill 引用，已经渲染出来的本地 Skill chip 会被覆盖。

## Goals / Non-Goals

**Goals:**

- 支持一次选择多张图片，并在本次消息中累积多张待发送图片。
- 保留现有单图上传 API，通过逐张上传复用安全校验、审计和上传目录逻辑。
- 发送引用 Skill 的消息后，timeline 必须保留并显示本地发送上下文。
- composer 高度变化时，timeline 底部留白和悬浮按钮位置必须跟随实际高度，避免最后消息被遮挡。
- 用回归测试覆盖多图、Skill 快照覆盖和动态底部留白。

**Non-Goals:**

- 不新增批量上传后端接口。
- 不允许仅图片无文本发送；发送规则保持不变。
- 不改变 app-server 协议、Skill 列表 API 或图片预览 API。
- 不做桌面端布局适配。

## Decisions

1. 多图上传使用“前端多选 + 现有接口逐张上传”。

   备选方案是新增批量上传 API，一次 formData 提交多张图片。当前后端单图保存、清理、审计都已稳定，逐张上传能最小化后端改动，并且每张图可以独立展示上传中、失败和重试状态。代价是多图会发起多个请求，但移动端一次发送图片数量通常较小，风险可接受。

2. `ChatInput` 图片状态从单个对象改为数组。

   每张图片拥有稳定本地 id、`File`、preview URL、上传状态和 server path。再次通过相册选择图片时追加到数组而不是替换；移除和重试只作用于单张图片。发送时只有所有图片都 ready 才可发送，失败图片保留重试入口。

3. Skill 和图片上下文在页面应用 idle 快照时补回。

   store 的 merge 路径已有“服务端用户消息缺少本地附件时保留上下文”的逻辑，但 idle `startTurn` 快照当前走 replace。实现时在 replace 前针对本次刚发送的 optimistic user message 合并服务端 user entry，匹配优先级为 `clientUserMessageId`、`turnId`、唯一文本。这样不扩大 store 的全局替换语义，也避免同文历史消息误合并。

4. composer 实际高度由组件上报给页面。

   `ChatInput` 使用 `ResizeObserver` 观察固定底栏根节点高度，通过回调传给 thread page。thread page 用该高度计算 timeline `paddingBottom` 和“跳到最新”按钮 `bottom`。当用户原本处于底部附近时，高度增加后自动滚到底，避免输入变高时最新消息留在遮挡区。

## Risks / Trade-offs

- 多图逐张上传可能部分成功、部分失败 → 每张图单独展示状态；只要有上传中或失败图片，发送按钮保持不可用。
- 服务端快照可能没有 `clientUserMessageId` → 使用 `turnId` 和唯一文本作为后备匹配；只在本次发送上下文内补回，降低误匹配范围。
- `ResizeObserver` 在测试环境或旧浏览器中可能不可用 → 提供初始保守高度，并在没有 observer 时保持现有可用布局；测试可通过 mock/回调验证。
- composer 高度频繁变化可能触发多次 state 更新 → 只在高度数值变化时更新，并限制为整数像素，避免无意义重渲染。

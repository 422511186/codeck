## 1. 项目基础与依赖

- [x] 1.1 在 `package.json` 中加入前端依赖：markdown 渲染器（`react-markdown` + `remark-gfm`）、mermaid 渲染器（`mermaid`）、diff 渲染（`diff` 或 `react-diff-viewer-continued`）、代码高亮（`highlight.js` 或 `shiki`）；版本固定到具体小版本。
- [x] 1.2 在 `next.config.mjs` 中确认 `app` 路由开启，并允许 `src/app/(mobile)/` 子树作为前端入口。
- [x] 1.3 在 `tsconfig.json` 中确认前端代码路径的别名（如 `@/web/*`），避免和现有 `src/server`、`src/shared` 混淆。
- [x] 1.4 在 `src/web/` 下新建目录骨架：`api/`、`ws/`、`storage/`、`components/`、`hooks/`、`pages/`（或直接落到 `src/app/(mobile)/`）。
- [x] 1.5 编写 README 或 `docs/frontend.md` 简短说明：前端目录结构、调用规则、不允许在 `src/server` 引入前端代码、不允许在 `src/web` 直接 import app-server 类型（只通过 `src/shared`）。

## 2. 前端共享基础设施

- [x] 2.1 实现 `src/web/api/client.ts`：fetch 封装，统一处理 cookie、401 跳转、`{ ok, error }` 响应裁剪、JSON 解析、超时。
- [x] 2.2 为 `src/web/api/client.ts` 写单元测试：401 触发跳转回调、非 2xx 抛错、`ok=false` 抛错并保留 `error` 文案。
- [x] 2.3 实现 `src/web/ws/client.ts`：WebSocket 单例连接管理，支持订阅 `hello` / `health` / `codex-event` / `server-request` / `server-request-resolved`；支持无限重试、可读的连接状态机（connecting / open / closed / reconnecting）。
- [x] 2.4 为 WS client 写单元测试：连接断开自动重连、订阅事件 dispatch 正确、unsubscribe 不再收到事件。
- [x] 2.5 实现 `src/web/storage/localStore.ts`：封装 localStorage 读写、命名空间前缀（如 `codex-web:`）、JSON 序列化、写失败容错。
- [x] 2.6 实现 `src/web/state/`：会话 timeline 内存缓存、当前 active thread / running 状态、未发送草稿、Plan/Build 状态等。建议用轻量 store（Zustand 或自写 hook）。
- [x] 2.7 实现 `src/web/theme/`：CSS variables 跟随系统 `prefers-color-scheme`；定义颜色、间距、字号、卡片样式 token。

## 3. mobile-web-shell（登录、路由、断线、Session、过渡）

- [x] 3.1 实现登录页 `app/(mobile)/login/page.tsx`：Logo 纯文字 + token 输入框 + 登录按钮；错误时输入框下显示红字。
- [x] 3.2 登录页对接 `POST /api/auth/login`，成功后跳转 `next` 参数或 `/projects`。
- [x] 3.3 实现路由守卫：未登录访问 `/projects`、`/projects/:projectId`、`/threads/:threadId` 时跳转 `/login?next=<原 URL>`。
- [x] 3.4 实现路由布局 `app/(mobile)/layout.tsx`：顶部断线细横幅（监听 WS 状态机，状态 != open 时展示「网络已断开，重连中…」）、iOS 风格右进左出过渡。
- [x] 3.5 实现「session 失效」处理：API client 401 时清除前端 session 状态、保留来源 URL、跳回 `/login?next=...`。
- [ ] 3.6 写组件测试：路由守卫、断线横幅显隐、登录页错误展示、session 失效跳转。

## 4. project-management（项目页）

- [x] 4.1 设计 localStorage 项目数据形态：`{ id, path, alias, addedAt, lastUsedAt }[]`。在 `src/web/storage/projects.ts` 中实现 CRUD。
- [ ] 4.2 为项目存储写单元测试：添加去重（path 相同视为同一个项目）、移除、重命名、更新 lastUsedAt、按 lastUsedAt 倒序读取。
- [x] 4.3 实现 `app/(mobile)/projects/page.tsx`：列表（路径 + 时间 + 会话数）、悬浮 + 按钮、长按出菜单（重命名 / 移除）、空状态（插画 + 大按钮）、右上角 ⚙️。
- [x] 4.4 实现「会话数」获取：调用 `GET /api/codex/threads?cwd=<path>` 或本地聚合（依据后端最终能力，必要时在 design 层补一段约定）。
- [x] 4.5 实现「添加项目」交互：手输路径，提交时调用 `GET /api/codex/threads?cwd=<path>` 进行 allowlist 校验；成功后写入 localStorage、跳到该项目会话列表。
- [x] 4.6 实现「重命名项目」弹窗输入；保留默认目录名作为可还原值。
- [x] 4.7 实现「移除项目」直接移除，不弹确认（threads 不受影响）。
- [ ] 4.8 写组件 + 集成测试：项目列表渲染、添加流程、添加路径不合法时回填错误、移除项目后入口消失但 thread 数据保留。

## 5. thread-list-view（项目内会话列表）

- [x] 5.1 实现 `app/(mobile)/projects/[projectId]/page.tsx`：列出该项目 cwd 下的会话；tab 切换「进行中 / 已归档」。
- [x] 5.2 实现会话条 UI：会话名（一行省略）+ 最后一条 user 消息（一行省略）+ 时间或「正在运行」。
- [x] 5.3 接入 `GET /api/codex/threads?cwd=<path>&archived=<bool>&cursor=...`：分页/排序（最后活动时间倒序，归档 tab 按归档时间倒序）。
- [x] 5.4 在列表空状态展示「提示 + 大按钮」；加载用骨架屏。
- [x] 5.5 实现悬浮 + 按钮跳到新会话；点击会话条进入 `/threads/:threadId`。
- [ ] 5.6 写组件测试：tab 切换、列表条文案截断、空状态、运行中标识。

## 6. thread-chat-view（会话页基础）

- [x] 6.1 实现 `app/(mobile)/threads/[threadId]/page.tsx`：sticky 头部（返回 + 会话名两行省略 + Plan/Build segmented + 模型 + ⋮）。
- [x] 6.2 接入 `GET /api/codex/threads/:threadId` + `GET /api/codex/threads/:threadId/turns`：初始化 timeline。
- [x] 6.3 实现 timeline 渲染基础：用户消息（通栏 + 左侧色条）、agent 消息（通栏）、纯背景 + 浅底气泡、相对时间。
- [x] 6.4 实现「进入会话直接滚到最新」+「用户向上滚后出现『跳到最新』浮动按钮」+「用户在底部时新消息自动滚」。
- [x] 6.5 实现历史无限滚动：scroll 触顶 → 拉 `turns?cursor=...` → 顶部细 spinner → 没有更早时显示「会话开始」分隔线。
- [x] 6.6 实现 WS 增量：订阅 `codex-event`，按 turn / item 增量更新 timeline；timeline 切换会话使用内存缓存。
- [x] 6.7 实现「错过期间全量回填」：进入会话或 WS 重连后用 `turns?cursor=<last seen>` 拉补齐再叠 WS 增量。
- [x] 6.8 实现「中央 spinner」加载状态；turn 已结束、agent 静止时清除 running 标记。
- [x] 6.9 实现用户消息长按出菜单（复制等）。
- [x] 6.10 实现 markdown 渲染：`react-markdown` + `remark-gfm`，全量；不渲染 LaTeX；渲染 mermaid 代码块；代码块满宽 + 横向滑动、右上角复制按钮。
- [ ] 6.11 写组件测试：自动滚策略、跳到最新按钮显隐、历史加载顺序、长按菜单。

## 7. agent-output-rendering（折叠卡片家族 + 计划条）

- [x] 7.1 实现卡片基类组件：折叠默认 + 就地展开 + 标题行（图标 + 摘要）+ 展开内容容器；统一同高。
- [x] 7.2 实现命令卡片：折叠态只显示命令；右侧 spinner + 「运行中」；失败时左侧红色色条；展开后完整输出 + 限制最高 N 行可滚。
- [x] 7.3 实现 diff 卡片：折叠态显示文件路径 + 行数变化；展开后 unified diff；多文件每个一张卡片；纯展示无操作。
- [x] 7.4 实现推理（reasoning）卡片：跑中显示「思考中…」+ 微动效；跑完后保留为可展开「推理过程」卡片。
- [x] 7.5 实现 MCP / 工具调用卡片：复用命令卡片样式。
- [x] 7.6 实现顶部固定「计划条」：消费 `plan_delta`，sticky 在 timeline 顶部、会话头部下方；可手动折叠默认展开；步骤完成打勾 + 灰色；纯展示不可点击。
- [x] 7.7 实现「系统消息」样式：居中细线 + 灰色小字；覆盖压缩上下文完成、Plan→Build 切换提示、错误事件等。
- [x] 7.8 实现错误卡片：所有 turn 错误 / warning 用统一内嵌错误卡片；不带任何操作按钮（不做重试）。
- [x] 7.9 实现「微动效」：思考中、运行中等临时状态的轻度动画；遵循 `prefers-reduced-motion`。
- [ ] 7.10 写组件测试：每种卡片折叠/展开、运行/完成/失败状态、计划步骤增量更新。

## 8. approval-inline-cards（审批）

- [x] 8.1 实现审批卡片组件：根据 `server-request.request.kind` 渲染 command_approval / file_approval / permissions_approval / question / mcp_elicitation / dynamic_tool 各自所需信息。
- [x] 8.2 实现「拒绝 / 同意」按钮：无默认聚焦；点击后调用 `POST /api/codex/requests/:requestId/resolve`。
- [x] 8.3 实现失效审批的灰化：监听 `server-request-resolved` 事件；若 turn 已结束也视为失效。
- [x] 8.4 实现进入会话时调用 `GET /api/codex/requests` 拉取既有的待审批，再叠 WS 增量。
- [x] 8.5 多张审批 timeline 中依次内嵌渲染。
- [ ] 8.6 写组件测试：审批 resolve 成功路径、resolve 失败路径、失效灰化、多审批并存。

## 9. chat-input-area（输入区）

- [x] 9.1 实现底部输入区：固定单行；高度限制最高 3 行；超过后内部滚动；草稿按会话保存到 localStorage。
- [x] 9.2 实现「发送按钮」：禁止空消息；点击调用 `POST /api/codex/turns/start`；agent 跑中变为「■ 中断」按钮调用 `POST /api/codex/turns/:threadId/interrupt`。
- [x] 9.3 实现「中断后」立即恢复输入；turn 仍未完全结束时仍允许输入但发送在 turn 真正结束后才生效（或直接 enable，按 design 选定的方案）。
- [x] 9.4 实现「↺ 重发上一条」按钮：仅在静止 + 存在可重发的上一条 user 消息时显示；点击 → 调用 `POST /api/codex/threads/:threadId/rollback` + 把原文充填进输入框（不自动发送）。
- [x] 9.5 实现「⤢ 全屏编辑器」：右侧图标触发；全屏顶 nav（取消 / 发送）+ 全屏输入区；回车键不发送。
- [x] 9.6 实现图片入口：输入框左侧图标 → 系统相册选图（`<input type="file" accept="image/*">`）；只支持单张；选完后缩略图叠在输入框上方，可 ✕ 移除。
- [x] 9.7 实现图片上传流程：先调用 `POST /api/codex/uploads/images`，得到 path；发送 turn 时把 path 放入 `imagePaths`；上传中缩略图盖进度环；失败缩略图变红，点击重试。
- [x] 9.8 实现 `turns/start` 失败时：用户消息变红 + 重试按钮（重试时复用同一份 imagePaths）。
- [x] 9.9 实现 timeline 中图片呈现：缩略图；点击全屏预览。
- [ ] 9.10 写组件测试：草稿保存、空消息禁用、中断流程、全屏编辑器、重发按钮显隐、图片上传成功/失败路径。

## 10. thread-controls（Plan/Build、模型、底部抽屉）

- [x] 10.1 实现头部 Plan/Build segmented：每会话独立；状态存内存 + 同步到后端会话设置（`POST /api/codex/threads/:threadId/settings`）；切换只影响下一条 turn。
- [x] 10.2 实现新会话默认 Build；不做发送时二次确认。
- [ ] 10.3 实现 Plan 末尾「转 Build 执行」按钮：点击 → 切换 Plan/Build + 自动追加重新执行；只显示薄警告标识，不弹确认对话框。
- [x] 10.4 实现头部模型显示 + 切换：点击进入模型选择器；每次打开切换器时调用 `GET /api/codex/models` 拉最新列表；选择后调用 `threads/:threadId/settings` 更新会话模型。
- [x] 10.5 实现 ⋮ → 底部抽屉：重命名 / 归档 / 压缩上下文 / Fork。
- [x] 10.6 实现「重命名」弹窗输入：调用 `POST /api/codex/threads/:threadId/name`。
- [x] 10.7 实现「归档」：抽屉立刻关闭 + 底部 toast +「撤销」按钮（调用 `unarchive`）；列表立即移除。
- [x] 10.8 实现「压缩上下文」：弹确认对话框 → 调用 `POST /api/codex/threads/:threadId/compact`；进行中禁用输入框；完成后 timeline 插入系统消息。
- [x] 10.9 实现「Fork」：点即调用 `POST /api/codex/threads/:threadId/fork`，继承原会话 Plan/Build 和模型；跳转到新会话。
- [ ] 10.10 实现会话名自动生成：第一条 user 消息发送成功后，用首句调用 `threads/:threadId/name` 写入名字；之前在列表里显示「新会话」占位。
- [ ] 10.11 写组件测试：Plan/Build 切换、模型切换、底部抽屉各项、归档 + 撤销、压缩上下文流程。

## 11. settings-minimal（设置页）

- [x] 11.1 实现 `app/(mobile)/settings/page.tsx`：四个分组 = 默认模型与模式、账号、Token 用量、登出 Web。
- [x] 11.2 「默认模型与模式」：本地默认值存 localStorage；模型列表通过 `GET /api/codex/models` 拉；模式 = Plan / Build。
- [x] 11.3 「账号」：调用 `GET /api/codex/account/auth-status` 展示 Codex 账号状态；不在此处做账号登录入口（保持最小集）。
- [x] 11.4 「Token 用量」：调用 `GET /api/codex/account/token-usage` 展示当前用量。
- [x] 11.5 「登出 Web」：清除 session cookie（前端调用本项目登出方式，或在缺失时调用 `POST /api/auth/login` 反向，由 design 决定）；跳回 `/login`。
- [ ] 11.6 写组件测试：模型/模式持久化、默认值在新会话生效、登出后回到登录页。

## 12. 集成与验收

- [ ] 12.1 全流程端到端：登录 → 添加项目（路径校验） → 创建会话 → 发送消息 → 收到 agent 输出 → 审批 → 中断 → 重发 → 归档 → 撤销 → 压缩上下文 → 退出登录。
- [ ] 12.2 网络断/连：手动断开 WS（如关闭后端再启动）确认顶部横幅出现 → 自动重连后消失 → timeline 全量回填正确。
- [ ] 12.3 弱网 / 切后台模拟：浏览器开发者工具 throttle + 切 tab，确认 WS 重连和会话回填行为符合预期。
- [ ] 12.4 主题：分别用 `prefers-color-scheme: light` 和 `dark` 模拟，确认颜色 token 在两种主题下都可读、对比度足够。
- [ ] 12.5 真机回归：在 iOS Safari 和 Android Chrome 上至少各跑一次「全流程端到端」。
- [x] 12.6 跑 `npm run verify`：TypeScript 类型 + 单元测试通过。
- [ ] 12.7 更新 `README.md` / `docs/backend-api.md`：把前端入口、路由、localStorage key 命名空间补到文档；标注哪些后端 API 在 v1 前端中未使用，作为未来可扩展点。

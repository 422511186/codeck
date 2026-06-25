## Context

仓库现状：

- 后端是 Next.js 自定义 server，已经把 Codex app-server 的 114 个 HTTP route 和实时事件桥接到 `/api/codex/*` 与 `/ws`。
- 鉴权走 `CODEX_WEB_ACCESS_TOKEN` + 签名 cookie，session 失效是常态（个人模式后端可能随时重启）。
- 工作区路径受 `CODEX_WEB_WORKSPACE_ROOTS` allowlist 限制；后端不存「项目」这个概念，threads 直接以 `cwd` 为单位组织。
- 前端零基础：仓库已经移除所有旧 UI、组件、原型、E2E 测试。
- 目标用户是「自己」，使用场景是路上、沙发、离开工位时用手机继续推进多个 Codex 任务。

参考系：opencode 的 web app（桌面 IDE 风格的多面板）只取其聊天 + agent 执行视图 + 审批 + diff 的语义部分，**全面剪裁为移动端单栏**。

约束：

- 只做移动端 web，不做桌面布局，不做原生 app。
- 没有 Web Push、不做后台通知，所有同步发生在用户回到 web 时。
- 不做语音/Realtime、Share 公开链接、文件树、独立 PTY、跨会话 inbox。

## Goals / Non-Goals

**Goals:**

- 在手机浏览器里完成「打开 web → 选项目 → 进入会话 → 发指令 → 看 agent 干活 → 审批 → 中断/重发」完整闭环。
- 让用户**一眼看清「我离开期间发生了什么」**：会话列表上看到运行中状态和最后一条用户消息，进入会话直接到最新。
- 把所有 agent 流式输出（命令、diff、推理、MCP、计划）以**默认折叠卡片**呈现，让小屏不被长输出淹没。
- 让前端**容忍 WS 断连**：网络/锁屏/切换后台是常态，重连后用 turns API 全量回填，timeline 不丢消息。
- 把 Plan/Build 做成**会话级的显式开关**，让用户敢在路上用 Plan 思考、停在工位才切 Build 改文件。

**Non-Goals:**

- 不为桌面浏览器做布局，不做响应式宽屏。
- 不做 Web Push、Service Worker、PWA 离线缓存。
- 不暴露 ster、Realtime、文件浏览/编辑、独立 PTY、Share、跨会话审批 inbox。
- 不实现新的后端能力。前端只消费现有 `/api/codex/*` 和 `/ws`。
- 不做会话/项目级别的搜索。
- 不持久化前端业务数据到后端（项目列表、别名、草稿都走 localStorage）。

## Decisions

### D1. 应用形态：移动端单栏 Companion Chat

聊天是主轴，所有 agent 行为（命令、diff、推理、MCP、计划、审批）流入 timeline，作为可折叠卡片。不做侧栏、IDE 多面板、tab 分屏。

理由：

- 手机屏不能承载 opencode web app 的多面板布局；强行做会出现「什么都能做但什么都不顺手」。
- 个人自用，单会话深度对话 + 多会话切换是主路径，聊天形态最贴。

替代方案：

- Mission Control 任务中心（首屏审批 inbox）—— 没有 Web Push 加持，inbox 价值打折，砍掉。
- Voice-first—— 用户明确不要语音，砍掉。

### D2. 三层导航 + 三个 URL

```
登录页 /login
   ↓
项目页 /
   ↓
项目内会话列表 /p/<projectId>          (tab: active | archived)
   ↓
会话聊天页 /p/<projectId>/t/<threadId>
   ↓
设置页 /settings
```

每一页都有独立 URL，浏览器刷新或复制链接保持当前位置。`projectId` 是 localStorage 中分配的本地 id，不依赖后端。

理由：浏览器后退/刷新/直链是手机 web 必须保证的基本盘。扁平路径比嵌套路由更容易在客户端 router 里做权限和过渡动画。

### D3. 「项目」是前端 localStorage 概念，不在后端

- 项目 = `{ id, name, path, addedAt, lastUsedAt }`。
- `path` 是工作区路径，等于后端 `cwd`；后端不知道「项目」存在。
- 项目内会话列表用 `GET /api/codex/threads` 拉全量，前端按 `cwd === project.path` 过滤。
- 别名 `name` 默认取 `path` 的最后一段目录名，用户可重命名。

理由：

- 后端是个人模式，没有项目这一层抽象，引入需要后端落库，不划算。
- 用户的「项目」是主观选择（哪些目录值得我从手机管理），不应该自动从 thread 聚合。
- localStorage 在手机浏览器上很稳定，单设备使用不需要跨端同步。

替代方案：

- 从 thread cwd 自动聚合 → 用户拒绝（之前问过）。
- 后端落库 → 工程量大，没必要。

### D4. WS 断连与对账：全量回填 + 内存缓存

```
连接生命周期：
  打开 web ──▶ 检查 session ──▶ 拉项目 ──▶ 进项目 ──▶ 拉 threads
                                                                            │
                                                                            ▼
                                                                  打开某个会话
                                                                            │
                                                                            ▼
                              首次进入：GET /turns（首页）；建立 /ws；订阅当前会话
                                                                            │
                                                                            ▼
                              用户切走 / 锁屏 → WS 断（前端不主动关）
                                                                            │
                                                                            ▼
                              切回 → 顶部「网络已断开，重连中…」横幅
                                                                            │
                                                                            ▼
                              WS 重连成功 → 立即拉 /turns 全量回填到最新
                                                                            │
                                                                            ▼
                              横幅消失，timeline 显示最新位置
```

- WS 重连：**无限重试**，指数退避（建议 1s → 30s 上限）。
- 重连后**总是触发一次 `GET /threads/:id/turns`** 全量回填，不依赖 WS 自身的事件回放。
- 不做 HTTP 轮询兜底；WS 断时只展示已缓存内容 + 横幅。
- timeline 数据：**内存缓存**当前会话，切走再回不重新拉。会话切换不缓存上一个（避免内存膨胀）。

理由：

- 手机切后台是常态，WS 一定会断，必须假设它不可靠。
- 「全量回填」比「靠 WS 增量补全」简单、容错强；后端 `GET /turns` 已经分页。
- 不做轮询：增加后端压力 + 复杂度，没必要。

### D5. Plan/Build 是会话级，存在 thread.settings 里

- 头部 segmented 控件切换；新会话默认 Build。
- Plan 模式 = 给 `POST /turns/start` 传保守 permissions（具体值在 specs 里）。
- Build 模式 = 让 agent 真改文件（`workspace-write` 之类）。
- 切换**只影响下一条 turn**，不打断当前 turn。
- Plan 末尾消息后**追加「转 Build 执行」按钮**，点击 = 切到 Build + 自动发一条「请按上面的计划开始执行」。
- Plan → Build 时**加薄警告条**（「Build 模式会真改文件」），但不弹确认。

理由：

- 用户敢不敢在手机上发指令，决定于他敢不敢相信 agent 不会乱改。Plan 模式是这个信心的开关。
- 不弹确认：每次发送都问会很烦。薄警告条够了。

### D6. 长内容统一折叠卡片

```
agent timeline 上的「卡片」家族：
  · 命令卡片        [▶ npm test]                展开 = 完整输出
  · diff 卡片        [src/auth.ts +3 -1]         展开 = unified diff
  · 推理卡片        [🧠 思考中…]                展开 = reasoning 全文
  · MCP 工具卡片  [🔧 filesystem.read]    展开 = arguments + result
  · 计划条           顶部 sticky                       可折叠默认展开
  · 错误卡片        [⚠ command failed]      展开 = stderr
  · 系统消息       居中细线 + 灰色小字       压缩、Plan→Build 切换
```

每张卡片**就地展开**（不弹 sheet、不跳详情页）。展开后内容超 N 行内部滚动。

理由：

- 手机上每跳一层都是体验损失。就地展开是最少跳转的方案。
- 默认折叠让 timeline 信息密度可控；用户感兴趣再点开。

替代方案：bottom sheet 详情 → 切换次数多，砍掉。

### D7. 底部输入：单行 + ⤢ 全屏 + 草稿存 localStorage

- 默认单行，最高 3 行（之后内部滚动）。
- 右侧 ⤢ 图标弹出全屏编辑器：顶 nav（取消 / 发送）+ 全屏文本区，回车键插入换行，必须点「发送」。
- 左侧 📎 图标 = 相册选图（单张、`accept="image/*"`，不调相机）。未发送的图叠在输入框上方缩略图。
- 草稿：**按会话存 localStorage**，切走/切换会话保留，发送后清空。
- 发送按钮规则：
  - 静止 + 有内容 = 发送
  - 静止 + 空 = 禁用
  - agent 跑中 = 变为 ■ 中断
- 中断后输入框立刻可用。
- 重发按钮（↺）：放在发送按钮旁；只在静止 + 有可重发的上一条 user 消息时显示；点击 = 调用 rollback 1 turn + 把原文填入输入框。

理由：

- 手机上长文本必须全屏写；单行节省屏幕空间。
- 草稿丢失是手机典型痛点（切后台被系统杀），localStorage 解决。
- 中断按钮取代发送：保证「同一时刻只暴露当前可做的动作」。

### D8. 审批：内嵌卡片，不做 inbox

- WS 推送 `server-request` 时在 timeline 当前位置插入审批卡片。
- 多张审批连续出现 = 依次内嵌（不合并、不折叠）。
- 卡片有「拒绝 / 同意」两个按钮，无默认聚焦。
- 审批一旦失效（turn 结束或被外部解决）= 标灰 + 不可操作，保留在 timeline 作为历史。
- 不做跨会话审批 inbox（首屏不放审批徽标）。

理由：

- 没有 Web Push，跨会话 inbox 的价值大幅下降（用户必须主动回来），而内嵌卡片在「回到会话看进展」这条主路径上更自然。
- 失效卡片保留：审计语义重要，agent 跑过的轨迹完整保留。

### D9. 错误统一为内嵌错误卡片，不带重试

`codex-event` 里的 `warning`、turn 异常、命令失败、MCP 失败、外部错误全部以**居中错误卡片**形式插入 timeline。错误卡片不带重试按钮（重发由底部输入区的「↺ 重发上一条」承担）。

例外：

- 用户发送动作失败（`POST /turns/start` 失败、`POST /uploads/images` 失败）= **就近**反馈：用户消息变红 + 重试按钮；图片缩略图变红 + 点击重试。

理由：

- 「agent 这边出错」和「我发送出错」是两类用户心理模型，分别处理：前者是 timeline 上的历史，后者是「我要立刻处理」。

### D10. 视觉与主题

- 主题：跟随系统（CSS `prefers-color-scheme`），不做手动切换。
- 用户消息：通栏 + 左侧色条；agent 消息：通栏；都不显示头像和用户名。
- 时间：每条消息显示相对时间，超过一天后仍用相对时间。
- 代码块：满宽 + 横向滑动，右上角复制按钮。
- markdown：全量渲染；mermaid：渲染；LaTeX：不渲染。
- 临时状态有微动效（spinner / 脉冲），不要过度。

### D11. 列表数据策略

- 项目列表：localStorage，按 `lastUsedAt` 倒序。
- 项目内会话列表：拉 `GET /threads`，前端按 `cwd === project.path` 过滤后按最后活动时间倒序。
- 归档 tab：同上但 `archived=true`，按归档时间倒序。
- 不做下拉刷新（手势冲突），不做搜索。
- 历史 timeline：向上滚动到顶时 `cursor` 拉下一页。

### D12. 不在 timeline 显示成本

token 用量只在设置页可见；不在会话 timeline 上显示 turn 耗时和 token 数。

理由：聊天界面要纯净，成本是低频信息。

### D13. 模型粒度：全局默认 + 会话内可改

- 设置页有「默认模型」，影响新建会话。
- 会话内头部点模型名 = 弹底部抽屉 / 列表，调 `POST /threads/:id/settings` 改当前会话模型。
- 模型列表每次打开切换器时拉一次（不在内存常驻）。

### D14. 登录页极简

- Logo（纯文字）+ token 输入框 + 登录按钮。
- 错误：输入框下红字，不弹 toast。
- 登录成功 → 项目页。
- 不做「记住登录」开关，默认依赖签名 cookie 的有效期。
- session 失效 → 自动跳登录页，保留来源路径 `?return=/p/xx/t/yy`，登录成功后跳回。

## Risks / Trade-offs

- **[localStorage 跨设备不同步]** → 项目列表只在当前手机有效。换设备要重新添加。可以接受，个人自用。
- **[WS 断连期间长内容丢失]** → 全量回填依赖 `GET /turns` 能拿到所有 turn item；如果 app-server 自身没存全（比如内存模式），回填会缺。短期可以接受，暴露后再做。
- **[无下拉刷新]** → 用户没有手动「我想刷新一下」的入口。靠 WS 重连 + 进入会话/列表时主动拉。如果出现实际困扰，再加个隐式刷新（如 pull 距离阈值）。
- **[Plan/Build 切换语义模糊]** → 切换不打断当前 turn，但 UI 上用户可能以为立刻生效。靠头部 segmented 的视觉状态 + 薄警告条减弱误解；不做强制确认。
- **[卡片就地展开导致 timeline 跳动]** → 用户在已展开卡片的上方滚动，下方有新增内容时位置会跳。需要做「锚定当前可见消息」的滚动算法，不能简单 `scrollTop = scrollHeight`。
- **[审批不暴露 inbox]** → 用户回到 web 时可能不知道哪个会话在等审批。当前接受这个代价；后续如果痛，再加「会话列表项徽标」（不开新 inbox 页）。
- **[图片单张限制]** → 后端 `imagePaths` 支持数组，但前端只暴露单张。如果用户需要发多图，必须一张一张发。后续可放开。
- **[markdown 渲染依赖体积]** → markdown + mermaid + diff 渲染加在一起 bundle 不小。手机首屏体积要在实现阶段重点测。需要按需 import / 路由级 code-split。
- **[模型列表每次打开都拉]** → 网络抖动时切换器会卡。可在内存缓存 60s 缓解，不进 localStorage（避免过期）。

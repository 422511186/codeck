# 新空会话模型切换、权限保持与提示分层设计

## 背景

Codex app-server 在 `thread/start` 后、首个 turn 产生前不会创建可供冷恢复的 rollout。现有模型切换状态机对所有空闲会话执行 `unsubscribe -> thread/resume`，因此新空会话在 unsubscribe 后会同时失去加载态运行时和可恢复来源，最终以 `no rollout found for thread id ...` 失败。目标恢复和旧状态恢复都会命中同一错误。

模型切换的冷 resume 当前只携带模型、provider、reasoning 和自定义上下文窗口，没有携带生效中的权限 profile、approval policy 与 approvals reviewer。模型切换后，权限可能回退到部署默认值，而浏览器仍显示本地选择，造成界面与运行时分叉。

前端又把模型前置条件、已恢复的切换失败、权限更新失败和真正的 turn/runtime 错误都渲染为带“出错了”标题的折叠危险卡片。普通警告被错误放大，真正错误也存在重复容器和视觉噪声。

## 目标

- 新建且尚无 turn 的加载态会话可以切换 app-server 或自定义模型，不执行 unsubscribe。
- 已有历史的会话继续使用现有冷 resume 状态机并保留 thread ID 与历史。
- 模型切换成功、目标失败回滚和进程中断恢复都保持切换前的完整权限三元组。
- 普通可恢复问题使用紧凑 warning 提示；真正失败使用紧凑 error 提示。
- 不降低 `recovery_failed` 的发送阻塞与显式恢复要求。

## 非目标

- 不延迟新会话创建到首次发送。
- 不通过创建替代 thread 改变 thread ID。
- 不让 Web 管理 provider、凭据或 `model_catalog_json`。
- 不改变大于 `272000` 的未知模型前置阻断规则。

## 空会话模型切换

模型切换服务在完成当前状态、目录、空闲状态和容量检查后，根据权威 thread detail 判断运行时路径：

- `lastTurnId` 为空且权威 turn manifest 为空：视为尚未物化的加载态空会话。
- 其他会话：视为已有可恢复历史，沿用冷 resume。

空会话路径在写入 binding operation 后执行：

1. 调用 `thread/settings/update` 原地设置目标 model 与 reasoning。
2. 不调用 `thread/unsubscribe`。
3. 对仍加载的 thread 调用不带覆盖的 `thread/resume`，读取 app-server 已确认的 model、provider 与 reasoning。
4. 使用统一运行时身份核验器检查返回值。
5. 核验成功后提交目标 binding 并清除 operation。

若目标设置或核验失败，使用相同原地路径恢复旧 model/reasoning。目标失败但旧状态恢复成功仍返回 `502 recovered`；两者都失败则保留 operation 并返回 `500 recovery_failed`。

`thread/settings/update` 不支持 `model_context_window`。大窗口自定义模型仍必须先存在于 app-server 权威模型目录，并由该目录提供运行时窗口。小于等于 `272000` 的未知模型在空会话原地切换时遵循 Codex fallback；首次 token usage 返回实际窗口后，现有上下文偏差 UI 继续显示实际值与配置值，不静默回写目录。

## 权限保持

模型切换开始前从 thread detail 读取完整权限三元组：

- `activePermissionProfile.id | null`
- `approvalPolicy`
- `approvalsReviewer`

完整三元组作为 binding operation 的可选 `permissionSelection` 持久化。旧 operation 文件没有该字段时继续兼容，恢复时使用部署默认权限。

已有历史的冷 resume 将权限三元组与模型覆盖一起传给 app-server。空会话原地 settings update 只修改模型与 reasoning，不清除现有权限。目标失败回滚与进程中断恢复都复用 operation 中保存的同一权限三元组。

前端仍在每次 `turn/start` 发送当前完整权限选择，作为本 turn 和后续 turn 的最终一致性保障。

## 提示分层

扩展 system timeline entry，增加 `systemKind: "warning"`。warning 使用紧凑内联布局：警告图标、单层浅色背景或左侧强调线、正文，不使用折叠、卡片标题或嵌套 `<pre>`。

以下情况使用 warning：

- 模型目录或容量前置条件未满足。
- 目标模型切换失败但旧状态已恢复。
- 权限设置更新失败并已回退本地选择。
- 其他不阻塞会话历史与发送的操作级提示。

真正错误继续使用 error timeline entry，但 `ErrorCard` 改为紧凑红色内联提示，标题使用“操作失败”，不再显示“出错了”，不使用折叠容器和嵌套红色代码框。

`recovery_failed` 仍由现有阻塞恢复界面承担主交互；timeline error 只提供简短失败摘要，不替代恢复按钮。

## 数据与兼容性

binding operation 新字段保持可选，文件 schema version 不变：

```ts
type BindingOperation = {
  operationId: string;
  kind: BindingOperationKind;
  oldState: RuntimeModelSnapshot;
  targetState: RuntimeModelSnapshot;
  permissionSelection?: {
    permissions: string | null;
    approvalPolicy: "untrusted" | "on-request" | "never" | null;
    approvalsReviewer: "user" | "auto_review" | "guardian_subagent" | null;
  };
  startedAt: string;
};
```

读取器只接受完整合法三元组；缺字段、未知枚举或额外字段继续失败关闭。旧文件无新字段时正常读取。

## 测试

实现遵循 RED-GREEN-REFACTOR：

- 新空会话切模先失败测试：settings update 成功、未调用 unsubscribe/reload、loaded resume 核验通过并提交 binding。
- 新空会话目标失败时原地恢复旧模型；双重失败保留 operation。
- 有历史会话继续调用冷 resume，不退化成 settings update。
- 冷 resume、目标回滚和重启恢复都携带同一权限三元组。
- 旧 operation 无 `permissionSelection` 可读取，新字段非法时失败关闭。
- 模型和权限可恢复提示渲染为 warning，不出现“出错了”。
- 真正 error 渲染为紧凑“操作失败”提示，不出现嵌套危险卡片。
- 运行相关定向 Vitest、完整测试、类型检查、构建和 390px 手机页面验证。

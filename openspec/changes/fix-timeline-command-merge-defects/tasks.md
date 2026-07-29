# Tasks

## 1. 终态保护统一（前端）

- [ ] 1.1 在 `src/web/state/timeline-engine.ts` 抽取 `resolveToolStatus(current, next)` helper：当 `isFinalStatus(current) && !isFinalStatus(next)` 返回 current，否则返回 next
- [ ] 1.2 `appendDeltaEntry` tool 分支（L980）改用 `resolveToolStatus(current.body.status, delta.body.status)`
- [ ] 1.3 `mergeEntry` tool 分支（L1652）改用 `resolveToolStatus` 替换现有 `isFinalStatus(next) ? next : base` 写法，保持语义
- [ ] 1.4 验证 `mergeEntry` command 分支（L1624 附近）的 status 取值与 tool 分支一致
- [ ] 1.5 补充单元测试：current=success + delta=running → 保持 success；current=running + authoritative=failed → 采纳 failed

## 2. 终态保护统一（服务端 overlay）

- [ ] 2.1 在 `src/server/app-server/runtime.ts` `mergeOverlayItems`（L356）改用与前端 `resolveToolStatus` 等价的逻辑，替换 `next.status ?? current.status`
- [ ] 2.2 验证 `appendTimelineOverlayText`（L4132 附近）的 `currentItem.status ?? defaults.status` 已保留 current.status，确认无需改动
- [ ] 2.3 补充单元测试：overlay current=success + next=running → 保持 success

## 3. authoritative 截断不覆盖更长 delta 文本

- [ ] 3.1 在 `mergeEntry` tool 分支 result 取值（L1653-1658）增加判断：当 `next.completeness?.contentRef` 存在时，保留 `current.body.result`，仅采纳 next 的 status 与 contentRef
- [ ] 3.2 补充单元测试：current 累积长文本 + authoritative 截断 next → 保留 current 长文本，采纳 next status/contentRef
- [ ] 3.3 补充单元测试：authoritative 未截断 next → 仍按现有规则用 next.result 覆盖

## 4. command 分支与 tool 分支语义对齐

- [ ] 4.1 `mergeEntry` command 分支（L1624）的 `output: next.body.output || current.body.output` 改为 `longerText(current.body.output ?? "", next.body.output ?? "")`，与 tool 分支一致
- [ ] 4.2 确认 `timelineItemToEntry`（`src/web/state/timeline.ts` L316-392）对 role:"tool" 一律产出 kind:"tool"，确认 kind:"command" 无产出路径
- [ ] 4.3 若确认无产出路径，在 command 分支添加注释标注"保留用于未来 overlay 路径"，或删除该分支
- [ ] 4.4 补充单元测试：command 分支 next 短 output 不覆盖 current 长 output

## 5. server/tool 字段保留 authoritative working_dir

- [ ] 5.1 `appendDeltaEntry` tool 分支（L978-979）的 `server: delta.body.server || current.body.server` 改为：delta 携带明确 server（非默认 "command"）时用 delta，否则保留 current
- [ ] 5.2 `mergeEntry` 中 server/tool 采用 authoritative 覆盖：next.authoritative 时强制用 next.server/next.tool
- [ ] 5.3 补充单元测试：current=working_dir + delta server="command" → 保留 working_dir；current="command" + authoritative working_dir → 采纳 working_dir

## 6. nestedExec parts 不匹配 fallback

- [ ] 6.1 在 `src/server/app-server/session-timeline.ts` L1098-1102 的 `else if (parts.length === groupedRecords.length)` 后添加 else 分支：
  - parts 多于记录：多出 parts 合并到最后一条记录
  - parts 少于记录：按位置回填，无对应 part 的记录用末尾 part 推断状态
- [ ] 6.2 补充单元测试：2 记录 + 3 parts → 前 2 按位回填，第 3 part 合并到末条
- [ ] 6.3 补充单元测试：3 记录 + 2 parts → 前 2 按位回填，第 3 条用末尾 part 推断状态，不停留 running

## 7. nestedExec 状态推断前置

- [ ] 7.1 修改 `nestedExecOutputParts`（L243-249）：先对原始 output 调用 `toolStatusFromOutput` 得到 `inferredStatus`，再剥离头行，返回 `{ parts, inferredStatus }`
- [ ] 7.2 修改 `applyFunctionOutput`（L777-829）增加可选 `statusOverride` 参数，优先于从文本二次推断
- [ ] 7.3 修改 L1097/L1100 调用点传入 `inferredStatus` 作为 `statusOverride`
- [ ] 7.4 补充单元测试：原始 output=`["Script failed"]` → 剥离后 parts 为空，状态为 failed（非 success）
- [ ] 7.5 补充单元测试：原始 output=`["Script running..."]` → 状态为 running（非 success）

## 8. 同 callId 多记录非 nested 回填

- [ ] 8.1 修改 L1103-1105 的 else 分支：当 `groupedRecords.length > 1` 时按记录顺序切分 output，或显式标记其余记录为 orphan（status=failed + 诊断日志）
- [ ] 8.2 补充单元测试：2 条非 nested 记录 + 1 个 output → 不只回填首条，第 2 条不停留 running

## 9. command_output_delta 补充 sourceChannel 与序号字段

- [ ] 9.1 在 `src/server/app-server/events.ts` `deltaEvent`（L312-327）与 `processDeltaEvent`（L341-372）增加可选 `sourceChannel` 字段，按调用来源（item-commandExecution / command-exec / process / terminalInteraction）填充
- [ ] 9.2 在 `enrichCodexEvent`（runtime.ts L3561-3588）为 `command_output_delta` 事件按 `(itemId, sourceChannel)` 维护并填充 `fragmentSequence`
- [ ] 9.3 在 `src/web/state/timeline-engine.ts` `identityKey` tool 分支（L2070-2074）纳入 `sourceChannel`：`tool:${stamp}:${turnId}:${entry.id}:${sourceChannel ?? "default"}`
- [ ] 9.4 保证未携带 `sourceChannel` 的旧事件 fallback 到 "default"，与历史 identity 兼容
- [ ] 9.5 验证 `applyLiveDeltaInput` 的 fragmentSequence 校验对携带 fragmentSequence 的 command delta 生效
- [ ] 9.6 补充单元测试：同 itemId 不同 sourceChannel → 落到不同 entry，输出不翻倍
- [ ] 9.7 补充单元测试：同 itemId 同 sourceChannel 乱序 delta → 触发 repair 而非静默追加

## 10. 验证与回归

- [ ] 10.1 运行 `npm run typecheck`
- [ ] 10.2 运行 `npm run test`
- [ ] 10.3 运行 `npm run verify`
- [ ] 10.4 人工验证：长命令输出场景下命令卡片状态正确、输出不翻倍、工作目录正确显示

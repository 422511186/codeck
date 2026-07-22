## Context

会话页通过 `useEffect` 执行 snapshot repair，并用本地 `cancelled` 标记、request token、`HistoryStamp` 和 mutation/delivery barrier 防止旧请求覆盖新 timeline。当前成功路径已经检查 `cancelled`，但失败路径在非 abort 错误时仍可能调用 `scheduleSnapshotRepairRetry`。

当用户在 repair pending 期间切换 thread 或页面卸载，旧 effect 的 `catch` 仍可能晚到。若它安排 completion repair retry，旧 thread 的 repair attempt 会越过组件生命周期边界，产生额外后台请求，并可能影响当前 thread 的 repair 节奏。

## Goals / Non-Goals

**Goals:**

- 确保已取消、卸载或过期的 repair attempt 在失败路径不会安排 retry。
- 保留当前有效 repair 的 persistence-lag completion retry 语义。
- 用单元测试覆盖“repair 请求失败晚于路由切换/卸载”的竞态。

**Non-Goals:**

- 不重写 snapshot repair 状态机。
- 不改变 app-server API 或 `readThread`/latest-page response schema。
- 不调整文件上传、多选附件或 timeline engine 归一化逻辑。

## Decisions

1. **在 repair effect 的 `catch` 分支首先检查取消状态。**

   选择：在非 abort 错误处理前增加 `cancelled` guard；如果 effect 已 cleanup，直接返回，不调用 `scheduleSnapshotRepairRetry`。

   原因：`cancelled` 是 React effect 生命周期的直接边界。成功路径已使用该边界，失败路径保持一致可以覆盖 unmount、route/thread 切换和依赖变化导致的 cleanup。

   备选：只依赖 `activeRepairTokenRef.current === repairToken`。该条件能挡住一部分旧 token，但不能表达组件生命周期已结束；在同一 token 尚未被新请求替换时，旧 `catch` 仍可能安排 retry。

2. **回归测试直接验证 retry side effect，而不是只验证 UI。**

   选择：在 `web-thread-page.test.tsx` 中构造 pending repair，切换路由或卸载后让 repair 以非 abort 错误失败，并断言不会调用 `requestSnapshotRepair` 安排后续 retry。

   原因：缺陷表现是后台 retry 调度泄漏，UI 可能没有立即可见变化；测试 side effect 更稳定，也更接近风险边界。

## Risks / Trade-offs

- [Risk] 过早返回可能吞掉仍应重试的 completion repair。→ Mitigation：只在 effect 已 cleanup 的 attempt 返回；当前 thread、token 和 barrier 仍有效的失败路径继续走现有 retry 判断。
- [Risk] 测试依赖异步 timer 顺序，容易不稳定。→ Mitigation：使用已有 fake timer / mocked API 模式，显式等待 repair 请求开始后再触发 route switch 和 reject。
- [Risk] 还有其他 delayed callback 路径存在类似问题。→ Mitigation：本变更只修复已确认缺陷；后续 review 若发现同类路径，再用独立 OpenSpec change 收敛。

## Migration Plan

无需数据迁移。该修复仅影响浏览器端 runtime 行为，可随前端构建发布；如需回滚，恢复 `page.tsx` 的 catch 分支和对应测试即可。

## Open Questions

- 无。

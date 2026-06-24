## Context

Codex Web 后端是一个 Next.js 应用，通过 JSON-RPC 2.0 over WebSocket 与 Codex CLI 的 app-server 子进程通信。当前代码库包含 90+ 个 API route handler、一个全局单例 `AppServerGateway`、三种 Peer 实现（Spawned / External / Mock）以及配套的认证、审计和工作区安全模块。

业务规则散布在各层中：
- 认证逻辑在 `session.ts`（cookie 签名）和 `auth.ts`（请求校验）
- 路径校验在 `workspace-policy.ts` 和 `security.ts`
- 配置白名单在 `config-write-policy.ts`
- 审计写入在 `audit-log.ts`
- 事件归一化在 `events.ts` 和 `pending-requests.ts`

这些规则目前仅存在于代码实现中，缺乏文档化的事实基线。本次变更的目标是将这些**已实现的行为**记录为规格文件，以便后续安全审计和功能迭代有据可依。

## Goals / Non-Goals

**Goals:**
- 将 8 个业务域的现有行为约束文档化为可验证的规格
- 每条需求对应代码中已实现的逻辑，可追溯到具体文件和函数
- 标记代码中语义不明确或可能有安全隐忧的行为为 OPEN QUESTION
- 为后续安全加固（如进程执行限制、断线重连）提供变更起点

**Non-Goals:**
- 不修改任何现有代码、类型定义或运行时行为
- 不做架构重构（如 Gateway 并发保护、Mock 瘦身）
- 不做功能新增（如心跳机制、token 轮换）
- 不做安全加固（如命令白名单、审计降级）
- 不统一或迁移现有的 `docs/generated/` JSON Schema 类型定义

## Decisions

### D1: 每个业务域一个 spec 文件

**决策**：按业务域拆分为 8 个独立 spec，而非按代码模块（server/app-server/*）拆分。

**理由**：业务域边界更贴近使用者和审计者视角，且与 proposal 中声明的 8 个 capability 一一对应。代码模块边界（如 runtime.ts 包含 Gateway + Mock + Disabled 三个类）不适合作为规格组织单元。

**替代方案**：按代码模块拆分（如 `app-server-runtime`、`app-server-transport`），缺点是同一业务规则跨越多个模块时难以追踪。

### D2: 仅记录 ADDED Requirements

**决策**：所有 spec 均使用 `## ADDED Requirements` 节，不使用 MODIFIED / REMOVED。

**理由**：本次是首次为这些能力编写规格，不涉及对已有规格的修改。后续变更如需修改这些需求，再使用 MODIFIED delta。

### D3: OPEN QUESTION 内联在 spec 末尾

**决策**：每个 spec 文件末尾设一个 `### Requirement: Open questions` 块，用非规范性文字列出待确认问题。

**理由**：保持问题与对应能力的上下文紧密关联，避免单独维护问题清单时的同步负担。这些问题不是需求（不使用 MUST/SHALL），而是需要团队讨论后决定是否转化为新需求。

### D4: 规格描述的是当前代码行为，不是期望行为

**决策**：每条 Requirement 准确反映代码中的实现逻辑，即使该逻辑存在安全隐忧。

**理由**：本次变更是"记录现状"，不是"改造现状"。如果某条规则不安全（如 fs/remove 的 recursive+force 硬编码），规格应如实记录，并在 OPEN QUESTION 中标记风险，而不是在规格中预设更安全的约束。

## Risks / Trade-offs

- **规格与代码可能逐步分叉** → 本次完成后需建立惯例：每次修改相关代码时同步更新对应 spec。openspec 的 archive 流程会在归档时将 specs 写入 `openspec/specs/`，后续变更可通过 MODIFIED delta 追踪。
- **OPEN QUESTION 可能长期悬而未决** → 建议在 spec 归档后创建独立的 GitHub Issue 追踪每个 OPEN QUESTION，避免在规格文件中积累过多悬而未决的讨论。
- **8 个 spec 文件数量较多** → 每个域保持独立便于按需引用，但维护成本稍高。折中方案：如果某些域的 spec 极短（如远程控制），可在后续迭代中合并。

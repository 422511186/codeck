## ADDED Requirements

### Requirement: 用户消息长按菜单
timeline SHALL 在用户自己的 user message 上提供长按操作菜单，作为复制、回滚到这里和从这里 Fork 的唯一入口。

#### Scenario: 打开用户消息菜单
- **WHEN** thread 静止且用户长按一条 user message
- **THEN** 系统 MUST 显示消息级操作菜单
- **AND** 菜单 MUST 包含「复制」「回滚到这里」「从这里 Fork」「取消」

#### Scenario: 非用户消息无菜单
- **WHEN** 用户长按 agent message、reasoning、tool、diff、system 或 error 条目
- **THEN** 系统 MUST NOT 显示回滚或 Fork 操作

#### Scenario: 运行中禁用历史操作
- **WHEN** thread 处于运行态
- **AND** 用户长按 user message
- **THEN** 系统 MUST NOT 允许触发「回滚到这里」或「从这里 Fork」
- **AND** 系统 MAY 继续提供「复制」操作

### Requirement: 复制用户消息
用户消息菜单中的「复制」SHALL 将该 user message 的文本复制到系统剪贴板，不改变会话历史或输入框草稿。

#### Scenario: 复制文本
- **WHEN** 用户在消息级菜单点击「复制」
- **THEN** 系统 MUST 将该 user message 的文本写入剪贴板
- **AND** MUST 关闭消息级菜单
- **AND** MUST NOT 调用 rollback、fork 或 turn/start 接口

### Requirement: 回滚到这里
用户消息菜单中的「回滚到这里」SHALL 将当前 thread 的历史回滚到目标 user message 所属 turn 之前，并将该 user message 文本回填到输入框供用户编辑后重新发送。

#### Scenario: 回滚历史用户消息
- **WHEN** thread 静止
- **AND** 用户在某条 user message 的消息级菜单点击「回滚到这里」
- **THEN** 前端 MUST 根据该 user message 所属 turn 计算需要删除的尾部 turns 数
- **AND** MUST 调用 `POST /api/codex/threads/:threadId/rollback`
- **AND** rollback 成功后 MUST 使用返回的 thread detail 替换本地 timeline
- **AND** MUST 将该 user message 的文本回填到底部输入框
- **AND** 用户 MUST 能在发送前修改文本

#### Scenario: 回滚不自动发送
- **WHEN** 用户点击「回滚到这里」且 rollback 成功
- **THEN** 系统 MUST NOT 自动调用 `POST /api/codex/turns/start`
- **AND** MUST 等待用户再次点击发送或按发送快捷操作

#### Scenario: 无法定位所属 turn
- **WHEN** 用户点击「回滚到这里」
- **AND** 前端无法可靠定位该 user message 所属 turn 或无法计算尾部 turns 数
- **THEN** 系统 MUST NOT 调用 rollback
- **AND** MUST 保持当前 timeline 和输入框内容不变
- **AND** MUST 向用户呈现操作不可用或需要重新加载的反馈

### Requirement: 从这里 Fork
用户消息菜单中的「从这里 Fork」SHALL 保留当前 thread 不变，创建一个新 thread，并在新 thread 中回滚到目标 user message 所属 turn 之前，再跳转到新 thread 继续编辑发送。

#### Scenario: Fork 历史用户消息
- **WHEN** thread 静止
- **AND** 用户在某条 user message 的消息级菜单点击「从这里 Fork」
- **THEN** 前端 MUST 调用 `POST /api/codex/threads/:threadId/fork`
- **AND** MUST 在 fork 出的新 thread 上回滚目标 user message 所属 turn 及其之后的 turns
- **AND** MUST 保持原 thread timeline 不变
- **AND** MUST 跳转到新 thread 的聊天页
- **AND** MUST 将目标 user message 的文本回填到新 thread 的输入框

#### Scenario: Fork 后不自动发送
- **WHEN** 「从这里 Fork」成功并跳转到新 thread
- **THEN** 系统 MUST NOT 自动调用 `POST /api/codex/turns/start`
- **AND** 用户 MUST 能在新 thread 中编辑回填文本后再发送

#### Scenario: Fork 回滚失败
- **WHEN** fork 已创建但新 thread rollback 失败
- **THEN** 系统 MUST NOT 静默跳转到错误历史状态
- **AND** MUST 向用户呈现失败反馈
- **AND** MUST 保持原 thread 可继续使用

### Requirement: 消息级操作只回滚对话历史
消息级「回滚到这里」和「从这里 Fork」SHALL 只改变 thread history，不还原 agent 已经写入本地工作区的文件变更。

#### Scenario: 文件变更不回滚
- **WHEN** 用户触发「回滚到这里」或「从这里 Fork」
- **THEN** 系统 MUST NOT 承诺或暗示本地工作区文件变更会自动还原
- **AND** 若界面展示确认或说明文案，MUST 明确该操作只回滚对话历史

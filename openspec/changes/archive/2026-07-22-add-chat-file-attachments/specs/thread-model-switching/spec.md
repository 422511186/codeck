## MODIFIED Requirements

### Requirement: Draft input compatibility is enforced without data loss
当前自定义绑定的输入模态 SHALL 约束待发送草稿。切换到只支持文本的模型时，系统 MUST 保留已选图片、普通文件与文本并允许切换，但 MUST 仅因不受支持的图片阻止发送，直到用户移除图片或切换回支持图片的模型。普通文件引用本身 MUST 按文本上下文兼容处理，不得被误判为 image modality。历史消息中的图片和普通文件 MUST NOT 阻止模型切换。

#### Scenario: Draft images survive text-only switch
- **WHEN** 草稿包含图片且用户切换到仅支持文本的模型
- **THEN** 切换 MUST 继续执行并保留图片、普通文件与文本草稿
- **AND** 发送按钮 MUST 被阻止并显示图片输入不兼容状态

#### Scenario: Ordinary files remain compatible with text-only model
- **WHEN** 草稿包含非空文本与已就绪普通文件但不包含图片
- **AND** 用户切换到只支持文本的模型
- **THEN** 切换 MUST 继续执行并保留普通文件与文本
- **AND** 普通文件 MUST NOT 单独阻止发送

#### Scenario: Mixed files and images preserve all draft data
- **WHEN** 草稿同时包含普通文件与图片并切换到只支持文本的模型
- **THEN** 所有附件和文本 MUST 保留
- **AND** 发送阻塞原因 MUST 指向图片不兼容
- **AND** 用户移除图片后 MUST 能继续发送普通文件与文本

#### Scenario: Historical images and files do not block
- **WHEN** 会话历史包含图片或普通文件但当前草稿与目标能力兼容
- **THEN** 历史附件 MUST NOT 阻止切换
- **AND** 后续真实 turn 的 provider 或文件读取权限错误 MUST 通过正常错误流程呈现

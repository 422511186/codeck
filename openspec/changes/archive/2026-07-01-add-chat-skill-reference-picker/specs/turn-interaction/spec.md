## MODIFIED Requirements

### Requirement: User input construction
系统 SHALL 将用户输入构造为 `UserInput[]` 数组，包含一个 `type: "text"` 元素、零到多个 `type: "skill"` 元素和零到多个 `type: "localImage"` 元素。text MUST trim 后非空，skill name/path MUST trim 后非空，image path MUST trim 后非空。skill 引用 MUST 使用 app-server 官方 `{type: "skill", name, path}` 结构，不得拼接到 text 中。

#### Scenario: Text-only input
- **WHEN** 调用 `createTurnUserInput("hello")`
- **THEN** 返回 `[{type: "text", text: "hello", text_elements: []}]`

#### Scenario: Text with images
- **WHEN** 调用 `createTurnUserInput("hello", ["/path/a.png"])`
- **THEN** 返回 `[{type: "text", ...}, {type: "localImage", path: "/path/a.png"}]`

#### Scenario: Text with skill references
- **WHEN** 调用 `createTurnUserInput("hello", [], [{name: "openai-docs", path: "/skills/openai-docs/SKILL.md"}])`
- **THEN** 返回 `[{type: "text", ...}, {type: "skill", name: "openai-docs", path: "/skills/openai-docs/SKILL.md"}]`
- **AND** text MUST 保持 `"hello"`，不得追加 skill 名称或说明文本

#### Scenario: Validate skill references for thread cwd
- **WHEN** `/api/codex/turns/start` 请求包含 skill 引用
- **THEN** 系统 MUST 使用当前 thread 的 `cwd` 调用 `skills/list`
- **AND** skill 引用的 `{name,path}` MUST 存在于该 `cwd` 可见的已启用 skill 列表中

#### Scenario: Blank text rejected
- **WHEN** 调用 `createTextUserInput("  ")`
- **THEN** 抛出 `"消息不能为空"`

#### Scenario: Blank skill rejected
- **WHEN** 调用 `createTurnUserInput("hello", [], [{name: " ", path: "/skills/a/SKILL.md"}])`
- **THEN** 抛出 `"Skill 引用不能为空"`

# Codex Web Design

Date: 2026-06-22
Workspace: `C:\Users\huang\workspace\codex-web`

## Goal

Build a mobile web version of Codex that remotely operates Codex on the server machine through the Codex app-server protocol. The product target is a 1:1 functional recreation of the VS Code Codex extension capabilities in a phone-first browser experience: threads, history, fork, edit-and-resend, model and reasoning controls, image input, permission approval, questions, terminal/file-change output, and workspace-aware remote development.

The backend must not reimplement Codex agent behavior. Codex remains the authority for execution, permissions, persistence, model routing, tools, and thread state. The web app acts as a secure, browser-friendly client for the app-server protocol.

## Current Context

The project started as an empty directory. It now contains this design document, generated protocol artifacts, a baseline `.gitignore`, and an initialized git repository.

Local Codex CLI is installed as `@openai/codex` version `0.141.0`. The CLI exposes:

- `codex app-server`
- `codex app-server daemon`
- `codex app-server generate-ts`
- `codex app-server generate-json-schema`
- `codex remote-control`
- `codex --remote <ws://...>`

Generated protocol snapshots were written to:

- `docs/generated/app-server-ts`
- `docs/generated/app-server-json-schema`

The generated app-server protocol includes the main capabilities needed for parity:

- Threads: `thread/start`, `thread/resume`, `thread/fork`, `thread/list`, `thread/search`, `thread/read`, `thread/turns/list`, `thread/turns/items/list`, `thread/rollback`, `thread/archive`, `thread/delete`, `thread/settings/update`.
- Turns: `turn/start`, `turn/steer`, `turn/interrupt`.
- Inputs: text, image URL, local image path, skills, mentions.
- Approval and questions: server requests for command execution approval, file change approval, permissions approval, tool user input, MCP elicitation, dynamic tool calls, auth token refresh.
- Runtime output: item lifecycle, agent deltas, reasoning deltas, command output, file change output, patch updates, plan updates, diffs, terminal interaction, token usage, model reroutes.
- Configuration: `model/list`, `modelProvider/capabilities/read`, `permissionProfile/list`, `collaborationMode/list`, `config/read`, `config/value/write`, `config/batchWrite`.
- Remote control: enable/disable/status, pairing, client list, revoke.
- Workspace/files: file read/write/list/watch/copy/remove, process and command execution, background terminals.

## Approach Options

### Option A: CLI Text Wrapper

Run `codex` as an interactive process and parse terminal output.

Pros: simple to prototype.
Cons: weak parity, brittle parsing, hard approval/question handling, poor history/fork fidelity.

Rejected.

### Option B: Direct App-Server Web Client

Expose the Codex app-server WebSocket directly to browser clients.

Pros: minimal backend logic, close to native protocol.
Cons: unsafe for remote access, browser would receive broad machine control, auth and multi-user isolation are hard, app-server protocol churn would leak directly into UI code.

Rejected as the primary architecture.

### Option C: Secure Protocol Proxy and Web Workbench

Backend owns the app-server connection, normalizes the protocol into browser-facing APIs, enforces user auth and workspace policy, and streams app-server events to the web UI.

Pros: closest to VS Code behavior while keeping security and compatibility manageable. The backend can regenerate protocol bindings and absorb app-server changes.
Cons: more implementation work and a larger test surface.

Selected.

## Architecture

The system has four layers:

1. Web frontend

   React/Next.js mobile browser workbench that renders Codex threads, message timeline, approvals, questions, file changes, terminal output, model controls, reasoning controls, history, and fork/edit flows in touch-first views.

2. Web backend

   Node.js server that authenticates browser users, starts or connects to Codex app-server, stores browser session metadata, validates requests, proxies protocol calls, and broadcasts normalized events.

3. Codex app-server adapter

   A typed JSON-RPC/WebSocket client generated from `codex app-server generate-ts --experimental`. This adapter is the only code allowed to speak raw app-server protocol.

4. Codex app-server

   The local Codex daemon or explicit `codex app-server --listen ws://...` process running on the backend machine. It owns actual Codex execution, state, approvals, tools, files, and shell access.

The browser never connects directly to Codex app-server. Browser clients connect only to the project backend.

## Transport

Backend startup should support two modes:

- Managed daemon mode: run `codex remote-control start --json` or `codex app-server daemon start`, then connect to the reported endpoint.
- Explicit listen mode: start `codex app-server --listen ws://127.0.0.1:<port>` and keep the process supervised by the backend.

For local development, explicit listen mode is simplest. For production-like remote use, managed daemon mode is preferred because it matches Codex's remote-control lifecycle.

Browser transport should use WebSocket for live events and HTTP for durable queries where streaming is unnecessary. The backend may expose a single browser WebSocket that multiplexes normalized protocol events.

## Mobile Frontend Product Surface

The first screen is the mobile workbench, not a landing page. The app is optimized for phone screens and touch input. Desktop layout is not a product target.

Core mobile layout:

- Top app bar: current thread title, run state, model indicator, compact menu, connection state.
- Main timeline view: user messages, agent deltas, reasoning summaries, plans, command executions, tool calls, approvals, file changes, diffs, images, and final answers.
- Sticky bottom composer: text input, image attach, send, interrupt, and a compact settings trigger. It must respect mobile keyboard safe areas.
- Bottom navigation: `Chats`, `Run`, `Files`, `Terminal`, `Settings`.
- Drawer/sheet views: thread search/history, fork/edit actions, model selector, reasoning selector, approval mode selector, permissions, token usage, MCP/tool status.
- Diff/file view: full-screen or bottom-sheet mode with horizontal code scrolling and stable tap targets.
- Approval/question UI: modal sheet with large actions, clear command/file summaries, and session-scoped approval choices when app-server offers them.

Required interactions:

- Start thread with cwd, workspace roots, model, reasoning effort, sandbox/permissions.
- Resume and switch thread history using `thread/list`, `thread/read`, `thread/resume`, `thread/turns/list`, and `thread/turns/items/list`.
- Fork using `thread/fork`, preserving or overriding cwd/model/permissions.
- Edit and resend by rolling back to a turn boundary with `thread/rollback`, then sending a replacement `turn/start`. `thread/rollback` only changes Codex thread history; it does not revert local file changes made by dropped turns. The UI must warn when edited-away turns included file changes and offer a diff/revert workflow.
- Switch model and reasoning effort through `turn/start` overrides and `thread/settings/update` where appropriate.
- Send images as `UserInput` variants: `image` for URL/data-backed uploads and `localImage` for backend-local files.
- Show approvals and questions from `ServerRequest`, then send JSON-RPC responses.
- Interrupt active turns with `turn/interrupt`.
- Continue/steer active work with `turn/steer` when the app-server marks a turn steerable.

## Backend Responsibilities

The backend owns:

- User authentication for the web app.
- Session-to-thread mapping.
- Workspace allowlist and path validation.
- App-server process supervision.
- WebSocket reconnect and replay.
- JSON-RPC request id tracking.
- Pending server-request queue for approvals and questions.
- Browser-safe event normalization.
- File upload staging for images.
- Protocol version checks and generated binding refresh.

The backend does not own:

- Agent prompting.
- Shell command execution.
- File mutation semantics.
- Permission policy semantics.
- Thread persistence format.
- Model/provider implementation.

## Protocol Mapping

Browser action to app-server request:

- New chat: `thread/start`, then `turn/start`.
- Send message: `turn/start`.
- Add follow-up while running: `turn/steer`.
- Stop generation: `turn/interrupt`.
- Switch session: `thread/resume` plus `thread/turns/list`.
- Fork: `thread/fork`.
- Edit previous message: `thread/rollback`, then `turn/start`.
- Rename: `thread/name/set`.
- Archive/delete: `thread/archive`, `thread/delete`.
- Model list: `model/list`.
- Provider capability: `modelProvider/capabilities/read`.
- Permission profiles: `permissionProfile/list`.
- Thread settings: `thread/settings/update`.
- File preview: `fs/readFile`, `fs/readDirectory`, `fs/watch`.
- Terminal/process utilities: `command/exec` and `process/*` only for UI features that VS Code exposes.

App-server request to browser modal/action:

- `item/commandExecution/requestApproval`: command approval UI.
- `item/fileChange/requestApproval`: file-change approval UI.
- `item/permissions/requestApproval`: permission escalation UI.
- `item/tool/requestUserInput`: question UI.
- `mcpServer/elicitation/request`: MCP elicitation UI.
- `item/tool/call`: dynamic tool rendering/response bridge.
- `account/chatgptAuthTokens/refresh`: account reauth prompt.
- `applyPatchApproval` and `execCommandApproval`: legacy compatibility approval UI.

App-server notification to browser stream:

- `item/agentMessage/delta`, `item/reasoning/*`, `item/plan/delta`.
- `item/started`, `item/completed`.
- `item/commandExecution/outputDelta`, `command/exec/outputDelta`, `process/outputDelta`.
- `item/fileChange/outputDelta`, `item/fileChange/patchUpdated`, `turn/diff/updated`.
- `turn/started`, `turn/completed`, `turn/plan/updated`.
- `thread/status/changed`, `thread/settings/updated`, `thread/tokenUsage/updated`.
- `serverRequest/resolved`.
- `model/rerouted`, `model/verification`.
- warnings, config warnings, account and remote-control status updates.

## Security

Remote development means the browser can indirectly cause shell commands and file writes on the backend machine. The backend must be conservative.

Minimum controls:

- Require web login before any app-server access.
- Bind app-server to loopback whenever possible.
- Use app-server WebSocket auth for non-loopback listeners.
- Never expose raw app-server endpoint or token to the browser.
- Keep a workspace allowlist; reject cwd and runtime roots outside configured roots.
- Store image uploads in a project-owned staging directory and pass only safe local paths.
- Keep server-request approvals explicit unless the user chooses a Codex permission profile that allows more.
- Audit every browser action that maps to command execution, file write, approval, permission change, or config write.
- Support remote-control client revoke and pairing status.

## State Model

Persistent app state should stay small because Codex already persists threads.

Backend database tables:

- `users`: login identity.
- `web_sessions`: browser session id, user id, created/last seen.
- `workspace_roots`: allowed absolute paths.
- `thread_pins`: optional UI pin/favorite metadata keyed by Codex thread id.
- `pending_requests`: app-server request id, thread id, method, payload, status.
- `uploads`: staged file path, owner, mime type, size, created time.
- `audit_events`: user id, action, thread id, app-server method, summary, timestamp.

Codex thread content remains in Codex state. The web app should read it through app-server methods instead of copying it into its own database.

## Error Handling

- App-server connection loss: show disconnected state, retry with backoff, preserve pending browser actions until retry or explicit failure.
- App-server process crash: supervised restart, then reload active threads through `thread/loaded/list` and `thread/resume`.
- Protocol mismatch: fail startup with a clear message and instruct regeneration of generated bindings.
- Approval/question timeout: reflect app-server resolution, do not invent a browser-side default.
- Upload failure: block send and show the failed attachment.
- Workspace path denial: reject before app-server call and record an audit event.
- Edit-resend after file changes: require the user to inspect or revert affected diffs before continuing if rollback would leave stale workspace mutations.

## Testing Strategy

Unit tests:

- JSON-RPC request/response correlation.
- app-server event normalization.
- approval/question request queue.
- workspace path validation.
- model/reasoning setting mapping.
- image upload staging and cleanup.

Integration tests:

- Start app-server, initialize, list models, start thread, send text, receive deltas.
- Send image as staged local path.
- Trigger a command approval and answer it.
- Fork a thread and verify the new thread loads.
- Roll back and resend edited input.
- Resume historical thread and paginate turns/items.

Mobile browser tests:

- Workbench loads on a phone viewport without a landing page.
- Thread list opens as a mobile sheet and switches history.
- Sticky composer sends text and image while the virtual keyboard is open.
- Approval sheet responds with touch-friendly controls.
- Question sheet responds with touch-friendly controls.
- Model and reasoning controls update the next turn from compact sheets.
- Fork and edit-resend flows are reachable without desktop-only sidebars.
- Diff, terminal, and settings panels are usable on narrow viewports.

Manual verification:

- Run the web app on a phone or phone-sized browser in the LAN.
- Confirm raw app-server is not reachable from the browser.
- Confirm all remote actions appear in audit logs.
- Confirm Codex behavior matches the VS Code extension capabilities for approvals, questions, output, and history, while using mobile-specific navigation.

## Implementation Order

1. Scaffold TypeScript app with backend, frontend, shared protocol package, and generated app-server bindings.
2. Implement app-server client with JSON-RPC transport, generated types, request correlation, and notification stream.
3. Add single-owner local web authentication, workspace allowlist, app-server supervision, and browser WebSocket.
4. Build thread list/history/resume and live timeline rendering.
5. Build composer for text, model, reasoning effort, approval policy, and image upload.
6. Implement approvals/questions from `ServerRequest`.
7. Implement fork, rollback/edit-resend, interrupt, and steer.
8. Add file/diff/terminal panels.
9. Add audit log, error recovery, reconnect/replay, and production hardening.

## Non-Goals

- Reimplementing Codex model/tool execution.
- Using a terminal-text parser as the main integration.
- Exposing raw app-server tokens to browser clients.
- Building a marketing landing page.
- Supporting multi-tenant untrusted users before single-owner remote access is solid.

## Open Risks

- The app-server protocol is experimental and may change. Generated bindings and schema snapshots must be refreshable.
- Exact VS Code UI details may require observing the extension behavior during implementation.
- Some remote-control flows may depend on Codex desktop/app installation state.
- Local image handling must match app-server expectations for `localImage` paths.
- Full parity may require implementing many smaller views: account, rate limits, MCP status, plugin/skill panels, warnings, review mode, realtime, and external-agent import.

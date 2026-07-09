## ADDED Requirements

### Requirement: Thread status changes flow through event stream
timeline event stream SHALL deliver app-server `thread/status/changed` notifications to the browser as thread-level status events. These events MUST update the client thread status without requiring full `readThread` timeline polling.

#### Scenario: Active status arrives through event stream
- **WHEN** app-server sends `thread/status/changed` with status `active`
- **THEN** browser event stream MUST emit a thread status event for that `threadId`
- **AND** client store MUST mark that thread as running
- **AND** client store MUST preserve or update the active turn when the event provides enough information

#### Scenario: Idle status arrives through event stream
- **WHEN** app-server sends `thread/status/changed` with status `idle`
- **THEN** client store MUST mark that thread as not running
- **AND** client store MUST clear stale active turn state
- **AND** the current会话页 MUST stop showing processing UI without requiring page refresh

#### Scenario: Non-idle recoverable status arrives
- **WHEN** app-server sends `thread/status/changed` with status `notLoaded` or `systemError`
- **THEN** client store MUST save that status for the thread
- **AND** controls that require `idle` MUST render disabled or recovery UI based on that status
- **AND** the event MUST NOT trigger full timeline repair by itself

#### Scenario: Status event is not visible timeline content
- **WHEN** browser receives a thread status event
- **THEN** the event MUST be idempotent through `eventId` or equivalent identity
- **AND** the event MUST NOT append a visible timeline entry
- **AND** the event MUST NOT participate in rewind/fork turn counting

# Current Work
## Objective
Add an initial external MCP bridge so supported AI clients can read and mutate the live Academic Dashboard without embedding an agent runtime or chat interface in the app.

## Scope
### In Scope
- Run a standard MCP server over `stdio`.
- Discover the live dashboard through a per-process loopback URL and bearer token.
- Expose workspace summary, task creation/completion, and dashboard widget movement as typed MCP tools.
- Notify the Electron renderer through SSE when an external MCP mutation is persisted.
- Document client configuration and the security/process boundary.

### Out of Scope
- Embedded agent UI, LLM providers, or API-key management.
- Internship and calendar MCP mutation tools.
- Remote/network MCP access, authentication accounts, or cloud synchronization.
- Direct SQLite access from the MCP process.

## Current Repository State
- Active branch: `Native-Overhaul`.
- Local branch was synchronized with `origin/Native-Overhaul` before this work.
- The initial MCP bridge and live-update path are implemented and verified locally.

## TODO
- [x] Add the MCP SDK and a package script for launching the bridge.
- [x] Publish the authenticated live workspace endpoint for local MCP clients.
- [x] Implement the four initial MCP tools.
- [x] Add authenticated SSE revision notifications.
- [x] Wire Electron/preload/React live reload with listener cleanup.
- [x] Verify protocol discovery, task creation/completion, widget movement, persistence, and SSE.
- [x] Run project checks, production build, and Electron UI verification.
- [x] Update architecture and decision documentation.

## Expected Files Touched
- `bun.lock`
- `package.json`
- `scripts/mcp.ts`
- `src/platform/dashboard-server.ts`
- `electron/main.ts`
- `electron/preload.ts`
- `src/features/use-dashboard.ts`
- `docs/agent/MCP_ARCHITECTURE.md`
- `docs/agent/DECISIONS.md`
- `docs/agent/CURRENT_WORK.md`

## Acceptance Criteria
- [x] An MCP client can launch `bun run mcp` and discover the supported tools.
- [x] MCP can create and complete a task through the validated workspace API.
- [x] MCP can move a known dashboard widget through the existing layout engine.
- [x] External mutations persist through the repository and emit an SSE revision event.
- [x] The renderer reload listener is removable and does not accumulate across remounts.
- [x] Loopback requests remain token-authenticated and browser-origin requests remain rejected.
- [x] Typecheck, lint, tests, build, Electron UI verification, and protocol smoke verification pass.

## Implementation Notes
- `dashboard-server.ts` writes `~/.academic-dashboard/server.json` with the authenticated `/workspace` URL and removes it on a clean shutdown.
- `scripts/mcp.ts` never opens SQLite. It uses the existing workspace GET/PUT API, revision conflict behavior, domain task completion logic, and collision-safe layout engine.
- The service emits an authenticated `/workspace/events` SSE message after persisted revisions. Electron forwards this as `workspace:update`; `useDashboard` reloads and unregisters the listener on cleanup.
- The MCP bridge currently exposes `dashboard_get_state`, `tasks_create`, `tasks_complete`, and `dashboard_move_widget`.
- Added `@modelcontextprotocol/sdk` and explicit `zod` dependencies; the architectural decision is recorded in `DECISIONS.md`.

## Verification
- `bun run check`: passed; 45 tests, 0 failures, with two pre-existing lint warnings.
- `bun run build`: passed; renderer and Electron bundles built successfully.
- `bun run verify:ui`: passed on the final run. An earlier run passed all assertions but exited during Windows temporary-directory cleanup with `EBUSY`; the immediate rerun completed normally.
- MCP protocol smoke test: passed using an isolated live dashboard service and SDK client.
  - Discovered all four tools.
  - Created and completed a task.
  - Moved the Tasks widget and confirmed persisted coordinates.
  - Received the SSE update notification.
- `git diff --check`: passed immediately before commit.

## Completed This Session
- Corrected the MCP connection file to point at `/workspace` rather than the server root.
- Made task creation produce valid priority relations and task completion use existing domain behavior.
- Made widget movement use the existing layout engine instead of ad hoc object mutation.
- Fixed SSE stream-controller cleanup and renderer listener cleanup.
- Replaced the earlier embedded-agent architecture draft with the implemented external MCP design.

## Remaining Work
- None for the initial MCP bridge scope.
- Internship and calendar MCP tools may be added in a separately scoped change.

## Known Regressions / Risks
- The desktop app must be running before an MCP client can call workspace tools.
- A hard process termination can leave `server.json` behind; calls still fail safely because the ephemeral port/token no longer connects.
- The existing two unrelated lint warnings remain in `tests/academic.test.mjs` and `src/internships/model.ts`.

## Exact Next Action
- Wait for user.

## Handoff Summary
The initial external MCP bridge is implemented, verified, committed, and ready on `Native-Overhaul`. It provides four local `stdio` tools backed by the existing authenticated workspace service, sends live SSE updates to Electron, and keeps SQLite ownership in the dashboard process. Project checks, production build, UI smoke verification, and an end-to-end MCP protocol smoke test pass.

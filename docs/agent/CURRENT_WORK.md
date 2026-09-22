# Current Work
## Objective
Remove every leftover task reprioritization control from the dashboard, including the AI action and the manual-order reset action, and eliminate the AI renderer/Electron wiring.

## Scope
### In Scope
- Remove the visible `Auto-Prioritize` button from the Tasks header.
- Remove the visible `Use priority order` reset/reprioritization button from the Tasks header.
- Remove the `prioritize` prop path through `App`, `Dashboard`, and `TasksPanel`.
- Remove the renderer hook method, preload bridge method, and Electron IPC handler used only by the AI button.
- Add regression coverage that prevents either control and the renderer bridge from returning.
- Verify the dashboard visually after removal.

### Out of Scope
- Changing normal priority sorting or drag/keyboard manual task ordering.
- Removing stored AI priority scores from existing workspace data.
- Removing the currently unreachable backend `/workspace/prioritize` route or TypeSafe settings/dependency.
- Changing the MCP bridge.

## Current Repository State
- Active branch: `Native-Overhaul`.
- The branch started at `81492f5`, synchronized with `origin/Native-Overhaul`.
- Both task reprioritization controls have been removed and the fix is verified locally.

## TODO
- [x] Add and run a failing regression test for the leftover controls/wiring.
- [x] Remove both task reprioritization buttons and the AI renderer/Electron path.
- [x] Run focused and full verification.
- [x] Review the Electron screenshot and update this handoff.
- [x] Commit and push the verified fix to `origin/Native-Overhaul`.

## Expected Files Touched
- `docs/agent/CURRENT_WORK.md`
- `tests/no-auto-prioritize.test.ts` (new)
- `src/features/tasks-panel.tsx`
- `src/features/app.tsx`
- `src/features/use-dashboard.ts`
- `electron/preload.ts`
- `electron/main.ts`
- `scripts/verify-ui.ts`

## Acceptance Criteria
- [x] No visible Auto-Prioritize or `Use priority order` reprioritization control remains.
- [x] `TasksPanel` has no prioritization callback prop.
- [x] The renderer preload API and Electron main process expose no prioritization action.
- [x] Normal priority display/sorting and drag/keyboard manual ordering remain intact.
- [x] Focused regression test, lint, typecheck, tests, and Electron UI verification pass.
- [x] The verified change is committed and pushed to `Native-Overhaul`.

## Implementation Notes
- Root cause: commit `51ac988` reintroduced the TypeSafe callback through the entire renderer stack after the earlier UI cleanup, while the existing `Use priority order` reset action remained as a second reprioritization control.
- Removed the AI callback from `TasksPanel`, `Dashboard`, `App`, `useDashboard`, preload, and Electron IPC.
- Removed the `Use priority order` action and its now-unused `RotateCcw` icon import.
- The minimal fix removes only user-facing invocation paths. Backend cleanup is intentionally separate because the request concerns the leftover controls, not a TypeSafe subsystem migration.

## Verification
- Focused regression test was observed failing first for `Auto-Prioritize`, then for `Use priority order`, and passed after each corresponding removal.
- `bun test tests/no-auto-prioritize.test.ts`: 1 passed, 0 failed, 8 assertions.
- `bun run check`: passed; 46 tests, 0 failures, 370 assertions. Two pre-existing lint warnings remain.
- `bun run verify:ui`: passed, including a runtime assertion that neither reprioritization label is visible.
- Reviewed `artifacts/ui-dashboard-1440x900.png`: the Tasks header contains only Categories on the right; there is no awkward gap, collision, or visual blocker.
- `git diff --check`: passed immediately before commit.

## Completed This Session
- Removed both visible reprioritization controls.
- Removed the unused AI renderer-to-Electron invocation path.
- Added static and Electron runtime regression coverage.
- Verified the Tasks header visually at 1440×900.

## Remaining Work
- None.

## Known Regressions / Risks
- The backend prioritize route remains unreachable from the renderer; removing it and TypeSafe configuration/dependencies requires a separately scoped cleanup.
- Existing saved manual task order remains active, but there is no longer a toolbar action to clear it; drag or Alt+Arrow can still change the order.

## Exact Next Action
- Wait for user.

## Handoff Summary
Both leftover task reprioritization controls are gone. The AI callback path through React, preload, and Electron IPC is removed, the manual-order reset button is removed, normal task ordering remains functional, and focused/full/UI verification pass. The verified fix is committed and pushed on `Native-Overhaul`.

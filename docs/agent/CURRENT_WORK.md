# Current Work
## Objective

Complete the local-first Calendar MVP with a dedicated scheduled-event domain, weekly recurrence, durable Bun SQL persistence, a polished event editor, true duration blocks in week/day views, and an accurate current-time indicator.

## Scope
### In Scope

- Audit and document the existing task-backed calendar, form, date, IPC, and SQLite behavior.
- Add a separate `CalendarEvent` domain with one-time and weekly recurring series.
- Store event series in an additive SQLite table and expand occurrences only for visible calendar ranges.
- Add create, edit-whole-series, and delete-whole-series UI with accessible validation.
- Render events and task due dates as visually distinct concepts in month, week, and day views.
- Render duration-positioned event blocks, overlap lanes, current-day emphasis, and a minute-updated current-time line.
- Let calendar day/time interactions prefill event date and time.
- Add domain, validation, recurrence, local-date, and persistence tests.
- Exercise the completed flows in the real Electron UI and update project documentation.

### Out of Scope

- Per-occurrence recurrence exceptions or individual occurrence editing/deletion.
- Event reminders, notifications, drag-to-reschedule, or recurring patterns other than weekly weekday sets.
- Google Calendar, authentication, cloud sync, mobile, Canvas, AI, or any other deferred integration.
- New dependencies, framework/runtime changes, or renderer access to filesystem/database APIs.

## Current Repository State

- Active branch: Native-Overhaul.
- The worktree is intentionally uncommitted and includes the completed Dashboard composition overhaul plus earlier layout/documentation work; all of it must be preserved.
- Calendar events are now a first-class workspace domain, separate from assignment/to-do tasks.
- One-time and weekly event series persist in `calendar_events`; occurrences are expanded only for visible ranges.
- Month view distinguishes event presence from task workload/due dates, while week/day views render duration blocks and overlap lanes.
- The dedicated editor supports weekly rules, accessible validation, and whole-series edit/delete.
- Week/day views show current-day emphasis and a labeled local-time line updated at minute boundaries, with one-time initial scrolling.
- The renderer already saves complete workspace snapshots through the preload bridge, so no new IPC capability is required.
- The SQLite repository uses additive `CREATE TABLE IF NOT EXISTS` setup and atomic replace-all saves; pre-calendar databases load an empty event list.
- Dates are stored as local `YYYY-MM-DD` strings in domain models; task timestamps are ISO strings and must remain compatible.

## TODO

- [x] Read required project documentation and prior handoff.
- [x] Confirm branch/worktree state and preserve existing changes.
- [x] Audit planner, forms, task/domain model, workspace validation, SQLite persistence, date helpers, and tests.
- [x] Update calendar specification, architecture/decision records, and implementation contract for the separate event domain.
- [x] Implement event types, validation, visible-range recurrence expansion, and overlap layout as pure data logic.
- [x] Add workspace defaults/validation and additive SQLite event-series persistence.
- [x] Implement the event editor and whole-series create/edit/delete flows.
- [x] Rebuild month/week/day calendar presentation for distinct tasks and events, duration blocks, time-cell prefill, and current-time behavior.
- [x] Add automated recurrence, validation, local-date, course-removal, and SQLite reopen tests.
- [x] Extend and run the Electron UI flow for one-time persistence, recurring series, edit/delete, views, and current-time behavior.
- [x] Run lint, typecheck, unit/integration tests, and UI verification.
- [x] Review screenshots, update roadmap/worklog/handoff, and record any remaining work.

## Expected Files Touched

- docs/CALENDAR_SPEC.md
- docs/ARCHITECTURE.md
- docs/MVP_ROADMAP.md
- docs/agent/CURRENT_WORK.md
- docs/agent/DECISIONS.md
- docs/agent/WORKLOG.md
- src/data/calendar.ts
- src/data/planning.ts
- src/platform/workspace.ts
- src/platform/database.ts
- src/features/calendar-event-editor.tsx
- src/features/planner.tsx
- src/features/app.tsx
- src/styles/globals.css
- tests/calendar.test.ts
- tests/dashboard.test.ts
- tests/database.test.ts
- scripts/verify-ui.ts
- .gitignore

## Acceptance Criteria

- [x] Events are first-class records and are not stored as assignments or to-dos.
- [x] One-time events require title/date/start/end and persist after a full repository reopen.
- [x] Weekly series support one or more weekdays plus inclusive recurrence start/end dates without storing duplicated occurrences.
- [x] Invalid times, invalid recurrence ranges, missing weekdays, malformed dates, duplicate IDs, and missing required fields are rejected at the data boundary.
- [x] The editor shows accessible inline errors and supports optional course association and event type.
- [x] Editing or deleting a recurring event explicitly affects the whole series; per-occurrence exceptions are documented as out of scope.
- [x] Month view communicates workload, task due dates, and event presence without becoming a detailed timetable.
- [x] Week/day views use a readable hour grid and position event blocks according to actual start/end duration; overlapping events use side-by-side lanes.
- [x] Task due dates remain visible and visually distinct from scheduled events.
- [x] The current-time line appears only in the column for today, includes a time label, updates about once per minute, and does not repeatedly force scroll position.
- [x] Clicking a calendar day/time creation affordance pre-fills an event editor appropriately.
- [x] Required static, domain, persistence, and Electron verification passes.

## Implementation Notes

- Keep workspace version 2 and make the event collection additive/backward-compatible; repositories loading older databases produce an empty event array.
- Store one row per event series. Weekly occurrences are calculated with local calendar arithmetic for the requested visible range.
- A weekly rule contains an inclusive start date, inclusive end date, and unique weekday numbers (Sunday 0 through Saturday 6).
- A series has one time-of-day interval shared by all occurrences. Midnight-crossing events are not part of this MVP.
- Calendar event validation is shared by UI and persistence validation; UI messages are specific while the data boundary remains authoritative.
- Week/day visual overlap calculation belongs in pure calendar data logic, not React components.
- The now indicator timer lives inside the planner, advances at the next minute boundary, then every minute; initial auto-scroll runs only when entering/navigating a view containing today.
- Course removal clears event associations while preserving event series.

## Verification

- `bun run lint`: PASS with 0 errors and the same 2 documented pre-existing warnings.
- `bun run typecheck`: PASS.
- `bun run test`: PASS, 42/42 tests and 300 expectations across 6 files.
- `bun run verify:ui`: PASS in Electron. The extended flow covers one-time persistence, recurring create/edit/delete, week/day blocks, time-cell prefill, and current-time lines alongside the existing product flows.
- Visual review: PASS for month, week, and day screenshots. Week blocks are duration-aligned and day view shows an accurate labeled now line; time-grid headers/due row were made sticky after review.
- A combined verification run encountered one transient DevTools "target navigated or closed" race during intentional reload; the independent rerun passed every product assertion.

## Completed This Session

- Read the required repository agreements and authoritative product, architecture, calendar, UI/UX, QA, roadmap, decision, and handoff documentation.
- Confirmed the active branch and intentionally dirty worktree.
- Audited the current planner/editor/workspace/SQLite/preload architecture and relevant test coverage.
- Defined the bounded implementation approach and migration compatibility rules in this handoff.
- Implemented the pure event domain, weekly occurrence expansion, local-date helpers, validation, and overlap-lane calculation.
- Added additive workspace/SQLite persistence with a real close-and-reopen test.
- Added the event editor and whole-series lifecycle, then rebuilt all three Schedule modes around separate task and event semantics.
- Added the minute-level now line, one-time scroll behavior, sticky schedule context, and date/time prefill.
- Extended Electron verification and reviewed month/week/day artifacts.
- Narrowed `.gitignore` from `data/` to `/data/` so `src/data/` source modules are no longer silently ignored.

## Remaining Work

- No Calendar MVP work remains.
- The unrelated UI/UX polish backlog remains in `docs/MVP_ROADMAP.md` (widget drop configurations, notes/course narrow states, shell/accessibility checks, and remaining empty-state review).

## Known Regressions / Risks

- The worktree combines multiple completed but uncommitted sessions; do not reset or discard unrelated edits.
- Per-occurrence recurrence edits/cancellations and midnight-crossing events are deliberately out of MVP scope and have no hidden partial implementation.
- Week view uses local horizontal scrolling below its readable minimum width in very narrow user-created widget spans.
- Local event dates and ISO task timestamps intentionally use different representations; future work must preserve the date-only local parsing boundary.
- The two existing lint warnings remain documented technical debt; no new lint warning was introduced.

## Exact Next Action

Commit the complete, currently uncommitted Native-Overhaul worktree when desired; do not omit the newly visible `src/data/layout.ts`, `src/data/planning.ts`, or `src/data/calendar.ts` files.

## Handoff Summary

The Calendar MVP is complete and verified on Native-Overhaul. Scheduled events are separate from tasks, stored once per series in an additive SQLite table, validated at workspace/persistence boundaries, and expanded only for visible local-date ranges. The dedicated editor supports one-time and weekly semester-style series with optional courses, accessible validation, and explicit whole-series edit/delete. Month distinguishes event presence from task workload; week/day render duration blocks with overlap lanes, distinct due markers, sticky context, and a minute-updated today-only now line. All 42 tests, typecheck, lint (two known warnings only), and the expanded Electron flow pass. No dependency, IPC expansion, cloud feature, or framework change was introduced.

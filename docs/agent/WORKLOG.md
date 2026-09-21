# Work Log
## Academic Dashboard — Native-Overhaul Branch

Chronological log of agent sessions. Most recent first.

---

## 2026-09-20 — UI visual scheme refinement

**Agent:** Antigravity (Gemini)
**Branch:** Native-Overhaul

### Work Completed
- Added typography adjustments based on reference images, updating headings to be lighter (`font-weight: 300` and `450`), and tracking tighter (`letter-spacing: -0.065em`, `-0.055em`).
- Increased panel and card radii from 14px/12px to 24px/18px to create smoother, more "landscape" shapes in line with the requested artistic flair.
- Enhanced the box-shadows on cards and active widgets with a more pronounced, albeit still subtle, blue and red accent glow.
- Kept all existing layout and behavior unchanged, relying entirely on CSS variable and token overrides in `src/styles/globals.css`.
- Marked all UI/UX documentation steps and CSS implementation steps as completed in `CURRENT_WORK.md`.

### Test Results
- bun run typecheck: Pass (0 errors)
- bun run lint: Pass (0 errors, 2 pre-existing warnings)
- bun run test: Pass (42/42 tests)
- bun run verify:ui: Captured UI screenshots; visual adjustments were confirmed through generated artifacts.

### Outstanding
- UI/UX implementation for this visual refinement scope is complete. Future tasks remain in `MVP_ROADMAP.md`.

## 2026-09-20 — Calendar MVP completion

**Agent:** Codex
**Branch:** Native-Overhaul

### Work Completed

- Added a first-class `CalendarEvent` domain for one-time and weekly recurring series, with pure validation, local-date expansion, and overlap lanes.
- Added additive `calendar_events` SQLite persistence with one row per series and backward-compatible empty loading.
- Added the event editor with optional course/type, weekly controls, accessible errors, and whole-series edit/delete.
- Rebuilt Schedule month/week/day rendering around distinct events and task due dates, duration blocks, time-cell prefill, sticky context, and a minute-updated today-only now line.
- Added recurrence, boundaries, invalid-rule, local-date, overlap, course-removal, and SQLite close/reopen tests.
- Expanded the real Electron flow through one-time persistence, recurring create/edit/delete, occurrences, blocks, prefill, modes, and now lines.
- Updated planning documentation and narrowed `.gitignore` to `/data/` so `src/data/` source files are versionable.

### Test Results

- `bun run lint`: pass with 0 errors and 2 documented pre-existing warnings
- `bun run typecheck`: pass
- `bun run test`: 42/42 pass, 300 expectations
- `bun run verify:ui`: pass in Electron
- Screenshots reviewed: `ui-dashboard-1440x900.png`, `ui-calendar-week.png`, and `ui-calendar-day.png`

### Outstanding

- No Calendar MVP work remains.
- Per-occurrence exceptions, midnight-crossing events, drag rescheduling, reminders, and external calendar integrations remain out of scope.
- Unrelated Phase 2 polish items remain in `docs/MVP_ROADMAP.md`.

---

## 2026-09-20 — Dashboard UI/UX composition overhaul

**Agent:** Codex
**Branch:** Native-Overhaul

### Work Completed

- Audited the current wide, narrow, and edit-layout screenshots plus the shell, task, planner, and widget implementations.
- Reviewed the two user-supplied external design references and distilled the applicable principles into docs/UI_UX_CONTRACT.md; neither repository was installed.
- Replaced the old UI contract with a product-specific compact token system, scan hierarchy, responsive rules, anti-patterns, accessibility requirements, and an ASCII Dashboard wireframe.
- Constrained the application content to a centered 1320px responsive workbench with intentional desktop gutters.
- Refined the Dashboard header to emphasize the human-readable date and page title, removed repetitive marketing copy/footer text, and kept one primary Add task action.
- Reworked the three oversized statistics into compact due-soon, active-task, and overdue summaries; zero overdue is no longer styled as an alarm.
- Reorganized the task surface into a denser row-based table with one grouped search/filter band, quieter secondary actions, shorter current-year dates, textual overdue status, and preserved completion/reorder/edit/delete behavior.
- Renamed the calendar surface to Schedule, removed unnecessary fixed six-week month padding, shortened month cells, hid repeated day-add buttons until hover/focus, added a useful week-range label, and simplified the workload legend.
- Preserved widget drag/dock/keyboard movement, width-only resizing, and explicit Pin behavior; added Dashboard-scoped layout styling without altering domain or database logic.
- Updated scripts/verify-ui.ts for the existing width-only resize/Pin model and added 1600×900, 1440×900, and 1280×800 screenshot capture.
- Performed a screenshot critique and final restraint pass that removed duplicate actions/copy, repeated visible day-add controls, and the gap separating task search from filters.

### Test Results

- bun run lint: pass with the same 2 pre-existing warnings and 0 errors
- bun run typecheck: pass
- bun run test: 36/36 pass
- bun run verify:ui: pass in the real Electron window
- Screenshots reviewed: ui-dashboard-1600x900.png, ui-dashboard-1440x900.png, ui-dashboard-1280x800.png, ui-narrow-layout.png, ui-edit-layout.png, and ui-analytics.png

### Outstanding

- Phase 2 remains active for week/day time-grid readability, notes empty/long states, narrow course cards, complete keyboard-tab audit, sidebar/titlebar/error-state checks, and exhaustive empty/partial/full-row drop placement.
- No calendar domain work (recurrence, current-time indicator, click-to-create time blocks) was included.
- The worktree still contains the prior uncommitted layout/documentation work alongside this verified overhaul; no commit was created.

---

## 2026-09-20 — Documentation scaffold + layout/height system overhaul

**Agent:** Antigravity (Gemini)
**Branch:** Native-Overhaul

### Work Completed

**Layout system overhaul:**
- `src/data/layout.ts`: Added `EmptySlot` type, `emptySlots()`, `placeInSlot()`, `appendWidget()`. Fixed `dockWidget` to split available row space proportionally instead of always forcing 50/50. Simplified `widgetPositions`.
- `src/features/widget-layout.tsx`: Resize handle is now width-only (no Y tracking). Height is opt-in via `Minimize2` pin toggle. Uses `maxHeight` for pinned widgets. Added append zone below grid. Fixed slot computation to exclude the dragged widget. Removed disclaimer banner; replaced with compact Reset Layout toolbar.
- `src/styles/globals.css`: Added `.layout-toolbar`, `.widget-append-zone`, `.empty-slot-drop-zone` styles. Changed `.widget-fixed-height` from `height` to `maxHeight` semantics. Updated resize handle cursor from `nwse-resize` to `ew-resize`.
- `tests/layout.test.ts`: Added `emptySlots`, `placeInSlot`, `appendWidget` tests. All 36 tests pass.

**Documentation scaffold:**
- `AGENTS.md`: Rewritten from 7-line stub to full permanent agent protocol.
- `docs/PROJECT_CONTRACT.md`: Product definition, MVP priorities, out-of-scope items, acceptance standards.
- `docs/ARCHITECTURE.md`: Full architecture with process model, source layout, data flow, layer rules.
- `docs/UI_UX_CONTRACT.md`: Visual identity, typography, layout principles, interaction standards, component standards, accessibility, patterns to avoid.
- `docs/MVP_ROADMAP.md`: Authoritative backlog with checkboxes across all phases.
- `docs/CALENDAR_SPEC.md`: Current implementation + gap analysis for time indicator, recurring events, time blocks.
- `docs/QA_CONTRACT.md`: Test suite inventory, what must be tested, regression checklist, acceptable failure conditions.
- `docs/FUTURE_INTEGRATIONS.md`: Deferred features with rationale and candidate approaches.
- `docs/agent/CURRENT_WORK.md`: Populated with current state and Phase 2 audit plan.
- `docs/agent/DECISIONS.md`: Four architecture decisions recorded.
- `docs/agent/WORKLOG.md`: This file.

### Test Results
- `bun run typecheck`: clean
- `bun run lint`: 2 pre-existing warnings, 0 new errors
- `bun run test`: 36/36 pass

### Outstanding
- `bun run verify:ui` not yet run this session (requires Electron to be running)
- Current changes are unstaged — need `git add -A && git commit`
- Spurious staged file `how --stat c5f3fd6` needs `git restore --staged` before commit

---

## Session Template

Copy this block for each new session:

```
## YYYY-MM-DD — [Brief description]

**Agent:** [Model name]
**Branch:** [branch name]

### Work Completed
- 

### Test Results
- bun run typecheck:
- bun run lint:
- bun run test:
- bun run verify:ui:

### Outstanding
- 
```

# MVP ROADMAP
## Academic Dashboard — Native-Overhaul Branch

This is the authoritative project-level backlog. Update this file as work completes or priorities change. Do not track work only in chat conversations.

---

## Legend

- `[x]` Done and verified
- `[/]` In progress
- `[ ]` Not started
- `[-]` Deferred / out of scope

---

## Phase 1 — Foundation (Complete)

### Data Layer
- [x] SQLite schema via Bun SQL (`src/platform/database.ts`)
- [x] Atomic workspace load/save with revision checking
- [x] Workspace validation (`validLayouts`, `validateDashboardWorkspace`)
- [x] Pure task and priority domain logic (`src/data/planning.ts`)
- [x] Academic entity model (`src/data/academic.ts`)
- [x] Academic CSV/JSON import (`src/data/academicImport.ts`)
- [x] Internship model and import (`src/internships/`)

### Platform
- [x] Electron main process with sandboxed renderer
- [x] Preload context bridge (load/save only)
- [x] Bun data service with authenticated loopback
- [x] Native Window Controls Overlay title bar
- [x] Dev launcher (Bun + Vite + Electron)
- [x] Production build pipeline
- [x] UI smoke test (`scripts/verify-ui.ts`)

### Dashboard Features
- [x] Stat cards: upcoming (48h), total, overdue
- [x] Task list with search, filter, completion, drag-reorder
- [x] Task editor (course, date, time, priority)
- [x] Course management (add, edit, remove, semester grouping)
- [x] DARS / credit plan worksheet
- [x] Calendar: month view with workload heat map
- [x] Calendar: week / day time-grid views
- [x] Daily notes (Markdown, per-day, import/export)
- [x] Activity: cumulative due-vs-done chart
- [x] Activity: yearly completion heatmap
- [x] Settings: priority rules, keyword matching, course order
- [x] Internships tab: tracker, stats, categories, activity heatmap

### Layout System
- [x] 12-column widget grid with persist-to-SQLite
- [x] Legacy ordered-span/dock layouts normalize without data loss
- [x] Explicit row/column coordinates with deterministic collision reflow
- [x] Pointer-captured, frame-batched movement in both axes
- [x] Two-axis resize with snapped width and deliberate vertical height threshold
- [x] Four-direction keyboard movement, keyboard resizing, and live announcements
- [x] Explicit height pin toggle (`Minimize2`) with +/- steps and natural-height restore
- [x] `maxHeight` semantics (natural height by default, clips only when pinned)
- [x] Responsive visual stacking without mutating saved desktop geometry
- [x] Edit chrome wraps without clipping content controls

### Tests
- [x] 45 unit/integration tests across 6 files (all passing)

---

## Phase 2 — UI/UX Audit & Polish (Ongoing Polish Backlog)

> Objective: make the app feel stable, clear, and comfortable for daily use.
> No new features. Fix rough edges.

### Dashboard Composition Overhaul
- [x] Constrain meaningful content to a centered 1320px responsive workbench
- [x] Establish date → urgency → tasks → schedule → secondary-content scan path
- [x] Replace oversized stat treatment with compact due-soon / active / overdue summaries
- [x] Keep one primary Dashboard Add task action
- [x] Group task search and filters; retain compact row metadata and keyboard reordering
- [x] Reduce sparse month-calendar height and hide repeated day-add controls until hover/focus
- [x] Record the compact token system, accessibility rules, anti-patterns, and ASCII wireframe in the local UI/UX contract

### Layout System Polish
- [x] Verify move/resize collision reflow, bounds, legacy normalization, and persistence
- [x] Ensure no widget accidentally gets a fixed height without the Pin button
- [x] Confirm edit-mode overlay appearance is clean at representative desktop sizes

### Dashboard Polish
- [x] Task list: verify no unnecessary scrollbars appear without Pin
- [x] Stat summaries: review spacing and readability at representative widths
- [x] Stat summaries: ensure compact numbers remain fully visible
- [x] Planner: review month-view cell height consistency
- [ ] Planner: review week/day time-grid readability (cell height, time gutter width)
- [ ] Notes widget: verify natural height flow when no note exists vs. when note is long
- [ ] Courses panel: review course card grid at narrow widths

### Navigation & Shell
- [ ] Sidebar peek animation: confirm edge strip hover works reliably
- [ ] Title bar drag region: confirm dragging the window works correctly
- [ ] Page transition: confirm scroll-to-top works on all pages
- [ ] Error banner: verify visibility and dismiss behavior

### Accessibility Audit
- [ ] Keyboard-navigate all tab stops on Dashboard
- [x] Verify task/widget drag handles have correct aria-labels
- [ ] Confirm all empty states have correct text and CTA

### Cross-Width Testing
- [x] Test Dashboard at 1280×800
- [x] Test Dashboard at 1440×900
- [x] Test Dashboard at 1600×900
- [x] Test narrow responsive layout at 900×900 and page overflow at 700px

---

## Phase 3 — Calendar Completion (Complete)

> Objective: make the calendar a fully reliable daily-use tool while keeping scheduled events separate from actionable tasks.

### Event Domain and Persistence
- [x] Add first-class one-time and weekly recurring calendar-event series
- [x] Persist one row per series in an additive SQLite `calendar_events` table
- [x] Expand virtual occurrences only for the visible date range
- [x] Validate required fields, local dates, start/end time, weekdays, recurrence range, and unique IDs
- [x] Clear course associations without deleting events when a course is removed
- [x] Verify persistence across a full SQLite repository close and reopen

### Event Editor and Series Lifecycle
- [x] Dedicated event editor with title, optional course, type, date, start/end time
- [x] Weekly weekday selection with inclusive semester-style start/end dates
- [x] Accessible inline validation and save-error preservation
- [x] Create from an obvious Schedule action or a prefilled day/time cell
- [x] Edit and delete whole recurring series with explicit copy
- [-] Per-occurrence edits, cancellations, and exceptions (documented post-MVP extension)

### Current-Time Indicator
- [x] Week view: line and readable local-time label in today's column only
- [x] Day view: line and readable local-time label
- [x] Auto-scroll current time into view once on entry/navigation
- [x] Update at minute boundaries without second-level rendering or repeated forced scrolling

### Time-Block Reliability
- [x] Week/day event blocks use exact start/end position and duration
- [x] Overlapping scheduled events render in side-by-side lanes
- [x] Task deadlines remain distinct due markers/all-day due items
- [x] Month view retains workload while distinguishing event presence from tasks

### Calendar Navigation
- [x] Month day number opens day view
- [x] Week day header opens day view
- [x] Previous/next and Today work in all three modes
- [x] Time-grid headers and due row remain visible while scrolling

---

## Phase 4 — Data Quality

- [ ] Overdue task count: exclude completed tasks correctly (verify formula)
- [ ] Completion date recording: verify recorded on first check, not on re-open
- [ ] Task `kind` field: enforce `Assignment` | `To-Do` only (no arbitrary strings)
- [ ] Course color picker: replace free-text color input with a palette selector
- [ ] Import safety: show a preview before committing any import

---

## Phase 5 — Performance & Reliability

- [x] Widget layout: batch pointer previews to one `requestAnimationFrame` and persist only the final layout
- [x] Add repeatable production Electron startup/first/warm-navigation benchmark
- [x] Keep measured native-motion startup/render overhead within 10% of the pre-animation median
- [x] Remove redundant activity-heatmap tooltip component trees while preserving accessible labels
- [ ] Task list: virtualize if task count exceeds ~200 (do not pre-optimize)
- [ ] Notes: lazy load all notes except current day note
- [x] `verify:ui`: cover tasks, calendar events, settings, notes, credits, internships, and layout persistence

---

## Deferred (Out of MVP)

See `docs/FUTURE_INTEGRATIONS.md` for full detail.

- [-] iPhone / mobile app
- [-] Public hosting or cloud backend
- [-] Authentication / user accounts
- [-] Multi-device sync
- [-] Google Calendar integration
- [-] ChatGPT / Gemini AI integrations
- [-] Canvas LMS scraping
- [-] Stripe / payments

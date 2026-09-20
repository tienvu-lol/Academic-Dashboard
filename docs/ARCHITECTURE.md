# ARCHITECTURE
## Academic Dashboard — Native-Overhaul Branch

---

## Runtime Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Desktop host | Electron | latest (44+) |
| Runtime / package manager / test runner | Bun | 1.4.2 |
| UI framework | React | 19.3.0 |
| Bundler | Vite | latest |
| Language | TypeScript | 7.0.2 |
| Styling | Tailwind CSS | v4 |
| Component primitives | shadcn/ui + Radix UI | latest |
| Database client | Bun SQL (native) | built into Bun 1.4.2 |
| Database | SQLite | via Bun SQL |
| Linter | oxlint | latest |

---

## Process Model

```
┌──────────────────────────────────────────────────────────────┐
│  Electron Main Process  (electron/main.ts)                   │
│  - Creates BrowserWindow with contextIsolation + sandbox     │
│  - Starts Bun data service as child process                  │
│  - Forwards authenticated IPC from renderer to Bun service   │
│  - Native Window Controls Overlay (title bar)                │
└──────────────┬───────────────────────────────────────────────┘
               │  IPC (contextBridge)
               │
┌──────────────▼───────────────────────────────────────────────┐
│  Preload Script  (electron/preload.ts)                       │
│  - Exposes narrow workspace bridge: load / save / verify     │
│  - No Node integration in renderer                           │
└──────────────┬───────────────────────────────────────────────┘
               │  window.workspace.*
               │
┌──────────────▼───────────────────────────────────────────────┐
│  React Renderer  (Vite + React 19)                           │
│  src/main.tsx → src/features/app.tsx                        │
│  - Pure UI + state. No Node, no fs, no SQL.                  │
│  - All data through useDashboard hook                        │
└──────────────────────────────────────────────────────────────┘
               │  HTTP loopback (authenticated)
               │
┌──────────────▼───────────────────────────────────────────────┐
│  Bun Data Service  (src/platform/dashboard-server.ts)        │
│  - Receives load/save from Electron main via IPC             │
│  - Validates all writes (validLayouts, validateWorkspace)    │
│  - Revision-checked atomic transactions                      │
│  - Owns all SQL access                                       │
└──────────────┬───────────────────────────────────────────────┘
               │  Bun.SQL
               │
┌──────────────▼───────────────────────────────────────────────┐
│  SQLite Database  (BunSqlWorkspaceRepository)                │
│  src/platform/database.ts                                    │
│  Default: %LOCALAPPDATA%/AcademicDashboard/                  │
│           academic-dashboard.sqlite                          │
└──────────────────────────────────────────────────────────────┘
```

---

## Source Layout

```
src/
  main.tsx                  React entry point
  dashboard.ts              Re-exports from data layer (thin)

  features/                 React components — UI only, no business logic
    app.tsx                 Root app shell, navigation, page routing
    planner.tsx             Calendar widget (month/week/day)
    calendar-event-editor.tsx Dedicated scheduled-event editor
    tasks-panel.tsx         Task list with drag-reorder
    widget-layout.tsx       Draggable/resizable widget grid
    activity.tsx            Charts (cumulative due vs done, internship outcomes)
    activity-heatmap.tsx    GitHub-style yearly completion heatmap
    notes.tsx               Daily Markdown notes
    settings.tsx            Priority rules and course order settings
    categories.tsx          Category manager dialog
    credit-plan.tsx         DARS / degree credit worksheet
    forms.tsx               Task, course, and internship editors + confirm-delete
    use-dashboard.ts        Single data hook — connects renderer to preload bridge

  data/                     Pure domain logic — NO React, NO Electron, NO Vite
    calendar.ts             Event validation, recurrence expansion, overlap lanes
    planning.ts             Tasks, priorities, calendar loads, summary stats
    layout.ts               Widget placement, docking, slot logic
    academic.ts             Academic entity types and helpers
    academicImport.ts       CSV/JSON import for academic data

  internships/              Pure internship domain — NO React, NO Electron
    model.ts                Internship types, URL normalization, date helpers
    importing.ts            HTML/CSV/Markdown import

  platform/                 Platform I/O — NO React, NO UI
    database.ts             BunSqlWorkspaceRepository (SQLite schema + queries)
    workspace.ts            Workspace state type and atomic transaction helpers
    dashboard-server.ts     Authenticated Bun HTTP service
    runtime.ts              Environment detection helpers

  components/ui/            shadcn component copies — do not modify internals
    button.tsx, card.tsx, badge.tsx, calendar.tsx, checkbox.tsx,
    chart.tsx, collapsible.tsx, dialog.tsx, input.tsx, popover.tsx,
    progress.tsx, table.tsx, tabs.tsx, textarea.tsx, tooltip.tsx

  lib/
    utils.ts                cn() utility
    fibery.ts               Fibery API client (legacy integration, not in active use)

  styles/
    globals.css             All custom CSS: palette, Tailwind theme, layouts, widgets

electron/
  main.ts                   Electron main process
  preload.ts                Context bridge — the only renderer↔Node seam

scripts/
  dev.ts                    Development launcher (Bun service + Vite + Electron)
  build-electron.ts         Bundles electron/main.ts → dist-electron/main.mjs
  start.ts                  Production launcher
  verify-ui.ts              Automated Electron screenshot smoke test
  electron-runtime.ts       Shared Electron launch helpers

tests/
  calendar.test.ts          Unit tests: event validation, recurrence, overlap layout
  dashboard.test.ts         Unit tests: task logic, priority, settings, SQL
  database.test.ts          Integration tests: SQLite persistence
  layout.test.ts            Unit tests: widget layout, docking, slot logic
  academic.test.mjs         Unit tests: import, backup, fibery data
  internships.test.mjs      Unit tests: internship model and import
```

---

## Data Flow for a User Action

1. User clicks a button in a React component.
2. Component calls `change(draft => { /* immer-style mutation */ })` from `useDashboard`.
3. `useDashboard` serializes the new workspace state and calls `window.workspace.save(...)`.
4. Preload forwards the call to Electron main via IPC.
5. Electron main forwards to the Bun service over authenticated loopback HTTP.
6. Bun service validates and writes to SQLite in a single transaction.
7. Response (ok/error) propagates back through the chain.
8. React state updates; `busy` flag clears.

---

## Database Schema (summary)

Tables: `workspace_meta`, `academic_entities`, `academic_options`, `academic_documents`, `internships`, and `calendar_events`.

`calendar_events` stores one row per scheduled event series, not one row per occurrence. Its payload contains the event and weekly recurrence rule; start/end date columns describe the series range. Visible occurrences are expanded by pure domain logic in `src/data/calendar.ts`.

All writes use a single transaction. Revision checking prevents stale writes from overwriting newer data. Additive tables are created with `CREATE TABLE IF NOT EXISTS`, so a pre-calendar database opens without a destructive migration and yields an empty event collection.

## Calendar Domain Boundary

Tasks and scheduled events are deliberately separate workspace data. A task due date represents an obligation and completion state; a calendar event represents occupied time. The planner may render both, but it cannot convert between them implicitly. `src/data/calendar.ts` owns event validation, local-date recurrence expansion, and overlap-lane calculation. React owns only interaction and presentation.

The workspace remains version 2. `calendarEvents` is additive for backup compatibility, defaults to an empty array, and is validated before every service save. Course deletion clears matching event associations while preserving each event series.

---

## Layer Dependency Rules (enforced by architecture, checked manually)

```
features/  →  data/, platform/  (reads types only; no business logic in features/)
data/      →  (nothing — pure functions, no imports from other src layers)
internships/ → (nothing — pure functions)
platform/  →  data/, internships/  (for validation and types)
electron/  →  platform/  (only at build time, not bundled into renderer)
```

Violations of these rules require a DECISIONS.md entry and explicit user approval.

---

## Widget Layout System

The widget grid is a 12-column CSS Grid. Each widget has:
- `span`: number of columns (3–12)
- `height` (optional): when set, widget body clips at `maxHeight` and scrolls

Layout state is persisted per-page in `dashboardSettings.layouts`. The `src/data/layout.ts` module is fully pure — no React, no DOM.

Key functions: `widgetPositions`, `dockWidget`, `placeInSlot`, `appendWidget`, `emptySlots`, `resizeWidget`.

---

## Calendar System

The `Planner` component renders three modes: month (react-day-picker), week (custom time grid), day (custom time grid).

Current gaps (see MVP_ROADMAP.md):
- No recurring event support
- No current-time indicator
- Week/day time-blocks are display-only (tasks must have timed `due` to appear)

---

## Styling System

- Tailwind CSS v4 configured via `@tailwindcss/vite`.
- All custom variables, palette, and component overrides are in `src/styles/globals.css`.
- No CSS modules. No styled-components. No emotion.
- shadcn components use CVA for variants. Do not alter shadcn internals.
- `@shadcn/lint` is registered but no policy rules are enabled yet.

---

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `ACADEMIC_DASHBOARD_DATABASE` | OS default path | SQLite file location |
| `ACADEMIC_DASHBOARD_TITLE_BAR_COLOR` | `#000000` | WCO title bar background |
| `ACADEMIC_DASHBOARD_TITLE_BAR_SYMBOL_COLOR` | `#FFF7E4` | WCO button icon color |
| `ACADEMIC_DASHBOARD_TITLE_BAR_HEIGHT` | `30` | Title bar height in px |

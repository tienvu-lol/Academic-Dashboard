# Academic Dashboard

A local-first academic and internship workspace built on Electron, Bun, React, Vite, Tailwind CSS, and shadcn/ui. The interface uses a black background, cream text, and blue, green, and red accents.

## Workspace

- Dashboard: compact shadcn cards and table, upcoming (next 48 hours), total, and overdue counts; collapsible, searchable tasks with completion, editing, and deletion. Drag the left handles to reorder, or focus a handle and use Alt + Up/Down. Reset to priority order from the task toolbar.
- Task editor: course/category selection, mini date picker, optional due/start and end times, and per-task priority. Untimed tasks are due at the end of the selected local day.
- Calendar: shadcn month blocks plus week/day time views. Pending assignments create a red workload glow (0–5+). Completed tasks remain visible in green and no longer count toward red workload. Mixed days show separate pending/completed indicators; only an active task can be #1. Weekday headers stay continuous in split panels.
- Activity: cumulative due vs. completed lines for 30/90/365 days and a yearly completion heatmap. Completion dates are recorded when marking a task done and are editable in the completed task editor. Older completed records without dates are excluded from dated activity rather than assigned guessed dates. Reopening a task removes its completion date.
- Settings: reorder keyword, priority, due-date, and course rules; customize keywords and preferred course order. Defaults emphasize whole-word Test and Exam matches.
- Courses: semester/year grouping, colors, credits, and planned/in-progress/completed states. The DARS / credit plan tab provides an editable degree target (initially 120), custom requirements, course assignments, and planning notes. It is a personal worksheet, not an official degree audit; requirements may overlap.
- Daily notes: a dashboard widget and a searchable, sortable tab between Dashboard and Internships. One note is created per local day on launch or when an open app crosses midnight; no background service or missed-day backfill is added. Write or preview Markdown, expand the editor, save with Ctrl/Command + S, import .md files, and export .md copies. Navigation warns about unsaved edits. Raw HTML and remote images are not rendered.
- Internships: collapsible list/details, search, sorting, outcome/category filters, editable categories, and an annual application heatmap. Offers and rejections have separate totals and filter shortcuts; the smoothed outcome timeline includes applications, offers, and rejections by their recorded dates.
- Reorder categories in their manager using drag handles or Alt + Up/Down; dropdowns preserve the saved order.
- A compact icon-and-text navigation rail uses roughly 5% of the window width. The title-bar control hides it completely; the left edge reveals it temporarily. The title bar uses Electron's native controls, without WinUI 3 or another host.
- General data imports remain hidden. Existing data and import/domain modules are preserved; Markdown note import/export is available.

## Arrange your workspace

Use **Edit layout** at the bottom of the navigation rail on Dashboard or Internships. Drag a widget grip to another widget's left/right edge for a half-width split, or top/bottom to reorder. Every stat card, calendar, task list, graph, notes widget, and course panel moves independently. Corner handles resize width and height; the width menu and move arrows provide alternatives. Alt + Up/Down on a grip reorders; arrow keys on a resize handle change its size. **Auto height** restores a panel's natural height.

Changes save automatically to Bun SQL, separately for each tab. **Done editing** hides the controls; **Reset layout** restores just that tab's arrangement without changing records. Narrow windows stack panels in saved reading order; dense tables and fixed-height panels scroll internally. No layout library or additional native host is installed.

## Stack

- Bun 1.4.2 runtime, package manager, test runner, and SQL client
- Electron 44 native host with a React and Vite renderer
- Tailwind CSS v4 and shadcn/ui project configuration
- SQLite through the unified `Bun.SQL` API
- TypeScript 7
- Oxlint with `@shadcn/lint` registered

## Development

```sh
bun install
bun run dev
bun run test
bun run typecheck
bun run lint
bun run verify:ui
```

`bun run dev` starts the Bun data service, Vite development server, and Electron window. The workspace is available in the desktop window, not directly in a browser. Add shadcn components only when they are required:

```sh
bunx shadcn@latest add button
```

`bun run dev` builds the Electron main process, starts Vite, and launches the desktop window. `bun run build` produces the renderer and Electron main-process bundles; installer/signing tooling is intentionally not included.

No `@shadcn/lint` policy rules are enabled yet. Add chosen rules to the `rules` object in `.oxlintrc.json` after the design-system contract is defined.

`bun run start` builds and launches the production app without Vite. `bun run verify:ui` exercises the actual Electron UI using a temporary SQLite database and isolated browser profile, then closes it. It does not modify your database. A screenshot is saved under ignored `artifacts/`. To test production, run `bun run build` followed by `bun run verify:ui --production`.

## Data

The live workspace remains a SQLite database, not a JSON document. By default it is stored at:

- Windows: `%LOCALAPPDATA%/AcademicDashboard/academic-dashboard.sqlite`
- Linux/macOS fallback: `$XDG_DATA_HOME` or `$HOME` under `AcademicDashboard/`

Set `ACADEMIC_DASHBOARD_DATABASE` to override the database filename. The SQL schema stores workspace metadata, academic entities, documents, select options, and internships in separate indexed tables. Writes use a single transaction.

JSON, CSV, Markdown, and HTML import/backup domain modules are retained. General imports are not exposed; Daily notes can import/export Markdown. Existing documents and records are kept when editing other records. Removing a course/category clears its associations without deleting the tasks.

Bun alone owns SQL access. The sandboxed renderer has only load/save methods through a preload bridge; Electron forwards authenticated requests to a loopback-only Bun service. Saves are validated, transaction-backed, and revision-checked. Domain and priority logic have no React or Electron dependency.

## Source layout

```text
src/main.tsx                React entry point
src/features/               Dashboard, calendar, forms, internships, settings
src/components/ui/          shadcn UI primitives
src/styles/globals.css      Palette, Tailwind theme, and layouts
electron/main.ts            Sandboxed Electron window host
electron/preload.ts         Narrow workspace bridge
scripts/dev.ts              Bun-native Vite/Electron development launcher
scripts/verify-ui.ts        Isolated Electron interaction/screenshot check
src/platform/database.ts   Bun SQL repository and SQLite schema
src/platform/dashboard-server.ts  Authenticated loopback workspace service
src/platform/workspace.ts  Workspace state and atomic transactions
src/data/planning.ts        Pure task, calendar priority, and summary logic
src/data/                  Academic data model and imports
src/internships/           Internship data model and imports
tests/                     Bun unit and SQL integration tests
```

## Native title bar

Electron's native Window Controls Overlay is enabled without an additional native framework. Customize it with these environment variables before running the app:

- `ACADEMIC_DASHBOARD_TITLE_BAR_COLOR` (default `#000000`)
- `ACADEMIC_DASHBOARD_TITLE_BAR_SYMBOL_COLOR` (default `#FFF7E4`)
- `ACADEMIC_DASHBOARD_TITLE_BAR_HEIGHT` (default `30`)

The renderer has no Node integration, uses context isolation and Chromium sandboxing, denies permission requests, and blocks new windows and unexpected navigation.

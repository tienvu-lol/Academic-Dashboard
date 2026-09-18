# Academic Dashboard

A local-first academic and internship dashboard rendered natively by [GPUix](https://github.com/remorses/gpuix) and persisted to SQLite through Bun SQL.

## Stack

- Bun 1.4.2 runtime, package manager, test runner, and SQL client
- GPUix 0.9.0 native React renderer
- React 19.3
- SQLite through the unified `Bun.SQL` API
- TypeScript 7

GPUix and its native package are pinned to the same exact version, as required by the project’s compatibility guidance.

## Development

Ensure Bun is on `PATH`, then run:

```sh
bun install
bun run dev
```

The development command uses GPUix’s required hot-reload mode and opens the native dashboard window.

```sh
bun run test
bun run typecheck
```

## Data

The live workspace is a SQLite database, not a JSON document. By default it is stored at:

- Windows: `%LOCALAPPDATA%/AcademicDashboard/academic-dashboard.sqlite`
- Linux/macOS fallback: `$XDG_DATA_HOME` or `$HOME` under `AcademicDashboard/`

Set `ACADEMIC_DASHBOARD_DATABASE` to override the database filename. The SQL schema stores workspace metadata, academic entities, documents, select options, and internships in separate indexed tables. Writes use a single transaction.

JSON, CSV, Markdown, and HTML are supported as import or backup interchange formats. Complete backups are exported beside the SQLite database with the suffix `.backup.json`. Version 1 Windows-workspace JSON backups remain import-compatible.

## Source layout

```text
src/main.tsx                  GPUix render entry point
src/dashboard-components/    GPUix dashboard screens and controls
src/platform/database.ts     Bun SQL repository and SQLite schema
src/platform/workspace.ts    Workspace state and atomic transactions
src/data/                    Academic data model and imports
src/internships/             Internship data model and imports
tests/                       Bun unit and SQL integration tests
```

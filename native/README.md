# Academic Dashboard for Windows

React Native Windows desktop app using React 19, Hermes bytecode, Windows file dialogs, and local JSON persistence. Release builds run without a browser, web server, account, or Metro. All native TSX lives under `src/dashboard-components`.

## Run

Extract the entire portable ZIP and open `AcademicDashboard.exe`. Keep its DLLs and `Bundle` folder alongside it. Optionally run `powershell -ExecutionPolicy Bypass -File Install.ps1` from the extracted directory to install for the current user and add a Start menu shortcut. The portable app does not require Administrator access or Developer Mode. This unsigned x64 build is not a Microsoft Store release.

## Data and migration

The live file is `%LOCALAPPDATA%\AcademicDashboard\workspace.json`, separate from the application installation. Saves stage a complete transaction, write and flush a temporary file, then replace the live file. Failed saves preserve the previous data. One app instance can run at a time. Files are ordinary JSON, not encrypted. Export backups regularly from **Import & backup**.

1. In the existing web dashboard, export the academic backup and internship backup separately.
2. In the Windows app, choose the appropriate collection under **Import & backup** and select each JSON file.
3. Review counts and warnings, then import. Existing records retain manual edits and history.

Fibery CSV/JSON exports are accepted; import courses before assignments. Names, dates, course links, custom options, Markdown, and supported document JSON reuse the validated web import pipeline. Reference-only exports cannot supply document text absent from the export.

For internships, manually download the raw README or JSON from [SimplifyJobs Summer 2027](https://github.com/SimplifyJobs/Summer2027-Internships), choose the snapshot date and initial availability, then preview. CSV and pasted content work too. No background fetching or scraping runs. External links open when clicked. Google Calendar import remains disabled.

A complete desktop backup includes both databases and preferences. Imports merge records without removing existing ones. Corrupt live files are never automatically cleared; the recovery screen can export the existing file for inspection.

## Features

- Academics: tasks, courses, notes, Markdown descriptions, workload calendar, completion archive, monthly momentum, degree map, and page visibility/density controls.
- Internships: custom opportunities, search, filters, manual open/closed availability, sent date, deadlines, accepted/rejected/ghosted outcomes, tags, notes, and links.
- Semester chart: cumulative grey opportunities, lavender applications, glowing green acceptance, red rejection; configurable semester and application goal. Past-deadline pending applications are flagged for manual review.
- Native virtualized record lists, memoized calculations, and a chart drawn with native views. Shared business logic remains in root `src/data`, `src/internships`, and `src/completeWork.ts`.

## Build

Required: Node 24, Visual Studio 2026 C++ desktop Build Tools (v145), Windows SDK 10.0.26100.0, and .NET 10 SDK. The script installs PowerShell 7.6.1 into project-local `.tools` if needed. Initial npm/NuGet dependency restores need internet access.

From the repository root:

```powershell
pnpm native:install
pnpm native:check
pnpm native:build
```

The release command creates a timestamped portable directory and ZIP in `native/releases`, including the Windows App SDK and compiled JavaScript. Build details go to `native/build-release.log`. The optional MSIX template remains in `windows/AcademicDashboard.Package`; the script builds the unpackaged executable.

For development, run `npm start` inside `native`. In a second PowerShell terminal there:

```powershell
$env:Path = (Join-Path (Get-Location) '.tools') + ';' + $env:Path
npm run windows
```

Native storage tests: `npm test` inside `native`. Shared import/chart tests: `pnpm test` at root. For isolated testing, set `ACADEMIC_DASHBOARD_DATA_DIR` to a separate absolute directory before launching; close other instances first.

## Boundaries

This migration targets Windows desktop. Native Markdown is edited as text; original rich document JSON is preserved. The desktop app cannot automatically access browser storage; exported backups are the migration bridge.

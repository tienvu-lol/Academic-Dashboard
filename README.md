# Academic Dashboard for Windows

Academic Dashboard is a native Windows desktop application built with React Native Windows, C++, and Hermes. Release builds run fully offline without a browser or web server and store data in a local JSON workspace.

## Install the app

1. Build a release with `npm run build`, or obtain the portable ZIP from `releases/`.
2. Extract the complete ZIP. Keep the executable, DLLs, and `Bundle` folder together.
3. Run `Install.ps1` from the extracted folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\Install.ps1
```

The per-user installer copies the app to `%LOCALAPPDATA%\Programs\AcademicDashboard`, creates a Start menu shortcut, and adds that directory to the user `PATH`. Open a new terminal and launch it with:

```powershell
AcademicDashboard
```

Administrator access and Developer Mode are not required. The package is currently unsigned, so Windows may show a trust warning.

## Set up development

Requirements:

- Windows 11 x64
- Node.js 22.11 or newer
- Visual Studio 2026 Build Tools with the C++ desktop workload
- Windows SDK 10.0.26100.0
- .NET 10 SDK

From the repository root:

```powershell
npm run setup
npm run dev
```

`npm run setup` validates the toolchain, installs the locked npm dependencies, and installs project-local PowerShell 7.6.1 under `.tools`. `npm run dev` sets the required local tool path, starts the React Native Windows development workflow, builds the app, and launches it. No global React Native CLI installation is needed.

Useful commands:

```powershell
npm run metro      # Start only the Metro development server
npm run check      # Type-check and run all model/storage tests
npm run test       # Run all automated Node tests
npm run typecheck  # TypeScript only
npm run build      # Validate and create a portable release + ZIP
```

The release output is written to `releases/AcademicDashboard-Windows-x64-<timestamp>` with a matching ZIP. Build details are written to `build-release.log`.

## Data and migration

The live workspace is `%LOCALAPPDATA%\AcademicDashboard\workspace.json`, separate from the installation. Saves are staged and replaced atomically. Only one app instance can run at a time. Data is ordinary, unencrypted JSON.

Use **Import & backup** to import academic or internship JSON/CSV exports and to export a complete desktop backup. Imports merge records without deleting existing data. The old browser application's local storage cannot be read automatically; an exported backup is the migration bridge.

For isolated testing, set `ACADEMIC_DASHBOARD_DATA_DIR` to an absolute test directory before launch.

## Project layout

```text
src/dashboard-components/  Native Windows screens and controls
src/platform/              Native file persistence and runtime setup
src/data/                  Academic data model and imports
src/internships/           Internship data model and imports
windows/                   C++ React Native Windows host and packaging project
scripts/                   Setup, development, installer, and release scripts
tests/                     Unit, persistence, and desktop smoke tests
```

The optional MSIX project is under `windows/AcademicDashboard.Package`. The primary release process creates an unpackaged portable executable and ZIP.

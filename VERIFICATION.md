# Windows release verification

Verified on September 17, 2026 against `releases/AcademicDashboard-Windows-x64-20260917-151540` after the native project was moved to the repository root.

- Native TypeScript check passed.
- All 20 automated tests passed: 3 native persistence tests and 17 shared academic/internship model tests.
- Windows C++ Release build passed; JavaScript is compiled to Hermes bytecode and the Windows App SDK is included.
- The packaged executable passed desktop automation: creating an internship, manually closing it, importing CSV, choosing a file through the Windows picker, previewing duplicates, exporting a full backup through the Windows save dialog, archiving an academic assignment, and reopening persisted records after restart.

All desktop checks used `artifacts/smoke-data`, separate from personal data. The smoke test closes its app instances. Standard file-dialog buttons use verified pointer clicks because their accessibility provider does not expose Invoke; these clicks are blocked if another application's window covers the target.

To repeat from the repository root with other dashboard instances closed:

```powershell
./.tools/pwsh.exe -NoProfile -File tests/smoke-windows.ps1 -Executable 'ABSOLUTE-PATH-TO/AcademicDashboard.exe'
```

Portable ZIP SHA256: `A59CF2A0BF765617A5906FAF4F6FA34C61234434B11478FDBF8BA0AD1B4ABD47`.

This verifies the current Windows machine and fixture workflows, not every Windows hardware configuration or very large import performance. The package is unsigned.

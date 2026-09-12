# Windows release verification

Verified on September 12, 2026 against the portable x64 release in `releases/AcademicDashboard-Windows-x64-20260912-163223`.

- Native TypeScript check passed.
- Native local-storage tests: 3 passed (transaction rollback, concurrency protection, corrupt-file preservation, and reload).
- Shared academic/internship tests: 17 passed.
- Existing web TypeScript check and production build passed.
- Windows C++ Release build passed; JavaScript is compiled to Hermes bytecode and the Windows App SDK is included.
- The packaged executable passed desktop automation: creating an internship, manually closing it, importing CSV, choosing a file through the Windows picker, previewing duplicates, exporting a full backup through the Windows save dialog, archiving an academic assignment, and reopening persisted records after restart.

All desktop checks used `artifacts/smoke-data`, separate from personal data. The smoke test closes its app instances. Standard file-dialog buttons use verified pointer clicks because their accessibility provider does not expose Invoke; these clicks are blocked if another application's window covers the target.

To repeat from `native` with other dashboard instances closed:

```powershell
./.tools/pwsh.exe -NoProfile -File tests/smoke-windows.ps1 -Executable 'ABSOLUTE-PATH-TO/AcademicDashboard.exe'
```

Portable ZIP SHA256: `EC47A1C3D3ED08321C16A52A41A0AB6D0D81D9028313B707241E7C2DBB504CC6`.

This verifies the current Windows machine and fixture workflows, not every Windows hardware configuration or very large import performance. The package is unsigned.

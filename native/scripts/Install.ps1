# Optional per-user installation. Live data is kept in a separate directory.
$ErrorActionPreference = 'Stop'
$source = $PSScriptRoot
$destination = Join-Path $env:LOCALAPPDATA 'Programs/AcademicDashboard'
if (!(Test-Path (Join-Path $source 'AcademicDashboard.exe'))) { throw 'Extract the complete ZIP before running Install.ps1.' }
if (Get-Process AcademicDashboard -ErrorAction SilentlyContinue) { throw 'Close Academic Dashboard before installing an update.' }
if ([IO.Path]::GetFullPath($source) -eq [IO.Path]::GetFullPath($destination)) { throw 'Already running from the installation directory.' }
New-Item -ItemType Directory -Path $destination -Force | Out-Null
Get-ChildItem -LiteralPath $source | Copy-Item -Destination $destination -Recurse -Force
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Programs')) 'Academic Dashboard.lnk'))
$shortcut.TargetPath = Join-Path $destination 'AcademicDashboard.exe'
$shortcut.WorkingDirectory = $destination
$shortcut.IconLocation = $shortcut.TargetPath
$shortcut.Save()
Write-Host 'Installed. Open Academic Dashboard from the Start menu.'

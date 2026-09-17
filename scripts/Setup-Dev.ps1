$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $projectRoot
try {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (!$node) { throw 'Node.js 22.11 or newer is required and must be available on PATH.' }
    $nodeVersion = [Version]((& node --version).TrimStart('v'))
    if ($nodeVersion -lt [Version]'22.11.0') { throw "Node.js 22.11 or newer is required; found $nodeVersion." }

    $dotnet = Get-Command dotnet -ErrorAction SilentlyContinue
    if (!$dotnet) { throw '.NET 10 SDK is required and dotnet must be available on PATH.' }
    $sdks = & dotnet --list-sdks
    if (!($sdks | Where-Object { $_ -match '^10\.' })) { throw '.NET 10 SDK is required.' }

    $vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio/Installer/vswhere.exe'
    if (!(Test-Path -LiteralPath $vswhere)) { throw 'Visual Studio 2026 C++ desktop Build Tools are required.' }
    $msbuild = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -find 'MSBuild\**\Bin\MSBuild.exe' | Select-Object -First 1
    if (!$msbuild) { throw 'Install the Visual Studio C++ desktop workload, then rerun setup.' }

    & npm ci
    if ($LASTEXITCODE -ne 0) { throw 'npm dependency installation failed.' }

    if (!(Test-Path '.tools/pwsh.exe')) {
        New-Item -ItemType Directory -Path '.tools' -Force | Out-Null
        & dotnet tool install PowerShell --version 7.6.1 --tool-path .tools --add-source https://api.nuget.org/v3/index.json
        if ($LASTEXITCODE -ne 0) { throw 'Could not install project-local PowerShell 7.6.1.' }
    }

    Write-Host 'Development environment is ready.'
    Write-Host 'Run: npm run dev'
    Write-Host 'Check: npm run check'
    Write-Host 'Package: npm run build'
} finally {
    Pop-Location
}

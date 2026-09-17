$ErrorActionPreference = 'Stop'
$nativeRoot = Split-Path $PSScriptRoot -Parent
Push-Location $nativeRoot
try {
    if (!(Test-Path 'node_modules/react-native-windows/package.json')) { throw 'Run npm run setup from the repository root first.' }
    if (!(Test-Path '.tools/pwsh.exe')) {
        & dotnet tool install PowerShell --version 7.6.1 --tool-path .tools --add-source https://api.nuget.org/v3/index.json
        if ($LASTEXITCODE -ne 0) { throw 'Could not install project-local PowerShell 7.6.1. Install .NET 10 SDK and retry.' }
    }
    $env:Path = (Join-Path $nativeRoot '.tools') + ';' + $env:Path
    $vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio/Installer/vswhere.exe'
    $msbuild = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -find 'MSBuild\**\Bin\MSBuild.exe' | Select-Object -First 1
    if (!$msbuild) { throw 'Visual Studio 2026 C++ desktop Build Tools are required.' }
    & npm run typecheck
    if ($LASTEXITCODE -ne 0) { throw 'Native TypeScript check failed.' }
    & npm test
    if ($LASTEXITCODE -ne 0) { throw 'Native data tests failed.' }
    $solutionDir = ($nativeRoot -replace '\\', '/') + '/windows/'
    & $msbuild windows/AcademicDashboard/AcademicDashboard.vcxproj /restore /m:4 /p:Configuration=Release /p:Platform=x64 "/p:SolutionDir=$solutionDir" "/p:SolutionPath=${solutionDir}AcademicDashboard.sln" /p:SolutionFileName=AcademicDashboard.sln /p:UseBundle=true '/p:BundlerExtraArgs=--max-workers 4 --minify false' /v:minimal /nologo '/flp:logfile=build-release.log;verbosity=normal'
    if ($LASTEXITCODE -ne 0) { throw 'Windows compilation failed. See build-release.log.' }
    $binaryRoot = Join-Path $nativeRoot 'windows/x64/Release'
    if (!(Test-Path (Join-Path $binaryRoot 'AcademicDashboard.exe'))) { throw 'The expected executable was not produced.' }
    $releaseRoot = Join-Path $nativeRoot 'releases'
    $destination = Join-Path $releaseRoot ('AcademicDashboard-Windows-x64-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
    New-Item -ItemType Directory -Path $destination -Force | Out-Null
    & robocopy $binaryRoot $destination /E /NFL /NDL /NJH /NJS /XF '*.pdb' '*.lib' '*.exp' '*.ilk' /XD sourcemaps obj
    if ($LASTEXITCODE -ge 8) { throw 'Copying the standalone package failed.' }
    Copy-Item -LiteralPath (Join-Path $nativeRoot 'scripts/Install.ps1') -Destination $destination
    Copy-Item -LiteralPath (Join-Path $nativeRoot 'README.md') -Destination $destination
    $archive = $destination + '.zip'
    Compress-Archive -Path (Join-Path $destination '*') -DestinationPath $archive -CompressionLevel Optimal
    Get-FileHash -Algorithm SHA256 -LiteralPath $archive | Format-List
    Write-Host "Standalone executable: $destination\AcademicDashboard.exe"
    Write-Host "Portable ZIP: $archive"
} finally { Pop-Location }

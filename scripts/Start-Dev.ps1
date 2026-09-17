$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $projectRoot
try {
    $reactNative = Join-Path $projectRoot 'node_modules/.bin/react-native.cmd'
    if (!(Test-Path -LiteralPath $reactNative)) { throw 'Dependencies are missing. Run npm run setup first.' }
    $toolPath = Join-Path $projectRoot '.tools'
    if (Test-Path -LiteralPath $toolPath) { $env:Path = $toolPath + ';' + $env:Path }
    & $reactNative run-windows
    if ($LASTEXITCODE -ne 0) { throw 'The Windows development launch failed.' }
} finally {
    Pop-Location
}

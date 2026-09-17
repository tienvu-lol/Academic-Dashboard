param([Parameter(Mandatory=$true)][string]$Executable)
$ErrorActionPreference = 'Stop'
$nativeRoot = Split-Path $PSScriptRoot -Parent
Push-Location $nativeRoot
try {
    if (Get-Process AcademicDashboard -ErrorAction SilentlyContinue) { throw 'Close other Academic Dashboard instances before this isolated test.' }
    & node --import ./tests/register-ts.mjs tests/create-fixture.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Could not prepare test fixtures.' }
    $env:ACADEMIC_DASHBOARD_DATA_DIR = Join-Path $nativeRoot 'artifacts/smoke-data'
    $exportPath = Join-Path $nativeRoot ('artifacts/export-' + [guid]::NewGuid().ToString() + '.json')
    $testApp = Start-Process -FilePath $Executable -WindowStyle Normal -PassThru
    $testApp.Id | Set-Content artifacts/smoke-process.txt
    Start-Sleep -Seconds 4
    . ./tests/desktop-helpers.ps1
    Invoke-Element '02   Internships'
    Start-Sleep -Seconds 1
    Find-Element 'Internship applications' | Out-Null
    Invoke-Element '+ Add internship'
    Start-Sleep -Seconds 1
    Set-Field 'Company' 'Saved native company'
    Start-Sleep -Milliseconds 500
    Set-Field 'Role' 'Windows intern'
    Start-Sleep -Milliseconds 500
    Invoke-Element 'Open ▾'
    Invoke-Element 'Availability — changed manually: Closed'
    Start-Sleep -Milliseconds 500
    Invoke-Element 'Save internship'
    Start-Sleep -Seconds 2
    $saved = Get-Content artifacts/smoke-data/workspace.json -Raw | ConvertFrom-Json
    if (!($saved.internships.internships | Where-Object { $_.company -eq 'Saved native company' -and $_.availability -eq 'closed' })) { throw 'Native editor/manual status save failed.' }
    Write-Output 'PASS: native editor save and manual availability.'
    Invoke-Element '03   Import & backup'
    Find-Element 'Manual file import' | Out-Null
    Set-Field 'Or paste file contents' 'Company,Role,Location
Imported test company,Native intern,Remote'
    Start-Sleep -Milliseconds 500
    Invoke-Element 'Preview import'
    Invoke-Element 'Import 1 records'
    Start-Sleep -Seconds 2
    $saved = Get-Content artifacts/smoke-data/workspace.json -Raw | ConvertFrom-Json
    if ($saved.internships.internships.Count -ne 5) { throw 'Native CSV import failed.' }
    Write-Output 'PASS: CSV preview, import, and persistence.'
    Invoke-Element 'Choose CSV, JSON, or README file'
    Start-Sleep -Seconds 2
    Set-Field 'File name:' (Join-Path $nativeRoot 'artifacts/import-fixture.csv')
    Click-Element 'Open'
    Start-Sleep -Seconds 1
    Invoke-Element 'Preview import'
    Find-Element 'Import 0 records' | Out-Null
    Write-Output 'PASS: Windows file picker and duplicate import preview.'
    Invoke-Element 'Export complete backup'
    Start-Sleep -Seconds 2
    Set-Field 'File name:' $exportPath
    Click-Element 'Save'
    Start-Sleep -Seconds 2
    $backup = Get-Content -LiteralPath $exportPath -Raw | ConvertFrom-Json
    if ($backup.internships.internships.Count -ne 5) { throw 'Native backup export failed.' }
    Write-Output 'PASS: Windows backup export.'
    Invoke-Element '01   Academics'
    Find-Element 'Work, courses & notes' | Out-Null
    Invoke-Element 'Complete'
    Start-Sleep -Seconds 2
    $saved = Get-Content artifacts/smoke-data/workspace.json -Raw | ConvertFrom-Json
    if ($saved.academic.collections.'University/Assignments'.Count -ne 0 -or $saved.academic.collections.'University/Completed Work'.Count -ne 1) { throw 'Native completion archive failed.' }
    Write-Output 'PASS: native task completion and archive.'
    Stop-Process -Id $testApp.Id
    Start-Sleep -Seconds 1
    $testApp = Start-Process -FilePath $Executable -WindowStyle Normal -PassThru
    $testApp.Id | Set-Content artifacts/smoke-process.txt
    $script:appId = $testApp.Id
    Start-Sleep -Seconds 4
    Invoke-Element '02   Internships'
    Find-Element 'Imported test company' | Out-Null
    Find-Element 'Saved native company' | Out-Null
    Write-Output 'PASS: native editor/manual status save, CSV import, native file picker, duplicate preview, backup export, archive completion, and restart persistence.'
} catch {
    Get-AppWindows | ForEach-Object { $_.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition) } | Where-Object { $_.Current.ControlType -eq [System.Windows.Automation.ControlType]::Text } | Select-Object -Last 25 | ForEach-Object { Write-Output $_.Current.Name }
    Get-AppWindows | ForEach-Object { $_.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition) } | Where-Object { $_.Current.Name -eq 'Open' -or $_.Current.Name -eq 'Save' -or $_.Current.Name -eq 'Cancel' } | ForEach-Object { Write-Output ($_.Current.ControlType.ProgrammaticName + ': ' + $_.Current.Name); $_.GetSupportedPatterns().ProgrammaticName | Write-Output }
    throw
} finally {
    if ($testApp -and (Get-Process -Id $testApp.Id -ErrorAction SilentlyContinue)) { Stop-Process -Id $testApp.Id }
    Pop-Location
}

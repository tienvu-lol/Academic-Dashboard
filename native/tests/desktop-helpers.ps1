Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class DesktopInput {
  [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr value);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr window);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr window, int command);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr window, IntPtr target, uint flags);
}
'@
[DesktopInput]::SetThreadDpiAwarenessContext([IntPtr](-4)) | Out-Null
$script:appId = [int](Get-Content (Join-Path $PSScriptRoot '../artifacts/smoke-process.txt'))
function Get-AppWindows {
    $condition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ProcessIdProperty, $script:appId)
    [System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children, $condition)
}
function Find-Element([string]$name) {
    $condition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, $name)
    for ($attempt = 0; $attempt -lt 25; $attempt++) {
        foreach ($window in (Get-AppWindows)) {
            $element = $window.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)
            if ($element) { return $element }
        }
        Start-Sleep -Milliseconds 200
    }
    throw "Element missing: $name"
}
function Invoke-Element([string]$name) {
    $element = Find-Element $name
    for ($i = 0; $i -lt 4; $i++) {
        $pattern = $null
        if ($element.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$pattern)) { $pattern.Invoke(); Start-Sleep -Milliseconds 350; return }
        if ($element.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$pattern)) { $pattern.Select(); Start-Sleep -Milliseconds 350; return }
        $element = [System.Windows.Automation.TreeWalker]::ControlViewWalker.GetParent($element)
    }
    throw "Element cannot be invoked: $name"
}
function Set-Field([string]$name, [string]$value) {
    $element = Find-Element $name
    if ($element.Current.ControlType -ne [System.Windows.Automation.ControlType]::Edit) {
        foreach ($window in (Get-AppWindows)) {
            $elements = $window.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
            $element = $elements | Where-Object { $_.Current.Name -eq $name -and $_.Current.ControlType -eq [System.Windows.Automation.ControlType]::Edit } | Select-Object -First 1
            if ($element) { break }
        }
    }
    $pattern = $element.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
    $pattern.SetValue($value)
}
function Click-Element([string]$name) {
    $window = Get-AppWindows | Select-Object -First 1
    [DesktopInput]::ShowWindow([IntPtr]$window.Current.NativeWindowHandle, 9) | Out-Null
    [DesktopInput]::SetForegroundWindow([IntPtr]$window.Current.NativeWindowHandle) | Out-Null
    Start-Sleep -Milliseconds 500
    $element = Find-Element $name
    $bounds = $element.Current.BoundingRectangle
    if ($bounds.X -lt 0 -or $bounds.Y -lt 0) { throw "Element is outside the visible test window: $name" }
    [DesktopInput]::SetCursorPos([int]($bounds.X + $bounds.Width / 2), [int]($bounds.Y + $bounds.Height / 2)) | Out-Null
    [DesktopInput]::mouse_event(2, 0, 0, 0, [UIntPtr]::Zero)
    [DesktopInput]::mouse_event(4, 0, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 500
}
function Save-AppScreenshot([string]$filename) {
    $window = Get-AppWindows | Select-Object -First 1
    $bounds = $window.Current.BoundingRectangle
    $bitmap = New-Object Drawing.Bitmap([int]$bounds.Width, [int]$bounds.Height)
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    $target = $graphics.GetHdc()
    [DesktopInput]::PrintWindow([IntPtr]$window.Current.NativeWindowHandle, $target, 2) | Out-Null
    $graphics.ReleaseHdc($target)
    $bitmap.Save((Join-Path $PSScriptRoot "../artifacts/$filename"))
    $graphics.Dispose(); $bitmap.Dispose()
}

import { execSync } from 'child_process';

const ps = `
$ProgressPreference = 'SilentlyContinue'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$desktop = [System.Windows.Automation.AutomationElement]::RootElement
$cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty, "Shell_TrayWnd")
$taskbar = $desktop.FindFirst([System.Windows.Automation.TreeScope]::Children, $cond)
$r = $taskbar.Current.BoundingRectangle
$out = @{ TaskbarX = [int]$r.Left; TaskbarY = [int]$r.Top; TaskbarWidth = [int]$r.Width; TaskbarHeight = [int]$r.Height }
foreach ($id in @('StartButton','WidgetsButton','TaskbarFrame')) {
  $c2 = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty, $id)
  $el = $taskbar.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $c2)
  if ($null -ne $el) {
    $b = $el.Current.BoundingRectangle
    $out[$id + 'Left'] = [int]$b.Left
    $out[$id + 'Right'] = [int]$b.Right
    $out[$id + 'Top'] = [int]$b.Top
    $out[$id + 'Width'] = [int]$b.Width
  }
}
$out | ConvertTo-Json -Compress
`.trim();

const encoded = Buffer.from(ps, 'utf16le').toString('base64');
const stdout = execSync(`powershell.exe -NoProfile -NonInteractive -EncodedCommand ${encoded}`, {
  encoding: 'utf8',
  windowsHide: true,
  timeout: 15000
});
console.log(stdout.trim());
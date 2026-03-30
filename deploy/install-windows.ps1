#Requires -Version 5.1
<#
  在本机（Windows）上以计划任务常驻 youximudi：静态站 + /api。
  默认 SITE_PORT=59871（避免与 youxijia 等占用 80 的站点冲突）。
  youxijia 已在 server.js 按 Host: youximudi.com / www 反代到本机 59871；若改端口请设环境变量 YOUXIMUDI_UPSTREAM。

  若本机只有墓地站、非要直接占 80：-SitePort 80（需管理员）
    powershell -ExecutionPolicy Bypass -File .\deploy\install-windows.ps1 -SitePort 80
#>
param(
  [int]$SitePort = 59871
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$ServerDir = Join-Path $RepoRoot 'server'
$Node = (Get-Command node -ErrorAction Stop).Source
$FullSite = Join-Path $ServerDir 'full-site.mjs'

if (-not (Test-Path $FullSite)) { throw "找不到 $FullSite" }

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)

if ($SitePort -lt 1024 -and -not $isAdmin) {
  Write-Host '绑定端口小于 1024 需要管理员权限。请以管理员身份重新运行，或改用 -SitePort 59871'
  exit 1
}

$taskName = 'youximudi-fullsite'

$old = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($old) {
  Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# 结束可能手写启动的 node full-site
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -like '*full-site.mjs*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

# 使用 cmd /c 设置环境变量再启动，避免计划任务解析复杂
$actionArg = "/c set SITE_PORT=$SitePort&& set LISTEN_HOST=0.0.0.0&& `"$Node`" `"$FullSite`""
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument $actionArg -WorkingDirectory $ServerDir

$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

if ($isAdmin) {
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -User 'SYSTEM' -RunLevel Highest | Out-Null
} else {
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -User $env:USERNAME | Out-Null
}

Start-ScheduledTask -TaskName $taskName

if ($isAdmin) {
  Get-NetFirewallRule -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -like 'youximudi-site-TCP-*' } |
    Remove-NetFirewallRule -ErrorAction SilentlyContinue
  $ruleName = 'youximudi-site-TCP-' + $SitePort
  New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $SitePort | Out-Null
  Write-Host "Firewall: allowed TCP $SitePort ($ruleName)"
} else {
  Write-Host "Non-admin: firewall rule not added. Re-run as Administrator or open port $SitePort manually."
}

Write-Host "Scheduled task '$taskName' started. SITE_PORT=$SitePort"
Write-Host "本机测试: curl.exe http://127.0.0.1:$SitePort/api/health"

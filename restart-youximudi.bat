@echo off
chcp 65001 >nul
setlocal EnableExtensions

REM 一键重启墓地整站服务（full-site），与 deploy\install-windows.ps1 默认端口一致。
REM 如需改端口：先 set YOUXIMUDI_PORT=xxxx 再运行本 bat，或与计划任务里环境变量保持一致。
cd /d "%~dp0"

set "TASK_NAME=youximudi-fullsite"
if not defined YOUXIMUDI_PORT set "YOUXIMUDI_PORT=59871"

echo ============================
echo   youximudi 重启
echo   目录: %CD%
echo   端口: %YOUXIMUDI_PORT%
echo ============================
echo.

REM 1) 结束计划任务实例（若已用 install-windows.ps1 安装）
schtasks /Query /TN "%TASK_NAME%" >nul 2>&1
if %ERRORLEVEL% equ 0 (
  echo [1/3] 停止计划任务 "%TASK_NAME%" ...
  schtasks /End /TN "%TASK_NAME%" >nul 2>&1
) else (
  echo [1/3] 未找到计划任务 "%TASK_NAME%"（将仅按进程清理）
)

REM 2) 结束所有命令行含 full-site.mjs 的 node 进程
echo [2/3] 结束旧 node（full-site.mjs）...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$procs = Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -and ($_.CommandLine -like '*full-site.mjs*') }; ^
   foreach ($p in $procs) { Write-Host ('  PID ' + $p.ProcessId); Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }"

timeout /t 2 /nobreak >nul

REM 3) 启动：优先再跑计划任务；若无任务则本机直接起 node
schtasks /Query /TN "%TASK_NAME%" >nul 2>&1
if %ERRORLEVEL% equ 0 (
  echo [3/3] 启动计划任务 "%TASK_NAME%" ...
  schtasks /Run /TN "%TASK_NAME%"
  if errorlevel 1 (
    echo 计划任务启动失败。若任务是 SYSTEM 创建，请尝试「以管理员身份」运行本 bat。
    exit /b 1
  )
) else (
  echo [3/3] 无计划任务，直接启动 node full-site.mjs（端口 %YOUXIMUDI_PORT%）...
  if not exist "%~dp0server\full-site.mjs" (
    echo 找不到 server\full-site.mjs
    exit /b 1
  )
  start "youximudi-full-site" /min cmd /c "cd /d %~dp0server && set SITE_PORT=%YOUXIMUDI_PORT%&& set LISTEN_HOST=0.0.0.0&& node full-site.mjs"
)

echo.
echo 完成。健康检查示例:
echo   curl -s http://127.0.0.1:%YOUXIMUDI_PORT%/api/health
echo.
pause

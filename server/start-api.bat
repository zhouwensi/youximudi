@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PORT=8788
node server.mjs
pause

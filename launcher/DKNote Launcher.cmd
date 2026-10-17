@echo off
setlocal
start "" powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0DKNoteLauncher.ps1"
endlocal

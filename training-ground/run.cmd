@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or newer is required.
  pause
  exit /b 1
)
node simulate.mjs scenario.json report.html
if errorlevel 1 (
  echo Simulation failed. See the message above.
  pause
  exit /b 1
)
start "" "%~dp0report.html"

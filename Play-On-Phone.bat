@echo off
title Cleopatra's Gold - Phone Server
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js is not installed. Download it from https://nodejs.org
  echo.
  pause
  exit /b 1
)

start "" "http://localhost:8765/phone"
node server.js
pause

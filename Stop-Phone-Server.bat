@echo off
title Stop Cleopatra's Gold server
echo Stopping the phone server...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :8765 ^| findstr LISTENING') do taskkill /PID %%p /F >nul 2>nul
echo Done. The server will start again on next login
echo (or run Play-On-Phone.bat to start it now).
pause

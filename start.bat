@echo off
title QR Registration Server
color 0A

echo.
echo  =============================================
echo    SLU QR Registration System - Starting...
echo  =============================================
echo.

:: Kill any process already using port 3000
echo  [1/3] Releasing port 3000...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 /nobreak >nul

:: Start the Node server
echo  [2/3] Starting Node.js server...
start "" /B node server.js

:: Wait a moment then open the browser
timeout /t 2 /nobreak >nul
echo  [3/3] Opening browser...
start http://localhost:3000

echo.
echo  =============================================
echo   Server is running at http://localhost:3000
echo   Close this window to STOP the server.
echo  =============================================
echo.

:: Keep window open (closing it kills the server)
node server.js

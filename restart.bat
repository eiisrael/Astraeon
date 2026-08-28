@echo off
setlocal EnableExtensions EnableDelayedExpansion
title ASTRAEON Restart

cd /d "%~dp0"
set "PORT=3000"
set "FOUND=0"

echo.
echo ========================================
echo        ASTRAEON - RESTART LOCAL
echo ========================================
echo.

where npx.cmd >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Node.js / npx nao foi encontrado no PATH.
    echo Instale o Node.js e tente novamente.
    echo.
    pause
    exit /b 1
)

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
    set "FOUND=1"
    echo [ONLINE] Astraeon detectado na porta %PORT% - PID %%P.
    echo [RESTART] Encerrando processo %%P...
    taskkill /PID %%P /T /F >nul 2>&1
)

if "%FOUND%"=="0" (
    echo [OFFLINE] Nenhum servidor encontrado na porta %PORT%.
    echo [START] Iniciando Astraeon...
) else (
    echo [OK] Servidor anterior encerrado.
    timeout /t 1 /nobreak >nul
    echo [START] Iniciando Astraeon novamente...
)

start "ASTRAEON DEV" cmd /k "npx vercel dev"

timeout /t 2 /nobreak >nul
echo.
echo [OK] Comando enviado. Astraeon: http://localhost:%PORT%
echo [OK] Admin Studio: http://localhost:%PORT%/game-editor
echo.
exit /b 0

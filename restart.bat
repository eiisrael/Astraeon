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

where node.exe >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Node.js nao foi encontrado no PATH.
    echo Instale o Node.js 22 LTS e tente novamente.
    echo.
    pause
    exit /b 1
)

where npx.cmd >nul 2>&1
if errorlevel 1 (
    echo [ERRO] npm / npx nao foi encontrado no PATH.
    echo Reinstale o Node.js 22 LTS e tente novamente.
    echo.
    pause
    exit /b 1
)

for /f "usebackq delims=" %%V in (`node -p "process.versions.node"`) do set "NODE_VERSION=%%V"
for /f "tokens=1 delims=." %%M in ("!NODE_VERSION!") do set "NODE_MAJOR=%%M"

echo [INFO] Node.js !NODE_VERSION! detectado.

if !NODE_MAJOR! GEQ 24 (
    echo.
    echo [BLOQUEADO] Node.js !NODE_VERSION! no Windows pode derrubar CLIs com o erro:
    echo             UV_HANDLE_CLOSING - src\win\async.c
    echo.
    echo [CORRECAO] Use Node.js 22 LTS para o desenvolvimento local do Astraeon.
    echo.
    echo Se voce usa NVM for Windows:
    echo   1. nvm list available
    echo   2. instale uma versao 22.x exibida na lista
    echo   3. nvm use 22.x.x
    echo   4. node -v
    echo   5. execute restart.bat novamente
    echo.
    echo O servidor nao foi iniciado para evitar o crash nativo do Node/libuv.
    echo.
    pause
    exit /b 2
)

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
    set "FOUND=1"
    echo [ONLINE] Astraeon detectado na porta %PORT% - PID %%P.
    echo [RESTART] Encerrando processo %%P...
    powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Stop-Process -Id %%P -Force -ErrorAction SilentlyContinue" >nul 2>&1
)

if "%FOUND%"=="0" (
    echo [OFFLINE] Nenhum servidor encontrado na porta %PORT%.
    echo [START] Iniciando Astraeon...
) else (
    timeout /t 1 /nobreak >nul
    echo [OK] Limpeza da porta concluida.
    echo [START] Iniciando Astraeon novamente...
)

where vercel.cmd >nul 2>&1
if errorlevel 1 (
    start "ASTRAEON DEV" cmd /k "npx.cmd --yes vercel dev"
) else (
    start "ASTRAEON DEV" cmd /k "vercel.cmd dev"
)

timeout /t 2 /nobreak >nul
echo.
echo [OK] Comando enviado. Astraeon: http://localhost:%PORT%
echo [OK] Admin Studio: http://localhost:%PORT%/game-editor
echo.
exit /b 0

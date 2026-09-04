@echo off
setlocal EnableExtensions EnableDelayedExpansion
title ASTRAEON Restart

cd /d "%~dp0"
set "PORT=3000"
set "FOUND=0"
set "REQUIRED_NODE=22.23.2"
set "REQUIRED_NPM=10.9.8"

echo.
echo ========================================
echo        ASTRAEON - RESTART LOCAL
echo ========================================
echo.

where node.exe >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Node.js nao foi encontrado no PATH.
    echo [CORRECAO] Instale Node.js %REQUIRED_NODE% com NVM for Windows.
    echo.
    pause
    exit /b 1
)

for /f "usebackq delims=" %%V in (`node -p "process.versions.node"`) do set "NODE_VERSION=%%V"

if /I not "!NODE_VERSION!"=="%REQUIRED_NODE%" (
    where nvm.exe >nul 2>&1
    if not errorlevel 1 (
        echo [INFO] Node.js !NODE_VERSION! detectado. Ajustando para %REQUIRED_NODE%...
        nvm use %REQUIRED_NODE% >nul 2>&1
        for /f "usebackq delims=" %%V in (`node -p "process.versions.node"`) do set "NODE_VERSION=%%V"
    )
)

if /I not "!NODE_VERSION!"=="%REQUIRED_NODE%" (
    echo.
    echo [BLOQUEADO] Node.js !NODE_VERSION! nao corresponde ao toolchain do Astraeon.
    echo [CORRECAO] Use Node.js %REQUIRED_NODE%.
    echo.
    echo Com NVM for Windows:
    echo   nvm install %REQUIRED_NODE%
    echo   nvm use %REQUIRED_NODE%
    echo   node -v
    echo.
    echo O servidor nao foi iniciado para evitar incompatibilidades nativas do Node/libuv.
    echo.
    pause
    exit /b 2
)

where npm.cmd >nul 2>&1
if errorlevel 1 (
    echo [ERRO] npm nao foi encontrado no PATH.
    echo [CORRECAO] Reative Node.js %REQUIRED_NODE% pelo NVM.
    echo.
    pause
    exit /b 1
)

for /f "usebackq delims=" %%V in (`npm.cmd -v`) do set "NPM_VERSION=%%V"

if /I not "!NPM_VERSION!"=="%REQUIRED_NPM%" (
    echo.
    echo [BLOQUEADO] npm !NPM_VERSION! detectado. Astraeon usa npm %REQUIRED_NPM%.
    echo [CORRECAO] Execute: nvm use %REQUIRED_NODE%
    echo.
    pause
    exit /b 3
)

echo [OK] Node.js !NODE_VERSION! e npm !NPM_VERSION! prontos.

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

start "ASTRAEON DEV" cmd /k "npm.cmd run dev"

timeout /t 2 /nobreak >nul
echo.
echo [OK] Comando enviado. Astraeon: http://localhost:%PORT%
echo [OK] Admin Studio: http://localhost:%PORT%/game-editor
echo.
exit /b 0

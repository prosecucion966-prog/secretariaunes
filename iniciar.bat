@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Control de Aspirantes - UNES

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   No se encontro Node.js.
  echo   Instala Node.js 18 o superior desde https://nodejs.org
  echo.
  pause
  exit /b 1
)

rem Si la aplicacion ya esta corriendo, solo abre el navegador.
powershell -NoProfile -Command "try { $null = Invoke-WebRequest 'http://127.0.0.1:3000/api/estado' -UseBasicParsing -TimeoutSec 2; exit 0 } catch { exit 1 }"
if not errorlevel 1 (
  echo.
  echo   La aplicacion ya esta en ejecucion.
  echo   Abriendo http://127.0.0.1:3000 ...
  start "" "http://127.0.0.1:3000"
  ping -n 3 127.0.0.1 >nul
  exit /b 0
)

echo.
echo   ============================================
echo    CONTROL DE ASPIRANTES - UNES
echo   ============================================
echo.
echo   Iniciando el servidor...
echo.
echo   IMPORTANTE: no cierres esta ventana mientras
echo   uses la aplicacion.
echo.
echo   Direccion: http://127.0.0.1:3000
echo.
node server.js
echo.
echo   El servidor se detuvo. Revisa el mensaje de arriba.
echo.
pause

@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Diagnostico - Control de Aspirantes

echo.
echo   ============================================
echo    DIAGNOSTICO - CONTROL DE ASPIRANTES
echo   ============================================
echo.
echo   Carpeta: %CD%
echo.

echo   Node.js:
where node
if errorlevel 1 (
  echo   *** Node.js NO esta instalado o no esta en el PATH ***
) else (
  node --version
)
echo.

echo   Servidor en el puerto 3000:
powershell -NoProfile -Command "try { $r = Invoke-WebRequest 'http://127.0.0.1:3000/api/estado' -UseBasicParsing -TimeoutSec 3; Write-Host ('   ACTIVO (HTTP ' + $r.StatusCode + ')') } catch { Write-Host '   NO responde en http://127.0.0.1:3000' }"
echo.

echo   Archivos en esta carpeta:
dir /b
echo.

echo   Fin del diagnostico. Copia todo este texto si necesitas ayuda.
echo.
pause

@echo off
REM ════════════════════════════════════════════════
REM  BODEGA POS - Certificados HTTPS para el celular
REM
REM  Windows bloquea por defecto la ejecucion de
REM  scripts de PowerShell, asi que ni "npm run cert"
REM  arranca. Este archivo lo lanza igual, sin tener
REM  que cambiar ninguna configuracion del sistema.
REM
REM  Uso: doble clic, o  .\cert.bat  en la terminal
REM ════════════════════════════════════════════════

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\generar-certificados.ps1"

echo.
pause

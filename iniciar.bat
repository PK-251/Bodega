@echo off
REM ════════════════════════════════════════════════
REM  BODEGA POS - Servidor normal (HTTP)
REM
REM  Para usar en la PC y en el celular sin camara.
REM
REM  Uso: doble clic, o  .\iniciar.bat
REM  Para detenerlo: Ctrl+C
REM ════════════════════════════════════════════════

cd /d "%~dp0"
node server\server.js
pause

@echo off
REM ════════════════════════════════════════════════
REM  BODEGA POS - Servidor HTTPS (para el celular)
REM
REM  Necesario para usar la camara del celular.
REM  Antes hay que correr cert.bat una vez.
REM
REM  Uso: doble clic, o  .\iniciar-https.bat
REM  Para detenerlo: Ctrl+C
REM ════════════════════════════════════════════════

cd /d "%~dp0"
node server\server-https.js
pause

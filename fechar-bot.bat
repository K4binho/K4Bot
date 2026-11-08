@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "E:\projetos\K4Bot\parar-bot.ps1"
echo Esta janela fecha em 3 segundos.
timeout /t 3 /nobreak >nul
endlocal

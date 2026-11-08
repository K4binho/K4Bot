@echo off
setlocal
set "ROOT=E:\projetos\K4Bot"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=Get-CimInstance Win32_Process | Where-Object { $_.Name -in @('powershell.exe','pwsh.exe') -and $_.CommandLine -match '(?i)E:\\projetos\\K4Bot\\iniciar-bot\.ps1' }; if($p){exit 10}else{exit 0}"
if %errorlevel%==10 (
  echo K4Bot ja esta iniciado. Nenhuma acao necessaria.
  goto done
)
echo Iniciando K4Bot pelo VBS...
start "" "%ROOT%\iniciar-bot.vbs"
echo Iniciador chamado em segundo plano.
:done
echo Esta janela fecha em 3 segundos.
timeout /t 3 /nobreak >nul
endlocal

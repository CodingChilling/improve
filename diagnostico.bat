@echo off
rem Abre Ascenso igual que el icono, pero con consola para ver cualquier error.
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (py servidor.py --app) else (python servidor.py --app)
echo.
echo Si ha aparecido algun error, copialo. Tambien queda guardado en ascenso.log
pause

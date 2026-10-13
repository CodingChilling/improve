@echo off
rem Arranca Ascenso con su base de datos. Deja esta ventana abierta mientras lo usas.
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (py servidor.py %*) else (python servidor.py %*)
if errorlevel 1 (
  echo.
  echo No se pudo arrancar. Comprueba que tienes Python instalado: https://www.python.org/downloads/
)
pause

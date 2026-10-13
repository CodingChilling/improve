@echo off
rem Crea el icono de Ascenso en el escritorio y en el menu Inicio.
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (py instalar.py %*) else (python instalar.py %*)
if errorlevel 1 (
  echo.
  echo No se pudo crear el icono. Comprueba que tienes Python instalado: https://www.python.org/downloads/
)
pause

#!/usr/bin/env python3
"""
Crea el icono de Ascenso para abrirlo como una aplicación más.

    python instalar.py          -> crea el icono (escritorio y menú de aplicaciones)
    python instalar.py --quitar -> quita los iconos creados

Al pulsar el icono se arranca el servidor sin ventanas de consola, Ascenso se abre
en su propia ventana (sin barras del navegador) y, al cerrarla, todo se cierra solo.

Si mueves la carpeta de Ascenso a otro sitio, vuelve a ejecutar este instalador.
"""
import os
import subprocess
import sys
import tempfile

BASE = os.path.dirname(os.path.abspath(__file__))
SERVIDOR = os.path.join(BASE, "servidor.py")
ICONOS = os.path.join(BASE, "assets", "icono")
NOMBRE = "Ascenso"


# ------------------------------------------------------------------ Windows

def powershell(script):
    # Se escribe en un archivo con BOM para que PowerShell lea bien tildes y eñes de las rutas
    with tempfile.NamedTemporaryFile("w", suffix=".ps1", delete=False, encoding="utf-8-sig") as f:
        f.write(script)
        ruta = f.name
    try:
        subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ruta], check=True)
    finally:
        os.remove(ruta)


def windows(quitar):
    texto = lambda s: s.replace("'", "''")   # comillas simples dentro de cadenas de PowerShell
    carpetas = "@([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))"
    if quitar:
        powershell(f"foreach ($d in {carpetas}) {{ Remove-Item -ErrorAction SilentlyContinue (Join-Path $d '{NOMBRE}.lnk') }}")
        return "Iconos quitados del escritorio y del menú Inicio."
    # pythonw.exe arranca Python sin abrir una ventana de consola
    pythonw = os.path.join(os.path.dirname(sys.executable), "pythonw.exe")
    if not os.path.isfile(pythonw):
        pythonw = sys.executable
    icono = os.path.join(ICONOS, "ascenso.ico")
    powershell(f"""
$ws = New-Object -ComObject WScript.Shell
foreach ($d in {carpetas}) {{
  $s = $ws.CreateShortcut((Join-Path $d '{NOMBRE}.lnk'))
  $s.TargetPath = '{texto(pythonw)}'
  $s.Arguments = '"{texto(SERVIDOR)}" --app'
  $s.WorkingDirectory = '{texto(BASE)}'
  $s.IconLocation = '{texto(icono)},0'
  $s.Description = 'Ascenso: hábitos, tareas y una frase para cada día'
  $s.Save()
}}
""")
    return "Icono creado en el escritorio y en el menú Inicio."


# ------------------------------------------------------------------ macOS

def macos(quitar):
    app = os.path.expanduser(f"~/Applications/{NOMBRE}.app")
    if quitar:
        subprocess.run(["rm", "-rf", app], check=True)
        return "Aplicación quitada de tu carpeta Aplicaciones."
    macos_dir = os.path.join(app, "Contents", "MacOS")
    recursos = os.path.join(app, "Contents", "Resources")
    os.makedirs(macos_dir, exist_ok=True)
    os.makedirs(recursos, exist_ok=True)
    comillas = lambda s: "'" + s.replace("'", "'\\''") + "'"
    lanzador = os.path.join(macos_dir, NOMBRE)
    with open(lanzador, "w", encoding="utf-8") as f:
        f.write(f"#!/bin/sh\ncd {comillas(BASE)}\nexec {comillas(sys.executable)} {comillas(SERVIDOR)} --app\n")
    os.chmod(lanzador, 0o755)
    with open(os.path.join(app, "Contents", "Info.plist"), "w", encoding="utf-8") as f:
        f.write(f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>{NOMBRE}</string>
  <key>CFBundleDisplayName</key><string>{NOMBRE}</string>
  <key>CFBundleIdentifier</key><string>local.ascenso.app</string>
  <key>CFBundleExecutable</key><string>{NOMBRE}</string>
  <key>CFBundleIconFile</key><string>ascenso</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>LSUIElement</key><true/>
</dict>
</plist>
""")
    with open(os.path.join(ICONOS, "ascenso.icns"), "rb") as src, open(os.path.join(recursos, "ascenso.icns"), "wb") as dst:
        dst.write(src.read())
    subprocess.run(["touch", app])   # para que el Finder refresque el icono
    return f"Aplicación creada en {app}. Puedes arrastrarla al Dock."


# ------------------------------------------------------------------ Linux

def carpeta_escritorio():
    try:
        r = subprocess.run(["xdg-user-dir", "DESKTOP"], capture_output=True, text=True)
        if r.returncode == 0 and r.stdout.strip():
            return r.stdout.strip()
    except OSError:
        pass
    return os.path.expanduser("~/Desktop")


def linux(quitar):
    destinos = [os.path.expanduser("~/.local/share/applications/ascenso.desktop")]
    escritorio = carpeta_escritorio()
    if os.path.isdir(escritorio):
        destinos.append(os.path.join(escritorio, "ascenso.desktop"))
    if quitar:
        for d in destinos:
            if os.path.exists(d):
                os.remove(d)
        return "Iconos quitados."
    comillas = lambda s: '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'
    contenido = f"""[Desktop Entry]
Type=Application
Name={NOMBRE}
Comment=Hábitos, tareas y una frase para cada día
Exec={comillas(sys.executable)} {comillas(SERVIDOR)} --app
Path={BASE}
Icon={os.path.join(ICONOS, "icono-512.png")}
Terminal=false
Categories=Utility;
StartupNotify=true
"""
    for d in destinos:
        os.makedirs(os.path.dirname(d), exist_ok=True)
        with open(d, "w", encoding="utf-8") as f:
            f.write(contenido)
        os.chmod(d, 0o755)
    return "Icono creado en el menú de aplicaciones y en el escritorio."


def main():
    quitar = "--quitar" in sys.argv[1:]
    if sys.platform.startswith("win"):
        mensaje = windows(quitar)
    elif sys.platform == "darwin":
        mensaje = macos(quitar)
    else:
        mensaje = linux(quitar)
    print("\n  " + mensaje + "\n")


if __name__ == "__main__":
    main()

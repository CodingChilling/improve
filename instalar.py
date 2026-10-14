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

BASE = os.path.dirname(os.path.abspath(__file__))
SERVIDOR = os.path.join(BASE, "servidor.py")
ICONOS = os.path.join(BASE, "assets", "icono")
NOMBRE = "Ascenso"
DESCRIPCION = "Ascenso: hábitos, tareas y una frase para cada día"


# ------------------------------------------------------------------ Windows
# El acceso directo se crea con la propia API de Windows (IShellLink), llamada desde
# Python con ctypes. No se lanza ningún otro programa ni se crean scripts temporales.

CSIDL_PROGRAMS = 0x0002            # menú Inicio > Programas
CSIDL_DESKTOPDIRECTORY = 0x0010    # escritorio (también si está redirigido a OneDrive)


def carpeta_windows(csidl):
    import ctypes
    ruta = ctypes.create_unicode_buffer(260)
    if ctypes.windll.shell32.SHGetFolderPathW(None, csidl, None, 0, ruta) != 0:
        raise OSError("no se encontró la carpeta del sistema %#x" % csidl)
    return ruta.value


def crear_acceso_directo(archivo_lnk, destino, argumentos, carpeta_trabajo, icono, descripcion):
    import ctypes
    from ctypes import wintypes

    class GUID(ctypes.Structure):
        _fields_ = [("Data1", wintypes.DWORD), ("Data2", wintypes.WORD),
                    ("Data3", wintypes.WORD), ("Data4", ctypes.c_ubyte * 8)]

    ole32 = ctypes.windll.ole32

    def guid(texto):
        g = GUID()
        if ole32.CLSIDFromString(texto, ctypes.byref(g)) != 0:
            raise OSError("identificador no válido: " + texto)
        return g

    clsid_shell_link = guid("{00021401-0000-0000-C000-000000000046}")
    iid_ishelllinkw = guid("{000214F9-0000-0000-C000-000000000046}")
    iid_ipersistfile = guid("{0000010B-0000-0000-C000-000000000046}")

    def llamar(objeto, posicion, nombre, tipos, *argumentos_llamada):
        """Llama al método número `posicion` de la tabla de métodos de un objeto COM."""
        tabla = ctypes.cast(objeto, ctypes.POINTER(ctypes.POINTER(ctypes.c_void_p))).contents
        metodo = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p, *tipos)(tabla[posicion])
        resultado = metodo(objeto, *argumentos_llamada)
        if resultado < 0:
            raise OSError("%s ha fallado (código 0x%08X)" % (nombre, resultado & 0xFFFFFFFF))
        return resultado

    com_iniciado = ole32.CoInitialize(None) >= 0
    enlace = ctypes.c_void_p()
    try:
        resultado = ole32.CoCreateInstance(ctypes.byref(clsid_shell_link), None, 1,   # 1 = en este proceso
                                           ctypes.byref(iid_ishelllinkw), ctypes.byref(enlace))
        if resultado != 0:
            raise OSError("Windows no ha podido preparar el acceso directo (código 0x%08X)" % (resultado & 0xFFFFFFFF))
        texto = ctypes.c_wchar_p
        # Posiciones de los métodos en IShellLinkW (después de los 3 de IUnknown)
        llamar(enlace, 20, "SetPath", [texto], destino)
        llamar(enlace, 11, "SetArguments", [texto], argumentos)
        llamar(enlace, 9, "SetWorkingDirectory", [texto], carpeta_trabajo)
        llamar(enlace, 17, "SetIconLocation", [texto, ctypes.c_int], icono, 0)
        llamar(enlace, 7, "SetDescription", [texto], descripcion)
        # Se guarda en disco a través de su interfaz IPersistFile
        guardar = ctypes.c_void_p()
        llamar(enlace, 0, "QueryInterface", [ctypes.POINTER(GUID), ctypes.POINTER(ctypes.c_void_p)],
               ctypes.byref(iid_ipersistfile), ctypes.byref(guardar))
        try:
            llamar(guardar, 6, "Save", [texto, wintypes.BOOL], archivo_lnk, True)
        finally:
            llamar(guardar, 2, "Release", [])
    finally:
        if enlace.value:
            llamar(enlace, 2, "Release", [])
        if com_iniciado:
            ole32.CoUninitialize()


def windows(quitar):
    destinos = [os.path.join(carpeta_windows(c), NOMBRE + ".lnk")
                for c in (CSIDL_DESKTOPDIRECTORY, CSIDL_PROGRAMS)]
    if quitar:
        for d in destinos:
            if os.path.exists(d):
                os.remove(d)
        return "Iconos quitados del escritorio y del menú Inicio."
    # pythonw.exe arranca Python sin abrir una ventana de consola
    pythonw = os.path.join(os.path.dirname(sys.executable), "pythonw.exe")
    if not os.path.isfile(pythonw):
        pythonw = sys.executable
    try:
        for d in destinos:
            crear_acceso_directo(d, pythonw, '"%s" --app' % SERVIDOR, BASE,
                                 os.path.join(ICONOS, "ascenso.ico"), DESCRIPCION)
    except OSError as e:
        sys.exit(
            "\n  No se pudo crear el icono: %s\n\n"
            "  Puedes crearlo a mano: clic derecho en el escritorio > Nuevo > Acceso directo,\n"
            "  y como ubicación escribe:\n\n"
            '    "%s" "%s" --app\n\n'
            "  Después, en Propiedades > Cambiar icono, elige %s\n"
            % (e, pythonw, SERVIDOR, os.path.join(ICONOS, "ascenso.ico"))
        )
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

#!/usr/bin/env python3
"""
Prepara los archivos que la aplicación instalable (PWA) necesita y que dependen de lo que hay en la carpeta:

    assets/images/lista.json   lista de las imágenes del día (el navegador no puede mirar la carpeta).
                               Va en el repositorio: ejecútalo y sube el cambio al añadir o quitar imágenes.
    assets/precache.js         versión y lista de archivos que el service worker guarda en el dispositivo
    ascenso.html               la política de seguridad (CSP), con el proyecto de Supabase de assets/js/config.js

Se ejecuta al publicar (ver .github/workflows/pages.yml) o a mano:

    python3 herramientas/generar.py                      # genera los archivos en su sitio
    python3 herramientas/generar.py --publicar _sitio    # y además copia a _sitio solo lo que se publica

Solo usa la biblioteca estándar. La aplicación no lo necesita para funcionar.
"""
import hashlib
import json
import os
import re
import shutil
import sys
from urllib.parse import quote, unquote, urlparse

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGENES = os.path.join(BASE, "assets", "images")
IMG_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}

# Lo que forma la aplicación publicada (rutas relativas a la carpeta del repositorio). Todo lo demás
# (servidor.py, lanzadores, pruebas, herramientas…) no se publica.
ARCHIVOS_APP = ["ascenso.html", "index.html", "service-worker.js"]
CARPETAS_APP = ["assets/css", "assets/js", "assets/vendor", "assets/icono"]
SUELTOS_APP = ["assets/manifest.webmanifest", "assets/images/lista.json"]
NO_PUBLICAR = {".icns", ".ico"}          # iconos de la versión de escritorio


def leer(ruta):
    with open(os.path.join(BASE, ruta), encoding="utf-8") as f:
        return f.read()


def escribir(ruta, texto):
    with open(os.path.join(BASE, ruta), "w", encoding="utf-8", newline="\n") as f:
        f.write(texto)


def listar_imagenes():
    """La misma lista que da servidor.py en /api/imagenes, con rutas relativas a la página."""
    imagenes = []
    for raiz, carpetas, archivos in os.walk(IMAGENES):
        carpetas[:] = sorted(c for c in carpetas if not c.startswith("."))
        for nombre in sorted(archivos):
            if os.path.splitext(nombre)[1].lower() in IMG_EXT:
                ruta = os.path.relpath(os.path.join(raiz, nombre), BASE).replace(os.sep, "/")
                imagenes.append({"nombre": nombre, "url": quote(ruta)})
    return imagenes


def archivos_app():
    """Los archivos de la aplicación, sin las imágenes del día."""
    rutas = list(ARCHIVOS_APP) + list(SUELTOS_APP)
    for carpeta in CARPETAS_APP:
        for raiz, carpetas, archivos in os.walk(os.path.join(BASE, carpeta)):
            carpetas[:] = sorted(c for c in carpetas if not c.startswith("."))
            for nombre in sorted(archivos):
                if nombre.startswith(".") or os.path.splitext(nombre)[1].lower() in NO_PUBLICAR:
                    continue
                rutas.append(os.path.relpath(os.path.join(raiz, nombre), BASE).replace(os.sep, "/"))
    return sorted(set(rutas))


def proyecto_supabase():
    """Dominio del proyecto de Supabase configurado en assets/js/config.js (o None si no hay)."""
    m = re.search(r'supabaseUrl\s*:\s*"([^"]*)"', leer("assets/js/config.js"))
    url = urlparse(m.group(1).strip()) if m else None
    if not url or not url.hostname:
        return None
    if url.scheme != "https" or not re.fullmatch(r"[a-z0-9.-]+", url.hostname):
        sys.exit("assets/js/config.js: supabaseUrl debe ser una dirección https://… válida")
    return url.hostname


def politica_seguridad():
    conexiones = "'self'"
    dominio = proyecto_supabase()
    if dominio:
        conexiones += " https://%s wss://%s" % (dominio, dominio)
    return ("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; "
            "font-src 'self' data:; connect-src %s; worker-src 'self'; manifest-src 'self'; "
            "object-src 'none'; base-uri 'none'; form-action 'none'" % conexiones)


def actualizar_csp():
    html = leer("ascenso.html")
    nuevo, veces = re.subn(r'(<meta http-equiv="Content-Security-Policy" content=")[^"]*(">)',
                           lambda m: m.group(1) + politica_seguridad() + m.group(2), html)
    if veces != 1:
        sys.exit("ascenso.html: no encuentro la etiqueta de la política de seguridad (CSP)")
    if nuevo != html:
        escribir("ascenso.html", nuevo)
    return nuevo != html


def main():
    cambiada = actualizar_csp()
    print("ascenso.html: política de seguridad %s (%s)" % ("actualizada" if cambiada else "al día", proyecto_supabase() or "sin cuenta"))

    imagenes = listar_imagenes()
    escribir("assets/images/lista.json", json.dumps(imagenes, ensure_ascii=False, indent=0) + "\n")
    print("assets/images/lista.json: %d imágenes" % len(imagenes))

    # La versión cambia cuando cambia cualquier archivo de la aplicación (o la lista de imágenes)
    app = archivos_app()
    huella = hashlib.sha256()
    for ruta in app:
        huella.update(ruta.encode("utf-8") + b"\0")
        with open(os.path.join(BASE, ruta), "rb") as f:
            huella.update(hashlib.sha256(f.read()).digest())
    precache = {
        "version": huella.hexdigest()[:16],
        # service-worker.js no se guarda a sí mismo; index.html solo redirige
        "app": [quote(r) for r in app if r not in ("service-worker.js", "index.html")],
        "imagenes": [i["url"] for i in imagenes],
    }
    escribir("assets/precache.js", "// Generado por herramientas/generar.py. No editar.\nself.ASCENSO_PRECACHE = %s;\n"
             % json.dumps(precache, ensure_ascii=False, indent=1))
    print("assets/precache.js: versión %s, %d archivos y %d imágenes" % (precache["version"], len(precache["app"]), len(imagenes)))

    if "--publicar" in sys.argv:
        # Copia a otra carpeta solo lo que forma la aplicación (lo que sube el workflow a GitHub Pages)
        destino = os.path.abspath(sys.argv[sys.argv.index("--publicar") + 1])
        rutas = app + ["assets/precache.js"] + [unquote(i["url"]) for i in imagenes]
        for ruta in rutas:
            final = os.path.join(destino, *ruta.split("/"))
            os.makedirs(os.path.dirname(final), exist_ok=True)
            shutil.copyfile(os.path.join(BASE, *ruta.split("/")), final)
        print("%s: %d archivos listos para publicar" % (destino, len(rutas)))


if __name__ == "__main__":
    main()

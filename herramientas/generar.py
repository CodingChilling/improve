#!/usr/bin/env python3
"""
Genera los archivos que la aplicación instalable (PWA) necesita y que dependen de lo que hay en la carpeta:

    assets/images/lista.json   lista de las imágenes del día (el navegador no puede mirar la carpeta)

Se ejecuta al publicar (ver .github/workflows) o a mano:  python3 herramientas/generar.py
Solo usa la biblioteca estándar. La aplicación no lo necesita para funcionar.
"""
import json
import os
from urllib.parse import quote

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGENES = os.path.join(BASE, "assets", "images")
IMG_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}


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


def escribir(ruta, texto):
    with open(os.path.join(BASE, ruta), "w", encoding="utf-8", newline="\n") as f:
        f.write(texto)


def main():
    imagenes = listar_imagenes()
    escribir("assets/images/lista.json", json.dumps(imagenes, ensure_ascii=False, indent=0) + "\n")
    print("assets/images/lista.json: %d imágenes" % len(imagenes))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Servidor local de Ascenso.

Sirve la página (ascenso.html y la carpeta assets) y guarda todos los datos
en una base de datos SQLite: ascenso.db, en esta misma carpeta.

Uso:
    python servidor.py               -> abre http://127.0.0.1:8000 en el navegador
    python servidor.py --app         -> abre Ascenso en su propia ventana, como una aplicación,
                                        y se cierra solo al cerrar esa ventana (lo usa el icono)
    python servidor.py --puerto 8080 -> usa otro puerto
    python servidor.py --red         -> accesible desde otros dispositivos de tu wifi
    python servidor.py --no-abrir    -> no abre el navegador automáticamente

Solo necesita Python 3.8 o superior (sin instalar nada más).
"""
import argparse
import ipaddress
import json
import os
import re
import secrets
import shutil
import socket
import sqlite3
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, quote, unquote, urlparse

BASE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE, "ascenso.db")
ASSETS = os.path.join(BASE, "assets")
IMAGENES = os.path.join(ASSETS, "images")
PAGINA = "ascenso.html"

IMG_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}
FECHA_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,40}$")
TIPOS = {"climb", "strength", "active", "rest"}
UMBRALES = {0.5, 0.66, 0.75, 1.0}
PRIORIDADES = {"urgente", "alta", "media", "baja"}
LISTAS = {"pendiente", "proceso", "hecha"}
COLOR_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")
MAX_BODY = 2 * 1024 * 1024
PERFIL_APP = os.path.join(BASE, ".perfil-app")    # perfil propio de la ventana de la aplicación
REGISTRO = os.path.join(BASE, "ascenso.log")      # errores cuando funciona sin consola
ultimo_latido = time.time()                        # la página avisa periódicamente de que sigue abierta
CLAVE_RED = None                                   # con --red: clave que deben presentar los demás dispositivos

# Cabeceras de seguridad que acompañan a todas las respuestas
CABECERAS_SEGURIDAD = {
    # Qué puede cargar la página: solo sus propios archivos (nada de otras webs)
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
                               "img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; "
                               "object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",            # el navegador no adivina tipos de archivo
    "X-Frame-Options": "DENY",                      # ninguna web puede meter Ascenso dentro de un marco
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Resource-Policy": "same-origin",  # otras webs no pueden incrustar sus archivos
    "Cache-Control": "no-store",
}


def host_permitido(cabecera):
    """Solo se aceptan peticiones dirigidas a una IP, a localhost o al nombre de este equipo.
    Así se bloquea el «DNS rebinding»: una web maliciosa cuyo dominio apunta a 127.0.0.1."""
    host = (cabecera or "").strip().lower()
    if host.startswith("["):
        nombre = host[1:host.find("]")]
    else:
        nombre = host.rsplit(":", 1)[0] if ":" in host else host
    if nombre == "localhost":
        return True
    try:
        ipaddress.ip_address(nombre)
        return True
    except ValueError:
        pass
    equipo = socket.gethostname().lower()
    return nombre in {equipo, equipo.split(".")[0], equipo.split(".")[0] + ".local"}

ESQUEMA = """
CREATE TABLE IF NOT EXISTS config (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS habitos (
  id            TEXT PRIMARY KEY,
  orden         INTEGER NOT NULL,
  titulo        TEXT NOT NULL,
  nota          TEXT NOT NULL DEFAULT '',
  cuenta_racha  INTEGER NOT NULL DEFAULT 1,
  cuenta_semana INTEGER NOT NULL DEFAULT 1,
  dias          TEXT NOT NULL DEFAULT '1111111'  -- de lunes a domingo
);
CREATE TABLE IF NOT EXISTS dias (
  fecha TEXT PRIMARY KEY,  -- AAAA-MM-DD
  peso  REAL,
  tipo  TEXT               -- entreno distinto al del plan semanal (opcional)
);
CREATE TABLE IF NOT EXISTS marcas (
  fecha     TEXT NOT NULL,
  habito_id TEXT NOT NULL REFERENCES habitos(id) ON DELETE CASCADE,
  PRIMARY KEY (fecha, habito_id)
);
CREATE INDEX IF NOT EXISTS marcas_por_habito ON marcas(habito_id);
CREATE TABLE IF NOT EXISTS historial (
  fecha       TEXT PRIMARY KEY,  -- AAAA-MM-DD
  frase       TEXT,              -- id de la frase mostrada ese día
  imagen      TEXT,              -- ruta de la imagen dentro de assets/images
  actualizado TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE TABLE IF NOT EXISTS etiquetas (
  id     TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  color  TEXT NOT NULL  -- #RRGGBB
);
CREATE TABLE IF NOT EXISTS tareas (
  id          TEXT PRIMARY KEY,
  fecha       TEXT NOT NULL,  -- día al que pertenece (AAAA-MM-DD)
  titulo      TEXT NOT NULL,
  notas       TEXT NOT NULL DEFAULT '',
  prioridad   TEXT NOT NULL CHECK (prioridad IN ('urgente', 'alta', 'media', 'baja')),
  lista       TEXT NOT NULL CHECK (lista IN ('pendiente', 'proceso', 'hecha')),
  creada      TEXT NOT NULL,
  actualizada TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS tareas_por_fecha ON tareas(fecha);
CREATE TABLE IF NOT EXISTS tarea_etiquetas (
  tarea_id    TEXT NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
  etiqueta_id TEXT NOT NULL REFERENCES etiquetas(id) ON DELETE CASCADE,
  PRIMARY KEY (tarea_id, etiqueta_id)
);
"""
VERSION_BD = 3


class ErrorDatos(Exception):
    """Datos recibidos con un formato no válido."""


# ---------------------------------------------------------------- base de datos

def conectar():
    con = sqlite3.connect(DB_PATH, timeout=10)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    # Crea o actualiza las tablas si la base de datos es nueva o de una versión anterior
    if con.execute("PRAGMA user_version").fetchone()[0] < VERSION_BD:
        con.executescript(ESQUEMA)
        con.execute("PRAGMA journal_mode = WAL")
        con.execute("PRAGMA user_version = %d" % VERSION_BD)
    return con


def iniciar_bd():
    conectar().close()


def leer_estado(con):
    config = {r["clave"]: json.loads(r["valor"]) for r in con.execute("SELECT clave, valor FROM config")}
    habitos = [
        {
            "id": r["id"],
            "t": r["titulo"],
            "s": r["nota"],
            "streak": bool(r["cuenta_racha"]),
            "week": bool(r["cuenta_semana"]),
            "days": [c == "1" for c in r["dias"]],
        }
        for r in con.execute("SELECT * FROM habitos ORDER BY orden, id")
    ]
    dias = {}
    for r in con.execute("SELECT fecha, peso, tipo FROM dias"):
        d = dias.setdefault(r["fecha"], {})
        if r["peso"] is not None:
            d["w"] = r["peso"]
        if r["tipo"]:
            d["type"] = r["tipo"]
    for r in con.execute("SELECT fecha, habito_id FROM marcas"):
        dias.setdefault(r["fecha"], {}).setdefault("c", {})[r["habito_id"]] = True
    historial = {}
    for r in con.execute("SELECT fecha, frase, imagen FROM historial"):
        e = {}
        if r["frase"]:
            e["q"] = r["frase"]
        if r["imagen"]:
            e["img"] = r["imagen"]
        historial[r["fecha"]] = e
    etiquetas = {
        r["id"]: {"name": r["nombre"], "color": r["color"]}
        for r in con.execute("SELECT id, nombre, color FROM etiquetas")
    }
    tareas = {}
    for r in con.execute("SELECT * FROM tareas"):
        tareas[r["id"]] = {
            "date": r["fecha"], "title": r["titulo"], "notes": r["notas"],
            "prio": r["prioridad"], "list": r["lista"], "created": r["creada"], "tags": [],
        }
    for r in con.execute("SELECT tarea_id, etiqueta_id FROM tarea_etiquetas ORDER BY rowid"):
        if r["tarea_id"] in tareas:
            tareas[r["tarea_id"]]["tags"].append(r["etiqueta_id"])
    vacia = not config and not habitos and not dias and not historial and not etiquetas and not tareas
    return {
        "plan": config.get("plan"),
        "thr": config.get("thr"),
        "habits": habitos,
        "days": dias,
        "hist": historial,
        "tags": etiquetas,
        "tasks": tareas,
        "vacia": vacia,
    }


def validar_plan(plan):
    if not isinstance(plan, list) or len(plan) != 7 or any(p not in TIPOS for p in plan):
        raise ErrorDatos("plan semanal no válido")
    return plan


def validar_umbral(thr):
    try:
        thr = float(thr)
    except (TypeError, ValueError):
        raise ErrorDatos("umbral de racha no válido")
    if thr not in UMBRALES:
        raise ErrorDatos("umbral de racha no válido")
    return thr


def validar_habitos(lista):
    if not isinstance(lista, list) or len(lista) > 100:
        raise ErrorDatos("lista de hábitos no válida")
    limpios, vistos = [], set()
    for h in lista:
        if not isinstance(h, dict) or not ID_RE.match(str(h.get("id", ""))):
            raise ErrorDatos("hábito sin identificador válido")
        hid = str(h["id"])
        if hid in vistos:
            raise ErrorDatos("hábito repetido: " + hid)
        vistos.add(hid)
        dias = h.get("days")
        if not isinstance(dias, list) or len(dias) != 7:
            dias = [True] * 7
        limpios.append({
            "id": hid,
            "t": (str(h.get("t") or "Hábito").strip() or "Hábito")[:60],
            "s": str(h.get("s") or "")[:120],
            "streak": h.get("streak") is not False,
            "week": h.get("week") is not False,
            "days": "".join("1" if x else "0" for x in dias),
        })
    return limpios


def validar_dia(d):
    if not isinstance(d, dict):
        raise ErrorDatos("día no válido")
    peso = d.get("w")
    if peso is not None:
        try:
            peso = round(float(peso), 1)
        except (TypeError, ValueError):
            raise ErrorDatos("peso no válido")
        if not 20 <= peso <= 400:
            raise ErrorDatos("peso fuera de rango")
    tipo = d.get("type")
    if tipo is not None and tipo not in TIPOS:
        raise ErrorDatos("tipo de entreno no válido")
    marcas = d.get("c") or {}
    if not isinstance(marcas, dict):
        raise ErrorDatos("marcas no válidas")
    ids = [k for k, v in marcas.items() if v is True and ID_RE.match(str(k))]
    return peso, tipo, ids


def guardar_config(con, datos):
    if "plan" in datos:
        con.execute("INSERT OR REPLACE INTO config VALUES ('plan', ?)", (json.dumps(validar_plan(datos["plan"])),))
    if "thr" in datos:
        con.execute("INSERT OR REPLACE INTO config VALUES ('thr', ?)", (json.dumps(validar_umbral(datos["thr"])),))


def guardar_habitos(con, lista):
    habitos = validar_habitos(lista)
    ids = [h["id"] for h in habitos]
    marcas_ph = ",".join("?" * len(ids))
    # Quitar solo los hábitos eliminados (sus marcas se borran en cascada)
    if ids:
        con.execute(f"DELETE FROM habitos WHERE id NOT IN ({marcas_ph})", ids)
    else:
        con.execute("DELETE FROM habitos")
    for orden, h in enumerate(habitos):
        con.execute(
            """INSERT INTO habitos (id, orden, titulo, nota, cuenta_racha, cuenta_semana, dias)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET orden=excluded.orden, titulo=excluded.titulo, nota=excluded.nota,
                 cuenta_racha=excluded.cuenta_racha, cuenta_semana=excluded.cuenta_semana, dias=excluded.dias""",
            (h["id"], orden, h["t"], h["s"], int(h["streak"]), int(h["week"]), h["days"]),
        )


def guardar_dia(con, fecha, datos):
    if not FECHA_RE.match(fecha):
        raise ErrorDatos("fecha no válida")
    peso, tipo, ids = validar_dia(datos)
    if peso is None and tipo is None:
        con.execute("DELETE FROM dias WHERE fecha = ?", (fecha,))
    else:
        con.execute("INSERT OR REPLACE INTO dias (fecha, peso, tipo) VALUES (?, ?, ?)", (fecha, peso, tipo))
    con.execute("DELETE FROM marcas WHERE fecha = ?", (fecha,))
    for hid in ids:
        # Solo se guardan marcas de hábitos que existen
        con.execute("INSERT INTO marcas (fecha, habito_id) SELECT ?, id FROM habitos WHERE id = ?", (fecha, hid))


def guardar_historial(con, fecha, datos):
    if not FECHA_RE.match(fecha):
        raise ErrorDatos("fecha no válida")
    if not isinstance(datos, dict):
        raise ErrorDatos("historial no válido")
    frase = datos.get("q")
    if frase is not None and not ID_RE.match(str(frase)):
        raise ErrorDatos("id de frase no válido")
    imagen = datos.get("img")
    if imagen is not None:
        imagen = str(imagen)
        if len(imagen) > 300 or "\x00" in imagen:
            raise ErrorDatos("ruta de imagen no válida")
    con.execute(
        """INSERT INTO historial (fecha, frase, imagen) VALUES (?, ?, ?)
           ON CONFLICT(fecha) DO UPDATE SET frase=excluded.frase, imagen=excluded.imagen,
             actualizado=datetime('now', 'localtime')""",
        (fecha, frase, imagen),
    )


def comprobar_id(valor, que):
    if not ID_RE.match(str(valor)):
        raise ErrorDatos("id de %s no válido" % que)
    return str(valor)


def guardar_etiqueta(con, eid, datos):
    eid = comprobar_id(eid, "etiqueta")
    if not isinstance(datos, dict):
        raise ErrorDatos("etiqueta no válida")
    nombre = str(datos.get("name") or "").strip()[:30]
    color = str(datos.get("color") or "")
    if not nombre:
        raise ErrorDatos("la etiqueta necesita un nombre")
    if not COLOR_RE.match(color):
        raise ErrorDatos("color no válido")
    con.execute(
        """INSERT INTO etiquetas (id, nombre, color) VALUES (?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET nombre=excluded.nombre, color=excluded.color""",
        (eid, nombre, color.upper()),
    )


def borrar_etiqueta(con, eid):
    con.execute("DELETE FROM etiquetas WHERE id = ?", (comprobar_id(eid, "etiqueta"),))


def guardar_tarea(con, tid, datos):
    tid = comprobar_id(tid, "tarea")
    if not isinstance(datos, dict):
        raise ErrorDatos("tarea no válida")
    fecha = str(datos.get("date") or "")
    if not FECHA_RE.match(fecha):
        raise ErrorDatos("fecha de la tarea no válida")
    titulo = str(datos.get("title") or "").strip()[:120]
    if not titulo:
        raise ErrorDatos("la tarea necesita un título")
    notas = str(datos.get("notes") or "")[:2000]
    prioridad = datos.get("prio")
    if prioridad not in PRIORIDADES:
        raise ErrorDatos("prioridad no válida")
    lista = datos.get("list")
    if lista not in LISTAS:
        raise ErrorDatos("lista no válida")
    creada = str(datos.get("created") or "")[:40] or fecha
    etiquetas = datos.get("tags") or []
    if not isinstance(etiquetas, list):
        raise ErrorDatos("etiquetas no válidas")
    con.execute(
        """INSERT INTO tareas (id, fecha, titulo, notas, prioridad, lista, creada) VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET fecha=excluded.fecha, titulo=excluded.titulo, notas=excluded.notas,
             prioridad=excluded.prioridad, lista=excluded.lista, actualizada=datetime('now', 'localtime')""",
        (tid, fecha, titulo, notas, prioridad, lista, creada),
    )
    con.execute("DELETE FROM tarea_etiquetas WHERE tarea_id = ?", (tid,))
    for eid in etiquetas:
        if ID_RE.match(str(eid)):
            # Solo se asocian etiquetas que existen
            con.execute(
                "INSERT OR IGNORE INTO tarea_etiquetas (tarea_id, etiqueta_id) SELECT ?, id FROM etiquetas WHERE id = ?",
                (tid, str(eid)),
            )


def borrar_tarea(con, tid):
    con.execute("DELETE FROM tareas WHERE id = ?", (comprobar_id(tid, "tarea"),))


def importar(con, estado):
    if not isinstance(estado, dict) or not isinstance(estado.get("days"), dict):
        raise ErrorDatos("copia no válida")
    con.execute("DELETE FROM tarea_etiquetas")
    con.execute("DELETE FROM tareas")
    con.execute("DELETE FROM etiquetas")
    con.execute("DELETE FROM historial")
    con.execute("DELETE FROM marcas")
    con.execute("DELETE FROM dias")
    con.execute("DELETE FROM habitos")
    con.execute("DELETE FROM config")
    guardar_config(con, {k: estado[k] for k in ("plan", "thr") if estado.get(k) is not None})
    guardar_habitos(con, estado.get("habits") or [])
    for fecha, d in estado["days"].items():
        guardar_dia(con, str(fecha), d)
    historial = estado.get("hist") or {}
    if isinstance(historial, dict):
        for fecha, h in historial.items():
            guardar_historial(con, str(fecha), h)
    etiquetas = estado.get("tags") or {}
    if isinstance(etiquetas, dict):
        for eid, e in etiquetas.items():
            guardar_etiqueta(con, eid, e)
    tareas = estado.get("tasks") or {}
    if isinstance(tareas, dict):
        for tid, t in tareas.items():
            guardar_tarea(con, tid, t)


def listar_imagenes():
    imagenes = []
    if not os.path.isdir(IMAGENES):
        return imagenes
    for raiz, carpetas, archivos in os.walk(IMAGENES):
        carpetas[:] = sorted(c for c in carpetas if not c.startswith("."))
        for nombre in sorted(archivos):
            if os.path.splitext(nombre)[1].lower() in IMG_EXT:
                ruta = os.path.relpath(os.path.join(raiz, nombre), BASE).replace(os.sep, "/")
                imagenes.append({"nombre": nombre, "url": "/" + quote(ruta)})
    return imagenes


# ---------------------------------------------------------------- servidor web

class Manejador(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".webmanifest": "application/manifest+json"}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE, **kwargs)

    # Solo se sirve la página y lo que hay dentro de assets (nunca la base de datos ni este script).
    # Se comprueba la ruta real en disco, así que "../" y similares no permiten salir de ahí.
    def ruta_permitida(self):
        real = os.path.realpath(self.translate_path(self.path))
        return real == os.path.realpath(os.path.join(BASE, PAGINA)) or real.startswith(os.path.realpath(ASSETS) + os.sep)

    # ---- control de acceso -------------------------------------------------
    def es_local(self):
        try:
            return ipaddress.ip_address(self.client_address[0]).is_loopback
        except ValueError:
            return False

    def acceso_permitido(self, escritura=False):
        """Devuelve True si la petición puede seguir; si no, ya ha respondido con el error."""
        if not host_permitido(self.headers.get("Host")):
            self.send_error(403, "Host no permitido")
            return False
        if not self.es_local():
            # Otro dispositivo de la red (solo posible con --red): necesita la clave
            consulta = parse_qs(urlparse(self.path).query)
            clave = (consulta.get("clave") or [""])[0]
            if CLAVE_RED and clave and secrets.compare_digest(clave, CLAVE_RED):
                # Se guarda la clave en una cookie y se limpia la dirección
                self.send_response(302)
                self.send_header("Set-Cookie", "ascenso_clave=%s; Path=/; HttpOnly; SameSite=Strict" % CLAVE_RED)
                self.send_header("Location", urlparse(self.path).path or "/")
                self.end_headers()
                return False
            galleta = SimpleCookie(self.headers.get("Cookie") or "").get("ascenso_clave")
            if not (CLAVE_RED and galleta and secrets.compare_digest(galleta.value, CLAVE_RED)):
                self.send_error(401, "Falta la clave: abre la dirección completa que aparece en la consola del servidor")
                return False
        if escritura:
            # Protección frente a otras webs abiertas en el navegador (CSRF): las escrituras deben venir
            # de la propia página, que manda su origen, JSON y una cabecera propia.
            origen = self.headers.get("Origin")
            if origen and origen != "http://" + (self.headers.get("Host") or ""):
                self.send_error(403, "Origen no permitido")
                return False
            if self.headers.get("X-Ascenso") != "1":
                self.send_error(403, "Petición no permitida")
                return False
            tipo = (self.headers.get("Content-Type") or "").split(";")[0].strip().lower()
            if self.command in ("PUT", "POST") and tipo != "application/json":
                self.send_error(415, "Se esperaba JSON")
                return False
        return True

    # ---- métodos HTTP ------------------------------------------------------
    def do_GET(self):
        if not self.acceso_permitido():
            return
        ruta = unquote(urlparse(self.path).path)
        if ruta == "/":
            self.send_response(302)
            self.send_header("Location", "/" + PAGINA)
            self.end_headers()
            return
        if ruta.startswith("/api/"):
            return self.api("GET", ruta)
        if not self.ruta_permitida():
            return self.send_error(404, "No encontrado")
        return super().do_GET()

    def do_HEAD(self):
        if not self.acceso_permitido():
            return
        if not self.ruta_permitida():
            return self.send_error(404, "No encontrado")
        return super().do_HEAD()

    def do_PUT(self):
        if self.acceso_permitido(escritura=True):
            self.api("PUT", unquote(urlparse(self.path).path))

    def do_POST(self):
        if self.acceso_permitido(escritura=True):
            self.api("POST", unquote(urlparse(self.path).path))

    def do_DELETE(self):
        if self.acceso_permitido(escritura=True):
            self.api("DELETE", unquote(urlparse(self.path).path))

    def end_headers(self):
        for nombre, valor in CABECERAS_SEGURIDAD.items():
            self.send_header(nombre, valor)
        super().end_headers()

    def leer_json(self):
        try:
            largo = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            raise ErrorDatos("longitud no válida")
        if largo < 0 or largo > MAX_BODY:
            raise ErrorDatos("datos demasiado grandes")
        try:
            return json.loads(self.rfile.read(largo) or b"null")
        except json.JSONDecodeError:
            raise ErrorDatos("JSON no válido")

    def responder(self, codigo, datos):
        cuerpo = json.dumps(datos, ensure_ascii=False).encode("utf-8")
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.end_headers()
        self.wfile.write(cuerpo)

    def api(self, metodo, ruta):
        try:
            if metodo == "GET" and ruta == "/api/ping":
                global ultimo_latido
                ultimo_latido = time.time()
                return self.responder(200, {"app": "ascenso"})
            if metodo == "GET" and ruta == "/api/imagenes":
                return self.responder(200, listar_imagenes())
            con = conectar()
            try:
                with con:  # una transacción por petición
                    if metodo == "GET" and ruta == "/api/estado":
                        return self.responder(200, leer_estado(con))
                    if metodo == "PUT" and ruta == "/api/config":
                        guardar_config(con, self.leer_json() or {})
                    elif metodo == "PUT" and ruta == "/api/habitos":
                        guardar_habitos(con, self.leer_json())
                    elif metodo == "PUT" and ruta.startswith("/api/dias/"):
                        guardar_dia(con, ruta[len("/api/dias/"):], self.leer_json() or {})
                    elif metodo == "PUT" and ruta.startswith("/api/historial/"):
                        guardar_historial(con, ruta[len("/api/historial/"):], self.leer_json() or {})
                    elif metodo == "PUT" and ruta.startswith("/api/etiquetas/"):
                        guardar_etiqueta(con, ruta[len("/api/etiquetas/"):], self.leer_json())
                    elif metodo == "DELETE" and ruta.startswith("/api/etiquetas/"):
                        borrar_etiqueta(con, ruta[len("/api/etiquetas/"):])
                    elif metodo == "PUT" and ruta.startswith("/api/tareas/"):
                        guardar_tarea(con, ruta[len("/api/tareas/"):], self.leer_json())
                    elif metodo == "DELETE" and ruta.startswith("/api/tareas/"):
                        borrar_tarea(con, ruta[len("/api/tareas/"):])
                    elif metodo == "POST" and ruta == "/api/importar":
                        importar(con, self.leer_json())
                    else:
                        return self.responder(404, {"error": "ruta desconocida"})
                return self.responder(200, {"ok": True})
            finally:
                con.close()
        except ErrorDatos as e:
            self.responder(400, {"error": str(e)})
        except sqlite3.Error as e:
            # El detalle se queda en el registro; a la página solo le llega un mensaje genérico
            sys.stderr.write("  Error de base de datos en %s %s: %s\n" % (metodo, ruta, e))
            self.responder(500, {"error": "error de la base de datos"})

    def log_message(self, formato, *args):
        if len(args) > 1 and str(args[1]).startswith(("4", "5")):
            sys.stderr.write("  %s %s\n" % (args[1], args[0]))


def ip_local():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return None


def buscar_navegador():
    """Busca un navegador basado en Chromium (Chrome, Edge, Brave, Chromium) para abrir la ventana de la app."""
    propio = os.environ.get("ASCENSO_NAVEGADOR")
    if propio:
        return propio
    candidatos = []
    if sys.platform.startswith("win"):
        for raiz in filter(None, [os.environ.get("PROGRAMFILES(X86)"), os.environ.get("PROGRAMFILES"), os.environ.get("LOCALAPPDATA")]):
            candidatos += [
                os.path.join(raiz, "Microsoft", "Edge", "Application", "msedge.exe"),
                os.path.join(raiz, "Google", "Chrome", "Application", "chrome.exe"),
                os.path.join(raiz, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
            ]
    elif sys.platform == "darwin":
        candidatos = [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
            "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
        ]
    else:
        for nombre in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge", "brave-browser"):
            ruta = shutil.which(nombre)
            if ruta:
                candidatos.append(ruta)
    return next((c for c in candidatos if os.path.isfile(c)), None)


def abrir_ventana(navegador, url):
    """Abre Ascenso en una ventana propia, sin barras del navegador. Devuelve el proceso."""
    return subprocess.Popen(
        [navegador, "--app=" + url, "--user-data-dir=" + PERFIL_APP, "--no-first-run",
         "--no-default-browser-check", "--start-maximized"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )


def ya_en_marcha(puerto):
    """¿Hay ya un Ascenso funcionando en ese puerto? (por ejemplo, si se pulsa el icono dos veces)"""
    try:
        with urllib.request.urlopen("http://127.0.0.1:%d/api/ping" % puerto, timeout=1) as r:
            return json.loads(r.read()).get("app") == "ascenso"
    except Exception:
        return False


def main():
    p = argparse.ArgumentParser(description="Servidor local de Ascenso")
    p.add_argument("--puerto", type=int, default=8000)
    p.add_argument("--red", action="store_true", help="permitir el acceso desde otros dispositivos de la red local")
    p.add_argument("--no-abrir", action="store_true", help="no abrir el navegador")
    p.add_argument("--app", action="store_true", help="abrir en una ventana propia y cerrar al cerrarla")
    args = p.parse_args()

    if not os.path.exists(os.path.join(BASE, PAGINA)):
        sys.exit(f"No encuentro {PAGINA} junto a servidor.py.")

    if args.app and ya_en_marcha(args.puerto):
        navegador = buscar_navegador()
        url = "http://127.0.0.1:%d/" % args.puerto
        try:
            abrir_ventana(navegador, url) if navegador else webbrowser.open(url)
        except OSError:
            webbrowser.open(url)
        return

    iniciar_bd()

    host = "0.0.0.0" if args.red else "127.0.0.1"
    servidor = None
    for puerto in range(args.puerto, args.puerto + 10):
        try:
            servidor = ThreadingHTTPServer((host, puerto), Manejador)
            break
        except OSError:
            continue
    if servidor is None:
        sys.exit("No hay ningún puerto libre entre %d y %d." % (args.puerto, args.puerto + 9))

    if args.red:
        global CLAVE_RED
        CLAVE_RED = secrets.token_urlsafe(12)   # nueva en cada arranque

    url = "http://127.0.0.1:%d/" % servidor.server_port
    if args.app:
        return modo_aplicacion(servidor, url)

    print("\n  Ascenso está en marcha")
    print("  Abre:            " + url)
    if args.red:
        ip = ip_local()
        if ip:
            print("  Desde tu móvil:  http://%s:%d/?clave=%s  (misma wifi)" % (ip, servidor.server_port, CLAVE_RED))
        print("  Los demás dispositivos necesitan esa dirección completa: la clave cambia en cada arranque.")
        print("  Aviso: la conexión por wifi no va cifrada; úsalo solo en redes de confianza.")
    print("  Base de datos:   " + DB_PATH)
    print("  Para cerrar, pulsa Ctrl+C.\n")

    if not args.no_abrir:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\n  Servidor cerrado.")
    finally:
        servidor.server_close()


def apuntar(texto):
    print(time.strftime("%Y-%m-%d %H:%M:%S ") + texto, flush=True)


def modo_aplicacion(servidor, url):
    """Ventana propia: el servidor vive mientras la ventana esté abierta.

    La página avisa al servidor cada 20 segundos (/api/ping). El servidor sigue en marcha mientras
    lleguen esos avisos, aunque el proceso del navegador termine antes (en Windows, Edge y Chrome a
    veces pasan la ventana a otro proceso y el que se lanzó se cierra al momento)."""
    global ultimo_latido
    hilo = threading.Thread(target=servidor.serve_forever, daemon=True)
    hilo.start()
    apuntar("Servidor en %s (Python %s, %s)" % (url, sys.version.split()[0], sys.executable))
    navegador = buscar_navegador()
    apuntar("Navegador: %s" % (navegador or "ninguno compatible; se usa el navegador por defecto"))
    ultimo_latido = time.time() + 40          # margen para que la ventana se abra y cargue
    try:
        ventana = None
        if navegador:
            try:
                ventana = abrir_ventana(navegador, url)
            except OSError as e:
                apuntar("No se pudo abrir %s: %s" % (navegador, e))
        if ventana:
            ventana.wait()
            apuntar("El proceso del navegador terminó (código %s)" % ventana.returncode)
        else:
            webbrowser.open(url)
        # Se sigue sirviendo mientras la página dé señales de vida
        while time.time() - ultimo_latido < 50:
            time.sleep(2)
        apuntar("La ventana ya no da señales: cierre")
    finally:
        servidor.shutdown()
        servidor.server_close()


def avisar_error(mensaje):
    """Sin consola, un error se mostraría en ninguna parte: en Windows se enseña en una ventanita."""
    if sys.platform.startswith("win"):
        try:
            import ctypes
            ctypes.windll.user32.MessageBoxW(0, mensaje, "Ascenso", 0x10)
        except Exception:
            pass


if __name__ == "__main__":
    # Sin consola (al abrir con el icono), todo lo que se escribiría en pantalla va a ascenso.log
    if "--app" in sys.argv and (sys.stderr is None or not sys.stderr.isatty()):
        sys.stdout = sys.stderr = open(REGISTRO, "a", encoding="utf-8", buffering=1)
    try:
        main()
    except SystemExit as e:
        if "--app" in sys.argv and isinstance(e.code, str):
            avisar_error(e.code)
        raise
    except Exception:
        import traceback
        traceback.print_exc()
        if "--app" in sys.argv:
            sys.stderr.flush()
            avisar_error("Ascenso no ha podido arrancar. El detalle del error está en:\n" + REGISTRO)
        raise

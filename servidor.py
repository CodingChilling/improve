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
from datetime import date
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
HORA_RE = re.compile(r"^([01][0-9]|2[0-3]):[0-5][0-9]$")
PRIORIDADES_TARJETA = PRIORIDADES | {"ninguna"}
MAX_DIAS_EVENTO = 366
MAX_BODY = 8 * 1024 * 1024          # cada cambio (una libreta llena ocupa unos 1-3 MB)
MAX_IMPORTAR = 256 * 1024 * 1024    # una copia de seguridad completa
LIMITE_LIBRETA = 1_000_000          # caracteres por libreta (de un mapa o de un nodo)
DIR_COPIAS = os.path.join(BASE, "copias")          # copias diarias automáticas de ascenso.db
COPIAS_A_CONSERVAR = 14
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
CREATE TABLE IF NOT EXISTS notas (
  fecha       TEXT PRIMARY KEY,  -- AAAA-MM-DD
  reflexion   TEXT NOT NULL DEFAULT '',
  notas       TEXT NOT NULL DEFAULT '',
  actualizado TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE TABLE IF NOT EXISTS eventos (
  id          TEXT PRIMARY KEY,
  inicio      TEXT NOT NULL,     -- AAAA-MM-DD
  fin         TEXT NOT NULL,     -- igual a inicio si dura un solo día
  hora        TEXT,              -- HH:MM, o vacío si es para todo el día
  titulo      TEXT NOT NULL,
  color       TEXT NOT NULL,     -- #RRGGBB
  creado      TEXT NOT NULL,
  actualizado TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  CHECK (fin >= inicio)
);
CREATE INDEX IF NOT EXISTS eventos_por_fechas ON eventos(inicio, fin);

-- Tableros (al estilo de Trello): no dependen del día
CREATE TABLE IF NOT EXISTS tableros (
  id       TEXT PRIMARY KEY,
  nombre   TEXT NOT NULL,
  color    TEXT NOT NULL,
  favorito INTEGER NOT NULL DEFAULT 0,
  orden    INTEGER NOT NULL DEFAULT 0,
  creado   TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS etiquetas_tablero (
  id         TEXT PRIMARY KEY,
  tablero_id TEXT NOT NULL REFERENCES tableros(id) ON DELETE CASCADE,
  nombre     TEXT NOT NULL,
  color      TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS listas (
  id         TEXT PRIMARY KEY,
  tablero_id TEXT NOT NULL REFERENCES tableros(id) ON DELETE CASCADE,
  titulo     TEXT NOT NULL,
  orden      INTEGER NOT NULL DEFAULT 0,
  plegada    INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS tarjetas (
  id           TEXT PRIMARY KEY,
  lista_id     TEXT NOT NULL REFERENCES listas(id) ON DELETE CASCADE,
  titulo       TEXT NOT NULL,
  descripcion  TEXT NOT NULL DEFAULT '',
  prioridad    TEXT NOT NULL CHECK (prioridad IN ('urgente', 'alta', 'media', 'baja', 'ninguna')),
  fecha_limite TEXT,              -- AAAA-MM-DD, o vacío si no tiene
  orden        INTEGER NOT NULL DEFAULT 0,
  creada       TEXT NOT NULL,
  actualizada  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS tarjetas_por_lista ON tarjetas(lista_id, orden);
CREATE TABLE IF NOT EXISTS tarjeta_etiquetas_tablero (
  tarjeta_id  TEXT NOT NULL REFERENCES tarjetas(id) ON DELETE CASCADE,
  etiqueta_id TEXT NOT NULL REFERENCES etiquetas_tablero(id) ON DELETE CASCADE,
  PRIMARY KEY (tarjeta_id, etiqueta_id)
);
CREATE TABLE IF NOT EXISTS checklist (
  id         TEXT PRIMARY KEY,
  tarjeta_id TEXT NOT NULL REFERENCES tarjetas(id) ON DELETE CASCADE,
  texto      TEXT NOT NULL,
  hecho      INTEGER NOT NULL DEFAULT 0,
  orden      INTEGER NOT NULL DEFAULT 0
);

-- Mapas de nodos: cada nodo puede tener dentro su propio nivel (nodos hijos)
CREATE TABLE IF NOT EXISTS mapas (
  id       TEXT PRIMARY KEY,
  titulo   TEXT NOT NULL,
  color    TEXT NOT NULL,     -- color de acento del mapa
  favorito INTEGER NOT NULL DEFAULT 0,
  orden    INTEGER NOT NULL DEFAULT 0,
  notas    TEXT NOT NULL DEFAULT '',   -- libreta del propio mapa
  creado   TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS nodos (
  id          TEXT PRIMARY KEY,
  mapa_id     TEXT NOT NULL REFERENCES mapas(id) ON DELETE CASCADE,
  padre_id    TEXT REFERENCES nodos(id) ON DELETE CASCADE,   -- vacío: primer nivel del mapa
  titulo      TEXT NOT NULL,
  color       TEXT,                                            -- vacío: el acento del mapa
  x           REAL,
  y           REAL,
  notas       TEXT NOT NULL DEFAULT '',
  creado      TEXT NOT NULL,
  actualizado TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS nodos_por_nivel ON nodos(mapa_id, padre_id);
CREATE TABLE IF NOT EXISTS conexiones (
  id    TEXT PRIMARY KEY,
  desde TEXT NOT NULL REFERENCES nodos(id) ON DELETE CASCADE,
  hasta TEXT NOT NULL REFERENCES nodos(id) ON DELETE CASCADE,
  CHECK (desde <> hasta)
);
"""
VERSION_BD = 7
# Versión del servidor: la página la comprueba para avisar si está hablando con un servidor antiguo
VERSION_APP = 8


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
    notas = {
        r["fecha"]: {"r": r["reflexion"], "n": r["notas"]}
        for r in con.execute("SELECT fecha, reflexion, notas FROM notas")
    }
    eventos = {
        r["id"]: {"start": r["inicio"], "end": r["fin"], "time": r["hora"] or "",
                  "title": r["titulo"], "color": r["color"], "created": r["creado"]}
        for r in con.execute("SELECT * FROM eventos")
    }
    tableros = {
        r["id"]: {"name": r["nombre"], "color": r["color"], "fav": bool(r["favorito"]),
                  "order": r["orden"], "created": r["creado"]}
        for r in con.execute("SELECT * FROM tableros")
    }
    etiquetas_t = {
        r["id"]: {"board": r["tablero_id"], "name": r["nombre"], "color": r["color"]}
        for r in con.execute("SELECT * FROM etiquetas_tablero")
    }
    listas = {
        r["id"]: {"board": r["tablero_id"], "title": r["titulo"], "order": r["orden"], "collapsed": bool(r["plegada"])}
        for r in con.execute("SELECT * FROM listas")
    }
    tarjetas = {}
    for r in con.execute("SELECT * FROM tarjetas"):
        tarjetas[r["id"]] = {
            "list": r["lista_id"], "title": r["titulo"], "desc": r["descripcion"], "prio": r["prioridad"],
            "due": r["fecha_limite"] or "", "labels": [], "check": [], "order": r["orden"], "created": r["creada"],
        }
    for r in con.execute("SELECT tarjeta_id, etiqueta_id FROM tarjeta_etiquetas_tablero ORDER BY rowid"):
        if r["tarjeta_id"] in tarjetas:
            tarjetas[r["tarjeta_id"]]["labels"].append(r["etiqueta_id"])
    for r in con.execute("SELECT * FROM checklist ORDER BY orden, rowid"):
        if r["tarjeta_id"] in tarjetas:
            tarjetas[r["tarjeta_id"]]["check"].append({"id": r["id"], "t": r["texto"], "d": bool(r["hecho"])})
    mapas = {
        r["id"]: {"title": r["titulo"], "color": r["color"], "fav": bool(r["favorito"]), "order": r["orden"],
                  "notes": r["notas"], "created": r["creado"]}
        for r in con.execute("SELECT * FROM mapas")
    }
    nodos = {
        r["id"]: {"map": r["mapa_id"], "parent": r["padre_id"], "title": r["titulo"], "color": r["color"] or "",
                  "x": r["x"], "y": r["y"], "notes": r["notas"], "created": r["creado"]}
        for r in con.execute("SELECT * FROM nodos")
    }
    conexiones = {r["id"]: {"a": r["desde"], "b": r["hasta"]} for r in con.execute("SELECT * FROM conexiones")}
    vacia = (not config and not habitos and not dias and not historial and not etiquetas
             and not tareas and not notas and not eventos and not tableros and not mapas)
    return {
        "plan": config.get("plan"),
        "thr": config.get("thr"),
        "habits": habitos,
        "days": dias,
        "hist": historial,
        "tags": etiquetas,
        "tasks": tareas,
        "notes": notas,
        "events": eventos,
        "boards": tableros,
        "blabels": etiquetas_t,
        "blists": listas,
        "cards": tarjetas,
        "maps": mapas,
        "mnodes": nodos,
        "mlinks": conexiones,
        "vacia": vacia,
        "version": VERSION_APP,
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


def guardar_notas(con, fecha, datos):
    if not FECHA_RE.match(fecha):
        raise ErrorDatos("fecha no válida")
    if not isinstance(datos, dict):
        raise ErrorDatos("notas no válidas")
    reflexion = str(datos.get("r") or "")[:20000]
    notas = str(datos.get("n") or "")[:20000]
    if not reflexion.strip() and not notas.strip():
        con.execute("DELETE FROM notas WHERE fecha = ?", (fecha,))   # día sin nada escrito
        return
    con.execute(
        """INSERT INTO notas (fecha, reflexion, notas) VALUES (?, ?, ?)
           ON CONFLICT(fecha) DO UPDATE SET reflexion=excluded.reflexion, notas=excluded.notas,
             actualizado=datetime('now', 'localtime')""",
        (fecha, reflexion, notas),
    )


def guardar_evento(con, eid, datos):
    eid = comprobar_id(eid, "evento")
    if not isinstance(datos, dict):
        raise ErrorDatos("evento no válido")
    inicio, fin = str(datos.get("start") or ""), str(datos.get("end") or datos.get("start") or "")
    if not FECHA_RE.match(inicio) or not FECHA_RE.match(fin):
        raise ErrorDatos("fechas del evento no válidas")
    try:
        dias = (date.fromisoformat(fin) - date.fromisoformat(inicio)).days
    except ValueError:
        raise ErrorDatos("fechas del evento no válidas")
    if dias < 0:
        raise ErrorDatos("el evento termina antes de empezar")
    if dias > MAX_DIAS_EVENTO:
        raise ErrorDatos("el evento dura demasiado")
    hora = str(datos.get("time") or "")
    if hora and not HORA_RE.match(hora):
        raise ErrorDatos("hora no válida")
    titulo = str(datos.get("title") or "").strip()[:120]
    if not titulo:
        raise ErrorDatos("el evento necesita un título")
    color = str(datos.get("color") or "")
    if not COLOR_RE.match(color):
        raise ErrorDatos("color no válido")
    creado = str(datos.get("created") or "")[:40] or inicio
    con.execute(
        """INSERT INTO eventos (id, inicio, fin, hora, titulo, color, creado) VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET inicio=excluded.inicio, fin=excluded.fin, hora=excluded.hora,
             titulo=excluded.titulo, color=excluded.color, actualizado=datetime('now', 'localtime')""",
        (eid, inicio, fin, hora or None, titulo, color.upper(), creado),
    )


def borrar_evento(con, eid):
    con.execute("DELETE FROM eventos WHERE id = ?", (comprobar_id(eid, "evento"),))


# ---- tableros ------------------------------------------------------------

def entero(valor, que):
    try:
        return int(valor)
    except (TypeError, ValueError):
        raise ErrorDatos("%s no válido" % que)


def guardar_tablero(con, bid, datos):
    bid = comprobar_id(bid, "tablero")
    if not isinstance(datos, dict):
        raise ErrorDatos("tablero no válido")
    nombre = str(datos.get("name") or "").strip()[:60]
    color = str(datos.get("color") or "")
    if not nombre:
        raise ErrorDatos("el tablero necesita un nombre")
    if not COLOR_RE.match(color):
        raise ErrorDatos("color no válido")
    con.execute(
        """INSERT INTO tableros (id, nombre, color, favorito, orden, creado) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET nombre=excluded.nombre, color=excluded.color,
             favorito=excluded.favorito, orden=excluded.orden""",
        (bid, nombre, color.upper(), int(bool(datos.get("fav"))), entero(datos.get("order", 0), "orden"),
         str(datos.get("created") or "")[:40]),
    )


def guardar_etiqueta_tablero(con, eid, datos):
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
        """INSERT INTO etiquetas_tablero (id, tablero_id, nombre, color) VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET tablero_id=excluded.tablero_id, nombre=excluded.nombre, color=excluded.color""",
        (eid, comprobar_id(datos.get("board"), "tablero"), nombre, color.upper()),
    )


def guardar_lista(con, lid, datos):
    lid = comprobar_id(lid, "lista")
    if not isinstance(datos, dict):
        raise ErrorDatos("lista no válida")
    titulo = str(datos.get("title") or "").strip()[:60]
    if not titulo:
        raise ErrorDatos("la lista necesita un título")
    con.execute(
        """INSERT INTO listas (id, tablero_id, titulo, orden, plegada) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET tablero_id=excluded.tablero_id, titulo=excluded.titulo,
             orden=excluded.orden, plegada=excluded.plegada""",
        (lid, comprobar_id(datos.get("board"), "tablero"), titulo, entero(datos.get("order", 0), "orden"),
         int(bool(datos.get("collapsed")))),
    )


def guardar_tarjeta(con, cid, datos):
    cid = comprobar_id(cid, "tarjeta")
    if not isinstance(datos, dict):
        raise ErrorDatos("tarjeta no válida")
    lista = comprobar_id(datos.get("list"), "lista")
    titulo = str(datos.get("title") or "").strip()[:200]
    if not titulo:
        raise ErrorDatos("la tarjeta necesita un título")
    prioridad = datos.get("prio")
    if prioridad not in PRIORIDADES_TARJETA:
        raise ErrorDatos("prioridad no válida")
    limite = str(datos.get("due") or "")
    if limite and not FECHA_RE.match(limite):
        raise ErrorDatos("fecha límite no válida")
    etiquetas = datos.get("labels") or []
    checklist = datos.get("check") or []
    if not isinstance(etiquetas, list) or not isinstance(checklist, list) or len(checklist) > 100:
        raise ErrorDatos("tarjeta no válida")
    con.execute(
        """INSERT INTO tarjetas (id, lista_id, titulo, descripcion, prioridad, fecha_limite, orden, creada)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET lista_id=excluded.lista_id, titulo=excluded.titulo,
             descripcion=excluded.descripcion, prioridad=excluded.prioridad, fecha_limite=excluded.fecha_limite,
             orden=excluded.orden, actualizada=datetime('now', 'localtime')""",
        (cid, lista, titulo, str(datos.get("desc") or "")[:10000], prioridad, limite or None,
         entero(datos.get("order", 0), "orden"), str(datos.get("created") or "")[:40]),
    )
    con.execute("DELETE FROM tarjeta_etiquetas_tablero WHERE tarjeta_id = ?", (cid,))
    for eid in etiquetas:
        if ID_RE.match(str(eid)):
            # Solo etiquetas que existen y son del mismo tablero que la tarjeta
            con.execute(
                """INSERT OR IGNORE INTO tarjeta_etiquetas_tablero (tarjeta_id, etiqueta_id)
                   SELECT ?, e.id FROM etiquetas_tablero e JOIN listas l ON l.tablero_id = e.tablero_id
                   WHERE e.id = ? AND l.id = ?""",
                (cid, str(eid), lista),
            )
    con.execute("DELETE FROM checklist WHERE tarjeta_id = ?", (cid,))
    for orden, punto in enumerate(checklist):
        if not isinstance(punto, dict):
            raise ErrorDatos("elemento de la checklist no válido")
        texto = str(punto.get("t") or "").strip()[:300]
        if texto:
            con.execute(
                "INSERT OR REPLACE INTO checklist (id, tarjeta_id, texto, hecho, orden) VALUES (?, ?, ?, ?, ?)",
                (comprobar_id(punto.get("id"), "elemento"), cid, texto, int(bool(punto.get("d"))), orden),
            )


def borrar_de(tabla, que):
    def borrar(con, ident):
        con.execute("DELETE FROM %s WHERE id = ?" % tabla, (comprobar_id(ident, que),))
    return borrar


borrar_tablero = borrar_de("tableros", "tablero")
borrar_etiqueta_tablero = borrar_de("etiquetas_tablero", "etiqueta")
borrar_lista = borrar_de("listas", "lista")
borrar_tarjeta = borrar_de("tarjetas", "tarjeta")


# ---- mapas de nodos ---------------------------------------------------------

def real_o_nada(valor):
    if valor is None or valor == "":
        return None
    try:
        v = float(valor)
    except (TypeError, ValueError):
        raise ErrorDatos("posición no válida")
    if not -1e7 < v < 1e7:
        raise ErrorDatos("posición no válida")
    return v


def guardar_mapa(con, mid, datos):
    mid = comprobar_id(mid, "mapa")
    if not isinstance(datos, dict):
        raise ErrorDatos("mapa no válido")
    titulo = str(datos.get("title") or "").strip()[:80]
    color = str(datos.get("color") or "")
    if not titulo:
        raise ErrorDatos("el mapa necesita un título")
    if not COLOR_RE.match(color):
        raise ErrorDatos("color no válido")
    con.execute(
        """INSERT INTO mapas (id, titulo, color, favorito, orden, notas, creado) VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET titulo=excluded.titulo, color=excluded.color, favorito=excluded.favorito,
             orden=excluded.orden, notas=excluded.notas""",
        (mid, titulo, color.upper(), int(bool(datos.get("fav"))), entero(datos.get("order", 0), "orden"),
         str(datos.get("notes") or "")[:LIMITE_LIBRETA], str(datos.get("created") or "")[:40]),
    )


def guardar_nodo(con, nid, datos):
    nid = comprobar_id(nid, "nodo")
    if not isinstance(datos, dict):
        raise ErrorDatos("nodo no válido")
    mapa = comprobar_id(datos.get("map"), "mapa")
    padre = datos.get("parent")
    if padre:
        padre = comprobar_id(padre, "nodo")
        fila = con.execute("SELECT mapa_id FROM nodos WHERE id = ?", (padre,)).fetchone()
        if not fila or fila["mapa_id"] != mapa or padre == nid:
            raise ErrorDatos("el nodo padre no es de este mapa")
    else:
        padre = None
    titulo = str(datos.get("title") or "").strip()[:120]
    if not titulo:
        raise ErrorDatos("el nodo necesita un título")
    color = str(datos.get("color") or "")
    if color and not COLOR_RE.match(color):
        raise ErrorDatos("color no válido")
    con.execute(
        """INSERT INTO nodos (id, mapa_id, padre_id, titulo, color, x, y, notas, creado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET mapa_id=excluded.mapa_id, padre_id=excluded.padre_id, titulo=excluded.titulo,
             color=excluded.color, x=excluded.x, y=excluded.y, notas=excluded.notas,
             actualizado=datetime('now', 'localtime')""",
        (nid, mapa, padre, titulo, color.upper() or None, real_o_nada(datos.get("x")), real_o_nada(datos.get("y")),
         str(datos.get("notes") or "")[:LIMITE_LIBRETA], str(datos.get("created") or "")[:40]),
    )


def guardar_conexion(con, cid, datos):
    cid = comprobar_id(cid, "conexión")
    if not isinstance(datos, dict):
        raise ErrorDatos("conexión no válida")
    a, b = comprobar_id(datos.get("a"), "nodo"), comprobar_id(datos.get("b"), "nodo")
    filas = {r["id"]: r for r in con.execute("SELECT id, mapa_id, padre_id FROM nodos WHERE id IN (?, ?)", (a, b))}
    if a == b or len(filas) != 2:
        raise ErrorDatos("conexión no válida")
    # Solo se conectan nodos del mismo nivel (mismo mapa y mismo nodo padre)
    if (filas[a]["mapa_id"], filas[a]["padre_id"]) != (filas[b]["mapa_id"], filas[b]["padre_id"]):
        raise ErrorDatos("solo se pueden conectar nodos del mismo nivel")
    con.execute("INSERT OR REPLACE INTO conexiones (id, desde, hasta) VALUES (?, ?, ?)", (cid, a, b))


borrar_mapa = borrar_de("mapas", "mapa")
borrar_nodo = borrar_de("nodos", "nodo")
borrar_conexion = borrar_de("conexiones", "conexión")


def nodos_por_profundidad(nodos):
    """Ordena los nodos para guardar siempre un padre antes que sus hijos."""
    def profundidad(nid, visto=()):
        padre = (nodos.get(nid) or {}).get("parent")
        return 0 if not padre or padre not in nodos or padre in visto else 1 + profundidad(padre, visto + (nid,))
    return sorted(nodos.items(), key=lambda kv: profundidad(kv[0]))


RUTAS_TABLEROS = {
    "/api/tableros/": (guardar_tablero, borrar_tablero),
    "/api/etiquetas-tablero/": (guardar_etiqueta_tablero, borrar_etiqueta_tablero),
    "/api/listas/": (guardar_lista, borrar_lista),
    "/api/tarjetas/": (guardar_tarjeta, borrar_tarjeta),
    "/api/mapas/": (guardar_mapa, borrar_mapa),
    "/api/nodos/": (guardar_nodo, borrar_nodo),
    "/api/conexiones/": (guardar_conexion, borrar_conexion),
}


def importar(con, estado):
    if not isinstance(estado, dict) or not isinstance(estado.get("days"), dict):
        raise ErrorDatos("copia no válida")
    con.execute("DELETE FROM mapas")      # en cascada: nodos y conexiones
    con.execute("DELETE FROM tableros")   # en cascada: listas, tarjetas, etiquetas y checklist
    con.execute("DELETE FROM eventos")
    con.execute("DELETE FROM notas")
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
    notas = estado.get("notes") or {}
    if isinstance(notas, dict):
        for fecha, n in notas.items():
            guardar_notas(con, str(fecha), n)
    eventos = estado.get("events") or {}
    if isinstance(eventos, dict):
        for eid, e in eventos.items():
            guardar_evento(con, eid, e)
    for clave, guardar in (("boards", guardar_tablero), ("blabels", guardar_etiqueta_tablero),
                           ("blists", guardar_lista), ("cards", guardar_tarjeta), ("maps", guardar_mapa)):
        coleccion = estado.get(clave) or {}
        if isinstance(coleccion, dict):
            for ident, datos in coleccion.items():
                guardar(con, ident, datos)
    nodos = estado.get("mnodes") or {}
    if isinstance(nodos, dict):
        for ident, datos in nodos_por_profundidad(nodos):
            guardar_nodo(con, ident, datos)
    conexiones = estado.get("mlinks") or {}
    if isinstance(conexiones, dict):
        for ident, datos in conexiones.items():
            guardar_conexion(con, ident, datos)


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
        limite = MAX_IMPORTAR if urlparse(self.path).path == "/api/importar" else MAX_BODY
        if largo < 0 or largo > limite:
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
                return self.responder(200, {"app": "ascenso", "version": VERSION_APP})
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
                    elif metodo == "PUT" and ruta.startswith("/api/notas/"):
                        guardar_notas(con, ruta[len("/api/notas/"):], self.leer_json())
                    elif metodo == "PUT" and ruta.startswith("/api/eventos/"):
                        guardar_evento(con, ruta[len("/api/eventos/"):], self.leer_json())
                    elif metodo == "DELETE" and ruta.startswith("/api/eventos/"):
                        borrar_evento(con, ruta[len("/api/eventos/"):])
                    elif ruta.startswith(tuple(RUTAS_TABLEROS)) and metodo in ("PUT", "DELETE"):
                        prefijo = next(p for p in RUTAS_TABLEROS if ruta.startswith(p))
                        guardar, borrar = RUTAS_TABLEROS[prefijo]
                        ident = ruta[len(prefijo):]
                        guardar(con, ident, self.leer_json()) if metodo == "PUT" else borrar(con, ident)
                    elif metodo == "POST" and ruta == "/api/apagar" and self.es_local():
                        # Lo usa una versión más nueva de Ascenso para sustituir a esta sin esperar
                        threading.Thread(target=apagar, args=(self.server,), daemon=True).start()
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


def apagar(servidor):
    global ultimo_latido
    ultimo_latido = 0              # termina también la espera del modo aplicación
    servidor.shutdown()
    servidor.server_close()        # libera el puerto al momento


def ascenso_en_marcha(puerto):
    """Si hay un Ascenso funcionando en ese puerto, devuelve su versión (0 si es antiguo); si no, None."""
    try:
        with urllib.request.urlopen("http://127.0.0.1:%d/api/ping" % puerto, timeout=1) as r:
            datos = json.loads(r.read())
            return int(datos.get("version") or 0) if datos.get("app") == "ascenso" else None
    except Exception:
        return None


def sustituir_antiguo(puerto):
    """Pide a un Ascenso más antiguo que se cierre y espera a que deje libre el puerto."""
    try:
        peticion = urllib.request.Request(
            "http://127.0.0.1:%d/api/apagar" % puerto, data=b"{}", method="POST",
            headers={"X-Ascenso": "1", "Content-Type": "application/json"})
        urllib.request.urlopen(peticion, timeout=2).close()
    except Exception:
        pass
    for _ in range(30):
        if ascenso_en_marcha(puerto) is None:
            return True
        time.sleep(0.2)
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

    if args.app:
        version = ascenso_en_marcha(args.puerto)
        if version is not None and version >= VERSION_APP:
            # Ya está en marcha y es esta misma versión: solo se abre otra ventana
            navegador = buscar_navegador()
            url = "http://127.0.0.1:%d/" % args.puerto
            try:
                abrir_ventana(navegador, url) if navegador else webbrowser.open(url)
            except OSError:
                webbrowser.open(url)
            return
        if version is not None and not sustituir_antiguo(args.puerto):
            # Un servidor de una versión anterior que no sabe cerrarse a petición
            sys.exit("Hay una versión anterior de Ascenso todavía en marcha.\n\n"
                     "Cierra su ventana, espera un minuto y vuelve a abrir Ascenso.\n"
                     "(O cierra «pythonw.exe» desde el Administrador de tareas.)")

    iniciar_bd()
    threading.Thread(target=vigilar_copias, daemon=True).start()

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
    print("  Copias diarias:  " + DIR_COPIAS + "  (últimos %d días)" % COPIAS_A_CONSERVAR)
    print("  Para cerrar, pulsa Ctrl+C.\n")

    if not args.no_abrir:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\n  Servidor cerrado.")
    finally:
        servidor.server_close()


def copia_diaria():
    """Una copia de ascenso.db al día en la carpeta «copias», conservando las de los últimos 14 días.

    Se usa la copia en caliente de SQLite, que es segura aunque Ascenso esté escribiendo en ese momento."""
    if not os.path.exists(DB_PATH):
        return
    os.makedirs(DIR_COPIAS, exist_ok=True)
    destino = os.path.join(DIR_COPIAS, "ascenso-%s.db" % date.today().isoformat())
    if not os.path.exists(destino):
        temporal = destino + ".tmp"
        origen = sqlite3.connect(DB_PATH)
        copia = sqlite3.connect(temporal)
        try:
            origen.backup(copia)
        finally:
            copia.close()
            origen.close()
        os.replace(temporal, destino)
    copias = sorted(f for f in os.listdir(DIR_COPIAS) if re.fullmatch(r"ascenso-\d{4}-\d{2}-\d{2}\.db", f))
    for vieja in copias[:-COPIAS_A_CONSERVAR]:
        try:
            os.remove(os.path.join(DIR_COPIAS, vieja))
        except OSError:
            pass


def vigilar_copias():
    """Hace la copia del día al arrancar y vuelve a comprobarlo cada hora (por si Ascenso sigue abierto de un día a otro)."""
    while True:
        try:
            copia_diaria()
        except Exception as e:          # una copia fallida nunca debe parar Ascenso
            try:
                apuntar("No se pudo hacer la copia diaria: %s" % e)
            except Exception:
                pass
        time.sleep(3600)


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

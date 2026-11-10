// Utilidades de las pruebas: un servidor de archivos estáticos para la app, el servidor clásico de Python
// en una carpeta temporal y un navegador (Playwright). Nada de esto forma parte de la aplicación.
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
export const { chromium, devices } = require("playwright");

const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".ico": "image/x-icon" };

// Sirve una carpeta (por defecto, la del repositorio) bajo una subruta, como GitHub Pages (/improve/).
// «extra» permite sustituir archivos, también mientras dura la prueba.
export function servirApp({ base = "/improve/", extra = {}, raiz = RAIZ } = {}) {
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    if (!u.pathname.startsWith(base)) { res.writeHead(404); return res.end(); }
    const rel = decodeURIComponent(u.pathname.slice(base.length)) || "ascenso.html";
    if (rel in extra) { res.writeHead(200, { "Content-Type": TIPOS[path.extname(rel)] || "text/plain", "Cache-Control": "no-store" }); return res.end(extra[rel]); }
    const archivo = path.join(raiz, rel);
    if (!archivo.startsWith(raiz + path.sep) || !fs.existsSync(archivo) || !fs.statSync(archivo).isFile()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": TIPOS[path.extname(archivo).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
    fs.createReadStream(archivo).pipe(res);
  });
  return new Promise(ok => srv.listen(0, "127.0.0.1", () => ok({ url: `http://127.0.0.1:${srv.address().port}${base}ascenso.html`,
    origen: `http://127.0.0.1:${srv.address().port}`, cerrar: () => new Promise(r => { srv.closeAllConnections(); srv.close(r); }) })));
}

// Arranca servidor.py (la versión clásica) sobre una copia en una carpeta temporal, con su propia base de datos vacía
export async function servidorClasico() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ascenso-clasico-"));
  for (const f of ["servidor.py", "ascenso.html"]) fs.copyFileSync(path.join(RAIZ, f), path.join(dir, f));
  fs.mkdirSync(path.join(dir, "assets"));
  const puerto = 20000 + Math.floor(Math.random() * 20000);
  const proc = spawn("python3", ["servidor.py", "--no-abrir", "--puerto", String(puerto)], { cwd: dir, stdio: "ignore" });
  const url = `http://127.0.0.1:${puerto}/api/`;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(url + "ping")).ok) break; } catch (e) { /* aún arrancando */ }
    await new Promise(r => setTimeout(r, 100));
  }
  const api = async (metodo, ruta, cuerpo) => {
    const opt = { method: metodo, headers: { "X-Ascenso": "1" } };
    if (cuerpo !== undefined) { opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(cuerpo); }
    const r = await fetch(url + ruta, opt), j = await r.json();
    if (!r.ok) throw new Error(j.error || "error " + r.status);
    return j;
  };
  return { api, cerrar: () => { proc.kill(); fs.rmSync(dir, { recursive: true, force: true }); } };
}

// Llama al servidor local (IndexedDB) dentro de la página
export async function apiLocal(pagina, metodo, ruta, cuerpo) {
  const r = await pagina.evaluate(([m, ru, c]) => window.AscensoLocal.api(m, ru, c === null ? undefined : c).then(ok => ({ ok }), e => ({ error: e.message })),
    [metodo, ruta, cuerpo === undefined ? null : cuerpo]);
  if ("error" in r) throw new Error(r.error);
  return r.ok;
}

// Una imagen PNG mínima (1×1), en base64
export const PNG_1X1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

// Abre la app en un contexto nuevo y la deja con los datos de ejemplo (pruebas/datos/semilla.json)
export const paginaLista = p => p.waitForFunction(() => /Guardado/.test(document.getElementById("status").textContent));
export async function abrirConDatos(nav, app, opciones = {}) {
  const semilla = JSON.parse(fs.readFileSync(path.join(RAIZ, "pruebas", "datos", "semilla.json"), "utf8"));
  const hoy = new Date(), f = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  for (const t of Object.values(semilla.tasks)) t.date = f(hoy);      // las tareas de ejemplo, en el día de hoy
  const ctx = await nav.newContext(opciones), pagina = await ctx.newPage();
  await pagina.goto(app.url); await paginaLista(pagina);
  const estado = await apiLocal(pagina, "GET", "estado");
  await apiLocal(pagina, "POST", "importar", { ...estado, ...semilla });
  await pagina.reload(); await paginaLista(pagina);
  return { ctx, pagina };
}

// Gestos con el dedo (eventos táctiles de verdad, por el protocolo de Chromium)
export async function dedos(pagina) {
  const cdp = await pagina.context().newCDPSession(pagina);
  const tocar = (tipo, puntos) => cdp.send("Input.dispatchTouchEvent", { type: tipo, touchPoints: puntos.map((p, i) => ({ x: Math.round(p[0]), y: Math.round(p[1]), id: i })) });
  const espera = ms => new Promise(r => setTimeout(r, ms));
  return {
    // Mantener pulsado y arrastrar hasta otro punto
    async arrastrar(desde, hasta, { pulsacion = 450, pasos = 10 } = {}) {
      await tocar("touchStart", [desde]); await espera(pulsacion);
      for (let i = 1; i <= pasos; i++) { await tocar("touchMove", [[desde[0] + (hasta[0] - desde[0]) * i / pasos, desde[1] + (hasta[1] - desde[1]) * i / pasos]]); await espera(25); }
      await espera(120); await tocar("touchEnd", []); await espera(150);
    },
    // Pellizcar: dos dedos que se separan (o se juntan) alrededor de un punto
    async pellizcar(centro, de, a, pasos = 8) {
      const par = d => [[centro[0] - d / 2, centro[1]], [centro[0] + d / 2, centro[1]]];
      await tocar("touchStart", [par(de)[0]]); await espera(30); await tocar("touchStart", par(de));
      for (let i = 1; i <= pasos; i++) { await tocar("touchMove", par(de + (a - de) * i / pasos)); await espera(25); }
      await tocar("touchEnd", []); await espera(100);
    },
  };
}
export const centro = async loc => { const b = await loc.boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };

// Genera en una carpeta temporal lo mismo que se publica en GitHub Pages (herramientas/generar.py --publicar)
export function sitioPublicado() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ascenso-sitio-"));
  const r = spawnSync("python3", [path.join(RAIZ, "herramientas", "generar.py"), "--publicar", dir], { encoding: "utf8" });
  if (r.status !== 0) throw new Error("generar.py falló: " + r.stderr);
  return { dir, borrar: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

// Espera a que una función de la página (que puede ser asíncrona) devuelva algo cierto.
// (waitForFunction de Playwright no espera a las promesas: una promesa siempre le parece «cierta».)
export async function esperar(pagina, funcion, argumento, { limite = 8000, que = "la condición" } = {}) {
  const fin = Date.now() + limite;
  for (;;) {
    let r = false;
    try { r = await pagina.evaluate(funcion, argumento); } catch (e) { if (!/context was destroyed|navigation/i.test(String(e))) throw e; }
    if (r) return r;
    if (Date.now() > fin) throw new Error("No se cumplió a tiempo: " + que);
    await new Promise(ok => setTimeout(ok, 100));
  }
}

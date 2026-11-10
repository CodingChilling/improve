// Utilidades de las pruebas: un servidor de archivos estáticos para la app, el servidor clásico de Python
// en una carpeta temporal y un navegador (Playwright). Nada de esto forma parte de la aplicación.
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
export const { chromium, devices } = require("playwright");

const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".ico": "image/x-icon" };

// Sirve la carpeta del repositorio bajo una subruta, como GitHub Pages (/improve/). «extra» permite sustituir archivos.
export function servirApp({ base = "/improve/", extra = {} } = {}) {
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    if (!u.pathname.startsWith(base)) { res.writeHead(404); return res.end(); }
    const rel = decodeURIComponent(u.pathname.slice(base.length)) || "ascenso.html";
    if (rel in extra) { res.writeHead(200, { "Content-Type": TIPOS[path.extname(rel)] || "text/plain", "Cache-Control": "no-store" }); return res.end(extra[rel]); }
    const archivo = path.join(RAIZ, rel);
    if (!archivo.startsWith(RAIZ + path.sep) || !fs.existsSync(archivo) || !fs.statSync(archivo).isFile()) { res.writeHead(404); return res.end(); }
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

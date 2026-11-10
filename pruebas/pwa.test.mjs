// La aplicación publicada (lo que sube el workflow a GitHub Pages): se instala, abre sin conexión,
// respeta la política de seguridad y avisa cuando hay una versión nueva.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { servirApp, sitioPublicado, chromium, apiLocal, paginaLista, esperar, RAIZ } from "./util.mjs";

test("solo se publica la aplicación, con rutas relativas", () => {
  const sitio = sitioPublicado();
  try {
    const todo = fs.readdirSync(sitio.dir, { recursive: true }).map(String);
    assert.ok(todo.includes("ascenso.html") && todo.includes("service-worker.js") && todo.includes(path.join("assets", "precache.js")));
    assert.deepEqual(todo.filter(f => /\.(py|bat|command|db|mjs|icns|ico)$/.test(f) || /^(pruebas|herramientas|supabase|\.github)/.test(f)), []);
    const manifest = JSON.parse(fs.readFileSync(path.join(sitio.dir, "assets", "manifest.webmanifest"), "utf8"));
    // El manifest está en assets/: su inicio y su ámbito son la carpeta de la aplicación, esté donde esté publicada
    const en = u => new URL(u, "https://ejemplo.github.io/improve/assets/manifest.webmanifest").href;
    assert.equal(en(manifest.start_url), "https://ejemplo.github.io/improve/ascenso.html");
    assert.equal(en(manifest.scope), "https://ejemplo.github.io/improve/");
    for (const i of manifest.icons) assert.ok(fs.existsSync(path.join(sitio.dir, "assets", i.src.split("?")[0])), i.src);
    assert.ok(manifest.icons.some(i => i.purpose === "maskable") && manifest.icons.some(i => i.sizes === "192x192") && manifest.icons.some(i => i.sizes === "512x512"));
    const html = fs.readFileSync(path.join(sitio.dir, "ascenso.html"), "utf8");
    assert.doesNotMatch(html, /(src|href)="\//, "ninguna ruta absoluta: la app vive bajo una subruta");
    const csp = html.match(/Content-Security-Policy" content="([^"]*)"/)[1];
    assert.match(csp, /connect-src 'self' https:\/\/[a-z0-9]+\.supabase\.co wss:\/\/[a-z0-9]+\.supabase\.co;/);
    assert.doesNotMatch(csp, /unsafe-eval|\*/);
    assert.match(csp, /script-src 'self';/);
  } finally { sitio.borrar(); }
});

test("la lista de imágenes del día que hay en el repositorio está al día", () => {
  // assets/images/lista.json va en el repositorio para que las imágenes salgan en cualquier alojamiento, aunque no se
  // ejecute el generador. Si esta prueba falla: python3 herramientas/generar.py y subir el cambio.
  const EXT = /\.(jpe?g|png|webp|gif|avif)$/i, carpeta = path.join(RAIZ, "assets", "images");
  const enCarpeta = fs.readdirSync(carpeta).filter(f => EXT.test(f)).sort();
  const enLista = JSON.parse(fs.readFileSync(path.join(carpeta, "lista.json"), "utf8")).map(i => i.nombre).sort();
  assert.deepEqual(enLista, enCarpeta);
});

test("se instala, abre sin conexión y avisa de una versión nueva", async () => {
  const sitio = sitioPublicado(), extra = {};
  const app = await servirApp({ raiz: sitio.dir, extra }), nav = await chromium.launch();
  try {
    const ctx = await nav.newContext(), pagina = await ctx.newPage(), avisos = [];
    pagina.on("console", m => { if (/Content Security Policy|Refused to/i.test(m.text())) avisos.push(m.text()); });
    pagina.on("pageerror", e => avisos.push(String(e)));
    await pagina.goto(app.url); await paginaLista(pagina);
    await pagina.evaluate(() => navigator.serviceWorker.ready);
    await pagina.waitForFunction(() => !!navigator.serviceWorker.controller);
    await apiLocal(pagina, "PUT", "notas/2026-01-05", { r: "Esto debe seguir aquí sin conexión", n: "" });
    // Las imágenes del día se van guardando solas en segundo plano
    const total = JSON.parse(fs.readFileSync(path.join(sitio.dir, "assets", "images", "lista.json"), "utf8")).length;
    await esperar(pagina, n => caches.open("ascenso-imagenes").then(c => c.keys()).then(k => k.length >= n), total, { limite: 180000, que: "se guardan todas las imágenes del día" });

    // Sin conexión: la aplicación abre igual (página, estilos, tipografías, imagen del día) y los datos están
    await ctx.setOffline(true);
    await pagina.reload(); await paginaLista(pagina);
    assert.equal((await apiLocal(pagina, "GET", "estado")).notes["2026-01-05"].r, "Esto debe seguir aquí sin conexión");
    assert.ok(await pagina.evaluate(() => document.fonts.ready.then(() => getComputedStyle(document.querySelector("h1")).fontFamily.length > 0 && document.styleSheets.length >= 2)));
    await pagina.waitForFunction(() => { const i = document.querySelector("#frame img.on"); return i && i.naturalWidth > 0; }, null, { timeout: 15000 });
    // También entrando por la raíz de la carpeta (como abre el icono si el sistema usa el ámbito)
    await pagina.goto(app.url.replace("ascenso.html", "")); await paginaLista(pagina);
    await ctx.setOffline(false);
    assert.deepEqual(avisos, [], "ni errores ni avisos de la política de seguridad");

    // Se publica una versión nueva: aparece el aviso y, al aceptar, se recarga con ella
    const precache = fs.readFileSync(path.join(sitio.dir, "assets", "precache.js"), "utf8");
    extra["assets/precache.js"] = precache.replace(/"version": "[0-9a-f]+"/, '"version": "versionnueva00001"');
    await pagina.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update()));
    const aviso = pagina.locator("#aviso-version");
    await aviso.waitFor({ timeout: 20000 });
    assert.match(await aviso.textContent(), /versión nueva/);
    await Promise.all([pagina.waitForEvent("load"), aviso.getByText("Recargar").click()]);
    await paginaLista(pagina);
    assert.deepEqual(await pagina.evaluate(() => caches.keys().then(k => k.filter(n => n.startsWith("ascenso-app-")))), ["ascenso-app-versionnueva00001"]);
    assert.equal(await pagina.locator("#aviso-version").count(), 0);
    assert.equal((await apiLocal(pagina, "GET", "estado")).notes["2026-01-05"].r, "Esto debe seguir aquí sin conexión");
  } finally { await nav.close(); await app.cerrar(); sitio.borrar(); }
});

// La página, usada como lo haría una persona, guarda en el dispositivo (IndexedDB) y no en localStorage;
// y la versión clásica (servidor.py) sigue guardando en su base de datos.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { servirApp, chromium, apiLocal, RAIZ } from "./util.mjs";

const lista = p => p.waitForFunction(() => /Guardado|Conectado/.test(document.getElementById("status").textContent));

test("una tarea creada en la página se guarda en el dispositivo y sigue ahí al recargar", async () => {
  const app = await servirApp(), nav = await chromium.launch();
  try {
    const pagina = await nav.newPage(), errores = [];
    pagina.on("pageerror", e => errores.push(String(e)));
    pagina.on("console", m => { if (m.type() === "error") errores.push(m.text()); });
    await pagina.goto(app.url); await lista(pagina);
    await pagina.fill("#tnew", "Tarea de prueba");
    await pagina.click("#taddbtn");
    // Se recarga enseguida, sin esperar: el cambio no debe perderse
    await pagina.waitForTimeout(150);
    await pagina.reload(); await lista(pagina);
    await pagina.locator("#board", { hasText: "Tarea de prueba" }).waitFor();
    // Nada personal en localStorage; cada cambio queda apuntado para la cuenta
    const claves = await pagina.evaluate(() => Object.keys(localStorage));
    assert.ok(!claves.includes("ascenso-v1"), "no debe quedar copia en localStorage: " + claves);
    const pendientes = await pagina.evaluate(() => window.AscensoAlmacen.todos("pendientes"));
    const p = pendientes.find(x => x.tabla === "tareas");
    assert.ok(p && p.datos.title === "Tarea de prueba" && p.borrado === false && /^\d{4}-\d\d-\d\dT.*Z$/.test(p.actualizado));
    // Borrado lógico: el registro queda marcado y la lectura lo ignora
    await apiLocal(pagina, "DELETE", "tareas/" + p.id);
    const reg = (await pagina.evaluate(() => window.AscensoAlmacen.todos("registros"))).find(x => x.tabla === "tareas" && x.id === p.id);
    assert.equal(reg.borrado, true);
    assert.ok(!(p.id in (await apiLocal(pagina, "GET", "estado")).tasks));
    // Las imágenes del día salen de la lista generada
    assert.match(await pagina.locator("#imgcfg").textContent(), /^\d+ imágenes/);
    assert.deepEqual(errores, []);
  } finally { await nav.close(); await app.cerrar(); }
});

test("lo que había en localStorage de versiones anteriores pasa a la base de datos del dispositivo", async () => {
  const app = await servirApp(), nav = await chromium.launch();
  try {
    const ctx = await nav.newContext();
    await ctx.addInitScript(() => { if (!sessionStorage.getItem("sembrado")) { sessionStorage.setItem("sembrado", "1");
      localStorage.setItem("ascenso-v1", JSON.stringify({ days: { "2026-01-05": { w: 80 } }, tasks: { t1: { date: "2026-01-05", title: "Antigua", prio: "alta", list: "pendiente", tags: [] } } })); } });
    const pagina = await ctx.newPage();
    await pagina.goto(app.url); await lista(pagina);
    const e = await apiLocal(pagina, "GET", "estado");
    assert.equal(e.tasks.t1.title, "Antigua"); assert.equal(e.days["2026-01-05"].w, 80);
    assert.equal(await pagina.evaluate(() => localStorage.getItem("ascenso-v1")), null);
  } finally { await nav.close(); await app.cerrar(); }
});

test("la versión clásica (servidor.py) sigue guardando en ascenso.db", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ascenso-clasico-"));
  for (const f of ["servidor.py", "ascenso.html"]) fs.copyFileSync(path.join(RAIZ, f), path.join(dir, f));
  for (const d of ["js", "css", "icono", "vendor"]) fs.cpSync(path.join(RAIZ, "assets", d), path.join(dir, "assets", d), { recursive: true });
  fs.mkdirSync(path.join(dir, "assets", "images"));
  const puerto = 20000 + Math.floor(Math.random() * 20000);
  const proc = spawn("python3", ["servidor.py", "--no-abrir", "--puerto", String(puerto)], { cwd: dir, stdio: "ignore" });
  const nav = await chromium.launch();
  try {
    const base = `http://127.0.0.1:${puerto}/`;
    for (let i = 0; i < 100; i++) { try { if ((await fetch(base + "api/ping")).ok) break; } catch (e) { /* arrancando */ } await new Promise(r => setTimeout(r, 100)); }
    const pagina = await nav.newPage();
    await pagina.goto(base + "ascenso.html"); await lista(pagina);
    assert.match(await pagina.locator("#status").textContent(), /ascenso\.db/);
    await pagina.fill("#tnew", "Tarea clásica"); await pagina.click("#taddbtn");
    await pagina.waitForFunction(() => /Guardado en la base de datos/.test(document.getElementById("status").textContent));
    const estado = await (await fetch(base + "api/estado")).json();
    assert.ok(Object.values(estado.tasks).some(t => t.title === "Tarea clásica"));
    assert.equal((await pagina.evaluate(() => indexedDB.databases())).length, 0, "la versión clásica no usa IndexedDB");
  } finally { await nav.close(); proc.kill(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test("las imágenes de las libretas se guardan en el dispositivo y las huérfanas se borran a los 30 días", async () => {
  const { PNG_1X1 } = await import("./util.mjs");
  const app = await servirApp(), nav = await chromium.launch();
  try {
    const pagina = await nav.newPage();
    await pagina.goto(app.url); await lista(pagina);
    for (const id of ["usada", "suelta", "vieja"]) await apiLocal(pagina, "PUT", "adjuntos/" + id, { tipo: "image/png", ancho: 1, alto: 1, datos: PNG_1X1 });
    await apiLocal(pagina, "PUT", "mapas/m1", { title: "Mapa", color: "#2E86AB", notes: "![](imagen:usada|w=0.5)" });
    // La imagen se pinta desde la base de datos (dirección blob:), sin red
    const ancho = await pagina.evaluate(async () => {
      const im = document.createElement("img"); im.dataset.adj = "usada"; document.body.appendChild(im);
      im.src = window.AscensoLocal.urlAdjunto("usada");
      for (let i = 0; i < 100 && !im.src.startsWith("blob:"); i++) await new Promise(r => setTimeout(r, 20));
      await im.decode(); return im.src.startsWith("blob:") && im.naturalWidth;
    });
    assert.equal(ancho, 1);
    const hace = d => { const f = new Date(Date.now() - d * 86400000); return f.getFullYear() + "-" + String(f.getMonth() + 1).padStart(2, "0") + "-" + String(f.getDate()).padStart(2, "0"); };
    await pagina.evaluate(() => window.AscensoLocal.limpiarAdjuntos());
    assert.deepEqual(Object.keys(await pagina.evaluate(() => window.AscensoAlmacen.meta("huerfanos"))).sort(), ["suelta", "vieja"]);
    await pagina.evaluate(f => window.AscensoAlmacen.ponerMeta("huerfanos", { suelta: f[0], vieja: f[1] }), [hace(29), hace(31)]);
    await pagina.evaluate(() => window.AscensoLocal.limpiarAdjuntos());
    assert.deepEqual(Object.keys((await apiLocal(pagina, "GET", "estado")).att).sort(), ["suelta", "usada"]);
    assert.deepEqual((await pagina.evaluate(() => window.AscensoAlmacen.todos("adjuntos"))).map(a => a.id).sort(), ["suelta", "usada"]);
  } finally { await nav.close(); await app.cerrar(); }
});

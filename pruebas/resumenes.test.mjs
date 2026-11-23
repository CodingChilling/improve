// Resúmenes de la semana, el mes y el año: periodos cerrados, cifras calculadas, aviso en el día e imagen 1080 × 1350.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { servirApp, chromium, abrirConDatos, esperar, RAIZ } from "./util.mjs";

const cargar = () => {
  const window = {};
  for (const f of ["niveles.js", "estadisticas.js", "objetivos.js", "figura.js", "resumenes.js"]) new Function("window", fs.readFileSync(path.join(RAIZ, "assets/js", f), "utf8"))(window);
  return window.AscensoResumenes;
};

test("periodos cerrados, títulos y aviso de cada día", () => {
  const R = cargar(), lunes = new Date(2026, 10, 16), martes = new Date(2026, 10, 17);
  let p = R.periodo("semana", 0, martes);
  assert.equal(p.titulo, "Semana del 9 de noviembre"); assert.equal(p.rango, "9 – 15 de noviembre de 2026");
  assert.equal(R.nombreArchivo(p), "Ascenso - Semana del 9 de noviembre.png");
  p = R.periodo("semana", 2, martes); assert.equal(p.rango, "26 de octubre – 1 de noviembre de 2026");
  p = R.periodo("mes", 0, martes); assert.equal(p.titulo, "Octubre de 2026"); assert.equal(p.rango, "1 – 31 de octubre de 2026");
  p = R.periodo("año", 0, martes); assert.equal(p.titulo, "Año 2025");
  assert.equal(R.periodo("semana", 0, new Date(2027, 0, 5)).titulo, "Semana del 28 de diciembre de 2026");
  assert.equal(R.avisoDeHoy(lunes).tipo, "semana");
  assert.equal(R.avisoDeHoy(martes), null);
  assert.equal(R.avisoDeHoy(new Date(2026, 11, 1)).tipo, "mes");
  assert.equal(R.avisoDeHoy(new Date(2027, 0, 1)).tipo, "año", "el 1 de enero, el del año (aunque sea viernes)");
});

test("cifras de una semana cerrada", () => {
  const R = cargar(), T = [true, true, true, true, true, true, true], k = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const s = { thr: 0.66, habits: [{ id: "a", t: "Leer", streak: true, week: true, days: T }, { id: "b", t: "Correr", streak: false, week: true, days: T }], days: {}, tasks: {}, notes: {}, cards: {}, blists: {}, objetivos: {}, perfil: { figura: "mujer" } };
  // Semana del 9 al 15 de noviembre de 2026: «Leer» todos los días, «Correr» 3; ánimo 4; 2 tareas; 1 reflexión
  for (let i = 0; i < 7; i++) { const d = new Date(2026, 10, 9 + i); s.days[k(d)] = { c: { a: true, b: i < 3 }, a: 4 }; }
  s.days["2026-11-02"] = { c: { a: true } };
  s.tasks.t1 = { list: "hecha", prio: "alta", done: new Date(2026, 10, 10, 12).toISOString(), date: "2026-11-10" };
  s.tasks.t2 = { list: "hecha", prio: "baja", done: "2026-11-14", date: "2026-11-14" };
  s.tasks.t3 = { list: "hecha", prio: "baja", done: "2026-11-16", date: "2026-11-16" };
  s.notes["2026-11-12"] = { r: "Buen día" };
  s.objetivos.o = { titulo: "", tipo: "tareas", meta: 2, desde: "2026-11-09", hasta: "2026-11-30" };
  const per = R.periodo("semana", 0, new Date(2026, 10, 17)), r = R.calcular(s, per);
  assert.equal(r.habitos.hechos, 10); assert.equal(r.habitos.total, 14);
  assert.equal(r.mejorHabito.nombre, "Leer"); assert.equal(r.racha, 7);
  assert.equal(r.tareas.hechas, 2); assert.deepEqual(r.tareas.porPrioridad, { urgente: 0, alta: 1, media: 0, baja: 1 });
  assert.equal(r.animo.media, 4); assert.equal(r.reflexiones.n, 1);
  assert.deepEqual(r.objetivos.map(g => g.el), ["2026-11-14"]);
  assert.ok(r.xp.ganada > 0); assert.ok(r.xp.ganada < r.xp.total, "lo de antes de la semana no cuenta");
  assert.match(R.frase(r, per), /^Cumpliste el 71 % de tus hábitos, terminaste 2 tareas y subiste \d+ niveles?\. Son 64 puntos más de hábitos que la semana anterior\.$/);
});

test("resúmenes en el perfil: aviso del lunes, navegar y guardar la imagen", async () => {
  const app = await servirApp(), nav = await chromium.launch();
  try {
    const { ctx, pagina: p } = await abrirConDatos(nav, app, { viewport: { width: 390, height: 844 }, acceptDownloads: true });
    const errores = []; p.on("pageerror", e => errores.push(String(e)));
    // Lunes 16 de noviembre de 2026, con cinco semanas de hábitos
    await ctx.clock.setFixedTime(new Date(2026, 10, 16, 10));
    await p.reload(); await p.waitForFunction(() => window.AscensoPerfil && typeof state === "object");
    await p.evaluate(() => { const h = state.habits[0].id; for (let i = 1; i <= 35; i++) { const d = new Date(2026, 10, 16 - i); state.days[key(d)] = { c: { [h]: i % 3 !== 0 }, a: 3 + (i % 2) }; } save(); });
    await esperar(p, async () => Object.keys((await window.AscensoLocal.api("GET", "estado")).days || {}).length >= 35, null, { que: "los días guardados" });
    await p.reload(); await p.waitForFunction(() => window.AscensoPerfil && typeof state === "object");
    // El aviso del lunes, en la página del día
    const aviso = p.locator("#aviso-resumen");
    await aviso.waitFor({ timeout: 5000 }).catch(async e => { console.log("DEPURA", await p.evaluate(() => [String(new Date()), Object.keys(state.days).length, JSON.stringify(window.AscensoResumenes && window.AscensoResumenes.avisoDeHoy()), window.AscensoEstadisticas.primerDia(state), localStorage.getItem("ascenso-resumen-visto"), document.getElementById("aviso-resumen")?.outerHTML.slice(0,200)])); throw e; });
    assert.match(await aviso.innerText(), /Tu resumen de la semana está listo/);
    await aviso.locator("[data-aviso-ver]").click();
    await p.locator("#pf-informe:not([hidden])").waitFor();
    assert.equal(await p.locator(".pf-inf-cab h3").innerText(), "Semana del 9 de noviembre");
    assert.ok(await p.locator("#pf-periodos").isHidden());
    assert.equal(await p.locator('.pf-inf-mover[data-inf-mover="-1"]').isDisabled(), true, "no hay semana siguiente cerrada");
    // Navegar a la semana anterior y volver
    await p.click('.pf-inf-mover[data-inf-mover="1"]');
    assert.equal(await p.locator(".pf-inf-cab h3").innerText(), "Semana del 2 de noviembre");
    await p.click('.pf-inf-mover[data-inf-mover="-1"]');
    // El mes: octubre
    await p.click('[data-inf-tipo="mes"]');
    assert.equal(await p.locator(".pf-inf-cab h3").innerText(), "Octubre de 2026");
    assert.ok(await p.locator(".pf-tile").count() >= 6);
    // Guardar como imagen: un PNG de 1080 × 1350 con el nombre del periodo
    const [descarga] = await Promise.all([p.waitForEvent("download"), p.click("[data-inf-png]")]);
    assert.equal(descarga.suggestedFilename(), "Ascenso - Octubre de 2026.png");
    const png = fs.readFileSync(await descarga.path());
    assert.equal(png.toString("ascii", 1, 4), "PNG");
    assert.equal(png.readUInt32BE(16), 1080); assert.equal(png.readUInt32BE(20), 1350);
    await esperar(p, () => /Descargas/.test(document.getElementById("pf-inf-estado").textContent));
    // Atrás (como el botón del móvil): vuelve al perfil; el aviso ya no sale
    await p.evaluate(() => window.AscensoPerfil.atras());
    assert.ok(await p.locator("#pf-informe").isHidden()); assert.ok(await p.locator("#pf-resumen").isVisible());
    assert.equal(await p.locator(".pf-res-lista button").count(), 2, "semana y mes; el año 2025 no tiene datos");
    await p.click("#pf-volver");
    assert.ok(await aviso.isHidden());
    await p.reload(); await p.waitForFunction(() => window.AscensoPerfil && typeof state === "object");
    assert.ok(await aviso.isHidden(), "lo visto se recuerda en el dispositivo");
    assert.deepEqual(errores, []);
  } finally { await nav.close(); await app.cerrar(); }
});

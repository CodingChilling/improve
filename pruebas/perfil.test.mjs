// El perfil: se entra por la racha y por la barra (columna a la izquierda en el ordenador), muestra la figura y el
// nivel calculado con los datos (sube y baja con ellos), y en Ajustes están el perfil, el tema, la cuenta y la
// configuración que antes estaba al final de la página del día.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { servirApp, chromium, abrirConDatos, apiLocal, paginaLista, esperar, RAIZ } from "./util.mjs";

test("niveles: 120 nombres que avanzan, curva y experiencia calculada", async () => {
  const window = {}; new Function("window", fs.readFileSync(path.join(RAIZ, "assets/js/niveles.js"), "utf8"))(window);
  const N = window.AscensoNiveles;
  for (const f of ["hombre", "mujer"]) {
    const nombres = Array.from({ length: 120 }, (_, i) => N.nombre(i + 1, f));
    assert.equal(new Set(nombres).size, 120, "120 nombres distintos (" + f + ")");
  }
  assert.equal(N.nombre(1, "mujer"), "Recién llegada"); assert.equal(N.nombre(120, "hombre"), "Hombre de Vitruvio");
  assert.equal(N.nombre(122, "mujer"), "Mujer de Vitruvio III", "más allá del 120 se sigue acumulando");
  let antes = 0;
  for (let n = 2; n <= 200; n++) { assert.ok(N.umbral(n) > antes); antes = N.umbral(n); assert.equal(N.nivelDe(N.umbral(n)).nivel, n); assert.equal(N.nivelDe(N.umbral(n) - 1).nivel, n - 1); }
  // Experiencia de un estado sintético: 2 hábitos (uno de racha) durante 10 días seguidos
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const k = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const T = [true, true, true, true, true, true, true];
  const state = { thr: 0.66, habits: [{ id: "a", streak: true, week: true, days: T }, { id: "b", streak: false, week: true, days: T }], days: {},
    tasks: { t1: { list: "hecha", prio: "urgente", check: [{ d: true }, { d: false }] }, t2: { list: "pendiente", prio: "alta" } },
    cards: { c1: { list: "l1", check: [] } }, blists: { l1: { title: "Hecho" } }, notes: {} };
  state.notes[k(hoy)] = { r: "algo", n: "" };
  for (let i = 9; i >= 0; i--) { const d = new Date(hoy); d.setDate(d.getDate() - i); state.days[k(d)] = { c: { a: true, b: true } }; }
  const xp = N.experiencia(state, { libros: { l: {} }, lecturas: { l: { pct: 1 } }, subrayados: { s1: {}, s2: {} } });
  assert.deepEqual(xp.partes, { habitos: 150, rachas: 55, semanas: xp.partes.semanas, tareas: 25, checklists: 3, tarjetas: 12, diario: 15, lectura: 204, objetivos: 0 });
  assert.ok(xp.partes.semanas >= 40 && xp.partes.semanas % 40 === 0);
  assert.deepEqual(N.rachas(state), { actual: 10, mejor: 10, desde: k(new Date(hoy.getTime() - 9 * 864e5)), dias: 10 });
  delete state.days[k(hoy)].c.a;                                     // desmarcar resta
  assert.ok(N.experiencia(state).total < xp.total);
});

test("perfil: acceso, nivel, Ajustes, tema y configuración movida", async () => {
  const app = await servirApp(), nav = await chromium.launch();
  try {
    const { pagina: p } = await abrirConDatos(nav, app, { viewport: { width: 1280, height: 860 } });
    const errores = []; p.on("pageerror", e => errores.push(String(e)));
    // La configuración ya no está al final del día, sino en Ajustes
    for (const id of ["cfg", "typecfgbox", "imgcfgbox", "backupbox"]) assert.equal(await p.locator(`main #${id}`).count(), 0, id + " fuera del día");
    // ---- Entrar por la racha; también por la barra
    await p.click(".summit"); await p.locator("#perfil:not([hidden])").waitFor();
    assert.ok(!(await p.locator("main").isVisible()));
    assert.equal(await p.locator("#barra [aria-current=page]").getAttribute("data-ir"), "perfil");
    await p.click("#pf-volver"); assert.ok(await p.locator("main").isVisible());
    await p.click('#barra [data-ir="perfil"]'); await p.locator("#perfil:not([hidden])").waitFor();
    // ---- Nivel calculado con los datos: sube al marcar un hábito y baja al desmarcarlo
    const puntos = async () => +(await p.locator(".pf-xp").innerText()).match(/^([\d.]+)/)[1].replace(/\./g, "");
    const esperado = () => p.evaluate(() => window.AscensoNiveles.experiencia(state).total);
    const x0 = await puntos();
    assert.ok(Math.abs(x0 - await esperado()) <= 0, "el resumen muestra la experiencia calculada");
    assert.equal(await p.locator(".pf-nivel strong").innerText(), await p.evaluate(x => window.AscensoNiveles.nombre(window.AscensoNiveles.nivelDe(x).nivel, "hombre"), x0));
    assert.equal(await p.locator(".pf-figura svg.vitruvio").count(), 1);
    await p.click("#pf-volver");
    await p.locator("#checks li button").first().click();
    await p.click(".summit");
    const x1 = await puntos(); assert.ok(x1 > x0, "marcar un hábito suma");
    await p.click("#pf-volver"); await p.locator("#checks li button").first().click(); await p.click(".summit");
    assert.equal(await puntos(), x0, "desmarcarlo resta");
    // ---- Ajustes: figura, nombre y «mi porqué», que se guardan y se ven en el resumen
    await p.click('[data-pf="ajustes"]');
    await p.click('[data-figura="mujer"]');
    await p.fill("#pf-nombre", "Ana"); await p.fill("#pf-porque", "Subir un poco cada día");
    await esperar(p, () => window.AscensoLocal.api("GET", "estado").then(e => e.perfil && e.perfil.figura === "mujer" && e.perfil.nombre === "Ana" && e.perfil.porque === "Subir un poco cada día"), null, { que: "el perfil se guarda" });
    await p.click('[data-pf="resumen"]');
    assert.match(await p.locator(".pf-saludo").innerText(), /, Ana$/);
    assert.equal(await p.locator(".pf-porque").innerText(), "Subir un poco cada día");
    assert.match(await p.locator(".pf-nivel strong").innerText(), /Recién llegada|Curiosa|Aprendiz/);
    // ---- Tema: oscuro a mano (se recuerda al recargar) y vuelta a automático
    await p.click('[data-pf="ajustes"]'); await p.click('[data-tema="oscuro"]');
    assert.equal(await p.evaluate(() => document.documentElement.dataset.theme), "dark");
    assert.equal(await p.evaluate(() => getComputedStyle(document.body).color), "rgb(232, 236, 234)");
    await p.reload(); await paginaLista(p);
    assert.equal(await p.evaluate(() => document.documentElement.dataset.theme), "dark", "el tema se recuerda");
    assert.equal(await p.locator('meta[name="theme-color"]').first().getAttribute("content"), "#1D2428");
    await p.click(".summit"); await p.click('[data-pf="ajustes"]'); await p.click('[data-tema="auto"]');
    assert.equal(await p.evaluate(() => document.documentElement.dataset.theme), undefined);
    // ---- La configuración movida funciona: añadir un hábito
    const habitos = await p.evaluate(() => state.habits.length);
    await p.evaluate(() => { document.getElementById("cfg").open = true; });
    await p.click("#addh");
    assert.equal(await p.evaluate(() => state.habits.length), habitos + 1);
    // ---- El texto de estado lleva a Ajustes › Cuenta
    await p.click("#pf-volver"); await p.click("#status");
    await p.locator("#cuentadlg").waitFor({ state: "visible" });
    assert.equal(await p.locator('[data-pf="ajustes"]').getAttribute("aria-selected"), "true");
    await p.keyboard.press("Escape"); assert.ok(await p.locator("main").isVisible(), "Esc cierra el perfil");
    assert.deepEqual(errores, []);
  } finally { await nav.close(); await app.cerrar(); }
});

test("perfil: ánimo, tareas fechadas, estadísticas, zonas y descubrimientos", async () => {
  const app = await servirApp(), nav = await chromium.launch();
  try {
    const { pagina: p } = await abrirConDatos(nav, app, { viewport: { width: 1280, height: 900 } });
    const errores = []; p.on("pageerror", e => errores.push(String(e)));
    // ---- Ánimo del día: un toque lo pone, otro en la misma cara lo quita
    await p.click('#animo [data-animo="4"]');
    assert.equal(await p.locator('#animo [aria-checked="true"]').getAttribute("aria-label"), "Bien");
    await esperar(p, () => window.AscensoLocal.api("GET", "estado").then(e => e.days[key(today())] && e.days[key(today())].a === 4), null, { que: "el ánimo se guarda" });
    await p.click('#animo [data-animo="4"]');
    assert.equal(await p.locator('#animo [aria-checked="true"]').count(), 0);
    await p.click('#animo [data-animo="5"]');
    // ---- Una tarea que pasa a «Hechas» guarda cuándo; si vuelve a otra lista, se quita
    await p.fill("#tnew", "Para fechar"); await p.click("#taddbtn");
    const id = await p.evaluate(() => Object.entries(state.tasks).find(([, t]) => t.title === "Para fechar")[0]);
    await p.evaluate(i => { state.tasks[i].list = "hecha"; save(); render(); }, id);
    await esperar(p, i => window.AscensoLocal.api("GET", "estado").then(e => !!(e.tasks[i] && e.tasks[i].done) && Date.now() - new Date(e.tasks[i].done) < 60000), id, { que: "se apunta cuándo se terminó" });
    await p.evaluate(i => { state.tasks[i].list = "pendiente"; save(); render(); }, id);
    await esperar(p, i => window.AscensoLocal.api("GET", "estado").then(e => !!e.tasks[i] && e.tasks[i].done === null), id, { que: "y se quita al volver a pendientes" });
    // ---- Seis semanas de datos para las estadísticas
    await p.evaluate(() => {
      const h = state.habits.map(x => x.id);
      for (let i = 42; i >= 1; i--) { const d = addDays(today(), -i), k = key(d), A = i % 2 === 0, c = {};
        if (A) { c[h[0]] = true; c[h[1]] = true; } if (i % 3 === 0) c[h[2]] = true;
        state.days[k] = { c, a: A ? 5 : 2 };
        state.tasks["x" + i] = { date: k, title: "T" + i, notes: "", prio: "media", list: "hecha", tags: [], created: d.toISOString(), done: d.toISOString(), check: [], archived: null }; }
      save(); render(); });
    await p.click(".summit");
    // Resumen: el bloque del periodo y los descubrimientos
    assert.match(await p.locator("#pf-resumen .pf-tiles").innerText(), /hábitos cumplidos[\s\S]*tareas terminadas[\s\S]*ánimo medio/);
    assert.ok(await p.locator("#pf-resumen .pf-descubre li").count() >= 1, "hay descubrimientos en el resumen");
    // Cambiar de periodo se recuerda
    await p.click('[data-per="siempre"]');
    assert.equal(await p.evaluate(() => localStorage.getItem("ascenso-periodo")), "siempre");
    // Cuerpo: tocar una zona en la figura muestra su detalle
    await p.click('.pf-tabs [data-pf="cuerpo"]');
    await p.click('.pf-lista-zonas [data-zona="abdomen"]');
    assert.equal(await p.locator(".pf-detalle h3").innerText(), "Abdomen");
    assert.match(await p.locator(".pf-detalle").innerText(), /Dentro de mis calorías|Proteína/);
    await p.locator('#pf-pcuerpo .vitruvio [data-zona="cabeza"] ellipse').click({ force: true });
    assert.equal(await p.locator(".pf-detalle h3").innerText(), "Cabeza");
    // Hábitos y productividad
    await p.click('.pf-tabs [data-pf="habitos"]');
    assert.equal(await p.locator(".pf-cal i").count(), 53 * 7);
    assert.equal(await p.locator(".pf-habitos li").count(), await p.evaluate(() => state.habits.length));
    await p.click('.pf-tabs [data-pf="productividad"]');
    assert.ok(+(await p.locator("#pf-productividad .pf-tile b").first().innerText()) >= 42, "cuenta las tareas terminadas");
    // Descubrimientos: con su advertencia de que son coincidencias
    await p.click('.pf-tabs [data-pf="descubrir"]');
    assert.match(await p.locator("#pf-descubrir").innerText(), /coincidencias, no causas/);
    assert.ok(await p.locator("#pf-descubrir li").count() >= 2);
    // ---- Ajustes › Zonas del cuerpo: cambiar el reparto y volver al propuesto
    await p.click('.pf-tabs [data-pf="ajustes"]');
    const sueno = await p.evaluate(() => "h:" + state.habits.find(h => /dormir/i.test(h.t)).id);
    assert.equal(await p.locator(`[data-zref="${sueno}"]`).inputValue(), "cabeza", "reparto propuesto por el nombre");
    await p.selectOption(`[data-zref="${sueno}"]`, "pecho");
    await esperar(p, r => window.AscensoLocal.api("GET", "estado").then(e => e.perfil.zonas && e.perfil.zonas.pecho.includes(r) && !e.perfil.zonas.cabeza.includes(r)), sueno, { que: "el reparto se guarda" });
    await p.click('[data-zaccion="proponer"]');
    assert.equal(await p.evaluate(() => state.perfil.zonas), null);
    assert.deepEqual(errores, []);
  } finally { await nav.close(); await app.cerrar(); }
});

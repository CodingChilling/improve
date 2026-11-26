// Tableros en el móvil: pestañas de listas, una lista por pantalla, botón +, hoja de acciones y gestos.
import test from "node:test";
import assert from "node:assert/strict";
import { servirApp, chromium, devices, abrirConDatos, dedos, centro, esperar } from "./util.mjs";

const estado = p => p.evaluate(() => window.AscensoLocal.api("GET", "estado"));
const activa = p => p.evaluate(() => document.querySelector('.bd-tab[aria-selected="true"]')?.dataset.btab);
const desborde = p => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test("móvil: un tablero se ve por listas con pestañas y se gestiona con el dedo", async () => {
  const app = await servirApp(), nav = await chromium.launch();
  try {
    const { defaultBrowserType, ...perfil } = devices["Pixel 7"];
    const { pagina: p } = await abrirConDatos(nav, app, perfil);
    const errores = []; p.on("pageerror", e => errores.push(String(e)));
    const g = await dedos(p);
    await p.evaluate(() => { showBoards(); setBoard("b1"); }); await p.waitForTimeout(300);

    // ---- Pestañas con título y número de tarjetas; la primera, activa
    const tabs = await p.locator(".bd-tab[data-btab]:not(.bd-tab-mas)").allInnerTexts();
    assert.deepEqual(tabs.map(t => t.replace(/\s+/g, " ").trim()), ["Por hacer 3", "En proceso 1", "Hecho 1"]);
    assert.equal(await activa(p), "l1");
    assert.equal(await desborde(p), 0);
    // Una lista ocupa el ancho entero: solo se ve una
    const visibles = await p.evaluate(() => [...document.querySelectorAll(".bl")].filter(n => { const r = n.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1; }).length);
    assert.equal(visibles, 1, "se ve una lista cada vez");

    // ---- Tocar «Hecho» lleva a esa lista
    await p.tap('[data-btab="l3"]');
    await esperar(p, () => { const r = document.querySelector('.bl[data-list="l3"]').getBoundingClientRect(); return Math.abs(r.left - document.getElementById("bd-lists").getBoundingClientRect().left) < 3; }, null, { que: "la lista «Hecho» a la vista" });
    assert.equal(await activa(p), "l3");

    // ---- Deslizar las listas cambia la pestaña activa
    await p.evaluate(() => { const w = document.getElementById("bd-lists"); w.scrollLeft = document.querySelector('.bl[data-list="l2"]').offsetLeft - w.firstElementChild.offsetLeft; });
    await esperar(p, () => document.querySelector('.bd-tab[aria-selected="true"]')?.dataset.btab === "l2", null, { que: "la pestaña sigue al deslizar" });

    // ---- Un repintado no devuelve a la primera lista
    await p.evaluate(() => renderBoards()); await p.waitForTimeout(100);
    assert.equal(await activa(p), "l2");
    assert.ok(await p.evaluate(() => Math.abs(document.querySelector('.bl[data-list="l2"]').getBoundingClientRect().left - document.getElementById("bd-lists").getBoundingClientRect().left) < 3));

    // ---- El + flotante añade a la lista que se ve
    await p.tap("#bd-fab");
    assert.equal(await p.evaluate(() => document.activeElement.dataset.newcard), "l2");
    await p.keyboard.type("Desde el botón"); await p.keyboard.press("Enter");
    await esperar(p, () => window.AscensoLocal.api("GET", "estado").then(e => Object.values(e.cards).some(c => c.title === "Desde el botón" && c.list === "l2")), null, { que: "la tarjeta nueva en «En proceso»" });
    await p.evaluate(() => document.activeElement.blur());

    // ---- Mantener pulsada una tarjeta (sin moverla) abre su hoja de acciones
    await p.tap('[data-btab="l1"]'); await p.waitForTimeout(500);
    const c1 = await centro(p.locator('.bc[data-card="c1"]'));
    await g.arrastrar(c1, c1, { pulsacion: 500, pasos: 1 });
    await p.locator("#cacc[open]").waitFor();
    await p.locator("#cacc [data-aprio=baja]").tap();
    await esperar(p, () => window.AscensoLocal.api("GET", "estado").then(e => e.cards.c1.prio === "baja"), null, { que: "la prioridad cambia desde la hoja" });
    assert.ok(await p.locator("#cacc[open]").isVisible(), "y la hoja sigue abierta");
    await p.locator('#cacc [data-amover="l3"]').tap();
    await esperar(p, () => window.AscensoLocal.api("GET", "estado").then(e => e.cards.c1.list === "l3"), null, { que: "«Mover a… Hecho»" });
    assert.equal(await p.locator("#cacc[open]").count(), 0);
    assert.ok(await p.locator(".bd-aviso", { hasText: "Hecho" }).isVisible(), "avisa de adónde ha ido");
    await esperar(p, () => document.querySelector('.bd-tab[aria-selected="true"]')?.dataset.btab === "l3", null, { que: "la vista sigue a la tarjeta" });

    // ---- Deslizar una tarjeta a la derecha la pasa a la lista siguiente, y «Deshacer» la devuelve
    await p.tap('[data-btab="l1"]'); await p.waitForTimeout(500);
    const caja = await p.locator('.bc[data-card="c2"]').boundingBox();
    const y = caja.y + caja.height / 2;
    await g.arrastrar([caja.x + 20, y], [caja.x + caja.width * 0.85, y], { pulsacion: 30, pasos: 8 });
    await esperar(p, () => window.AscensoLocal.api("GET", "estado").then(e => e.cards.c2.list === "l2"), null, { que: "deslizar la pasa a «En proceso»" });
    await esperar(p, () => window.AscensoLocal.api("GET", "estado").then(e => e.cards.c2.order === 0), null, { que: "entra la primera de su nueva lista" });
    await p.locator(".bd-aviso button", { hasText: "Deshacer" }).tap();
    await esperar(p, () => window.AscensoLocal.api("GET", "estado").then(e => e.cards.c2.list === "l1"), null, { que: "«Deshacer» la devuelve" });
    // Un deslizamiento corto no mueve nada
    const caja2 = await p.locator('.bc[data-card="c2"]').boundingBox();
    await g.arrastrar([caja2.x + 20, y], [caja2.x + 70, y], { pulsacion: 30, pasos: 4 });
    await p.waitForTimeout(300);
    assert.equal((await estado(p)).cards.c2.list, "l1");

    // ---- Arrastrar una tarjeta y soltarla sobre una pestaña
    await g.arrastrar(await centro(p.locator('.bc[data-card="c2"]')), await centro(p.locator('[data-btab="l3"]')), { pulsacion: 450, pasos: 6 });
    await esperar(p, () => window.AscensoLocal.api("GET", "estado").then(e => e.cards.c2.list === "l3"), null, { que: "soltar en la pestaña «Hecho»" });

    // ---- La lupa abre el buscador
    assert.equal(await p.locator("#bv-q").isVisible(), false);
    await p.tap("#bv-lupa");
    assert.ok(await p.locator("#bv-q").isVisible());
    assert.equal(await p.evaluate(() => document.activeElement.id), "bv-q");
    await p.keyboard.press("Escape");
    assert.equal(await p.locator("#bv-q").isVisible(), false);

    // ---- Nada desborda en pantallas estrechas
    for (const ancho of [320, 360, 412]) {
      await p.setViewportSize({ width: ancho, height: 760 }); await p.waitForTimeout(150);
      assert.equal(await desborde(p), 0, `sin desborde a ${ancho} px`);
    }
    assert.deepEqual(errores, []);
  } finally { await nav.close(); await app.cerrar(); }
});

test("ordenador: el tablero sigue igual (sin pestañas ni botón flotante) y el clic derecho abre las acciones", async () => {
  const app = await servirApp(), nav = await chromium.launch();
  try {
    const { pagina: p } = await abrirConDatos(nav, app, { viewport: { width: 1280, height: 800 } });
    await p.evaluate(() => { showBoards(); setBoard("b1"); }); await p.waitForTimeout(300);
    assert.equal(await p.locator("#bd-tabs").isVisible(), false);
    assert.equal(await p.locator("#bd-fab").isVisible(), false);
    assert.ok(await p.locator("#bv-q").isVisible(), "el buscador sigue a la vista");
    assert.ok(await p.locator('.bl[data-list="l3"]').isVisible(), "se ven todas las listas");
    await p.locator('.bc[data-card="c3"]').click({ button: "right" });
    await p.locator("#cacc[open]").waitFor();
    assert.equal(await p.locator("#cacc [data-apos]").count(), 0, "sin botones de puesto en la lista");
    await p.locator('#cacc [data-amover="l2"]').click();
    await esperar(p, () => window.AscensoLocal.api("GET", "estado").then(e => e.cards.c3.list === "l2"), null, { que: "«Mover a… En proceso»" });
  } finally { await nav.close(); await app.cerrar(); }
});

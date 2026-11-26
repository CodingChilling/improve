// Accesos rápidos a nodos de los mapas: marcar, saltar (también entre mapas), quitar, y cabecera del mapa en el móvil.
import test from "node:test";
import assert from "node:assert/strict";
import { servirApp, chromium, devices, abrirConDatos, esperar } from "./util.mjs";

const accesosGuardados = p => p.evaluate(() => window.AscensoLocal.api("GET", "estado").then(e => (e.perfil && e.perfil.accesos) || []));

test("accesos rápidos: se marcan desde la libreta, llevan al nodo (también de otro mapa) y se quitan con «Deshacer»", async () => {
  const app = await servirApp(), nav = await chromium.launch();
  try {
    const { pagina: p } = await abrirConDatos(nav, app, { viewport: { width: 1280, height: 860 } });
    const errores = []; p.on("pageerror", e => errores.push(String(e)));
    // Un segundo mapa con un nodo, para saltar entre mapas
    const [m1, n1, m2, n2] = await p.evaluate(() => {
      const m1 = Object.keys(state.maps)[0], n1 = Object.keys(state.mnodes).find(id => state.mnodes[id].map === m1);
      state.maps.mz = { ...state.maps[m1], title: "Otro mapa", order: 9, fav: false };
      state.mnodes.nz = { ...state.mnodes[n1], map: "mz", parent: null, title: "Nodo lejano", notes: "" };
      save(); showBoards(); setMap(m1); return [m1, n1, "mz", "nz"];
    });
    await p.waitForTimeout(400);
    assert.equal(await p.locator(".mv-accesos").count(), 0, "sin accesos no hay fila");

    // Marcar el nodo lejano desde su libreta
    await p.evaluate(() => { setMap("mz"); selectOnly("nz"); selectionChanged(); }); await p.waitForTimeout(200);
    await p.click("[data-macceso]");
    assert.equal(await p.getAttribute("[data-macceso]", "aria-pressed"), "true");
    await esperar(p, () => window.AscensoLocal.api("GET", "estado").then(e => (e.perfil.accesos || []).includes("nz")), null, { que: "el acceso se guarda en el perfil" });
    // Y uno del primer mapa
    await p.evaluate(m => setMap(m), m1); await p.evaluate(n => { selectOnly(n); selectionChanged(); }, n1); await p.waitForTimeout(200);
    await p.click("[data-macceso]");
    await esperar(p, () => window.AscensoLocal.api("GET", "estado").then(e => (e.perfil.accesos || []).length === 2), null, { que: "dos accesos" });
    assert.deepEqual(await p.locator(".mv-acceso .mv-acceso-t").allInnerTexts(), [await p.evaluate(() => state.mnodes.nz.title), await p.evaluate(n => state.mnodes[n].title, n1)]);
    assert.equal(await p.locator('.mv-acceso[data-irnodo="nz"] small').innerText(), "Otro mapa", "los de otro mapa dicen de cuál son");

    // Saltar al nodo de otro mapa desde la fila
    await p.evaluate(() => { clearSel(); selectionChanged(); });
    await p.click('.mv-acceso[data-irnodo="nz"]'); await p.waitForTimeout(300);
    assert.deepEqual(await p.evaluate(() => [curMapId(), mSel]), [m2, n2]);
    assert.ok(await p.locator('.mv-acceso[data-irnodo="nz"].on').count(), "el acceso del nodo abierto se resalta");
    assert.equal(await p.inputValue("#mn-title"), "Nodo lejano");

    // Y desde el menú de tableros y mapas
    await p.click("#bv-current");
    await p.locator(`#bv-menu [data-goacceso="${n1}"]`).click(); await p.waitForTimeout(300);
    assert.deepEqual(await p.evaluate(() => [curMapId(), mSel]), [m1, n1]);

    // Quitar con clic derecho, y «Deshacer»
    await p.click('.mv-acceso[data-irnodo="nz"]', { button: "right" });
    await esperar(p, () => window.AscensoLocal.api("GET", "estado").then(e => !(e.perfil.accesos || []).includes("nz")), null, { que: "clic derecho lo quita" });
    await p.locator(".mv-toast button", { hasText: "Deshacer" }).click();
    await esperar(p, () => window.AscensoLocal.api("GET", "estado").then(e => (e.perfil.accesos || []).includes("nz")), null, { que: "«Deshacer» lo devuelve" });

    // Un nodo borrado deja de salir
    await p.evaluate(() => { delete state.mnodes.nz; save(); renderBoards(); }); await p.waitForTimeout(200);
    assert.equal(await p.locator('.mv-acceso[data-irnodo="nz"]').count(), 0);
    assert.deepEqual(errores, []);
  } finally { await nav.close(); await app.cerrar(); }
});

test("móvil: colores, ★, ⋯ y ? del mapa en una sola línea", async () => {
  const app = await servirApp(), nav = await chromium.launch();
  try {
    const { defaultBrowserType, ...perfil } = devices["Pixel 7"];
    for (const ancho of [320, 360, 412]) {
      const { pagina: p } = await abrirConDatos(nav, app, { ...perfil, viewport: { width: ancho, height: 820 } });
      await p.evaluate(() => { showBoards(); setMap(Object.keys(state.maps)[0]); }); await p.waitForTimeout(300);
      const cajas = await p.evaluate(() => [...document.querySelectorAll(".mv-head .mv-acc, .mv-head .bfav, .mv-head .bd-more, .mv-head .mv-help-btn")].map(e => { const r = e.getBoundingClientRect(); return [r.top + r.height / 2, r.right]; }));
      const centros = cajas.map(c => c[0]);
      assert.ok(Math.max(...centros) - Math.min(...centros) < 8, `en una línea a ${ancho} px: ${centros}`);
      assert.ok(Math.max(...cajas.map(c => c[1])) <= ancho, "dentro de la pantalla");
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
      await p.close();
    }
  } finally { await nav.close(); await app.cerrar(); }
});

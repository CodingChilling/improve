// La app en el móvil (iPhone y Android emulados): nada se sale de la pantalla y se puede arrastrar con el dedo.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { servirApp, chromium, devices, abrirConDatos, apiLocal, dedos, centro, esperar, RAIZ } from "./util.mjs";

const CAPTURAS = path.join(RAIZ, "pruebas", "resultados");
fs.mkdirSync(CAPTURAS, { recursive: true });
const desborde = p => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const [nombre, dispositivo] of [["iphone", "iPhone 13"], ["android", "Pixel 7"]]) {
  test(`${nombre}: pantallas estrechas y arrastre con el dedo`, async () => {
    const app = await servirApp(), nav = await chromium.launch();
    try {
      // (El motor es Chromium en los dos casos; de iPhone se emulan el tamaño, la densidad y el modo táctil.)
      const { defaultBrowserType, ...perfil } = devices[dispositivo];
      const { pagina } = await abrirConDatos(nav, app, perfil);
      const errores = []; pagina.on("pageerror", e => errores.push(String(e)));
      const gesto = await dedos(pagina);
      const foto = n => pagina.screenshot({ path: path.join(CAPTURAS, `${nombre}-${n}.png`) });
      await pagina.waitForTimeout(500);

      // ---- El día: nada se sale por los lados
      assert.equal(await desborde(pagina), 0, "la página del día no debe desbordar a lo ancho");
      await foto("1-dia");

      // ---- Tareas: mantener pulsada una tarea y llevarla a la pestaña «Hechas»
      const tarea = pagina.locator("#board .task", { hasText: "Preparar la mochila" });
      await tarea.scrollIntoViewIfNeeded(); await pagina.evaluate(() => window.scrollBy(0, 120)); await pagina.waitForTimeout(200);
      await foto("2-tareas");
      await gesto.arrastrar(await centro(tarea), await centro(pagina.locator("#ttabs [role=tab]", { hasText: "Hechas" })));
      await esperar(pagina, () => window.AscensoLocal.api("GET", "estado").then(e => e.tasks.t2.list === "hecha"), null, { que: "la tarea pasa a «Hechas»" });

      // ---- Calendario
      await pagina.evaluate(() => window.scrollTo(0, 0));
      await pagina.tap("#hdate"); await pagina.waitForTimeout(300);
      const cal = await pagina.locator("#calpop").boundingBox();
      assert.ok(cal.x >= 0 && cal.x + cal.width <= perfil.viewport.width + 1, "el calendario cabe en la pantalla");
      await foto("3-calendario");
      await pagina.keyboard.press("Escape");

      // ---- Tableros: llevar una tarjeta de «Por hacer» a «En proceso»
      await pagina.tap("#brand"); await pagina.tap('.bcard[data-board="b1"]'); await pagina.waitForTimeout(300);
      assert.equal(await desborde(pagina), 0, "el tablero no debe desbordar la página (las listas se desplazan dentro)");
      await foto("4-tablero");
      const destino = await pagina.locator('.bl[data-list="l2"]').boundingBox();
      await gesto.arrastrar(await centro(pagina.locator('.bc[data-card="c2"]')), [Math.min(destino.x + 30, perfil.viewport.width - 12), destino.y + 90]);
      await esperar(pagina, () => window.AscensoLocal.api("GET", "estado").then(e => e.cards.c2.list === "l2"), null, { que: "la tarjeta pasa a «En proceso»" });
      // La ficha de una tarjeta
      await pagina.locator('.bc[data-card="c1"]').tap(); await pagina.waitForTimeout(400);
      await foto("5-tarjeta");
      await pagina.keyboard.press("Escape"); await pagina.waitForTimeout(200);

      // ---- Mapas: mover un nodo con un dedo y acercar con dos
      await pagina.tap("#bv-current"); await pagina.locator("#bv-menu").getByText("Estoicismo").tap(); await pagina.waitForTimeout(600);
      assert.equal(await desborde(pagina), 0, "el mapa no debe desbordar la página");
      await foto("6-mapa");
      const lienzo = await pagina.locator("#mv-graph canvas").boundingBox();
      const enPantalla = id => pagina.evaluate(i => { const n = state.mnodes[i], c = cam(); return [n.x * c.z + c.ox, n.y * c.z + c.oy]; }, id);
      const antes = (await apiLocal(pagina, "GET", "estado")).mnodes.n2;
      const [nx, ny] = await enPantalla("n2");
      await gesto.arrastrar([lienzo.x + nx, lienzo.y + ny], [lienzo.x + nx - 70, lienzo.y + ny + 40], { pulsacion: 60 });
      await esperar(pagina, x0 => window.AscensoLocal.api("GET", "estado").then(e => e.mnodes.n2.x < x0 - 30), antes.x, { que: "el nodo se mueve" });
      const zoom = () => pagina.evaluate(() => cam().z);
      const z0 = await zoom();
      await gesto.pellizcar([lienzo.x + lienzo.width / 2, lienzo.y + lienzo.height * 0.2], 60, 200);
      assert.ok(await zoom() > z0 * 1.5, "separar dos dedos acerca el mapa");
      await gesto.pellizcar([lienzo.x + lienzo.width / 2, lienzo.y + lienzo.height * 0.2], 200, 60);
      assert.ok(Math.abs(await zoom() - z0) < z0 * 0.2, "juntarlos lo aleja otra vez");
      assert.deepEqual(errores, []);
    } finally { await nav.close(); await app.cerrar(); }
  });
}

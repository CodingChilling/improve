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

// La barra de abajo, el «atrás» del teléfono y los tamaños para el dedo
test("móvil: barra de navegación, botón atrás y tamaños táctiles", async () => {
  const app = await servirApp(), nav = await chromium.launch();
  try {
    const { defaultBrowserType, ...perfil } = devices["iPhone 13"];
    const { pagina } = await abrirConDatos(nav, app, perfil);
    const errores = []; pagina.on("pageerror", e => errores.push(String(e)));
    const actual = () => pagina.locator("#barra [aria-current=page]").getAttribute("data-ir");
    const ir = k => pagina.tap(`#barra [data-ir="${k}"]`);
    const visible = sel => pagina.locator(sel).isVisible();
    const atras = async () => { await pagina.goBack(); await pagina.waitForTimeout(250); };
    // Campos de texto con letra menor de 16 px (iPhone ampliaría la página) y botones demasiado pequeños
    const revisar = () => pagina.evaluate(() => {
      const ve = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest("[hidden]"); };
      const nombre = e => e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + (e.className ? "." + String(e.className).split(" ")[0] : "");
      const letra = [...document.querySelectorAll("input:not([type=checkbox],[type=radio],[type=color],[type=file]),select,textarea")]
        .filter(e => ve(e) && parseFloat(getComputedStyle(e).fontSize) < 16).map(nombre);
      const chicos = [...document.querySelectorAll("button,select,summary")].filter(ve)
        .filter(e => { const r = e.getBoundingClientRect(); return r.height < 35.5 || r.width < 30; }).map(nombre);
      return { letra: [...new Set(letra)], chicos: [...new Set(chicos)] };
    });

    // ---- La barra lleva a cada sección y marca dónde se está
    assert.ok(await visible("#barra"), "en el móvil hay barra de navegación");
    assert.equal(await actual(), "hoy");
    await ir("tareas");
    await esperar(pagina, () => Math.abs(document.querySelector("section.tasks").getBoundingClientRect().top) < 40, null, { que: "la pantalla baja hasta las tareas" });
    assert.equal(await actual(), "tareas");
    await ir("progreso");
    await esperar(pagina, () => document.getElementById("h-prog").getBoundingClientRect().top < 200, null, { que: "la pantalla baja hasta el progreso" });
    assert.equal(await actual(), "progreso");
    await ir("hoy");
    await esperar(pagina, () => scrollY === 0, null, { que: "la pantalla vuelve arriba" });

    // ---- Al escribir, la barra se aparta
    await pagina.tap("#tnew");
    assert.ok(await pagina.evaluate(() => document.body.classList.contains("con-teclado")), "con el teclado, la barra se esconde");
    await pagina.evaluate(() => document.activeElement.blur()); await pagina.waitForTimeout(50);
    assert.ok(!(await pagina.evaluate(() => document.body.classList.contains("con-teclado"))));

    // ---- Tamaños en la página del día (con la configuración abierta)
    await pagina.evaluate(() => { for (const d of document.querySelectorAll("details.cfg")) d.open = true; });
    assert.deepEqual(await revisar(), { letra: [], chicos: [] }, "día: campos de 16 px y botones para el dedo");
    assert.equal(await desborde(pagina), 0, "con la configuración abierta nada se sale a lo ancho");

    // ---- «Atrás» cierra lo último abierto, paso a paso, en vez de salir de la aplicación
    await ir("tableros");
    assert.ok(await visible("#boardsview")); assert.equal(await actual(), "tableros");
    await pagina.tap('.bcard[data-board="b1"]'); await pagina.waitForTimeout(200);
    await pagina.locator('.bc[data-card="c1"]').tap(); await pagina.locator("#carddlg[open]").waitFor();
    assert.deepEqual(await revisar(), { letra: [], chicos: [] }, "ficha de tarjeta: campos de 16 px y botones para el dedo");
    await atras();
    assert.ok(!(await visible("#carddlg")), "atrás cierra la ficha");
    assert.ok(await visible('.bl[data-list="l1"]'), "y sigue en el tablero");
    await atras();
    assert.ok(await visible('.bcard[data-board="b1"]'), "atrás vuelve a la portada de tableros");
    await atras();
    assert.ok(await visible("main") && !(await visible("#boardsview")), "atrás vuelve al día");
    assert.equal(await actual(), "hoy");
    // Cerrar con el botón no deja pasos sueltos en el historial
    await pagina.tap("#hdate"); await pagina.waitForTimeout(150);
    await pagina.keyboard.press("Escape"); await pagina.waitForTimeout(250);
    await ir("tableros"); await atras();
    assert.ok(await visible("main"), "un solo «atrás» basta tras haber abierto y cerrado el calendario");

    // ---- La cuenta se abre desde la barra
    await ir("cuenta"); await pagina.locator("#cuentadlg[open]").waitFor();
    await atras();
    assert.ok(!(await visible("#cuentadlg")), "atrás cierra el panel de la cuenta");
    assert.deepEqual(errores, []);

    // ---- En pantallas anchas no hay barra
    const ancha = await (await nav.newContext({ viewport: { width: 1200, height: 800 } })).newPage();
    await ancha.goto(app.url); await ancha.waitForSelector("#brand");
    assert.ok(!(await ancha.locator("#barra").isVisible()), "en el ordenador no hay barra");
  } finally { await nav.close(); await app.cerrar(); }
});

// La página de Hoy: dos columnas en pantallas anchas, cabecera sin solapes en el móvil, nueva tarea en una línea
// (prioridad, lista y etiquetas al escribir, recordadas) y «Ver tu progreso» que lleva a Perfil › Progreso.
import test from "node:test";
import assert from "node:assert/strict";
import { servirApp, chromium, abrirConDatos, esperar } from "./util.mjs";

const caja = (p, s) => p.locator(s).first().boundingBox();
const solapan = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test("Hoy: dos columnas en el ordenador y racha sin solapes en el móvil", async () => {
  const app = await servirApp(), nav = await chromium.launch();
  try {
    const { pagina: p } = await abrirConDatos(nav, app, { viewport: { width: 1440, height: 900 } });
    const habitos = await caja(p, "#checks"), tareas = await caja(p, ".tasks"), semana = await caja(p, ".sec-semana");
    assert.ok(tareas.x > habitos.x + habitos.width, "las tareas van a la derecha de los hábitos");
    assert.ok(tareas.y < habitos.y + habitos.height, "y a su altura, no debajo");
    assert.ok(semana.x < tareas.x);
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
    assert.equal(await p.locator("#imgstatus").count(), 0, "el recuento de imágenes ya no sale en el pie");
    assert.equal(await p.locator("#hist").count(), 0, "el progreso por semanas está en el perfil");
    await p.close();
    for (const ancho of [320, 360, 412]) {
      const { pagina: m } = await abrirConDatos(nav, app, { viewport: { width: ancho, height: 800 }, hasTouch: true, isMobile: true });
      await m.evaluate(() => { document.getElementById("streakN").textContent = "128"; });
      const n = await caja(m, "#streakN"), l = await caja(m, "#streakL");
      assert.ok(!solapan(n, l), `a ${ancho} px el número de la racha no pisa el texto`);
      assert.equal(await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, `nada desborda a ${ancho} px`);
      await m.close();
    }
  } finally { await nav.close(); await app.cerrar(); }
});

test("Hoy: nueva tarea en una línea, con prioridad y lista que se recuerdan; y el enlace al progreso", async () => {
  const app = await servirApp(), nav = await chromium.launch();
  try {
    const { pagina: p } = await abrirConDatos(nav, app, { viewport: { width: 1280, height: 860 } });
    const errores = []; p.on("pageerror", e => errores.push(String(e)));
    assert.ok(await p.locator("#tadd-opc").isHidden(), "las opciones no se ven hasta escribir");
    await p.click("#tnew");
    assert.ok(await p.locator("#tadd-opc").isVisible());
    await p.click('[data-tprio="alta"]'); await p.click('[data-tlist="proceso"]');
    assert.equal(await p.evaluate(() => document.activeElement.id), "tnew", "elegir no quita el foco del campo");
    await p.keyboard.type("Llamar al banco"); await p.keyboard.press("Enter");
    await esperar(p, () => Object.values(state.tasks).some(t => t.title === "Llamar al banco" && t.prio === "alta" && t.list === "proceso"), null, { que: "la tarea con su prioridad y lista" });
    await p.reload(); await p.waitForFunction(() => typeof state === "object" && document.getElementById("status").textContent);
    assert.equal(await p.inputValue("#tprio"), "alta", "se recuerda la prioridad");
    assert.equal(await p.inputValue("#tlist"), "proceso", "y la lista");
    await p.click("#ver-progreso");
    await p.locator("#perfil:not([hidden])").waitFor();
    assert.equal(await p.locator('.pf-tabs [aria-selected="true"]').getAttribute("data-pf"), "progreso");
    assert.deepEqual(errores, []);
  } finally { await nav.close(); await app.cerrar(); }
});

test("Hoy más despejado: sin leyenda ni ayudas, y las etiquetas se gestionan en Perfil › Ajustes", async () => {
  const app = await servirApp(), nav = await chromium.launch();
  try {
    const { pagina: p } = await abrirConDatos(nav, app, { viewport: { width: 1440, height: 900 } });
    const errores = []; p.on("pageerror", e => errores.push(String(e)));
    assert.equal(await p.locator("main #legend, main .drag-hint").count(), 0, "sin leyenda ni ayuda de arrastrar");
    assert.equal(await p.locator("main").getByText("Toca un día para verlo").count(), 0);
    assert.equal(await p.locator("main #tagmgrbox").count(), 0, "el gestor de etiquetas ya no está en Hoy");
    assert.match(await p.locator("#week .day").first().getAttribute("title"), /\S/, "cada día dice su entreno al pasar el ratón");
    // Desde la nueva tarea: «Gestionar…» lleva a Ajustes, con el gestor abierto
    await p.click("#tnew"); await p.keyboard.type("Algo");
    await p.locator("#tnewtags [data-gestionar-etiquetas]").click();
    await p.locator("#pf-ajustes #tagmgrbox[open]").waitFor();
    await esperar(p, () => document.activeElement && document.activeElement.id === "tagname", null, { que: "el foco en el nombre de la etiqueta nueva" });
    await p.keyboard.type("Lectura"); await p.keyboard.press("Enter");
    await esperar(p, () => window.AscensoLocal.api("GET", "estado").then(e => Object.values(e.tags).some(t => t.name === "Lectura")), null, { que: "la etiqueta se crea desde Ajustes" });
    // Y desde la ficha de una tarea
    await p.evaluate(() => window.AscensoPerfil.cerrar()); await p.waitForTimeout(200);
    await p.locator("#board .task").first().click(); await p.locator("#taskdlg[open]").waitFor();
    await p.locator("#taskdlg [data-gestionar-etiquetas]").click();
    await p.locator("#pf-ajustes #tagmgrbox[open]").waitFor();
    assert.equal(await p.locator("#taskdlg[open]").count(), 0, "la ficha se cierra");
    assert.deepEqual(errores, []);
  } finally { await nav.close(); await app.cerrar(); }
});

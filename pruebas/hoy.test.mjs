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

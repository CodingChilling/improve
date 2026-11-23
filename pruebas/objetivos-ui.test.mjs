// Objetivos desde la interfaz: crear, ver el progreso y el cuadrado de la figura, archivar y eliminar.
import test from "node:test";
import assert from "node:assert/strict";
import { servirApp, chromium, abrirConDatos, apiLocal, esperar } from "./util.mjs";

test("objetivos: crear, progreso, cuadrado de la figura, archivar y eliminar", async () => {
  const app = await servirApp(), nav = await chromium.launch();
  try {
    const { pagina: p } = await abrirConDatos(nav, app, { viewport: { width: 390, height: 844 } });
    const errores = []; p.on("pageerror", e => errores.push(String(e)));
    await p.evaluate(() => window.AscensoPerfil.abrir("resumen"));
    // Sin objetivos: el resumen invita a crear uno y la figura no dibuja el cuadrado
    assert.equal(await p.locator(".pf-figura .vf-obj").count(), 0);
    await p.click('.pf-objs-res [data-pf="objetivos"]');
    await p.locator("#pf-obj-form").waitFor();
    assert.ok(await p.locator("#pf-periodos").isHidden(), "los objetivos no dependen del periodo");
    // Un objetivo de tareas: 3 hasta fin de mes
    await p.click('[data-otipo="tareas"]');
    await p.fill("#pf-obj-meta", "0"); await p.click('#pf-obj-form [type=submit]');
    assert.match(await p.locator("#pf-obj-error").innerText(), /entre 1 y/);
    await p.fill("#pf-obj-meta", "3"); await p.click('[data-ohasta="año"]');
    await p.click('#pf-obj-form [type=submit]');
    await p.locator("#pf-objetivos .pf-obj").first().waitFor();
    assert.match(await p.locator("#pf-objetivos .pf-obj strong").first().innerText(), /3 tareas terminadas/);
    const n0 = await p.evaluate(() => Object.values(state.tasks).filter(t => t.list === "hecha" && t.done && key(new Date(t.done)) === key(today())).length);
    assert.equal(await p.locator("#pf-objetivos .pf-obj-cifra").first().innerText(), `${n0} de 3 tareas · faltan ${3 - n0}`);
    const guardado = await esperar(p, () => Object.values(state.objetivos)[0], null, { que: "el objetivo en el estado" });
    assert.equal(guardado.tipo, "tareas"); assert.equal(guardado.meta, 3);
    assert.equal(guardado.hasta, await p.evaluate(() => new Date().getFullYear() + "-12-31"));
    // Se guarda en el almacén local
    await esperar(p, async () => Object.keys((await window.AscensoLocal.api("GET", "estado")).objetivos || {}).length === 1, null, { que: "objetivo guardado" });
    // Terminar una tarea hoy hace avanzar el objetivo
    await p.evaluate(() => { state.tasks[newId("t")] = { date: key(today()), title: "Hecha", notes: "", prio: "media", list: "hecha", tags: [], created: new Date().toISOString(), check: [], archived: null, done: new Date().toISOString() }; save(); });
    await p.click('.pf-tabs [data-pf="resumen"]'); await p.click('.pf-tabs [data-pf="objetivos"]');
    assert.equal(await p.locator("#pf-objetivos .pf-obj-cifra").first().innerText(), `${n0 + 1} de 3 tareas · faltan ${2 - n0}`);
    // El cuadrado de la figura: lo que lleva del objetivo
    await p.click('.pf-tabs [data-pf="resumen"]');
    assert.equal(await p.locator(".pf-figura .vf-obj").getAttribute("stroke-dasharray"), ((n0 + 1) / 3).toFixed(4) + " 1");
    assert.equal(await p.locator(".pf-objs-res .pf-obj").count(), 1);
    // Un objetivo de hábito con título propio
    await p.click('.pf-tabs [data-pf="objetivos"]');
    await p.click("#pf-obj-nuevo summary");
    await p.locator("#pf-obj-nuevo[open]").waitFor();
    await p.click('[data-otipo="habito"]');
    assert.equal(await p.locator("#pf-obj-ref option").count(), await p.evaluate(() => state.habits.length));
    await p.fill("#pf-obj-meta", "150"); await p.click('#pf-obj-form [type=submit]');
    assert.match(await p.locator("#pf-obj-error").innerText(), /entre 1 y 100/);
    await p.fill("#pf-obj-meta", "70"); await p.fill("#pf-obj-titulo", "Constancia <b>");
    await p.click('#pf-obj-form [type=submit]');
    await esperar(p, () => document.querySelectorAll("#pf-objetivos .pf-obj").length === 2);
    assert.ok(await p.locator("#pf-objetivos .pf-obj strong", { hasText: "Constancia <b>" }).count(), "el título se escapa");
    // Archivar y recuperar; eliminar con dos toques
    const id = await p.evaluate(() => Object.keys(state.objetivos).find(k => state.objetivos[k].tipo === "habito"));
    await p.click(`[data-oarch="${id}"]`);
    assert.equal(await p.evaluate(i => state.objetivos[i].archivado, id), true);
    assert.match(await p.locator(".pf-obj-arch summary").innerText(), /Archivados \(1\)/);
    await p.click(".pf-obj-arch summary"); await p.click(`[data-odel="${id}"]`);
    assert.ok(await p.evaluate(i => !!state.objetivos[i], id), "el primer toque solo avisa");
    await p.click(`[data-odel="${id}"]`);
    assert.ok(await p.evaluate(i => !state.objetivos[i], id));
    assert.deepEqual(errores, []);
  } finally { await nav.close(); await app.cerrar(); }
});

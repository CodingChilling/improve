// Tipos de entreno: se pueden añadir más de cuatro, y cambiar el de un día afecta a ese día y a los mismos días de
// las semanas siguientes, nunca a semanas pasadas. Un cambio en una semana pasada solo toca ese día.
import test from "node:test";
import assert from "node:assert/strict";
import { servirApp, chromium, abrirConDatos, paginaLista, esperar } from "./util.mjs";

test("tipos de entreno: más tipos, cambios hacia delante y semanas pasadas intactas", async () => {
  const app = await servirApp(), nav = await chromium.launch();
  try {
    const { pagina: p } = await abrirConDatos(nav, app, { viewport: { width: 1100, height: 900 } });
    const errores = []; p.on("pageerror", e => errores.push(String(e)));
    // Lunes relativos a la semana actual: L(0) es el de esta semana, L(-1) el de la pasada, L(1) el de la siguiente…
    const tipo = sem => p.evaluate(s => typeFor(addDays(monday(today()), s * 7)), sem);
    const lunes = async sem => { await p.evaluate(s => { sel = addDays(monday(today()), s * 7); render(); }, sem); };
    const elegir = async (sem, nombre) => { await lunes(sem); await p.locator("#plan").getByRole("button", { name: nombre, exact: true }).click(); };
    const tipos = async (...sems) => { const o = []; for (const s of sems) o.push(await tipo(s)); return o; };
    const guardado = () => esperar(p, () => window.AscensoLocal.api("GET", "estado").then(e => JSON.stringify([e.plan, e.planes, e.tipos]) === JSON.stringify([state.plan, state.planes, state.tipos])
      && Object.entries(state.days).every(([k, x]) => ((e.days[k] || {}).type || null) === (x.type || null))), null, { que: "se guarda" });

    // ---- El ejemplo: L1 (semana pasada) = x, L2 (esta) = y, L3 = z, L4 = x
    const base = await tipo(-1);                                         // x: lo que diga el plan de siempre
    assert.equal(base, "climb");
    await elegir(0, "Fuerza");                                           // y
    await elegir(1, "Descanso");                                         // z
    await elegir(2, "Escalada");                                         // x
    assert.deepEqual(await tipos(-1, 0, 1, 2), ["climb", "strength", "rest", "climb"]);
    // Cambiar L2 a z: cambian L2 y todos los lunes siguientes (L4 también), no L1
    await elegir(0, "Descanso");
    assert.deepEqual(await tipos(-1, 0, 1, 2, 10), ["climb", "rest", "rest", "rest", "rest"]);
    // Los demás días de la semana no se tocan
    assert.equal(await p.evaluate(() => typeFor(addDays(monday(today()), 1))), "strength", "el martes sigue como estaba");

    // ---- Un día de una semana pasada: solo ese día
    await elegir(-1, "Descanso activo");
    assert.deepEqual(await tipos(-2, -1, 0, 1), ["climb", "active", "rest", "rest"]);
    // Y el plan de las semanas pasadas no cambia por lo que se haga desde esta semana
    await elegir(1, "Fuerza");
    assert.deepEqual(await tipos(-3, -2, -1, 0, 1, 2), ["climb", "climb", "active", "rest", "strength", "strength"]);

    // ---- Más tipos: añadir «Yoga» con su color
    await p.evaluate(() => { document.getElementById("typecfgbox").open = true; });
    await p.click("#typeadd");
    await p.locator("#typecfg [data-tipo]").last().fill("Yoga");
    await p.locator("#typecfg [data-tc-color]").last().evaluate(i => { i.value = "#16a085"; i.dispatchEvent(new Event("input", { bubbles: true })); });
    assert.equal(await p.locator("#plan button").count(), 5, "el día ofrece cinco tipos");
    await elegir(2, "Yoga");
    const yoga = await tipo(2);
    assert.match(yoga, /^k/);
    assert.match(await p.locator("#legend").innerText(), /Yoga/);
    assert.equal(await p.locator("#week .day").first().locator(".hold").evaluate(e => getComputedStyle(e).backgroundColor), "rgb(22, 160, 133)", "su color se ve en la semana");
    // Un día de una semana pasada también puede ser de Yoga
    await elegir(-2, "Yoga");
    assert.deepEqual(await tipos(-3, -2, -1, 0, 1, 2, 3), ["climb", yoga, "active", "rest", "strength", yoga, yoga]);
    await guardado();

    // ---- Se queda guardado al recargar
    await p.reload(); await paginaLista(p);
    assert.deepEqual(await tipos(-3, -2, -1, 0, 1, 2, 3), ["climb", yoga, "active", "rest", "strength", yoga, yoga]);

    // ---- Quitar Yoga: desde esta semana pasa al sustituto; la semana pasada lo conserva (queda archivado)
    await p.evaluate(() => { document.getElementById("typecfgbox").open = true; });
    const fila = p.locator(".tc-tipo", { has: p.locator('[data-tipo="' + yoga + '"]') });
    await fila.locator("[data-tc-del]").click();
    await fila.locator("[data-sustituto]").selectOption("rest");
    await fila.locator("[data-tc-si]").click();
    assert.deepEqual(await tipos(-3, -2, -1, 0, 1, 2, 3), ["climb", yoga, "active", "rest", "strength", "rest", "rest"]);
    assert.equal(await p.locator("#typecfg [data-tipo]").count(), 4, "ya no se puede configurar");
    await lunes(0);
    assert.equal(await p.locator("#plan button").count(), 4, "ni elegir");
    await lunes(-2);
    assert.equal(await p.locator('#plan button[aria-pressed="true"]').innerText(), "Yoga", "pero el día pasado lo sigue mostrando");
    assert.match(await p.locator("#legend").innerText(), /Yoga/);
    // Un tipo que nadie usa se quita del todo
    await p.click("#typeadd");
    const nuevo = await p.locator("#typecfg [data-tipo]").last().getAttribute("data-tipo");
    await p.locator('[data-tc-del="' + nuevo + '"]').click();
    assert.match(await p.locator(".tc-quitar").innerText(), /Ningún día lo usa/);
    await p.locator("[data-tc-si]").click();
    assert.ok(!(await p.evaluate(id => state.tipos.some(t => t.id === id), nuevo)), "se borra, no se archiva");
    await guardado();
    assert.deepEqual(errores, []);
  } finally { await nav.close(); await app.cerrar(); }
});

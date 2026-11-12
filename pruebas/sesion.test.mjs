// La sesión se queda guardada en el dispositivo: sigue ahí al volver a abrir Ascenso y no se pierde por tenerlo
// abierto en varias ventanas a la vez (la aplicación instalada y una pestaña, por ejemplo), ni por un fallo pasajero.
import test from "node:test";
import assert from "node:assert/strict";
import { chromium, apiLocal, paginaLista, esperar, servirAppConCuenta, crearCuenta, entrarPorPrimeraVez, cerrarPanel, alDia } from "./util.mjs";
import { simuladorSupabase } from "./simulador-supabase.mjs";

const EMAIL = "sesion@ejemplo.com", CLAVE = "otra contraseña bien larga";
const hoy = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const tarea = t => ({ date: hoy(), title: t, prio: "media", list: "pendiente", tags: [] });
const informe = p => p.evaluate(() => window.AscensoSync.informe());
const enCuenta = sim => sim.bd.cambios.length;

test("la sesión se recuerda y sobrevive a varias ventanas, a pestañas dormidas y a fallos pasajeros", async () => {
  const sim = await simuladorSupabase(), app = await servirAppConCuenta(sim), nav = await chromium.launch();
  try {
    const ctx = await nav.newContext(), A = await ctx.newPage();
    await A.goto(app.url); await paginaLista(A);
    await crearCuenta(A, sim, EMAIL, CLAVE); await entrarPorPrimeraVez(A, EMAIL, CLAVE); await alDia(A); await cerrarPanel(A);

    // ---- Cerrar y volver a abrir (varias veces, con la sesión ya caducada): sigue dentro, sin pedir la contraseña
    for (let i = 0; i < 3; i++) {
      sim.caducarSesiones();
      await A.reload(); await paginaLista(A); await alDia(A);
      assert.equal((await informe(A)).email, EMAIL, "vuelta " + (i + 1) + ": la sesión sigue ahí");
    }
    assert.equal(await A.locator("#cuentadlg[open]").count(), 0, "no se pide iniciar sesión");

    // ---- Otra ventana renovó la sesión y esta no se enteró (estaba dormida): usa la sesión guardada, no su testigo gastado
    await A.evaluate(async url => {
      const leer = () => window.AscensoAlmacen.meta("cuenta"), c = await leer();
      const r = await fetch(url + "/auth/v1/token?grant_type=refresh_token", { method: "POST", headers: { "Content-Type": "application/json", apikey: "x" }, body: JSON.stringify({ refresh_token: c.sesion.renovacion }) });
      const j = await r.json();
      c.sesion = { acceso: j.access_token, renovacion: j.refresh_token, caduca: Date.now() + 3600000 };
      await window.AscensoAlmacen.ponerMeta("cuenta", c);            // sin avisar a la página, como haría otra ventana que esta no oyó
    }, sim.url);
    sim.caducarSesiones();                                            // y, encima, todo ha caducado: toca renovar de verdad
    let antes = enCuenta(sim);
    await apiLocal(A, "PUT", "tareas/s1", tarea("Tras la renovación de otra ventana"));
    await esperar(A, () => { const i = window.AscensoSync.informe(); return i.estado === "sincronizado" && i.pendientes === 0; }, null, { limite: 15000, que: "sincroniza con la sesión guardada" });
    assert.ok(enCuenta(sim) > antes, "el cambio llega a la cuenta");
    assert.notEqual((await informe(A)).detalle, "sesion");

    // ---- Un fallo pasajero al renovar (el servidor dice «demasiadas peticiones») no es una sesión caducada: se reintenta solo
    sim.caducarSesiones(); sim.bd.fallarRenovacion = 429; antes = enCuenta(sim);
    await apiLocal(A, "PUT", "tareas/s2", tarea("Tras un fallo pasajero"));
    await esperar(A, () => window.AscensoSync.informe().estado === "error", null, { limite: 10000, que: "el fallo se nota" });
    assert.equal((await informe(A)).detalle, "servidor", "pero no se da la sesión por perdida");
    await A.evaluate(() => window.AscensoSync.sincronizarAhora());
    await alDia(A);
    assert.ok(enCuenta(sim) > antes);

    // ---- Dos ventanas a la vez, las dos necesitando renovar: lo hacen de una en una y ninguna pierde la sesión
    const B = await ctx.newPage(); await B.goto(app.url); await paginaLista(B);
    sim.caducarSesiones();
    const peticiones = () => sim.bd.peticiones.filter(x => x.ruta === "/auth/v1/token" && x.cuerpo.includes('"refresh_token"')).length, renovaciones = peticiones();
    const lista = p => p.evaluate(() => window.AscensoSync.dispositivos().then(l => l.length, e => "error: " + e.message));
    assert.deepEqual(await Promise.all([lista(A), lista(B)]), [1, 1], "las dos consultan la cuenta con la sesión renovada");
    assert.equal(peticiones() - renovaciones, 1, "con una sola renovación entre las dos");
    assert.notEqual((await informe(A)).detalle, "sesion"); assert.notEqual((await informe(B)).detalle, "sesion");

    // ---- La ventana que sincroniza se queda dormida (el teléfono la congela): la que está a la vista toma el relevo
    await B.close();
    const cdp = await ctx.newCDPSession(A);
    await cdp.send("Page.setWebLifecycleState", { state: "frozen" });
    const C = await ctx.newPage(); await C.goto(app.url); await paginaLista(C);
    antes = enCuenta(sim);
    await apiLocal(C, "PUT", "tareas/s3", tarea("Escrita con la otra ventana dormida"));
    await esperar(C, () => { const i = window.AscensoSync.informe(); return i.estado === "sincronizado" && i.pendientes === 0; }, null, { limite: 20000, que: "la ventana visible sincroniza por su cuenta" });
    assert.ok(enCuenta(sim) > antes, "el cambio llega a la cuenta aunque la otra ventana no responda");
    // Al despertar, la primera no estorba ni pierde la sesión
    sim.caducarSesiones();
    await cdp.send("Page.setWebLifecycleState", { state: "active" });
    await apiLocal(C, "PUT", "tareas/s4", tarea("Con las dos despiertas"));
    await esperar(C, () => { const i = window.AscensoSync.informe(); return i.estado === "sincronizado" && i.pendientes === 0; }, null, { limite: 20000, que: "sigue sincronizando" });
    await A.locator("#board .task", { hasText: "Con las dos despiertas" }).waitFor({ timeout: 10000 });
    await A.waitForTimeout(1500);
    for (const p of [A, C]) { const i = await informe(p); assert.equal(i.email, EMAIL); assert.notEqual(i.detalle, "sesion"); }
  } finally { await nav.close(); await app.cerrar(); await sim.cerrar(); }
});

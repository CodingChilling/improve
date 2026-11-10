// La cuenta: entrar en un dispositivo que ya tiene datos (fusionar o reemplazar), cambiar la contraseña,
// recuperarla con la clave de recuperación, sesión caducada y cerrar sesión.
import test from "node:test";
import assert from "node:assert/strict";
import { chromium, apiLocal, paginaLista, esperar, servirAppConCuenta, panel, abrirPanel, cerrarPanel, crearCuenta, escribirAcceso, entrarPorPrimeraVez, alDia } from "./util.mjs";
import { simuladorSupabase } from "./simulador-supabase.mjs";

const EMAIL = "persona@ejemplo.com", CLAVE = "mi frase secreta larguísima", NUEVA = "otra frase distinta y larga", TERCERA = "la tercera frase, también larga";
const tarea = titulo => ({ date: "2026-01-05", title: titulo, prio: "media", list: "pendiente", tags: [] });
const titulos = async p => Object.values((await apiLocal(p, "GET", "estado")).tasks).map(t => t.title).sort();
async function dispositivo(nav, app) { const ctx = await nav.newContext(), p = await ctx.newPage(); await p.goto(app.url); await paginaLista(p); return p; }
const verError = (p, texto) => panel(p).locator(".c-error:not([hidden])", { hasText: texto }).first().waitFor({ timeout: 15000 });

test("cuenta: fusionar o reemplazar, cambio de contraseña, recuperación y cierre de sesión", async () => {
  const sim = await simuladorSupabase(), app = await servirAppConCuenta(sim), nav = await chromium.launch();
  try {
    // ---- A crea la cuenta con una tarea
    const A = await dispositivo(nav, app);
    await apiLocal(A, "PUT", "tareas/ta", tarea("De la cuenta"));
    // Antes de confirmar el email no se puede entrar, y el mensaje lo explica
    await crearCuenta(A, sim, EMAIL, CLAVE, { confirmar: false });
    await panel(A).getByRole("button", { name: "Iniciar sesión" }).click();
    await panel(A).locator('input[name="email"]').fill(EMAIL); await panel(A).locator('input[name="clave"]').fill(CLAVE);
    await panel(A).getByRole("button", { name: "Entrar" }).click();
    await verError(A, /Falta confirmar el email/);
    await A.goto(sim.confirmar(EMAIL));
    await panel(A).getByText("Email confirmado").waitFor();
    const recuperacion = await entrarPorPrimeraVez(A, EMAIL, CLAVE);
    await alDia(A);

    // ---- Contraseña equivocada: mensaje claro y nada cambia
    const B = await dispositivo(nav, app);
    await apiLocal(B, "PUT", "tareas/tb", tarea("Propia de B"));
    await escribirAcceso(B, EMAIL, "contraseña equivocada");
    await verError(B, /email o la contraseña no son correctos/);
    assert.equal(await B.evaluate(() => window.AscensoAlmacen.meta("cuenta")), undefined);

    // ---- B ya tenía datos propios: se pregunta, y «fusionar» conserva lo de los dos sitios
    await panel(B).locator('input[name="clave"]').fill(CLAVE);
    await panel(B).getByRole("button", { name: "Entrar" }).click();
    await panel(B).getByText("Este dispositivo ya tiene datos").waitFor();
    await panel(B).getByRole("button", { name: /Fusionar con la cuenta/ }).click();
    await panel(B).locator(".c-quien").waitFor(); await alDia(B);
    assert.deepEqual(await titulos(B), ["De la cuenta", "Propia de B"]);
    await esperar(A, () => window.AscensoLocal.api("GET", "estado").then(e => !!e.tasks.tb), null, { limite: 12000, que: "lo de B llega a A" });

    // ---- C también tenía datos propios, pero elige quedarse solo con lo de la cuenta
    const C = await dispositivo(nav, app);
    await apiLocal(C, "PUT", "tareas/tc", tarea("Propia de C, se descarta"));
    await escribirAcceso(C, EMAIL, CLAVE);
    await panel(C).getByRole("button", { name: /Usar solo lo de la cuenta/ }).click();
    await panel(C).locator(".c-quien").waitFor(); await alDia(C);
    assert.deepEqual(await titulos(C), ["De la cuenta", "Propia de B"]);
    await A.waitForTimeout(800);
    assert.ok(!(await titulos(A)).includes("Propia de C, se descarta"), "lo descartado no sube a la cuenta");

    // ---- Cambiar la contraseña (en A): la actual debe ser correcta; los datos no se vuelven a cifrar
    const filasAntes = sim.bd.cambios.length;
    await abrirPanel(A);
    await panel(A).getByRole("button", { name: "Cambiar la contraseña" }).click();
    const rellenar = async (actual, n1, n2) => { await panel(A).locator('input[name="actual"]').fill(actual); await panel(A).locator('input[name="clave1"]').fill(n1); await panel(A).locator('input[name="clave2"]').fill(n2);
      await panel(A).locator('button[type="submit"]').click(); };
    await rellenar(CLAVE, "corta", "corta");
    await verError(A, /al menos 10 caracteres/);
    await rellenar(CLAVE, NUEVA, NUEVA + "x");
    await verError(A, /no coinciden/);
    await rellenar("no es la actual, pero es larga", NUEVA, NUEVA);
    await verError(A, /contraseña actual no es correcta/);
    await rellenar(CLAVE, NUEVA, NUEVA);
    await panel(A).getByText("Contraseña cambiada").waitFor();
    assert.equal(sim.bd.cambios.length, filasAntes, "cambiar la contraseña no vuelve a subir los datos");
    // Los dispositivos que ya estaban dentro siguen sincronizando
    await apiLocal(A, "PUT", "tareas/tras", tarea("Tras cambiar la contraseña"));
    await esperar(B, () => window.AscensoLocal.api("GET", "estado").then(e => !!e.tasks.tras), null, { limite: 12000, que: "B sigue recibiendo" });
    // En un dispositivo nuevo, la antigua ya no vale y la nueva sí
    const D = await dispositivo(nav, app);
    await escribirAcceso(D, EMAIL, CLAVE);
    await verError(D, /no son correctos/);
    await panel(D).locator('input[name="clave"]').fill(NUEVA);
    await panel(D).getByRole("button", { name: "Entrar" }).click();
    await panel(D).locator(".c-quien").waitFor(); await alDia(D);
    assert.ok((await titulos(D)).includes("Tras cambiar la contraseña"));

    // ---- Contraseña olvidada: enlace por email + clave de recuperación
    const E = await dispositivo(nav, app);
    await abrirPanel(E);
    await panel(E).getByRole("button", { name: "Iniciar sesión" }).click();
    await panel(E).getByRole("button", { name: "He olvidado la contraseña" }).click();
    await panel(E).locator('input[name="email"]').fill(EMAIL);
    await panel(E).getByRole("button", { name: "Enviar el enlace" }).click();
    await panel(E).getByText("Revisa tu email").waitFor();
    await E.goto(sim.enlaceRecuperacion(EMAIL));
    await panel(E).getByText("Nueva contraseña").waitFor();
    assert.ok(!E.url().includes("access_token"), "los datos del enlace se quitan de la dirección");
    const recuperar = async rec => { await panel(E).locator('input[name="recuperacion"]').fill(rec); await panel(E).locator('input[name="clave1"]').fill(TERCERA); await panel(E).locator('input[name="clave2"]').fill(TERCERA);
      await panel(E).locator('button[type="submit"]').click(); };
    await recuperar("AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-GGGG-HHHH");
    await verError(E, /clave de recuperación no es correcta/);
    await recuperar(recuperacion.toLowerCase());
    await panel(E).locator(".c-quien").waitFor({ timeout: 20000 }); await alDia(E);
    assert.ok((await titulos(E)).includes("De la cuenta") && (await titulos(E)).includes("Tras cambiar la contraseña"), "con la clave de recuperación vuelven los datos");
    // La contraseña nueva vale a partir de ahora; la clave de recuperación sigue siendo la misma
    const F = await dispositivo(nav, app);
    await escribirAcceso(F, EMAIL, TERCERA);
    await panel(F).locator(".c-quien").waitFor(); await alDia(F);

    // ---- Si la sesión deja de valer (y no se puede renovar), se pide entrar de nuevo, sin perder nada
    sim.caducarSesiones(); sim.bd.renovaciones.clear();
    await apiLocal(F, "PUT", "tareas/sinsesion", tarea("Escrita con la sesión caducada"));
    await esperar(F, () => window.AscensoSync.informe().detalle === "sesion", null, { limite: 15000, que: "F detecta la sesión caducada" });
    assert.match(await F.locator("#status").textContent(), /sesión ha caducado/);
    await cerrarPanel(F);
    await F.click("#status");
    assert.equal(await panel(F).locator('input[name="email"]').inputValue(), EMAIL);
    await panel(F).locator('input[name="clave"]').fill(TERCERA);
    await panel(F).getByRole("button", { name: "Entrar" }).click();
    await panel(F).locator(".c-quien").waitFor(); await alDia(F);
    assert.ok(sim.bd.cambios.length > filasAntes && (await titulos(F)).includes("Escrita con la sesión caducada"));

    // ---- Servidor caído: la app sigue, avisa y se pone al día sola cuando vuelve
    await esperar(E, () => window.AscensoSync.informe().detalle === "sesion", null, { limite: 30000, que: "E también pide entrar de nuevo" }).catch(() => {});
    sim.cortar(true);
    await apiLocal(F, "PUT", "tareas/caido", tarea("Con el servidor caído"));
    await esperar(F, () => window.AscensoSync.informe().estado === "sin-conexion", null, { limite: 15000, que: "F avisa de que no hay conexión" });
    sim.cortar(false);
    await F.evaluate(() => window.AscensoSync.sincronizarAhora());
    await alDia(F);

    // ---- Cerrar sesión conservando los datos: quedan aquí, pero ya no hay sesión ni claves
    await abrirPanel(F);
    await panel(F).getByRole("button", { name: "Cerrar sesión" }).click();
    await panel(F).getByRole("button", { name: /conservar los datos aquí/ }).click();
    await esperar(F, () => window.AscensoAlmacen.meta("cuenta").then(c => c === undefined), null, { que: "se borra la sesión de F" });
    assert.ok((await titulos(F)).includes("De la cuenta"));
    assert.match(await F.locator("#status").textContent(), /Guardado en este dispositivo/);
    await F.reload(); await paginaLista(F);
    assert.equal(await F.evaluate(() => window.AscensoSync.informe().estado), "sin-cuenta");

    // ---- Cerrar sesión borrando los datos: el dispositivo queda como recién instalado
    await abrirPanel(D);
    await panel(D).getByRole("button", { name: "Cerrar sesión" }).click();
    await Promise.all([D.waitForEvent("load"), panel(D).getByRole("button", { name: /borrar los datos de este dispositivo/ }).click()]);
    await paginaLista(D);
    assert.deepEqual(await titulos(D), []);
    assert.equal(await D.evaluate(() => window.AscensoAlmacen.meta("cuenta")), undefined);
    assert.equal((await D.evaluate(() => window.AscensoAlmacen.todos("pendientes"))).some(x => x.tabla === "tareas"), false);
    assert.ok((await apiLocal(D, "GET", "estado")).habits.length > 0, "vuelven los datos iniciales");
    // …y la cuenta sigue intacta para los demás
    assert.ok((await titulos(A)).includes("De la cuenta"));
  } finally { await nav.close(); await app.cerrar(); await sim.cerrar(); }
});

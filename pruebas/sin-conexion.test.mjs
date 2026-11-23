// Ascenso sin conexión con una cuenta: la sesión se queda en el dispositivo y, sin red, se ve todo lo que había la
// última vez que hubo conexión (tareas, imágenes de las libretas y libros), y lo que se haga se envía al volver.
import test from "node:test";
import assert from "node:assert/strict";
import { chromium, apiLocal, paginaLista, esperar, PNG_1X1, servirAppConCuenta, panel, abrirPanel, cerrarPanel, crearCuenta, escribirAcceso, entrarPorPrimeraVez, alDia } from "./util.mjs";
import { simuladorSupabase } from "./simulador-supabase.mjs";
import { epubDeEjemplo } from "./libros.mjs";

const EMAIL = "sinred@ejemplo.com", CLAVE = "una frase larga para la cuenta";
const hoy = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const tarea = t => ({ date: hoy(), title: t, prio: "media", list: "pendiente", tags: [] });
const informe = p => p.evaluate(() => window.AscensoSync.informe());
const enDispositivo = (p, id) => p.evaluate(i => window.AscensoAlmacen.leer("adjuntos", i).then(a => !!(a && a.datos)), id);

test("sin conexión se ve todo lo de la cuenta, con la sesión guardada", async () => {
  const sim = await simuladorSupabase(), app = await servirAppConCuenta(sim), nav = await chromium.launch();
  try {
    // ---- A: crea la cuenta con una tarea, una imagen en una libreta y un libro
    const A = await (await nav.newContext({ viewport: { width: 1100, height: 760 } })).newPage();
    await A.goto(app.url); await paginaLista(A);
    await crearCuenta(A, sim, EMAIL, CLAVE); await entrarPorPrimeraVez(A, EMAIL, CLAVE); await alDia(A); await cerrarPanel(A);
    await apiLocal(A, "PUT", "tareas/t1", tarea("Tarea de la cuenta"));
    await apiLocal(A, "PUT", "adjuntos/img1", { tipo: "image/png", datos: PNG_1X1, ancho: 1, alto: 1 });
    await apiLocal(A, "PUT", "mapas/m1", { title: "Mapa", color: "#2E86AB", notes: "![dibujo](imagen:img1)" });
    await A.click("#quote .q-autor"); await A.locator("#libreria:not([hidden])").waitFor();
    await A.setInputFiles("#lb-cuerpo input.lb-archivo", [{ name: "meditaciones.epub", mimeType: "application/epub+zip", buffer: epubDeEjemplo() }]);
    await A.locator(".lb-libro").waitFor({ timeout: 20000 });
    const archivo = Object.values((await apiLocal(A, "GET", "libreria")).libros)[0].archivo;
    await alDia(A);
    await A.click("#lb-volver");

    // ---- B: entra en la cuenta con conexión y, sin abrir nada, guarda en el dispositivo la imagen y el libro
    const ctx = await nav.newContext({ viewport: { width: 1100, height: 760 } }), B = await ctx.newPage();
    const errores = []; B.on("pageerror", e => errores.push(String(e)));
    await B.goto(app.url); await paginaLista(B);
    await escribirAcceso(B, EMAIL, CLAVE); await panel(B).locator(".c-quien").waitFor(); await alDia(B);
    await esperar(B, () => { const g = window.AscensoSync.informe().guardado; return g && g.faltan === 0; }, null, { limite: 20000, que: "B guarda todo para usarlo sin conexión" });
    assert.ok(await enDispositivo(B, "img1"), "la imagen de la libreta está en B sin haberla abierto");
    assert.ok(await enDispositivo(B, archivo), "el libro está en B sin haberlo abierto");
    await abrirPanel(B);
    assert.match(await panel(B).locator(".c-cuerpo").innerText(), /Sin conexión puedes usar Ascenso con todo lo de tu cuenta/);
    await cerrarPanel(B);
    await B.waitForFunction(() => !!navigator.serviceWorker.controller);

    // ---- Sin conexión: se cierra Ascenso y se vuelve a abrir
    await ctx.setOffline(true); await B.close();
    const C = await ctx.newPage(); C.on("pageerror", e => errores.push(String(e)));
    await C.goto(app.url); await paginaLista(C);
    await esperar(C, () => window.AscensoSync.informe().estado === "sin-conexion", null, { limite: 15000, que: "sabe que no hay conexión" });
    assert.equal((await informe(C)).email, EMAIL, "la sesión sigue ahí");
    assert.match(await C.locator("#status").textContent(), /Sin conexión/);
    await C.locator("#board .task", { hasText: "Tarea de la cuenta" }).waitFor();
    // La imagen de la libreta y el libro, también sin red
    const url = await C.evaluate(async () => { window.AscensoLocal.urlAdjunto("img1"); await new Promise(r => setTimeout(r, 500)); return window.AscensoLocal.urlAdjunto("img1"); });
    assert.match(url, /^blob:/, "la imagen de la libreta se ve sin conexión");
    await C.click("#quote .q-autor"); await C.locator("#libreria:not([hidden])").waitFor();
    assert.doesNotMatch(await C.locator(".lb-libro .lb-estado").innerText(), /descargará|no está/);
    await C.locator(".lb-libro .lb-abrir").click();
    await C.locator("#lc-texto h1", { hasText: "Libro primero" }).waitFor({ timeout: 15000 });
    await C.keyboard.press("Escape"); await C.click("#lb-volver");
    // Lo que se hace sin conexión queda pendiente y se envía al volver la red
    await apiLocal(C, "PUT", "tareas/t2", tarea("Escrita sin conexión"));
    await esperar(C, () => window.AscensoSync.informe().pendientes > 0, null, { que: "queda pendiente" });
    await ctx.setOffline(false);
    await C.evaluate(() => window.dispatchEvent(new Event("online")));
    await alDia(C, 20000);
    await esperar(A, () => window.AscensoLocal.api("GET", "estado").then(e => Object.values(e.tasks).some(t => t.title === "Escrita sin conexión")), null, { limite: 15000, que: "llega a A" });

    // ---- Si la sesión llega a perderse de verdad: todo sigue a la vista y volver a entrar continúa donde estaba
    sim.caducarSesiones(); sim.bd.renovaciones.clear();
    await apiLocal(C, "PUT", "tareas/t3", tarea("Escrita con la sesión perdida"));
    await esperar(C, () => window.AscensoSync.informe().detalle === "sesion", null, { limite: 15000, que: "detecta la sesión perdida" });
    await C.locator("#board .task", { hasText: "Tarea de la cuenta" }).waitFor();            // todo sigue a la vista
    assert.ok(Object.values((await apiLocal(C, "GET", "estado")).tasks).some(t => t.title === "Escrita con la sesión perdida"));
    assert.ok(await enDispositivo(C, archivo), "los datos y archivos siguen en el dispositivo");
    const filas = sim.bd.cambios.length;
    await abrirPanel(C);
    await panel(C).locator('input[name="clave"]').fill(CLAVE);
    await panel(C).getByRole("button", { name: "Entrar" }).click();
    await panel(C).locator(".c-quien").waitFor();                       // sin preguntar si fusionar o reemplazar
    await alDia(C);
    assert.equal(sim.bd.cambios.length - filas, 1, "solo se envía lo pendiente, no todo otra vez");
    // (A también perdió la sesión: vuelve a entrar y recibe lo escrito mientras tanto)
    await esperar(A, () => window.AscensoSync.informe().detalle === "sesion", null, { limite: 15000, que: "A también la perdió" });
    await abrirPanel(A); await panel(A).locator('input[name="clave"]').fill(CLAVE); await panel(A).getByRole("button", { name: "Entrar" }).click();
    await panel(A).locator(".c-quien").waitFor(); await alDia(A);
    await esperar(A, () => window.AscensoLocal.api("GET", "estado").then(e => Object.values(e.tasks).some(t => t.title === "Escrita con la sesión perdida")), null, { limite: 15000, que: "lo escrito mientras tanto llega a A" });
    assert.deepEqual(errores, []);
  } finally { await nav.close(); await app.cerrar(); await sim.cerrar(); }
});

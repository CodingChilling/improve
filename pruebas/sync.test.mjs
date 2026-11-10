// Dos dispositivos (dos contextos de navegador) con la misma cuenta se sincronizan entre sí: altas, cambios,
// borrados, edición sin conexión, conflictos e imágenes. Y el servidor no ve nada sin cifrar.
//
// Por defecto se usa el simulador (simulador-supabase.mjs). Ver pruebas/LEEME.md para lanzarlas contra un proyecto real.
import test from "node:test";
import assert from "node:assert/strict";
import { chromium, apiLocal, paginaLista, esperar, PNG_1X1, servirAppConCuenta, panel, abrirPanel, cerrarPanel, crearCuenta, escribirAcceso, entrarPorPrimeraVez, alDia } from "./util.mjs";
import { simuladorSupabase } from "./simulador-supabase.mjs";

const EMAIL = "persona@ejemplo.com", CLAVE = "mi frase secreta larguísima";
const hoy = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const tarea = (titulo, extra = {}) => ({ date: hoy(), title: titulo, prio: "media", list: "pendiente", tags: [], ...extra });
const tareasDe = async p => Object.values((await apiLocal(p, "GET", "estado")).tasks).map(t => t.title).sort();
const tiene = (p, titulo, si = true) => esperar(p, ([t, s]) => window.AscensoLocal.api("GET", "estado").then(e => Object.values(e.tasks).some(x => x.title === t) === s), [titulo, si], { limite: 12000, que: (si ? "llega" : "desaparece") + " «" + titulo + "»" });
async function dispositivo(nav, app) { const ctx = await nav.newContext(), p = await ctx.newPage(); const errores = []; p.on("pageerror", e => errores.push(String(e))); await p.goto(app.url); await paginaLista(p); return { ctx, p, errores }; }

test("dos dispositivos con la misma cuenta se sincronizan (cifrado de extremo a extremo)", async () => {
  const sim = await simuladorSupabase(), app = await servirAppConCuenta(sim), nav = await chromium.launch();
  try {
    // ---- A: tiene datos, crea la cuenta y los sube
    const A = await dispositivo(nav, app);
    await A.p.fill("#tnew", "Tarea secreta de A"); await A.p.click("#taddbtn");
    await tiene(A.p, "Tarea secreta de A");
    await crearCuenta(A.p, sim, EMAIL, CLAVE);
    const recuperacion = await entrarPorPrimeraVez(A.p, EMAIL, CLAVE);
    assert.match(recuperacion, /^([A-Z2-9]{4}-){7}[A-Z2-9]{4}$/);
    await alDia(A.p); await cerrarPanel(A.p);
    assert.match(await A.p.locator("#status").textContent(), /Sincronizado/);
    assert.ok(sim.bd.cambios.length > 3, "los datos de A están en la cuenta");

    // ---- B: dispositivo nuevo; al entrar recibe lo de A (sin preguntas: no tenía nada propio)
    const B = await dispositivo(nav, app);
    await escribirAcceso(B.p, EMAIL, CLAVE);
    await panel(B.p).locator(".c-quien").waitFor();
    await alDia(B.p); await cerrarPanel(B.p);
    await B.p.locator("#board .task", { hasText: "Tarea secreta de A" }).waitFor();          // y se ve en la página, sin recargar
    assert.deepEqual((await apiLocal(B.p, "GET", "estado")).habits, (await apiLocal(A.p, "GET", "estado")).habits);

    // ---- Lo que se crea en B aparece en A en tiempo real
    await B.p.fill("#tnew", "Tarea de B"); await B.p.click("#taddbtn");
    await A.p.locator("#board .task", { hasText: "Tarea de B" }).waitFor({ timeout: 12000 });

    // ---- Un borrado en A desaparece en B (también de la pantalla)
    const idB = Object.entries((await apiLocal(A.p, "GET", "estado")).tasks).find(([, t]) => t.title === "Tarea de B")[0];
    await apiLocal(A.p, "DELETE", "tareas/" + idB);
    await tiene(B.p, "Tarea de B", false);
    await esperar(B.p, () => !document.querySelector("#board").textContent.includes("Tarea de B"), null, { que: "la tarea borrada deja de verse en B" });

    // ---- Tableros con sus listas y tarjetas, y borrado en cascada
    await apiLocal(A.p, "PUT", "tableros/b1", { name: "Tablero privado", color: "#2E86AB" });
    await apiLocal(A.p, "PUT", "listas/l1", { board: "b1", title: "Lista", order: 0 });
    await apiLocal(A.p, "PUT", "tarjetas/c1", { list: "l1", title: "Tarjeta confidencial", prio: "alta", check: [{ id: "k1", t: "paso uno" }] });
    await esperar(B.p, () => window.AscensoLocal.api("GET", "estado").then(e => e.cards.c1 && e.cards.c1.check.length === 1 && e.blists.l1 && !!e.boards.b1), null, { limite: 12000, que: "el tablero llega a B" });
    await apiLocal(B.p, "DELETE", "tableros/b1");
    await esperar(A.p, () => window.AscensoLocal.api("GET", "estado").then(e => !e.boards.b1 && !e.blists.l1 && !e.cards.c1), null, { limite: 12000, que: "el tablero borrado (con sus listas y tarjetas) desaparece de A" });

    // ---- Sin conexión: B sigue funcionando, guarda los cambios y los envía al volver
    await B.ctx.setOffline(true);
    await apiLocal(B.p, "PUT", "tareas/sinred", tarea("Escrita sin conexión"));
    await apiLocal(B.p, "PUT", "notas/2026-01-05", { r: "Reflexión sin conexión", n: "" });
    await esperar(B.p, () => window.AscensoSync.informe().estado === "sin-conexion", null, { limite: 15000, que: "B se da cuenta de que no hay conexión" });
    assert.match(await B.p.locator("#status").textContent(), /Sin conexión: 2 cambios pendientes/);
    await apiLocal(A.p, "PUT", "tareas/mientras", tarea("Hecha en A mientras B no tenía red"));
    await alDia(A.p);
    assert.ok(!(await tareasDe(A.p)).includes("Escrita sin conexión"));
    await B.ctx.setOffline(false);
    await B.p.evaluate(() => window.dispatchEvent(new Event("online")));
    await tiene(A.p, "Escrita sin conexión"); await tiene(B.p, "Hecha en A mientras B no tenía red");
    await esperar(A.p, () => window.AscensoLocal.api("GET", "estado").then(e => e.notes["2026-01-05"] && e.notes["2026-01-05"].r === "Reflexión sin conexión"), null, { que: "la nota llega a A" });

    // ---- Conflicto: los dos cambian la misma tarea; gana el último cambio (el de B), en los dos
    await B.ctx.setOffline(true);
    await apiLocal(A.p, "PUT", "tareas/sinred", tarea("Versión de A (anterior)"));
    await alDia(A.p);
    await B.p.waitForTimeout(50);
    await apiLocal(B.p, "PUT", "tareas/sinred", tarea("Versión de B (posterior)"));
    await B.ctx.setOffline(false);
    await B.p.evaluate(() => window.dispatchEvent(new Event("online")));
    await tiene(A.p, "Versión de B (posterior)"); await alDia(B.p);
    assert.ok(!(await tareasDe(B.p)).includes("Versión de A (anterior)") && !(await tareasDe(A.p)).includes("Versión de A (anterior)"));
    // …y al revés: un cambio viejo que llega tarde no pisa a uno más nuevo
    await B.ctx.setOffline(true);
    await apiLocal(B.p, "PUT", "tareas/sinred", tarea("Cambio viejo de B"));
    await B.p.waitForTimeout(50);
    await apiLocal(A.p, "PUT", "tareas/sinred", tarea("Cambio nuevo de A"));
    await alDia(A.p);
    await B.ctx.setOffline(false);
    await B.p.evaluate(() => window.dispatchEvent(new Event("online")));
    await tiene(B.p, "Cambio nuevo de A"); await alDia(B.p); await alDia(A.p);
    assert.ok((await tareasDe(A.p)).includes("Cambio nuevo de A") && !(await tareasDe(A.p)).includes("Cambio viejo de B"));

    // ---- Mientras se escribe, lo que llega no quita nada de las manos
    // En el cuadro de «nueva tarea»: lo que llega aparece, y lo escrito (y el cursor) sigue donde estaba
    await A.p.fill("#tnew", "a medias");
    await apiLocal(B.p, "PUT", "tareas/llega", tarea("Llega mientras A escribe"));
    await A.p.locator("#board .task", { hasText: "Llega mientras A escribe" }).waitFor({ timeout: 12000 });
    assert.equal(await A.p.inputValue("#tnew"), "a medias");
    assert.equal(await A.p.evaluate(() => document.activeElement.id), "tnew");
    await A.p.fill("#tnew", "");
    // Editando algo de la propia lista (el nombre de un hábito): la página no se repinta hasta que se termina
    await A.p.evaluate(() => { document.getElementById("cfg").open = true; });
    const nombre = A.p.locator("#hlist .name").first();
    await nombre.focus(); await nombre.pressSequentially(" (editando)");
    await apiLocal(B.p, "PUT", "tareas/llega2", tarea("Llega mientras A edita un hábito"));
    await tiene(A.p, "Llega mientras A edita un hábito");
    await A.p.waitForTimeout(2000);
    assert.ok(!(await A.p.locator("#board").textContent()).includes("Llega mientras A edita un hábito"), "no se repinta mientras se edita");
    assert.match(await nombre.inputValue(), /\(editando\)/);
    assert.ok(await nombre.evaluate(e => e === document.activeElement && e.isConnected), "el campo sigue siendo el mismo y con el cursor");
    await A.p.locator("#h-tasks").click();                                               // al terminar, aparece lo que llegó…
    await A.p.locator("#board .task", { hasText: "Llega mientras A edita un hábito" }).waitFor({ timeout: 8000 });
    await esperar(B.p, () => window.AscensoLocal.api("GET", "estado").then(e => e.habits.some(h => /\(editando\)/.test(h.t))), null, { limite: 12000, que: "…y lo editado en A llega a B" });

    // ---- Imágenes de las libretas: el contenido viaja cifrado y B lo descarga cuando lo necesita
    await apiLocal(A.p, "PUT", "adjuntos/img1", { tipo: "image/png", ancho: 1, alto: 1, datos: PNG_1X1 });
    await apiLocal(A.p, "PUT", "mapas/m1", { title: "Mapa íntimo", color: "#2E86AB", notes: "![](imagen:img1)" });
    await esperar(B.p, () => window.AscensoLocal.api("GET", "estado").then(e => !!e.att.img1 && !!e.maps.m1), null, { limite: 12000, que: "la imagen llega a B" });
    assert.equal(await B.p.evaluate(async () => { const im = document.createElement("img"); im.dataset.adj = "img1"; document.body.appendChild(im); im.src = window.AscensoLocal.urlAdjunto("img1");
      for (let i = 0; i < 200 && !im.src.startsWith("blob:"); i++) await new Promise(r => setTimeout(r, 25)); await im.decode(); return im.naturalWidth; }), 1);
    assert.equal(sim.bd.archivos.size, 1);
    assert.ok(![...sim.bd.archivos.values()][0].includes(Buffer.from("PNG")), "la imagen no está en claro en el servidor");

    // ---- Los dos acaban exactamente igual
    await alDia(A.p); await alDia(B.p);
    const ea = await apiLocal(A.p, "GET", "estado"), eb = await apiLocal(B.p, "GET", "estado");
    assert.deepEqual(eb, ea);

    // ---- El servidor no ha visto nada sin cifrar: ni contenido, ni nombres de tablas, ni identificadores, ni la contraseña
    const visto = sim.todoLoVisto();
    for (const secreto of ["Tarea secreta", "Tarea de B", "confidencial", "privado", "Reflexión", "íntimo", "paso uno", CLAVE, recuperacion, recuperacion.replace(/-/g, ""), '"tabla"', "tareas", "sinred", "valores"])
      assert.ok(!visto.includes(secreto) && !visto.includes(Buffer.from(secreto, "utf8").toString("latin1")), "el servidor no debe ver: " + secreto);
    assert.ok(sim.bd.cambios.every(c => /^v1\.[\w-]+\.[\w-]+$/.test(c.datos) && /^[\w-]{43}$/.test(c.registro) && /^d[0-9a-f]{24}$/.test(c.dispositivo)));
    assert.equal(new Set(sim.bd.cambios.map(c => c.dispositivo)).size, 2);

    // ---- En el dispositivo: nada sensible en localStorage, y las claves guardadas no se pueden exportar
    for (const d of [A, B]) {
      const local = await d.p.evaluate(() => JSON.stringify(localStorage));
      assert.ok(!/acc\.|ren\.|persona@|secreta/.test(local), "localStorage: " + local);
      const c = await d.p.evaluate(() => window.AscensoAlmacen.meta("cuenta").then(c => ({ email: c.email, exportable: c.claves.cifrado.extractable || c.claves.etiquetas.extractable, campos: Object.keys(c).sort() })));
      assert.deepEqual(c, { email: EMAIL, exportable: false, campos: ["claves", "email", "sesion", "userId"] });
      assert.deepEqual(d.errores, []);
    }

    // ---- La sesión se recuerda: al volver a abrir, sigue conectado sin pedir la contraseña; y renueva sola la sesión caducada
    sim.caducarSesiones();
    await B.p.reload(); await paginaLista(B.p);
    await alDia(B.p);
    await apiLocal(A.p, "PUT", "tareas/tras", tarea("Después de renovar la sesión"));
    await tiene(B.p, "Después de renovar la sesión");

    // ---- Lista de dispositivos
    await abrirPanel(A.p);
    await panel(A.p).locator(".c-disp").nth(1).waitFor();
    assert.equal(await panel(A.p).locator(".c-disp").count(), 2);
    assert.equal(await panel(A.p).locator(".c-este").count(), 1);
    await cerrarPanel(A.p);

    // ---- Dos pestañas en el mismo dispositivo: solo una habla con la cuenta, pero las dos están al día
    const A2 = await A.ctx.newPage(); await A2.goto(app.url); await paginaLista(A2);
    await esperar(A2, () => /Sincronizado/.test(document.getElementById("status").textContent), null, { que: "la segunda pestaña sabe que está sincronizado" });
    const filas = sim.bd.cambios.length;
    await apiLocal(A2, "PUT", "tareas/pest", tarea("Desde la segunda pestaña"));
    await tiene(B.p, "Desde la segunda pestaña");
    await A.p.locator("#board .task", { hasText: "Desde la segunda pestaña" }).waitFor({ timeout: 8000 });
    await alDia(A.p);
    assert.equal(sim.bd.cambios.length, filas + 1, "el cambio se sube una sola vez");
  } finally { await nav.close(); await app.cerrar(); await sim.cerrar(); }
});

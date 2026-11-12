// El servidor local del navegador (servidor-local.js) debe comportarse igual que servidor.py:
// mismas respuestas, mismos errores y el mismo JSON en «estado». También comprueba que la copia
// que exporta la versión de Python se importa tal cual.
import test from "node:test";
import assert from "node:assert/strict";
import { servirApp, servidorClasico, chromium, apiLocal, PNG_1X1 } from "./util.mjs";

const C = "#2e86ab";
const largo = n => "x".repeat(n);
// [método, ruta, cuerpo]: las válidas construyen datos; las no válidas deben dar el mismo error
const OPERACIONES = [
  ["PUT", "config", { plan: ["climb", "strength", "rest", "climb", "active", "rest", "rest"], thr: 0.66, tipos: { climb: "  Roca ", nada: "x", rest: "" } }],
  ["PUT", "config", { plan: ["climb"] }],
  ["PUT", "config", { thr: 0.6 }],
  ["PUT", "config", { tipos: [] }],
  ["PUT", "habitos", [{ id: "h1", t: " Leer ", s: "20 min", days: [true, false, true, true, true, true, false] }, { id: "h2", streak: false, week: false }, { id: "h3", t: largo(80) }]],
  ["PUT", "habitos", [{ id: "h1" }, { id: "h1" }]],
  ["PUT", "habitos", [{ id: "con espacio" }]],
  ["PUT", "habitos", {}],
  ["PUT", "dias/2026-01-05", { w: 81.44, type: "climb", c: { h1: true, h2: true, noexiste: true, h3: false } }],
  ["PUT", "dias/2026-01-06", { c: { h2: true } }],
  ["PUT", "dias/2026-01-07", { w: 80 }],
  ["PUT", "dias/2026-01-08", { c: {} }],
  ["PUT", "dias/2026-01-09", { w: 10 }],
  ["PUT", "dias/2026-01-09", { w: "abc" }],
  ["PUT", "dias/2026-01-09", { type: "volar" }],
  ["PUT", "dias/mal", { w: 80 }],
  ["PUT", "dias/2026-01-07", {}],
  ["PUT", "habitos", [{ id: "h2", streak: false, week: false }, { id: "h1", t: "Leer" }]],
  ["PUT", "historial/2026-01-05", { q: "f12", img: "seneca.jpg" }],
  ["PUT", "historial/2026-01-06", {}],
  ["PUT", "historial/2026-01-07", { q: "con espacio" }],
  ["PUT", "historial/2026-01-07", { img: largo(301) }],
  ["PUT", "etiquetas/e1", { name: " Casa ", color: C }],
  ["PUT", "etiquetas/e2", { name: "Trabajo", color: "#FFFFFF" }],
  ["PUT", "etiquetas/e3", { name: "", color: C }],
  ["PUT", "etiquetas/e3", { name: "x", color: "rojo" }],
  ["PUT", "tareas/t1", { date: "2026-01-05", title: " Comprar ", notes: "pan", prio: "alta", list: "pendiente", created: "2026-01-04T10:00", tags: ["e1", "e2", "nada", "e1"] }],
  ["PUT", "tareas/t2", { date: "2026-01-05", title: "Otra", prio: "media", list: "hecha", archived: "2026-01-06" }],
  ["PUT", "tareas/t1", { date: "2026-01-06", title: "Comprar", prio: "baja", list: "proceso", created: "otra-cosa", tags: ["e2"] }],
  ["PUT", "tareas/t3", { date: "2026-01-05", title: "x", prio: "ninguna", list: "hecha" }],
  ["PUT", "tareas/t3", { date: "2026-01-05", title: "x", prio: "alta", list: "otra" }],
  ["PUT", "tareas/t3", { date: "ayer", title: "x", prio: "alta", list: "hecha" }],
  ["PUT", "tareas/t3", { date: "2026-01-05", title: "  ", prio: "alta", list: "hecha" }],
  ["PUT", "tareas/t3", { date: "2026-01-05", title: "x", prio: "alta", list: "hecha", tags: "e1" }],
  // Checklist de una tarea (como la de las tarjetas)
  ["PUT", "tareas/t4", { date: "2026-01-05", title: "Con lista", prio: "media", list: "pendiente", check: [{ id: "p1", t: " uno ", d: true }, { id: "p2", t: "  " }, { id: "p3", t: "tres" }] }],
  ["PUT", "tareas/t4", { date: "2026-01-05", title: "Con lista", prio: "media", list: "proceso", check: [{ id: "p3", t: "tres", d: 1 }, { id: "p4", t: "x".repeat(400) }] }],
  ["PUT", "tareas/t5", { date: "2026-01-05", title: "x", prio: "baja", list: "hecha", check: [{ id: "mal id", t: "x" }] }],
  ["PUT", "tareas/t5", { date: "2026-01-05", title: "x", prio: "baja", list: "hecha", check: ["x"] }],
  ["PUT", "tareas/t5", { date: "2026-01-05", title: "x", prio: "baja", list: "hecha", check: "x" }],
  ["PUT", "tareas/t5", { date: "2026-01-05", title: "x", prio: "baja", list: "hecha", check: Array.from({ length: 101 }, (_, i) => ({ id: "q" + i, t: "x" })) }],
  ["DELETE", "etiquetas/e2"],
  ["PUT", "tareas/t4", { date: "2026-01-05", title: "Para borrar", prio: "alta", list: "hecha" }],
  ["DELETE", "tareas/t4"],
  ["DELETE", "tareas/no-existe"],
  ["PUT", "notas/2026-01-05", { r: "Pensar", n: "uno\ndos" }],
  ["PUT", "notas/2026-01-06", { r: "algo" }],
  ["PUT", "notas/2026-01-06", { r: "  ", n: "" }],
  ["PUT", "notas/mal", { r: "x" }],
  ["PUT", "eventos/v1", { start: "2026-01-05", end: "2026-01-07", time: "09:30", title: " Viaje ", color: C, created: "2026-01-01" }],
  ["PUT", "eventos/v2", { start: "2026-02-01", title: "Un día", color: C }],
  ["PUT", "eventos/v3", { start: "2026-02-03", end: "2026-02-01", title: "x", color: C }],
  ["PUT", "eventos/v3", { start: "2026-02-30", title: "x", color: C }],
  ["PUT", "eventos/v3", { start: "2026-01-01", end: "2027-06-01", title: "x", color: C }],
  ["PUT", "eventos/v3", { start: "2026-01-01", time: "25:00", title: "x", color: C }],
  ["PUT", "eventos/v3", { start: "2026-01-01", title: "", color: C }],
  ["PUT", "eventos/v4", { start: "2026-01-01", title: "fuera", color: C }],
  ["DELETE", "eventos/v4"],
  ["PUT", "tableros/b1", { name: " Casa ", color: C, fav: true, order: 2, created: "2026-01-01" }],
  ["PUT", "tableros/b2", { name: "Otro", color: C }],
  ["PUT", "tableros/b3", { name: "Mal", color: C, order: "x" }],
  ["PUT", "tableros/b3", { name: "Mal", color: C, order: null }],
  ["PUT", "etiquetas-tablero/le1", { board: "b1", name: "Azul", color: C }],
  ["PUT", "etiquetas-tablero/le2", { board: "b2", name: "Verde", color: C }],
  ["PUT", "etiquetas-tablero/le3", { board: "no-existe", name: "x", color: C }],
  ["PUT", "listas/l1", { board: "b1", title: " Por hacer ", order: 0 }],
  ["PUT", "listas/l2", { board: "b1", title: "Hecho", order: 1, collapsed: true }],
  ["PUT", "listas/l3", { board: "b2", title: "En b2", order: "3" }],
  ["PUT", "listas/l4", { board: "no-existe", title: "x" }],
  ["PUT", "listas/l4", { board: "b1", title: "" }],
  ["PUT", "tarjetas/c1", { list: "l1", title: " Tarjeta ", desc: "d", prio: "ninguna", due: "2026-03-01", labels: ["le1", "le2", "nada"], order: 0, created: "2026-01-02",
    check: [{ id: "k1", t: " uno ", d: true }, { id: "k2", t: "  " }, { id: "k3", t: "tres" }] }],
  ["PUT", "tarjetas/c2", { list: "l2", title: "Dos", prio: "alta", archived: "2026-01-03" }],
  ["PUT", "tarjetas/c3", { list: "l3", title: "Tres", prio: "baja" }],
  ["PUT", "tarjetas/c4", { list: "no-existe", title: "x", prio: "baja" }],
  ["PUT", "tarjetas/c4", { list: "l1", title: "x", prio: "nada" }],
  ["PUT", "tarjetas/c4", { list: "l1", title: "x", prio: "baja", due: "pronto" }],
  ["PUT", "tarjetas/c4", { list: "l1", title: "x", prio: "baja", check: [{ id: "mal id", t: "x" }] }],
  ["PUT", "tarjetas/c4", { list: "l1", title: "x", prio: "baja", check: ["x"] }],
  ["PUT", "tarjetas/c1", { list: "l2", title: "Tarjeta movida", prio: "media", labels: ["le1"], order: 5, created: "cambiada" }],
  ["DELETE", "etiquetas-tablero/le1"],
  ["PUT", "listas/l5", { board: "b2", title: "Para borrar", order: 9 }],
  ["PUT", "tarjetas/c5", { list: "l5", title: "Se va con su lista", prio: "baja" }],
  ["DELETE", "listas/l5"],
  ["PUT", "tableros/b9", { name: "Para borrar", color: C }],
  ["PUT", "listas/l9", { board: "b9", title: "x" }],
  ["PUT", "tarjetas/c9", { list: "l9", title: "x", prio: "baja" }],
  ["PUT", "etiquetas-tablero/le9", { board: "b9", name: "x", color: C }],
  ["DELETE", "tableros/b9"],
  ["PUT", "mapas/m1", { title: " Mapa ", color: C, fav: true, order: 1, notes: "libreta ![](imagen:i1)", created: "2026-01-01" }],
  ["PUT", "mapas/m2", { title: "Otro", color: C }],
  ["PUT", "mapas/m3", { title: "", color: C }],
  ["PUT", "nodos/n1", { map: "m1", title: " Raíz ", x: 10.5, y: -3, notes: "n", created: "2026-01-01" }],
  ["PUT", "nodos/n2", { map: "m1", title: "Otro", color: C, x: "", y: null }],
  ["PUT", "nodos/n3", { map: "m1", parent: "n1", title: "Hijo" }],
  ["PUT", "nodos/n4", { map: "m1", parent: "n1", title: "Hija" }],
  ["PUT", "nodos/n5", { map: "m1", parent: "n3", title: "Nieto" }],
  ["PUT", "nodos/n6", { map: "m2", parent: "n1", title: "x" }],
  ["PUT", "nodos/n6", { map: "m1", parent: "n6", title: "x" }],
  ["PUT", "nodos/n6", { map: "no-existe", title: "x" }],
  ["PUT", "nodos/n6", { map: "m1", title: "x", x: 1e9 }],
  ["PUT", "nodos/n6", { map: "m1", title: "x", color: "azul" }],
  ["PUT", "conexiones/x1", { a: "n1", b: "n2" }],
  ["PUT", "conexiones/x2", { a: "n3", b: "n4" }],
  ["PUT", "conexiones/x3", { a: "n1", b: "n3" }],
  ["PUT", "conexiones/x3", { a: "n1", b: "n1" }],
  ["PUT", "conexiones/x3", { a: "n1", b: "no-existe" }],
  ["PUT", "nodos/n7", { map: "m2", title: "En m2" }],
  ["PUT", "nodos/n8", { map: "m2", title: "En m2 también" }],
  ["PUT", "conexiones/x4", { a: "n7", b: "n8" }],
  ["DELETE", "nodos/n3"],
  ["DELETE", "conexiones/x1"],
  ["DELETE", "mapas/m2"],
  ["PUT", "adjuntos/i1", { tipo: "image/png", ancho: 1, alto: 1, datos: PNG_1X1 }],
  ["PUT", "adjuntos/i2", { tipo: "image/jpeg", ancho: 1, alto: 1, datos: PNG_1X1 }],
  ["PUT", "adjuntos/i2", { tipo: "image/bmp", ancho: 1, alto: 1, datos: PNG_1X1 }],
  ["PUT", "adjuntos/i2", { tipo: "image/png", ancho: 0, alto: 1, datos: PNG_1X1 }],
  ["PUT", "adjuntos/i2", { tipo: "image/png", ancho: 1, alto: 1, datos: "" }],
  ["PUT", "ruta-rara/1", {}],
  ["DELETE", "notas/2026-01-05"],
];

async function resultado(f) { try { return { ok: await f() }; } catch (e) { return { error: e.message }; } }

test("servidor-local.js responde igual que servidor.py", async () => {
  // Sin imágenes del día: así la página no apunta nada en el historial mientras se compara
  const app = await servirApp({ extra: { "assets/images/lista.json": "[]" } }), clasico = await servidorClasico(), nav = await chromium.launch();
  try {
    const pagina = await nav.newPage();
    await pagina.goto(app.url);
    await pagina.waitForFunction(() => document.getElementById("status").textContent.includes("Guardado"));
    // Se parte de lo mismo en los dos: la base de datos tal como la deja la página al abrirse por primera vez
    const inicial = await apiLocal(pagina, "GET", "estado");
    assert.equal(inicial.vacia, false, "la página debe sembrar los datos iniciales");
    await clasico.api("POST", "importar", inicial);

    for (const [m, r, c] of OPERACIONES) {
      const py = await resultado(() => clasico.api(m, r, c));
      const js = await resultado(() => apiLocal(pagina, m, r, c));
      assert.deepEqual(js, py, `${m} ${r} ${JSON.stringify(c)}`);
    }
    const estadoPy = await clasico.api("GET", "estado"), estadoJs = await apiLocal(pagina, "GET", "estado");
    assert.deepEqual(estadoJs, estadoPy);
    assert.ok(estadoJs.cards.c1 && estadoJs.mnodes.n4 && !estadoJs.mnodes.n5 && !estadoJs.cards.c5, "los datos de la prueba están (y las cascadas se aplican)");
    assert.deepEqual(await apiLocal(pagina, "GET", "adjuntos-copia"), await clasico.api("GET", "adjuntos-copia"));

    // «apagar» y «ping» ya no hacen nada
    assert.deepEqual(await apiLocal(pagina, "POST", "apagar", {}), { ok: true });
    assert.deepEqual(await apiLocal(pagina, "GET", "ping"), await clasico.api("GET", "ping"));

    // La copia que exporta la versión de Python (estado + imágenes) se importa tal cual en un navegador limpio
    const copia = { ...estadoPy, adjuntos: await clasico.api("GET", "adjuntos-copia") };
    const otro = await nav.newContext(), p2 = await otro.newPage();
    await p2.goto(app.url);
    await p2.waitForFunction(() => document.getElementById("status").textContent.includes("Guardado"));
    assert.deepEqual(await apiLocal(p2, "POST", "importar", copia), { ok: true });
    assert.deepEqual(await apiLocal(p2, "GET", "estado"), estadoPy);
    assert.deepEqual(await apiLocal(p2, "GET", "adjuntos-copia"), copia.adjuntos);
    // Una copia no válida no cambia nada
    const mala = await resultado(() => apiLocal(p2, "POST", "importar", { ...copia, tasks: { t1: { title: "sin fecha" } } }));
    assert.deepEqual(mala, { error: "fecha de la tarea no válida" });
    assert.deepEqual(await apiLocal(p2, "GET", "estado"), estadoPy);
    // Y los datos siguen ahí al volver a abrir
    await p2.reload();
    await p2.waitForFunction(() => document.getElementById("status").textContent.includes("Guardado"));
    assert.deepEqual(await apiLocal(p2, "GET", "estado"), estadoPy);
  } finally { await nav.close(); clasico.cerrar(); await app.cerrar(); }
});

// Las reflexiones y notas de cada día se pueden consultar todas juntas (con la frase de ese día), buscar y abrir.
// Y la lista de frases tiene identificadores únicos (son lo que guarda el historial).
import test from "node:test";
import assert from "node:assert/strict";
import { servirApp, chromium, abrirConDatos, apiLocal, paginaLista } from "./util.mjs";

const dia = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };

test("frases: más de cien, sin identificadores repetidos y con autor y obra", async () => {
  const app = await servirApp(), nav = await chromium.launch();
  try {
    const { pagina: p } = await abrirConDatos(nav, app);
    const q = await p.evaluate(() => QUOTES);
    assert.ok(q.length >= 130);
    assert.equal(new Set(q.map(x => x[3])).size, q.length, "ids únicos");
    assert.ok(q.every(x => x.length === 4 && x.every(v => typeof v === "string" && v.trim()) && /^f\d+$/.test(x[3])));
    // Las de siempre conservan su id (el historial de días pasados las encuentra)
    assert.deepEqual(q.find(x => x[3] === "f01").slice(0, 2), ["Lo que impide la acción hace avanzar la acción. Lo que se interpone en el camino se convierte en el camino.", "Marco Aurelio"]);
  } finally { await nav.close(); await app.cerrar(); }
});

test("diario: todas las reflexiones y notas, con su frase, búsqueda e ir al día", async () => {
  const app = await servirApp(), nav = await chromium.launch();
  try {
    const { pagina: p } = await abrirConDatos(nav, app, { viewport: { width: 1000, height: 800 } });
    const errores = []; p.on("pageerror", e => errores.push(String(e)));
    await apiLocal(p, "PUT", "historial/" + dia(2), { q: "f13" });
    await apiLocal(p, "PUT", "notas/" + dia(2), { r: "Me costó, pero <b>fui</b> a escalar.", n: "Vía nueva: 6a" });
    await apiLocal(p, "PUT", "notas/" + dia(5), { r: "", n: "Comprar magnesio" });
    await apiLocal(p, "PUT", "notas/" + dia(9), { r: "Semana tranquila.", n: "" });
    await p.reload(); await paginaLista(p);

    await p.click("#qmark"); await p.click("#np-todas");
    await p.locator("#diariodlg[open]").waitFor();
    assert.match(await p.locator(".di-resumen").innerText(), /^3 días con algo escrito\./);
    assert.equal(await p.locator(".di-dia").count(), 3);
    // Del más reciente al más antiguo, con la frase de ese día
    const primero = p.locator(".di-dia").first();
    assert.match(await primero.locator(".di-frase").innerText(), /No dejamos de atrevernos[\s\S]*Séneca/);
    assert.equal(await primero.locator(".di-texto p").first().innerText(), "Me costó, pero <b>fui</b> a escalar.", "el texto se muestra tal cual, sin interpretar HTML");
    assert.equal(await p.locator(".di-dia b").count(), 0);
    // Filtros y búsqueda (sin acentos ni mayúsculas, también en la frase)
    await p.click('.di-ver [data-ver="n"]'); assert.equal(await p.locator(".di-dia").count(), 2);
    await p.click('.di-ver [data-ver="r"]'); assert.equal(await p.locator(".di-dia").count(), 2);
    await p.click('.di-ver [data-ver="todo"]');
    await p.fill(".di-q", "MAGNESIO"); assert.equal(await p.locator(".di-dia").count(), 1);
    await p.fill(".di-q", "seneca"); assert.equal(await p.locator(".di-dia").count(), 1);
    await p.fill(".di-q", "nada de esto"); assert.match(await p.locator(".di-vacio").innerText(), /Nada coincide/);
    await p.fill(".di-q", "");
    // Ir a un día: se cierra el diario, se va a ese día y se abre su bloc para seguir escribiendo
    await p.locator(".di-dia").nth(2).locator("[data-ir-dia]").click();
    assert.equal(await p.evaluate(() => key(sel)), dia(9));
    assert.ok(await p.locator("#notepad").isVisible() && !(await p.locator("#diariodlg").isVisible()));
    assert.equal(await p.inputValue("#np-r"), "Semana tranquila.");
    assert.deepEqual(errores, []);
  } finally { await nav.close(); await app.cerrar(); }
});

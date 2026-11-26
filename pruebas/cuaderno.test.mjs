// Libretas de los nodos en modo «texto» (con barra de herramientas) y en modo «MD»: lo que se escribe con formato se
// guarda como el mismo Markdown, se puede pasar de un modo a otro sin perder nada y los nodos nuevos empiezan en texto.
import test from "node:test";
import assert from "node:assert/strict";
import { servirApp, chromium, devices, abrirConDatos, esperar } from "./util.mjs";

const abrirMapa = async p => {
  await p.evaluate(() => { showBoards(); setMap("m1"); });
  await p.locator("#mv-graph canvas").waitFor(); await p.waitForTimeout(300);
};
const notas = (p, id) => p.evaluate(i => state.mnodes[i].notes, id);
const guardado = (p, id, esperado) => esperar(p, ([i, t]) => state.mnodes[i].notes === t, [id, esperado], { que: "lo escrito se guarda" });

test("modo texto: escribir con la barra, el teclado y los atajos; se guarda como Markdown", async () => {
  const app = await servirApp(), nav = await chromium.launch();
  try {
    const { pagina: p } = await abrirConDatos(nav, app, { viewport: { width: 1280, height: 860 } });
    const errores = []; p.on("pageerror", e => errores.push(String(e)));
    await abrirMapa(p);
    // Un nodo existente sigue en Markdown; uno nuevo empieza en texto
    const viejo = await p.evaluate(() => Object.keys(state.mnodes).find(i => state.mnodes[i].map === "m1"));
    assert.equal(await p.evaluate(i => state.mnodes[i].mode, viejo), "");
    await p.evaluate(() => createNode(0, 0));
    await p.keyboard.type("Compras"); await p.keyboard.press("Escape");
    const id = await p.evaluate(() => mSel);
    assert.equal(await p.evaluate(i => state.mnodes[i].mode, id), "texto");
    assert.equal(await p.getAttribute('[data-nmodo="texto"]', "aria-checked"), "true");
    assert.equal(await p.locator(".rc-barra [data-rc]").count(), 12, "título, subtítulo, B I U S, checklist, viñetas, numerada, cita, enlace y separador");

    const k = p.keyboard;
    await p.click("#mn-text");
    await k.type("# Semana"); await k.press("Enter");                                    // atajo de título
    await k.type("[] pan"); await k.press("Enter"); await k.type("leche"); await k.press("Enter");
    await k.press("Enter");                                                             // Intro en vacío: sale de la lista
    await k.type("Hay "); await k.press("Control+b"); await k.type("negrita"); await k.press("Control+b");
    await k.type(", "); await p.click('[data-rc="u"]'); await k.type("subrayado"); await p.click('[data-rc="u"]');
    await k.type(", "); await p.click('[data-rc="i"]'); await k.type("cursiva"); await p.click('[data-rc="i"]');
    await k.type(" y "); await p.click('[data-rc="s"]'); await k.type("tachado"); await p.click('[data-rc="s"]');
    await k.type(" con 2*3 y a_b."); await k.press("Enter");
    await k.type("- uno"); await k.press("Enter"); await k.press("Tab"); await k.type("dos"); await k.press("Enter");
    await k.press("Shift+Tab"); await k.type("tres"); await k.press("Enter"); await k.press("Enter");
    await k.type("1. a"); await k.press("Enter"); await k.type("b"); await k.press("Enter"); await k.press("Backspace");  // Retroceso quita el formato
    await k.type("> pensar"); await k.press("Enter"); await k.press("Enter");
    await k.type("---"); await k.press("Enter");
    await k.type("Plan"); await p.click('[data-rc="h2"]');                              // subtítulo con la barra
    await k.press("End"); await k.press("Enter");
    await p.click('[data-rc="ck"]'); await k.type("hecho");
    const esperado = "# Semana\n- [ ] pan\n- [ ] leche\nHay **negrita**, ++subrayado++, *cursiva* y ~~tachado~~ con 2\\*3 y a_b.\n"
      + "- uno\n  - dos\n- tres\n1. a\n2. b\n> pensar\n---\n## Plan\n- [ ] hecho";
    await guardado(p, id, esperado);
    // La barra marca dónde está el cursor
    assert.equal(await p.getAttribute('[data-rc="ck"]', "aria-pressed"), "true");
    assert.equal(await p.getAttribute('[data-rc="b"]', "aria-pressed"), "false");
    // Marcar una casilla
    await p.locator("#mn-text .rc-caja").first().click();
    await esperar(p, i => state.mnodes[i].notes.split("\n")[1] === "- [x] pan", id);
    // Retroceso al principio de un párrafo lo une con el anterior
    await p.evaluate(() => { const b = [...document.querySelectorAll("#mn-text > div")].find(x => x.textContent === "tres"); const r = document.createRange(); r.setStart(b.firstChild, 0); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r); });
    await k.press("Backspace"); await k.press("Backspace");
    await esperar(p, i => state.mnodes[i].notes.includes("  - dostres"), id, { que: "se une con el de arriba" });

    // ---- Enlace: seleccionar una palabra y ponerle dirección (sin «https://» se añade)
    await p.evaluate(() => { const b = [...document.querySelectorAll("#mn-text > div")].find(x => x.textContent.startsWith("Hay ")); const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT); let t; while ((t = w.nextNode()) && !t.textContent.startsWith("Hay")); const r = document.createRange(); r.setStart(t, 0); r.setEnd(t, 3); getSelection().removeAllRanges(); getSelection().addRange(r); });
    await k.press("Control+k");
    await p.locator(".rc-enlace input").fill("ejemplo.com"); await p.keyboard.press("Enter");
    await esperar(p, i => state.mnodes[i].notes.includes("[Hay](https://ejemplo.com) **negrita**"), id, { que: "el enlace se guarda" });
    assert.ok(await p.locator(".rc-enlace").isHidden());

    // ---- Pegar varias líneas: se entiende su Markdown
    await p.evaluate(() => { const ed = document.getElementById("mn-text"); const b = ed.lastElementChild; const r = document.createRange(); r.selectNodeContents(b); r.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(r); });
    await p.evaluate(() => { const dt = new DataTransfer(); dt.setData("text/plain", " ya\n- [ ] otra\n## Fin"); document.getElementById("mn-text").dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })); });
    await esperar(p, i => state.mnodes[i].notes.endsWith("- [ ] hecho ya\n- [ ] otra\n## Fin"), id, { que: "lo pegado se convierte en bloques" });

    // ---- Pasar a MD y volver: el mismo contenido
    const md = await notas(p, id);
    await p.click('[data-nmodo=""]');
    assert.equal(await p.evaluate(i => state.mnodes[i].mode, id), "");
    assert.equal(await p.locator(".rc-barra").count(), 0);
    assert.ok(await p.locator("#mn-md .mn-ck").count() >= 2, "en MD se ve la checklist");
    assert.equal(await p.locator("#mn-md u").first().innerText(), "subrayado", "el subrayado también se ve en MD");
    await p.click('[data-nmodo="texto"]');
    assert.equal(await p.evaluate(() => AscensoTexto.fuente(document.getElementById("mn-text"))), md);
    // Se guarda en el dispositivo con su modo
    await esperar(p, i => window.AscensoLocal.api("GET", "estado").then(e => e.mnodes[i] && e.mnodes[i].mode === "texto"), id, { que: "el modo se guarda" });
    assert.deepEqual(errores, []);
  } finally { await nav.close(); await app.cerrar(); }
});

test("modo texto: lo que no tiene formato propio (código, tablas, fórmulas, imágenes) se conserva tal cual", async () => {
  const app = await servirApp(), nav = await chromium.launch();
  try {
    const { pagina: p } = await abrirConDatos(nav, app, { viewport: { width: 1280, height: 860 } });
    await abrirMapa(p);
    const md = ["# Notas", "Un **dato** con `código`, $x^2$ y [web](https://a.es).", "```js", "const a = 1; // *no* es cursiva", "```",
      "| a | b |", "|---|---|", "| 1 | 2 |", "$$", "E = mc^2", "$$", "![](imagen:i1)", "", "\\# no es título", "1\\. no es lista", "### Tercero",
      "- [x] hecha", "  1. dentro", "Texto_con_guiones y ++sub++ y ~~tachado~~"].join("\n");
    const salida = await p.evaluate(m => { const el = document.createElement("div"); AscensoTexto.pintar(el, m); return AscensoTexto.fuente(el); }, md);
    assert.equal(salida, md, "ida y vuelta sin cambios");
    const tipos = await p.evaluate(m => { const el = document.createElement("div"); AscensoTexto.pintar(el, m); return [...el.children].map(b => b.dataset.t || (b.classList.contains("ln-img") ? "img" : "?")); }, md);
    assert.deepEqual(tipos.slice(0, 13), ["h1", "p", "raw", "raw", "raw", "raw", "raw", "raw", "raw", "raw", "raw", "img", "p"]);
    // Un texto que empieza como Markdown se escapa al guardarlo, y en MD se lee igual
    const esc = await p.evaluate(() => { const el = document.createElement("div"); AscensoTexto.pintar(el, ""); el.firstChild.textContent = "# hola - *a*"; return AscensoTexto.fuente(el); });
    assert.equal(esc, "\\# hola - \\*a\\*");
    assert.equal(await p.evaluate(t => { const d = document.createElement("div"); d.innerHTML = mdRender(t); return d.textContent; }, esc), "# hola - *a*");
  } finally { await nav.close(); await app.cerrar(); }
});

test("modo texto en el móvil: la barra cabe y se usa con el dedo", async () => {
  const app = await servirApp(), nav = await chromium.launch();
  try {
    const { defaultBrowserType, ...perfil } = devices["Pixel 7"];
    const { pagina: p } = await abrirConDatos(nav, app, perfil);
    const errores = []; p.on("pageerror", e => errores.push(String(e)));
    await abrirMapa(p);
    await p.evaluate(() => createNode(0, 0)); await p.keyboard.press("Escape");
    const id = await p.evaluate(() => mSel);
    await p.evaluate(() => { const n = document.getElementById("mv-note"); if (n) n.scrollIntoView(); });
    const barra = await p.locator(".rc-barra").boundingBox(), vista = p.viewportSize();
    assert.ok(barra && barra.x >= 0 && barra.x + barra.width <= vista.width + 1, "la barra no desborda la pantalla");
    const b = await p.locator('.rc-barra [data-rc="ck"]').boundingBox();
    assert.ok(b.width >= 34 && b.height >= 34, "botones para el dedo");
    await p.tap("#mn-text"); await p.tap('.rc-barra [data-rc="ck"]'); await p.keyboard.type("tocar");
    // Intro desde el teclado del móvil llega como «insertParagraph»
    await p.keyboard.press("Enter"); await p.keyboard.type("otra");
    await guardado(p, id, "- [ ] tocar\n- [ ] otra");
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
    assert.deepEqual(errores, []);
  } finally { await nav.close(); await app.cerrar(); }
});

test("diagramas Mermaid: se dibujan aunque la libreta se recoloque, y un error se avisa en su sitio", async () => {
  const app = await servirApp(), nav = await chromium.launch();
  try {
    const { pagina: p } = await abrirConDatos(nav, app, { viewport: { width: 1280, height: 860 } });
    const errores = []; p.on("pageerror", e => errores.push(String(e)));
    await p.evaluate(() => {
      showBoards(); setMap("m1");
      state.maps.m1.mode = "";
      state.maps.m1.notes = "## Diagramas\n```mermaid\ngraph TD\n  A[Inicio] --> B{¿Bien?}\n```\n```mermaid\ngraph LR\n  X --> Y\n```\n```mermaid\ngraph TD\n  A --> B((\n  mal ]]\n```\nFin.";
      renderBoards();
      // La libreta se recoloca varias veces seguidas (como al abrirse o al girar el móvil)
      for (let i = 0; i < 4; i++) npLayout(true);
    });
    await esperar(p, () => document.querySelectorAll(".mn-mermaid[data-ok='1']").length === 3, null, { limite: 15000, que: "los diagramas terminan" });
    assert.equal(await p.locator(".mn-mermaid svg").count(), 2, "los dos diagramas buenos se dibujan");
    assert.match(await p.locator(".mn-merr").innerText(), /error en la línea 3/);
    assert.equal(await p.evaluate(() => [...document.body.children].filter(x => /mmd/.test(x.id)).length), 0, "nada de avisos de Mermaid sueltos en la página");
    assert.deepEqual(errores, []);
  } finally { await nav.close(); await app.cerrar(); }
});

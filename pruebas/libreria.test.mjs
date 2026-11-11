// La librería: se entra por el nombre del autor de la frase, se añaden un EPUB y un PDF, se leen, se subraya,
// se recuerda por dónde se iba y todo ello llega a otro dispositivo con la misma cuenta.
import test from "node:test";
import assert from "node:assert/strict";
import { servirApp, chromium, devices, abrirConDatos, apiLocal, esperar, paginaLista, servirAppConCuenta, panel, crearCuenta, escribirAcceso, entrarPorPrimeraVez, cerrarPanel, alDia } from "./util.mjs";
import { simuladorSupabase } from "./simulador-supabase.mjs";
import { epubDeEjemplo, pdfDeEjemplo } from "./libros.mjs";

const EPUB = { name: "meditaciones.epub", mimeType: "application/epub+zip", buffer: epubDeEjemplo() };
const PDF = { name: "manual.pdf", mimeType: "application/pdf", buffer: pdfDeEjemplo() };
const libreria = p => apiLocal(p, "GET", "libreria");
const libro = (p, titulo) => p.locator(".lb-libro", { hasText: titulo });
const abrirLibreria = async p => { await p.click("#quote .q-autor"); await p.locator("#libreria:not([hidden])").waitFor(); };
const anadir = async (p, archivos, n) => { await p.setInputFiles("#lb-cuerpo input.lb-archivo", archivos); await esperar(p, k => document.querySelectorAll(".lb-libro").length === k && !document.querySelector(".lb-nuevo[aria-disabled]"), n, { limite: 20000, que: "los libros aparecen en la estantería" }); };
const abrirLibro = async (p, titulo) => { await libro(p, titulo).locator(".lb-abrir").click(); await esperar(p, () => !document.getElementById("lector").hidden && document.getElementById("lc-cargando").hidden, null, { limite: 20000, que: "el libro se abre" }); };
const donde = p => p.evaluate(() => { const d = document.getElementById("lc-donde"), i = d.querySelector("input"); return i ? "Página " + i.value : d.textContent; });
// Selecciona un trozo de texto dentro de un elemento, como haría el ratón o el dedo
const seleccionar = (p, selector, desde, hasta) => p.evaluate(([s, a, b]) => {
  const el = document.querySelector(s), w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), n = w.nextNode(), r = document.createRange();
  r.setStart(n, a); r.setEnd(n, b); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); return r.toString();
}, [selector, desde, hasta]);

test("librería: añadir, leer, subrayar y recordar por dónde se iba (EPUB y PDF)", async () => {
  const app = await servirApp(), nav = await chromium.launch();
  try {
    const { pagina: p } = await abrirConDatos(nav, app, { viewport: { width: 1100, height: 760 } });
    const errores = []; p.on("pageerror", e => errores.push(String(e)));
    p.on("console", m => { if (m.type() === "error") errores.push("consola: " + m.text()); });

    // ---- La puerta es el nombre del autor de la frase; nada más la delata
    assert.equal(await p.locator("#quote .q-autor").evaluate(e => getComputedStyle(e).cursor), "default");
    assert.ok(!(await p.locator("#barra").isVisible()), "en el ordenador no hay barra");
    await abrirLibreria(p);
    assert.ok(!(await p.locator("main").isVisible()), "la librería sustituye a la página del día");

    // ---- Añadir un EPUB y un PDF: título, autor y portada salen del propio archivo
    await anadir(p, [EPUB, PDF], 2);
    let d = await libreria(p);
    const [idE, epub] = Object.entries(d.libros).find(([, l]) => l.formato === "epub"), [idP, pdf] = Object.entries(d.libros).find(([, l]) => l.formato === "pdf");
    assert.deepEqual([epub.titulo, epub.autor, epub.bytes], ["Meditaciones de prueba", "Marco Aurelio", EPUB.buffer.length]);
    assert.deepEqual([pdf.titulo, pdf.autor], ["Manual de prueba", "Epicteto"]);
    assert.match(epub.portada, /^data:image\/jpeg;base64,/); assert.match(pdf.portada, /^data:image\/jpeg;base64,/);
    assert.ok(d.archivos[epub.archivo].aqui && d.archivos[pdf.archivo].aqui, "los archivos están en este dispositivo");
    // Lo que no es un libro se rechaza con un mensaje, y el mismo libro no entra dos veces
    await p.setInputFiles("#lb-cuerpo input.lb-archivo", [{ name: "falso.pdf", mimeType: "application/pdf", buffer: Buffer.from("esto no es un pdf") }, EPUB, { name: "nota.txt", mimeType: "text/plain", buffer: Buffer.from("hola") }]);
    await p.locator('.lb-aviso[data-nivel="error"]').waitFor();
    const aviso = await p.locator(".lb-aviso").innerText();
    assert.match(aviso, /falso\.pdf/); assert.match(aviso, /ya está en la librería/); assert.match(aviso, /solo se admiten EPUB y PDF/);
    assert.equal(await p.locator(".lb-libro").count(), 2);

    // ---- EPUB: el contenido del libro llega limpio (ni scripts, ni estilos, ni formularios, ni enlaces con trampa)
    await abrirLibro(p, "Meditaciones");
    assert.equal(await p.evaluate(() => window.PIRATEADO), undefined, "ningún script del libro se ejecuta");
    assert.equal(await p.locator("#lc-texto").locator("script, style, iframe, form, input, [style], [onclick], [onerror]").count(), 0);
    assert.equal(await p.locator('#lc-texto a[href^="javascript"]').count(), 0);
    assert.equal(await p.locator('#lc-texto a[href="https://example.com/"]').getAttribute("rel"), "noopener noreferrer");
    assert.match(await p.locator("#lc-texto img").getAttribute("src"), /^blob:/, "la imagen sale del propio libro");
    assert.equal(await p.locator("#lc-texto h1").innerText(), "Libro primero");
    assert.match(await donde(p), /Capítulo 1 de 3/);
    // Un enlace interno lleva a su sitio en otro capítulo; el índice, también
    await p.locator("#lc-texto a", { hasText: "Ir al final del segundo" }).click();
    await esperar(p, () => /Capítulo 2 de 3/.test(document.getElementById("lc-donde").textContent), null, { que: "el enlace lleva al capítulo 2" });
    assert.ok(await p.evaluate(() => { const r = document.querySelector('#lc-texto [data-ancla="final"]').getBoundingClientRect(); return r.top > 40 && r.top < 200; }), "y deja a la vista el párrafo enlazado");
    await p.click('#lector [data-l="indice"]');
    assert.deepEqual(await p.locator(".lc-indice button").allInnerTexts(), ["Libro primero", "Libro segundo", "El final del segundo", "Libro tercero"]);
    assert.equal(await p.locator('.lc-indice [aria-current="true"]').innerText(), "El final del segundo");
    await p.locator(".lc-indice button", { hasText: "Libro tercero" }).click();
    await esperar(p, () => /Capítulo 3 de 3/.test(document.getElementById("lc-donde").textContent), null, { que: "el índice lleva al capítulo 3" });
    await p.click("#lc-ant");
    await esperar(p, () => /Capítulo 2 de 3/.test(document.getElementById("lc-donde").textContent), null, { que: "la flecha vuelve al capítulo 2" });

    // ---- Subrayar: seleccionar texto, elegir color y, después, ponerle una nota
    const elegido = await seleccionar(p, "#lc-texto p:nth-of-type(3)", 0, 23);
    await p.locator("#lc-sel:not([hidden])").waitFor();
    await p.click('#lc-sel [data-color="verde"]');
    await p.locator('#lc-texto mark.lc-marca[data-color="verde"]').waitFor();
    assert.equal(await p.locator("#lc-texto mark.lc-marca").innerText(), elegido);
    await p.locator("#lc-texto mark.lc-marca").click();
    await p.fill("#lc-panel textarea", "Para releer cada mañana");
    await p.click('#lc-panel [data-mcolor="rosa"]');
    await p.click('#lc-panel [data-p="cerrar"]');
    await esperar(p, () => window.AscensoLocal.api("GET", "libreria").then(x => Object.values(x.subrayados).some(s => s.nota === "Para releer cada mañana" && s.color === "rosa")), null, { que: "la nota se guarda" });
    const sub = Object.values((await libreria(p)).subrayados)[0];
    assert.deepEqual([sub.libro, sub.lugar, sub.texto, sub.fin - sub.ini], [idE, 1, elegido, elegido.length]);
    // Otro, directamente con nota
    await seleccionar(p, "#lc-texto p:nth-of-type(10)", 8, 20);
    await p.locator("#lc-sel:not([hidden])").waitFor();
    await p.click('#lc-sel [data-color="nota"]');
    await p.fill("#lc-panel textarea", "Segunda nota"); await p.click('#lc-panel [data-p="cerrar"]');
    await p.click('#lector [data-l="notas"]');
    assert.equal(await p.locator(".lc-notas li").count(), 2);
    assert.match(await p.locator(".lc-notas li").first().innerText(), /Libro segundo[\s\S]*Para releer cada mañana/);

    // ---- Ajustes de lectura: letra más grande y tema sepia (son del dispositivo)
    await p.click('#lector [data-l="ajustes"]');
    const letra = () => p.locator("#lc-texto").evaluate(e => parseFloat(getComputedStyle(e).fontSize));
    const antes = await letra();
    await p.click('#lc-panel [data-aj="tam"][data-v="10"]'); await p.click('#lc-panel [data-aj="tam"][data-v="10"]');
    assert.ok(await letra() > antes * 1.15, "la letra crece");
    await p.click('#lc-panel [data-aj="tema"][data-v="sepia"]');
    assert.equal(await p.locator("#lector").evaluate(e => getComputedStyle(e).backgroundColor), "rgb(243, 233, 210)");
    await p.keyboard.press("Escape");

    // ---- Se recuerda por dónde se iba: capítulo, altura y porcentaje, también tras recargar
    await p.evaluate(() => { const a = document.getElementById("lc-area"); a.scrollTop = (a.scrollHeight - a.clientHeight) * 0.5; });
    await esperar(p, id => window.AscensoLocal.api("GET", "libreria").then(x => x.lecturas[id] && x.lecturas[id].lugar === 1 && Math.abs(x.lecturas[id].frac - 0.5) < 0.02), idE, { que: "se guarda la posición" });
    await p.keyboard.press("Escape");
    await p.locator("#lector").waitFor({ state: "hidden" });
    assert.match(await libro(p, "Meditaciones").locator(".lb-estado").innerText(), /^\d+ % leído$/);
    await p.reload(); await paginaLista(p); await abrirLibreria(p);
    await abrirLibro(p, "Meditaciones");
    assert.match(await donde(p), /Capítulo 2 de 3/);
    assert.ok(Math.abs(await p.evaluate(() => { const a = document.getElementById("lc-area"); return a.scrollTop / (a.scrollHeight - a.clientHeight); }) - 0.5) < 0.05, "vuelve a la misma altura");
    assert.equal(await p.locator("#lc-texto mark.lc-marca").count(), 2, "los subrayados siguen ahí");
    assert.equal(await p.locator("#lector").getAttribute("data-tema"), "sepia");
    // Desde la lista de notas se salta al pasaje; y un subrayado se puede quitar
    await p.click('#lector [data-l="notas"]');
    await p.locator(".lc-n-ed").nth(1).click(); await p.click('#lc-panel [data-p="quitar"]');
    await esperar(p, () => document.querySelectorAll("#lc-texto mark.lc-marca").length === 1, null, { que: "el subrayado desaparece del texto" });
    await esperar(p, () => window.AscensoLocal.api("GET", "libreria").then(x => Object.keys(x.subrayados).length === 1), null, { que: "y de los datos" });
    await p.keyboard.press("Escape");
    await p.locator("#lector").waitFor({ state: "hidden" });

    // ---- PDF: se dibuja, se navega por páginas, se subraya sobre su capa de texto y se recuerda la página
    await abrirLibro(p, "Manual");
    await p.locator('.lc-hoja[data-hoja="0"] canvas').waitFor();
    assert.equal(await p.locator(".lc-hoja").count(), 3);
    assert.ok(await p.locator('.lc-hoja[data-hoja="0"] canvas').evaluate(c => { const d = c.getContext("2d").getImageData(0, 0, c.width, Math.floor(c.height / 4)).data; for (let i = 0; i < d.length; i += 4) if (d[i] < 100) return true; return false; }), "la página tiene tinta");
    await p.fill("#lc-pag", "3"); await p.press("#lc-pag", "Enter");
    await p.locator('.lc-capa[data-pagina="2"] span').first().waitFor();
    assert.match(await donde(p), /Página 3/);
    // La capa de texto cae encima de lo dibujado: su primera línea empieza donde el texto de la página
    const caja = await p.evaluate(() => { const s = document.querySelector('.lc-capa[data-pagina="2"] span').getBoundingClientRect(), h = document.querySelector('.lc-hoja[data-hoja="2"]').getBoundingClientRect(); return [(s.left - h.left) / h.width, (s.top - h.top) / h.height]; });
    assert.ok(Math.abs(caja[0] - 72 / 612) < 0.01 && caja[1] > 0.05 && caja[1] < 0.1, "la capa de texto está alineada con la página: " + caja);
    const enPdf = await seleccionar(p, '.lc-capa[data-pagina="2"] span', 0, 8);
    assert.equal(enPdf, "Pagina 3");
    await p.locator("#lc-sel:not([hidden])").waitFor();
    await p.click('#lc-sel [data-color="azul"]');
    await p.locator('.lc-capa[data-pagina="2"] mark.lc-marca[data-color="azul"]').waitFor();
    await esperar(p, id => window.AscensoLocal.api("GET", "libreria").then(x => x.lecturas[id] && x.lecturas[id].lugar === 2), idP, { que: "se guarda la página" });
    await p.keyboard.press("Escape");
    await p.locator("#lector").waitFor({ state: "hidden" });
    await abrirLibro(p, "Manual");
    await p.locator('.lc-capa[data-pagina="2"] mark.lc-marca').waitFor();
    assert.match(await donde(p), /Página 3/);
    await p.keyboard.press("Escape");

    // ---- La copia de seguridad no toca la librería (ni la incluye): importar una copia deja los libros donde estaban
    const copia = await apiLocal(p, "GET", "estado");
    assert.ok(!JSON.stringify(copia).includes("Meditaciones de prueba"), "los libros no van en la copia");
    await apiLocal(p, "POST", "importar", copia);
    assert.equal(Object.keys((await libreria(p)).libros).length, 2);

    // ---- Ficha: cambiar el título y quitar el libro (con sus subrayados y su archivo)
    await libro(p, "Meditaciones").locator(".lb-mas").click();
    await p.fill('#lb-ficha input[name="titulo"]', "Meditaciones"); await p.click("#lb-ficha button[type=submit]");
    await esperar(p, id => window.AscensoLocal.api("GET", "libreria").then(x => x.libros[id].titulo === "Meditaciones"), idE, { que: "se guarda el título" });
    await libro(p, "Meditaciones").locator(".lb-mas").click();
    await p.click("#lb-ficha .lb-quitar");
    assert.match(await p.locator("#lb-ficha .lb-quitar").innerText(), /Sí, quitar el libro y sus subrayados/);
    await p.click("#lb-ficha .lb-quitar");
    await esperar(p, () => document.querySelectorAll(".lb-libro").length === 1, null, { que: "el libro desaparece" });
    d = await libreria(p);
    assert.deepEqual([Object.keys(d.libros), Object.values(d.subrayados).map(s => s.libro)], [[idP], [idP]]);
    assert.equal(await p.evaluate(a => window.AscensoLocal.leerArchivo(a).then(x => x === null), epub.archivo), true, "su archivo se borra del dispositivo");

    // ---- Volver al día
    await p.click("#lb-volver");
    assert.ok(await p.locator("main").isVisible() && !(await p.locator("#libreria").isVisible()));
    assert.deepEqual(errores, []);
  } finally { await nav.close(); await app.cerrar(); }
});

test("librería en el móvil: está en la barra, en lugar de Progreso, y «atrás» cierra paso a paso", async () => {
  const app = await servirApp(), nav = await chromium.launch();
  try {
    const { defaultBrowserType, ...perfil } = devices["Pixel 7"];
    const { pagina: p } = await abrirConDatos(nav, app, perfil);
    const errores = []; p.on("pageerror", e => errores.push(String(e)));
    const atras = async () => { await p.goBack(); await p.waitForTimeout(250); };
    assert.deepEqual(await p.locator("#barra button:visible").evaluateAll(bs => bs.map(b => b.dataset.ir)), ["hoy", "tareas", "tableros", "libreria", "cuenta"]);
    await p.tap('#barra [data-ir="libreria"]'); await p.locator("#libreria:not([hidden])").waitFor();
    assert.equal(await p.locator("#barra [aria-current=page]").getAttribute("data-ir"), "libreria");
    await anadir(p, [EPUB], 1);
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, "la estantería no desborda a lo ancho");
    await libro(p, "Meditaciones").locator(".lb-abrir").tap();
    await esperar(p, () => !document.getElementById("lector").hidden && document.getElementById("lc-cargando").hidden, null, { que: "el libro se abre" });
    assert.ok(!(await p.locator("#barra").isVisible()), "leyendo, la barra no estorba");
    assert.ok(await p.evaluate(() => [...document.querySelectorAll("#lector .lc-b")].every(b => b.getBoundingClientRect().width >= 44 && b.getBoundingClientRect().height >= 44)), "los botones del lector son para el dedo");
    await p.tap('#lector [data-l="ajustes"]'); await p.locator("#lc-panel:not([hidden])").waitFor();
    await atras(); assert.ok(!(await p.locator("#lc-panel").isVisible()) && await p.locator("#lector").isVisible(), "atrás cierra el panel");
    await atras(); assert.ok(!(await p.locator("#lector").isVisible()) && await p.locator("#libreria").isVisible(), "atrás cierra el libro");
    await atras(); assert.ok(await p.locator("main").isVisible() && !(await p.locator("#libreria").isVisible()), "atrás vuelve al día");
    // Desde la librería, la barra lleva a las demás secciones
    await p.tap('#barra [data-ir="libreria"]'); await p.locator("#libreria:not([hidden])").waitFor();
    await p.tap('#barra [data-ir="tableros"]');
    assert.ok(await p.locator("#boardsview").isVisible() && !(await p.locator("#libreria").isVisible()));
    assert.deepEqual(errores, []);
  } finally { await nav.close(); await app.cerrar(); }
});

test("librería con cuenta: el libro, la lectura y los subrayados llegan cifrados a otro dispositivo", async () => {
  const sim = await simuladorSupabase(), app = await servirAppConCuenta(sim), nav = await chromium.launch();
  const EMAIL = "lectora@ejemplo.com", CLAVE = "una contraseña bien larga";
  try {
    const abrir = async () => { const p = await (await nav.newContext({ viewport: { width: 1100, height: 760 } })).newPage(); await p.goto(app.url); await paginaLista(p); return p; };
    const A = await abrir();
    await crearCuenta(A, sim, EMAIL, CLAVE); await entrarPorPrimeraVez(A, EMAIL, CLAVE); await alDia(A); await cerrarPanel(A);
    await abrirLibreria(A); await anadir(A, [EPUB, PDF], 2);
    await abrirLibro(A, "Meditaciones");
    await A.click("#lc-sig");
    await esperar(A, () => /Capítulo 2 de 3/.test(document.getElementById("lc-donde").textContent), null, { que: "A pasa al capítulo 2" });
    await seleccionar(A, "#lc-texto p:nth-of-type(2)", 0, 10);
    await A.locator("#lc-sel:not([hidden])").waitFor(); await A.click('#lc-sel [data-color="amarillo"]');
    await A.locator("#lc-texto mark.lc-marca").waitFor();
    await A.keyboard.press("Escape"); await alDia(A);
    // En la cuenta no hay nada legible: ni el título ni el contenido del libro
    const todo = JSON.stringify(sim.bd.cambios) + [...sim.bd.archivos.values()].map(a => Buffer.from(a).toString("latin1")).join("");
    for (const secreto of ["Meditaciones de prueba", "Marco Aurelio", "Libro primero", "mimetype", "%PDF"]) assert.ok(!todo.includes(secreto), "«" + secreto + "» no viaja en claro");
    assert.equal(sim.bd.archivos.size, 2, "los dos archivos están en la cuenta");

    // B entra en la cuenta: ve la estantería y, al abrir un libro, lo descarga y sigue donde lo dejó A
    const B = await abrir();
    await escribirAcceso(B, EMAIL, CLAVE); await panel(B).locator(".c-quien").waitFor(); await alDia(B); await cerrarPanel(B);
    await abrirLibreria(B);
    await esperar(B, () => document.querySelectorAll(".lb-libro").length === 2, null, { que: "los libros llegan a B" });
    assert.match(await libro(B, "Meditaciones").locator(".lb-estado").innerText(), /Se descargará al abrirlo/);
    await abrirLibro(B, "Meditaciones");
    assert.match(await donde(B), /Capítulo 2 de 3/);
    assert.equal(await B.locator("#lc-texto mark.lc-marca").count(), 1);
    // Un subrayado hecho en B aparece en A, que tiene el libro abierto, sin recargar
    await abrirLibro(A, "Meditaciones");
    await seleccionar(B, "#lc-texto p:nth-of-type(5)", 0, 12);
    await B.locator("#lc-sel:not([hidden])").waitFor(); await B.click('#lc-sel [data-color="rosa"]');
    await esperar(A, () => !!document.querySelector('#lc-texto mark.lc-marca[data-color="rosa"]'), null, { limite: 15000, que: "el subrayado de B llega a A" });
    // Quitar el libro en A lo quita en B y borra su archivo de la cuenta
    await A.keyboard.press("Escape"); await B.keyboard.press("Escape");
    await libro(A, "Meditaciones").locator(".lb-mas").click(); await A.click("#lb-ficha .lb-quitar"); await A.click("#lb-ficha .lb-quitar");
    await esperar(B, () => document.querySelectorAll(".lb-libro").length === 1, null, { limite: 15000, que: "el libro desaparece de B" });
    await alDia(A);
    assert.equal(sim.bd.archivos.size, 1, "su archivo ya no está en la cuenta");
  } finally { await nav.close(); await app.cerrar(); await sim.cerrar(); }
});

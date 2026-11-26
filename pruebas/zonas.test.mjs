// Áreas de color en los mapas: crear, mover (con los nodos de dentro o sola), cambiar tamaño, forma y color,
// bloquear, poner título, buscar, borrar y deshacer. Con ratón y con el dedo.
import test from "node:test";
import assert from "node:assert/strict";
import { servirApp, chromium, devices, abrirConDatos, apiLocal, paginaLista, esperar, dedos } from "./util.mjs";

const abrirMapa = async p => {
  await p.evaluate(() => { showBoards(); setMap("m1"); });
  await p.locator("#mv-graph canvas").waitFor(); await p.waitForTimeout(300);
};
// Coordenadas en la página de un punto del mapa, y del centro del rótulo o de una esquina de un área
const enPagina = (p, wx, wy) => p.evaluate(([x, y]) => { const r = document.querySelector("#mv-graph canvas").getBoundingClientRect(), c = cam(); return [r.left + x * c.z + c.ox, r.top + y * c.z + c.oy]; }, [wx, wy]);
const rotulo = async (p, id) => { const b = await p.evaluate(i => MG.zCajas[i], id); return enPagina(p, (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2); };
const esquina = async (p, id, cual) => { const z = await p.evaluate(i => state.mzones[i], id); return enPagina(p, cual.includes("e") ? z.x + z.w : z.x, cual.includes("s") ? z.y + z.h : z.y); };
const zona = (p, id) => p.evaluate(i => state.mzones[i] && { ...state.mzones[i] }, id);
// Un punto del lienzo sin nodos, hilos ni áreas (en coordenadas de la página)
const vacio = p => p.evaluate(() => {
  const r = document.querySelector("#mv-graph canvas").getBoundingClientRect();
  for (let y = r.height - 30; y > 30; y -= 17) for (let x = 30; x < r.width - 30; x += 19) {
    if (!hitNode(x, y) && !hitLink(x, y) && !hitZona(x, y) && document.elementFromPoint(r.left + x, r.top + y) === document.querySelector("#mv-graph canvas")) return [r.left + x, r.top + y];
  }
  return null;
});
const nodo = (p, id) => p.evaluate(i => ({ x: state.mnodes[i].x, y: state.mnodes[i].y }), id);
const arrastrar = async (p, [x, y], dx, dy, { alt = false } = {}) => {
  if (alt) await p.keyboard.down("Alt");
  await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x + dx / 2, y + dy / 2, { steps: 4 }); await p.mouse.move(x + dx, y + dy, { steps: 4 }); await p.mouse.up();
  if (alt) await p.keyboard.up("Alt");
};
const crear = async (p, forma, titulo) => {
  await p.click('[data-mtool="area"]'); await p.locator(".mv-menu").getByRole("button", { name: forma, exact: true }).click();
  await p.locator(".mz-input").fill(titulo); await p.keyboard.press("Enter");
  return p.evaluate(() => mZona);
};

test("áreas de los mapas con ratón", async () => {
  const app = await servirApp(), nav = await chromium.launch();
  try {
    const { pagina: p } = await abrirConDatos(nav, app, { viewport: { width: 1200, height: 800 } });
    const errores = []; p.on("pageerror", e => errores.push(String(e)));
    await abrirMapa(p);
    const [dentro, fuera] = await p.evaluate(() => levelNodes("m1", null).map(([id]) => id).slice(0, 2));

    // ---- Crear: botón «+ Área», forma y título; color de la paleta propia de las áreas
    const id = await crear(p, "Rectángulo", "Terminados");
    let z = await zona(p, id);
    assert.deepEqual([z.title, z.shape, z.map, z.parent], ["Terminados", "rect", "m1", null]);
    assert.ok(await p.evaluate(c => Z_COLORS.some(([k]) => k === c) && !M_COLORS.includes(c), z.color), "color de la paleta de áreas, distinta de la de nodos");
    // Se coloca de modo que tenga dentro un nodo y no el otro
    await p.evaluate(([i, a, b]) => { const z = state.mzones[i], n = state.mnodes[a], o = state.mnodes[b];
      Object.assign(z, { x: n.x - 60, y: n.y - 60, w: 120 + 0, h: 120 }); if (zDentro(z, o.x, o.y)) { o.x = n.x + 400; o.y = n.y + 400; } save(); mgDraw(); }, [id, dentro, fuera]);
    assert.match(await p.evaluate(i => MG.zCajas[i].texto, id), /^Terminados · 1$/, "el rótulo cuenta los nodos de dentro");

    // ---- Panel del área seleccionada: título, forma y bloqueo, a la vista
    await p.locator(".mz-panel").waitFor();
    assert.equal(await p.inputValue(".mz-panel .mz-titulo"), "Terminados");
    await p.fill(".mz-panel .mz-titulo", "Terminados ya"); await p.press(".mz-panel .mz-titulo", "Enter");
    assert.equal((await zona(p, id)).title, "Terminados ya");
    await p.click('.mz-panel [data-zforma="ovalo"]'); assert.equal((await zona(p, id)).shape, "ovalo");
    await p.click('.mz-panel [data-zforma="rect"]'); assert.equal((await zona(p, id)).shape, "rect");
    await p.click('.mz-panel [data-zaccion="bloquear"]'); assert.equal((await zona(p, id)).locked, true);
    await p.click('.mz-panel [data-zaccion="bloquear"]'); assert.equal((await zona(p, id)).locked, false);
    await p.keyboard.press("Control+z");
    assert.equal((await zona(p, id)).locked, true, "cada cambio del panel se deshace con Ctrl+Z");
    await p.keyboard.press("Control+y");
    await p.evaluate(i => { mZona = i; selectionChanged(); }, id);
    await p.fill(".mz-panel .mz-titulo", "Terminados");
    // Mover por el título: el nodo de dentro va con el área; el de fuera no
    const z0 = await zona(p, id), dentro0 = await nodo(p, dentro), fuera0 = await nodo(p, fuera), zoom = await p.evaluate(() => cam().z);
    await arrastrar(p, await rotulo(p, id), 100, 50);
    z = await zona(p, id);
    assert.ok(Math.abs(z.x - z0.x - 100 / zoom) < 2 && Math.abs(z.y - z0.y - 50 / zoom) < 2, "el área se mueve");
    const d1 = await nodo(p, dentro);
    assert.ok(Math.abs(d1.x - dentro0.x - (z.x - z0.x)) < 1.5 && Math.abs(d1.y - dentro0.y - (z.y - z0.y)) < 1.5, "el nodo de dentro va con ella");
    assert.deepEqual(await nodo(p, fuera), fuera0, "el de fuera no se mueve");
    // Con Alt, solo el área
    await arrastrar(p, await rotulo(p, id), -80, 0, { alt: true });
    assert.deepEqual(await nodo(p, dentro), d1, "con Alt, los nodos se quedan");
    assert.ok((await zona(p, id)).x < z.x - 30);

    // ---- Tamaño por una esquina; forma cuadrado y círculo conservan la proporción
    const antes = await zona(p, id);
    await arrastrar(p, await esquina(p, id, "se"), 80, 30);
    z = await zona(p, id);
    assert.ok(z.w > antes.w + 50 && z.h > antes.h + 15 && z.x === antes.x && z.y === antes.y, "crece desde la esquina, la contraria se queda");
    await p.mouse.click(...(await rotulo(p, id)), { button: "right" });
    await p.locator(".mv-menu").getByRole("button", { name: "Forma…" }).click();
    await p.locator(".mv-menu").getByRole("button", { name: "Cuadrado" }).click();
    z = await zona(p, id); assert.equal(z.w, z.h, "el cuadrado es igual de ancho que de alto");
    await arrastrar(p, await esquina(p, id, "se"), 90, 10);
    const zz = await zona(p, id); assert.ok(zz.w === zz.h && zz.w > z.w, "y lo sigue siendo al estirarlo");

    // ---- Color: desde el menú se abre la paleta del panel (amplia: 30 colores) y además se puede elegir cualquiera
    await p.mouse.click(...(await rotulo(p, id)), { button: "right" });
    await p.locator(".mv-menu").getByRole("button", { name: "Color…" }).click();
    assert.equal(await p.locator(".mz-paleta button").count(), 30);
    const lavanda = await p.evaluate(() => Z_COLORS.find(c => c[1] === "Lavanda")[0]);
    await p.locator('.mz-paleta button[aria-label="Lavanda"]').click();
    assert.equal((await zona(p, id)).color, lavanda);
    assert.equal(await p.locator('.mz-paleta button[aria-pressed="true"]').getAttribute("aria-label"), "Lavanda");
    await p.locator(".mz-otro input").evaluate(i => { i.value = "#123456"; i.dispatchEvent(new Event("input", { bubbles: true })); i.dispatchEvent(new Event("change", { bubbles: true })); });
    assert.equal((await zona(p, id)).color, "#123456", "otro color cualquiera");
    assert.equal(await p.locator(".mz-otro.on").count(), 1);
    await p.click(".mz-color");
    assert.equal(await p.locator(".mz-paleta").count(), 0, "el botón de color abre y cierra la paleta");

    // ---- Bloquear: no se mueve ni cambia de tamaño
    await p.mouse.click(...(await rotulo(p, id)), { button: "right" });
    await p.locator(".mv-menu").getByRole("button", { name: "Bloquear" }).click();
    const fija = await zona(p, id);
    await arrastrar(p, await rotulo(p, id), 120, 40);
    await arrastrar(p, await esquina(p, id, "se"), 60, 60);
    const tras = await zona(p, id);
    assert.deepEqual([tras.x, tras.y, tras.w, tras.h, tras.locked], [fija.x, fija.y, fija.w, fija.h, true]);
    await p.mouse.click(...(await rotulo(p, id)), { button: "right" });
    await p.locator(".mv-menu").getByRole("button", { name: "Desbloquear" }).click();

    // ---- Título con doble clic; arrastrar dentro del área (lejos del borde) mueve el mapa, no el área
    await p.mouse.dblclick(...(await rotulo(p, id)));
    await p.locator(".mz-input").fill("Hechos"); await p.keyboard.press("Enter");
    assert.equal((await zona(p, id)).title, "Hechos");
    const cz = await zona(p, id), c0 = await p.evaluate(() => ({ ...cam() }));
    const [mx, my] = await enPagina(p, cz.x + cz.w * 0.5, cz.y + cz.h * 0.7);
    const nodoAhi = await p.evaluate(([x, y]) => { const r = document.querySelector("#mv-graph canvas").getBoundingClientRect(); return hitNode(x - r.left, y - r.top); }, [mx, my]);
    if (!nodoAhi) {
      await arrastrar(p, [mx, my], 40, 20);
      assert.deepEqual([(await zona(p, id)).x, (await zona(p, id)).y], [cz.x, cz.y], "el área no se ha movido");
      assert.ok((await p.evaluate(() => cam().ox)) > c0.ox + 30, "se ha desplazado el mapa");
    }

    // ---- Con el panel del área abierto: arrastrar el fondo mueve el mapa sin cerrarlo; un clic fuera lo cierra
    await p.evaluate(i => { mZona = i; selectionChanged(); }, id);
    await p.locator(".mz-panel").waitFor();
    const vacioA = await vacio(p); assert.ok(vacioA, "hay un sitio vacío en el mapa");
    await arrastrar(p, vacioA, 30, 15);
    assert.equal(await p.evaluate(() => mZona), id, "arrastrar el fondo no quita la selección");
    const fuera2 = await vacio(p);
    await p.mouse.click(...fuera2);
    assert.equal(await p.locator(".mz-panel").count(), 0, "un clic fuera cierra la barra del área");
    assert.equal(await p.evaluate(() => mZona), null);
    // ---- Buscador: encuentra el área por su título y la selecciona
    await p.fill("#bv-q", "hech"); await p.locator('#bv-results [data-srz]').click();
    assert.equal(await p.evaluate(() => mZona), id);

    // ---- Supr la borra (los nodos se quedan) y Ctrl+Z la devuelve
    const nodosAntes = await p.evaluate(() => Object.keys(state.mnodes).length);
    await p.locator("#mv-graph canvas").focus().catch(() => {}); await p.evaluate(() => document.activeElement.blur());
    await p.keyboard.press("Delete");
    assert.equal(await zona(p, id), undefined);
    assert.equal(await p.evaluate(() => Object.keys(state.mnodes).length), nodosAntes);
    await p.keyboard.press("Control+z");
    assert.equal((await zona(p, id)).title, "Hechos", "deshacer la devuelve");

    // ---- Se guarda y sigue ahí al recargar; un óvalo y la exportación a imagen incluyen las áreas
    const ov = await crear(p, "Óvalo", "Ideas");
    await esperar(p, ([a, b]) => window.AscensoLocal.api("GET", "estado").then(e => !!(e.mzones[a] && e.mzones[b] && e.mzones[a].title === "Hechos")), [id, ov], { que: "las áreas se guardan" });
    await p.reload(); await paginaLista(p); await abrirMapa(p);
    assert.equal((await zona(p, id)).title, "Hechos"); assert.equal((await zona(p, ov)).shape, "ovalo");
    // Borrar el mapa se lleva sus áreas
    assert.deepEqual(errores, []);
  } finally { await nav.close(); await app.cerrar(); }
});

test("áreas de los mapas con el dedo", async () => {
  const app = await servirApp(), nav = await chromium.launch();
  try {
    const { defaultBrowserType, ...perfil } = devices["Pixel 7"];
    const { pagina: p } = await abrirConDatos(nav, app, perfil);
    const errores = []; p.on("pageerror", e => errores.push(String(e)));
    const gesto = await dedos(p);
    await abrirMapa(p);
    await p.tap('[data-mtool="area"]'); await p.locator(".mv-menu").getByRole("button", { name: "Círculo" }).tap();
    await p.locator(".mz-input").fill("Ideas"); await p.keyboard.press("Enter");
    const id = await p.evaluate(() => mZona);
    const dentro = await p.evaluate(i => { const z = state.mzones[i], [n] = levelNodes("m1", null)[0]; const o = state.mnodes[n]; o.x = z.x + z.w / 2; o.y = z.y + z.h / 2; save(); mgDraw(); return n; }, id);
    // Tocar otra vez el título del área seleccionada abre sus opciones: «Mover sin los nodos»
    const [tx, ty] = await rotulo(p, id);
    await p.touchscreen.tap(tx, ty); await p.waitForTimeout(400);
    assert.equal(await p.locator(".mz-input").count(), 0, "el toque no elige ninguna opción del menú que se abre bajo el dedo");
    await p.locator(".mv-menu").getByRole("button", { name: "Mover sin los nodos" }).tap();
    const n0 = await nodo(p, dentro), z0 = await zona(p, id);
    await gesto.arrastrar(await rotulo(p, id), [tx + 60, ty + 40], { pulsacion: 40 });
    const z1 = await zona(p, id);
    assert.ok(z1.x > z0.x + 20, "el área se mueve con el dedo");
    assert.deepEqual(await nodo(p, dentro), n0, "sin los nodos");
    // Y la siguiente vez, con los nodos
    await gesto.arrastrar(await rotulo(p, id), [tx + 20, ty + 80], { pulsacion: 40 });
    assert.ok((await nodo(p, dentro)).y > n0.y + 15, "ahora el nodo va con ella");
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
    // El panel cabe en el lienzo del móvil y la paleta se puede tocar
    await p.evaluate(i => { mZona = i; selectionChanged(); }, id);
    await p.tap(".mz-color");
    const panel = await p.locator(".mz-panel").boundingBox(), lienzo = await p.locator("#mv-graph").boundingBox();
    assert.ok(panel.x >= lienzo.x && panel.x + panel.width <= lienzo.x + lienzo.width + 1, "el panel cabe a lo ancho");
    const muestra = await p.locator(".mz-paleta button").first().boundingBox();
    assert.ok(muestra.width >= 24 && muestra.height >= 28, "muestras para el dedo");
    await p.locator('.mz-paleta button[aria-label="Salvia oscuro"]').tap();
    assert.equal((await zona(p, id)).color, await p.evaluate(() => Z_COLORS.find(c => c[1] === "Salvia oscuro")[0]));
    // Tocar fuera del área cierra su barra
    await p.touchscreen.tap(...(await vacio(p))); await p.waitForTimeout(150);
    assert.equal(await p.locator(".mz-panel").count(), 0, "tocar fuera cierra la barra del área");
    assert.deepEqual(errores, []);
  } finally { await nav.close(); await app.cerrar(); }
});

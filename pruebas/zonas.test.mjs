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

    // ---- Mover por el título: el nodo de dentro va con el área; el de fuera no
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

    // ---- Color, con su muestra en el menú
    await p.mouse.click(...(await rotulo(p, id)), { button: "right" });
    await p.locator(".mv-menu").getByRole("button", { name: "Color…" }).click();
    assert.equal(await p.locator(".mv-menu .mm-sw").count(), 8);
    await p.locator(".mv-menu").getByRole("button", { name: "Lavanda" }).click();
    assert.equal((await zona(p, id)).color, "#A99BC9");

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
    assert.deepEqual(errores, []);
  } finally { await nav.close(); await app.cerrar(); }
});

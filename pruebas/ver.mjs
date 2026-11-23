import { servirApp, chromium, devices, abrirConDatos } from "./util.mjs";
const S = process.env.SALIDA, app = await servirApp(), nav = await chromium.launch();
const { defaultBrowserType, ...movil } = devices["Pixel 7"];
const sembrar = p => p.evaluate(() => {
  const hab = state.habits.map(h => h.id);
  for (let i = 70; i >= 1; i--) { const d = addDays(today(), -i), k = key(d), w = dowIdx(d), c = {};
    hab.forEach((id, j) => { if ((i * 7 + j * 3) % 10 < (w < 5 ? 7 : 4) + (j === 0 && i % 2 ? 2 : 0)) c[id] = true; });
    state.days[k] = { ...(state.days[k] || {}), c, a: c[hab[0]] ? 4 + (i % 3 === 0 ? 1 : 0) : 2 + (i % 2) };
    if (i % 3 === 0) state.notes[k] = { r: "Reflexión del día " + i, n: "" };
    for (let j = 0; j < (c[hab[4]] ? 3 : 1); j++) { const id = "s" + i + "_" + j; state.tasks[id] = { date: k, title: "Tarea " + i, notes: "", prio: ["urgente", "alta", "media", "baja"][j % 4], list: i % 4 === 0 && j ? "pendiente" : "hecha", tags: j % 2 ? ["e1"] : [], created: d.toISOString(), done: new Date(d.getTime() + (j + 0.4) * 864e5).toISOString(), check: [], archived: null }; } }
  if (!state.tags.e1) state.tags.e1 = { name: "Casa", color: "#2E86AB" };
  save(); render(); });
for (const [n, o] of [["pc", { viewport: { width: 1280, height: 900 } }], ["movil", { ...movil, deviceScaleFactor: 1, colorScheme: "dark" }]]) {
  const { pagina: p } = await abrirConDatos(nav, app, o);
  p.on("pageerror", e => console.log("ERROR", n, String(e)));
  await sembrar(p); await p.waitForTimeout(300);
  await p.evaluate(() => document.getElementById("animo").scrollIntoView({ block: "center" })); await p.screenshot({ path: `${S}/f2-${n}-0dia.png` });
  await p.click('#barra [data-ir="perfil"]'); await p.waitForTimeout(600);
  for (const t of ["resumen", "cuerpo", "habitos", "productividad", "descubrir"]) {
    await p.evaluate(t => window.AscensoPerfil.abrir(t), t); await p.waitForTimeout(300);
    await p.screenshot({ path: `${S}/f2-${n}-${t}.png`, fullPage: true });
  }
  await p.click("#pf-engranaje"); await p.locator("#pf-zonas").scrollIntoViewIfNeeded(); await p.waitForTimeout(200);
  await p.screenshot({ path: `${S}/f2-${n}-zonas.png` });
  console.log(n, "desborde:", await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), "descubrimientos:", await p.evaluate(() => AscensoEstadisticas.descubrimientos(state, typeFor).length));
}
await nav.close(); await app.cerrar();

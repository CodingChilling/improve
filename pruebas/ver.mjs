import { servirApp, chromium, devices, abrirConDatos } from "./util.mjs";
const S = process.env.SALIDA, app = await servirApp(), nav = await chromium.launch();
const { defaultBrowserType, ...movil } = devices["Pixel 7"];
for (const [n, o] of [["pc", { viewport: { width: 1280, height: 860 } }], ["movil", { ...movil, deviceScaleFactor: 1, colorScheme: "dark" }]]) {
  const { pagina: p } = await abrirConDatos(nav, app, o);
  p.on("pageerror", e => console.log("ERROR", n, String(e)));
  await p.screenshot({ path: `${S}/p0-${n}.png` });
  await p.click(".summit"); await p.waitForTimeout(500);
  await p.screenshot({ path: `${S}/p1-${n}.png` });
  await p.click('[data-pf="ajustes"]'); await p.waitForTimeout(300);
  await p.screenshot({ path: `${S}/p2-${n}.png`, fullPage: true });
  console.log(n, "desborde:", await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), "| cfg en ajustes:", await p.evaluate(() => !!document.querySelector("#pf-config #cfg") && !document.querySelector("main #cfg")));
}
await nav.close(); await app.cerrar();

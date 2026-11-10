// La misma idea que sync.test.mjs, pero contra un proyecto de Supabase de verdad (uno de pruebas, no el tuyo de uso diario).
// Comprueba lo que el simulador no puede: que la migración, las reglas (RLS), Realtime y Storage del proyecto funcionan con la app.
//
// Se salta si no se le dan estos datos por variables de entorno (ver LEEME.md):
//   SUPABASE_URL          https://<proyecto>.supabase.co
//   SUPABASE_CLAVE        la clave publicable (sb_publishable_…) o la «anon»
//   ASCENSO_EMAIL         email de una cuenta de pruebas ya creada y confirmada desde la app
//   ASCENSO_CONTRASENA    su contraseña
import test from "node:test";
import assert from "node:assert/strict";
import { chromium, apiLocal, paginaLista, esperar, PNG_1X1, servirAppConCuenta, panel, cerrarPanel, escribirAcceso, alDia } from "./util.mjs";

const { SUPABASE_URL: URL_REAL, SUPABASE_CLAVE: CLAVE_REAL, ASCENSO_EMAIL: EMAIL, ASCENSO_CONTRASENA: CONTRASENA } = process.env;
const falta = !(URL_REAL && CLAVE_REAL && EMAIL && CONTRASENA) && "faltan SUPABASE_URL, SUPABASE_CLAVE, ASCENSO_EMAIL o ASCENSO_CONTRASENA";
const marca = "prueba-" + Date.now().toString(36);
const tarea = titulo => ({ date: "2026-01-05", title: titulo, prio: "media", list: "pendiente", tags: [] });
const tiene = (p, id, si = true) => esperar(p, ([i, s]) => window.AscensoLocal.api("GET", "estado").then(e => !!e.tasks[i] === s), [id, si], { limite: 30000, que: (si ? "llega " : "desaparece ") + id });

async function entrar(nav, app) {
  const ctx = await nav.newContext(), p = await ctx.newPage();
  await p.goto(app.url); await paginaLista(p);
  await escribirAcceso(p, EMAIL, CONTRASENA);
  // Si es la primera vez que se entra en la cuenta, aparece la clave de recuperación (aquí no se guarda ni se muestra:
  // crea la cuenta desde la app si quieres conservarla)
  await Promise.race([panel(p).locator(".c-quien").waitFor({ timeout: 60000 }), p.locator("#c-recuperacion").waitFor({ timeout: 60000 })]);
  if (await p.locator("#c-recuperacion").count()) {
    await panel(p).locator('input[name="guardada"]').check(); await panel(p).getByRole("button", { name: "Continuar" }).click();
    await panel(p).locator(".c-quien").waitFor({ timeout: 60000 });
  }
  await alDia(p, 120000); await cerrarPanel(p);
  return { ctx, p };
}

test("proyecto real: dos dispositivos se sincronizan (altas, borrados, sin conexión e imágenes)", { skip: falta, timeout: 600000 }, async () => {
  const app = await servirAppConCuenta({ url: URL_REAL.replace(/\/+$/, ""), clave: CLAVE_REAL }), nav = await chromium.launch();
  try {
    const A = await entrar(nav, app), B = await entrar(nav, app);
    // Alta en A → llega a B (por Realtime, sin recargar)
    await apiLocal(A.p, "PUT", "tareas/" + marca, tarea("Tarea " + marca));
    await tiene(B.p, marca);
    // Cambio sin conexión en B → se envía al volver
    await B.ctx.setOffline(true);
    await apiLocal(B.p, "PUT", "tareas/" + marca, tarea("Tarea " + marca + " cambiada sin conexión"));
    await esperar(B.p, () => window.AscensoSync.informe().estado === "sin-conexion", null, { limite: 30000, que: "B se queda sin conexión" });
    await B.ctx.setOffline(false);
    await B.p.evaluate(() => window.dispatchEvent(new Event("online")));
    await esperar(A.p, m => window.AscensoLocal.api("GET", "estado").then(e => /sin conexión$/.test((e.tasks[m] || {}).title || "")), marca, { limite: 30000, que: "el cambio hecho sin conexión llega a A" });
    // Imagen cifrada: sube desde A, B la descarga y la descifra
    await apiLocal(A.p, "PUT", "adjuntos/i" + marca, { tipo: "image/png", ancho: 1, alto: 1, datos: PNG_1X1 });
    await esperar(B.p, i => window.AscensoLocal.api("GET", "estado").then(e => !!e.att[i]), "i" + marca, { limite: 30000, que: "la imagen llega a B" });
    assert.equal(await B.p.evaluate(async i => { const im = document.createElement("img"); im.dataset.adj = i; document.body.appendChild(im); im.src = window.AscensoLocal.urlAdjunto(i);
      for (let n = 0; n < 400 && !im.src.startsWith("blob:"); n++) await new Promise(r => setTimeout(r, 50)); await im.decode(); return im.naturalWidth; }, "i" + marca), 1);
    // Borrado en B → desaparece de A
    await apiLocal(B.p, "DELETE", "tareas/" + marca);
    await tiene(A.p, marca, false);
    // Las reglas del servidor: los cambios no se pueden modificar ni borrar, ni siquiera con la sesión del dueño
    const intento = await A.p.evaluate(async ([url, clave]) => {
      const c = await window.AscensoAlmacen.meta("cuenta"), h = { apikey: clave, Authorization: "Bearer " + c.sesion.acceso, "Content-Type": "application/json", Prefer: "return=representation" };
      const borrar = await fetch(url + "/rest/v1/cambios?seq=gt.0", { method: "DELETE", headers: h }), cambiar = await fetch(url + "/rest/v1/cambios?seq=gt.0", { method: "PATCH", headers: h, body: JSON.stringify({ datos: "x" }) });
      return [borrar.status, cambiar.status];
    }, [URL_REAL.replace(/\/+$/, ""), CLAVE_REAL]);
    assert.ok(intento.every(e => e === 401 || e === 403), "DELETE y PATCH sobre «cambios» deben estar prohibidos: " + intento);
    await alDia(A.p, 60000); await alDia(B.p, 60000);
    assert.deepEqual(await apiLocal(B.p, "GET", "estado"), await apiLocal(A.p, "GET", "estado"));
  } finally { await nav.close(); await app.cerrar(); }
});

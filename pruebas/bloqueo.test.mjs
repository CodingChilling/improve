// Bloqueo con PIN o huella: se pide al abrir sin que se vea nada antes, espera tras 5 fallos, vuelve a pedirse tras
// un rato en segundo plano, la huella con un autenticador virtual de WebAuthn y «olvidé el PIN» borra el dispositivo.
import test from "node:test";
import assert from "node:assert/strict";
import { servirApp, chromium, abrirConDatos, esperar } from "./util.mjs";

const lista = p => p.waitForFunction(() => window.AscensoBloqueo && typeof state === "object" && document.getElementById("status").textContent);
const bloqueada = p => p.evaluate(() => document.documentElement.classList.contains("bloqueada") && !document.getElementById("bloqueo").hidden);
const mainOculto = p => p.evaluate(() => getComputedStyle(document.querySelector("main")).visibility === "hidden");
const teclear = async (p, pin) => { for (const c of pin) await p.click(`#bloqueo [data-tecla="${c}"]`); };
const ajustesBloqueo = async p => { await p.evaluate(() => window.AscensoPerfil.abrir("ajustes")); await p.locator("#pf-bloqueo-sitio button").first().waitFor(); };
const meta = p => p.evaluate(() => window.AscensoAlmacen.meta("bloqueo"));

test("bloqueo: PIN, espera tras fallos, segundo plano, huella y olvido", async () => {
  // WebAuthn no admite una IP como dominio: se entra por «localhost»
  const app = await servirApp(), nav = await chromium.launch({ args: ["--host-resolver-rules=MAP localhost 127.0.0.1"] });
  try {
    const { ctx, pagina: p } = await abrirConDatos(nav, app, { viewport: { width: 390, height: 844 }, baseURL: undefined });
    await p.goto(app.url.replace("127.0.0.1", "localhost")); await lista(p);
    const errores = []; p.on("pageerror", e => errores.push(String(e)));
    // Lo que se ve justo al terminar de leer la página (antes de que bloqueo.js compruebe nada)
    await ctx.addInitScript(() => document.addEventListener("DOMContentLoaded", () => { window.__alCargar = document.documentElement.classList.contains("bloqueada"); }));
    assert.equal(await bloqueada(p), false);

    // ---- Poner un PIN desde Ajustes
    await ajustesBloqueo(p);
    await p.click('[data-bq="poner"]');
    await p.fill("#bq-nuevo", "12a4"); await p.fill("#bq-repite", "12a4"); await p.click("#bq-form [type=submit]");
    assert.match(await p.locator("#bq-error").innerText(), /entre 4 y 8 cifras/);
    await p.fill("#bq-nuevo", "2580"); await p.fill("#bq-repite", "2581"); await p.click("#bq-form [type=submit]");
    assert.match(await p.locator("#bq-error").innerText(), /no coinciden/);
    await p.fill("#bq-repite", "2580"); await p.click("#bq-form [type=submit]");
    await p.locator('[data-bq="cambiar"]').waitFor();
    const m = await meta(p);
    assert.equal(m.pin.largo, 4); assert.ok(m.pin.hash && m.pin.sal && m.pin.iter >= 100000);
    assert.ok(!JSON.stringify(m).includes("2580"), "el PIN no se guarda");
    assert.deepEqual(await p.evaluate(() => Object.entries(localStorage).filter(([k, v]) => v.includes("2580"))), [], "nada del PIN en localStorage");
    assert.equal(await p.evaluate(() => localStorage.getItem("ascenso-bloqueo")), "1");

    // ---- Al abrir: bloqueada desde el principio, sin que se vea el contenido
    await p.reload(); await lista(p);
    assert.equal(await p.evaluate(() => window.__alCargar), true, "oculta desde antes de pintar");
    assert.ok(await bloqueada(p)); assert.ok(await mainOculto(p));
    assert.ok(await p.locator("#bloqueo").isVisible());
    // PIN incorrecto con el teclado del ordenador; 5 fallos → espera, que sigue tras recargar
    for (let i = 1; i <= 4; i++) { await p.keyboard.type("1111"); await esperar(p, n => (window.AscensoAlmacen.meta("bloqueo")).then(m => m.fallos === n), i); }
    assert.match(await p.locator("#bq-msg").innerText(), /Te queda 1 intento/);
    await p.keyboard.type("1111");
    await esperar(p, () => /Espera 30 s/.test(document.getElementById("bq-msg").textContent));
    assert.ok(await p.locator('#bloqueo [data-tecla="2"]').isDisabled());
    await p.reload(); await lista(p);
    await esperar(p, () => /Demasiados intentos/.test(document.getElementById("bq-msg").textContent));
    await p.keyboard.type("2580"); assert.ok(await bloqueada(p), "durante la espera no se acepta ni el correcto");
    // Pasada la espera, el PIN correcto con el teclado de la pantalla
    await p.evaluate(async () => { const m = await window.AscensoAlmacen.meta("bloqueo"); m.hasta = Date.now() - 1; await window.AscensoAlmacen.ponerMeta("bloqueo", m); });
    await p.reload(); await lista(p);
    assert.ok(await bloqueada(p));
    await teclear(p, "2580");
    await esperar(p, () => !document.documentElement.classList.contains("bloqueada"));
    assert.equal(await mainOculto(p), false);
    assert.equal((await meta(p)).fallos, 0, "un acierto pone a cero los fallos");

    // ---- Segundo plano: con «1 min», volver antes no bloquea; después, sí
    const segundoPlano = (p, oculto) => p.evaluate(o => { Object.defineProperty(document, "hidden", { value: o, configurable: true }); Object.defineProperty(document, "visibilityState", { value: o ? "hidden" : "visible", configurable: true }); document.dispatchEvent(new Event("visibilitychange")); }, oculto);
    const t0 = Date.now();
    await p.clock.setFixedTime(t0);
    await segundoPlano(p, true); await segundoPlano(p, false);
    assert.equal(await bloqueada(p), false);
    await segundoPlano(p, true); await p.clock.setFixedTime(t0 + 61000); await segundoPlano(p, false);
    assert.ok(await bloqueada(p));
    await teclear(p, "2580"); await esperar(p, () => !document.documentElement.classList.contains("bloqueada"));
    // «Al salir»: en cuanto pasa a segundo plano
    await ajustesBloqueo(p);
    await p.click('[data-bq-espera="0"]');
    await esperar(p, () => window.AscensoAlmacen.meta("bloqueo").then(m => m.espera === 0));
    await segundoPlano(p, true);
    assert.ok(await bloqueada(p));
    await segundoPlano(p, false);
    await teclear(p, "2580"); await esperar(p, () => !document.documentElement.classList.contains("bloqueada"));
    await p.clock.resume().catch(() => {});

    // ---- Huella o cara con un autenticador virtual del dispositivo
    const cdp = await ctx.newCDPSession(p);
    await cdp.send("WebAuthn.enable");
    const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", { options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
    await ajustesBloqueo(p);
    await p.locator('[data-bq="huella"]').click();
    await p.locator('[data-bq="quitar-huella"]').waitFor();
    assert.ok((await meta(p)).huella.id);
    await p.click('[data-bq="bloquear"]');
    assert.ok(await bloqueada(p));
    await p.locator("#bq-huella").waitFor();
    await p.click("#bq-huella");
    await esperar(p, () => !document.documentElement.classList.contains("bloqueada"), null, { que: "se abre con la huella" });
    // Si el dispositivo no verifica a la persona, no se abre
    await cdp.send("WebAuthn.setUserVerified", { authenticatorId, isUserVerified: false });
    await p.evaluate(() => window.AscensoBloqueo.bloquear());
    await p.click("#bq-huella");
    await esperar(p, () => /Usa tu PIN/.test(document.getElementById("bq-msg").textContent));
    assert.ok(await bloqueada(p));
    await teclear(p, "2580"); await esperar(p, () => !document.documentElement.classList.contains("bloqueada"));

    // ---- Cambiar el PIN pide el actual
    await ajustesBloqueo(p);
    await p.click('[data-bq="cambiar"]');
    await p.fill("#bq-actual", "0000"); await p.fill("#bq-nuevo", "135790"); await p.fill("#bq-repite", "135790"); await p.click("#bq-form [type=submit]");
    await esperar(p, () => /actual no es correcto/.test(document.getElementById("bq-error").textContent), null, { que: "el aviso del PIN actual" });
    await p.fill("#bq-actual", "2580"); await p.fill("#bq-nuevo", "135790"); await p.fill("#bq-repite", "135790"); await p.click("#bq-form [type=submit]");
    await p.locator('[data-bq="cambiar"]').waitFor();
    assert.equal((await meta(p)).pin.largo, 6);
    assert.ok((await meta(p)).huella, "cambiar el PIN mantiene la huella");

    // ---- Olvidé el PIN: borrar los datos del dispositivo (doble confirmación) quita el bloqueo
    await p.evaluate(() => { state.tasks[newId("t")] = { date: key(today()), title: "Secreta", notes: "", prio: "media", list: "pendiente", tags: [], created: new Date().toISOString(), check: [], archived: null }; save(); });
    await esperar(p, async () => Object.values((await window.AscensoLocal.api("GET", "estado")).tasks).some(t => t.title === "Secreta"));
    await p.reload(); await lista(p);
    assert.ok(await bloqueada(p));
    await p.click("#bq-olvido"); await p.click("#bq-borrar");
    assert.match(await p.locator("#bq-borrar").innerText(), /Pulsa otra vez/);
    await Promise.all([p.waitForEvent("load"), p.click("#bq-borrar")]);
    await lista(p);
    assert.equal(await bloqueada(p), false);
    assert.equal(await meta(p), undefined);
    assert.equal(await p.evaluate(() => localStorage.getItem("ascenso-bloqueo")), null);
    assert.equal(await p.evaluate(() => Object.values(state.tasks).some(t => t.title === "Secreta")), false, "los datos del dispositivo se han borrado");
    assert.deepEqual(errores, []);
  } finally { await nav.close(); await app.cerrar(); }
});

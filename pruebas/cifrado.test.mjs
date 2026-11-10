// El cifrado (cifrado.js): ida y vuelta, y que sin la clave correcta no se abre nada.
import test from "node:test";
import assert from "node:assert/strict";
import { servirApp, chromium, paginaLista } from "./util.mjs";

test("cifrado: derivación de claves, ida y vuelta, y claves equivocadas", async () => {
  const app = await servirApp(), nav = await chromium.launch();
  try {
    const p = await nav.newPage();
    await p.goto(app.url); await paginaLista(p);
    const r = await p.evaluate(async () => {
      const C = window.AscensoCifrado, falla = async f => { try { await f(); return false; } catch (e) { return true; } };
      const a = await C.derivar("  Ana@Ejemplo.com ", "una frase bien larga"), a2 = await C.derivar("ana@ejemplo.com", "una frase bien larga");
      const otraClave = await C.derivar("ana@ejemplo.com", "una frase bien largA"), otroEmail = await C.derivar("eva@ejemplo.com", "una frase bien larga");
      // Clave de datos: se envuelve con la contraseña y con la clave de recuperación
      const bruta = C.nuevaClaveDeDatos(), copia = Array.from(bruta);
      const sobre = await C.envolver(a.envoltorio, bruta), rec = C.nuevaClaveRecuperacion();
      const sobreRec = await C.envolver(await C.envoltorioDeRecuperacion(rec), bruta);
      const claves = await C.clavesDeDatos(bruta), otras = await C.clavesDeDatos(C.nuevaClaveDeDatos());
      const dato = { tabla: "tareas", id: "t1", actualizado: "2026-01-01T00:00:00.000Z", borrado: false, valores: { title: "Ñandú, 你好, 🙂", n: [1, 2, { x: null }] } };
      const c1 = await C.cifrar(claves, dato), c2 = await C.cifrar(claves, dato);
      const imagen = crypto.getRandomValues(new Uint8Array(5000)), imagenCifrada = await C.cifrarArchivo(claves, imagen);
      const manipulado = c1.slice(0, -3) + (c1.endsWith("AAA") ? "BBB" : "AAA");
      return {
        accesoEstable: a.acceso === a2.acceso, accesoLargo: a.acceso.length, accesoDistintoPorClave: a.acceso !== otraClave.acceso, accesoDistintoPorEmail: a.acceso !== otroEmail.acceso,
        accesoNoEsLaContrasena: !a.acceso.includes("frase"),
        desenvuelve: Array.from(await C.desenvolver(a2.envoltorio, sobre)).join() === copia.join(),
        desenvuelveConRecuperacion: Array.from(await C.desenvolver(await C.envoltorioDeRecuperacion(rec.toLowerCase().replace(/-/g, " ")), sobreRec)).join() === copia.join(),
        otraContrasenaNoAbre: await falla(() => C.desenvolver(otraClave.envoltorio, sobre)),
        otraRecuperacionNoAbre: await falla(async () => C.desenvolver(await C.envoltorioDeRecuperacion(C.nuevaClaveRecuperacion()), sobreRec)),
        recuperacionMalEscrita: await falla(() => C.envoltorioDeRecuperacion("corta")),
        formatoRecuperacion: /^([A-Z2-9]{4}-){7}[A-Z2-9]{4}$/.test(rec),
        idaYVuelta: JSON.stringify(await C.descifrar(claves, c1)) === JSON.stringify(dato),
        ivAleatorio: c1 !== c2, formato: /^v1\.[\w-]{16}\.[\w-]+$/.test(c1), sinTextoClaro: !c1.includes("tareas") && !atob(c1.split(".")[2].replace(/-/g, "+").replace(/_/g, "/")).includes("tareas"),
        otraClaveNoDescifra: await falla(() => C.descifrar(otras, c1)), manipuladoNoDescifra: await falla(() => C.descifrar(claves, manipulado)),
        etiquetaEstable: await C.etiqueta(claves, "tareas", "t1") === await C.etiqueta(claves, "tareas", "t1"),
        etiquetaDistinta: await C.etiqueta(claves, "tareas", "t1") !== await C.etiqueta(claves, "tareas", "t2") && await C.etiqueta(claves, "tareas", "t1") !== await C.etiqueta(otras, "tareas", "t1"),
        etiquetaOpaca: !(await C.etiqueta(claves, "tareas", "t1")).includes("t1"),
        archivo: Array.from(new Uint8Array(await C.descifrarArchivo(claves, imagenCifrada))).join() === Array.from(imagen).join() && imagenCifrada.length === 5000 + 12 + 16,
        archivoOtraClave: await falla(() => C.descifrarArchivo(otras, imagenCifrada)),
        clavesNoExportables: claves.cifrado.extractable === false && claves.etiquetas.extractable === false && a.envoltorio.extractable === false,
        sePuedenGuardar: await (async () => { await window.AscensoAlmacen.ponerMeta("prueba", claves); const g = await window.AscensoAlmacen.meta("prueba"); await window.AscensoAlmacen.quitar("meta", "prueba");
          return JSON.stringify(await C.descifrar(g, c1)) === JSON.stringify(dato); })(),
      };
    });
    assert.equal(r.accesoLargo, 43);
    for (const [k, v] of Object.entries(r)) if (k !== "accesoLargo") assert.equal(v, true, k);
  } finally { await nav.close(); await app.cerrar(); }
});

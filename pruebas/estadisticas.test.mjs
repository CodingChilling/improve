// Estadísticas del perfil con datos sintéticos: porcentajes, rachas, productividad, zonas y descubrimientos
// (que solo aparecen con datos suficientes y diferencias claras).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { RAIZ } from "./util.mjs";

const window = {};
new Function("window", fs.readFileSync(path.join(RAIZ, "assets/js/niveles.js"), "utf8"))(window);
new Function("window", fs.readFileSync(path.join(RAIZ, "assets/js/estadisticas.js"), "utf8"))(window);
const E = window.AscensoEstadisticas;
const T = [true, true, true, true, true, true, true];
const hoy = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const k = d => E.clave(d);
const atras = n => { const d = hoy(); d.setDate(d.getDate() - n); return d; };

// N días de datos: «A» los días pares; «B» casi siempre que «A»; ánimo alto con «A»; más tareas con «A»
function estado(n, { relacion = true } = {}) {
  const s = { thr: 0.5, habits: [
      { id: "a", t: "Dormir 7 horas", s: "", streak: true, week: true, days: T },
      { id: "b", t: "Proteína", s: "", streak: true, week: true, days: T },
      { id: "c", t: "Leer", s: "", streak: false, week: true, days: T }],
    days: {}, tasks: {}, tags: { e1: { name: "Casa", color: "#2E86AB" } }, cards: {}, blists: {}, notes: {},
    tipos: [{ id: "climb", name: "Escalada", color: "#D39B2A" }], perfil: { figura: "hombre", nombre: "", porque: "", zonas: null } };
  for (let i = n; i >= 1; i--) {
    const d = atras(i), A = i % 2 === 0, c = {};
    if (A) c.a = true;
    if (relacion ? A || i % 7 === 0 : i % 3 === 0) c.b = true;
    if (i % 5 === 0) c.c = true;
    s.days[k(d)] = { c, a: relacion ? (A ? 5 : 2) : 3 };
    for (let j = 0; j < (relacion && A ? 3 : 1); j++) s.tasks[`t${i}-${j}`] = { date: k(d), title: "x", prio: j ? "baja" : "urgente", list: "hecha", tags: ["e1"],
      created: d.toISOString(), done: new Date(d.getTime() + (j ? 5 : 0.5) * 864e5).toISOString() };
  }
  return s;
}

test("periodos y hábitos", () => {
  const s = estado(40), per = E.periodo("mes", hoy(), s);
  assert.equal(per.desde.getDate(), 1);
  const siempre = E.periodo("siempre", hoy(), s);
  assert.equal(k(siempre.desde), k(atras(40)), "«siempre» empieza el primer día con datos");
  const h = E.habitos(s, siempre);
  const a = h.porHabito.find(x => x.id === "a");
  assert.equal(a.total, 41, "días aplicables desde el primero hasta hoy");
  assert.equal(a.hechos, 20);
  assert.equal(a.mejor, 1, "«A» nunca dos días seguidos");
  assert.ok(h.porDia.every(x => x === null || (x >= 0 && x <= 1)));
  const cal = E.calendario(s);
  assert.equal(cal.length, 53 * 7);
  assert.ok(cal.some(x => x.r !== null) && cal.filter(x => x.futuro).length < 7);
});

test("productividad, ánimo y zonas", () => {
  const s = estado(40), per = E.periodo("siempre", hoy(), s), p = E.productividad(s, per);
  assert.equal(p.hechas, Object.keys(s.tasks).length - 0 - Object.values(s.tasks).filter(t => E.clave(new Date(t.done)) > k(hoy())).length);
  assert.ok(p.tiempo.urgente.dias < 1 && p.tiempo.baja.dias > 4, "tiempo hasta terminar por prioridad");
  assert.equal(p.porEtiqueta[0].nombre, "Casa");
  const an = E.animo(s, per);
  assert.ok(an.media > 3 && an.media < 4 && an.n === 40);
  // Reparto propuesto por nombre: Dormir → cabeza, Proteína → abdomen, Leer → cabeza, Escalada → brazos
  const z = E.zonasPropuestas(s);
  assert.deepEqual(z.cabeza, ["h:a", "h:c"]); assert.deepEqual(z.abdomen, ["h:b"]); assert.deepEqual(z.brazos, ["t:climb"]);
  const zz = E.zonas(s, per, () => "climb");
  assert.ok(zz.cabeza.pct > 0 && zz.cabeza.refs.length === 2);
  assert.equal(zz.brazos.pct, null, "sin hábito de entreno, el tipo no se puede medir");
  // Con el reparto elegido por la persona se usa el suyo
  s.perfil.zonas = { cabeza: [], pecho: ["h:a"], brazos: [], manos: [], abdomen: [], piernas: [] };
  assert.deepEqual(E.zonas(s, per).pecho.refs.map(r => r.ref), ["h:a"]);
});

test("descubrimientos: con relación clara y datos suficientes, sí; sin ellos, no", () => {
  const ids = l => l.map(x => x.id.split(":")[0]);
  const si = E.descubrimientos(estado(70), () => "climb");
  assert.ok(si.length >= 3, "aparecen descubrimientos");
  for (const tipo of ["juntos", "animo", "tareas"]) assert.ok(ids(si).includes(tipo), "hay del tipo " + tipo);
  assert.ok(si.every(x => typeof x.texto === "string" && x.texto.length > 20 && x.base >= 14), "con texto y base suficiente");
  assert.ok(si.every(x => !/causa|provoca|hace que/i.test(x.texto)), "nunca se presentan como causas");
  assert.deepEqual(E.descubrimientos(estado(10), () => "climb"), [], "con pocos días, nada");
  const sinRelacion = E.descubrimientos(estado(70, { relacion: false }), () => "climb");
  assert.ok(!ids(sinRelacion).includes("animo"), "sin diferencias de ánimo, no se inventa ninguna");
});

// Objetivos con fecha: cómo se mide cada tipo, cuándo se cumplen o no, y los 150 puntos de experiencia.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { RAIZ } from "./util.mjs";

const window = {};
for (const f of ["niveles.js", "objetivos.js"]) new Function("window", fs.readFileSync(path.join(RAIZ, "assets/js", f), "utf8"))(window);
const O = window.AscensoObjetivos, N = window.AscensoNiveles;
const T = [true, true, true, true, true, true, true];
const hoy = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const k = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const dia = n => { const d = hoy(); d.setDate(d.getDate() + n); return d; };

// 20 días atrás: el hábito «a» cumplido los últimos 12 seguidos; una tarea terminada cada día; reflexión días pares
function estado() {
  const s = { thr: 0.66, habits: [{ id: "a", t: "Leer", streak: true, week: true, days: T }], days: {}, tasks: {}, notes: {}, cards: {}, blists: {}, objetivos: {} };
  for (let i = 20; i >= 1; i--) {
    const d = dia(-i);
    s.days[k(d)] = { c: i <= 12 ? { a: true } : {} };
    s.tasks["t" + i] = { list: "hecha", prio: "media", done: d.toISOString(), date: k(d) };
    if (i % 2 === 0) s.notes[k(d)] = { r: "algo" };
  }
  return s;
}

test("cada tipo de objetivo se mide con los datos", () => {
  const s = estado(), desde = k(dia(-20)), fin = k(dia(10));
  const m = g => O.medir(s, { desde, hasta: fin, ...g });
  let r = m({ tipo: "racha", meta: 10 });
  assert.equal(r.valor, 12); assert.equal(r.estado, "cumplido"); assert.equal(r.cumplidoEl, k(dia(-3)), "el día en que llegó a 10");
  r = m({ tipo: "racha", meta: 30 });
  assert.equal(r.estado, "en-curso"); assert.equal(r.progreso, 0.4); assert.equal(r.quedanDias, 10);
  r = m({ tipo: "habito", ref: "a", meta: 50 });
  assert.equal(r.valor, 57); assert.equal(r.estado, "en-curso", "un porcentaje se decide al terminar el plazo");
  r = O.medir(s, { tipo: "habito", ref: "a", meta: 50, desde, hasta: k(dia(-1)) });
  assert.equal(r.estado, "cumplido");
  r = O.medir(s, { tipo: "habito", ref: "a", meta: 90, desde, hasta: k(dia(-1)) });
  assert.equal(r.estado, "no-alcanzado");
  assert.equal(m({ tipo: "habito", ref: "borrado", meta: 50 }).medible, false);
  r = m({ tipo: "tareas", meta: 15 }); assert.equal(r.valor, 20); assert.equal(r.cumplidoEl, k(dia(-6)));
  r = m({ tipo: "reflexiones", meta: 15 }); assert.equal(r.valor, 10); assert.equal(r.estado, "en-curso");
  assert.equal(m({ tipo: "libros", meta: 1 }).medible, false, "sin librería no se puede medir");
  r = O.medir(s, { tipo: "libros", meta: 1, desde, hasta: fin }, { libreria: { libros: { l: {} }, lecturas: { l: { pct: 1, leido: dia(-2).toISOString() } } } });
  assert.equal(r.estado, "cumplido");
  assert.equal(m({ tipo: "nivel", meta: 3 }).estado, "en-curso");
  assert.equal(O.medir(s, { tipo: "nivel", meta: 3, desde, hasta: fin }, { nivel: 3 }).estado, "cumplido");
  assert.equal(O.medir(s, { tipo: "tareas", meta: 5, desde: k(dia(2)), hasta: fin }).estado, "pendiente");
  assert.equal(O.descripcion({ tipo: "habito", ref: "a", meta: 80 }, s), "«Leer» al 80 %");
});

test("objetivos cumplidos suman 150 puntos de experiencia y forman el cuadrado", () => {
  const s = estado(), base = N.experiencia(s).total;
  s.objetivos = { o1: { tipo: "tareas", meta: 5, desde: k(dia(-20)), hasta: k(dia(10)) }, o2: { tipo: "racha", meta: 100, desde: k(dia(-20)), hasta: k(dia(10)) } };
  const x = N.experiencia(s);
  assert.equal(x.partes.objetivos, 150); assert.equal(x.total, base + 150);
  // Un objetivo de nivel cuenta con el nivel sin objetivos
  s.objetivos.o3 = { tipo: "nivel", meta: N.nivelDe(base).nivel, desde: k(dia(-20)), hasta: k(dia(10)) };
  assert.equal(N.experiencia(s).partes.objetivos, 300);
  const l = O.evaluar(s, { nivel: N.nivelDe(base).nivel });
  assert.equal(l.length, 3);
  assert.ok(Math.abs(O.progresoMedio(l) - l.find(g => g.id === "o2").m.progreso) < 1e-9, "solo cuentan los que siguen en curso");
});

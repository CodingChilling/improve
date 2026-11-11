// Ascenso en el móvil: la barra de navegación de abajo y el gesto o botón «atrás» del teléfono.
// No guarda nada ni toca los datos: solo mueve la pantalla y cierra lo que esté abierto.
"use strict";
(() => {
  const barra = document.getElementById("barra"), tableros = document.getElementById("boardsview");
  if (!barra || !tableros) return;
  const $ = id => document.getElementById(id);
  const boton = k => barra.querySelector('[data-ir="' + k + '"]');
  const seccion = { hoy: () => $("head"), tareas: () => document.querySelector("section.tasks"), progreso: () => $("h-prog").closest("section") };
  const suave = () => matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

  // ---------------------------------------------------------------- barra de abajo
  let fijada = null, fijadaHasta = 0;            // tras pulsar, se marca el destino aunque el desplazamiento aún no haya llegado
  function marcar() {
    let activa = "tableros";
    if (tableros.hidden) {
      activa = "hoy";
      if (fijada && Date.now() < fijadaHasta) activa = fijada;
      else {
        const limite = innerHeight * 0.4;
        for (const k of ["tareas", "progreso"]) if (seccion[k]().getBoundingClientRect().top < limite) activa = k;
      }
    }
    for (const b of barra.querySelectorAll("button")) {
      const es = b.dataset.ir === activa;
      if (es) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    }
  }
  function ir(k) {
    if (k === "cuenta") { if (window.AscensoCuenta && window.AscensoCuenta.abrir) window.AscensoCuenta.abrir(); return; }
    if (k === "tableros") {
      // Ya en los tableros, el botón vuelve a la portada con todos
      if (tableros.hidden) $("brand").click(); else if (typeof setBoard === "function") setBoard("home");
      return;
    }
    if (!tableros.hidden) $("bv-back").click();
    fijada = k; fijadaHasta = Date.now() + 900;
    if (k === "hoy") scrollTo({ top: 0, behavior: suave() }); else seccion[k]().scrollIntoView({ behavior: suave(), block: "start" });
    marcar();
  }
  barra.addEventListener("click", e => { const b = e.target.closest("button[data-ir]"); if (b) ir(b.dataset.ir); });
  let pendiente = false;
  addEventListener("scroll", () => { if (pendiente) return; pendiente = true; requestAnimationFrame(() => { pendiente = false; marcar(); }); }, { passive: true });

  // Con el teclado en pantalla la barra se aparta: no tapa lo que se escribe
  const escribe = el => el && (el.isContentEditable || el.tagName === "TEXTAREA" ||
    el.tagName === "INPUT" && !/^(checkbox|radio|color|file|range|button|submit)$/.test(el.type));
  const teclado = () => document.body.classList.toggle("con-teclado", !!escribe(document.activeElement));
  document.addEventListener("focusin", teclado);
  document.addEventListener("focusout", () => setTimeout(teclado, 0));

  // La cuenta: solo donde existe (no en la versión clásica), con un punto que dice cómo va la sincronización
  if (window.AscensoCuenta && window.AscensoCuenta.disponible) {
    const b = boton("cuenta"), punto = b.querySelector(".b-punto");
    b.hidden = false;
    const nombres = { sincronizado: "sincronizado", sincronizando: "sincronizando", "sin-conexion": "sin conexión", error: "sin sincronizar" };
    document.addEventListener("ascenso:sync", e => {
      const estado = e.detail && e.detail.estado, hay = !!nombres[estado];
      punto.hidden = !hay; punto.dataset.estado = hay ? estado : "";
      b.setAttribute("aria-label", "Cuenta" + (hay ? ": " + nombres[estado] : ""));
    });
  }

  // ---------------------------------------------------------------- «atrás» del teléfono
  // Cada cosa abierta (los tableros, un tablero o mapa, una ficha, el calendario…) cuenta como un paso
  // del historial: «atrás» cierra lo último que se abrió en vez de salir de Ascenso.
  const ventanitas = [["calpop", () => closeCal()], ["notepad", () => closePad()], ["evpop", () => closeEvPop()]];
  const abiertas = () => document.querySelector("dialog[open]") || ventanitas.some(([id]) => $(id) && !$(id).hidden);
  const enTablero = () => { try { return curBoard !== "home"; } catch (e) { return false; } };
  const nivel = () => (tableros.hidden ? 0 : enTablero() ? 2 : 1) + (abiertas() ? 1 : 0);
  let enHistoria = 0, ignorar = 0;
  // Los pasos propios llevan marca; así se distinguen de una navegación de verdad (el enlace de un email, que llega en «#…»)
  const marcarBase = () => { try { if (!history.state || history.state.ascenso == null) history.replaceState({ ascenso: 0 }, ""); } catch (e) {} };
  const conEnlace = () => /(^|[#&])(access_token|error|error_description)=/.test(location.hash);
  marcarBase();
  function cuadrar() {
    if (conEnlace()) return;                     // cuenta.js aún no ha leído y quitado el enlace: no se copia a otro paso
    const n = nivel();
    while (enHistoria < n) history.pushState({ ascenso: ++enHistoria }, "");
    if (enHistoria > n) { const sobra = enHistoria - n; enHistoria = n; ignorar++; history.go(-sobra); }
  }
  function cerrarLoUltimo() {
    const d = [...document.querySelectorAll("dialog[open]")].pop();
    if (d) { if (d.dispatchEvent(new Event("cancel", { cancelable: true }))) d.close(); return; }   // un diálogo puede negarse (la clave de recuperación)
    for (const [id, cerrar] of ventanitas) if ($(id) && !$(id).hidden) { cerrar(); return; }
    if (!tableros.hidden) { if (enTablero()) setBoard("home"); else $("bv-back").click(); }
  }
  addEventListener("popstate", e => {
    if (ignorar) { ignorar--; return; }
    if (!e.state || e.state.ascenso == null) { marcarBase(); enHistoria = 0; setTimeout(cuadrar, 0); return; }   // navegación ajena: se empieza de cero
    const destino = e.state.ascenso;
    if (destino >= enHistoria) { enHistoria = destino; cuadrar(); return; }      // «adelante», o historial de antes de recargar
    for (let i = enHistoria - destino; i > 0; i--) cerrarLoUltimo();
    enHistoria = destino; cuadrar();
  });
  let aviso = false;
  const alCambiar = () => { if (aviso) return; aviso = true; queueMicrotask(() => { aviso = false; cuadrar(); marcar(); }); };
  new MutationObserver(alCambiar).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open", "hidden"] });
  new MutationObserver(alCambiar).observe($("bv-body"), { childList: true });

  marcar();
})();

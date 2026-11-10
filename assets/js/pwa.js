// Aplicación instalable: registra el service worker (que guarda Ascenso en el dispositivo para abrirlo
// sin conexión) y avisa cuando hay una versión nueva. En la versión clásica (servidor.py) no hace nada.
"use strict";
(() => {
  const config = window.ASCENSO_CONFIG || {};
  if (config.clasico || !("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)) return;

  function avisar(nuevo) {
    if (document.getElementById("aviso-version")) return;
    const aviso = document.createElement("div");
    aviso.id = "aviso-version"; aviso.className = "aviso-version"; aviso.setAttribute("role", "status");
    const texto = document.createElement("span"); texto.textContent = "Hay una versión nueva de Ascenso.";
    const recargar = document.createElement("button"); recargar.type = "button"; recargar.textContent = "Recargar";
    const cerrar = document.createElement("button"); cerrar.type = "button"; cerrar.className = "av-x"; cerrar.textContent = "×"; cerrar.setAttribute("aria-label", "Ahora no");
    recargar.onclick = () => { recargar.disabled = true; nuevo.postMessage({ tipo: "activar" }); };
    cerrar.onclick = () => aviso.remove();
    aviso.append(texto, recargar, cerrar);
    document.body.appendChild(aviso);
  }

  // Cuando la versión nueva toma el control, se recarga la página (una sola vez)
  let habiaControl = !!navigator.serviceWorker.controller, recargando = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!habiaControl) { habiaControl = true; return; }      // primera instalación: no hay nada que recargar
    if (recargando) return; recargando = true; location.reload();
  });

  window.addEventListener("load", async () => {
    let reg;
    // Sin assets/precache.js (en desarrollo) el registro falla y Ascenso funciona sin service worker
    try { reg = await navigator.serviceWorker.register("service-worker.js", { scope: "./", updateViaCache: "none" }); } catch (e) { return; }
    const vigilar = sw => { if (!sw) return;
      const mirar = () => { if (sw.state === "installed" && navigator.serviceWorker.controller) avisar(sw); };
      sw.addEventListener("statechange", mirar); mirar(); };
    vigilar(reg.waiting); vigilar(reg.installing);
    reg.addEventListener("updatefound", () => vigilar(reg.installing));
    // Se busca una versión nueva al volver a la aplicación, como mucho una vez cada hora
    let ultima = Date.now();
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && Date.now() - ultima > 3600000) { ultima = Date.now(); reg.update().catch(() => {}); }
    });
    // Las imágenes del día se van guardando en segundo plano
    navigator.serviceWorker.ready.then(r => { if (r.active) r.active.postMessage({ tipo: "imagenes" }); }).catch(() => {});
  });
})();

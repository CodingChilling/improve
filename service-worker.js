// Service worker de Ascenso: guarda la aplicación en el dispositivo para que abra sin conexión.
//
// La lista de archivos y la versión están en assets/precache.js, que se genera al publicar
// (herramientas/generar.py). Si ese archivo no existe (en desarrollo), el service worker no se instala
// y la página funciona igual, directamente desde la red.
//
// Solo atiende archivos de la propia aplicación: los datos están en IndexedDB y las peticiones a la
// cuenta (Supabase) van a otro dominio y no pasan por aquí.
"use strict";
importScripts("assets/precache.js");

const { version: VERSION, app: ARCHIVOS, imagenes: IMAGENES } = self.ASCENSO_PRECACHE;
const CACHE_APP = "ascenso-app-" + VERSION;
const CACHE_IMAGENES = "ascenso-imagenes";          // imágenes del día: pesan mucho y cambian poco, van aparte
const RAIZ = new URL("./", self.location).href;
const PAGINA = new URL("ascenso.html", RAIZ).href;

self.addEventListener("install", e => {
  // La versión nueva se descarga entera antes de usarse; si falta un archivo, se sigue con la anterior
  e.waitUntil(caches.open(CACHE_APP).then(c => c.addAll(ARCHIVOS.map(u => new Request(u, { cache: "reload" })))));
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const n of await caches.keys()) if (n.startsWith("ascenso-app-") && n !== CACHE_APP) await caches.delete(n);
    await self.clients.claim();
  })());
});

// La página avisa cuando la persona acepta recargar con la versión nueva, y pide las imágenes del día
self.addEventListener("message", e => {
  if (!e.data) return;
  if (e.data.tipo === "activar") self.skipWaiting();
  if (e.data.tipo === "imagenes") e.waitUntil(guardarImagenes());
});

// Descarga poco a poco las imágenes del día que falten y quita las que ya no están en la lista
let guardando = null;
function guardarImagenes() {
  if (!guardando) guardando = (async () => {
    const cache = await caches.open(CACHE_IMAGENES);
    const quiero = new Set(IMAGENES.map(u => new URL(u, RAIZ).href));
    const tengo = new Set((await cache.keys()).map(r => r.url));
    for (const u of tengo) if (!quiero.has(u)) await cache.delete(u);
    for (const u of quiero) {
      if (tengo.has(u)) continue;
      try { const r = await fetch(u); if (r.ok) await cache.put(u, r); } catch (err) { return; }   // sin conexión: otra vez será
    }
  })().finally(() => { guardando = null; });
  return guardando;
}

self.addEventListener("fetch", e => {
  const pet = e.request;
  if (pet.method !== "GET" || !pet.url.startsWith(RAIZ)) return;
  e.respondWith((async () => {
    // Abrir la aplicación (también desde su icono): siempre la página guardada
    if (pet.mode === "navigate") {
      const u = new URL(pet.url);
      if (u.href.split(/[?#]/)[0] === RAIZ || u.pathname.endsWith("/ascenso.html") || u.pathname.endsWith("/index.html")) {
        const pagina = await caches.match(PAGINA, { cacheName: CACHE_APP });
        if (pagina) return pagina;
      }
    }
    const guardado = await caches.match(pet, { cacheName: CACHE_APP, ignoreSearch: true }) || await caches.match(pet, { cacheName: CACHE_IMAGENES });
    if (guardado) return guardado;
    const resp = await fetch(pet);
    // Una imagen del día vista con conexión queda guardada para después
    if (resp.ok && pet.url.startsWith(RAIZ + "assets/images/") && !pet.url.endsWith(".json")) {
      const copia = resp.clone();
      e.waitUntil(caches.open(CACHE_IMAGENES).then(c => c.put(pet, copia)).catch(() => {}));
    }
    return resp;
  })());
});

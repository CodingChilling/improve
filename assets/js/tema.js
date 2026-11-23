// Tema claro u oscuro elegido en Perfil › Ajustes (o el del sistema, «Automático»). Se carga en <head>, antes de
// pintar nada, para que la página no parpadee con el tema equivocado. La elección es de cada dispositivo.
"use strict";
window.AscensoTema=(()=>{
  const CLAVE="ascenso-tema", COLORES={light:"#E4E7E4", dark:"#1D2428"};
  const leer=()=>{ try{ const t=localStorage.getItem(CLAVE); return t==="claro"||t==="oscuro"?t:"auto"; }catch(e){ return "auto"; } };
  function aplicar(t){
    const r=document.documentElement;
    if(t==="claro") r.dataset.theme="light"; else if(t==="oscuro") r.dataset.theme="dark"; else delete r.dataset.theme;
    // La barra del navegador y la del sistema, a juego
    const metas=document.querySelectorAll('meta[name="theme-color"]');
    for(const m of metas){
      if(!m.dataset.original) m.dataset.original=m.getAttribute("content");
      const fijo=t==="claro"?COLORES.light:t==="oscuro"?COLORES.dark:null;
      m.setAttribute("content",fijo||m.dataset.original);
    }
  }
  function poner(t){ try{ if(t==="auto") localStorage.removeItem(CLAVE); else localStorage.setItem(CLAVE,t); }catch(e){} aplicar(t); document.dispatchEvent(new CustomEvent("ascenso:tema",{detail:t})); }
  aplicar(leer());
  document.addEventListener("DOMContentLoaded",()=>aplicar(leer()));
  // Si este dispositivo tiene bloqueo (bloqueo.js), la página no se ve hasta comprobar el PIN o la huella
  try{ if(localStorage.getItem("ascenso-bloqueo")==="1") document.documentElement.classList.add("bloqueada"); }catch(e){}
  return {leer, poner};
})();

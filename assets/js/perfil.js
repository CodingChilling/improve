// El perfil de Ascenso: un Hombre o una Mujer de Vitruvio (figura.js) con el nivel acumulado de toda la vida
// (niveles.js) y los Ajustes: tu perfil, apariencia, la cuenta (cuenta.js) y la configuración que antes estaba al
// final de la página del día (hábitos, tipos de entreno, imágenes y copia de seguridad).
//
// Se entra por la barra (Perfil), tocando el recuadro de la racha o el texto de estado (que lleva a Ajustes › Cuenta).
// Existe en las dos versiones; la cuenta, solo en la aplicación nueva.
"use strict";
window.AscensoPerfil=(()=>{
  const Niveles=window.AscensoNiveles, Figura=window.AscensoFigura, Cuenta=window.AscensoCuenta, Tema=window.AscensoTema;
  const nada={disponible:false, abierta:()=>false, nivel:()=>0, atras:()=>false, abrir(){}, cerrar(){}};
  if(!Niveles||!Figura) return nada;
  const $=id=>document.getElementById(id);
  const e=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const miles=n=>Math.round(n).toLocaleString("es-ES");
  const cuentaDisponible=!!(Cuenta&&Cuenta.disponible);

  // ---------------------------------------------------------------- la vista
  const vista=document.createElement("div");
  vista.className="boards perfil"; vista.id="perfil"; vista.hidden=true;
  vista.innerHTML=`<header class="bv-top pf-top">
      <button type="button" class="bv-brand" id="pf-volver" aria-label="Ascenso. Volver al día">Ascenso</button>
      <h2 class="lb-nombre">Perfil</h2>
      <div class="pf-tabs" role="tablist" aria-label="Secciones del perfil">
        <button type="button" role="tab" data-pf="resumen">Resumen</button><button type="button" role="tab" data-pf="ajustes">Ajustes</button>
      </div>
    </header>
    <div class="bv-body"><div class="bh pf-cuerpo"><section id="pf-resumen" class="pf-resumen"></section><section id="pf-ajustes" class="pf-ajustes" hidden></section></div></div>`;
  const barra=$("barra"); document.body.insertBefore(vista,barra||null);
  const resumen=$("pf-resumen"), ajustes=$("pf-ajustes");
  let pestana="resumen", libreria=null;

  // ---- Ajustes: se monta una vez; la configuración del día se traslada aquí con sus escuchas intactas
  ajustes.innerHTML=`
    <section class="pf-caja" id="pf-yo"><h3>Tu perfil</h3>
      <div class="pf-figuras" role="radiogroup" aria-label="Figura">
        <button type="button" role="radio" data-figura="hombre"><span class="pf-mini" data-mini="hombre"></span>Hombre de Vitruvio</button>
        <button type="button" role="radio" data-figura="mujer"><span class="pf-mini" data-mini="mujer"></span>Mujer de Vitruvio</button>
      </div>
      <label class="pf-campo"><span>Tu nombre</span><input type="text" id="pf-nombre" maxlength="40" placeholder="Cómo quieres que te salude" autocomplete="given-name"></label>
      <label class="pf-campo"><span>Mi porqué</span><textarea id="pf-porque" maxlength="300" rows="2" placeholder="Lo que te mueve a subir cada día"></textarea></label>
    </section>
    <section class="pf-caja" id="pf-apariencia"><h3>Apariencia</h3>
      <div class="pf-seg" role="radiogroup" aria-label="Tema">
        <button type="button" role="radio" data-tema="auto">Automático</button><button type="button" role="radio" data-tema="claro">Claro</button><button type="button" role="radio" data-tema="oscuro">Oscuro</button>
      </div>
      <p class="pf-nota">«Automático» sigue el modo claro u oscuro del dispositivo. La elección es de este dispositivo.</p>
    </section>
    ${cuentaDisponible?`<section class="pf-caja" id="pf-cuenta"><h3>Cuenta</h3><div id="pf-cuenta-sitio"></div></section>`:""}
    <div id="pf-config"></div>`;
  for(const id of ["cfg","typecfgbox","imgcfgbox","backupbox"]){ const d=$(id); if(d) $("pf-config").appendChild(d); }
  for(const m of ajustes.querySelectorAll("[data-mini]")) m.innerHTML=Figura.svg({figura:m.dataset.mini, etapa:1, titulo:""});

  function pintarAjustes(){
    const p=state.perfil;
    for(const b of ajustes.querySelectorAll("[data-figura]")) b.setAttribute("aria-checked",String(b.dataset.figura===p.figura));
    const t=Tema?Tema.leer():"auto";
    for(const b of ajustes.querySelectorAll("[data-tema]")) b.setAttribute("aria-checked",String(b.dataset.tema===t));
    const n=$("pf-nombre"), q=$("pf-porque");
    if(document.activeElement!==n) n.value=p.nombre;
    if(document.activeElement!==q) q.value=p.porque;
  }
  ajustes.addEventListener("click",ev=>{
    const f=ev.target.closest("[data-figura]");
    if(f){ state.perfil.figura=f.dataset.figura; save(); pintarAjustes(); return; }
    const t=ev.target.closest("[data-tema]");
    if(t&&Tema){ Tema.poner(t.dataset.tema); pintarAjustes(); }
  });
  ajustes.addEventListener("input",ev=>{
    if(ev.target.id==="pf-nombre"){ state.perfil.nombre=ev.target.value.replace(/\s+/g," ").trimStart().slice(0,40); save(); }
    else if(ev.target.id==="pf-porque"){ state.perfil.porque=ev.target.value.slice(0,300); save(); }
  });
  ajustes.addEventListener("focusout",ev=>{
    if(ev.target.id==="pf-nombre"||ev.target.id==="pf-porque"){ const k=ev.target.id==="pf-nombre"?"nombre":"porque"; const v=state.perfil[k].trim(); if(v!==state.perfil[k]){ state.perfil[k]=v; save(); } }
  });

  // ---------------------------------------------------------------- el resumen
  const saludo=()=>{ const h=new Date().getHours(); return h<6?"Buenas noches":h<13?"Buenos días":h<21?"Buenas tardes":"Buenas noches"; };
  const FUENTES=[["habitos","Hábitos cumplidos"],["rachas","Rachas"],["semanas","Semanas completas"],["tareas","Tareas hechas"],
    ["tarjetas","Tarjetas terminadas"],["checklists","Checklists"],["diario","Reflexiones y notas"],["lectura","Lectura"],["objetivos","Objetivos"]];
  function pintarResumen(){
    const p=state.perfil, xp=Niveles.experiencia(state,libreria), nv=Niveles.nivelDe(xp.total), et=Niveles.etapa(nv.nivel), r=Niveles.rachas(state);
    const avance=((nv.nivel-1)%10+nv.progreso)/10, sig=Niveles.etapa(Math.min(nv.nivel+10-((nv.nivel-1)%10),120));
    const nombreNivel=Niveles.nombre(nv.nivel,p.figura), max=Math.max(1,...FUENTES.map(([k])=>xp.partes[k]||0));
    const quedan=nv.hasta-xp.total, finEtapa=Math.min(120,Math.ceil(nv.nivel/10)*10);
    resumen.innerHTML=`<div class="pf-portada">
      <div class="pf-figura">${Figura.svg({figura:p.figura, etapa:nv.etapa, avance:nv.nivel>=120?0:avance, nivel:nv.progreso, objetivos:null, titulo:`${p.figura==="mujer"?"Mujer":"Hombre"} de Vitruvio, nivel ${nv.nivel}`})}</div>
      <div class="pf-datos">
        <p class="pf-saludo">${e(saludo())}${p.nombre?", "+e(p.nombre):""}</p>
        ${p.porque?`<blockquote class="pf-porque">${e(p.porque)}</blockquote>`:""}
        <div class="pf-nivel"><span class="pf-num">${nv.nivel}</span><div><strong>${e(nombreNivel)}</strong>
          <small>Etapa ${et.numero} de 12 · ${e(et.nombre)}: ${e(et.lema.toLowerCase())}</small></div></div>
        <div class="pf-barra" role="progressbar" aria-label="Progreso hacia el nivel ${nv.nivel+1}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(nv.progreso*100)}"><i style="width:${(nv.progreso*100).toFixed(1)}%"></i></div>
        <p class="pf-xp">${miles(xp.total)} puntos de experiencia · faltan ${miles(quedan)} para el nivel ${nv.nivel+1} (${e(Niveles.nombre(nv.nivel+1,p.figura))})</p>
        <div class="pf-cifras">
          <div><b>${r.actual}</b><span>${r.actual===1?"día de racha":"días de racha"}</span></div>
          <div><b>${r.mejor}</b><span>mejor racha</span></div>
          <div><b>${r.dias}</b><span>${r.dias===1?"día de camino":"días de camino"}</span></div>
        </div>
        <p class="pf-etapa">${nv.nivel>=120?"Has completado las doce etapas. Cada nivel más suma una vuelta a la lámina.":
          `La lámina se completa con cada etapa. En el nivel ${finEtapa+1} empieza la etapa «${e(sig.nombre)}»: ${e(sig.lema.toLowerCase())}.`}</p>
      </div>
    </div>
    <section class="pf-caja"><h3>De dónde viene tu experiencia</h3>
      <ul class="pf-fuentes">${FUENTES.filter(([k])=>k!=="objetivos"||xp.partes[k]).map(([k,n])=>`<li><span>${n}</span><i><b style="width:${((xp.partes[k]||0)/max*100).toFixed(1)}%"></b></i><em>${miles(xp.partes[k]||0)}</em></li>`).join("")}</ul>
      <p class="pf-nota">La experiencia se calcula a partir de lo que tienes registrado: si desmarcas un hábito o borras una tarea hecha, se resta. Archivar una tarea no la resta.</p>
    </section>`;
  }

  // ---------------------------------------------------------------- abrir, cambiar de pestaña y cerrar
  function ponerPestana(t){
    if(pestana==="ajustes"&&t!=="ajustes"&&cuentaDisponible&&Cuenta.retiene()) return false;
    if(pestana==="ajustes"&&t!=="ajustes"&&cuentaDisponible) Cuenta.desmontar();
    pestana=t;
    for(const b of vista.querySelectorAll("[data-pf]")) b.setAttribute("aria-selected",String(b.dataset.pf===t));
    resumen.hidden=t!=="resumen"; ajustes.hidden=t!=="ajustes";
    if(t==="resumen") pintarResumen();
    else { pintarAjustes(); if(cuentaDisponible) Cuenta.montarEn($("pf-cuenta-sitio")); if(typeof renderCfg==="function") try{ renderCfg(); renderTypeCfg(); }catch(err){} }
    return true;
  }
  async function cargarLibreria(){
    if(!window.AscensoLocal||(window.ASCENSO_CONFIG||{}).clasico) return;
    try{ libreria=await window.AscensoLocal.api("GET","libreria"); }catch(err){ libreria=null; }
  }
  function abrir(t="resumen",donde){
    if(window.AscensoLibreria&&window.AscensoLibreria.abierta&&window.AscensoLibreria.abierta()) window.AscensoLibreria.cerrar();
    for(const d of document.querySelectorAll("dialog[open]")) d.close();
    if(typeof closeCal==="function") closeCal(); if(typeof closePad==="function") closePad();
    const estaba=!vista.hidden;
    $("boardsview").hidden=true; document.querySelector("main").hidden=true; vista.hidden=false;
    ponerPestana(t);
    if(!estaba) scrollTo(0,0);
    if(donde){ const el=$("pf-"+donde); if(el) el.scrollIntoView({block:"start"}); }
    // La lectura suma experiencia: cuando llega, se vuelve a pintar
    cargarLibreria().then(()=>{ if(!vista.hidden&&pestana==="resumen") pintarResumen(); });
  }
  function cerrar(){
    if(vista.hidden) return true;
    if(cuentaDisponible&&Cuenta.retiene()) return false;
    if(cuentaDisponible) Cuenta.desmontar();
    vista.hidden=true;
    if(typeof showDay==="function") showDay(); else document.querySelector("main").hidden=false;
    return true;
  }
  vista.addEventListener("click",ev=>{
    if(ev.target.closest("#pf-volver")){ cerrar(); return; }
    const t=ev.target.closest("[data-pf]"); if(t) ponerPestana(t.dataset.pf);
  });
  document.addEventListener("keydown",ev=>{
    if(vista.hidden||ev.key!=="Escape") return;
    const a=document.activeElement; if(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)){ a.blur(); return; }
    if(document.querySelector("dialog[open]")) return;
    cerrar();
  });

  // La puerta escondida: el recuadro de la racha
  const racha=document.querySelector(".summit");
  if(racha){
    racha.setAttribute("role","button"); racha.tabIndex=0; racha.setAttribute("aria-label","Racha. Abrir tu perfil");
    racha.addEventListener("click",()=>abrir("resumen"));
    racha.addEventListener("keydown",ev=>{ if(ev.key==="Enter"||ev.key===" "){ ev.preventDefault(); abrir("resumen"); } });
  }
  // Cambios llegados de otro dispositivo o de otra pestaña
  document.addEventListener("ascenso:datos-externos",()=>{ if(vista.hidden) return; if(pestana==="resumen") cargarLibreria().then(pintarResumen); else pintarAjustes(); });
  document.addEventListener("ascenso:tema",()=>{ if(!vista.hidden&&pestana==="ajustes") pintarAjustes(); });

  return {
    disponible:true, abrir, cerrar,
    abierta:()=>!vista.hidden,
    nivel:()=>vista.hidden?0:1,
    atras(){ if(vista.hidden) return false; cerrar(); return true; },
  };
})();

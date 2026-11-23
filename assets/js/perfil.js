// El perfil de Ascenso: un Hombre o una Mujer de Vitruvio (figura.js) con el nivel acumulado de toda la vida
// (niveles.js) y los Ajustes: tu perfil, apariencia, la cuenta (cuenta.js) y la configuración que antes estaba al
// final de la página del día (hábitos, tipos de entreno, imágenes y copia de seguridad).
//
// Se entra por la barra (Perfil), tocando el recuadro de la racha o el texto de estado (que lleva a Ajustes › Cuenta).
// Existe en las dos versiones; la cuenta, solo en la aplicación nueva.
"use strict";
window.AscensoPerfil=(()=>{
  const Niveles=window.AscensoNiveles, Obj=window.AscensoObjetivos, Figura=window.AscensoFigura, Cuenta=window.AscensoCuenta, Tema=window.AscensoTema, Est=window.AscensoEstadisticas;
  const nada={disponible:false, abierta:()=>false, nivel:()=>0, atras:()=>false, abrir(){}, cerrar(){}};
  if(!Niveles||!Figura||!Est) return nada;
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
        <button type="button" role="tab" data-pf="resumen">Resumen</button><button type="button" role="tab" data-pf="cuerpo">Cuerpo</button><button type="button" role="tab" data-pf="habitos">Hábitos</button><button type="button" role="tab" data-pf="productividad">Productividad</button><button type="button" role="tab" data-pf="objetivos">Objetivos</button><button type="button" role="tab" data-pf="descubrir">Descubrimientos</button><button type="button" role="tab" data-pf="ajustes">Ajustes</button>
      </div>
    </header>
    <div class="bv-body"><div class="bh pf-cuerpo">
      <div class="pf-periodos" id="pf-periodos" role="radiogroup" aria-label="Periodo"><button type="button" role="radio" data-per="semana">Semana</button><button type="button" role="radio" data-per="mes">Mes</button><button type="button" role="radio" data-per="año">Año</button><button type="button" role="radio" data-per="siempre">Siempre</button></div>
      <section id="pf-resumen" class="pf-resumen"></section><section id="pf-pcuerpo" hidden></section><section id="pf-habitos" hidden></section>
      <section id="pf-productividad" hidden></section><section id="pf-objetivos" hidden></section><section id="pf-descubrir" hidden></section><section id="pf-ajustes" class="pf-ajustes" hidden></section></div></div>`;
  const barra=$("barra"); document.body.insertBefore(vista,barra||null);
  const resumen=$("pf-resumen"), ajustes=$("pf-ajustes");
  const SECCIONES={resumen, cuerpo:$("pf-pcuerpo"), habitos:$("pf-habitos"), productividad:$("pf-productividad"), objetivos:$("pf-objetivos"), descubrir:$("pf-descubrir"), ajustes};
  let pestana="resumen", libreria=null, zonaSel=null;
  // El periodo elegido se recuerda en el dispositivo (Mes, si no se ha elegido otro)
  let perClave=(()=>{ try{ const v=localStorage.getItem("ascenso-periodo"); return ["semana","mes","año","siempre"].includes(v)?v:"mes"; }catch(err){ return "mes"; } })();
  const per=()=>Est.periodo(perClave,undefined,state);
  const tipoDe=d=>typeof typeFor==="function"?typeFor(d):null;
  const brillos=p=>{ const z=Est.zonas(state,p,tipoDe), o={}; for(const k in z) o[k]=z[k].pct||0; return {z,o}; };

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
    <section class="pf-caja" id="pf-zonas"><h3>Zonas del cuerpo</h3>
      <p class="pf-nota">Elige a qué zona de la figura va cada hábito, tipo de entreno y etiqueta: la zona brilla según lo que cumplas de lo que reúne.</p>
      <p class="pf-nota" id="pf-zonas-auto" hidden>Has cambiado el reparto. <button type="button" class="linklike" data-zaccion="proponer">Volver al reparto propuesto</button></p>
      <div id="pf-zonas-lista" class="pf-zonas-lista"></div>
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
    if(t&&Tema){ Tema.poner(t.dataset.tema); pintarAjustes(); return; }
    if(ev.target.closest('[data-zaccion="proponer"]')){ state.perfil.zonas=null; save(); pintarZonasAjustes(); }
  });
  ajustes.addEventListener("change",ev=>{
    const s=ev.target.closest("[data-zref]"); if(!s) return;
    const r=JSON.parse(JSON.stringify(Est.repartoDe(state))), ref=s.dataset.zref;
    for(const [k] of Est.ZONAS) r[k]=(r[k]||[]).filter(x=>x!==ref);
    if(s.value) r[s.value].push(ref);
    state.perfil.zonas=r; save(); $("pf-zonas-auto").hidden=false;
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
    const quedan=nv.hasta-xp.total, finEtapa=Math.min(120,Math.ceil(nv.nivel/10)*10), objs=evaluarObjetivos(xp);
    resumen.innerHTML=`<div class="pf-portada">
      <div class="pf-figura">${Figura.svg({figura:p.figura, etapa:nv.etapa, avance:nv.nivel>=120?0:avance, nivel:nv.progreso, objetivos:Obj?Obj.progresoMedio(objs):null, brillo:brillos(per()).o, titulo:`${p.figura==="mujer"?"Mujer":"Hombre"} de Vitruvio, nivel ${nv.nivel}`})}</div>
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
    ${bloqueObjetivosResumen(objs)}
    ${bloquePeriodo()}
    ${bloqueDescubrimientos(3)}
    <section class="pf-caja"><h3>De dónde viene tu experiencia</h3>
      <ul class="pf-fuentes">${FUENTES.filter(([k])=>k!=="objetivos"||xp.partes[k]).map(([k,n])=>`<li><span>${n}</span><i><b style="width:${((xp.partes[k]||0)/max*100).toFixed(1)}%"></b></i><em>${miles(xp.partes[k]||0)}</em></li>`).join("")}</ul>
      <p class="pf-nota">La experiencia se calcula a partir de lo que tienes registrado: si desmarcas un hábito o borras una tarea hecha, se resta. Archivar una tarea no la resta.</p>
    </section>`;
  }

  // ---------------------------------------------------------------- abrir, cambiar de pestaña y cerrar
  // ---------------------------------------------------------------- estadísticas
  const pc=x=>x==null?"—":Math.round(x*100)+" %";
  const n1=n=>n==null?"—":n.toLocaleString("es-ES",{maximumFractionDigits:1});
  const PRIOS=[["urgente","Urgente"],["alta","Alta"],["media","Media"],["baja","Baja"]];
  const NOMBRE_ANIMO=["","Muy mal","Mal","Normal","Bien","Muy bien"];
  const fechaCorta=k=>Est.deClave(k).toLocaleDateString("es-ES",{weekday:"short",day:"numeric",month:"short"});
  // Cambio frente al periodo anterior: en puntos (porcentajes) o en unidades
  function cambio(a,b,{puntos=true,unidad=""}={}){
    if(a==null||b==null) return "";
    const d=puntos?Math.round((a-b)*100):Math.round((a-b)*10)/10;
    if(!d) return `<span class="pf-cambio" title="Igual que en el periodo anterior">= que antes</span>`;
    return `<span class="pf-cambio ${d>0?"sube":"baja"}" title="Frente al periodo anterior">${d>0?"▲":"▼"} ${Math.abs(d).toLocaleString("es-ES")}${puntos?" pts":unidad}</span>`;
  }
  const tile=(valor,texto,extra="")=>`<div class="pf-tile"><b>${valor}</b><span>${texto}</span>${extra}</div>`;
  const barraH=(x,titulo,color)=>`<i class="pf-b" title="${e(titulo)}"><b style="width:${Math.max(0,Math.min(1,x||0))*100}%${color?`;background:${color}`:""}"></b></i>`;
  function nivelActual(){ const xp=Niveles.experiencia(state,libreria), nv=Niveles.nivelDe(xp.total); return {xp,nv,avance:nv.nivel>=120?0:((nv.nivel-1)%10+nv.progreso)/10}; }
  function bloquePeriodo(){
    const P=per(), h=Est.habitos(state,P), t=Est.productividad(state,P), a=Est.animo(state,P);
    return `<section class="pf-caja"><h3>${e(P.nombre)}</h3>
      <div class="pf-tiles">${tile(pc(h.pct),"hábitos cumplidos",cambio(h.pct,h.anterior))}${tile(t.hechas,t.hechas===1?"tarea terminada":"tareas terminadas",cambio(t.hechas,t.anterior,{puntos:false}))}
        ${tile(a.media==null?"—":n1(a.media)+"<small>/5</small>","ánimo medio",cambio(a.media,a.anterior,{puntos:false}))}${tile(a.n,a.n===1?"día con ánimo":"días con ánimo")}</div>
      ${graficaAnimo(a)}
    </section>`;
  }
  // El ánimo de cada día del periodo (si es largo, la media de cada semana)
  function graficaAnimo(a){
    if(!a.n) return `<p class="pf-nota">Marca cómo te sientes cada día (las caras bajo tus hábitos) para ver aquí tu ánimo.</p>`;
    let puntos=a.serie;
    if(puntos.length>62){ const g=[]; for(let i=0;i<puntos.length;i+=7){ const l=puntos.slice(i,i+7), v=l.filter(x=>x.a).map(x=>x.a); g.push({k:l[0].k,a:v.length?v.reduce((s,x)=>s+x,0)/v.length:null,semana:true}); } puntos=g; }
    return `<div class="pf-animo" role="img" aria-label="Ánimo en el periodo: media ${n1(a.media)} sobre 5">${puntos.map(x=>`<span title="${e((x.semana?"Semana del ":"")+fechaCorta(x.k)+": "+(x.a==null?"sin registrar":n1(x.a)+(x.semana?"":" · "+NOMBRE_ANIMO[x.a])))}"><i style="height:${x.a?x.a/5*100:0}%"></i></span>`).join("")}</div>
      <div class="pf-eje"><span>${e(fechaCorta(puntos[0].k))}</span><span>${e(fechaCorta(puntos[puntos.length-1].k))}</span></div>`;
  }
  function bloqueDescubrimientos(max){
    const l=Est.descubrimientos(state,tipoDe);
    const lista=l.slice(0,max||l.length);
    return `<section class="pf-caja pf-descubre"><h3>Descubrimientos</h3>
      ${max?"":`<p class="pf-nota">Relaciones que aparecen en tus datos: solo se muestran con al menos dos semanas de datos en cada caso y diferencias claras. Son coincidencias, no causas.</p>`}
      ${lista.length?`<ul>${lista.map(x=>`<li><p>${e(x.texto)}</p><small>Con ${x.base} ${x.unidad==="días"?(x.base===1?"día":"días")+" de datos":x.unidad}</small></li>`).join("")}</ul>`
        :`<p class="pf-nota">Aún no hay datos suficientes para descubrir nada con seguridad. Con unas semanas de hábitos, ánimo y tareas, aparecerán aquí.</p>`}
      ${max&&l.length>max?`<button type="button" class="add alt" data-pf="descubrir">Ver los ${l.length} descubrimientos</button>`:""}
    </section>`;
  }
  function pintarCuerpo(){
    const P=per(), {nv,avance}=nivelActual(), {z,o}=brillos(P), auto=!state.perfil.zonas;
    if(!zonaSel) zonaSel="cabeza";
    const zs=z[zonaSel];
    SECCIONES.cuerpo.innerHTML=`<div class="pf-portada">
      <div class="pf-figura pf-zonas-fig">${Figura.svg({figura:state.perfil.figura, etapa:nv.etapa, avance, nivel:nv.progreso, brillo:o, zonaActiva:zonaSel, titulo:"Zonas del cuerpo"})}</div>
      <div>
        <p class="pf-nota">Cada zona brilla según lo cumplido de lo que reúne (${e(P.nombre.toLowerCase())}). Toca una zona para ver el detalle.
          ${auto?"El reparto lo propone Ascenso por el nombre de cada hábito, tipo de entreno y etiqueta: ":""}<button type="button" class="linklike" data-ir-ajustes="zonas">${auto?"cámbialo en Ajustes":"Cambiar el reparto"}</button>.</p>
        <ul class="pf-lista-zonas">${Est.ZONAS.map(([k,n])=>`<li><button type="button" data-zona="${k}" aria-pressed="${k===zonaSel}"><span>${n}</span>${barraH(z[k].pct,n+": "+pc(z[k].pct))}<em>${pc(z[k].pct)}</em></button></li>`).join("")}</ul>
        <div class="pf-caja pf-detalle"><h3>${e(zs.nombre)}</h3>
          ${zs.refs.length?`<ul class="pf-filas">${zs.refs.map(r=>`<li><span class="pf-punto" style="background:${r.color||"var(--gold)"}"></span><span class="pf-n">${e(r.nombre)}</span>${barraH(r.pct,r.nombre+": "+pc(r.pct),r.color)}<em>${r.total?pc(r.pct):"sin datos"}</em>${cambio(r.pct,r.anterior)}</li>`).join("")}</ul>`
            :`<p class="pf-nota">Nada asignado a esta zona.</p>`}
        </div>
      </div></div>`;
  }
  function pintarHabitos(){
    const P=per(), h=Est.habitos(state,P), r=Niveles.rachas(state), cal=Est.calendario(state), L=["L","M","X","J","V","S","D"];
    SECCIONES.habitos.innerHTML=`<div class="pf-tiles">${tile(pc(h.pct),"hábitos cumplidos · "+e(P.nombre.toLowerCase()),cambio(h.pct,h.anterior))}${tile(r.actual,"días de racha")}${tile(r.mejor,"mejor racha")}</div>
      <section class="pf-caja"><h3>Por día de la semana</h3>
        <div class="pf-columnas">${h.porDia.map((x,i)=>`<div title="${Est.DIAS[i]}: ${pc(x)}"><i><b style="height:${(x||0)*100}%"></b></i><span>${L[i]}</span><em>${pc(x)}</em></div>`).join("")}</div></section>
      <section class="pf-caja"><h3>El último año</h3>
        <div class="pf-cal-marco"><div class="pf-cal" role="img" aria-label="Constancia diaria del último año">${cal.map(x=>`<i${x.r==null?(x.futuro?' class="fut"':""):` style="--r:${x.r.toFixed(2)}"`} title="${e(fechaCorta(x.k))}${x.r==null?"":": "+pc(x.r)}"></i>`).join("")}</div></div>
        <div class="pf-leyenda"><span>Menos</span><i style="--r:.1"></i><i style="--r:.4"></i><i style="--r:.7"></i><i style="--r:1"></i><span>Más</span></div></section>
      <section class="pf-caja"><h3>Cada hábito</h3>
        <ul class="pf-filas pf-habitos">${h.porHabito.map(x=>`<li><span class="pf-n">${e(x.nombre)}</span>${barraH(x.pct,x.nombre+": "+pc(x.pct))}<em>${pc(x.pct)}</em>${cambio(x.pct,x.anterior)}
          <small>${x.hechos} de ${x.total} · racha ${x.actual} · mejor ${x.mejor}</small>
          <span class="pf-mini-dias" aria-hidden="true">${x.porDia.map((v,i)=>`<i title="${Est.DIAS[i]}: ${pc(v)}"><b style="height:${(v||0)*100}%"></b></i>`).join("")}</span></li>`).join("")}</ul></section>`;
    const m=SECCIONES.habitos.querySelector(".pf-cal-marco"); if(m) m.scrollLeft=m.scrollWidth;
  }
  function pintarProductividad(){
    const P=per(), t=Est.productividad(state,P), max=Math.max(1,...t.serie.map(x=>x.n));
    const colorPrio=k=>`var(--p-${k})`;
    SECCIONES.productividad.innerHTML=`<div class="pf-tiles">${tile(t.hechas,"tareas terminadas · "+e(P.nombre.toLowerCase()),cambio(t.hechas,t.anterior,{puntos:false}))}${tile(t.creadas,"tareas creadas")}${tile(t.atrasadas,"atrasadas, sin terminar")}${tile(t.tarjetasHechas,"tarjetas terminadas")}${tile(t.checklist,"elementos de checklist hechos")}</div>
      <section class="pf-caja"><h3>Tareas terminadas</h3>
        <div class="pf-columnas pf-serie">${t.serie.map(x=>`<div title="${e(x.etiqueta)}: ${x.n}"><i><b style="height:${x.n/max*100}%"></b></i><span>${e(x.etiqueta)}</span><em>${x.n||""}</em></div>`).join("")}</div></section>
      <section class="pf-caja"><h3>Por prioridad</h3><p class="pf-nota">De las tareas de los días del periodo, cuántas se terminaron.</p>
        <ul class="pf-filas">${PRIOS.map(([k,n])=>{ const x=t.porPrioridad[k]; return `<li><span class="pf-punto" style="background:${colorPrio(k)}"></span><span class="pf-n">${n}</span>${barraH(x.total?x.hechas/x.total:0,n+": "+x.hechas+" de "+x.total)}<em>${x.hechas} de ${x.total}</em></li>`; }).join("")}</ul>
        ${PRIOS.some(([k])=>t.tiempo[k])?`<p class="pf-nota">Tiempo medio desde que se crean hasta que se terminan: ${PRIOS.filter(([k])=>t.tiempo[k]).map(([k,n])=>`${n.toLowerCase()}, ${n1(t.tiempo[k].dias)} días`).join(" · ")}.</p>`:""}</section>
      ${t.porEtiqueta.length?`<section class="pf-caja"><h3>Por etiqueta</h3><ul class="pf-filas">${t.porEtiqueta.map(x=>`<li><span class="pf-punto" style="background:${x.color}"></span><span class="pf-n">${e(x.nombre)}</span>${barraH(x.hechas/x.total,x.nombre+": "+x.hechas+" de "+x.total)}<em>${x.hechas} de ${x.total}</em></li>`).join("")}</ul></section>`:""}`;
  }
  // ---------------------------------------------------------------- objetivos
  const clasico=!!(window.ASCENSO_CONFIG||{}).clasico;
  const TIPOS_OBJ=Obj?Obj.TIPOS.filter(([k])=>k!=="libros"||!clasico):[];
  const EXPLICA={
    racha:"Llegar a esa racha de días seguidos cumpliendo tus hábitos de racha, contando desde hoy.",
    habito:"Cumplir un hábito al menos ese porcentaje de los días que le tocan, desde hoy hasta la fecha. Se decide al terminar el plazo.",
    tareas:"Terminar ese número de tareas desde hoy hasta la fecha.",
    reflexiones:"Escribir la reflexión del día ese número de días.",
    libros:"Terminar de leer ese número de libros de tu librería.",
    nivel:"Llegar a ese nivel antes de la fecha."};
  const META={racha:["Días seguidos",7,1,100000],habito:["Porcentaje de los días",80,1,100],tareas:["Tareas",10,1,100000],reflexiones:["Días con reflexión",10,1,100000],libros:["Libros",1,1,100000],nivel:["Nivel",2,1,100000]};
  let tipoObj="racha", formAbierto=null;
  const claveDe=d=>Est.clave(d);
  const hoyK=()=>{ const d=new Date(); d.setHours(0,0,0,0); return claveDe(d); };
  const fechaObj=k=>{ const d=Est.deClave(k); return d.toLocaleDateString("es-ES",d.getFullYear()===new Date().getFullYear()?{day:"numeric",month:"short"}:{day:"numeric",month:"short",year:"numeric"}); };
  function finDe(cual){
    const d=new Date(); d.setHours(0,0,0,0);
    if(cual==="semana") d.setDate(d.getDate()+(7-(d.getDay()||7)));
    else if(cual==="mes") d.setMonth(d.getMonth()+1,0);
    else d.setMonth(12,0);
    return claveDe(d);
  }
  // El nivel con el que se miden los objetivos de nivel: sin contar lo que dan los propios objetivos (como en niveles.js)
  function evaluarObjetivos(xp){
    if(!Obj) return [];
    xp=xp||Niveles.experiencia(state,libreria);
    return Obj.evaluar(state,{libreria,nivel:Niveles.nivelDe(xp.total-(xp.partes.objetivos||0)).nivel});
  }
  function cifraObj(g){
    const m=g.m;
    if(!m.medible) return g.tipo==="habito"?"El hábito de este objetivo ya no existe.":clasico?"La lectura solo se mide en la aplicación nueva.":"Cargando la librería…";
    if(g.tipo==="habito") return `${m.valor} % de los días · meta ${m.meta} %`;
    if(g.tipo==="nivel") return `Nivel ${m.valor} de ${m.meta}`;
    const falta=m.meta-m.valor;
    return `${miles(m.valor)} de ${miles(m.meta)} ${m.unidad}${m.estado==="en-curso"&&falta>0?` · faltan ${miles(falta)}`:""}`;
  }
  function plazoObj(g){
    const m=g.m;
    if(m.estado==="cumplido") return `Cumplido el ${fechaObj(m.cumplidoEl)}`;
    if(m.estado==="no-alcanzado") return `Terminó el ${fechaObj(g.hasta)}`;
    if(m.estado==="pendiente") return `Empieza el ${fechaObj(g.desde)}`;
    const q=m.quedanDias;
    return q<=0?"Termina hoy":q===1?"Queda 1 día · mañana":`Quedan ${q} días · hasta el ${fechaObj(g.hasta)}`;
  }
  function tarjetaObj(g,{acciones=true,pequena=false}={}){
    const m=g.m, cl=m.estado==="cumplido"?" ok":m.estado==="no-alcanzado"?" no":"";
    return `<li class="pf-obj${cl}" data-obj="${e(g.id)}">
      <div class="pf-obj-cab"><strong>${m.estado==="cumplido"?'<span class="pf-obj-marca" aria-hidden="true">✓</span>':""}${e(g.titulo)}</strong><small>${e(plazoObj(g))}</small></div>
      ${barraH(m.progreso,g.titulo+": "+Math.round(m.progreso*100)+" %")}
      <p class="pf-obj-cifra">${e(cifraObj(g))}</p>
      ${acciones&&!pequena?`<div class="pf-obj-acc">${g.archivado?`<button type="button" class="linklike" data-oarch="${e(g.id)}" data-v="0">Recuperar</button>`:`<button type="button" class="linklike" data-oarch="${e(g.id)}" data-v="1">Archivar</button>`}
        <button type="button" class="linklike pf-borrar" data-odel="${e(g.id)}">Eliminar</button></div>`:""}
    </li>`;
  }
  function bloqueObjetivosResumen(l){
    const curso=l.filter(g=>!g.archivado&&g.m.estado==="en-curso");
    if(!Obj) return "";
    if(!curso.length) return `<section class="pf-caja pf-objs-res"><h3>Objetivos</h3><p class="pf-nota">Ponte un objetivo con fecha: una racha, un hábito, tareas, reflexiones${clasico?"":", libros"} o un nivel. El cuadrado de la figura se completa con su progreso. <button type="button" class="linklike" data-pf="objetivos">Crear un objetivo</button></p></section>`;
    return `<section class="pf-caja pf-objs-res"><h3>Objetivos en curso</h3><ul class="pf-objs">${curso.slice(0,3).map(g=>tarjetaObj(g,{pequena:true})).join("")}</ul>
      <button type="button" class="add alt" data-pf="objetivos">${curso.length>3?`Ver los ${curso.length} objetivos`:"Ver los objetivos"}</button></section>`;
  }
  function formularioObj(){
    const hs=state.habits, nv=nivelActual().nv.nivel;
    if(tipoObj==="habito"&&!hs.length) tipoObj="racha";
    const [nombre,def,min,max]=META[tipoObj], metaDef=tipoObj==="nivel"?nv+1:def;
    return `<details class="pf-caja pf-obj-nuevo" id="pf-obj-nuevo"${formAbierto?" open":""}><summary><h3>Nuevo objetivo</h3></summary>
      <form id="pf-obj-form" autocomplete="off" novalidate>
        <div class="pf-seg pf-obj-tipos" role="radiogroup" aria-label="Tipo de objetivo">${TIPOS_OBJ.map(([k,n])=>`<button type="button" role="radio" data-otipo="${k}" aria-checked="${k===tipoObj}"${k==="habito"&&!hs.length?' disabled title="Aún no tienes hábitos"':""}>${n}</button>`).join("")}</div>
        <p class="pf-nota">${e(EXPLICA[tipoObj])}${tipoObj==="nivel"?` Ahora estás en el nivel ${nv}.`:""}</p>
        <div class="pf-obj-campos">
          ${tipoObj==="habito"?`<label class="pf-campo"><span>Hábito</span><select id="pf-obj-ref">${hs.map(h=>`<option value="${e(h.id)}">${e(h.t)}</option>`).join("")}</select></label>`:""}
          <label class="pf-campo"><span>${nombre}</span><input type="number" id="pf-obj-meta" inputmode="numeric" min="${tipoObj==="nivel"?nv+1:min}" max="${max}" step="1" value="${metaDef}" required></label>
          <label class="pf-campo"><span>Fecha límite</span><input type="date" id="pf-obj-hasta" min="${hoyK()}" value="${finDe("mes")}" required></label>
        </div>
        <div class="pf-obj-atajos" role="group" aria-label="Atajos de fecha"><button type="button" class="chip" data-ohasta="semana">Fin de semana</button><button type="button" class="chip" data-ohasta="mes">Fin de mes</button><button type="button" class="chip" data-ohasta="año">Fin de año</button></div>
        <label class="pf-campo"><span>Título (opcional)</span><input type="text" id="pf-obj-titulo" maxlength="80" placeholder="Se pone solo si lo dejas vacío"></label>
        <p class="pf-error" id="pf-obj-error" role="alert" hidden></p>
        <button type="submit" class="add">Añadir objetivo</button>
      </form></details>`;
  }
  function pintarObjetivos(){
    const caja=SECCIONES.objetivos;
    if(!Obj){ caja.innerHTML=""; return; }
    // Si se está escribiendo en el formulario, no se repinta (llegan cambios de otro dispositivo o la librería)
    const f=$("pf-obj-form"); if(f&&f.contains(document.activeElement)){ pintarListaObj(); return; }
    const l=evaluarObjetivos();
    if(formAbierto===null) formAbierto=!l.length;
    caja.innerHTML=formularioObj()+`<div id="pf-obj-lista"></div>`;
    pintarListaObj(l);
  }
  function pintarListaObj(l){
    l=l||evaluarObjetivos();
    const vivos=l.filter(g=>!g.archivado), grupo=(t,lista,nota="")=>lista.length?`<section class="pf-caja"><h3>${t}</h3>${nota}<ul class="pf-objs">${lista.map(g=>tarjetaObj(g)).join("")}</ul></section>`:"";
    const curso=vivos.filter(g=>g.m.estado==="en-curso"||g.m.estado==="pendiente"), media=Obj.progresoMedio(l);
    const arch=l.filter(g=>g.archivado);
    $("pf-obj-lista").innerHTML=(l.length?"":`<p class="pf-nota pf-obj-vacio">Aún no tienes objetivos. Cada objetivo cumplido suma ${Niveles.PUNTOS.objetivo} puntos de experiencia, y el cuadrado de la figura se completa con el progreso de los que tienes en curso.</p>`)+
      grupo("En curso",curso,media==null?"":`<p class="pf-nota">Progreso medio: ${Math.round(media*100)} %. Es lo que dibuja el cuadrado de la figura.</p>`)+
      grupo("Cumplidos",vivos.filter(g=>g.m.estado==="cumplido").sort((a,b)=>b.m.cumplidoEl.localeCompare(a.m.cumplidoEl)),`<p class="pf-nota">Cada uno suma ${Niveles.PUNTOS.objetivo} puntos de experiencia.</p>`)+
      grupo("No alcanzados",vivos.filter(g=>g.m.estado==="no-alcanzado").reverse())+
      (arch.length?`<details class="pf-caja pf-obj-arch"><summary><h3>Archivados (${arch.length})</h3></summary><ul class="pf-objs">${arch.map(g=>tarjetaObj(g)).join("")}</ul></details>`:"");
  }
  function errorObj(t){ const p=$("pf-obj-error"); p.textContent=t; p.hidden=!t; }
  function crearObjetivo(){
    const meta=Number($("pf-obj-meta").value), hasta=$("pf-obj-hasta").value, desde=hoyK(), ref=$("pf-obj-ref")?$("pf-obj-ref").value:null;
    const [,,min,max]=META[tipoObj];
    if(!Number.isInteger(meta)||meta<min||meta>max){ errorObj(`Escribe un número entero entre ${min} y ${miles(max)}.`); $("pf-obj-meta").focus(); return; }
    if(!/^\d{4}-\d{2}-\d{2}$/.test(hasta)||hasta<desde){ errorObj("La fecha límite tiene que ser hoy o más adelante."); $("pf-obj-hasta").focus(); return; }
    if((Est.deClave(hasta)-Est.deClave(desde))/864e5>1830){ errorObj("El plazo puede ser de cinco años como mucho."); $("pf-obj-hasta").focus(); return; }
    if(tipoObj==="habito"&&!state.habits.some(h=>h.id===ref)){ errorObj("Elige un hábito."); return; }
    state.objetivos[newId("o")]={titulo:$("pf-obj-titulo").value.trim().slice(0,80), tipo:tipoObj, ref:tipoObj==="habito"?ref:null, meta, desde, hasta, archivado:false, creado:new Date().toISOString()};
    save();
    formAbierto=false; document.activeElement&&document.activeElement.blur&&document.activeElement.blur();
    pintarObjetivos();
  }
  vista.addEventListener("submit",ev=>{ if(ev.target.id!=="pf-obj-form") return; ev.preventDefault(); crearObjetivo(); });
  vista.addEventListener("toggle",ev=>{ if(ev.target.id==="pf-obj-nuevo") formAbierto=ev.target.open; },true);
  vista.addEventListener("click",ev=>{
    let el;
    if((el=ev.target.closest("[data-otipo]"))){ tipoObj=el.dataset.otipo; const t=$("pf-obj-titulo").value, h=$("pf-obj-hasta").value; SECCIONES.objetivos.querySelector("#pf-obj-nuevo").outerHTML=formularioObj(); $("pf-obj-titulo").value=t; if(h) $("pf-obj-hasta").value=h; const b=SECCIONES.objetivos.querySelector(`[data-otipo="${tipoObj}"]`); if(b) b.focus(); return; }
    if((el=ev.target.closest("[data-ohasta]"))){ $("pf-obj-hasta").value=finDe(el.dataset.ohasta); errorObj(""); return; }
    if((el=ev.target.closest("[data-oarch]"))){ const g=state.objetivos[el.dataset.oarch]; if(g){ g.archivado=el.dataset.v==="1"; save(); pintarListaObj(); } return; }
    if((el=ev.target.closest("[data-odel]"))){ const id=el.dataset.odel; armDelete(el,()=>{ delete state.objetivos[id]; save(); pintarListaObj(); },"Pulsa otra vez para eliminar"); return; }
  });

  function pintarDescubrir(){ SECCIONES.descubrir.innerHTML=bloqueDescubrimientos(0); }
  // Ajustes › Zonas del cuerpo: a qué zona va cada hábito, tipo de entreno y etiqueta
  function pintarZonasAjustes(){
    const caja=$("pf-zonas-lista"); if(!caja||caja.contains(document.activeElement)) return;
    const r=Est.repartoDe(state), zonaDe=ref=>{ for(const [k] of Est.ZONAS) if((r[k]||[]).includes(ref)) return k; return ""; };
    const fila=(ref,nombre,color)=>`<label class="pf-zfila">${color?`<span class="pf-punto" style="background:${color}"></span>`:""}<span>${e(nombre)}</span>
      <select data-zref="${ref}" aria-label="Zona de «${e(nombre)}»"><option value="">Ninguna</option>${Est.ZONAS.map(([k,n])=>`<option value="${k}"${zonaDe(ref)===k?" selected":""}>${n}</option>`).join("")}</select></label>`;
    const grupo=(t,l)=>l.length?`<h4>${t}</h4>${l.join("")}`:"";
    caja.innerHTML=grupo("Hábitos",state.habits.map(h=>fila("h:"+h.id,h.t)))+grupo("Tipos de entreno",state.tipos.filter(t=>!t.oculto).map(t=>fila("t:"+t.id,t.name,t.color)))+
      grupo("Etiquetas de las tareas",Object.entries(state.tags).map(([id,g])=>fila("e:"+id,g.name,g.color)));
    $("pf-zonas-auto").hidden=!state.perfil.zonas;
  }

  const PINTAR={resumen:()=>pintarResumen(), cuerpo:pintarCuerpo, habitos:pintarHabitos, productividad:pintarProductividad, objetivos:pintarObjetivos, descubrir:pintarDescubrir};
  function pintarPestana(){
    for(const b of $("pf-periodos").querySelectorAll("[data-per]")) b.setAttribute("aria-checked",String(b.dataset.per===perClave));
    $("pf-periodos").hidden=pestana==="ajustes"||pestana==="descubrir"||pestana==="objetivos";
    if(PINTAR[pestana]) PINTAR[pestana]();
  }
  function ponerPestana(t){
    if(pestana==="ajustes"&&t!=="ajustes"&&cuentaDisponible&&Cuenta.retiene()) return false;
    if(pestana==="ajustes"&&t!=="ajustes"&&cuentaDisponible) Cuenta.desmontar();
    pestana=t;
    for(const b of vista.querySelectorAll(".pf-tabs [data-pf]")) b.setAttribute("aria-selected",String(b.dataset.pf===t));
    for(const [k,el] of Object.entries(SECCIONES)) el.hidden=k!==t;
    if(t==="ajustes"){ pintarAjustes(); pintarZonasAjustes(); if(cuentaDisponible) Cuenta.montarEn($("pf-cuenta-sitio")); if(typeof renderCfg==="function") try{ renderCfg(); renderTypeCfg(); }catch(err){} }
    pintarPestana();
    const tab=vista.querySelector(`.pf-tabs [data-pf="${t}"]`); if(tab&&tab.scrollIntoView) tab.scrollIntoView({block:"nearest",inline:"nearest"});
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
    cargarLibreria().then(()=>{ if(!vista.hidden&&pestana!=="ajustes") pintarPestana(); });
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
    const t=ev.target.closest("[data-pf]"); if(t){ ponerPestana(t.dataset.pf); if(!t.closest(".pf-tabs")) scrollTo(0,0); return; }
    const p=ev.target.closest("[data-per]");
    if(p){ perClave=p.dataset.per; try{ localStorage.setItem("ascenso-periodo",perClave); }catch(err){} pintarPestana(); return; }
    const z=ev.target.closest("[data-zona]");
    if(z&&pestana==="cuerpo"){ zonaSel=z.dataset.zona; pintarCuerpo(); return; }
    const a=ev.target.closest("[data-ir-ajustes]");
    if(a){ ponerPestana("ajustes"); const el=$("pf-"+a.dataset.irAjustes); if(el) el.scrollIntoView({block:"start"}); }
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
  document.addEventListener("ascenso:datos-externos",()=>{ if(vista.hidden) return; if(pestana==="ajustes"){ pintarAjustes(); pintarZonasAjustes(); } else cargarLibreria().then(pintarPestana); });
  document.addEventListener("ascenso:tema",()=>{ if(!vista.hidden&&pestana==="ajustes") pintarAjustes(); });

  return {
    disponible:true, abrir, cerrar,
    abierta:()=>!vista.hidden,
    nivel:()=>vista.hidden?0:1,
    atras(){ if(vista.hidden) return false; cerrar(); return true; },
  };
})();

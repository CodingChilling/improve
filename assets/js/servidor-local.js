// «Servidor de bolsillo» de Ascenso: las mismas rutas, respuestas, validaciones y límites que servidor.py,
// pero dentro del navegador y con los datos en IndexedDB (ver almacen.js). No usa la red.
//
// Cada entidad es un registro {tabla, id, actualizado, borrado, valores}; «valores» tiene la misma forma
// que usa la página. Las relaciones (marcas de un día, etiquetas de una tarea, checklist de una tarjeta)
// van dentro de su registro. Borrar marca «borrado» (y lo que cuelga de él); las lecturas lo ignoran.
// Cada escritura deja además una entrada en «pendientes», que es lo que se envía a la cuenta.
"use strict";
window.AscensoLocal=(()=>{
  const Almacen=window.AscensoAlmacen;

  const FECHA_RE=/^\d{4}-\d{2}-\d{2}$/, ID_RE=/^[A-Za-z0-9_-]{1,40}$/, COLOR_RE=/^#[0-9A-Fa-f]{6}$/;
  const HORA_RE=/^([01][0-9]|2[0-3]):[0-5][0-9]$/;
  const TIPOS=new Set(["climb","strength","active","rest"]);
  const UMBRALES=new Set([0.5,0.66,0.75,1.0]);
  const PRIORIDADES=new Set(["urgente","alta","media","baja"]);
  const PRIORIDADES_TARJETA=new Set([...PRIORIDADES,"ninguna"]);
  const LISTAS=new Set(["pendiente","proceso","hecha"]);
  const MAX_DIAS_EVENTO=366;
  const LIMITE_LIBRETA=1000000;          // caracteres por libreta (de un mapa o de un nodo)
  const MAX_IMAGEN=15*1024*1024;         // bytes por imagen
  const DIAS_HUERFANAS=30;               // días que se conserva una imagen que ya no está en ninguna libreta
  const TIPOS_IMAGEN=new Set(["image/webp","image/png","image/jpeg","image/gif"]);
  const VERSION_APP=12;
  const TABLAS=["config","habitos","dias","historial","etiquetas","tareas","notas","eventos","tableros",
                "etiquetas_tablero","listas","tarjetas","mapas","nodos","conexiones","adjuntos"];

  class ErrorDatos extends Error{}
  const mal=m=>{ throw new ErrorDatos(m); };
  const errorBD=()=>{ throw new ErrorDatos("error de la base de datos"); };

  // ---- utilidades que imitan a Python ----
  const texto=v=>v?String(v):"";                                  // str(v or "")
  const cortar=(s,n)=>s.length<=n?s:[...s].slice(0,n).join("");   // s[:n], sin partir caracteres
  const esDic=x=>!!x&&typeof x==="object"&&!Array.isArray(x);
  const comprobarId=(v,que)=>{ if(!ID_RE.test(String(v))) mal("id de "+que+" no válido"); return String(v); };
  const entero=(v,que)=>{
    const n=typeof v==="number"?v:typeof v==="string"&&/^\s*[+-]?\d+\s*$/.test(v)?Number(v):typeof v==="boolean"?+v:NaN;
    if(!Number.isFinite(n)) mal(que+" no válido");
    return Math.trunc(n);
  };
  const realONada=v=>{
    if(v===null||v===undefined||v==="") return null;
    const n=typeof v==="number"?v:typeof v==="string"&&v.trim()!==""?Number(v):NaN;
    if(Number.isNaN(n)||!(n>-1e7&&n<1e7)) mal("posición no válida");
    return n;
  };
  const dato=(d,k,defecto)=>k in d?d[k]:defecto;                  // dict.get(k, defecto)
  const fechaReal=f=>{ const [a,m,d]=f.split("-").map(Number), t=new Date(Date.UTC(a,m-1,d));
    return t.getUTCFullYear()===a&&t.getUTCMonth()===m-1&&t.getUTCDate()===d?t.getTime():null; };
  const hoyLocal=()=>{ const d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };

  // ---- datos en memoria (copia de «registros») ----
  let mem=null, lista=null;
  const escuchas=[];
  const canal=typeof BroadcastChannel==="function"?new BroadcastChannel("ascenso"):null;
  let ultimoMs=0, dispositivo="";
  // Marca de tiempo de cada cambio (ISO, UTC): nunca retrocede en este dispositivo y siempre es posterior
  // a la versión del registro que sustituye (así un cambio hecho aquí gana a lo que ya se había visto)
  function ahora(previa){
    ultimoMs=Math.max(Date.now(),ultimoMs+1,previa?Date.parse(previa)+1||0:0);
    return new Date(ultimoMs).toISOString();
  }
  const idAleatorio=()=>{ const b=crypto.getRandomValues(new Uint8Array(12)); return "d"+[...b].map(x=>x.toString(16).padStart(2,"0")).join(""); };

  async function cargar(){
    const m={}; for(const t of TABLAS) m[t]=new Map();
    for(const r of await Almacen.todos("registros")){
      if(!m[r.tabla]) continue;
      m[r.tabla].set(r.id,r);
    }
    mem=m;
    if(!dispositivo){
      dispositivo=await Almacen.meta("dispositivo");
      if(!dispositivo){ dispositivo=idAleatorio(); await Almacen.ponerMeta("dispositivo",dispositivo); }
    }
  }
  function preparar(){
    if(!lista){
      lista=cargar().then(()=>{
        try{ if(navigator.storage&&navigator.storage.persist) navigator.storage.persist().catch(()=>{}); }catch(e){}
        setTimeout(()=>limpiarAdjuntos().catch(()=>{}),5000);
        setInterval(()=>limpiarAdjuntos().catch(()=>{}),3600000);
      });
      lista.catch(()=>{ lista=null; });
    }
    return lista;
  }
  // Otra pestaña ha guardado algo: se vuelve a leer la base de datos
  if(canal) canal.onmessage=e=>{
    if(!e.data||e.data.tipo!=="cambio"||!mem) return;
    encolar(cargar).then(()=>{
      for(const u of urls.values()) URL.revokeObjectURL(u); urls.clear();
      document.dispatchEvent(new CustomEvent("ascenso:datos-externos"));
      for(const f of escuchas){ try{ f([]); }catch(err){} }
    }).catch(()=>{});
  };

  // ---- operación en curso: los cambios se acumulan y se guardan todos a la vez (o ninguno) ----
  class Operacion{
    constructor(){ this.cambios=new Map(); this.blobs=new Map(); this.sinBlob=new Set(); }
    _k(t,id){ return t+"\u0000"+id; }
    leer(t,id){
      const c=this.cambios.get(this._k(t,id));
      if(c) return c.borrado?null:c.valores;
      const r=mem[t].get(id);
      return r&&!r.borrado?r.valores:null;
    }
    todos(t){
      const out=new Map();
      for(const [id,r] of mem[t]) if(!r.borrado) out.set(id,r.valores);
      for(const c of this.cambios.values()) if(c.tabla===t){ if(c.borrado) out.delete(c.id); else out.set(c.id,c.valores); }
      return out;
    }
    poner(t,id,valores){ this.cambios.set(this._k(t,id),{tabla:t,id,borrado:false,valores}); }
    borrar(t,id){ this.cambios.set(this._k(t,id),{tabla:t,id,borrado:true,valores:null}); }
  }

  async function confirmar(op){
    const regs=[];
    for(const c of op.cambios.values()){
      const prev=mem[c.tabla].get(c.id);
      if(c.borrado){ if(!prev||prev.borrado) continue; }
      else if(prev&&!prev.borrado&&JSON.stringify(prev.valores)===JSON.stringify(c.valores)&&!op.blobs.has(c.id)) continue;
      regs.push({tabla:c.tabla,id:c.id,actualizado:ahora(prev&&prev.actualizado),borrado:c.borrado,valores:c.valores,dispositivo});
    }
    if(!regs.length) return [];
    await Almacen.tx(["registros","pendientes","adjuntos"],"readwrite",s=>{
      for(const r of regs){
        s.registros.put(r);
        s.pendientes.put({tabla:r.tabla,id:r.id,actualizado:r.actualizado,borrado:r.borrado,datos:r.valores});
        if(r.tabla==="adjuntos"){
          if(r.borrado) s.adjuntos.delete(r.id);
          else if(op.blobs.has(r.id)) s.adjuntos.put({id:r.id,tipo:r.valores.t,datos:op.blobs.get(r.id)});
        }
      }
    });
    for(const r of regs){
      mem[r.tabla].set(r.id,r);
      if(r.tabla==="adjuntos"){
        const u=urls.get(r.id); if(u){ URL.revokeObjectURL(u); urls.delete(r.id); }
      }
    }
    if(canal) canal.postMessage({tipo:"cambio"});
    for(const f of escuchas){ try{ f(regs); }catch(e){} }
    return regs;
  }

  // Las peticiones se atienden de una en una, como las transacciones del servidor
  let cola=Promise.resolve();
  function encolar(f){ const p=cola.then(f,f); cola=p.catch(()=>{}); return p; }

  // ---------------------------------------------------------------- lectura
  function leerEstado(){
    const vivos=t=>{ const o=new Map(); for(const [id,r] of mem[t]) if(!r.borrado) o.set(id,r.valores); return o; };
    const config={}; for(const [k,v] of vivos("config")) config[k]=v.v;
    const habitosT=vivos("habitos");
    const habitos=[...habitosT].sort((a,b)=>a[1].orden-b[1].orden||(a[0]<b[0]?-1:1))
      .map(([id,h])=>({id,t:h.t,s:h.s,streak:!!h.streak,week:!!h.week,days:h.days.map(Boolean)}));
    const dias={};
    for(const [fecha,v] of vivos("dias")){
      const d={};
      if(v.w!==null&&v.w!==undefined) d.w=v.w;
      if(v.type) d.type=v.type;
      for(const hid of Object.keys(v.c||{})) if(habitosT.has(hid)) (d.c=d.c||{})[hid]=true;
      if(Object.keys(d).length) dias[fecha]=d;
    }
    const historial={};
    for(const [fecha,v] of vivos("historial")){ const e={}; if(v.q) e.q=v.q; if(v.img) e.img=v.img; historial[fecha]=e; }
    const etiquetasT=vivos("etiquetas"), etiquetas={};
    for(const [id,v] of etiquetasT) etiquetas[id]={name:v.name,color:v.color};
    const tareas={};
    for(const [id,v] of vivos("tareas")) tareas[id]={date:v.date,title:v.title,notes:v.notes,prio:v.prio,list:v.list,created:v.created,
      tags:(v.tags||[]).filter(e=>etiquetasT.has(e)),archived:v.archived||null};
    const notas={}; for(const [f,v] of vivos("notas")) notas[f]={r:v.r,n:v.n};
    const eventos={};
    for(const [id,v] of vivos("eventos")) eventos[id]={start:v.start,end:v.end,time:v.time||"",title:v.title,color:v.color,created:v.created};
    // Tableros: lo que cuelga de algo que ya no existe no se muestra
    const tablerosT=vivos("tableros"), tableros={};
    for(const [id,v] of tablerosT) tableros[id]={name:v.name,color:v.color,fav:!!v.fav,order:v.order,created:v.created};
    const etiquetasTab={}, idsEtiquetasTab=new Set();
    for(const [id,v] of vivos("etiquetas_tablero")) if(tablerosT.has(v.board)){ etiquetasTab[id]={board:v.board,name:v.name,color:v.color}; idsEtiquetasTab.add(id); }
    const listas={};
    for(const [id,v] of vivos("listas")) if(tablerosT.has(v.board)) listas[id]={board:v.board,title:v.title,order:v.order,collapsed:!!v.collapsed};
    const tarjetas={};
    for(const [id,v] of vivos("tarjetas")) if(listas[v.list]) tarjetas[id]={list:v.list,title:v.title,desc:v.desc,prio:v.prio,due:v.due||"",
      labels:(v.labels||[]).filter(e=>idsEtiquetasTab.has(e)),check:(v.check||[]).map(p=>({id:p.id,t:p.t,d:!!p.d})),order:v.order,created:v.created,archived:v.archived||null};
    // Mapas
    const mapasT=vivos("mapas"), mapas={};
    for(const [id,v] of mapasT) mapas[id]={title:v.title,color:v.color,fav:!!v.fav,order:v.order,notes:v.notes,created:v.created};
    const nodosT=vivos("nodos"), nodos={}, visible=new Map();
    const seVe=(id,camino)=>{
      if(visible.has(id)) return visible.get(id);
      const n=nodosT.get(id);
      let ok=!!n&&mapasT.has(n.map);
      if(ok&&n.parent) ok=!camino.has(id)&&seVe(n.parent,new Set(camino).add(id));
      visible.set(id,ok); return ok;
    };
    for(const [id,v] of nodosT) if(seVe(id,new Set())) nodos[id]={map:v.map,parent:v.parent||null,title:v.title,color:v.color||"",x:v.x,y:v.y,notes:v.notes,created:v.created};
    const conexiones={};
    for(const [id,v] of vivos("conexiones")) if(nodos[v.a]&&nodos[v.b]) conexiones[id]={a:v.a,b:v.b};
    const adjuntos={}; for(const [id,v] of vivos("adjuntos")) adjuntos[id]={t:v.t,w:v.w,h:v.h};
    const hay=o=>Object.keys(o).length>0;
    const vacia=!hay(config)&&!habitos.length&&!hay(dias)&&!hay(historial)&&!hay(etiquetas)&&!hay(tareas)&&!hay(notas)&&!hay(eventos)&&!hay(tableros)&&!hay(mapas);
    const nada=v=>v===undefined?null:v;
    return {plan:nada(config.plan),thr:nada(config.thr),tipos:nada(config.tipos),habits:habitos,days:dias,hist:historial,tags:etiquetas,tasks:tareas,
      notes:notas,events:eventos,boards:tableros,blabels:etiquetasTab,blists:listas,cards:tarjetas,maps:mapas,mnodes:nodos,mlinks:conexiones,
      att:adjuntos,vacia,version:VERSION_APP};
  }

  // ---------------------------------------------------------------- validación y guardado
  function validarPlan(plan){
    if(!Array.isArray(plan)||plan.length!==7||plan.some(p=>!TIPOS.has(p))) mal("plan semanal no válido");
    return plan.slice();
  }
  function validarTipos(tipos){
    if(!esDic(tipos)) mal("nombres de los tipos no válidos");
    const o={};
    for(const [k,v] of Object.entries(tipos)){ const t=String(v).trim(); if(TIPOS.has(k)&&t) o[k]=cortar(t,30); }
    return o;
  }
  function validarUmbral(thr){
    const n=typeof thr==="number"?thr:typeof thr==="string"&&thr.trim()!==""?Number(thr):NaN;
    if(!UMBRALES.has(n)) mal("umbral de racha no válido");
    return n;
  }
  function guardarConfig(op,d){
    if(!esDic(d)) d={};
    if("plan" in d) op.poner("config","plan",{v:validarPlan(d.plan)});
    if("thr" in d) op.poner("config","thr",{v:validarUmbral(d.thr)});
    if("tipos" in d) op.poner("config","tipos",{v:validarTipos(d.tipos)});
  }
  function guardarHabitos(op,listaH){
    if(!Array.isArray(listaH)||listaH.length>100) mal("lista de hábitos no válida");
    const vistos=new Set(), limpios=[];
    for(const h of listaH){
      if(!esDic(h)||!ID_RE.test(String(dato(h,"id","")))) mal("hábito sin identificador válido");
      const hid=String(h.id);
      if(vistos.has(hid)) mal("hábito repetido: "+hid);
      vistos.add(hid);
      let dias=h.days; if(!Array.isArray(dias)||dias.length!==7) dias=[true,true,true,true,true,true,true];
      limpios.push([hid,{t:cortar(String(h.t||"Hábito").trim()||"Hábito",60),s:cortar(texto(h.s),120),
        streak:h.streak!==false,week:h.week!==false,days:dias.map(Boolean)}]);
    }
    // Quitar solo los hábitos eliminados (sus marcas dejan de contar)
    for(const id of op.todos("habitos").keys()) if(!vistos.has(id)) op.borrar("habitos",id);
    limpios.forEach(([id,v],orden)=>op.poner("habitos",id,{...v,orden}));
  }
  function guardarDia(op,fecha,d){
    if(!FECHA_RE.test(fecha)) mal("fecha no válida");
    if(!esDic(d)) mal("día no válido");
    let peso=d.w;
    if(peso!==null&&peso!==undefined){
      peso=typeof peso==="number"?peso:typeof peso==="string"&&peso.trim()!==""?Number(peso):typeof peso==="boolean"?+peso:NaN;
      if(Number.isNaN(peso)) mal("peso no válido");
      peso=Math.round(peso*10)/10;
      if(!(peso>=20&&peso<=400)) mal("peso fuera de rango");
    } else peso=null;
    const tipo=d.type===undefined?null:d.type;
    if(tipo!==null&&!TIPOS.has(tipo)) mal("tipo de entreno no válido");
    const marcas=d.c||{};
    if(!esDic(marcas)) mal("marcas no válidas");
    const v={}, c={};
    if(peso!==null) v.w=peso;
    if(tipo!==null) v.type=tipo;
    // Solo se guardan marcas de hábitos que existen
    for(const [k,val] of Object.entries(marcas)) if(val===true&&ID_RE.test(k)&&op.leer("habitos",k)) c[k]=true;
    if(Object.keys(c).length) v.c=c;
    if(Object.keys(v).length) op.poner("dias",fecha,v); else op.borrar("dias",fecha);
  }
  function guardarHistorial(op,fecha,d){
    if(!FECHA_RE.test(fecha)) mal("fecha no válida");
    if(!esDic(d)) mal("historial no válido");
    const v={};
    const frase=d.q;
    if(frase!==null&&frase!==undefined){ if(!ID_RE.test(String(frase))) mal("id de frase no válido"); v.q=String(frase); }
    if(d.img!==null&&d.img!==undefined){
      const imagen=String(d.img);
      if(imagen.length>300||imagen.includes("\u0000")) mal("ruta de imagen no válida");
      if(imagen) v.img=imagen;
    }
    op.poner("historial",fecha,v);
  }
  function nombreYColor(d){
    const nombre=cortar(texto(d.name).trim(),30), color=texto(d.color);
    if(!nombre) mal("la etiqueta necesita un nombre");
    if(!COLOR_RE.test(color)) mal("color no válido");
    return {nombre,color:color.toUpperCase()};
  }
  function guardarEtiqueta(op,eid,d){
    eid=comprobarId(eid,"etiqueta");
    if(!esDic(d)) mal("etiqueta no válida");
    const {nombre,color}=nombreYColor(d);
    op.poner("etiquetas",eid,{name:nombre,color});
  }
  function guardarTarea(op,tid,d){
    tid=comprobarId(tid,"tarea");
    if(!esDic(d)) mal("tarea no válida");
    const fecha=texto(d.date);
    if(!FECHA_RE.test(fecha)) mal("fecha de la tarea no válida");
    const titulo=cortar(texto(d.title).trim(),120);
    if(!titulo) mal("la tarea necesita un título");
    if(!PRIORIDADES.has(d.prio)) mal("prioridad no válida");
    if(!LISTAS.has(d.list)) mal("lista no válida");
    const etiquetas=d.tags||[];
    if(!Array.isArray(etiquetas)) mal("etiquetas no válidas");
    const prev=op.leer("tareas",tid);
    const tags=[];
    // Solo se asocian etiquetas que existen
    for(const e of etiquetas){ const s=String(e); if(ID_RE.test(s)&&op.leer("etiquetas",s)&&!tags.includes(s)) tags.push(s); }
    op.poner("tareas",tid,{date:fecha,title:titulo,notes:cortar(texto(d.notes),2000),prio:d.prio,list:d.list,
      created:prev?prev.created:(cortar(texto(d.created),40)||fecha),tags,archived:d.archived?cortar(String(d.archived),40):null});
  }
  function guardarNotas(op,fecha,d){
    if(!FECHA_RE.test(fecha)) mal("fecha no válida");
    if(!esDic(d)) mal("notas no válidas");
    const r=cortar(texto(d.r),20000), n=cortar(texto(d.n),20000);
    if(!r.trim()&&!n.trim()){ op.borrar("notas",fecha); return; }   // día sin nada escrito
    op.poner("notas",fecha,{r,n});
  }
  function guardarEvento(op,eid,d){
    eid=comprobarId(eid,"evento");
    if(!esDic(d)) mal("evento no válido");
    const inicio=texto(d.start), fin=texto(d.end||d.start);
    if(!FECHA_RE.test(inicio)||!FECHA_RE.test(fin)) mal("fechas del evento no válidas");
    const a=fechaReal(inicio), b=fechaReal(fin);
    if(a===null||b===null) mal("fechas del evento no válidas");
    const dias=Math.round((b-a)/86400000);
    if(dias<0) mal("el evento termina antes de empezar");
    if(dias>MAX_DIAS_EVENTO) mal("el evento dura demasiado");
    const hora=texto(d.time);
    if(hora&&!HORA_RE.test(hora)) mal("hora no válida");
    const titulo=cortar(texto(d.title).trim(),120);
    if(!titulo) mal("el evento necesita un título");
    const color=texto(d.color);
    if(!COLOR_RE.test(color)) mal("color no válido");
    const prev=op.leer("eventos",eid);
    op.poner("eventos",eid,{start:inicio,end:fin,time:hora,title:titulo,color:color.toUpperCase(),
      created:prev?prev.created:(cortar(texto(d.created),40)||inicio)});
  }

  // ---- tableros ----
  function guardarTablero(op,bid,d){
    bid=comprobarId(bid,"tablero");
    if(!esDic(d)) mal("tablero no válido");
    const nombre=cortar(texto(d.name).trim(),60), color=texto(d.color);
    if(!nombre) mal("el tablero necesita un nombre");
    if(!COLOR_RE.test(color)) mal("color no válido");
    const prev=op.leer("tableros",bid);
    op.poner("tableros",bid,{name:nombre,color:color.toUpperCase(),fav:!!d.fav,order:entero(dato(d,"order",0),"orden"),
      created:prev?prev.created:cortar(texto(d.created),40)});
  }
  function guardarEtiquetaTablero(op,eid,d){
    eid=comprobarId(eid,"etiqueta");
    if(!esDic(d)) mal("etiqueta no válida");
    const {nombre,color}=nombreYColor(d);
    const tablero=comprobarId(d.board,"tablero");
    if(!op.leer("tableros",tablero)) errorBD();
    op.poner("etiquetas_tablero",eid,{board:tablero,name:nombre,color});
  }
  function guardarLista(op,lid,d){
    lid=comprobarId(lid,"lista");
    if(!esDic(d)) mal("lista no válida");
    const titulo=cortar(texto(d.title).trim(),60);
    if(!titulo) mal("la lista necesita un título");
    const tablero=comprobarId(d.board,"tablero"), orden=entero(dato(d,"order",0),"orden");
    if(!op.leer("tableros",tablero)) errorBD();
    op.poner("listas",lid,{board:tablero,title:titulo,order:orden,collapsed:!!d.collapsed});
  }
  function guardarTarjeta(op,cid,d){
    cid=comprobarId(cid,"tarjeta");
    if(!esDic(d)) mal("tarjeta no válida");
    const listaId=comprobarId(d.list,"lista");
    const titulo=cortar(texto(d.title).trim(),200);
    if(!titulo) mal("la tarjeta necesita un título");
    if(!PRIORIDADES_TARJETA.has(d.prio)) mal("prioridad no válida");
    const limite=texto(d.due);
    if(limite&&!FECHA_RE.test(limite)) mal("fecha límite no válida");
    const etiquetas=d.labels||[], checklist=d.check||[];
    if(!Array.isArray(etiquetas)||!Array.isArray(checklist)||checklist.length>100) mal("tarjeta no válida");
    const orden=entero(dato(d,"order",0),"orden");
    const enLista=op.leer("listas",listaId);
    if(!enLista) errorBD();
    const prev=op.leer("tarjetas",cid);
    const labels=[];
    // Solo etiquetas que existen y son del mismo tablero que la tarjeta
    for(const e of etiquetas){
      const s=String(e), et=ID_RE.test(s)?op.leer("etiquetas_tablero",s):null;
      if(et&&et.board===enLista.board&&!labels.includes(s)) labels.push(s);
    }
    const check=[];
    for(const punto of checklist){
      if(!esDic(punto)) mal("elemento de la checklist no válido");
      const t=cortar(texto(punto.t).trim(),300);
      if(t) check.push({id:comprobarId(punto.id,"elemento"),t,d:!!punto.d});
    }
    op.poner("tarjetas",cid,{list:listaId,title:titulo,desc:cortar(texto(d.desc),10000),prio:d.prio,due:limite,labels,check,order:orden,
      created:prev?prev.created:cortar(texto(d.created),40),archived:d.archived?cortar(String(d.archived),40):null});
  }

  // ---- mapas de nodos ----
  function guardarMapa(op,mid,d){
    mid=comprobarId(mid,"mapa");
    if(!esDic(d)) mal("mapa no válido");
    const titulo=cortar(texto(d.title).trim(),80), color=texto(d.color);
    if(!titulo) mal("el mapa necesita un título");
    if(!COLOR_RE.test(color)) mal("color no válido");
    const prev=op.leer("mapas",mid);
    op.poner("mapas",mid,{title:titulo,color:color.toUpperCase(),fav:!!d.fav,order:entero(dato(d,"order",0),"orden"),
      notes:cortar(texto(d.notes),LIMITE_LIBRETA),created:prev?prev.created:cortar(texto(d.created),40)});
  }
  function guardarNodo(op,nid,d){
    nid=comprobarId(nid,"nodo");
    if(!esDic(d)) mal("nodo no válido");
    const mapa=comprobarId(d.map,"mapa");
    let padre=d.parent;
    if(padre){
      padre=comprobarId(padre,"nodo");
      const fila=op.leer("nodos",padre);
      if(!fila||fila.map!==mapa||padre===nid) mal("el nodo padre no es de este mapa");
    } else padre=null;
    const titulo=cortar(texto(d.title).trim(),120);
    if(!titulo) mal("el nodo necesita un título");
    const color=texto(d.color);
    if(color&&!COLOR_RE.test(color)) mal("color no válido");
    const x=realONada(d.x), y=realONada(d.y);
    if(!op.leer("mapas",mapa)) errorBD();
    const prev=op.leer("nodos",nid);
    op.poner("nodos",nid,{map:mapa,parent:padre,title:titulo,color:color.toUpperCase(),x,y,
      notes:cortar(texto(d.notes),LIMITE_LIBRETA),created:prev?prev.created:cortar(texto(d.created),40)});
  }
  function guardarConexion(op,cid,d){
    cid=comprobarId(cid,"conexión");
    if(!esDic(d)) mal("conexión no válida");
    const a=comprobarId(d.a,"nodo"), b=comprobarId(d.b,"nodo");
    const na=op.leer("nodos",a), nb=op.leer("nodos",b);
    if(a===b||!na||!nb) mal("conexión no válida");
    // Solo se conectan nodos del mismo nivel (mismo mapa y mismo nodo padre)
    if(na.map!==nb.map||(na.parent||null)!==(nb.parent||null)) mal("solo se pueden conectar nodos del mismo nivel");
    op.poner("conexiones",cid,{a,b});
  }

  // ---- imágenes de las libretas ----
  function deBase64(b64){
    let bin; try{ bin=atob(b64); }catch(e){ mal("imagen no válida"); }
    const u=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i);
    return u;
  }
  function aBase64(buf){
    const u=new Uint8Array(buf); let s="";
    for(let i=0;i<u.length;i+=0x8000) s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));
    return btoa(s);
  }
  // Se comprueba que el contenido es de verdad una imagen del tipo indicado
  function guardarAdjunto(op,aid,d){
    aid=comprobarId(aid,"imagen");
    if(!esDic(d)) mal("imagen no válida");
    const tipo=texto(d.tipo);
    if(!TIPOS_IMAGEN.has(tipo)) mal("tipo de imagen no admitido");
    const crudo=deBase64(texto(d.datos));
    if(!(crudo.length>0&&crudo.length<=MAX_IMAGEN)) mal("imagen demasiado grande");
    const es=(desde,bytes)=>bytes.every((x,i)=>crudo[desde+i]===x), asc=s=>[...s].map(c=>c.charCodeAt(0));
    const firmas={"image/png":es(0,[0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]),"image/jpeg":es(0,[0xFF,0xD8,0xFF]),
      "image/gif":es(0,asc("GIF87a"))||es(0,asc("GIF89a")),"image/webp":es(0,asc("RIFF"))&&es(8,asc("WEBP"))};
    if(!firmas[tipo]) mal("el contenido no es una imagen válida");
    const ancho=entero(d.ancho,"ancho"), alto=entero(d.alto,"alto");
    if(!(ancho>0&&ancho<=20000&&alto>0&&alto<=20000)) mal("tamaño de imagen no válido");
    const prev=op.leer("adjuntos",aid);
    op.poner("adjuntos",aid,{t:tipo,w:ancho,h:alto,bytes:crudo.length,creado:prev?prev.creado:new Date().toISOString()});
    op.blobs.set(aid,crudo.buffer);
    op.sinBlob.delete(aid);
  }
  async function copiaAdjuntos(){
    const out={};
    for(const a of await Almacen.todos("adjuntos")){
      const r=mem.adjuntos.get(a.id);
      if(r&&!r.borrado&&a.datos) out[a.id]={tipo:r.valores.t,ancho:r.valores.w,alto:r.valores.h,datos:aBase64(a.datos)};
    }
    return out;
  }
  // Marca las imágenes que ya no están en ninguna libreta y borra las que llevan 30 días así
  let limpiezaPermitida=()=>true;
  function limpiarAdjuntos(){
    return encolar(async()=>{
      if(!mem||!limpiezaPermitida()) return;
      const huerfanos=(await Almacen.meta("huerfanos"))||{}, hoy=hoyLocal(), op=new Operacion();
      const libretas=[]; for(const t of ["nodos","mapas"]) for(const r of mem[t].values()) if(!r.borrado&&r.valores.notes) libretas.push(r.valores.notes);
      let cambia=false;
      for(const [id,r] of mem.adjuntos){
        if(r.borrado){ if(huerfanos[id]){ delete huerfanos[id]; cambia=true; } continue; }
        const usada=libretas.some(n=>n.includes("imagen:"+id+")")||n.includes("imagen:"+id+"|"));
        if(usada&&huerfanos[id]){ delete huerfanos[id]; cambia=true; }
        else if(!usada&&!huerfanos[id]){ huerfanos[id]=hoy; cambia=true; }
        else if(!usada&&(fechaReal(hoy)-fechaReal(huerfanos[id]))/86400000>=DIAS_HUERFANAS){ op.borrar("adjuntos",id); delete huerfanos[id]; cambia=true; }
      }
      await confirmar(op);
      if(cambia) await Almacen.ponerMeta("huerfanos",huerfanos);
    });
  }

  // ---- borrados: se marca el registro y, como los ON DELETE CASCADE del esquema, lo que cuelga de él ----
  function borrarTablero(op,id){
    id=comprobarId(id,"tablero"); op.borrar("tableros",id);
    for(const [eid,e] of op.todos("etiquetas_tablero")) if(e.board===id) op.borrar("etiquetas_tablero",eid);
    for(const [lid,l] of op.todos("listas")) if(l.board===id) borrarLista(op,lid);
  }
  function borrarLista(op,id){
    id=comprobarId(id,"lista"); op.borrar("listas",id);
    for(const [cid,c] of op.todos("tarjetas")) if(c.list===id) op.borrar("tarjetas",cid);
  }
  function borrarMapa(op,id){
    id=comprobarId(id,"mapa"); op.borrar("mapas",id);
    const fuera=new Set();
    for(const [nid,n] of op.todos("nodos")) if(n.map===id){ op.borrar("nodos",nid); fuera.add(nid); }
    for(const [cid,c] of op.todos("conexiones")) if(fuera.has(c.a)||fuera.has(c.b)) op.borrar("conexiones",cid);
  }
  function borrarNodo(op,id){
    id=comprobarId(id,"nodo");
    const nodos=op.todos("nodos"), fuera=new Set([id]);
    for(let crece=true;crece;){ crece=false; for(const [nid,n] of nodos) if(n.parent&&fuera.has(n.parent)&&!fuera.has(nid)){ fuera.add(nid); crece=true; } }
    for(const nid of fuera) op.borrar("nodos",nid);
    for(const [cid,c] of op.todos("conexiones")) if(fuera.has(c.a)||fuera.has(c.b)) op.borrar("conexiones",cid);
  }
  const borrarSimple=(tabla,que)=>(op,id)=>op.borrar(tabla,comprobarId(id,que));

  const RUTAS={
    "etiquetas/":[guardarEtiqueta,borrarSimple("etiquetas","etiqueta")],
    "tareas/":[guardarTarea,borrarSimple("tareas","tarea")],
    "eventos/":[guardarEvento,borrarSimple("eventos","evento")],
    "tableros/":[guardarTablero,borrarTablero],
    "etiquetas-tablero/":[guardarEtiquetaTablero,borrarSimple("etiquetas_tablero","etiqueta")],
    "listas/":[guardarLista,borrarLista],
    "tarjetas/":[guardarTarjeta,borrarSimple("tarjetas","tarjeta")],
    "mapas/":[guardarMapa,borrarMapa],
    "nodos/":[guardarNodo,borrarNodo],
    "conexiones/":[guardarConexion,borrarSimple("conexiones","conexión")],
  };

  // ---- importar una copia (la que exporta Ascenso, también la versión clásica de Python) ----
  function importar(op,estado){
    if(!esDic(estado)||!esDic(estado.days)) mal("copia no válida");
    // Se sustituye todo menos las imágenes, igual que en el servidor
    for(const t of TABLAS) if(t!=="adjuntos") for(const id of op.todos(t).keys()) op.borrar(t,id);
    const config={}; for(const k of ["plan","thr","tipos"]) if(estado[k]!==null&&estado[k]!==undefined) config[k]=estado[k];
    guardarConfig(op,config);
    guardarHabitos(op,estado.habits||[]);
    for(const [fecha,d] of Object.entries(estado.days)) guardarDia(op,fecha,d);
    const cada=(clave,guardar)=>{ const c=estado[clave]||{}; if(esDic(c)) for(const [id,d] of Object.entries(c)) guardar(op,id,d); };
    cada("hist",guardarHistorial); cada("tags",guardarEtiqueta); cada("tasks",guardarTarea); cada("notes",guardarNotas); cada("events",guardarEvento);
    cada("boards",guardarTablero); cada("blabels",guardarEtiquetaTablero); cada("blists",guardarLista); cada("cards",guardarTarjeta); cada("maps",guardarMapa);
    cada("adjuntos",guardarAdjunto);
    const nodos=estado.mnodes||{};
    if(esDic(nodos)){
      // Un padre siempre antes que sus hijos
      const prof=(id,visto)=>{ const p=(nodos[id]||{}).parent; return !p||!(p in nodos)||visto.includes(p)?0:1+prof(p,[...visto,id]); };
      const orden=Object.entries(nodos).map(e=>[prof(e[0],[]),e]).sort((a,b)=>a[0]-b[0]);
      for(const [,[id,d]] of orden) guardarNodo(op,id,d);
    }
    cada("mlinks",guardarConexion);
  }

  // ---- imágenes del día: la lista se genera al publicar (herramientas/generar.py) ----
  async function listarImagenes(){
    const r=await fetch("assets/images/lista.json",{cache:"no-cache"});
    if(!r.ok) throw new Error("no hay lista de imágenes");
    const l=await r.json();
    if(!Array.isArray(l)) throw new Error("lista de imágenes no válida");
    return l.filter(x=>x&&typeof x.nombre==="string"&&typeof x.url==="string");
  }

  // ---- direcciones de las imágenes de las libretas (se leen de la base de datos según hacen falta) ----
  const urls=new Map(), cargando=new Set();
  const HUECO="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
  let alFaltar=null;
  function urlAdjunto(id){
    if(urls.has(id)) return urls.get(id);
    if(!cargando.has(id)){
      cargando.add(id);
      (async()=>{
        let a=await Almacen.leer("adjuntos",id);
        if((!a||!a.datos)&&alFaltar) a=await alFaltar(id);          // con cuenta: se descarga
        if(!a||!a.datos) return;
        const u=URL.createObjectURL(new Blob([a.datos],{type:a.tipo}));
        urls.set(id,u);
        for(const im of document.querySelectorAll('img[data-adj="'+CSS.escape(id)+'"]')) im.src=u;
      })().catch(()=>{}).then(()=>cargando.delete(id));
    }
    return HUECO;
  }

  // ---------------------------------------------------------------- sincronización con la cuenta
  // ¿Gana la versión «a» a la «b»? El último cambio según «actualizado»; si empatan, el dispositivo mayor
  const gana=(a,b)=>!b||a.actualizado>b.actualizado||(a.actualizado===b.actualizado&&(a.dispositivo||"")>(b.dispositivo||""));
  const registroValido=r=>esDic(r)&&TABLAS.includes(r.tabla)&&typeof r.id==="string"&&r.id.length>0&&r.id.length<=40
    &&typeof r.actualizado==="string"&&!Number.isNaN(Date.parse(r.actualizado))&&(r.borrado===true||esDic(r.valores));

  // Aplica cambios llegados de otros dispositivos, sin volver a apuntarlos como pendientes.
  // «meta» son ajustes que se guardan en la misma transacción (por ejemplo, el último cambio recibido).
  function aplicarRemotos(remotos,meta){
    return encolar(async()=>{
      await preparar();
      const pendientes=new Map((await Almacen.todos("pendientes")).map(p=>[p.tabla+"\u0000"+p.id,p]));
      const ganan=new Map(), reafirmar=new Map();
      for(const r of remotos){
        if(!registroValido(r)) continue;
        const k=r.tabla+"\u0000"+r.id, local=ganan.get(k)||mem[r.tabla].get(r.id);
        const reg={tabla:r.tabla,id:r.id,actualizado:r.actualizado,borrado:r.borrado===true,valores:r.borrado===true?null:r.valores,dispositivo:String(r.dispositivo||"")};
        if(gana(reg,local)){ ganan.set(k,reg); reafirmar.delete(k); }
        // Lo de aquí es más reciente y ya se había enviado: se vuelve a enviar, para que lo último que tenga la cuenta sea lo que vale
        else if(local&&(local.dispositivo||dispositivo)===dispositivo&&!pendientes.has(k)&&(local.actualizado!==reg.actualizado||local.dispositivo!==reg.dispositivo)) reafirmar.set(k,local);
      }
      await Almacen.tx(["registros","pendientes","adjuntos","meta"],"readwrite",s=>{
        for(const [k,r] of ganan){
          s.registros.put(r);
          if(pendientes.has(k)) s.pendientes.delete([r.tabla,r.id]);          // el cambio local pendiente ha perdido
          if(r.tabla==="adjuntos"&&r.borrado) s.adjuntos.delete(r.id);
        }
        for(const r of reafirmar.values()) s.pendientes.put({tabla:r.tabla,id:r.id,actualizado:r.actualizado,borrado:r.borrado,datos:r.valores});
        for(const [clave,valor] of Object.entries(meta||{})) s.meta.put({clave,valor});
      });
      for(const r of ganan.values()){
        mem[r.tabla].set(r.id,r);
        const ms=Date.parse(r.actualizado); if(ms>ultimoMs&&ms<Date.now()+300000) ultimoMs=ms;
        if(r.tabla==="adjuntos"&&r.borrado){ const u=urls.get(r.id); if(u){ URL.revokeObjectURL(u); urls.delete(r.id); } }
      }
      if(ganan.size){
        if(canal) canal.postMessage({tipo:"cambio"});
        document.dispatchEvent(new CustomEvent("ascenso:datos-externos"));
      }
      return {aplicados:ganan.size,reenviar:reafirmar.size};
    });
  }
  // Apunta todo lo que hay en este dispositivo como pendiente de enviar (al unirlo a una cuenta)
  const encolarTodo=()=>encolar(async()=>{
    await preparar();
    await Almacen.tx(["pendientes"],"readwrite",s=>{
      for(const t of TABLAS) for(const r of mem[t].values()) s.pendientes.put({tabla:r.tabla,id:r.id,actualizado:r.actualizado,borrado:r.borrado,datos:r.valores});
    });
  });
  // Borra los datos de este dispositivo (no la cuenta ni el identificador del dispositivo)
  const vaciarDatos=()=>encolar(async()=>{
    await preparar();
    await Almacen.tx(["registros","pendientes","adjuntos","meta"],"readwrite",s=>{
      s.registros.clear(); s.pendientes.clear(); s.adjuntos.clear(); s.meta.delete("huerfanos"); s.meta.delete("semilla");
    });
    for(const u of urls.values()) URL.revokeObjectURL(u); urls.clear();
    for(const t of TABLAS) mem[t]=new Map();
    if(canal) canal.postMessage({tipo:"cambio"});
  });
  // Datos iniciales de una instalación nueva: se anota cuándo se pusieron, para saber si después se ha escrito algo propio
  const marcarSemilla=()=>encolar(async()=>{ await preparar(); await Almacen.ponerMeta("semilla",new Date(ultimoMs||Date.now()).toISOString()); });
  const hayDatosPropios=()=>encolar(async()=>{
    await preparar();
    const semilla=await Almacen.meta("semilla");
    // (El historial lo apunta la página sola cada día: no cuenta como algo escrito por la persona)
    for(const t of TABLAS) if(t!=="historial") for(const r of mem[t].values()) if(!semilla||r.actualizado>semilla) return true;
    return false;
  });
  // Guarda el contenido de una imagen descargada de la cuenta
  const guardarBlob=(id,tipo,datos)=>Almacen.guardar("adjuntos",{id,tipo,datos});

  // ---------------------------------------------------------------- rutas
  async function atender(metodo,ruta,cuerpo){
    ruta=String(ruta).replace(/^\/?(api\/)?/,"");
    if(metodo==="GET"&&ruta==="ping") return {app:"ascenso",version:VERSION_APP};
    if(metodo==="POST"&&ruta==="apagar") return {ok:true};
    if(metodo==="GET"&&ruta==="imagenes") return listarImagenes();
    await preparar();
    if(metodo==="GET"&&ruta==="estado") return leerEstado();
    if(metodo==="GET"&&ruta==="adjuntos-copia") return copiaAdjuntos();
    const op=new Operacion(), nada=v=>v===undefined?null:v;
    cuerpo=nada(cuerpo);
    if(metodo==="PUT"&&ruta.startsWith("adjuntos/")) guardarAdjunto(op,ruta.slice(9),cuerpo);
    else if(metodo==="PUT"&&ruta==="config") guardarConfig(op,cuerpo||{});
    else if(metodo==="PUT"&&ruta==="habitos") guardarHabitos(op,cuerpo);
    else if(metodo==="PUT"&&ruta.startsWith("dias/")) guardarDia(op,ruta.slice(5),cuerpo||{});
    else if(metodo==="PUT"&&ruta.startsWith("historial/")) guardarHistorial(op,ruta.slice(10),cuerpo||{});
    else if(metodo==="PUT"&&ruta.startsWith("notas/")) guardarNotas(op,ruta.slice(6),cuerpo);
    else if(metodo==="POST"&&ruta==="importar") importar(op,cuerpo);
    else {
      const prefijo=(metodo==="PUT"||metodo==="DELETE")?Object.keys(RUTAS).find(p=>ruta.startsWith(p)):null;
      if(!prefijo) throw new ErrorDatos("ruta desconocida");
      const [guardar,borrar]=RUTAS[prefijo], id=ruta.slice(prefijo.length);
      if(metodo==="PUT") guardar(op,id,cuerpo); else borrar(op,id);
    }
    await confirmar(op);
    return {ok:true};
  }
  // Lo que recibe la página es siempre una copia: nunca los objetos internos
  const api=(metodo,ruta,cuerpo)=>encolar(()=>atender(metodo,ruta,cuerpo===undefined?undefined:JSON.parse(JSON.stringify(cuerpo))))
    .then(r=>JSON.parse(JSON.stringify(r)));

  return {
    api, urlAdjunto, limpiarAdjuntos, preparar,
    // Para la sincronización con la cuenta (sync.js)
    alCambiar:f=>{ escuchas.push(f); },
    dispositivo:()=>preparar().then(()=>dispositivo),
    aplicarRemotos, encolarTodo, vaciarDatos, marcarSemilla, hayDatosPropios, guardarBlob,
    alFaltarAdjunto:f=>{ alFaltar=f; },
    permitirLimpieza:f=>{ limpiezaPermitida=f; },
  };
})();

// Objetivos con fecha: cómo van, calculado siempre a partir de los datos (no se guarda ningún progreso).
//
//   racha        llegar a una racha de N días dentro del plazo
//   habito       cumplir un hábito al menos el N % de los días del plazo (se decide al terminar el plazo)
//   tareas       terminar N tareas en el plazo
//   reflexiones  escribir una reflexión N días en el plazo
//   libros       terminar N libros en el plazo (solo en la aplicación nueva, que tiene la librería)
//   nivel        llegar al nivel N antes de la fecha
"use strict";
window.AscensoObjetivos=(()=>{
  const clave=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  const deClave=k=>{ const [a,m,d]=String(k).slice(0,10).split("-").map(Number); return new Date(a,m-1,d); };
  const mas=(d,n)=>{ const x=new Date(d); x.setDate(x.getDate()+n); return x; };
  const dow=d=>(d.getDay()+6)%7;
  const hoy=()=>{ const t=new Date(); t.setHours(0,0,0,0); return t; };
  const diaDe=s=>{ if(!s) return null; s=String(s); if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; const d=new Date(s); return isNaN(d)?null:clave(d); };
  const TIPOS=[["racha","Racha"],["habito","Hábito"],["tareas","Tareas"],["reflexiones","Reflexiones"],["libros","Libros"],["nivel","Nivel"]];

  // Título que se pone solo si no se escribe ninguno
  function descripcion(g,state){
    const h=g.ref&&state.habits.find(x=>x.id===g.ref);
    switch(g.tipo){
      case "racha": return `Racha de ${g.meta} ${g.meta===1?"día":"días"}`;
      case "habito": return `«${h?h.t:"Hábito borrado"}» al ${g.meta} %`;
      case "tareas": return `${g.meta} ${g.meta===1?"tarea terminada":"tareas terminadas"}`;
      case "reflexiones": return `${g.meta} ${g.meta===1?"reflexión":"reflexiones"}`;
      case "libros": return `Leer ${g.meta} ${g.meta===1?"libro":"libros"}`;
      case "nivel": return `Llegar al nivel ${g.meta}`;
    }
    return "Objetivo";
  }
  const unidad=g=>({racha:g.meta===1?"día":"días",habito:"%",tareas:g.meta===1?"tarea":"tareas",reflexiones:g.meta===1?"reflexión":"reflexiones",libros:g.meta===1?"libro":"libros",nivel:"nivel"})[g.tipo];

  // La n-ésima fecha de una lista ordenada (cuándo se alcanzó la meta)
  const enesima=(l,n)=>{ const o=l.filter(Boolean).sort(); return o.length>=n?o[n-1]:null; };

  // Medir un objetivo. nivel: el nivel actual (para los de tipo «nivel»); libreria: lo que devuelve «libreria»
  function medir(state,g,{libreria=null,nivel=1,hasta=hoy()}={}){
    const ini=deClave(g.desde), finPlazo=deClave(g.hasta), fin=finPlazo<hasta?finPlazo:hasta, finK=clave(fin);
    let valor=0, cumplidoEl=null, medible=true;
    if(fin>=ini) switch(g.tipo){
      case "racha":{
        const thr=(state.thr||0.66)-1e-9; let n=0;
        for(let d=new Date(ini); d<=fin; d=mas(d,1)){
          const c=(state.days[clave(d)]||{}).c||{}, w=dow(d), hs=state.habits.filter(h=>h.streak&&h.days[w]);
          if(!hs.length) continue;
          if(hs.filter(h=>c[h.id]).length/hs.length>=thr){ n++; if(n>valor) valor=n; if(n>=g.meta&&!cumplidoEl) cumplidoEl=clave(d); }
          else if(clave(d)!==clave(hoy())) n=0;
        }
        break;
      }
      case "habito":{
        const h=state.habits.find(x=>x.id===g.ref); if(!h){ medible=false; break; }
        let hechos=0,total=0;
        for(let d=new Date(ini); d<=fin; d=mas(d,1)){ if(!h.days[dow(d)]) continue; total++; if(((state.days[clave(d)]||{}).c||{})[h.id]) hechos++; }
        valor=total?Math.round(hechos/total*100):0;
        // Un porcentaje solo se da por cumplido al terminar el plazo
        if(finPlazo<=hasta&&total&&valor>=g.meta) cumplidoEl=g.hasta;
        break;
      }
      case "tareas":{
        const l=Object.values(state.tasks||{}).filter(t=>t.list==="hecha").map(t=>diaDe(t.done)).filter(k=>k&&k>=g.desde&&k<=finK);
        valor=l.length; cumplidoEl=enesima(l,g.meta); break;
      }
      case "reflexiones":{
        const l=Object.entries(state.notes||{}).filter(([k,n])=>k>=g.desde&&k<=finK&&n&&String(n.r||"").trim()).map(([k])=>k);
        valor=l.length; cumplidoEl=enesima(l,g.meta); break;
      }
      case "libros":{
        if(!libreria){ medible=false; break; }
        const l=Object.entries(libreria.lecturas||{}).filter(([id,x])=>libreria.libros&&libreria.libros[id]&&x.pct>=0.98).map(([,x])=>diaDe(x.leido)).filter(k=>k&&k>=g.desde&&k<=finK);
        valor=l.length; cumplidoEl=enesima(l,g.meta); break;
      }
      case "nivel":{ valor=nivel; if(nivel>=g.meta) cumplidoEl=finK; break; }
    }
    const progreso=Math.max(0,Math.min(1,valor/g.meta));
    const hk=clave(hasta);
    let estado;
    if(cumplidoEl) estado="cumplido";
    else if(g.hasta<hk) estado="no-alcanzado";
    else if(g.desde>hk) estado="pendiente";
    else estado="en-curso";
    const quedanDias=Math.round((finPlazo-hasta)/864e5);
    return {valor, meta:g.meta, progreso:cumplidoEl?1:progreso, estado, cumplidoEl, quedanDias, medible, unidad:unidad(g)};
  }
  // Todos los objetivos con su medida, los no archivados primero
  function evaluar(state,opciones={}){
    return Object.entries(state.objetivos||{}).map(([id,g])=>({id,...g,titulo:g.titulo||descripcion(g,state),m:medir(state,g,opciones)}))
      .sort((a,b)=>(a.archivado-b.archivado)||a.hasta.localeCompare(b.hasta));
  }
  // Progreso medio de los objetivos en curso (el cuadrado de la figura); null si no hay ninguno
  function progresoMedio(lista){
    const l=lista.filter(x=>!x.archivado&&x.m.estado==="en-curso"&&x.m.medible);
    return l.length?l.reduce((s,x)=>s+x.m.progreso,0)/l.length:null;
  }
  return {TIPOS, descripcion, medir, evaluar, progresoMedio};
})();

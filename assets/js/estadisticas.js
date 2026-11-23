// Estadísticas del perfil: funciones puras sobre los datos (el «state» de la página). No guardan nada.
//
// - Periodos (semana, mes, año, siempre) y su periodo anterior, para comparar.
// - Hábitos: % cumplido por hábito y por día de la semana, mejores rachas, calendario del último año.
// - Productividad: tareas terminadas en el tiempo, por prioridad y por etiqueta, cuánto se tarda en terminarlas.
// - Ánimo del día.
// - Zonas del cuerpo: cuánto se ha cumplido de lo que reúne cada zona (y un reparto propuesto por nombre).
// - Descubrimientos: relaciones en los datos, solo con datos suficientes y diferencias claras. Son coincidencias,
//   no causas, y así se dicen.
"use strict";
window.AscensoEstadisticas=(()=>{
  // ---- fechas ----
  const clave=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  const deClave=k=>{ const [a,m,d]=String(k).slice(0,10).split("-").map(Number); return new Date(a,m-1,d); };
  const mas=(d,n)=>{ const x=new Date(d); x.setDate(x.getDate()+n); return x; };
  const dow=d=>(d.getDay()+6)%7;
  const lunes=d=>mas(d,-dow(d));
  const hoy=()=>{ const t=new Date(); t.setHours(0,0,0,0); return t; };
  // Una fecha guardada (AAAA-MM-DD o ISO) como día local
  const diaDe=s=>{ if(!s) return null; s=String(s); if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; const d=new Date(s); return isNaN(d)?null:clave(d); };
  const DIAS=["lunes","martes","miércoles","jueves","viernes","sábado","domingo"];
  const DIAS_PL=["lunes","martes","miércoles","jueves","viernes","sábados","domingos"];
  const num=(n,dec=1)=>n.toLocaleString("es-ES",{maximumFractionDigits:dec,minimumFractionDigits:0});
  const pc=x=>Math.round(x*100)+" %";

  // ---- el primer día con algo registrado (antes no se cuenta nada como fallo) ----
  function primerDia(state){
    let p=null;
    for(const [k,d] of Object.entries(state.days||{})) if(d&&((d.c&&Object.values(d.c).some(Boolean))||d.a)&&(!p||k<p)) p=k;
    return p;
  }

  // ---- periodos ----
  function periodo(cual,ref=hoy(),state){
    let desde, nombre;
    if(cual==="semana"){ desde=lunes(ref); nombre="Esta semana"; }
    else if(cual==="mes"){ desde=new Date(ref.getFullYear(),ref.getMonth(),1); nombre="Este mes"; }
    else if(cual==="año"){ desde=new Date(ref.getFullYear(),0,1); nombre="Este año"; }
    else { const p=state&&primerDia(state); desde=p?deClave(p):mas(ref,-29); nombre="Desde el principio"; cual="siempre"; }
    const hasta=ref, largo=Math.round((hasta-desde)/864e5)+1;
    let ant;
    if(cual==="semana") ant={desde:mas(desde,-7),hasta:mas(desde,-1)};
    else if(cual==="mes"){ const a=new Date(desde.getFullYear(),desde.getMonth()-1,1); ant={desde:a,hasta:mas(a,largo-1)}; }   // el mismo tramo del mes anterior
    else if(cual==="año"){ const a=new Date(desde.getFullYear()-1,0,1); ant={desde:a,hasta:mas(a,largo-1)}; }
    else ant=null;
    return {cual,nombre,desde,hasta,anterior:ant};
  }
  function* dias(desde,hasta){ for(let d=new Date(desde); d<=hasta; d=mas(d,1)) yield d; }

  // ---- hábitos ----
  const marcas=(state,d)=>(state.days[clave(d)]||{}).c||{};
  function pctHabito(state,h,desde,hasta,inicio){
    let hechos=0,total=0;
    for(const d of dias(desde,hasta)){ if(inicio&&clave(d)<inicio) continue; if(!h.days[dow(d)]) continue; total++; if(marcas(state,d)[h.id]) hechos++; }
    return {hechos,total,pct:total?hechos/total:null};
  }
  function rachasHabito(state,h,inicio,fin=hoy()){
    let mejor=0,n=0,actual=0;
    if(!inicio) return {mejor:0,actual:0};
    for(const d of dias(deClave(inicio),fin)){
      if(!h.days[dow(d)]) continue;
      if(marcas(state,d)[h.id]){ n++; if(n>mejor) mejor=n; } else if(clave(d)!==clave(fin)) n=0;
    }
    actual=n; return {mejor,actual};
  }
  function habitos(state,per){
    const inicio=primerDia(state), por=[], porDia=Array.from({length:7},()=>({hechos:0,total:0}));
    let H=0,T=0;
    for(const h of state.habits){
      const r=pctHabito(state,h,per.desde,per.hasta,inicio), dia=Array.from({length:7},()=>({hechos:0,total:0}));
      for(const d of dias(per.desde,per.hasta)){ if(inicio&&clave(d)<inicio||!inicio) continue; const w=dow(d); if(!h.days[w]) continue; dia[w].total++; porDia[w].total++; if(marcas(state,d)[h.id]){ dia[w].hechos++; porDia[w].hechos++; } }
      const ant=per.anterior?pctHabito(state,h,per.anterior.desde,per.anterior.hasta,inicio):null;
      por.push({id:h.id,nombre:h.t,...r,anterior:ant&&ant.pct,...rachasHabito(state,h,inicio),porDia:dia.map(x=>x.total?x.hechos/x.total:null)});
      H+=r.hechos; T+=r.total;
    }
    let antH=0,antT=0;
    if(per.anterior) for(const x of por){ const a=pctHabito(state,state.habits.find(h=>h.id===x.id),per.anterior.desde,per.anterior.hasta,inicio); antH+=a.hechos; antT+=a.total; }
    return {pct:T?H/T:null,hechos:H,total:T,anterior:antT?antH/antT:null,porHabito:por,porDia:porDia.map(x=>x.total?x.hechos/x.total:null)};
  }
  // Calendario del último año (semanas de lunes a domingo): proporción de hábitos de la semana cumplidos cada día
  function calendario(state,semanas=53){
    const inicio=primerDia(state), fin=hoy(), desde=mas(lunes(fin),-(semanas-1)*7), out=[];
    for(const d of dias(desde,mas(lunes(fin),6))){
      const k=clave(d);
      if(d>fin||!inicio||k<inicio){ out.push({k,r:null,futuro:d>fin}); continue; }
      let h=0,t=0; const c=marcas(state,d), w=dow(d);
      for(const x of state.habits) if(x.week&&x.days[w]){ t++; if(c[x.id]) h++; }
      out.push({k,r:t?h/t:null});
    }
    return out;
  }

  // ---- productividad ----
  const enRango=(k,per)=>k&&k>=clave(per.desde)&&k<=clave(per.hasta);
  function productividad(state,per){
    const tareas=Object.entries(state.tasks||{}).map(([id,t])=>({id,...t}));
    const hechasEn=p=>tareas.filter(t=>t.list==="hecha"&&enRango(diaDe(t.done),p));
    const hechas=hechasEn(per);
    // Serie: por días (semana), por semanas (mes), por meses (año y siempre)
    const serie=[];
    if(per.cual==="semana"){ for(const d of dias(per.desde,per.hasta)) serie.push({etiqueta:DIAS[dow(d)].slice(0,3),desde:clave(d),hasta:clave(d)}); }
    else if(per.cual==="mes"){ for(let m=lunes(per.desde); m<=per.hasta; m=mas(m,7)) serie.push({etiqueta:m.getDate()+"/"+(m.getMonth()+1),desde:clave(m<per.desde?per.desde:m),hasta:clave(mas(m,6))}); }
    else { let m=new Date(per.desde.getFullYear(),per.desde.getMonth(),1); const lim=per.cual==="siempre"?new Date(per.hasta.getFullYear(),per.hasta.getMonth()-35,1):m; if(m<lim) m=lim;
      for(; m<=per.hasta; m=new Date(m.getFullYear(),m.getMonth()+1,1)) serie.push({etiqueta:m.toLocaleDateString("es-ES",{month:"short"}).replace(".",""),desde:clave(m),hasta:clave(new Date(m.getFullYear(),m.getMonth()+1,0))}); }
    for(const s of serie) s.n=hechas.filter(t=>{ const k=diaDe(t.done); return k>=s.desde&&k<=s.hasta; }).length;
    // Por prioridad y por etiqueta: de las tareas de días del periodo, cuántas se terminaron
    const delPeriodo=tareas.filter(t=>enRango(t.date,per));
    const porPrioridad={};
    for(const p of ["urgente","alta","media","baja"]){ const l=delPeriodo.filter(t=>t.prio===p); porPrioridad[p]={total:l.length,hechas:l.filter(t=>t.list==="hecha").length}; }
    const porEtiqueta=Object.entries(state.tags||{}).map(([id,g])=>{ const l=delPeriodo.filter(t=>(t.tags||[]).includes(id)); return {id,nombre:g.name,color:g.color,total:l.length,hechas:l.filter(t=>t.list==="hecha").length}; }).filter(x=>x.total).sort((a,b)=>b.total-a.total);
    // Cuánto se tarda en terminar (de crear a terminar), por prioridad
    const tiempo={};
    for(const p of ["urgente","alta","media","baja"]){
      const l=hechas.filter(t=>t.prio===p&&t.created&&t.done&&String(t.done).length>10).map(t=>(new Date(t.done)-new Date(t.created))/864e5).filter(x=>x>=0&&x<3650);
      tiempo[p]=l.length?{dias:l.reduce((a,b)=>a+b,0)/l.length,n:l.length}:null;
    }
    const hk=clave(hoy());
    const atrasadas=tareas.filter(t=>t.list!=="hecha"&&!t.archived&&t.date<hk).length;
    const cards=Object.values(state.cards||{}), LISTA=(window.AscensoNiveles||{}).LISTA_HECHA||/hech/i;
    const tarjetasHechas=cards.filter(c=>{ const l=(state.blists||{})[c.list]; return l&&LISTA.test(l.title); }).length;
    const checklist=[...tareas,...cards].reduce((s,x)=>s+(x.check||[]).filter(k=>k.d).length,0);
    return {hechas:hechas.length,anterior:per.anterior?hechasEn(per.anterior).length:null,creadas:tareas.filter(t=>enRango(diaDe(t.created),per)).length,
      serie,porPrioridad,porEtiqueta,tiempo,atrasadas,tarjetasHechas,checklist};
  }

  // ---- ánimo ----
  function animo(state,per){
    const serie=[], dist=[0,0,0,0,0];
    for(const d of dias(per.desde,per.hasta)){ const a=(state.days[clave(d)]||{}).a||null; serie.push({k:clave(d),a}); if(a) dist[a-1]++; }
    const media=l=>{ const v=l.filter(x=>x.a).map(x=>x.a); return v.length?v.reduce((a,b)=>a+b,0)/v.length:null; };
    let ant=null;
    if(per.anterior){ const l=[]; for(const d of dias(per.anterior.desde,per.anterior.hasta)) l.push({a:(state.days[clave(d)]||{}).a||null}); ant=media(l); }
    return {media:media(serie),n:serie.filter(x=>x.a).length,serie,dist,anterior:ant};
  }

  // ---- zonas del cuerpo ----
  const ZONAS=[["cabeza","Cabeza"],["pecho","Pecho"],["brazos","Brazos"],["manos","Manos"],["abdomen","Abdomen"],["piernas","Piernas"]];
  const REGLAS=[
    ["abdomen",/calor|prote|az[uú]car|comid|dieta|ayun|agua|alcohol|aliment|verdur|fruta|nutri|hidrat|cena|desayun/i],
    ["cabeza",/dorm|sue[ñn]o|medit|le[ea]r|lectur|libro|estudi|aprend|idioma|diario|reflex|pantalla|m[oó]vil|redes|mente|descanso$/i],
    ["manos",/u[ñn]as|escrib|dibuj|guitarr|piano|program|c[oó]dig|orden|limpi|cocin|manual|pint/i],
    ["piernas",/camin|pasos|corr|carrer|estir|yoga|sender|monta[ñn]|bici|sentadill|piern|activo/i],
    ["brazos",/fuerza|pesas|flexion|dominad|empuj|escal|gimnas|gym|entren|brazo/i],
    ["pecho",/respir|cardio|nad|gratitud|agradec|famil|amig|social|pareja|llam|coraz/i],
  ];
  const zonaDe=nombre=>{ for(const [z,re] of REGLAS) if(re.test(nombre)) return z; return null; };
  // Reparto propuesto por el nombre de cada hábito, tipo de entreno y etiqueta (se puede cambiar en Ajustes)
  function zonasPropuestas(state){
    const z=Object.fromEntries(ZONAS.map(([k])=>[k,[]]));
    for(const h of state.habits){ const k=zonaDe(h.t+" "+(h.s||"")); if(k) z[k].push("h:"+h.id); }
    for(const t of state.tipos||[]){ if(t.oculto) continue; const k=({climb:"brazos",strength:"piernas",active:"pecho",rest:"cabeza"})[t.id]||zonaDe(t.name); if(k) z[k].push("t:"+t.id); }
    for(const [id,g] of Object.entries(state.tags||{})){ const k=zonaDe(g.name); if(k) z[k].push("e:"+id); }
    return z;
  }
  const repartoDe=state=>state.perfil&&state.perfil.zonas?state.perfil.zonas:zonasPropuestas(state);
  const habitoEntreno=state=>state.habits.find(h=>h.id==="train")||state.habits.find(h=>/entren/i.test(h.t));
  // Cuánto se cumplió una referencia (h: hábito, t: tipo de entreno, e: etiqueta) en un periodo
  function medirRef(state,ref,per,tipoDe){
    const [tipo,id]=[ref[0],ref.slice(2)], inicio=primerDia(state);
    if(tipo==="h"){ const h=state.habits.find(x=>x.id===id); if(!h) return null; const r=pctHabito(state,h,per.desde,per.hasta,inicio); return {nombre:h.t,color:null,...r}; }
    if(tipo==="t"){
      const t=(state.tipos||[]).find(x=>x.id===id); if(!t) return null;
      const ent=habitoEntreno(state); let hechos=0,total=0;
      if(ent&&tipoDe&&inicio) for(const d of dias(per.desde,per.hasta)){ if(clave(d)<inicio||tipoDe(d)!==id||!ent.days[dow(d)]) continue; total++; if(marcas(state,d)[ent.id]) hechos++; }
      return {nombre:t.name,color:t.color,hechos,total,pct:total?hechos/total:null};
    }
    if(tipo==="e"){
      const g=(state.tags||{})[id]; if(!g) return null;
      const l=Object.values(state.tasks||{}).filter(t=>(t.tags||[]).includes(id)&&enRango(t.date,per));
      const hechos=l.filter(t=>t.list==="hecha").length; return {nombre:g.name,color:g.color,hechos,total:l.length,pct:l.length?hechos/l.length:null};
    }
    return null;
  }
  function zonas(state,per,tipoDe){
    const reparto=repartoDe(state), out={};
    for(const [z,nombre] of ZONAS){
      const refs=(reparto[z]||[]).map(ref=>{ const m=medirRef(state,ref,per,tipoDe); if(!m) return null;
        const a=per.anterior?medirRef(state,ref,per.anterior,tipoDe):null; return {ref,...m,anterior:a&&a.pct}; }).filter(Boolean);
      const con=refs.filter(r=>r.pct!=null);
      out[z]={nombre,refs,pct:con.length?con.reduce((s,r)=>s+r.pct,0)/con.length:null};
    }
    return out;
  }

  // ---- descubrimientos ----
  // Requisitos: al menos 14 días en cada grupo que se compara (10 para el ánimo por tipo de entreno) y una
  // diferencia clara (15 puntos en porcentajes, medio punto en el ánimo de 1 a 5). Se redactan como «cuando…,
  // suele…»: son coincidencias en tus datos, no causas.
  const MIN=14, DIF=0.15, DIF_ANIMO=0.5;
  const media=l=>l.length?l.reduce((a,b)=>a+b,0)/l.length:null;
  // hasta: el último día que se mira (por defecto, ayer)
  function prepararDias(state,tipoDe,hasta){
    const inicio=primerDia(state); if(!inicio) return [];
    const thr=(state.thr||0.66)-1e-9, fin=hasta||mas(hoy(),-1), out=[];
    const tareasPorDia={};
    for(const t of Object.values(state.tasks||{})) if(t.list==="hecha"){ const k=diaDe(t.done); if(k) tareasPorDia[k]=(tareasPorDia[k]||0)+1; }
    let racha=0;
    for(const d of dias(deClave(inicio),fin)){
      const k=clave(d), dia=state.days[k]||{}, c=dia.c||{}, w=dow(d);
      const aplic=state.habits.filter(h=>h.days[w]), hechos=new Set(aplic.filter(h=>c[h.id]).map(h=>h.id));
      const rh=state.habits.filter(h=>h.streak&&h.days[w]), rOk=rh.length?rh.filter(h=>c[h.id]).length/rh.length>=thr:null;
      const nota=(state.notes||{})[k];
      out.push({k,d,w,aplic:new Set(aplic.map(h=>h.id)),hechos,pct:aplic.length?hechos.size/aplic.length:null,rachaOk:rOk,racha,
        a:dia.a||null,peso:dia.w!=null?+dia.w:null,reflexion:!!(nota&&String(nota.r||"").trim()),tareas:tareasPorDia[k]||0,tipo:tipoDe?tipoDe(d):null});
      if(rOk===true) racha++; else if(rOk===false) racha=0;
    }
    return out;
  }
  const nombreH=(state,id)=>{ const h=state.habits.find(x=>x.id===id); return h?h.t:id; };
  function descubrimientos(state,tipoDe,{hasta}={}){
    const D=prepararDias(state,tipoDe,hasta), fin=hasta||hoy(), out=[], add=(id,texto,base,fuerza,unidad="días")=>out.push({id,texto,base,fuerza,unidad});
    if(D.length<MIN) return out;
    const habs=state.habits;
    // 1 · Hábitos que van juntos
    const pares=[];
    for(const A of habs) for(const B of habs){
      if(A.id===B.id) continue;
      const con=D.filter(x=>x.aplic.has(A.id)&&x.aplic.has(B.id));
      const si=con.filter(x=>x.hechos.has(A.id)), no=con.filter(x=>!x.hechos.has(A.id));
      if(si.length<MIN||no.length<MIN) continue;
      const p1=si.filter(x=>x.hechos.has(B.id)).length/si.length, p0=no.filter(x=>x.hechos.has(B.id)).length/no.length;
      if(Math.abs(p1-p0)>=DIF) pares.push({A,B,p1,p0,n:con.length,f:Math.abs(p1-p0)});
    }
    pares.sort((a,b)=>b.f-a.f);
    const vistos=new Set();
    for(const x of pares){ const k=[x.A.id,x.B.id].sort().join(); if(vistos.has(k)) continue; vistos.add(k); if(vistos.size>3) break;
      add("juntos:"+k,`Los días que cumples «${x.A.t}», cumples «${x.B.t}» el ${pc(x.p1)} de las veces; los que no, el ${pc(x.p0)}.`,x.n,x.f); }
    // 2 · Hábitos y ánimo
    for(const h of habs){
      const l=D.filter(x=>x.a&&x.aplic.has(h.id)), si=l.filter(x=>x.hechos.has(h.id)).map(x=>x.a), no=l.filter(x=>!x.hechos.has(h.id)).map(x=>x.a);
      if(si.length<MIN||no.length<MIN) continue;
      const m1=media(si), m0=media(no);
      if(Math.abs(m1-m0)>=DIF_ANIMO) add("animo:"+h.id,`Los días que cumples «${h.t}», tu ánimo suele ser ${m1>m0?"mejor":"peor"}: ${num(m1)} de media sobre 5, frente a ${num(m0)} los que no.`,l.length,Math.abs(m1-m0)/2);
    }
    // 3 · Hábitos y tareas terminadas
    for(const h of habs){
      const l=D.filter(x=>x.aplic.has(h.id)), si=l.filter(x=>x.hechos.has(h.id)).map(x=>x.tareas), no=l.filter(x=>!x.hechos.has(h.id)).map(x=>x.tareas);
      if(si.length<MIN||no.length<MIN) continue;
      const m1=media(si), m0=media(no);
      if(Math.abs(m1-m0)>=1&&Math.max(m1,m0)>=1.3*Math.max(0.1,Math.min(m1,m0))) add("tareas:"+h.id,`Los días que cumples «${h.t}» sueles terminar ${num(m1)} tareas; los que no, ${num(m0)}.`,l.length,Math.min(1,Math.abs(m1-m0)/3));
    }
    // 4 · Mejor y peor día de la semana
    const porDia=Array.from({length:7},(_,w)=>D.filter(x=>x.w===w&&x.pct!=null).map(x=>x.pct));
    const dval=porDia.map((l,w)=>l.length>=4?{w,p:media(l),n:l.length}:null).filter(Boolean);
    if(dval.length>=5){ dval.sort((a,b)=>b.p-a.p); const [m,p]=[dval[0],dval[dval.length-1]];
      if(m.p-p.p>=DIF) add("dia-semana",`Tu mejor día para los hábitos es el ${DIAS[m.w]} (${pc(m.p)}); el más flojo, el ${DIAS[p.w]} (${pc(p.p)}).`,dval.reduce((s,x)=>s+x.n,0),m.p-p.p); }
    // 5 · Lo que suele fallar cuando se rompe la racha
    const roturas=D.filter((x,i)=>x.rachaOk===false&&i>0&&D[i-1].rachaOk===true);
    if(roturas.length>=3){
      const cuenta={};
      for(const x of roturas) for(const h of habs) if(h.streak&&x.aplic.has(h.id)&&!x.hechos.has(h.id)) cuenta[h.id]=(cuenta[h.id]||0)+1;
      const [id,n]=Object.entries(cuenta).sort((a,b)=>b[1]-a[1])[0]||[];
      if(id&&n/roturas.length>=0.5) add("rotura:"+id,`Cuando se rompe tu racha, lo que más a menudo se queda sin hacer es «${nombreH(state,id)}» (en ${n} de ${roturas.length} ocasiones).`,roturas.length,n/roturas.length/2,"ocasiones");
    }
    // 6 · Tendencias: últimas 4 semanas frente a las 4 anteriores
    const corte=D.length-28;
    if(corte>=28) for(const h of habs){
      const rec=D.slice(corte).filter(x=>x.aplic.has(h.id)), prev=D.slice(corte-28,corte).filter(x=>x.aplic.has(h.id));
      if(rec.length<MIN||prev.length<MIN) continue;
      const p1=rec.filter(x=>x.hechos.has(h.id)).length/rec.length, p0=prev.filter(x=>x.hechos.has(h.id)).length/prev.length;
      if(Math.abs(p1-p0)>=DIF) add("tendencia:"+h.id,`«${h.t}» va ${p1>p0?"a mejor":"a menos"}: ${pc(p1)} en las últimas 4 semanas, frente a ${pc(p0)} en las 4 anteriores.`,rec.length+prev.length,Math.abs(p1-p0));
    }
    // 7 · Escribir una reflexión y el ánimo
    { const l=D.filter(x=>x.a), si=l.filter(x=>x.reflexion).map(x=>x.a), no=l.filter(x=>!x.reflexion).map(x=>x.a);
      if(si.length>=MIN&&no.length>=MIN){ const m1=media(si), m0=media(no); if(Math.abs(m1-m0)>=DIF_ANIMO) add("reflexion-animo",`Los días que escribes una reflexión, tu ánimo suele ser ${m1>m0?"mejor":"peor"} (${num(m1)} frente a ${num(m0)}).`,l.length,Math.abs(m1-m0)/2); } }
    // 8 · Tipo de entreno y ánimo
    if(tipoDe){
      const grupos={}; for(const x of D) if(x.a&&x.tipo) (grupos[x.tipo]=grupos[x.tipo]||[]).push(x.a);
      const g=Object.entries(grupos).filter(([,l])=>l.length>=10).map(([t,l])=>({t,m:media(l),n:l.length})).sort((a,b)=>b.m-a.m);
      if(g.length>=2&&g[0].m-g[g.length-1].m>=DIF_ANIMO){ const nom=id=>((state.tipos||[]).find(x=>x.id===id)||{name:id}).name;
        add("tipo-animo",`Los días de «${nom(g[0].t)}» tu ánimo medio es ${num(g[0].m)}; los de «${nom(g[g.length-1].t)}», ${num(g[g.length-1].m)}.`,g.reduce((s,x)=>s+x.n,0),(g[0].m-g[g.length-1].m)/2); }
    }
    // 9 · Lo que hiciste ayer y cómo va hoy
    for(const h of habs){
      const si=[], no=[];
      for(let i=1;i<D.length;i++){ const ay=D[i-1], x=D[i]; if(!ay.aplic.has(h.id)||x.pct==null) continue; (ay.hechos.has(h.id)?si:no).push(x.pct); }
      if(si.length<MIN||no.length<MIN) continue;
      const m1=media(si), m0=media(no);
      if(Math.abs(m1-m0)>=DIF) add("ayer:"+h.id,`Cuando ayer cumpliste «${h.t}», hoy sueles cumplir ${m1>m0?"más":"menos"} hábitos (${pc(m1)} frente a ${pc(m0)}).`,si.length+no.length,Math.abs(m1-m0)*0.9);
    }
    // 10 · Fin de semana frente a entre semana
    { const fs=D.filter(x=>x.w>=5&&x.pct!=null).map(x=>x.pct), es=D.filter(x=>x.w<5&&x.pct!=null).map(x=>x.pct);
      if(fs.length>=8&&es.length>=20){ const m1=media(fs), m0=media(es); if(Math.abs(m1-m0)>=DIF) add("finde",`El fin de semana cumples ${m1>m0?"más":"menos"} hábitos que entre semana (${pc(m1)} frente a ${pc(m0)}).`,fs.length+es.length,Math.abs(m1-m0)); } }
    // 11 · Ánimo según el día de la semana
    { const g=Array.from({length:7},(_,w)=>D.filter(x=>x.w===w&&x.a).map(x=>x.a)).map((l,w)=>l.length>=4?{w,m:media(l),n:l.length}:null).filter(Boolean).sort((a,b)=>b.m-a.m);
      if(g.length>=5&&g[0].m-g[g.length-1].m>=DIF_ANIMO) add("animo-dia",`Tu ánimo suele ser mejor los ${DIAS_PL[g[0].w]} (${num(g[0].m)}) y más bajo los ${DIAS_PL[g[g.length-1].w]} (${num(g[g.length-1].m)}).`,g.reduce((s,x)=>s+x.n,0),(g[0].m-g[g.length-1].m)/2); }
    // 12 · El día de la semana en que más tareas terminas
    { const tot=D.reduce((s,x)=>s+x.tareas,0);
      if(tot>=20&&D.length>=28){ const g=Array.from({length:7},(_,w)=>{ const l=D.filter(x=>x.w===w); return {w,m:media(l.map(x=>x.tareas))||0}; }).sort((a,b)=>b.m-a.m), prom=tot/D.length;
        if(g[0].m>=1.4*prom) add("tareas-dia",`Los ${DIAS_PL[g[0].w]} son tu día más productivo: terminas ${num(g[0].m)} tareas de media, frente a ${num(prom)} en un día cualquiera.`,tot,Math.min(1,g[0].m/prom-1),"tareas"); } }
    // 13 · Cuánto tardas en terminar según la prioridad
    { const per={cual:"siempre",desde:D[0].d,hasta:fin}, p=productividad(state,per).tiempo;
      const l=["urgente","alta","media","baja"].map(k=>p[k]&&p[k].n>=5?{k,...p[k]}:null).filter(Boolean);
      if(l.length>=2){ const [r,s]=[l[0],l[l.length-1]];
        if(Math.abs(s.dias-r.dias)>=1) add("tiempo-prioridad",`Las tareas de prioridad ${r.k} las terminas en ${num(r.dias)} días de media; las de prioridad ${s.k}, en ${num(s.dias)}.`,r.n+s.n,Math.min(1,Math.abs(s.dias-r.dias)/7),"tareas"); } }
    // 14 · Etiquetas que se quedan atrás
    { const per={cual:"siempre",desde:D[0].d,hasta:fin}, e=productividad(state,per).porEtiqueta.filter(x=>x.total>=10);
      if(e.length>=2){ const r=e.map(x=>({...x,p:x.hechas/x.total})).sort((a,b)=>a.p-b.p), peor=r[0], resto=r.slice(1), m=resto.reduce((s,x)=>s+x.hechas,0)/resto.reduce((s,x)=>s+x.total,0);
        if(m-peor.p>=0.2) add("etiqueta:"+peor.id,`Las tareas de «${peor.nombre}» se terminan menos (${pc(peor.p)}) que las del resto de etiquetas (${pc(m)}).`,peor.total,m-peor.p,"tareas"); } }
    // 15 · Racha y ánimo
    { const l=D.filter(x=>x.a), si=l.filter(x=>x.racha>=3).map(x=>x.a), no=l.filter(x=>x.racha<3).map(x=>x.a);
      if(si.length>=MIN&&no.length>=MIN){ const m1=media(si), m0=media(no); if(Math.abs(m1-m0)>=DIF_ANIMO) add("racha-animo",`Cuando llevas al menos tres días de racha, tu ánimo suele ser ${m1>m0?"mejor":"peor"} (${num(m1)} frente a ${num(m0)}).`,l.length,Math.abs(m1-m0)/2); } }
    // 16 · El hábito más constante de los últimos 60 días
    { const l=D.slice(-60); let mejor=null;
      for(const h of habs){ const a=l.filter(x=>x.aplic.has(h.id)); if(a.length<28) continue; const p=a.filter(x=>x.hechos.has(h.id)).length/a.length; if(p>=0.85&&(!mejor||p>mejor.p)) mejor={h,p,n:a.length}; }
      if(mejor) add("constante:"+mejor.h.id,`«${mejor.h.t}» es tu hábito más constante: ${pc(mejor.p)} en los últimos 60 días.`,mejor.n,0.15); }
    // 17 · Peso: últimas 4 semanas frente a las 4 anteriores
    { const l=D.slice(-28).filter(x=>x.peso).map(x=>x.peso), p=D.slice(-56,-28).filter(x=>x.peso).map(x=>x.peso);
      if(l.length>=8&&p.length>=4){ const dif=media(l)-media(p); if(Math.abs(dif)>=0.5) add("peso",`Tu peso medio ha ${dif<0?"bajado":"subido"} ${num(Math.abs(dif))} kg respecto a las 4 semanas anteriores.`,l.length+p.length,Math.min(1,Math.abs(dif)/3)); } }
    // 18 · Ánimo: últimas 2 semanas frente a las 2 anteriores
    { const l=D.slice(-14).filter(x=>x.a).map(x=>x.a), p=D.slice(-28,-14).filter(x=>x.a).map(x=>x.a);
      if(l.length>=8&&p.length>=8){ const dif=media(l)-media(p); if(Math.abs(dif)>=DIF_ANIMO) add("animo-tendencia",`Tu ánimo de las últimas dos semanas es ${dif>0?"mejor":"más bajo"} que el de las dos anteriores (${num(media(l))} frente a ${num(media(p))}).`,l.length+p.length,Math.abs(dif)/2); } }
    // Las más claras y con más datos, primero
    return out.sort((a,b)=>b.fuerza*Math.log(b.base+1)-a.fuerza*Math.log(a.base+1));
  }

  return {periodo, habitos, calendario, productividad, animo, zonas, zonasPropuestas, repartoDe, medirRef, descubrimientos, primerDia, ZONAS, DIAS, clave, deClave};
})();

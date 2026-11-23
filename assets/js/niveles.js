// Niveles y experiencia de Ascenso: el progreso acumulado de toda la vida.
//
// La experiencia no se guarda: se calcula siempre a partir de los datos (hábitos marcados, rachas, semanas,
// tareas, tarjetas, diario y lectura). Así es exacta en todos los dispositivos y desmarcar algo la resta.
// Los niveles siguen una curva cuadrática: los primeros llegan en días; el 120, tras años de constancia.
"use strict";
window.AscensoNiveles=(()=>{
  // ---- Puntos de cada cosa (ajustables) ----
  const PUNTOS={habito:10, habitoSuelto:5, rachaMax:30, semana:40, tarea:{urgente:25,alta:18,media:12,baja:8},
    checklist:3, tarjeta:12, reflexion:15, notas:5, libro:100, libroTerminado:100, subrayado:2, objetivo:150};
  // Listas de tableros que cuentan como terminadas (por su nombre)
  const LISTA_HECHA=/\b(hech[oa]s?|terminad[oa]s?|complet[oa]s?|acabad[oa]s?|finalizad[oa]s?|done|listo|listos)\b/i;

  // ---- Fechas (locales, «AAAA-MM-DD») ----
  const clave=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  const deClave=k=>{ const [a,m,d]=k.split("-").map(Number); return new Date(a,m-1,d); };
  const mas=(d,n)=>{ const x=new Date(d); x.setDate(x.getDate()+n); return x; };
  const dow=d=>(d.getDay()+6)%7;
  const lunes=d=>mas(d,-dow(d));
  const hoy=()=>{ const t=new Date(); t.setHours(0,0,0,0); return t; };

  // Cuántos hábitos de un tipo («streak» o «week») tocaban un día y cuántos se cumplieron
  function cuenta(state,d,flag){
    const c=(state.days[clave(d)]||{}).c||{}, w=dow(d);
    let hechos=0, total=0;
    for(const h of state.habits) if(h[flag]&&h.days[w]){ total++; if(c[h.id]) hechos++; }
    return {hechos,total};
  }

  // ---- Experiencia ----
  // state: el estado de la página; libreria (opcional): lo que devuelve la ruta «libreria»
  function experiencia(state,libreria,{hasta}={}){
    const p={habitos:0, rachas:0, semanas:0, tareas:0, checklists:0, tarjetas:0, diario:0, lectura:0, objetivos:0};
    const fin=hasta||hoy(), finK=clave(fin);
    const habitos=new Map(state.habits.map(h=>[h.id,h]));
    // Hábitos marcados (los que cuentan para la racha valen más)
    let primero=null;
    for(const [k,dia] of Object.entries(state.days||{})){
      if(k>finK||!dia||!dia.c) continue;
      const w=dow(deClave(k)); let algo=false;
      for(const [id,v] of Object.entries(dia.c)){ const h=habitos.get(id); if(!v||!h||!h.days[w]) continue; p.habitos+=h.streak?PUNTOS.habito:PUNTOS.habitoSuelto; algo=true; }
      if(algo&&(!primero||k<primero)) primero=k;
    }
    // Rachas: cada día que la mantiene suma tanto como días lleva (hasta 30). Semanas por encima del umbral
    if(primero){
      const thr=(state.thr||0.66)-1e-9; let n=0;
      for(let d=deClave(primero); d<=fin; d=mas(d,1)){
        const x=cuenta(state,d,"streak");
        if(x.total===0) continue;
        if(x.hechos/x.total>=thr){ n++; p.rachas+=Math.min(n,PUNTOS.rachaMax); } else if(clave(d)!==finK) n=0;   // hoy aún puede completarse
      }
      for(let m=lunes(deClave(primero)); m<=fin; m=mas(m,7)){
        let h=0,t=0; for(let i=0;i<7;i++){ const d=mas(m,i); if(d>fin) break; const x=cuenta(state,d,"week"); h+=x.hechos; t+=x.total; }
        if(t&&h/t>=thr) p.semanas+=PUNTOS.semana;
      }
    }
    // Tareas hechas (también las archivadas: archivar no resta) y sus checklists
    for(const t of Object.values(state.tasks||{})){
      if(t.list==="hecha") p.tareas+=PUNTOS.tarea[t.prio]||PUNTOS.tarea.media;
      for(const k of t.check||[]) if(k.d) p.checklists+=PUNTOS.checklist;
    }
    // Tarjetas en listas de terminadas y elementos de checklist hechos
    for(const c of Object.values(state.cards||{})){
      const l=(state.blists||{})[c.list];
      if(l&&LISTA_HECHA.test(l.title)) p.tarjetas+=PUNTOS.tarjeta;
      for(const k of c.check||[]) if(k.d) p.checklists+=PUNTOS.checklist;
    }
    // Diario
    for(const [k,n] of Object.entries(state.notes||{})){
      if(k>finK||!n) continue;
      if(String(n.r||"").trim()) p.diario+=PUNTOS.reflexion;
      if(String(n.n||"").trim()) p.diario+=PUNTOS.notas;
    }
    // Lectura
    if(libreria){
      for(const [id] of Object.entries(libreria.libros||{})){
        const l=(libreria.lecturas||{})[id]; if(!l) continue;
        p.lectura+=Math.round((l.pct||0)*PUNTOS.libro)+((l.pct||0)>=0.98?PUNTOS.libroTerminado:0);
      }
      p.lectura+=Object.keys(libreria.subrayados||{}).length*PUNTOS.subrayado;
    }
    let total=Object.values(p).reduce((a,b)=>a+b,0);
    // Objetivos cumplidos: los de tipo «nivel» se miden con el nivel sin contar los objetivos (así no dan vueltas)
    const O=window.AscensoObjetivos;
    if(O&&state.objetivos){
      const base=nivelDe(total).nivel;
      for(const g of Object.values(state.objetivos)) if(O.medir(state,g,{libreria,nivel:base,hasta:fin}).estado==="cumplido") p.objetivos+=PUNTOS.objetivo;
      total+=p.objetivos;
    }
    return {total, partes:p};
  }

  // ---- Rachas: la actual (como en la página: si hoy aún no se ha cumplido, cuenta desde ayer) y la mejor ----
  function rachas(state){
    const thr=(state.thr||0.66)-1e-9, ok=d=>{ const x=cuenta(state,d,"streak"); return x.total===0?null:x.hechos/x.total>=thr; };
    let actual=0, d=hoy();
    if(ok(d)!==true) d=mas(d,-1);
    for(let i=0;i<3650;i++,d=mas(d,-1)){ const r=ok(d); if(r===null) continue; if(!r) break; actual++; }
    const claves=Object.keys(state.days||{}).filter(k=>state.days[k]&&state.days[k].c&&Object.values(state.days[k].c).some(Boolean)).sort();
    let mejor=actual, n=0, dias=0;
    if(claves.length) for(let d=deClave(claves[0]), fin=hoy(); d<=fin; d=mas(d,1)){ dias++; const r=ok(d); if(r===null) continue; if(r){ n++; if(n>mejor) mejor=n; } else n=0; }
    return {actual, mejor, desde:claves[0]||null, dias};
  }

  // ---- Niveles ----
  // Experiencia acumulada necesaria para llegar al nivel n (el 1 es el de partida)
  const umbral=n=>n<=1?0:40*(n-1)*(n-1)+60*(n-1);
  function nivelDe(xp){
    let n=Math.max(1,Math.floor((-60+Math.sqrt(3600+160*Math.max(0,xp)))/80)+1);
    while(umbral(n+1)<=xp) n++;
    while(n>1&&umbral(n)>xp) n--;
    const desde=umbral(n), hasta=umbral(n+1);
    return {nivel:n, desde, hasta, progreso:(xp-desde)/(hasta-desde), etapa:Math.min(12,Math.ceil(n/10))};
  }

  // ---- 120 nombres, en 12 etapas de 10. Cada nombre es un paso más que el anterior ----
  // «masculino|femenino» cuando cambian; la figura elegida decide cuál se muestra
  const ETAPAS=[
    ["Valle", "Los primeros pasos", ["Recién llegado|Recién llegada","Curioso|Curiosa","Aprendiz","Caminante","Andarín|Andarina","Peregrino|Peregrina","Buscador|Buscadora","Explorador|Exploradora","Rastreador|Rastreadora","Guía del valle"]],
    ["Sendero", "El hábito se hace camino", ["Senderista","Excursionista","Porteador|Porteadora","Montañero|Montañera","Vigía","Abridor de sendas|Abridora de sendas","Baqueano|Baqueana","Cartógrafo|Cartógrafa","Pionero|Pionera","Guía del sendero"]],
    ["Ladera", "La disciplina", ["Novicio|Novicia","Discípulo|Discípula","Escudero|Escudera","Practicante","Constante","Tenaz","Perseverante","Disciplinado|Disciplinada","Templado|Templada","Maestro de la ladera|Maestra de la ladera"]],
    ["Bosque alto", "El conocimiento", ["Lector|Lectora","Estudioso|Estudiosa","Observador|Observadora","Pensador|Pensadora","Erudito|Erudita","Letrado|Letrada","Humanista","Filósofo novel|Filósofa novel","Filósofo|Filósofa","Sabio del bosque|Sabia del bosque"]],
    ["Pedrera", "La fortaleza", ["Resistente","Firme","Recio|Recia","Robusto|Robusta","Fuerte","Indomable","Inquebrantable","Guerrero|Guerrera","Veterano|Veterana","Coloso de la pedrera|Coloso de la pedrera"]],
    ["Collado", "La serenidad", ["Sereno|Serena","Ecuánime","Mesurado|Mesurada","Prudente","Justo|Justa","Magnánimo|Magnánima","Imperturbable","Estoico|Estoica","Señor de sí|Señora de sí","Guardián de la ciudadela interior|Guardiana de la ciudadela interior"]],
    ["Arista", "El valor", ["Escalador|Escaladora","Compañero de cordada|Compañera de cordada","Primero de cuerda|Primera de cuerda","Equilibrista","Aristero|Aristera","Alpinista","Alpinista curtido|Alpinista curtida","Abridor de vías|Abridora de vías","Conquistador de aristas|Conquistadora de aristas","Maestro de la arista|Maestra de la arista"]],
    ["Glaciar", "La paciencia", ["Glaciarista","Caminante del hielo","Rompehielos","Buscador de grietas|Buscadora de grietas","Cruzador de glaciares|Cruzadora de glaciares","Explorador polar|Exploradora polar","Centinela del hielo","Pastor de seracs|Pastora de seracs","Señor del frío|Señora del frío","Guardián del glaciar|Guardiana del glaciar"]],
    ["Pared", "La voluntad", ["Escalador de pared|Escaladora de pared","Habitante de la pared","Ascensionista","Vivaquero|Vivaquera","Escalador de big wall|Escaladora de big wall","Domador de desplomes|Domadora de desplomes","Escalador de leyenda|Escaladora de leyenda","Señor de la pared|Señora de la pared","Abridor de lo imposible|Abridora de lo imposible","Maestro de la pared|Maestra de la pared"]],
    ["Cumbre", "La cima", ["Aspirante a cumbre","Cumbrero|Cumbrera","Tresmilista","Cuatromilista","Cincomilista","Seismilista","Sietemilista","Ochomilista","Conquistador de cumbres|Conquistadora de cumbres","Señor de las cumbres|Señora de las cumbres"]],
    ["Sobre las nubes", "La visión", ["Nefelibata","Contemplativo|Contemplativa","Clarividente","Visionario|Visionaria","Inspirado|Inspirada","Iluminado|Iluminada","Faro","Mentor|Mentora","Maestro de maestros|Maestra de maestras","Habitante de las nubes"]],
    ["Cielo", "La sabiduría", ["Sabio|Sabia","Gran sabio|Gran sabia","Consejero de reyes|Consejera de reyes","Clásico|Clásica","Leyenda","Mito","Inmortal","Eterno|Eterna","Polímata","Hombre de Vitruvio|Mujer de Vitruvio"]],
  ];
  const romano=n=>{ const t=[[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]]; let s=""; for(const [v,r] of t) while(n>=v){ s+=r; n-=v; } return s; };
  function nombre(n,figura){
    const f=figura==="mujer"?1:0, elegir=t=>{ const p=t.split("|"); return p[f]||p[0]; };
    if(n<=120){ const e=ETAPAS[Math.ceil(n/10)-1]; return elegir(e[2][(n-1)%10]); }
    // Más allá del 120 se sigue acumulando: «Hombre de Vitruvio II, III…»
    return elegir(ETAPAS[11][2][9])+" "+romano(n-119);
  }
  const etapa=n=>{ const e=ETAPAS[Math.min(12,Math.ceil(n/10))-1]; return {numero:Math.min(12,Math.ceil(n/10)), nombre:e[0], lema:e[1]}; };

  return {PUNTOS, experiencia, rachas, nivelDe, umbral, nombre, etapa, ETAPAS, LISTA_HECHA};
})();

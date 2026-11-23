// Resúmenes de la semana, el mes y el año ya cerrados: qué tal fue, calculado con los datos (nada se guarda),
// y su imagen para compartir (1080 × 1350, dibujada en un lienzo; la figura entra como imagen «blob:»).
"use strict";
window.AscensoResumenes=(()=>{
  const Est=window.AscensoEstadisticas, Niveles=window.AscensoNiveles, Obj=window.AscensoObjetivos, Figura=window.AscensoFigura;
  if(!Est||!Niveles) return null;
  const {clave,deClave}=Est;
  const mas=(d,n)=>{ const x=new Date(d); x.setDate(x.getDate()+n); return x; };
  const hoy=()=>{ const t=new Date(); t.setHours(0,0,0,0); return t; };
  const lunes=d=>mas(d,-((d.getDay()+6)%7));
  const diaDe=s=>{ if(!s) return null; s=String(s); if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; const d=new Date(s); return isNaN(d)?null:clave(d); };
  const MESES=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const NOMBRE={semana:"semana",mes:"mes","año":"año"};
  const may=s=>s.charAt(0).toUpperCase()+s.slice(1);

  // El periodo cerrado de un tipo: atras=0 es el último que ha terminado (la semana pasada, el mes pasado…)
  function limites(tipo,atras,ref){
    if(tipo==="semana"){ const desde=mas(lunes(ref),-7*(atras+1)); return {desde,hasta:mas(desde,6)}; }
    if(tipo==="mes"){ const desde=new Date(ref.getFullYear(),ref.getMonth()-1-atras,1); return {desde,hasta:new Date(desde.getFullYear(),desde.getMonth()+1,0)}; }
    const desde=new Date(ref.getFullYear()-1-atras,0,1); return {desde,hasta:new Date(desde.getFullYear(),11,31)};
  }
  function periodo(tipo,atras=0,ref=hoy()){
    const {desde,hasta}=limites(tipo,atras,ref), ant=limites(tipo,atras+1,ref), esteAño=ref.getFullYear();
    const dm=d=>`${d.getDate()} de ${MESES[d.getMonth()]}`;
    let titulo, rango;
    if(tipo==="semana"){
      titulo=`Semana del ${dm(desde)}${desde.getFullYear()!==esteAño?` de ${desde.getFullYear()}`:""}`;
      rango=desde.getMonth()===hasta.getMonth()?`${desde.getDate()} – ${dm(hasta)} de ${hasta.getFullYear()}`
        :desde.getFullYear()===hasta.getFullYear()?`${dm(desde)} – ${dm(hasta)} de ${hasta.getFullYear()}`:`${dm(desde)} de ${desde.getFullYear()} – ${dm(hasta)} de ${hasta.getFullYear()}`;
    }else if(tipo==="mes"){ titulo=`${may(MESES[desde.getMonth()])} de ${desde.getFullYear()}`; rango=`1 – ${dm(hasta)} de ${hasta.getFullYear()}`; }
    else{ titulo=`Año ${desde.getFullYear()}`; rango=`1 de enero – 31 de diciembre de ${desde.getFullYear()}`; }
    return {tipo, cual:tipo, atras, desde, hasta, anterior:ant, titulo, rango, clave:tipo+":"+clave(desde)};
  }
  // ¿Hay algo registrado antes del final de este periodo? (para no ofrecer resúmenes vacíos)
  const hayDatos=(state,per)=>{ const p=Est.primerDia(state); return !!p&&p<=clave(per.hasta); };

  function calcular(state,per,{libreria=null,tipoDe=null}={}){
    const dK=clave(per.desde), hK=clave(per.hasta), dentro=k=>k&&k>=dK&&k<=hK;
    const h=Est.habitos(state,per);
    const mejorHabito=h.porHabito.filter(x=>x.total>=2&&x.pct!=null).sort((a,b)=>b.pct-a.pct||b.hechos-a.hechos)[0]||null;
    const racha=Obj?Obj.medir(state,{tipo:"racha",meta:1e6,desde:dK,hasta:hK},{hasta:per.hasta}).valor:0;
    const t=Est.productividad(state,per);
    const porPrioridad={urgente:0,alta:0,media:0,baja:0};
    for(const x of Object.values(state.tasks||{})) if(x.list==="hecha"&&dentro(diaDe(x.done))&&x.prio in porPrioridad) porPrioridad[x.prio]++;
    const a=Est.animo(state,per);
    const reflex=(d,hh)=>Object.entries(state.notes||{}).filter(([k,n])=>k>=clave(d)&&k<=clave(hh)&&n&&String(n.r||"").trim()).length;
    // Experiencia ganada en el periodo y niveles subidos
    const xF=Niveles.experiencia(state,libreria,{hasta:per.hasta}), xI=Niveles.experiencia(state,libreria,{hasta:mas(per.desde,-1)});
    const nF=Niveles.nivelDe(xF.total), nI=Niveles.nivelDe(xI.total);
    const objetivos=Obj?Obj.evaluar(state,{libreria,nivel:Niveles.nivelDe(xF.total-(xF.partes.objetivos||0)).nivel,hasta:per.hasta})
      .filter(g=>g.m.cumplidoEl&&dentro(g.m.cumplidoEl)).map(g=>({id:g.id,titulo:g.titulo,el:g.m.cumplidoEl})):[];
    const desc=Est.descubrimientos(state,tipoDe,{hasta:per.hasta})[0]||null;
    return {
      habitos:{pct:h.pct,hechos:h.hechos,total:h.total,anterior:h.anterior}, mejorHabito:mejorHabito&&{nombre:mejorHabito.nombre,pct:mejorHabito.pct,hechos:mejorHabito.hechos,total:mejorHabito.total},
      racha, tareas:{hechas:t.hechas,anterior:t.anterior,porPrioridad,serie:t.serie},
      animo:{media:a.media,n:a.n,anterior:a.anterior}, reflexiones:{n:reflex(per.desde,per.hasta),anterior:reflex(per.anterior.desde,per.anterior.hasta)},
      objetivos, xp:{ganada:xF.total-xI.total,total:xF.total,nivelAntes:nI.nivel,nivel:nF.nivel,subidos:nF.nivel-nI.nivel,etapa:nF.etapa,progreso:nF.progreso},
      descubrimiento:desc&&desc.texto,
    };
  }

  // Una frase que resume el periodo, sin exagerar
  function frase(r,per){
    const n=NOMBRE[per.tipo], partes=[];
    if(r.habitos.pct!=null) partes.push(`cumpliste el ${Math.round(r.habitos.pct*100)} % de tus hábitos`);
    if(r.tareas.hechas) partes.push(`terminaste ${r.tareas.hechas} ${r.tareas.hechas===1?"tarea":"tareas"}`);
    if(r.xp.subidos>0) partes.push(`subiste ${r.xp.subidos===1?"un nivel":r.xp.subidos+" niveles"}`);
    if(!partes.length) return `Un ${n} tranquilo. Cada día es un buen día para volver a empezar.`;
    const t=partes.length>1?partes.slice(0,-1).join(", ")+" y "+partes[partes.length-1]:partes[0];
    let extra="";
    const ant=per.tipo==="semana"?"la semana anterior":per.tipo==="mes"?"el mes anterior":"el año anterior";
    if(r.habitos.anterior!=null&&r.habitos.pct!=null){ const d=Math.round((r.habitos.pct-r.habitos.anterior)*100); if(d>=5) extra=` Son ${d} puntos más de hábitos que ${ant}.`; else if(d<=-5) extra=` Algo menos que ${ant}: ${per.tipo==="semana"?"la siguiente":"el siguiente"} puede ser mejor.`; }
    return may(t)+"."+extra;
  }

  // Qué resumen avisar hoy en la página del día: el 1 de enero, el del año; el día 1, el del mes; el lunes, el de la semana
  function avisoDeHoy(ref=hoy()){
    if(ref.getMonth()===0&&ref.getDate()===1) return periodo("año",0,ref);
    if(ref.getDate()===1) return periodo("mes",0,ref);
    if(ref.getDay()===1) return periodo("semana",0,ref);
    return null;
  }

  // ------------------------------------------------------------------ la imagen
  const COLOR={papel:"#f6efdf",tinta:"#2a221a",suave:"#7b6a55",linea:"#d9ccb4",oro:"#b8862f"};
  function svgFigura(state,r){
    const base=Figura.svg({figura:state.perfil&&state.perfil.figura||"hombre", etapa:r.xp.etapa, avance:r.xp.nivel>=120?0:((r.xp.nivel-1)%10+r.xp.progreso)/10, nivel:r.xp.progreso, objetivos:null, titulo:""});
    // Para dibujarla como imagen necesita su espacio de nombres y los colores escritos dentro (no hay hoja de estilos)
    const estilo=`<style>.vf-papel{fill:#f3ead7}.vf-trazo{fill:none;stroke:#6b4a2b;stroke-width:1.1;stroke-linecap:round;stroke-linejoin:round}.vf-circulo,.vf-cuadrado{fill:none;stroke:#6b4a2b;stroke-width:.9;opacity:.75}.vf-anillo{fill:none;stroke:#b8862f;stroke-width:3.4;stroke-linecap:round}.vf-zona{fill:none}.vf-nota text,.vf-firma{fill:#6b4a2b;stroke:none;font-family:Georgia,serif;font-style:italic}.vf-guia{stroke-dasharray:3 3;opacity:.55}</style>`;
    return base.replace("<svg ",`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="660" `).replace(/(<svg[^>]*>)/,"$1"+estilo);
  }
  function cargarImagen(svg){
    return new Promise((ok,mal)=>{
      const url=URL.createObjectURL(new Blob([svg],{type:"image/svg+xml"})), img=new Image();
      img.onload=()=>{ ok(img); setTimeout(()=>URL.revokeObjectURL(url),1000); };
      img.onerror=()=>{ URL.revokeObjectURL(url); mal(new Error("figura")); };
      img.src=url;
    });
  }
  function envolver(c,texto,ancho){
    const palabras=String(texto).split(/\s+/), lineas=[]; let l="";
    for(const p of palabras){ const t=l?l+" "+p:p; if(c.measureText(t).width>ancho&&l){ lineas.push(l); l=p; } else l=t; }
    if(l) lineas.push(l); return lineas;
  }
  async function lienzo(state,per,r,{nombreNivel=""}={}){
    const W=1080, H=1350, cv=document.createElement("canvas"); cv.width=W; cv.height=H;
    const c=cv.getContext("2d"), cs=getComputedStyle(document.body);
    const sans=cs.fontFamily||"system-ui, sans-serif", serif=(getComputedStyle(document.querySelector("h1,.brand")||document.body).fontFamily)||"Georgia, serif";
    c.fillStyle=COLOR.papel; c.fillRect(0,0,W,H);
    const M=84;
    // Cabecera
    c.fillStyle=COLOR.oro; c.font=`600 26px ${sans}`; c.textBaseline="alphabetic";
    c.fillText(("Ascenso · resumen "+(per.tipo==="semana"?"de la semana":"del "+NOMBRE[per.tipo])).toUpperCase().split("").join(String.fromCharCode(8202)),M,M+20);
    c.fillStyle=COLOR.tinta; c.font=`700 68px ${serif}`;
    const tl=envolver(c,per.titulo,W-2*M); tl.slice(0,2).forEach((t,i)=>c.fillText(t,M,M+100+i*74));
    let y=M+100+(Math.min(2,tl.length)-1)*74;
    c.fillStyle=COLOR.suave; c.font=`30px ${sans}`; c.fillText(per.rango,M,y+50); y+=78;
    // Figura (a la izquierda) y nivel
    try{ const img=await cargarImagen(svgFigura(state,r)); c.drawImage(img,M-14,y,440,454); }catch(err){}
    const xd=M+460;
    c.fillStyle=COLOR.tinta; c.font=`700 120px ${serif}`; c.fillText(String(r.xp.nivel),xd,y+140);
    c.fillStyle=COLOR.suave; c.font=`28px ${sans}`; c.fillText("nivel",xd,y+182);
    c.fillStyle=COLOR.tinta; c.font=`600 34px ${serif}`;
    envolver(c,nombreNivel,W-M-xd).slice(0,2).forEach((t,i)=>c.fillText(t,xd,y+236+i*40));
    c.fillStyle=COLOR.oro; c.font=`600 32px ${sans}`;
    c.fillText(`+${Math.round(r.xp.ganada).toLocaleString("es-ES")} de experiencia`,xd,y+330);
    if(r.xp.subidos>0){ c.fillStyle=COLOR.suave; c.font=`28px ${sans}`; c.fillText(r.xp.subidos===1?`Subiste del ${r.xp.nivelAntes} al ${r.xp.nivel}`:`${r.xp.subidos} niveles: del ${r.xp.nivelAntes} al ${r.xp.nivel}`,xd,y+372); }
    y+=490;
    // Cifras: 3 × 2
    const cifras=[
      [r.habitos.pct==null?"—":Math.round(r.habitos.pct*100)+" %","hábitos cumplidos"],
      [String(r.racha),r.racha===1?"día de racha":"días de mejor racha"],
      [String(r.tareas.hechas),r.tareas.hechas===1?"tarea terminada":"tareas terminadas"],
      [r.animo.media==null?"—":r.animo.media.toLocaleString("es-ES",{maximumFractionDigits:1})+"/5","ánimo medio"],
      [String(r.reflexiones.n),r.reflexiones.n===1?"reflexión":"reflexiones"],
      [String(r.objetivos.length),r.objetivos.length===1?"objetivo cumplido":"objetivos cumplidos"]];
    const cw=(W-2*M)/3;
    c.strokeStyle=COLOR.linea; c.lineWidth=2; c.beginPath(); c.moveTo(M,y-20); c.lineTo(W-M,y-20); c.stroke();
    cifras.forEach(([v,t],i)=>{ const x=M+(i%3)*cw, yy=y+50+Math.floor(i/3)*150;
      c.fillStyle=COLOR.tinta; c.font=`700 64px ${serif}`; c.fillText(v,x,yy+20);
      c.fillStyle=COLOR.suave; c.font=`26px ${sans}`; c.fillText(t,x,yy+60); });
    y+=330;
    c.beginPath(); c.moveTo(M,y-20); c.lineTo(W-M,y-20); c.stroke();
    // La frase del periodo (y el mejor hábito)
    c.fillStyle=COLOR.tinta; c.font=`italic 34px ${serif}`;
    const fl=envolver(c,frase(r,per),W-2*M);
    fl.slice(0,3).forEach((t,i)=>c.fillText(t,M,y+30+i*46));
    y+=30+Math.min(3,fl.length)*46;
    if(r.mejorHabito){ c.fillStyle=COLOR.suave; c.font=`28px ${sans}`; envolver(c,`Tu hábito más constante: «${r.mejorHabito.nombre}», ${Math.round(r.mejorHabito.pct*100)} %.`,W-2*M).slice(0,2).forEach((t,i)=>c.fillText(t,M,y+18+i*38)); }
    c.fillStyle=COLOR.oro; c.fillRect(M,H-M-6,64,4);
    return cv;
  }
  function nombreArchivo(per){ return `Ascenso - ${per.titulo}`.replace(/[\\/:*?"<>|]+/g,"").slice(0,120)+".png"; }
  async function exportar(state,per,r,opciones){
    const cv=await lienzo(state,per,r,opciones), nombre=nombreArchivo(per);
    const blob=await new Promise(ok=>cv.toBlob(ok,"image/png"));
    if(!blob) throw new Error("No se pudo crear la imagen");
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=nombre;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),4000);
    return nombre;
  }

  return {periodo, hayDatos, calcular, frase, avisoDeHoy, lienzo, exportar, nombreArchivo};
})();

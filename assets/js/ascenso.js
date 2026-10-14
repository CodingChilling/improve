// Ascenso: lógica de la página
const TYPES = {
  climb:   {name:"Escalada", cls:"k-climb"},
  strength:{name:"Fuerza (pierna + empuje)", short:"Fuerza", cls:"k-strength"},
  active:  {name:"Descanso activo", cls:"k-active"},
  rest:    {name:"Descanso", cls:"k-rest"}
};
const ALL7=[true,true,true,true,true,true,true];
const DEFAULT_HABITS = [
  {id:"train",   t:"Entreno del día hecho", s:"Lo que toque según el plan"},
  {id:"kcal",    t:"Dentro de mis calorías", s:"Déficit de 300–500 kcal"},
  {id:"protein", t:"Proteína: 130 g o más", s:"Algo de proteína en cada comida"},
  {id:"nails",   t:"Sin morderme las uñas", s:""},
  {id:"sleep",   t:"Dormir 7 horas o más", s:""},
  {id:"sugar",   t:"Sin bebidas azucaradas", s:"Refrescos, zumos, cafés con sirope"}
].map(h=>({...h, streak:true, week:true, days:ALL7.slice()}));
const cleanHabits = arr => Array.isArray(arr) ? arr.filter(h=>h&&h.id).map(h=>({
  id:String(h.id), t:String(h.t||"Hábito"), s:String(h.s||""), streak:h.streak!==false, week:h.week!==false,
  days:Array.isArray(h.days)&&h.days.length===7?h.days.map(Boolean):ALL7.slice()})) : DEFAULT_HABITS.map(h=>({...h,days:h.days.slice()}));
const cleanState = (x,fallbackDays) => ({
  plan:Array.isArray(x.plan)&&x.plan.length===7&&x.plan.every(t=>t in TYPES)?x.plan.slice():DEFAULT_PLAN.slice(),
  days:Object.assign({}, fallbackDays||{}, x.days||{}),
  habits:cleanHabits(x.habits),
  thr:[0.5,0.66,0.75,1].includes(+x.thr)?+x.thr:0.66,
  hist:cleanHist(x.hist),
  tags:cleanTags(x.tags),
  tasks:cleanTasks(x.tasks),
  notes:cleanNotes(x.notes),
  events:cleanEvents(x.events),
  ...cleanBoardData(x)
});
// Eventos del calendario: {id: {start, end, time, title, color, created}}
function cleanEvents(x){
  const o={}, F=/^\d{4}-\d{2}-\d{2}$/;
  if(x&&typeof x==="object") for(const [id,e] of Object.entries(x)){
    if(!/^[A-Za-z0-9_-]{1,40}$/.test(id)||!e||!F.test(e.start||"")) continue;
    const title=String(e.title||"").trim().slice(0,120); if(!title) continue;
    const end=F.test(e.end||"")&&e.end>=e.start?e.end:e.start;
    o[id]={start:e.start, end, time:/^([01]\d|2[0-3]):[0-5]\d$/.test(e.time||"")?e.time:"", title,
      color:/^#[0-9A-Fa-f]{6}$/.test(e.color||"")?e.color.toUpperCase():"#2E86AB", created:String(e.created||e.start).slice(0,40)};
  }
  return o;
}
// Notas del día: {fecha: {r: reflexión, n: notas}}; los días sin nada escrito no se guardan
function cleanNotes(x){
  const o={};
  if(x&&typeof x==="object") for(const [k,v] of Object.entries(x)){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(k)||!v||typeof v!=="object") continue;
    const r=typeof v.r==="string"?v.r.slice(0,20000):"", n=typeof v.n==="string"?v.n.slice(0,20000):"";
    if(r.trim()||n.trim()) o[k]={r,n};
  }
  return o;
}
// Historial: qué frase (id) e imagen (ruta dentro de assets/images) se mostró cada día
function cleanHist(h){
  const o={};
  if(h&&typeof h==="object") for(const [k,v] of Object.entries(h)){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(k)||!v||typeof v!=="object") continue;
    const e={}; if(typeof v.q==="string"&&v.q) e.q=v.q; if(typeof v.img==="string"&&v.img) e.img=v.img;
    if(e.q||e.img) o[k]=e;
  }
  return o;
}
// ---------- Tareas y etiquetas ----------
const PRIOS=[["urgente","Urgente"],["alta","Alta"],["media","Media"],["baja","Baja"]];
const PRIO_RANK={urgente:0,alta:1,media:2,baja:3};
const LISTS=[["pendiente","Pendientes"],["proceso","En proceso"],["hecha","Hechas"]];
const TAG_COLORS=["#C0392B","#D9822B","#D4AC0D","#3D9468","#2E86AB","#5B5FC7","#9B59B6","#7F8C8D"];
const ID_OK=/^[A-Za-z0-9_-]{1,40}$/;
const newId=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
let taskTab="pendiente";
const newTaskTags=new Set();

function cleanTags(x){
  const o={};
  if(x&&typeof x==="object") for(const [id,t] of Object.entries(x)){
    if(!ID_OK.test(id)||!t) continue;
    const name=String(t.name||"").trim().slice(0,30);
    const color=/^#[0-9A-Fa-f]{6}$/.test(t.color||"")?t.color.toUpperCase():"#7F8C8D";
    if(name) o[id]={name,color};
  }
  return o;
}
function cleanTasks(x){
  const o={};
  if(x&&typeof x==="object") for(const [id,t] of Object.entries(x)){
    if(!ID_OK.test(id)||!t||!/^\d{4}-\d{2}-\d{2}$/.test(t.date||"")) continue;
    const title=String(t.title||"").trim().slice(0,120); if(!title) continue;
    o[id]={date:t.date, title, notes:String(t.notes||"").slice(0,2000),
      prio:t.prio in PRIO_RANK?t.prio:"media",
      list:["pendiente","proceso","hecha"].includes(t.list)?t.list:"pendiente",
      tags:Array.isArray(t.tags)?t.tags.filter(v=>typeof v==="string"&&ID_OK.test(v)):[],
      created:String(t.created||t.date).slice(0,40)};
  }
  return o;
}
// ---------- Tableros: datos ----------
// boards {id: {name, color, fav, order, created}}
// blabels {id: {board, name, color}}             etiquetas propias de cada tablero
// blists {id: {board, title, order, collapsed}}
// cards {id: {list, title, desc, prio, due, labels:[ids], check:[{id,t,d}], order, created}}
const B_PRIOS=[["urgente","Urgente"],["alta","Alta"],["media","Media"],["baja","Baja"],["ninguna","Sin prioridad"]];
const B_PRIO_OK=new Set(B_PRIOS.map(p=>p[0]));
const B_COLORS=["#2E86AB","#3D9468","#D9822B","#C0392B","#5B5FC7","#9B59B6","#D4AC0D","#7F8C8D"];
function cleanBoardData(x){
  const ID=/^[A-Za-z0-9_-]{1,40}$/, HEX=/^#[0-9A-Fa-f]{6}$/, F=/^\d{4}-\d{2}-\d{2}$/;
  const num=v=>Number.isFinite(+v)?Math.round(+v):0, obj=v=>v&&typeof v==="object"?v:{};
  const boards={}, blabels={}, blists={}, cards={};
  for(const [id,b] of Object.entries(obj(x.boards))){
    if(!ID.test(id)||!b) continue;
    const name=String(b.name||"").trim().slice(0,60); if(!name) continue;
    boards[id]={name, color:HEX.test(b.color||"")?b.color.toUpperCase():B_COLORS[0], fav:!!b.fav, order:num(b.order), created:String(b.created||"").slice(0,40)};
  }
  for(const [id,l] of Object.entries(obj(x.blabels))){
    if(!ID.test(id)||!l||!boards[l.board]) continue;
    const name=String(l.name||"").trim().slice(0,30); if(!name) continue;
    blabels[id]={board:l.board, name, color:HEX.test(l.color||"")?l.color.toUpperCase():B_COLORS[0]};
  }
  for(const [id,l] of Object.entries(obj(x.blists))){
    if(!ID.test(id)||!l||!boards[l.board]) continue;
    const title=String(l.title||"").trim().slice(0,60); if(!title) continue;
    blists[id]={board:l.board, title, order:num(l.order), collapsed:!!l.collapsed};
  }
  for(const [id,c] of Object.entries(obj(x.cards))){
    if(!ID.test(id)||!c||!blists[c.list]) continue;
    const title=String(c.title||"").trim().slice(0,200); if(!title) continue;
    const bid=blists[c.list].board;
    cards[id]={list:c.list, title, desc:String(c.desc||"").slice(0,10000), prio:B_PRIO_OK.has(c.prio)?c.prio:"ninguna",
      due:F.test(c.due||"")?c.due:"",
      labels:Array.isArray(c.labels)?c.labels.filter((l,i,a)=>blabels[l]&&blabels[l].board===bid&&a.indexOf(l)===i):[],
      check:Array.isArray(c.check)?c.check.filter(k=>k&&ID.test(k.id||"")&&String(k.t||"").trim()).slice(0,100)
        .map(k=>({id:k.id, t:String(k.t).trim().slice(0,300), d:!!k.d})):[],
      order:num(c.order), created:String(c.created||"").slice(0,40)};
  }
  return {boards, blabels, blists, cards};
}
const DOW = ["L","M","X","J","V","S","D"];
const DEFAULT_PLAN = ["climb","strength","climb","climb","rest","strength","climb"];

let state = cleanState({});
let sel = new Date(); sel.setHours(0,0,0,0);


const key = d => d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const dowIdx = d => (d.getDay()+6)%7;
const monday = d => { const m=new Date(d); m.setDate(m.getDate()-dowIdx(m)); m.setHours(0,0,0,0); return m; };
const addDays = (d,n) => { const x=new Date(d); x.setDate(x.getDate()+n); return x; };
const today = () => { const t=new Date(); t.setHours(0,0,0,0); return t; };
const dayData = d => state.days[key(d)] || {};
const typeFor = d => dayData(d).type || state.plan[dowIdx(d)];
const applies = (h,d) => h.days[dowIdx(d)];
const counts = (d,flag) => { const c=dayData(d).c||{}; const hs=state.habits.filter(h=>h[flag]&&applies(h,d)); return {done:hs.filter(h=>c[h.id]).length,total:hs.length}; };
const ratio = d => { const x=counts(d,"week"); return x.total?x.done/x.total:0; };
const esc = t => String(t).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));

function renderWeek(){
  const m = monday(sel), w = document.getElementById("week"); w.innerHTML="";
  for(let i=0;i<7;i++){
    const d=addDays(m,i), b=document.createElement("button");
    b.className="day"+(key(d)===key(sel)?" sel":"");
    b.setAttribute("aria-label", d.toLocaleDateString("es-ES",{weekday:"long",day:"numeric"})+", "+TYPES[typeFor(d)].name);
    b.innerHTML=`<span class="dn">${DOW[i]}</span><span class="dd">${d.getDate()}</span><span class="hold ${TYPES[typeFor(d)].cls}"></span><span class="pct"><i style="width:${Math.round(ratio(d)*100)}%"></i></span>`;
    b.onclick=()=>{sel=d;render();};
    w.appendChild(b);
  }
  document.getElementById("legend").innerHTML=Object.values(TYPES).map(t=>`<span><b class="${t.cls}"></b>${t.short||t.name}</span>`).join("");
}

function renderDay(){
  const isToday = key(sel)===key(today());
  document.getElementById("h-day").textContent = isToday ? "Hoy" :
    sel.toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"}).replace(/^./,c=>c.toUpperCase());
  const p=document.getElementById("plan"); p.innerHTML="";
  const cur=typeFor(sel);
  for(const [id,t] of Object.entries(TYPES)){
    const b=document.createElement("button");
    b.setAttribute("aria-pressed", id===cur);
    b.innerHTML=`<b class="${t.cls}"></b>${t.short||t.name}`;
    b.onclick=()=>{
      // Cambia el plan fijo de ese día de la semana
      state.plan[dowIdx(sel)]=id;
      const dd=state.days[key(sel)]; if(dd) delete dd.type;
      save(); render();
    };
    p.appendChild(b);
  }
  const ul=document.getElementById("checks"); ul.innerHTML="";
  const c=dayData(sel).c||{};
  const todays=state.habits.filter(h=>applies(h,sel));
  if(!todays.length){ ul.innerHTML='<li class="empty">No hay hábitos para este día. Puedes añadirlos en Configurar hábitos.</li>'; }
  for(const h of todays){
    const li=document.createElement("li"), b=document.createElement("button");
    b.setAttribute("role","checkbox"); b.setAttribute("aria-checked", !!c[h.id]);
    let sub=esc(h.s);
    if(h.id==="train") sub = cur==="rest" ? "Hoy toca descansar: márcalo si descansaste" : "Hoy: "+TYPES[cur].name;
    b.innerHTML=`<span class="box"><svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="var(--bg)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="t">${esc(h.t)}${sub?`<small>${sub}</small>`:""}</span>`;
    b.onclick=()=>{
      const k=key(sel); state.days[k]=state.days[k]||{}; state.days[k].c=state.days[k].c||{};
      state.days[k].c[h.id]=!state.days[k].c[h.id];
      save(); render();
    };
    li.appendChild(b); ul.appendChild(li);
  }
  const w=document.getElementById("w"); w.value = dayData(sel).w ?? "";
  document.getElementById("next").disabled = key(sel)===key(today());
}

function weekSummary(m){
  let done=0,total=0,n=0,ws=[];
  for(let i=0;i<7;i++){ const d=addDays(m,i); if(d>today()) break; const x=counts(d,"week"); done+=x.done; total+=x.total; n++; const w=dayData(d).w; if(w) ws.push(+w); }
  return {pct:total?done/total:0, avg: ws.length? ws.reduce((a,b)=>a+b,0)/ws.length : null, days:n};
}

function renderProgress(){
  // Racha: días seguidos alcanzando el mínimo configurado
  const ok = d => { const x=counts(d,"streak"); return x.total===0 ? null : x.done/x.total >= state.thr-1e-9; };
  let streak=0, d=today();
  if(ok(d)!==true) d=addDays(d,-1);
  for(let i=0;i<730;i++,d=addDays(d,-1)){ const r=ok(d); if(r===null) continue; if(!r) break; streak++; }
  document.getElementById("streakN").textContent=streak;
  document.getElementById("streakL").innerHTML=(streak===1?"día de racha":"días de racha")+"<small>"+(streak===0?"Cumple tus hábitos de hoy y empieza a subir.":streak<7?"Paso a paso. Sigue subiendo.":streak<30?"Ya estás por encima de las nubes.":"Esto ya es una forma de vivir.")+"</small>";
  const wk=weekSummary(monday(today()));
  const weeks=[]; let m=monday(today());
  for(let i=0;i<8;i++){ weeks.push({m, ...weekSummary(m)}); m=addDays(m,-7); }
  const withW=weeks.filter(x=>x.avg!=null);
  let change="—";
  if(withW.length>=2){ const diff=withW[0].avg-withW[withW.length-1].avg; change=(diff>0?"+":"")+diff.toFixed(1)+" kg"; }
  document.getElementById("stats").innerHTML=`
    <div class="stat"><div class="v">${Math.round(wk.pct*100)}&nbsp;%</div><div class="l">hábitos cumplidos esta semana</div></div>
    <div class="stat"><div class="v">${wk.avg!=null?wk.avg.toFixed(1):"—"}</div><div class="l">peso medio esta semana (kg)</div></div>
    <div class="stat"><div class="v">${change}</div><div class="l">cambio desde la semana más antigua con datos</div></div>`;
  const rows=weeks.filter(x=>x.pct>0||x.avg!=null);
  document.getElementById("hist").innerHTML = rows.length ?
    `<thead><tr><th>Semana del</th><th class="num">Hábitos</th><th class="num">Peso medio</th></tr></thead><tbody>`+
    rows.map(x=>`<tr><td>${x.m.toLocaleDateString("es-ES",{day:"numeric",month:"short"})}</td><td class="num">${Math.round(x.pct*100)} %</td><td class="num">${x.avg!=null?x.avg.toFixed(1)+" kg":"—"}</td></tr>`).join("")+"</tbody>"
    : `<tbody><tr><td class="empty">Marca tus primeros hábitos y apunta tu peso para ver aquí la evolución semanal.</td></tr></tbody>`;
}

// Cada frase: [texto, autor, obra, id]. El id es lo que se guarda en el historial: no lo cambies.
const QUOTES = [
  ["Lo que impide la acción hace avanzar la acción. Lo que se interpone en el camino se convierte en el camino.","Marco Aurelio","Meditaciones, V 20","f01"],
  ["No es que tengamos poco tiempo, es que perdemos mucho.","Séneca","Sobre la brevedad de la vida","f02"],
  ["Ninguna gran cosa nace de repente.","Epicteto","Disertaciones, I 15","f03"],
  ["Porque está ahí.","George Mallory","Al preguntarle por qué quería subir el Everest, 1923","f04"],
  ["No pierdas más tiempo discutiendo cómo debe ser un hombre bueno. Sé uno.","Marco Aurelio","Meditaciones, X 16","f05"],
  ["Quien tiene un porqué para vivir soporta casi cualquier cómo.","Friedrich Nietzsche","Crepúsculo de los ídolos","f06"],
  ["Hoy es la victoria sobre el que fuiste ayer.","Miyamoto Musashi","El libro de los cinco anillos","f07"],
  ["Sufrimos más a menudo en la imaginación que en la realidad.","Séneca","Cartas a Lucilio, 13","f08"],
  ["El mérito es de quien está de verdad en la arena, con el rostro cubierto de polvo, sudor y sangre.","Theodore Roosevelt","Discurso en la Sorbona, 1910","f09"],
  ["Al amanecer, cuando te cueste levantarte, piensa: me levanto para hacer el trabajo de un ser humano.","Marco Aurelio","Meditaciones, V 1","f10"],
  ["Primero dite a ti mismo quién quieres ser; después haz lo que tengas que hacer.","Epicteto","Disertaciones, III 23","f11"],
  ["Un viaje de mil li empieza bajo tus pies.","Lao Tse","Tao Te Ching, 64","f12"],
  ["No dejamos de atrevernos porque las cosas sean difíciles; son difíciles porque no nos atrevemos.","Séneca","Cartas a Lucilio, 104","f13"],
  ["Nos hacemos valientes realizando actos valientes.","Aristóteles","Ética a Nicómaco, II","f14"],
  ["Muy poco hace falta para una vida feliz: todo está dentro de ti, en tu manera de pensar.","Marco Aurelio","Meditaciones, VII 67","f15"],
  ["El carácter de un hombre es su destino.","Heráclito","Fragmento 119","f16"],
  ["El fuego prueba el oro; la adversidad, a los fuertes.","Séneca","Sobre la providencia","f17"],
  ["No nos perturban las cosas, sino las opiniones que tenemos sobre ellas.","Epicteto","Enquiridión, 5","f18"],
  ["Paciencia y barajar.","Miguel de Cervantes","Don Quijote, II 23","f19"],
  ["Mira hacia dentro. Dentro está la fuente del bien, y brotará siempre si siempre cavas.","Marco Aurelio","Meditaciones, VII 59","f20"],
  ["Lo que no me mata me hace más fuerte.","Friedrich Nietzsche","Crepúsculo de los ídolos","f21"],
  ["Mientras se aplaza, la vida pasa de largo.","Séneca","Cartas a Lucilio, 1","f22"],
  ["El hombre noble es modesto en sus palabras y va más allá en sus actos.","Confucio","Analectas, XIV","f23"],
  ["Si algo es posible y propio del ser humano, considéralo también a tu alcance.","Marco Aurelio","Meditaciones, VI 19","f24"],
  ["Hacerse invencible depende de uno mismo.","Sun Tzu","El arte de la guerra, IV","f25"],
  ["Ningún viento es favorable para quien no sabe a qué puerto se dirige.","Séneca","Cartas a Lucilio, 71","f26"],
  ["La mejor manera de vengarse es no parecerse a quien te hizo daño.","Marco Aurelio","Meditaciones, VI 6","f27"],
  ["Nadie se baña dos veces en el mismo río.","Heráclito","Fragmento 91","f28"],
  ["Algunas cosas dependen de nosotros y otras no.","Epicteto","Enquiridión, 1","f29"],
  ["Haz cada cosa como si fuera la última de tu vida.","Marco Aurelio","Meditaciones, II 5","f30"],
  ["Pronto lo habrás olvidado todo; pronto todos te habrán olvidado.","Marco Aurelio","Meditaciones, VII 21","f31"],
  ["El universo es cambio; la vida, opinión.","Marco Aurelio","Meditaciones, IV 3","f32"],
  ["El alma acaba tiñéndose del color de sus pensamientos.","Marco Aurelio","Meditaciones, V 16","f33"],
  ["Si no conviene, no lo hagas; si no es verdad, no lo digas.","Marco Aurelio","Meditaciones, XII 17","f34"],
  ["Piensa que ya has muerto y que tu vida ha terminado hasta hoy; vive lo que te queda de acuerdo con la naturaleza.","Marco Aurelio","Meditaciones, VII 56","f35"],
  ["En cualquier momento puedes retirarte dentro de ti mismo; no hay refugio más tranquilo que el propio espíritu.","Marco Aurelio","Meditaciones, IV 3","f36"],
  ["No actúes como si fueras a vivir diez mil años. Mientras vives, mientras puedes, sé bueno.","Marco Aurelio","Meditaciones, IV 17","f37"],
  ["Cuanto más cerca está un hombre de la calma, más cerca está de la fuerza.","Marco Aurelio","Meditaciones, XI 18","f38"],
  ["Mientras enseñamos, aprendemos.","Séneca","Cartas a Lucilio, 7","f39"],
  ["No es pobre quien tiene poco, sino quien desea más.","Séneca","Cartas a Lucilio, 2","f40"],
  ["Necesitas cambiar de alma, no de cielo.","Séneca","Cartas a Lucilio, 28","f41"],
  ["Vivir es combatir.","Séneca","Cartas a Lucilio, 96","f42"],
  ["Toda la vida hay que aprender a vivir y, lo que quizá te sorprenda más, toda la vida hay que aprender a morir.","Séneca","Sobre la brevedad de la vida, 7","f43"],
  ["Quien está en todas partes no está en ninguna.","Séneca","Cartas a Lucilio, 2","f44"],
  ["A veces, incluso vivir es un acto de valentía.","Séneca","Cartas a Lucilio, 78","f45"],
  ["Nadie es libre si no es dueño de sí mismo.","Epicteto","Fragmentos","f46"],
  ["Es imposible que alguien aprenda lo que cree que ya sabe.","Epicteto","Disertaciones, II 17","f47"],
  ["Si quieres progresar, conténtate con parecer necio en lo que no depende de ti.","Epicteto","Enquiridión, 13","f48"],
  ["No pidas que las cosas sucedan como quieres; quiere que sucedan como suceden, y vivirás sereno.","Epicteto","Enquiridión, 8","f49"],
  ["Son las dificultades las que muestran lo que son los hombres.","Epicteto","Disertaciones, I 24","f50"],
  ["Si haces algo bueno con esfuerzo, el esfuerzo pasa y el bien queda; si haces algo vergonzoso con placer, el placer pasa y la vergüenza queda.","Musonio Rufo","Fragmento 51","f51"],
  ["Tenemos dos oídos y una sola boca para escuchar más y hablar menos.","Zenón de Citio","Según Diógenes Laercio, VII 23","f52"],
  ["La felicidad es el buen fluir de la vida.","Zenón de Citio","Según Estobeo","f53"],
  ["El destino guía a quien lo acepta y arrastra a quien se resiste.","Cleantes","Citado por Séneca, Cartas a Lucilio, 107","f54"],
  ["Vivir es pensar.","Cicerón","Disputaciones tusculanas, V","f55"],
  ["El camino hacia arriba y el camino hacia abajo son uno y el mismo.","Heráclito","Fragmento 60","f56"],
  ["Una vida sin examen no merece ser vivida.","Sócrates","Según Platón, Apología, 38a","f57"],
  ["Lo más grande del mundo es saber pertenecerse a uno mismo.","Michel de Montaigne","Ensayos, I 39","f58"],
  ["Quiero que la muerte me encuentre plantando mis coles.","Michel de Montaigne","Ensayos, I 20","f59"],
  ["Todo lo excelso es tan difícil como raro.","Baruch Spinoza","Ética, V 42","f60"],
  ["Toda la desgracia de los hombres viene de no saber quedarse tranquilos en una habitación.","Blaise Pascal","Pensamientos, 139","f61"],
  ["Fui a los bosques porque quería vivir con propósito y enfrentarme solo a lo esencial de la vida.","Henry David Thoreau","Walden","f62"],
  ["Nada puede traerte paz salvo tú mismo.","Ralph Waldo Emerson","Confianza en uno mismo","f63"],
  ["Más vale una sola palabra que traiga paz que mil palabras vacías.","Buda","Dhammapada, 100","f64"],
  ["Quien vence a otros es fuerte; quien se vence a sí mismo es poderoso.","Lao Tse","Tao Te Ching, 33","f65"],
  ["Lo que hay que aprender a hacer, lo aprendemos haciéndolo.","Aristóteles","Ética a Nicómaco, II 1","f66"],
  ["No estropees lo que tienes deseando lo que no tienes.","Epicuro","Sentencias vaticanas, 35","f67"],
  ["Las montañas me llaman y debo ir.","John Muir","Carta a su hermana, 1873","f68"]
];
// ---------- Imágenes: siempre de ./assets/images ----------
const IMG_DIR="assets/images/";
const AUTHOR_KEYS={"Marco Aurelio":"marco-aurelio","Séneca":"seneca","Epicteto":"epicteto","George Mallory":"mallory","Friedrich Nietzsche":"nietzsche",
  "Miyamoto Musashi":"musashi","Theodore Roosevelt":"roosevelt","Lao Tse":"lao-tse","Aristóteles":"aristoteles","Heráclito":"heraclito",
  "Miguel de Cervantes":"cervantes","Confucio":"confucio","Sun Tzu":"sun-tzu","Musonio Rufo":"musonio","Zenón de Citio":"zenon",
  "Cleantes":"cleantes","Cicerón":"ciceron","Sócrates":"socrates","Michel de Montaigne":"montaigne","Baruch Spinoza":"spinoza",
  "Blaise Pascal":"pascal","Henry David Thoreau":"thoreau","Ralph Waldo Emerson":"emerson","Buda":"buda","Epicuro":"epicuro","John Muir":"muir"};
const KEY_NAMES=Object.fromEntries(Object.entries(AUTHOR_KEYS).map(([n,k])=>[k,n]));
const IMG_RE=/\.(jpe?g|png|webp|gif|avif)$/i;
let IMAGES=[], imagesReady=false, frameSrc=null, frameArgs=["",""];
const norm=t=>t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[\s_]+/g,"-");

// Con un servidor genérico (no servidor.py), se lee el listado de la carpeta
async function listOverHttp(url,depth=0,out=[]){
  const r=await fetch(url); if(!r.ok) return out;
  const doc=new DOMParser().parseFromString(await r.text(),"text/html");
  for(const a of doc.querySelectorAll("a[href]")){
    const u=new URL(a.getAttribute("href"),url);
    if(!u.href.startsWith(url) || u.href===url) continue;
    const name=decodeURIComponent(u.pathname.split("/").filter(Boolean).pop()||"");
    if(IMG_RE.test(u.pathname)) out.push({name,src:u.href});
    else if(u.pathname.endsWith("/") && depth<2) await listOverHttp(u.href,depth+1,out);
  }
  return out;
}
// Abierto como archivo, sin servidor: el navegador no puede ver la carpeta,
// así que se usa lista.js o los nombres 1.jpg, 2.jpg, seneca.jpg...
function loadScript(src){return new Promise(r=>{const el=document.createElement("script");el.src=src;el.onload=()=>r(true);el.onerror=()=>{el.remove();r(false);};document.head.appendChild(el);});}
function probe(src){return new Promise(r=>{const i=new Image();i.onload=()=>r(src);i.onerror=()=>r(null);i.src=src;});}
async function fileDiscover(){
  let names=[];
  if(await loadScript(IMG_DIR+"lista.js") && Array.isArray(window.ASCENSO_IMAGENES)) names=window.ASCENSO_IMAGENES.map(String).filter(Boolean);
  if(!names.length){
    const exts=["jpg","jpeg","png","webp"];
    for(let i=1;i<=20;i++) for(const e of exts) names.push(i+"."+e);
    for(const k of new Set(Object.values(AUTHOR_KEYS))) for(const suf of ["","-2","-3"]) for(const e of exts) names.push(k+suf+"."+e);
  }
  const found=await Promise.all(names.map(n=>probe(IMG_DIR+n.split("/").map(encodeURIComponent).join("/")).then(src=>src&&{name:n,src})));
  return found.filter(Boolean);
}
async function discoverImages(){
  let list=[];
  if(API){
    try{ list=(await api("GET","imagenes")).map(x=>({name:x.nombre,src:x.url})); }
    catch(e){ try{ list=await listOverHttp(new URL(IMG_DIR,location.href).href); }catch(e2){} }
  } else list=await fileDiscover();
  list.sort((a,b)=>a.name.localeCompare(b.name,"es",{numeric:true}));
  IMAGES=list.map(x=>({
    src:x.src,
    id:decodeURIComponent(new URL(x.src,location.href).pathname).split("/assets/images/").pop(),
    key:Object.values(AUTHOR_KEYS).find(k=>norm(x.name).includes(k))||null
  }));
  imagesReady=true; frameSrc=null;
  const t = IMAGES.length ? IMAGES.length+(IMAGES.length===1?" imagen":" imágenes")+" en assets/images."
    : API ? "No hay imágenes en assets/images."
    : "Para mostrar las imágenes de assets/images, abre Ascenso con iniciar-ascenso.";
  document.getElementById("imgstatus").textContent=t;
  document.getElementById("imgcfg").textContent=t;
  renderFrame(...frameArgs);
}
function renderFrame(k,author){
  frameArgs=[k,author];
  const head=document.getElementById("head");
  if(!imagesReady) return;
  if(!IMAGES.length){ head.classList.add("no-img"); return; }
  head.classList.remove("no-img");
  const im=imageFor(k,author,false);
  document.getElementById("fcap").textContent = im.key ? KEY_NAMES[im.key] : "";
  if(im.src===frameSrc) return;
  frameSrc=im.src;
  const a=document.getElementById("fa"), b=document.getElementById("fb");
  const [cur,next]=a.classList.contains("on")?[a,b]:[b,a];
  next.onload=()=>{
    if(frameSrc!==im.src) return;               // llegó tarde: ya se pidió otra imagen
    im.w=next.naturalWidth; im.h=next.naturalHeight; frameIm=im;
    sizeFrame(im);
    next.classList.add("on"); cur.classList.remove("on");
  };
  next.src=im.src;
}
// El marco toma la proporción exacta de la imagen, dentro de un tamaño máximo
let frameIm=null;
function frameBounds(){
  const vw=window.innerWidth;
  return vw>=700 ? {w:300,h:380} : {w:Math.min(vw*0.4,170),h:220};
}
function sizeFrame(im){
  if(!im||!im.w||!im.h) return;
  const {w,h}=frameBounds(), k=Math.min(w/im.w,h/im.h);
  const win=document.querySelector("#frame .win");
  win.style.width=Math.round(im.w*k)+"px"; win.style.height=Math.round(im.h*k)+"px";
}
window.addEventListener("resize",()=>sizeFrame(frameIm));
// Tocar el marco elige otra imagen para ese día y la deja guardada en el historial
function nextFrame(){
  if(IMAGES.length<2) return;
  const [k,author]=frameArgs; imageFor(k,author,true); renderFrame(k,author);
}
document.getElementById("frame").addEventListener("click",nextFrame);
document.getElementById("frame").addEventListener("keydown",e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); nextFrame(); } });
// ---------- Historial: frase e imagen de cada día, sin repetir hasta agotar todas ----------
const pickRandom=arr=>arr[Math.floor(Math.random()*arr.length)];
// Recorre el historial por fechas y devuelve lo ya usado en la ronda actual de un conjunto
function roundUsed(ids,field){
  const inPool=new Set(ids); let used=new Set(), last=null;
  for(const d of Object.keys(state.hist).sort()){
    const v=state.hist[d][field]; if(!inPool.has(v)) continue;
    used.add(v); last=v;
    if(used.size>=inPool.size) used=new Set();   // ronda completa: empieza otra
  }
  return {used,last};
}
function chooseFrom(cands,poolIds,field){
  const {used,last}=roundUsed(poolIds,field);
  let free=cands.filter(id=>!used.has(id));
  if(!free.length) free=cands.slice();
  if(free.length>1) free=free.filter(id=>id!==last);   // nunca la misma que la anterior
  return pickRandom(free);
}
function setHist(k,field,value){ state.hist[k]={...(state.hist[k]||{}),[field]:value}; save(); }
function quoteFor(k){
  const h=state.hist[k]; let i=h?QUOTES.findIndex(x=>x[3]===h.q):-1;
  if(i<0){
    const ids=QUOTES.map(x=>x[3]), id=chooseFrom(ids,ids,"q");
    setHist(k,"q",id); i=QUOTES.findIndex(x=>x[3]===id);
  }
  return QUOTES[i];
}
// Imágenes del autor de la frase si las hay; si no, las genéricas (o todas)
function poolFor(author){
  const key=AUTHOR_KEYS[author], own=IMAGES.filter(x=>x.key&&x.key===key);
  if(own.length) return own;
  const gen=IMAGES.filter(x=>!x.key); return gen.length?gen:IMAGES;
}
function imageFor(k,author,change){
  const h=state.hist[k]||{}, byId=new Map(IMAGES.map(x=>[x.id,x]));
  if(!change && h.img && byId.has(h.img)) return byId.get(h.img);
  const pool=poolFor(author).map(x=>x.id);
  let cands=pool;
  if(change){
    cands=pool.filter(id=>id!==h.img);
    if(!cands.length) cands=IMAGES.map(x=>x.id).filter(id=>id!==h.img);
    if(!cands.length) return byId.get(h.img);
  }
  const id=chooseFrom(cands,pool,"img");
  setHist(k,"img",id);
  return byId.get(id);
}
let lastQuote=null;
function renderQuote(){
  const t=sel, k=key(sel);
  const [q,a,src]=quoteFor(k);
  const bq=document.getElementById("quote");
  if(lastQuote!==null && lastQuote!==q){ bq.style.animation="none"; void bq.offsetWidth; bq.style.animation="rise .7s both cubic-bezier(.2,.7,.2,1)"; }
  lastQuote=q;
  bq.querySelector("p").textContent=q;
  bq.querySelector("footer").innerHTML=esc(a)+"<cite>"+esc(src)+"</cite>";
  renderFrame(k,a);
  if(!pad.hidden && padDay!==k) closePad();
  updateQmark();
  const d=t.toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"});
  document.getElementById("hdate").textContent=d.charAt(0).toUpperCase()+d.slice(1);
}
// ---------- Notas y reflexión del día: se abren pulsando las comillas de la frase ----------
const qmark=document.getElementById("qmark"), pad=document.getElementById("notepad");
const padR=document.getElementById("np-r"), padN=document.getElementById("np-n"), padSaved=document.getElementById("np-saved");
let padDay=null, padTimer=null, padPending=false;
let padTab=(()=>{ try{ return localStorage.getItem("ascenso-notetab")==="n"?"n":"r"; }catch(e){ return "r"; } })();
// Las comillas se ven algo más intensas los días en que hay algo escrito
function updateQmark(){ qmark.classList.toggle("has-note", !!state.notes[key(sel)]); }
function growPad(ta){ ta.style.height="auto"; ta.style.height=Math.min(ta.scrollHeight, Math.round(window.innerHeight*0.5))+"px"; }
function setPadTab(t){
  padTab=t; try{ localStorage.setItem("ascenso-notetab",t); }catch(e){}
  pad.querySelectorAll("[data-tab]").forEach(b=>b.setAttribute("aria-selected", String(b.dataset.tab===t)));
  padR.hidden=t!=="r"; padN.hidden=t!=="n";
  const ta=t==="r"?padR:padN; growPad(ta); ta.focus(); ta.setSelectionRange(ta.value.length,ta.value.length);
}
function openPad(){
  padDay=key(sel);
  const n=state.notes[padDay]||{};
  padR.value=n.r||""; padN.value=n.n||"";
  const d=sel.toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"});
  document.getElementById("np-date").textContent=d.charAt(0).toUpperCase()+d.slice(1);
  padSaved.classList.remove("show");
  pad.hidden=false; qmark.setAttribute("aria-expanded","true");
  setPadTab(padTab);
}
function storePad(){
  if(!padDay) return;
  const r=padR.value, n=padN.value;
  if(r.trim()||n.trim()) state.notes[padDay]={r,n}; else delete state.notes[padDay];
}
function flushPad(){
  if(!padPending) return;
  clearTimeout(padTimer); padPending=false; storePad(); save(); updateQmark();
}
function closePad(){
  if(pad.hidden) return;
  flushPad(); pad.hidden=true; qmark.setAttribute("aria-expanded","false"); padDay=null;
}
// Guardado automático: medio segundo después de dejar de escribir
function padInput(e){
  growPad(e.target); padPending=true; storePad();
  clearTimeout(padTimer); padTimer=setTimeout(flushPad,600);
}
// Si se cierra la ventana o se cambia de aplicación justo después de escribir, se envía al momento
function persistPadNow(){
  if(!padDay) return;
  const pending=padPending; clearTimeout(padTimer); padPending=false; storePad(); saveLocal();
  if(pending && online){
    const v=state.notes[padDay]||{r:"",n:""};
    fetch(API+"notas/"+padDay,{method:"PUT",keepalive:true,headers:{"X-Ascenso":"1","Content-Type":"application/json"},body:JSON.stringify(v)})
      .then(r=>{ if(r.ok){ if(state.notes[padDay]) synced.notes[padDay]=JSON.parse(JSON.stringify(v)); else delete synced.notes[padDay]; } }).catch(()=>{});
  } else if(pending) save();
}
document.addEventListener("ascenso:guardado",()=>{
  if(pad.hidden) return;
  padSaved.classList.remove("show"); void padSaved.offsetWidth; padSaved.classList.add("show");
});
qmark.addEventListener("click",()=>{ pad.hidden ? openPad() : closePad(); });
pad.addEventListener("click",e=>{ const b=e.target.closest("[data-tab]"); if(b) setPadTab(b.dataset.tab); });
padR.addEventListener("input",padInput); padN.addEventListener("input",padInput);
document.addEventListener("pointerdown",e=>{ if(!pad.hidden && !pad.contains(e.target) && !qmark.contains(e.target)) closePad(); });
document.addEventListener("keydown",e=>{ if(e.key==="Escape" && !pad.hidden){ closePad(); qmark.focus(); } });
window.addEventListener("pagehide",persistPadNow);
document.addEventListener("visibilitychange",()=>{ if(document.hidden) persistPadNow(); });
// ---------- Calendario (oculto: se abre pulsando la fecha) y eventos ----------
const EV_COLORS=TAG_COLORS;
const hdateBtn=document.getElementById("hdate"), calpop=document.getElementById("calpop");
let calMonth=null, calEditing=null, evDraft="", evTitleTimer=null;
let evColor=(()=>{ try{ const c=localStorage.getItem("ascenso-evcolor"); return EV_COLORS.includes(c)?c:EV_COLORS[4]; }catch(e){ return EV_COLORS[4]; } })();
const parseKey=k=>{ const [y,m,d]=k.split("-").map(Number); return new Date(y,m-1,d); };
const cap=t=>t.charAt(0).toUpperCase()+t.slice(1);
const fmtShort=k=>parseKey(k).toLocaleDateString("es-ES",{day:"numeric",month:"short"});
const evRange=e=>e.start===e.end?"":fmtShort(e.start)+" – "+fmtShort(e.end);
// Orden dentro de un día: primero los de varios días, luego los de todo el día y después por hora
function evSort(a,b){
  const am=a.start!==a.end, bm=b.start!==b.end;
  if(am!==bm) return am?-1:1;
  if(!a.time!==!b.time) return a.time?1:-1;
  return (a.time||"").localeCompare(b.time||"") || a.created.localeCompare(b.created);
}
function eventsOn(k){
  return Object.entries(state.events).filter(([,e])=>e.start<=k&&e.end>=k).sort((x,y)=>evSort(x[1],y[1]));
}
// Reparte los eventos de una semana en carriles, para dibujar como barras los que duran varios días
function weekSegments(keys){
  const k0=keys[0], k6=keys[6], segs=[];
  for(const [id,e] of Object.entries(state.events)){
    if(e.end<k0||e.start>k6) continue;
    segs.push({id,e, c0:e.start<k0?0:keys.indexOf(e.start), c1:e.end>k6?6:keys.indexOf(e.end),
               first:e.start>=k0, contL:e.start<k0, contR:e.end>k6});
  }
  segs.sort((a,b)=>a.c0-b.c0 || (b.c1-b.c0)-(a.c1-a.c0) || evSort(a.e,b.e));
  const occ=[];
  for(const s of segs){
    let l=0; while(occ[l] && occ[l].slice(s.c0,s.c1+1).some(Boolean)) l++;
    occ[l]=occ[l]||Array(7).fill(false); for(let c=s.c0;c<=s.c1;c++) occ[l][c]=true; s.lane=l;
  }
  return segs;
}
// En el ordenador, las casillas crecen hasta donde permita la altura de la ventana (sin barras de desplazamiento)
const CAL_MIN=66, CAL_MAX=108;
let calCellH=92;
// Medidas de las barras (deben coincidir con --top0 y --bh del CSS)
const calBars=()=>calpop.classList.contains("wide") ? {top0:28, bh:17} : {top0:26, bh:15};
const calLanes=()=>{
  if(window.innerWidth<=560) return 3;
  const {top0,bh}=calBars();
  return Math.max(1, Math.min(3, Math.floor((calCellH-top0-4)/(bh+2))));
};
// En pantallas anchas, el calendario se abre más grande, con la agenda del día a la derecha
const CAL_WIDE=980, CAL_WIDE_W=960;
function placeCal(){
  const wide=window.innerWidth>=CAL_WIDE;
  calpop.classList.toggle("wide",wide);
  if(wide){
    const w=Math.min(CAL_WIDE_W, window.innerWidth-40);
    calpop.style.width=w+"px";
    calpop.style.left=Math.max(20,(window.innerWidth-w)/2)+"px";
    calpop.style.top=Math.round(hdateBtn.getBoundingClientRect().bottom+8)+"px";
  } else calpop.style.removeProperty("width"), calpop.style.removeProperty("left"), calpop.style.removeProperty("top");
}
function fitCal(){
  const grid=document.getElementById("cal-grid");
  if(calpop.hidden || window.innerWidth<=560){ grid.style.removeProperty("--cellh"); return; }
  const weeks=grid.children.length||6, before=calLanes();
  const wide=calpop.classList.contains("wide"), cs=getComputedStyle(calpop);
  const fixed=(wide ? document.querySelector(".cal-main").offsetHeight+parseFloat(cs.paddingTop)+parseFloat(cs.paddingBottom)+2
                    : calpop.offsetHeight) - grid.offsetHeight;
  const avail=window.innerHeight-calpop.getBoundingClientRect().top-16-fixed;
  calCellH=Math.max(CAL_MIN, Math.min(CAL_MAX, Math.floor(avail/weeks)));
  grid.style.setProperty("--cellh",calCellH+"px");
  if(calLanes()!==before) renderCalGrid();
}
window.addEventListener("resize",()=>{ if(!calpop.hidden){ placeCal(); renderCalGrid(); fitCal(); } });
function renderCalGrid(){
  const y=calMonth.getFullYear(), mo=calMonth.getMonth();
  document.getElementById("cal-title").textContent=cap(calMonth.toLocaleDateString("es-ES",{month:"long",year:"numeric"}));
  const first=monday(new Date(y,mo,1)), last=new Date(y,mo+1,0);
  const weeks=Math.ceil((Math.round((last-first)/86400000)+1)/7);
  const tk=key(today()), sk=key(sel), CAL_LANES=calLanes();
  document.getElementById("cal-grid").style.setProperty("--lanes",CAL_LANES);
  let html="";
  for(let w=0;w<weeks;w++){
    const keys=[...Array(7)].map((_,i)=>key(addDays(first,w*7+i)));
    const segs=weekSegments(keys), over=Array(7).fill(0);
    let bars="";
    for(const s of segs){
      if(s.lane>=CAL_LANES){ for(let c=s.c0;c<=s.c1;c++) over[c]++; continue; }
      bars+=`<span class="cbar${s.contL?" cont-l":""}${s.contR?" cont-r":""}" style="--c:${s.e.color};--tc:${textOn(s.e.color)};--c0:${s.c0};--span:${s.c1-s.c0+1};--lane:${s.lane}">`+
            `${s.e.time&&s.first?`<b>${s.e.time}</b> `:""}${esc(s.e.title)}</span>`;
    }
    const cells=keys.map((k,i)=>{
      const d=parseKey(k), n=eventsOn(k).length;
      const cls="cday"+(d.getMonth()!==mo?" out":"")+(k===tk?" today":"")+(k===sk?" sel":"");
      return `<button type="button" class="${cls}" data-day="${k}" aria-label="${cap(d.toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"}))}${n?`, ${n} ${n===1?"evento":"eventos"}`:""}">`+
             `<span class="cnum">${d.getDate()}</span>${over[i]?`<span class="cmore">+${over[i]}</span>`:""}</button>`;
    }).join("");
    html+=`<div class="cweek">${cells}<div class="cbars" aria-hidden="true">${bars}</div></div>`;
  }
  document.getElementById("cal-grid").innerHTML=html;
}
const swatches=(cur)=>EV_COLORS.map((c,i)=>`<button type="button" class="sw" data-color="${c}" aria-pressed="${c===cur}" style="--c:${c}" aria-label="Color ${i+1}"></button>`).join("");
function renderCalList(){
  const k=key(sel), evs=eventsOn(k);
  document.getElementById("cal-day").textContent=cap(sel.toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"}));
  document.getElementById("cal-list").innerHTML = evs.map(([id,e])=> id===calEditing
    ? `<li class="evedit" data-ev="${id}" style="--c:${e.color}">
        <input type="text" class="ev-title" value="${esc(e.title)}" maxlength="120" aria-label="Título del evento">
        <div class="ev-row swatches">${swatches(e.color)}</div>
        <div class="ev-row">
          <label>Hora <input type="time" class="ev-time" value="${e.time||""}"></label>
          <label>Desde <input type="date" class="ev-start" value="${e.start}"></label>
          <label>Hasta <input type="date" class="ev-end" value="${e.end}" min="${e.start}"></label>
          <button type="button" class="ev-del">Borrar</button>
        </div>
      </li>`
    : `<li><button type="button" class="ev" data-ev="${id}" style="--c:${e.color}"><span class="evdot"></span>`+
      `${e.time?`<span class="evtime">${e.time}</span>`:""}<span class="evtitle">${esc(e.title)}</span>`+
      `${evRange(e)?`<span class="evrange">${evRange(e)}</span>`:""}</button></li>`).join("")
    || `<li class="cl-empty">Sin eventos.</li>`;
  document.getElementById("evnew-sw").innerHTML=swatches(evColor);
  const nw=document.getElementById("evnew"); if(nw.value!==evDraft) nw.value=evDraft;
}
function renderCal(){ if(calpop.hidden) return; renderCalGrid(); renderCalList(); fitCal(); }
function openCal(){
  calMonth=new Date(sel.getFullYear(),sel.getMonth(),1); calEditing=null;
  calpop.hidden=false; hdateBtn.setAttribute("aria-expanded","true"); placeCal(); renderCal();
}
function closeCal(){
  if(calpop.hidden) return;
  flushEvTitle(); calpop.hidden=true; calEditing=null; hdateBtn.setAttribute("aria-expanded","false");
}
// Seleccionar un día desde el calendario mueve toda la página a ese día
function calSelect(d){
  sel=d; calEditing=null;
  if(d.getMonth()!==calMonth.getMonth()||d.getFullYear()!==calMonth.getFullYear()) calMonth=new Date(d.getFullYear(),d.getMonth(),1);
  render();
}
function evChanged(){ save(); render(); }
function flushEvTitle(){ if(evTitleTimer){ clearTimeout(evTitleTimer); evTitleTimer=null; save(); renderWeek(); renderDay(); renderCalGrid(); } }
function addEvent(){
  const title=evDraft.trim(); if(!title) return;
  const k=key(sel);
  state.events[newId("v")]={start:k,end:k,time:"",title:title.slice(0,120),color:evColor,created:new Date().toISOString()};
  evDraft=""; evChanged();
  document.getElementById("evnew").focus();
}
hdateBtn.addEventListener("click",()=>{ calpop.hidden ? openCal() : closeCal(); });
calpop.addEventListener("click",e=>{
  const t=e.target;
  if(t.closest("[data-nav]")){ flushEvTitle(); calMonth=new Date(calMonth.getFullYear(),calMonth.getMonth()+(+t.closest("[data-nav]").dataset.nav),1); calEditing=null; renderCal(); return; }
  if(t.closest("[data-hoy]")){ flushEvTitle(); calSelect(today()); return; }
  const day=t.closest(".cday"); if(day){ flushEvTitle(); calSelect(parseKey(day.dataset.day)); return; }
  const ev=t.closest(".ev"); if(ev){ flushEvTitle(); calEditing=ev.dataset.ev; renderCalList(); fitCal(); const f=calpop.querySelector(".ev-title"); if(f){ f.focus(); f.select(); } return; }
  const sw=t.closest(".sw");
  if(sw){
    const ed=sw.closest(".evedit");
    if(ed){ const e=state.events[ed.dataset.ev]; if(e){ e.color=sw.dataset.color; evColor=e.color; } }
    else evColor=sw.dataset.color;
    try{ localStorage.setItem("ascenso-evcolor",evColor); }catch(err){}
    if(ed){ flushEvTitle(); evChanged(); } else { renderCalList(); fitCal(); }
    return;
  }
  const del=t.closest(".ev-del");
  if(del){ const id=del.closest(".evedit").dataset.ev; armDelete(del,()=>{ delete state.events[id]; calEditing=null; evChanged(); },"Pulsa otra vez"); }
});
calpop.addEventListener("input",e=>{
  if(e.target.id==="evnew"){ evDraft=e.target.value; return; }
  if(e.target.matches(".ev-title")){
    const ev=state.events[e.target.closest(".evedit").dataset.ev], v=e.target.value.trim();
    if(ev && v){ ev.title=v.slice(0,120); clearTimeout(evTitleTimer); evTitleTimer=setTimeout(flushEvTitle,500); }
  }
});
calpop.addEventListener("change",e=>{
  const ed=e.target.closest(".evedit"); if(!ed) return;
  const ev=state.events[ed.dataset.ev]; if(!ev) return;
  const v=e.target.value;
  if(e.target.matches(".ev-time")){ ev.time=/^([01]\d|2[0-3]):[0-5]\d$/.test(v)?v:""; }
  else if(e.target.matches(".ev-start") && /^\d{4}-\d{2}-\d{2}$/.test(v)){
    const dur=Math.round((parseKey(ev.end)-parseKey(ev.start))/86400000);   // se conserva la duración
    ev.start=v; ev.end=key(addDays(parseKey(v),dur));
  }
  else if(e.target.matches(".ev-end") && /^\d{4}-\d{2}-\d{2}$/.test(v)){ ev.end=v<ev.start?ev.start:v; }
  else return;
  // Si el evento deja de cubrir el día seleccionado, la página salta a su primer día (y se sigue editando)
  const k=key(sel);
  if(!(ev.start<=k&&ev.end>=k)){ sel=parseKey(ev.start); calMonth=new Date(sel.getFullYear(),sel.getMonth(),1); }
  flushEvTitle(); evChanged();
});
calpop.addEventListener("focusout",e=>{
  if(e.target.matches(".ev-title")){ const ev=state.events[e.target.closest(".evedit")?.dataset.ev]; if(ev) e.target.value=ev.title; flushEvTitle(); }
});
calpop.addEventListener("keydown",e=>{
  if(e.target.id==="evnew" && e.key==="Enter"){ e.preventDefault(); addEvent(); }
  else if(e.target.matches(".ev-title") && e.key==="Enter"){ e.preventDefault(); flushEvTitle(); calEditing=null; renderCalList(); fitCal(); }
});
document.addEventListener("pointerdown",e=>{ if(!calpop.hidden && !calpop.contains(e.target) && !hdateBtn.contains(e.target)) closeCal(); });
document.addEventListener("keydown",e=>{ if(e.key==="Escape" && !calpop.hidden){ closeCal(); hdateBtn.focus(); } });
// ======================================================================
// ---------- Tableros (al estilo de Trello): vista propia, oculta tras el título ----------
// ======================================================================
const ICON_CAL='<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="3.5" width="11" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>';
const ICON_CHECK='<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="2.5" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5 8.2l2 2 4-4.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const boardsView=document.getElementById("boardsview"), dayMain=document.querySelector("main");
const bvBody=document.getElementById("bv-body"), bvQ=document.getElementById("bv-q"), bvResults=document.getElementById("bv-results");
let curBoard=(()=>{ try{ return localStorage.getItem("ascenso-tablero")||"home"; }catch(e){ return "home"; } })();
let openMenuKey=null, pickerOpen=false, editingBoardName=false, editingList=null, addingList=false;
let nbOpen=false, nbDraft={name:"", tpl:"basic", color:B_COLORS[0]};

const boardLists=bid=>Object.entries(state.blists).filter(([,l])=>l.board===bid).sort((a,b)=>a[1].order-b[1].order);
const listCards=lid=>Object.entries(state.cards).filter(([,c])=>c.list===lid).sort((a,b)=>a[1].order-b[1].order);
const boardLabels=bid=>Object.entries(state.blabels).filter(([,l])=>l.board===bid).sort((a,b)=>a[1].name.localeCompare(b[1].name,"es"));
const boardsSorted=()=>Object.entries(state.boards).sort((a,b)=>(b[1].fav-a[1].fav)||(a[1].order-b[1].order));
const renumber=(entries,coll)=>entries.forEach(([id],i)=>{ coll[id].order=i; });
const nextColor=used=>B_COLORS.find(c=>!used.includes(c))||B_COLORS[used.length%B_COLORS.length];

// ---- mostrar / ocultar ----
function showBoards(){
  closeCal(); closePad();
  dayMain.hidden=true; boardsView.hidden=false;
  if(curBoard!=="home" && !state.boards[curBoard]) curBoard="home";
  renderBoards(); window.scrollTo(0,0);
}
function showDay(){
  openMenuKey=null; pickerOpen=false; bvQ.value=""; bvResults.hidden=true;
  boardsView.hidden=true; dayMain.hidden=false; window.scrollTo(0,0); render();
}
function setBoard(id){
  curBoard=id; try{ localStorage.setItem("ascenso-tablero",id); }catch(e){}
  openMenuKey=null; pickerOpen=false; editingBoardName=false; editingList=null; addingList=false;
  renderBoards(); window.scrollTo(0,0);
}
function boardsChanged(){ save(); renderBoards(); }

// ---- pintar ----
function renderBoards(){
  if(boardsView.hidden) return;
  const b=state.boards[curBoard];
  if(!b && curBoard!=="home") curBoard="home";
  document.getElementById("bv-current").textContent=b?b.name:"Todos los tableros";
  boardsView.style.setProperty("--bc", b?b.color:"var(--gold)");
  renderPicker();
  const lists=document.getElementById("bd-lists"), sx=lists?lists.scrollLeft:0;
  bvBody.innerHTML=b?boardHTML(curBoard,b):homeHTML();
  const nl=document.getElementById("bd-lists"); if(nl) nl.scrollLeft=sx;
  placeMenus();
  if(cardOpen) renderCardDlg();
}
// Los menús ⋯ se colocan respecto a su botón, pero siempre dentro de la ventana
// (y fuera del área con desplazamiento de las listas, para que nada los recorte)
function placeMenus(){
  const M=8;
  for(const menu of bvBody.querySelectorAll(".bmenu")){
    const btn=menu.parentElement.querySelector(":scope > button"); if(!btn) continue;
    const b=btn.getBoundingClientRect();
    menu.style.position="fixed"; menu.style.right="auto"; menu.style.maxHeight=(window.innerHeight-2*M)+"px"; menu.style.overflowY="auto";
    const w=menu.offsetWidth, h=menu.offsetHeight;
    // Preferencia: alineado a la derecha del botón; si no cabe, se desplaza lo justo
    let left=Math.min(Math.max(M, b.right-w), window.innerWidth-w-M);
    let top=b.bottom+6;
    if(top+h>window.innerHeight-M) top = b.top-6-h>=M ? b.top-6-h : Math.max(M, window.innerHeight-h-M);
    menu.style.left=Math.round(left)+"px"; menu.style.top=Math.round(top)+"px";
  }
}
window.addEventListener("resize",()=>{ if(!boardsView.hidden) placeMenus(); });
document.addEventListener("scroll",()=>{ if(!boardsView.hidden && openMenuKey) placeMenus(); },true);
function renderPicker(){
  const m=document.getElementById("bv-menu");
  document.getElementById("bv-current").setAttribute("aria-expanded",String(pickerOpen));
  m.hidden=!pickerOpen; if(!pickerOpen) return;
  m.innerHTML=boardsSorted().map(([id,b])=>
    `<button type="button" class="pk-item${id===curBoard?" on":""}" data-goboard="${id}" style="--c:${b.color}"><span class="pk-dot"></span>${esc(b.name)}${b.fav?'<span class="pk-star">★</span>':""}</button>`).join("")+
    `<hr><button type="button" class="pk-item" data-gohome>Todos los tableros</button><button type="button" class="pk-item" data-gonew>+ Nuevo tablero</button>`;
}
function homeHTML(){
  const items=boardsSorted().map(([id,b])=>{
    const ls=boardLists(id), n=ls.reduce((s,[lid])=>s+listCards(lid).length,0);
    return `<article class="bcard" data-board="${id}" style="--bc:${b.color}" tabindex="0">
      <span class="bcard-band"></span>
      <h3>${esc(b.name)}</h3>
      <p>${ls.length} ${ls.length===1?"lista":"listas"} · ${n} ${n===1?"tarjeta":"tarjetas"}</p>
      <button type="button" class="bfav" data-fav="${id}" aria-pressed="${b.fav}" aria-label="${b.fav?"Quitar de favoritos":"Marcar como favorito"}">★</button>
    </article>`;
  }).join("");
  const nb = nbOpen
    ? `<div class="bcard bnew-form" style="--bc:${nbDraft.color}">
        <input type="text" id="nb-name" maxlength="60" placeholder="Nombre del tablero" value="${esc(nbDraft.name)}" aria-label="Nombre del tablero">
        <div class="nb-tpl" role="group" aria-label="Plantilla">
          <button type="button" data-tpl="basic" aria-pressed="${nbDraft.tpl==="basic"}">Por hacer · En proceso · Hecho</button>
          <button type="button" data-tpl="empty" aria-pressed="${nbDraft.tpl==="empty"}">Vacío</button>
        </div>
        <div class="swatches">${B_COLORS.map(c=>`<button type="button" class="sw" data-nbcolor="${c}" aria-pressed="${c===nbDraft.color}" style="--c:${c}" aria-label="Color"></button>`).join("")}</div>
        <div class="eacts"><button type="button" class="add" data-nbcreate>Crear tablero</button><button type="button" class="add alt" data-nbcancel>Cancelar</button></div>
      </div>`
    : `<button type="button" class="bcard bnew" data-newboard>+ Nuevo tablero</button>`;
  return `<div class="bh"><h2>Tableros</h2>
    ${Object.keys(state.boards).length?"":`<p class="bh-empty">Todavía no tienes tableros. Crea el primero.</p>`}
    <div class="bh-grid" id="bh-grid">${items}${nb}</div>
    <p class="hint">Arrastra los tableros para ordenarlos. Los favoritos (★) aparecen primero.</p></div>`;
}
function boardHTML(bid,b){
  const lists=boardLists(bid);
  return `<div class="bd">
    <div class="bd-head">
      ${editingBoardName
        ? `<input type="text" class="bd-name-in" id="bd-name-in" maxlength="60" value="${esc(b.name)}" aria-label="Nombre del tablero">`
        : `<h2 class="bd-name" data-rename-board tabindex="0" title="Cambiar el nombre">${esc(b.name)}</h2>`}
      <button type="button" class="bfav" data-fav="${bid}" aria-pressed="${b.fav}" aria-label="${b.fav?"Quitar de favoritos":"Marcar como favorito"}">★</button>
      <span class="bd-sp"></span>
      <div class="menu-wrap">
        <button type="button" class="bd-more" data-menu="board" aria-label="Opciones del tablero" aria-expanded="${openMenuKey==="board"||openMenuKey==="labels"}">⋯</button>
        ${openMenuKey==="board"?boardMenuHTML(bid,b):openMenuKey==="labels"?labelsMenuHTML(bid):""}
      </div>
    </div>
    <div class="bd-lists" id="bd-lists">${lists.map(([lid,l])=>listHTML(lid,l)).join("")}
      <div class="bl-add">${addingList
        ? `<input type="text" id="bl-new" maxlength="60" placeholder="Título de la lista" aria-label="Título de la nueva lista">`
        : `<button type="button" class="bl-addbtn" data-addlist>+ Añadir lista</button>`}</div>
    </div>
  </div>`;
}
function boardMenuHTML(bid,b){
  return `<div class="bmenu" role="menu">
    <p class="bm-h">Color del tablero</p>
    <div class="swatches">${B_COLORS.map(c=>`<button type="button" class="sw" data-bcolor="${c}" aria-pressed="${c===b.color}" style="--c:${c}" aria-label="Color"></button>`).join("")}</div>
    <button type="button" class="bm-item" data-menu="labels">Etiquetas del tablero…</button>
    <button type="button" class="bm-item danger" data-delboard>Eliminar tablero</button>
  </div>`;
}
function labelsMenuHTML(bid){
  const labs=boardLabels(bid), used=labs.map(([,l])=>l.color);
  const uses=id=>Object.values(state.cards).filter(c=>c.labels.includes(id)).length;
  return `<div class="bmenu bm-labels" role="menu">
    <p class="bm-h">Etiquetas de este tablero</p>
    ${labs.map(([id,l])=>`<div class="tagrow" data-blabel="${id}">
        <input type="color" class="blab-color" value="${l.color.toLowerCase()}" aria-label="Color de ${esc(l.name)}">
        <input type="text" class="blab-name" value="${esc(l.name)}" maxlength="30" aria-label="Nombre de la etiqueta">
        <span class="tg-uses">${uses(id)}</span>
        <button type="button" class="tg-del" data-delblabel="${id}">Quitar</button>
      </div>`).join("") || `<p class="bm-note">Aún no hay etiquetas.</p>`}
    <div class="tagnew">
      <input type="color" id="blab-color" value="${nextColor(used).toLowerCase()}" aria-label="Color de la nueva etiqueta">
      <input type="text" id="blab-name" maxlength="30" placeholder="Nueva etiqueta" aria-label="Nombre de la nueva etiqueta">
      <button type="button" class="add" data-addblabel>Crear</button>
    </div>
  </div>`;
}
function listHTML(lid,l){
  const cards=listCards(lid);
  if(l.collapsed) return `<section class="bl collapsed" data-list="${lid}">
      <button type="button" class="bl-expand" data-expand="${lid}" title="Desplegar la lista"><span class="bl-vt">${esc(l.title)}</span><span class="bl-count">${cards.length}</span></button>
    </section>`;
  return `<section class="bl" data-list="${lid}">
    <div class="bl-head">
      ${editingList===lid
        ? `<input type="text" class="bl-title-in" id="bl-title-in" maxlength="60" value="${esc(l.title)}" aria-label="Título de la lista">`
        : `<h3 class="bl-title" data-rename-list="${lid}" title="Cambiar el título">${esc(l.title)}</h3>`}
      <span class="bl-count">${cards.length}</span>
      <div class="menu-wrap">
        <button type="button" class="bl-more" data-menu="list:${lid}" aria-label="Opciones de la lista" aria-expanded="${openMenuKey==="list:"+lid}">⋯</button>
        ${openMenuKey==="list:"+lid?listMenuHTML(lid,l,cards.length):""}
      </div>
    </div>
    <ul class="bl-cards">${cards.map(([cid,c])=>cardHTML(cid,c)).join("")}</ul>
    <div class="bl-new"><input type="text" class="bl-newcard" data-newcard="${lid}" maxlength="200" placeholder="+ Añadir tarjeta" aria-label="Nueva tarjeta en ${esc(l.title)}"></div>
  </section>`;
}
function listMenuHTML(lid,l,n){
  const others=boardsSorted().filter(([id])=>id!==l.board);
  const siblings=boardLists(l.board).filter(([id])=>id!==lid);
  return `<div class="bmenu" role="menu">
    <button type="button" class="bm-item" data-collapse="${lid}">Plegar lista</button>
    <p class="bm-h">Mover a otro tablero</p>
    ${others.length
      ? `<div class="bm-row"><select id="lm-board" aria-label="Tablero de destino">${others.map(([id,b])=>`<option value="${id}">${esc(b.name)}</option>`).join("")}</select>
         <button type="button" class="add" data-movelist="${lid}">Mover</button></div>`
      : `<p class="bm-note">No hay otros tableros.</p>`}
    <p class="bm-h">Eliminar lista</p>
    ${n ? `<select id="lm-dest" class="bm-select" aria-label="Qué hacer con sus tarjetas">
             ${siblings.map(([id,s])=>`<option value="${id}">Pasar sus ${n} tarjetas a «${esc(s.title)}»</option>`).join("")}
             <option value="">Borrar también sus ${n} tarjetas</option></select>` : ""}
    <button type="button" class="bm-item danger" data-dellist="${lid}">Eliminar lista</button>
  </div>`;
}
function dueInfo(due){
  if(!due) return null;
  const t=key(today()), tm=key(addDays(today(),1));
  return { cls: due<t?"late":(due===t||due===tm)?"soon":"ok",
           label: due===t?"Hoy":due===tm?"Mañana":fmtShort(due),
           long: due<t?"Vencida":due===t?"Vence hoy":due===tm?"Vence mañana":"" };
}
function cardHTML(cid,c){
  const labs=c.labels.map(id=>state.blabels[id]).filter(Boolean);
  const d=dueInfo(c.due), done=c.check.filter(k=>k.d).length, tot=c.check.length;
  return `<li class="bc p-${c.prio}" data-card="${cid}" tabindex="0" aria-label="${esc(c.title)}. Abrir tarjeta">
    ${labs.length?`<span class="bc-labels">${labs.map(l=>`<span class="tag" style="--c:${l.color};--tc:${textOn(l.color)}">${esc(l.name)}</span>`).join("")}</span>`:""}
    <span class="bc-title">${esc(c.title)}</span>
    ${d||tot||c.desc?`<span class="bc-badges">${d?`<span class="due ${d.cls}" title="Fecha límite">${ICON_CAL}${d.label}</span>`:""}${tot?`<span class="ckb${done===tot?" full":""}" title="Checklist">${ICON_CHECK}${done}/${tot}</span>`:""}${c.desc?`<span class="tnote-ico" title="Tiene descripción">≡</span>`:""}</span>`:""}
  </li>`;
}

// ---- acciones ----
// Al abrir el formulario, se propone un color que aún no use ningún tablero
function openNewBoard(){
  if(!nbOpen && !nbDraft.name) nbDraft.color=nextColor(Object.values(state.boards).map(b=>b.color));
  nbOpen=true;
}
function createBoard(){
  const name=nbDraft.name.trim(); if(!name){ const f=document.getElementById("nb-name"); if(f) f.focus(); return; }
  const id=newId("b");
  state.boards[id]={name:name.slice(0,60), color:nbDraft.color, fav:false,
    order:Math.max(-1,...Object.values(state.boards).map(b=>b.order))+1, created:new Date().toISOString()};
  if(nbDraft.tpl==="basic") ["Por hacer","En proceso","Hecho"].forEach((t,i)=>{ state.blists[newId("l")]={board:id,title:t,order:i,collapsed:false}; });
  nbOpen=false; nbDraft={name:"", tpl:"basic", color:nextColor(Object.values(state.boards).map(b=>b.color))};
  save(); setBoard(id);
}
function deleteBoard(bid){
  const lids=Object.keys(state.blists).filter(l=>state.blists[l].board===bid);
  for(const [cid,c] of Object.entries(state.cards)) if(lids.includes(c.list)) delete state.cards[cid];
  lids.forEach(l=>delete state.blists[l]);
  for(const [id,l] of Object.entries(state.blabels)) if(l.board===bid) delete state.blabels[id];
  delete state.boards[bid];
  save(); setBoard("home");
}
// Etiqueta equivalente (por nombre) en otro tablero; si no existe, se crea con el mismo color
function labelInBoard(bid,name,color){
  const low=name.toLowerCase();
  let id=Object.keys(state.blabels).find(x=>state.blabels[x].board===bid && state.blabels[x].name.toLowerCase()===low);
  if(!id){ id=newId("k"); state.blabels[id]={board:bid, name, color}; }
  return id;
}
function moveListToBoard(lid,bid){
  const l=state.blists[lid];
  l.board=bid; l.order=boardLists(bid).filter(([id])=>id!==lid).length;
  for(const [,c] of listCards(lid)) c.labels=c.labels.map(x=>{ const L=state.blabels[x]; return L?labelInBoard(bid,L.name,L.color):null; }).filter(Boolean);
}
function deleteList(lid,dest){
  const bid=state.blists[lid].board, cards=listCards(lid);
  if(dest && state.blists[dest]){
    let n=listCards(dest).length;
    for(const [cid] of cards){ state.cards[cid].list=dest; state.cards[cid].order=n++; }
  } else for(const [cid] of cards) delete state.cards[cid];
  delete state.blists[lid];
  renumber(boardLists(bid),state.blists);
}
function addCard(lid,title){
  state.cards[newId("c")]={list:lid, title:title.slice(0,200), desc:"", prio:"ninguna", due:"", labels:[], check:[],
    order:listCards(lid).length, created:new Date().toISOString()};
}
function commitBoardName(input){
  if(!editingBoardName) return; editingBoardName=false;
  const v=input.value.trim(); if(v && state.boards[curBoard]) state.boards[curBoard].name=v.slice(0,60);
  boardsChanged();
}
function commitListTitle(input){
  const lid=editingList; if(!lid) return; editingList=null;
  const v=input.value.trim(); if(v && state.blists[lid]) state.blists[lid].title=v.slice(0,60);
  boardsChanged();
}

// ---- eventos de la vista de tableros ----
document.getElementById("brand").addEventListener("click",showBoards);
document.getElementById("bv-back").addEventListener("click",showDay);
document.getElementById("bv-current").addEventListener("click",()=>{ pickerOpen=!pickerOpen; renderPicker(); });
document.getElementById("bv-menu").addEventListener("click",e=>{
  const b=e.target.closest("[data-goboard]"); if(b){ setBoard(b.dataset.goboard); return; }
  if(e.target.closest("[data-gohome]")){ setBoard("home"); return; }
  if(e.target.closest("[data-gonew]")){ openNewBoard(); setBoard("home"); const f=document.getElementById("nb-name"); if(f) f.focus(); }
});
bvBody.addEventListener("click",e=>{
  if(bJustDragged) return;
  const t=e.target, q=s=>t.closest(s);
  let el;
  if((el=q("[data-fav]"))){ const b=state.boards[el.dataset.fav]; b.fav=!b.fav; boardsChanged(); return; }
  if(q("[data-newboard]")){ openNewBoard(); renderBoards(); document.getElementById("nb-name").focus(); return; }
  if((el=q("[data-tpl]"))){ nbDraft.tpl=el.dataset.tpl; renderBoards(); return; }
  if((el=q("[data-nbcolor]"))){ nbDraft.color=el.dataset.nbcolor; renderBoards(); return; }
  if(q("[data-nbcreate]")){ createBoard(); return; }
  if(q("[data-nbcancel]")){ nbOpen=false; renderBoards(); return; }
  if((el=q(".bcard[data-board]"))){ setBoard(el.dataset.board); return; }
  if(q("[data-rename-board]")){ editingBoardName=true; renderBoards(); const f=document.getElementById("bd-name-in"); f.focus(); f.select(); return; }
  if((el=q("[data-menu]"))){ const k=el.dataset.menu; openMenuKey = openMenuKey===k||(k==="board"&&openMenuKey==="labels") ? null : k; renderBoards(); return; }
  if((el=q("[data-bcolor]"))){ state.boards[curBoard].color=el.dataset.bcolor; boardsChanged(); return; }
  if((el=q("[data-delboard]"))){ armDelete(el,()=>deleteBoard(curBoard),"Pulsa otra vez para eliminar el tablero"); return; }
  if(q("[data-addlist]")){ addingList=true; renderBoards(); document.getElementById("bl-new").focus(); return; }
  if((el=q("[data-rename-list]"))){ editingList=el.dataset.renameList; renderBoards(); const f=document.getElementById("bl-title-in"); f.focus(); f.select(); return; }
  if((el=q("[data-collapse]"))){ state.blists[el.dataset.collapse].collapsed=true; openMenuKey=null; boardsChanged(); return; }
  if((el=q("[data-expand]"))){ state.blists[el.dataset.expand].collapsed=false; boardsChanged(); return; }
  if((el=q("[data-movelist]"))){ moveListToBoard(el.dataset.movelist, document.getElementById("lm-board").value); openMenuKey=null; boardsChanged(); return; }
  if((el=q("[data-dellist]"))){ const lid=el.dataset.dellist, sel=document.getElementById("lm-dest");
    armDelete(el,()=>{ deleteList(lid, sel?sel.value:""); openMenuKey=null; boardsChanged(); },"Pulsa otra vez para eliminar"); return; }
  if(q("[data-addblabel]")){ addBoardLabel(); return; }
  if((el=q("[data-delblabel]"))){ const id=el.dataset.delblabel;
    armDelete(el,()=>{ delete state.blabels[id]; for(const c of Object.values(state.cards)) c.labels=c.labels.filter(x=>x!==id); boardsChanged(); },"Pulsa otra vez"); return; }
  if((el=q(".bc"))){ openCard(el.dataset.card); return; }
});
function addBoardLabel(){
  const n=document.getElementById("blab-name"), name=n.value.trim(); if(!name){ n.focus(); return; }
  state.blabels[newId("k")]={board:curBoard, name:name.slice(0,30), color:document.getElementById("blab-color").value.toUpperCase()};
  boardsChanged(); document.getElementById("blab-name").focus();
}
bvBody.addEventListener("keydown",e=>{
  const t=e.target;
  if(t.id==="nb-name"){ if(e.key==="Enter"){ e.preventDefault(); createBoard(); } else if(e.key==="Escape"){ nbOpen=false; renderBoards(); } return; }
  if(t.id==="bd-name-in"){ if(e.key==="Enter"){ e.preventDefault(); commitBoardName(t); } else if(e.key==="Escape"){ editingBoardName=false; renderBoards(); } return; }
  if(t.id==="bl-title-in"){ if(e.key==="Enter"){ e.preventDefault(); commitListTitle(t); } else if(e.key==="Escape"){ editingList=null; renderBoards(); } return; }
  if(t.id==="bl-new"){
    if(e.key==="Enter"){ e.preventDefault(); const v=t.value.trim(); if(!v) return;
      state.blists[newId("l")]={board:curBoard, title:v.slice(0,60), order:boardLists(curBoard).length, collapsed:false};
      boardsChanged(); const f=document.getElementById("bl-new"); f.focus(); const w=document.getElementById("bd-lists"); w.scrollLeft=w.scrollWidth; }
    else if(e.key==="Escape"){ addingList=false; renderBoards(); }
    return;
  }
  if(t.matches(".bl-newcard") && e.key==="Enter"){
    e.preventDefault(); const v=t.value.trim(), lid=t.dataset.newcard; if(!v) return;
    addCard(lid,v); boardsChanged();
    const f=bvBody.querySelector(`.bl-newcard[data-newcard="${lid}"]`); if(f) f.focus();
    return;
  }
  if(t.id==="blab-name" && e.key==="Enter"){ e.preventDefault(); addBoardLabel(); return; }
  if(t.matches("[data-rename-board]") && e.key==="Enter"){ e.preventDefault(); t.click(); return; }
  if((t.matches(".bc")||t.matches(".bcard[data-board]")) && (e.key==="Enter"||e.key===" ")){ e.preventDefault(); t.click(); }
});
bvBody.addEventListener("input",e=>{ if(e.target.id==="nb-name") nbDraft.name=e.target.value; });
bvBody.addEventListener("change",e=>{
  const row=e.target.closest("[data-blabel]"); if(!row) return;
  const L=state.blabels[row.dataset.blabel]; if(!L) return;
  if(e.target.matches(".blab-color")) L.color=e.target.value.toUpperCase();
  else if(e.target.matches(".blab-name")){ const v=e.target.value.trim(); if(v) L.name=v.slice(0,30); }
  boardsChanged();
});
bvBody.addEventListener("focusout",e=>{
  const t=e.target;
  if(t.id==="bd-name-in") commitBoardName(t);
  else if(t.id==="bl-title-in") commitListTitle(t);
  else if(t.id==="bl-new" && !t.value.trim() && !(e.relatedTarget&&e.relatedTarget.closest&&e.relatedTarget.closest(".bl-add"))){ addingList=false; setTimeout(renderBoards,0); }
});
// Cerrar menús y resultados al pulsar fuera
document.addEventListener("pointerdown",e=>{
  if(boardsView.hidden) return;
  if(openMenuKey && !e.target.closest(".menu-wrap")){ openMenuKey=null; renderBoards(); }
  if(pickerOpen && !e.target.closest(".bv-pick")){ pickerOpen=false; renderPicker(); }
  if(!bvResults.hidden && !e.target.closest(".bv-search")) bvResults.hidden=true;
});
document.addEventListener("keydown",e=>{
  if(e.key!=="Escape" || boardsView.hidden || cdlg.open) return;
  if(bdrag){ bEnd(false); return; }
  if(openMenuKey||pickerOpen){ openMenuKey=null; pickerOpen=false; renderBoards(); }
});

// ---- buscador de tarjetas (en todos los tableros) ----
const fold=t=>String(t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
function renderSearch(){
  const q=fold(bvQ.value.trim());
  if(!q){ bvResults.hidden=true; return; }
  const res=Object.entries(state.cards)
    .filter(([,c])=>fold(c.title).includes(q)||fold(c.desc).includes(q)||c.check.some(k=>fold(k.t).includes(q)))
    .sort((a,b)=>(fold(b[1].title).includes(q))-(fold(a[1].title).includes(q))).slice(0,30);
  bvResults.innerHTML = res.length ? res.map(([id,c])=>{ const l=state.blists[c.list], b=state.boards[l.board];
      return `<button type="button" class="sr" data-sr="${id}" style="--c:${b.color}"><span class="sr-t">${esc(c.title)}</span><span class="sr-w">${esc(b.name)} · ${esc(l.title)}</span></button>`; }).join("")
    : `<p class="sr-empty">No hay tarjetas con «${esc(bvQ.value.trim())}».</p>`;
  bvResults.hidden=false;
}
bvQ.addEventListener("input",renderSearch);
bvQ.addEventListener("focus",renderSearch);
bvQ.addEventListener("keydown",e=>{
  if(e.key==="Escape"){ bvQ.value=""; bvResults.hidden=true; }
  else if(e.key==="Enter"){ const f=bvResults.querySelector("[data-sr]"); if(f) f.click(); }
});
bvResults.addEventListener("click",e=>{
  const r=e.target.closest("[data-sr]"); if(!r) return;
  const c=state.cards[r.dataset.sr]; if(!c) return;
  bvQ.value=""; bvResults.hidden=true;
  setBoard(state.blists[c.list].board); openCard(r.dataset.sr);
});

// ---- arrastrar tarjetas, listas y tableros ----
let bdrag=null, bJustDragged=false;
bvBody.addEventListener("pointerdown",e=>{
  if(e.pointerType==="mouse" && e.button!==0) return;
  const t=e.target; if(t.closest("input,textarea,select,.menu-wrap,.bfav")) return;
  let el=null, kind=null;
  if((el=t.closest(".bc"))) kind="card";
  else if((el=t.closest(".bl.collapsed"))) kind="list";
  else if(t.closest(".bl-head") && !t.closest("button")){ el=t.closest(".bl"); kind="list"; }
  else if((el=t.closest(".bcard[data-board]"))) kind="board";
  if(!kind) return;
  const r=el.getBoundingClientRect();
  bdrag={kind, el, id:el.dataset.card||el.dataset.list||el.dataset.board, x0:e.clientX, y0:e.clientY,
         offX:e.clientX-r.left, offY:e.clientY-r.top, w:r.width, h:r.height, active:false, pid:e.pointerId, mouse:e.pointerType==="mouse"};
  if(bdrag.mouse) e.preventDefault();
  else bdrag.timer=setTimeout(()=>{ if(bdrag && !bdrag.active) bStart(bdrag.x0,bdrag.y0); },300);
});
window.addEventListener("pointermove",e=>{
  if(!bdrag || e.pointerId!==bdrag.pid) return;
  if(!bdrag.active){
    const moved=Math.hypot(e.clientX-bdrag.x0,e.clientY-bdrag.y0);
    if(bdrag.mouse){ if(moved<5) return; bStart(e.clientX,e.clientY); }
    else { if(moved>8){ clearTimeout(bdrag.timer); bdrag=null; } return; }
  }
  bMove(e.clientX,e.clientY);
});
window.addEventListener("pointerup",e=>{ if(bdrag && e.pointerId===bdrag.pid) bEnd(true); });
window.addEventListener("pointercancel",e=>{ if(bdrag && e.pointerId===bdrag.pid) bEnd(false); });
document.addEventListener("touchmove",e=>{ if(bdrag && bdrag.active) e.preventDefault(); },{passive:false});
function bStart(x,y){
  const d=bdrag; d.active=true;
  const g=d.el.cloneNode(true); g.classList.add("bghost"); g.style.width=d.w+"px"; g.style.height=d.h+"px"; g.setAttribute("aria-hidden","true");
  document.body.appendChild(g); d.ghost=g;
  d.ph=document.createElement(d.kind==="card"?"li":"div"); d.ph.className="bph bph-"+d.kind;
  d.ph.style.height=d.h+"px"; if(d.kind!=="card") d.ph.style.width=d.w+"px";
  d.el.after(d.ph); d.el.style.display="none";
  document.body.classList.add("is-dragging");
  if(!d.mouse && navigator.vibrate) navigator.vibrate(12);
  bMove(x,y);
}
function bMove(x,y){
  const d=bdrag;
  d.ghost.style.transform=`translate(${x-d.offX}px,${y-d.offY}px) rotate(${d.kind==="card"?2:1}deg)`;
  document.querySelectorAll(".drop-over").forEach(n=>n.classList.remove("drop-over")); d.toCollapsed=null;
  if(d.kind==="card"){
    const hit=document.elementFromPoint(x,y), list=hit&&hit.closest(".bl");
    if(list && list.classList.contains("collapsed")){ list.classList.add("drop-over"); d.toCollapsed=list.dataset.list; }
    else if(list){
      const ul=list.querySelector(".bl-cards");
      const before=[...ul.children].find(n=>n!==d.ph && n!==d.el && n.classList.contains("bc") && y<n.getBoundingClientRect().top+n.getBoundingClientRect().height/2);
      if(before) ul.insertBefore(d.ph,before); else ul.appendChild(d.ph);
    }
  } else if(d.kind==="list"){
    const wrap=document.getElementById("bd-lists");
    const before=[...wrap.children].find(n=>n!==d.ph && n!==d.el && n.classList.contains("bl") && x<n.getBoundingClientRect().left+n.getBoundingClientRect().width/2);
    wrap.insertBefore(d.ph, before||wrap.querySelector(".bl-add"));
  } else {
    const grid=document.getElementById("bh-grid");
    let best=null, bd=Infinity;
    for(const n of grid.querySelectorAll(".bcard[data-board]")){
      if(n===d.el) continue;
      const r=n.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2, dist=Math.hypot(x-cx,y-cy);
      if(dist<bd){ bd=dist; best={n, after:x>cx}; }
    }
    if(best){ if(best.after) best.n.after(d.ph); else best.n.before(d.ph); }
  }
  const wrap=document.getElementById("bd-lists");
  if(wrap){ const r=wrap.getBoundingClientRect(); if(x<r.left+50) wrap.scrollLeft-=16; else if(x>r.right-50) wrap.scrollLeft+=16; }
  if(y<60) window.scrollBy(0,-14); else if(y>window.innerHeight-60) window.scrollBy(0,14);
}
function bEnd(drop){
  const d=bdrag; bdrag=null; clearTimeout(d.timer);
  if(!d.active) return;
  d.ghost.remove(); document.body.classList.remove("is-dragging");
  if(drop){
    if(d.kind==="card"){
      const c=state.cards[d.id], from=c.list;
      if(d.toCollapsed){ c.list=d.toCollapsed; c.order=listCards(d.toCollapsed).filter(([id])=>id!==d.id).length; }
      else { const ul=d.ph.parentElement, lst=ul&&ul.closest(".bl");
        if(lst){ c.list=lst.dataset.list;
          [...ul.children].filter(n=>n!==d.el).map(n=>n===d.ph?d.id:n.dataset.card).filter(Boolean).forEach((id,i)=>{ state.cards[id].order=i; }); } }
      if(from!==c.list) renumber(listCards(from),state.cards);
    } else if(d.kind==="list"){
      [...document.getElementById("bd-lists").children].filter(n=>n!==d.el).map(n=>n===d.ph?d.id:n.dataset.list).filter(Boolean).forEach((id,i)=>{ state.blists[id].order=i; });
    } else {
      [...document.getElementById("bh-grid").children].filter(n=>n!==d.el).map(n=>n===d.ph?d.id:n.dataset.board).filter(Boolean).forEach((id,i)=>{ state.boards[id].order=i; });
    }
    save();
  }
  bJustDragged=true; setTimeout(()=>{ bJustDragged=false; },0);
  renderBoards();
}

// ---- ficha de la tarjeta ----
const cdlg=document.getElementById("carddlg");
let cardOpen=null, cdescEditing=false, ctaskOpen=false;
function openCard(id){
  if(!state.cards[id]) return;
  cardOpen=id; cdescEditing=false; ctaskOpen=false; renderCardDlg();
  if(!cdlg.open) cdlg.showModal();
  cdlg.querySelector(".dlg-x").focus();
}
cdlg.addEventListener("close",()=>{ cardOpen=null; cdescEditing=false; ctaskOpen=false; cdlg.innerHTML=""; });
cdlg.addEventListener("mousedown",e=>{ cdlg._downOnBackdrop = e.target===cdlg; });
cdlg.addEventListener("click",e=>{ if(e.target===cdlg && cdlg._downOnBackdrop) cdlg.close(); });
function renderCardDlg(){
  const c=state.cards[cardOpen]; if(!c){ if(cdlg.open) cdlg.close(); return; }
  const l=state.blists[c.list], bid=l.board, b=state.boards[bid];
  const lists=boardLists(bid), labs=boardLabels(bid), d=dueInfo(c.due);
  const done=c.check.filter(k=>k.d).length, tot=c.check.length, created=fmtCreated(c.created);
  cdlg.className="tdlg cdlg p-"+c.prio;
  cdlg.innerHTML=`
    <div class="dlg-head">
      <textarea class="dlg-title" rows="1" maxlength="200" aria-label="Título de la tarjeta" spellcheck="false">${esc(c.title)}</textarea>
      <button type="button" class="dlg-x" aria-label="Cerrar">×</button>
    </div>
    <p class="dlg-where">en la lista <select class="c-list" aria-label="Lista">${lists.map(([id,x])=>`<option value="${id}"${id===c.list?" selected":""}>${esc(x.title)}</option>`).join("")}</select>
      del tablero <b style="color:${b.color}">${esc(b.name)}</b></p>
    <div class="dlg-body">
      <div class="dlg-main">
        <h4>Prioridad</h4>
        <div class="d-prio" role="group" aria-label="Prioridad">${B_PRIOS.map(([id,n])=>
          `<button type="button" data-cprio="${id}" class="pp-${id}" aria-pressed="${id===c.prio}">${n}</button>`).join("")}</div>
        <h4>Etiquetas</h4>
        <div class="tagpick c-labels">${labs.map(([id,x])=>`<button type="button" class="tp" data-clabel="${id}" aria-pressed="${c.labels.includes(id)}" style="--c:${x.color};--tc:${textOn(x.color)}">${esc(x.name)}</button>`).join("")}
          <input type="text" class="c-newlabel" id="c-newlabel" maxlength="30" placeholder="+ Nueva etiqueta" aria-label="Nueva etiqueta"></div>
        <h4>Fecha límite</h4>
        <div class="c-due-row"><input type="date" class="c-due" value="${c.due}" aria-label="Fecha límite">
          ${c.due?`<span class="due ${d.cls}">${d.long||ICON_CAL+fmtShort(c.due)}</span><button type="button" class="linklike" data-cdue-clear>Quitar</button>`:""}</div>
        <h4>Descripción</h4>
        ${cdescEditing
          ? `<textarea class="d-desc-edit" rows="5" maxlength="10000" placeholder="Añade una descripción más detallada…">${esc(c.desc)}</textarea>
             <div class="eacts"><button type="button" class="add c-desc-save">Guardar</button><button type="button" class="add alt c-desc-cancel">Cancelar</button></div>`
          : `<div class="d-desc${c.desc?"":" empty"}" role="button" tabindex="0">${c.desc?esc(c.desc):"Añade una descripción más detallada…"}</div>`}
        <h4>Checklist ${tot?`<span class="ck-count">${done}/${tot}</span>`:""}</h4>
        ${tot?`<div class="ck-bar"><i style="width:${Math.round(done/tot*100)}%"></i></div>`:""}
        <ul class="ck">${c.check.map(k=>`<li data-ck="${k.id}"><input type="checkbox" class="ck-box" ${k.d?"checked":""} aria-label="Hecho">
          <input type="text" class="ck-t${k.d?" done":""}" value="${esc(k.t)}" maxlength="300" aria-label="Elemento"><button type="button" class="ck-del" aria-label="Quitar elemento">×</button></li>`).join("")}</ul>
        <input type="text" class="ck-new" id="ck-new" maxlength="300" placeholder="+ Añadir elemento" aria-label="Nuevo elemento de la checklist">
      </div>
      <aside class="dlg-side">
        <h4>Acciones</h4>
        <button type="button" class="side-btn" data-cdup>Duplicar</button>
        <button type="button" class="side-btn" data-ctask aria-expanded="${ctaskOpen}">Pasar a tareas del día</button>
        ${ctaskOpen?`<div class="move-panel"><label>Día <input type="date" id="ct-date" value="${c.due||key(today())}"></label>
          <button type="button" class="add" data-ctask-go>Pasar</button></div>`:""}
        <button type="button" class="side-btn d-del" data-cdel>Eliminar tarjeta</button>
        ${created?`<p class="d-meta">Creada el ${created}</p>`:""}
      </aside>
    </div>`;
  autoGrow(cdlg.querySelector(".dlg-title"));
}
function cardChanged(){ save(); renderBoards(); }
function duplicateCard(cid){
  const c=state.cards[cid], ids=listCards(c.list).map(([id])=>id), nid=newId("c");
  state.cards[nid]={...JSON.parse(JSON.stringify(c)), title:(c.title+" (copia)").slice(0,200), created:new Date().toISOString(),
    check:c.check.map(k=>({...k, id:newId("i")}))};
  ids.splice(ids.indexOf(cid)+1,0,nid); ids.forEach((id,i)=>{ state.cards[id].order=i; });
}
// Pasar una tarjeta a las tareas de un día (y al revés, desde la ficha de una tarea)
function cardToTask(cid,date){
  const c=state.cards[cid], lid=c.list;
  const tags=c.labels.map(x=>state.blabels[x]).filter(Boolean).map(L=>{
    let id=Object.keys(state.tags).find(t=>state.tags[t].name.toLowerCase()===L.name.toLowerCase());
    if(!id){ id=newId("e"); state.tags[id]={name:L.name, color:L.color}; }
    return id;
  });
  const lista=c.check.map(k=>(k.d?"☑ ":"☐ ")+k.t).join("\n");
  state.tasks[newId("t")]={date, title:c.title.slice(0,120), notes:[c.desc,lista].filter(Boolean).join("\n\n").slice(0,2000),
    prio:c.prio==="ninguna"?"media":c.prio, list:"pendiente", tags, created:new Date().toISOString()};
  delete state.cards[cid]; renumber(listCards(lid),state.cards);
  cdlg.close(); save(); renderBoards();
}
function taskToCard(tid,lid){
  const t=state.tasks[tid], bid=state.blists[lid].board;
  const labels=t.tags.map(g=>state.tags[g]).filter(Boolean).map(G=>labelInBoard(bid,G.name,G.color));
  state.cards[newId("c")]={list:lid, title:t.title, desc:t.notes, prio:t.prio, due:"", labels, check:[],
    order:listCards(lid).length, created:new Date().toISOString()};
  delete state.tasks[tid];
  closeTask(); save(); renderTasks(); renderTagMgr();
}
cdlg.addEventListener("click",e=>{
  const c=state.cards[cardOpen]; if(!c) return;
  const t=e.target, q=s=>t.closest(s); let el;
  if(q(".dlg-x")){ cdlg.close(); return; }
  if((el=q("[data-cprio]"))){ c.prio=el.dataset.cprio; cardChanged(); return; }
  if((el=q("[data-clabel]"))){ const id=el.dataset.clabel; c.labels=c.labels.includes(id)?c.labels.filter(x=>x!==id):[...c.labels,id]; cardChanged(); return; }
  if(q("[data-cdue-clear]")){ c.due=""; cardChanged(); return; }
  if(q(".d-desc")){ cdescEditing=true; renderCardDlg(); const ta=cdlg.querySelector(".d-desc-edit"); ta.focus(); ta.setSelectionRange(ta.value.length,ta.value.length); return; }
  if(q(".c-desc-save")){ c.desc=cdlg.querySelector(".d-desc-edit").value; cdescEditing=false; cardChanged(); return; }
  if(q(".c-desc-cancel")){ cdescEditing=false; renderCardDlg(); return; }
  if((el=q(".ck-del"))){ const id=el.closest("[data-ck]").dataset.ck; c.check=c.check.filter(k=>k.id!==id); cardChanged(); return; }
  if(q("[data-cdup]")){ duplicateCard(cardOpen); cardChanged(); return; }
  if(q("[data-ctask]")){ ctaskOpen=!ctaskOpen; renderCardDlg(); return; }
  if(q("[data-ctask-go]")){ const v=document.getElementById("ct-date").value; if(/^\d{4}-\d{2}-\d{2}$/.test(v)) cardToTask(cardOpen,v); return; }
  if((el=q("[data-cdel]"))){ armDelete(el,()=>{ const lid=c.list; delete state.cards[cardOpen]; renumber(listCards(lid),state.cards); cdlg.close(); save(); renderBoards(); },"Pulsa otra vez para eliminar"); }
});
cdlg.addEventListener("change",e=>{
  const c=state.cards[cardOpen]; if(!c) return; const t=e.target;
  if(t.matches(".c-list") && state.blists[t.value] && t.value!==c.list){
    const from=c.list; c.list=t.value; c.order=listCards(t.value).filter(([id])=>id!==cardOpen).length;
    renumber(listCards(from),state.cards); cardChanged();
  }
  else if(t.matches(".c-due")){ c.due=/^\d{4}-\d{2}-\d{2}$/.test(t.value)?t.value:""; cardChanged(); }
  else if(t.matches(".ck-box")){ const k=c.check.find(k=>k.id===t.closest("[data-ck]").dataset.ck); if(k){ k.d=t.checked; cardChanged(); } }
  else if(t.matches(".ck-t")){ const id=t.closest("[data-ck]").dataset.ck, v=t.value.trim();
    c.check = v ? c.check.map(k=>k.id===id?{...k, t:v.slice(0,300)}:k) : c.check.filter(k=>k.id!==id); cardChanged(); }
});
cdlg.addEventListener("input",e=>{ if(e.target.matches(".dlg-title")) autoGrow(e.target); });
cdlg.addEventListener("keydown",e=>{
  const c=state.cards[cardOpen]; if(!c) return; const t=e.target;
  if(t.matches(".dlg-title") && e.key==="Enter"){ e.preventDefault(); t.blur(); }
  else if(t.matches(".d-desc-edit") && e.key==="Enter" && (e.ctrlKey||e.metaKey)){ e.preventDefault(); cdlg.querySelector(".c-desc-save").click(); }
  else if(t.matches(".d-desc") && (e.key==="Enter"||e.key===" ")){ e.preventDefault(); t.click(); }
  else if(t.matches(".ck-t") && e.key==="Enter"){ e.preventDefault(); t.blur(); }
  else if(t.id==="ck-new" && e.key==="Enter"){
    e.preventDefault(); const v=t.value.trim(); if(!v || c.check.length>=100) return;
    c.check=[...c.check,{id:newId("i"), t:v.slice(0,300), d:false}]; cardChanged(); document.getElementById("ck-new").focus();
  }
  else if(t.id==="c-newlabel" && e.key==="Enter"){
    e.preventDefault(); const v=t.value.trim(); if(!v) return;
    const bid=state.blists[c.list].board, used=boardLabels(bid).map(([,l])=>l.color);
    const id=labelInBoard(bid, v.slice(0,30), nextColor(used));
    if(!c.labels.includes(id)) c.labels=[...c.labels,id];
    cardChanged(); document.getElementById("c-newlabel").focus();
  }
});
cdlg.addEventListener("focusout",e=>{
  const c=state.cards[cardOpen]; if(!c || !e.target.matches(".dlg-title")) return;
  const v=e.target.value.replace(/\s+/g," ").trim();
  if(v && v!==c.title){ c.title=v.slice(0,200); cardChanged(); } else e.target.value=c.title;
});
function render(){ if(!boardsView.hidden){ renderBoards(); return; } renderQuote(); renderWeek(); renderDay(); renderTasks(); renderProgress(); renderCal(); }
function renderAll(){ render(); renderCfg(); renderTagMgr(); }
// Si la app queda abierta y cambia el día, salta al nuevo día y su frase
let openDay=key(today());
function checkNewDay(){ const k=key(today()); if(k!==openDay){ openDay=k; sel=today(); renderAll(); } }
document.addEventListener("visibilitychange",()=>{ if(!document.hidden) checkNewDay(); });
setInterval(checkNewDay,60000);

function renderCfg(){
  document.getElementById("thr").value=String(state.thr);
  const box=document.getElementById("hlist"); box.innerHTML="";
  state.habits.forEach((h,i)=>{
    const el=document.createElement("div"); el.className="hcfg";
    el.innerHTML=`<input type="text" class="name" aria-label="Nombre del hábito" value="${esc(h.t)}" maxlength="60">
      <input type="text" class="desc" aria-label="Nota opcional" placeholder="Nota opcional" value="${esc(h.s)}" maxlength="90">
      <div class="row">
        <label><input type="checkbox" class="cs" ${h.streak?"checked":""}>Cuenta para la racha</label>
        <label><input type="checkbox" class="cw" ${h.week?"checked":""}>Cuenta para el % semanal</label>
      </div>
      <div class="row"><span>Días:</span><span class="dchips">${DOW.map((l,j)=>`<button type="button" data-d="${j}" aria-pressed="${h.days[j]}" aria-label="${["lunes","martes","miércoles","jueves","viernes","sábado","domingo"][j]}">${l}</button>`).join("")}</span>
        <span class="acts"><button type="button" class="up" ${i===0?"disabled":""} aria-label="Subir">↑</button><button type="button" class="down" ${i===state.habits.length-1?"disabled":""} aria-label="Bajar">↓</button><button type="button" class="del">Quitar</button></span>
      </div>`;
    el.querySelector(".name").addEventListener("input",e=>{ h.t=e.target.value.trim()||"Hábito"; save(); render(); });
    el.querySelector(".desc").addEventListener("input",e=>{ h.s=e.target.value; save(); render(); });
    el.querySelector(".cs").addEventListener("change",e=>{ h.streak=e.target.checked; save(); render(); });
    el.querySelector(".cw").addEventListener("change",e=>{ h.week=e.target.checked; save(); render(); });
    el.querySelectorAll(".dchips button").forEach(b=>b.addEventListener("click",()=>{ const j=+b.dataset.d; h.days[j]=!h.days[j]; save(); renderAll(); }));
    el.querySelector(".up").addEventListener("click",()=>{ [state.habits[i-1],state.habits[i]]=[state.habits[i],state.habits[i-1]]; save(); renderAll(); });
    el.querySelector(".down").addEventListener("click",()=>{ [state.habits[i+1],state.habits[i]]=[state.habits[i],state.habits[i+1]]; save(); renderAll(); });
    el.querySelector(".del").addEventListener("click",e=>{ const btn=e.currentTarget; if(btn.dataset.armed){ state.habits.splice(i,1); save(); renderAll(); } else { btn.dataset.armed="1"; btn.textContent="Pulsa otra vez para quitar"; setTimeout(()=>{ if(btn.isConnected){ delete btn.dataset.armed; btn.textContent="Quitar"; } },3000); } });
    box.appendChild(el);
  });
}
document.getElementById("addh").addEventListener("click",()=>{
  state.habits.push({id:"h"+Date.now().toString(36), t:"Nuevo hábito", s:"", streak:true, week:true, days:ALL7.slice()});
  save(); renderAll();
  const names=document.querySelectorAll("#hlist .name"); const last=names[names.length-1]; if(last){ last.focus(); last.select(); }
});
document.getElementById("exp").addEventListener("click",()=>{
  const blob=new Blob([JSON.stringify(state,null,1)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="ascenso-copia-"+key(today())+".json";
  document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);
  document.getElementById("bmsg").textContent="Copia descargada.";
});
document.getElementById("imp").addEventListener("change",async e=>{
  const f=e.target.files[0]; if(!f) return;
  try{ const d=JSON.parse(await f.text()); if(!d||typeof d.days!=="object") throw 0;
    state=cleanState(d);
    if(online){ await api("POST","importar",snapshot()); synced=snapshot(); }
    save(); renderAll(); document.getElementById("bmsg").textContent="Datos importados.";
  }catch(err){ document.getElementById("bmsg").textContent="Ese archivo no es una copia de Ascenso válida."; }
  e.target.value="";
});
document.getElementById("thr").addEventListener("change",e=>{ state.thr=+e.target.value; save(); render(); });

// ---------- Tareas: pintar y editar ----------
// Texto oscuro o claro según lo clara que sea la etiqueta
function textOn(hex){ const n=parseInt(hex.slice(1),16), r=n>>16&255, g=n>>8&255, b=n&255; return (0.299*r+0.587*g+0.114*b)>165?"#1F2A2E":"#FFFFFF"; }
function tagChip(id){ const t=state.tags[id]; return t?`<span class="tag" style="--c:${t.color};--tc:${textOn(t.color)}">${esc(t.name)}</span>`:""; }
function tagPickerHTML(selected){
  const ids=Object.keys(state.tags).sort((a,b)=>state.tags[a].name.localeCompare(state.tags[b].name,"es"));
  if(!ids.length) return `<span class="tp-empty">Crea etiquetas en «Etiquetas» para asignarlas.</span>`;
  return ids.map(id=>{ const t=state.tags[id], on=selected.has(id);
    return `<button type="button" class="tp" data-tag="${id}" aria-pressed="${on}" style="--c:${t.color};--tc:${textOn(t.color)}">${esc(t.name)}</button>`; }).join("");
}
const prioOptions=v=>PRIOS.map(([id,n])=>`<option value="${id}"${id===v?" selected":""}>${n}</option>`).join("");
const listOptions=v=>LISTS.map(([id,n])=>`<option value="${id}"${id===v?" selected":""}>${n}</option>`).join("");
const prioName=id=>PRIOS.find(p=>p[0]===id)[1];

function taskCardHTML(id,t){
  return `<li class="task p-${t.prio}${t.list==="hecha"?" done":""}" data-id="${id}" tabindex="0" aria-label="${esc(t.title)}. Abrir ficha">
    <span class="prio">${prioName(t.prio)}</span>
    <span class="ttitle">${esc(t.title)}</span>
    ${t.tags.length||t.notes?`<span class="tfoot">${t.tags.map(tagChip).join("")}${t.notes?`<span class="tnote-ico" title="Tiene descripción" aria-label="Tiene descripción">≡</span>`:""}</span>`:""}
  </li>`;
}
function renderTasks(){
  const k=key(sel);
  document.getElementById("tdate").textContent = k===key(today()) ? "de hoy"
    : "del "+sel.toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"});
  document.getElementById("tnewtags").innerHTML=tagPickerHTML(newTaskTags);
  const tasks=Object.entries(state.tasks).filter(([,t])=>t.date===k)
    .sort((a,b)=>PRIO_RANK[a[1].prio]-PRIO_RANK[b[1].prio] || a[1].created.localeCompare(b[1].created));
  const count=l=>tasks.filter(([,t])=>t.list===l).length;
  document.getElementById("ttabs").innerHTML=LISTS.map(([id,n])=>
    `<button type="button" role="tab" data-list="${id}" aria-selected="${id===taskTab}">${n} <span>${count(id)}</span></button>`).join("");
  document.getElementById("board").innerHTML=LISTS.map(([id,n])=>{
    const items=tasks.filter(([,t])=>t.list===id);
    return `<div class="col${id===taskTab?" active":""}" data-list="${id}">
      <h3>${n} <span>${items.length}</span></h3>
      <ul>${items.map(([tid,t])=>taskCardHTML(tid,t)).join("")
        || `<li class="tempty">${id==="hecha"?"Aún nada terminado.":"Sin tareas."}</li>`}</ul>
    </div>`;
  }).join("");
}
function renderTagMgr(){
  const box=document.getElementById("taglist");
  const ids=Object.keys(state.tags).sort((a,b)=>state.tags[a].name.localeCompare(state.tags[b].name,"es"));
  const uses=id=>Object.values(state.tasks).filter(t=>t.tags.includes(id)).length;
  box.innerHTML = ids.length ? ids.map(id=>{ const t=state.tags[id], n=uses(id);
    return `<div class="tagrow" data-tag="${id}">
      <input type="color" class="tg-color" value="${t.color.toLowerCase()}" aria-label="Color de ${esc(t.name)}">
      <input type="text" class="tg-name" value="${esc(t.name)}" maxlength="30" aria-label="Nombre de la etiqueta">
      <span class="tg-uses">${n} ${n===1?"tarea":"tareas"}</span>
      <button type="button" class="del tg-del">Quitar</button>
    </div>`; }).join("") : `<p class="tp-empty">Todavía no hay etiquetas.</p>`;
  const used=new Set(ids.map(id=>state.tags[id].color));
  const tc=document.getElementById("tagcolor");
  if(!tc.dataset.touched) tc.value=(TAG_COLORS.find(c=>!used.has(c))||TAG_COLORS[ids.length%TAG_COLORS.length]).toLowerCase();
}
// Botón de borrar en dos pasos (como en los hábitos)
function armDelete(btn,onConfirm,label){
  if(btn.dataset.armed){ onConfirm(); return; }
  btn.dataset.armed="1"; const old=btn.textContent; btn.textContent=label||"Pulsa otra vez";
  setTimeout(()=>{ if(btn.isConnected){ delete btn.dataset.armed; btn.textContent=old; } },3000);
}
function addTask(){
  const inp=document.getElementById("tnew"), title=inp.value.trim();
  if(!title){ inp.focus(); return; }
  const list=document.getElementById("tlist").value;
  state.tasks[newId("t")]={date:key(sel), title, notes:"", prio:document.getElementById("tprio").value, list,
    tags:[...newTaskTags].filter(id=>state.tags[id]), created:new Date().toISOString()};
  inp.value=""; newTaskTags.clear(); taskTab=list;
  save(); renderTasks(); renderTagMgr(); inp.focus();
}
document.getElementById("taddbtn").addEventListener("click",addTask);
document.getElementById("tnew").addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); addTask(); } });
document.getElementById("tnewtags").addEventListener("click",e=>{
  const b=e.target.closest(".tp"); if(!b) return;
  const id=b.dataset.tag; newTaskTags.has(id)?newTaskTags.delete(id):newTaskTags.add(id); renderTasks();
});
document.getElementById("ttabs").addEventListener("click",e=>{
  const b=e.target.closest("[data-list]"); if(!b) return; taskTab=b.dataset.list; renderTasks();
});
const board=document.getElementById("board");
board.addEventListener("click",e=>{
  if(justDragged) return;
  const li=e.target.closest(".task"); if(li) openTask(li.dataset.id);
});
board.addEventListener("keydown",e=>{
  const li=e.target.closest(".task");
  if(li && (e.key==="Enter"||e.key===" ")){ e.preventDefault(); openTask(li.dataset.id); }
});
// ---------- Arrastrar tareas entre listas ----------
// Con el ratón: arrastrar directamente. En pantallas táctiles: mantener pulsada la tarea y arrastrar.
// Se puede soltar sobre una columna o, en el móvil, sobre una de las pestañas.
let drag=null;
board.addEventListener("pointerdown",e=>{
  if(e.pointerType==="mouse" && e.button!==0) return;
  const el=e.target.closest(".task");
  if(!el) return;
  const r=el.getBoundingClientRect();
  drag={id:el.dataset.id, el, x0:e.clientX, y0:e.clientY, offX:e.clientX-r.left, offY:e.clientY-r.top, w:r.width,
        active:false, target:null, pid:e.pointerId, mouse:e.pointerType==="mouse"};
  if(drag.mouse) e.preventDefault();                 // evita seleccionar texto al arrastrar
  else drag.timer=setTimeout(()=>{ if(drag&&!drag.active) startDrag(drag.x0,drag.y0); },300);
});
window.addEventListener("pointermove",e=>{
  if(!drag || e.pointerId!==drag.pid) return;
  if(!drag.active){
    const moved=Math.hypot(e.clientX-drag.x0,e.clientY-drag.y0);
    if(drag.mouse){ if(moved<5) return; startDrag(e.clientX,e.clientY); }
    else { if(moved>8){ clearTimeout(drag.timer); drag=null; } return; }   // estaba desplazando la página
  }
  moveDrag(e.clientX,e.clientY);
});
window.addEventListener("pointerup",e=>{ if(drag && e.pointerId===drag.pid) endDrag(true); });
window.addEventListener("pointercancel",e=>{ if(drag && e.pointerId===drag.pid) endDrag(false); });
document.addEventListener("touchmove",e=>{ if(drag && drag.active) e.preventDefault(); },{passive:false});
document.addEventListener("keydown",e=>{ if(e.key==="Escape" && drag) endDrag(false); });
function startDrag(x,y){
  drag.active=true;
  const g=drag.el.cloneNode(true);
  g.classList.add("ghost"); g.style.width=drag.w+"px"; g.setAttribute("aria-hidden","true");
  document.body.appendChild(g); drag.ghost=g;
  drag.el.classList.add("dragging"); document.body.classList.add("is-dragging");
  if(!drag.mouse && navigator.vibrate) navigator.vibrate(12);
  moveDrag(x,y);
}
function moveDrag(x,y){
  drag.ghost.style.transform=`translate(${x-drag.offX}px,${y-drag.offY}px) rotate(1.5deg)`;
  const hit=document.elementFromPoint(x,y), zone=hit && hit.closest(".board .col, .ttabs [data-list]");
  const list=zone ? zone.dataset.list : null;
  if(list!==drag.target){
    drag.target=list;
    document.querySelectorAll(".drop-over").forEach(n=>n.classList.remove("drop-over"));
    if(list && list!==state.tasks[drag.id]?.list)
      document.querySelectorAll(`.board .col[data-list="${list}"], .ttabs [data-list="${list}"]`).forEach(n=>n.classList.add("drop-over"));
  }
  // Si se arrastra cerca del borde de la ventana, la página se desplaza
  if(y<60) window.scrollBy(0,-14); else if(y>window.innerHeight-60) window.scrollBy(0,14);
}
function endDrag(drop){
  const d=drag; drag=null; clearTimeout(d.timer);
  if(!d.active) return;
  d.ghost.remove(); d.el.classList.remove("dragging"); document.body.classList.remove("is-dragging");
  document.querySelectorAll(".drop-over").forEach(n=>n.classList.remove("drop-over"));
  const t=state.tasks[d.id];
  if(drop && t && d.target && d.target!==t.list){ t.list=d.target; save(); renderTasks(); }
  // Evita que soltar la tarjeta cuente como un clic que abre la ficha
  justDragged=true; setTimeout(()=>{ justDragged=false; },0);
}
// ---------- Ficha de la tarea (al estilo de Trello) ----------
// Al hacer clic en una tarjeta se abre su ficha. Cada cambio se guarda al momento.
const dlg=document.getElementById("taskdlg");
let openTaskId=null, descEditing=false, justDragged=false;
function openTask(id){
  if(!state.tasks[id]) return;
  openTaskId=id; descEditing=false; renderTaskDlg();
  if(!dlg.open) dlg.showModal();
  const ti=dlg.querySelector(".dlg-title"); if(ti) autoGrow(ti);
  dlg.querySelector(".dlg-x").focus();
}
function closeTask(){ if(dlg.open) dlg.close(); }
dlg.addEventListener("close",()=>{ openTaskId=null; descEditing=false; toBoardOpen=false; dlg.innerHTML=""; });
// Clic fuera de la ficha (en el fondo oscuro) para cerrarla
dlg.addEventListener("mousedown",e=>{ dlg._downOnBackdrop = e.target===dlg; });
dlg.addEventListener("click",e=>{ if(e.target===dlg && dlg._downOnBackdrop) closeTask(); });
const autoGrow=el=>{ el.style.height="auto"; el.style.height=el.scrollHeight+"px"; };
function fmtCreated(s){
  const d=new Date(s); if(isNaN(d)) return "";
  return d.toLocaleString("es-ES",{day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"});
}
function renderTaskDlg(){
  const t=state.tasks[openTaskId]; if(!t){ closeTask(); return; }
  dlg.className="tdlg p-"+t.prio;
  const created=fmtCreated(t.created);
  dlg.innerHTML=`
    <div class="dlg-head">
      <textarea class="dlg-title" rows="1" maxlength="120" aria-label="Título de la tarea" spellcheck="false">${esc(t.title)}</textarea>
      <button type="button" class="dlg-x" aria-label="Cerrar">×</button>
    </div>
    <p class="dlg-where">en la lista <select class="d-list" aria-label="Lista">${listOptions(t.list)}</select>
      para el día <input type="date" class="d-date" value="${t.date}" aria-label="Día"></p>
    <div class="dlg-body">
      <div class="dlg-main">
        <h4>Prioridad</h4>
        <div class="d-prio" role="group" aria-label="Prioridad">${PRIOS.map(([id,n])=>
          `<button type="button" data-prio="${id}" class="pp-${id}" aria-pressed="${id===t.prio}">${n}</button>`).join("")}</div>
        <h4>Etiquetas</h4>
        <div class="tagpick d-tags">${tagPickerHTML(new Set(t.tags))}</div>
        <button type="button" class="linklike d-mgr">Crear o editar etiquetas</button>
        <h4>Descripción</h4>
        ${descEditing
          ? `<textarea class="d-desc-edit" rows="5" maxlength="2000" placeholder="Añade una descripción más detallada…">${esc(t.notes)}</textarea>
             <div class="eacts"><button type="button" class="add d-desc-save">Guardar</button><button type="button" class="add alt d-desc-cancel">Cancelar</button></div>`
          : `<div class="d-desc${t.notes?"":" empty"}" role="button" tabindex="0">${t.notes?esc(t.notes):"Añade una descripción más detallada…"}</div>`}
      </div>
      <aside class="dlg-side">
        <h4>Acciones</h4>
        <button type="button" class="side-btn d-done">${t.list==="hecha"?"↺ Reabrir":"✓ Marcar como hecha"}</button>
        <button type="button" class="side-btn d-toboard" aria-expanded="${toBoardOpen}">Pasar a un tablero</button>
        ${toBoardOpen?toBoardPanel():""}
        <button type="button" class="side-btn d-del">Eliminar tarea</button>
        ${created?`<p class="d-meta">Creada el ${created}</p>`:""}
      </aside>
    </div>`;
  const ti=dlg.querySelector(".dlg-title"); autoGrow(ti);
}
function taskChanged(){ save(); renderTasks(); renderTaskDlg(); }
let toBoardOpen=false, toBoardSel=null;
function toBoardPanel(){
  const boards=boardsSorted();
  if(!boards.length) return `<p class="d-meta">Aún no tienes tableros.</p>`;
  if(!state.boards[toBoardSel]) toBoardSel=boards[0][0];
  const lists=boardLists(toBoardSel);
  return `<div class="move-panel">
    <select class="tb-board" aria-label="Tablero">${boards.map(([id,b])=>`<option value="${id}"${id===toBoardSel?" selected":""}>${esc(b.name)}</option>`).join("")}</select>
    ${lists.length?`<select class="tb-list" aria-label="Lista">${lists.map(([id,l])=>`<option value="${id}">${esc(l.title)}</option>`).join("")}</select>
      <button type="button" class="add tb-go">Pasar</button>`:`<p class="d-meta">Ese tablero no tiene listas.</p>`}
  </div>`;
}
function commitTitle(el){
  const t=state.tasks[openTaskId]; if(!t) return;
  const v=el.value.replace(/\s+/g," ").trim();
  if(v && v!==t.title){ t.title=v.slice(0,120); save(); renderTasks(); }
  else el.value=t.title;
}
dlg.addEventListener("click",e=>{
  const t=state.tasks[openTaskId]; if(!t) return;
  if(e.target.closest(".dlg-x")){ closeTask(); return; }
  const pb=e.target.closest("[data-prio]");
  if(pb){ t.prio=pb.dataset.prio; taskChanged(); return; }
  const tp=e.target.closest(".tp");
  if(tp){ const id=tp.dataset.tag, s=new Set(t.tags); s.has(id)?s.delete(id):s.add(id); t.tags=[...s]; taskChanged(); renderTagMgr(); return; }
  if(e.target.closest(".d-desc")){ descEditing=true; renderTaskDlg(); const ta=dlg.querySelector(".d-desc-edit"); ta.focus(); ta.setSelectionRange(ta.value.length,ta.value.length); return; }
  if(e.target.closest(".d-desc-save")){ t.notes=dlg.querySelector(".d-desc-edit").value; descEditing=false; taskChanged(); return; }
  if(e.target.closest(".d-desc-cancel")){ descEditing=false; renderTaskDlg(); return; }
  if(e.target.closest(".d-done")){ t.list = t.list==="hecha" ? "pendiente" : "hecha"; taskChanged(); return; }
  if(e.target.closest(".d-toboard")){ toBoardOpen=!toBoardOpen; renderTaskDlg(); return; }
  if(e.target.closest(".tb-go")){ const l=dlg.querySelector(".tb-list"); if(l&&state.blists[l.value]) taskToCard(openTaskId,l.value); return; }
  if(e.target.closest(".d-mgr")){
    closeTask(); const m=document.querySelector("details.tagmgr"); m.open=true;
    m.scrollIntoView({behavior:"smooth",block:"center"}); setTimeout(()=>document.getElementById("tagname").focus(),400); return;
  }
  const del=e.target.closest(".d-del");
  if(del) armDelete(del,()=>{ delete state.tasks[openTaskId]; closeTask(); save(); renderTasks(); renderTagMgr(); },"Pulsa otra vez para eliminar");
});
dlg.addEventListener("change",e=>{
  if(e.target.matches(".tb-board")){ toBoardSel=e.target.value; renderTaskDlg(); return; }
  const t=state.tasks[openTaskId]; if(!t) return;
  if(e.target.matches(".d-list")){ t.list=e.target.value; taskChanged(); }
  else if(e.target.matches(".d-date") && /^\d{4}-\d{2}-\d{2}$/.test(e.target.value)){ t.date=e.target.value; taskChanged(); }
});
dlg.addEventListener("input",e=>{ if(e.target.matches(".dlg-title")) autoGrow(e.target); });
dlg.addEventListener("keydown",e=>{
  if(e.target.matches(".dlg-title") && e.key==="Enter"){ e.preventDefault(); e.target.blur(); }
  else if(e.target.matches(".d-desc-edit") && e.key==="Enter" && (e.ctrlKey||e.metaKey)){ e.preventDefault(); dlg.querySelector(".d-desc-save").click(); }
  else if(e.target.matches(".d-desc") && (e.key==="Enter"||e.key===" ")){ e.preventDefault(); e.target.click(); }
});
dlg.addEventListener("focusout",e=>{ if(e.target.matches(".dlg-title")) commitTitle(e.target); });
// Gestión de etiquetas
document.getElementById("tagcolor").addEventListener("input",e=>{ e.target.dataset.touched="1"; });
function addTag(){
  const inp=document.getElementById("tagname"), name=inp.value.trim(); if(!name){ inp.focus(); return; }
  const tc=document.getElementById("tagcolor");
  state.tags[newId("e")]={name:name.slice(0,30), color:tc.value.toUpperCase()};
  inp.value=""; delete tc.dataset.touched;
  save(); renderTagMgr(); renderTasks();
}
document.getElementById("tagadd").addEventListener("click",addTag);
document.getElementById("tagname").addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); addTag(); } });
const tagBox=document.getElementById("taglist");
tagBox.addEventListener("input",e=>{
  const row=e.target.closest(".tagrow"); if(!row) return; const t=state.tags[row.dataset.tag]; if(!t) return;
  if(e.target.matches(".tg-color")) t.color=e.target.value.toUpperCase();
  else if(e.target.matches(".tg-name")){ const v=e.target.value.trim(); if(!v) return; t.name=v.slice(0,30); }
  save(); renderTasks();
});
tagBox.addEventListener("click",e=>{
  const b=e.target.closest(".tg-del"); if(!b) return; const id=b.closest(".tagrow").dataset.tag;
  armDelete(b,()=>{
    delete state.tags[id]; newTaskTags.delete(id);
    for(const t of Object.values(state.tasks)) t.tags=t.tags.filter(x=>x!==id);
    save(); renderTagMgr(); renderTasks();
  },"Pulsa otra vez para quitar");
});

// ---------- Guardado: base de datos local (servidor.py) o, si no hay, este navegador ----------
const STORE="ascenso-v1";
const API=/^https?:$/.test(location.protocol) ? "api/" : null;
let serverMsg=null;
let online=false, synced=null, syncTimer=null, syncing=false, syncAgain=false, retryTimer=null;
function setStatus(t,nivel="ok"){
  document.getElementById("status").textContent=t;
  const b=document.getElementById("bv-sync");
  if(b){
    b.dataset.nivel=nivel; b.title=t;
    b.textContent = nivel==="ok" ? "Guardado" : nivel==="aviso" ? "Solo en este navegador" : "Sin guardar";
  }
}
const VERSION_NECESARIA=7;
function saveLocal(){ try{ localStorage.setItem(STORE, JSON.stringify(state)); return true; }catch(e){ return false; } }
function snapshot(){ return JSON.parse(JSON.stringify({plan:state.plan,thr:state.thr,habits:state.habits,days:state.days,hist:state.hist,tags:state.tags,tasks:state.tasks,notes:state.notes,events:state.events,
  boards:state.boards,blabels:state.blabels,blists:state.blists,cards:state.cards})); }
async function api(method,path,body){
  const opt={method, headers:{"X-Ascenso":"1"}};
  if(body!==undefined){ opt.headers["Content-Type"]="application/json"; opt.body=JSON.stringify(body); }
  const r=await fetch(API+path,opt);
  if(!r.ok){ let m="error "+r.status; try{ m=(await r.json()).error||m; }catch(e){} throw new Error(m); }
  return r.json();
}
// Lo que se guarda de cada día: marcas activas, peso y entreno distinto al plan
function dayPayload(d){
  const o={c:{}}; if(!d) return o;
  for(const [k,v] of Object.entries(d.c||{})) if(v) o.c[k]=true;
  if(d.w!=null) o.w=d.w; if(d.type) o.type=d.type;
  return o;
}
function save(){
  const okLocal=saveLocal();
  if(!online){
    if(okLocal) document.dispatchEvent(new Event("ascenso:guardado"));
    if(serverMsg){ setStatus(serverMsg,"error"); return; }
    setStatus(okLocal ? (API?"Sin conexión con la base de datos: guardado en este navegador.":"Guardado en este navegador. Abre Ascenso con servidor.py para usar la base de datos.")
                      : "Este navegador no permite guardar datos. Exporta una copia de seguridad para no perderlos.", okLocal?"aviso":"error");
    return;
  }
  clearTimeout(syncTimer); syncTimer=setTimeout(sync,350);
}
// Envía a la base de datos solo lo que ha cambiado
async function sync(){
  if(syncing){ syncAgain=true; return; }
  syncing=true; clearTimeout(retryTimer);
  const errores=[];
  // Cada envío es independiente: si uno falla, se sigue con el resto y se reintenta después
  const enviar=async(metodo,ruta,datos)=>{ try{ await api(metodo,ruta,datos); return true; }catch(e){ errores.push(e); return false; } };
  try{
    const now=snapshot();
    if(JSON.stringify([now.plan,now.thr])!==JSON.stringify([synced.plan,synced.thr])){
      if(await enviar("PUT","config",{plan:now.plan,thr:now.thr})){ synced.plan=now.plan; synced.thr=now.thr; }
    }
    if(JSON.stringify(now.habits)!==JSON.stringify(synced.habits)){
      if(await enviar("PUT","habitos",now.habits)) synced.habits=now.habits;
    }
    // Colecciones con identificador: primero se crean o actualizan (en orden de dependencia) y luego se borran (al revés)
    const COLS=[["tags","etiquetas"],["tasks","tareas"],["boards","tableros"],["blabels","etiquetas-tablero"],["blists","listas"],["cards","tarjetas"],["events","eventos"]];
    for(const [k,ruta] of COLS) for(const [id,v] of Object.entries(now[k])){
      if(JSON.stringify(v)!==JSON.stringify(synced[k][id]||null) && await enviar("PUT",ruta+"/"+id,v)) synced[k][id]=v;
    }
    for(const [k,ruta] of [...COLS].reverse()) for(const id of Object.keys(synced[k])){
      if(!now[k][id] && await enviar("DELETE",ruta+"/"+id)) delete synced[k][id];
    }
    for(const k of new Set([...Object.keys(now.notes),...Object.keys(synced.notes)])){
      const v=now.notes[k]||null;
      if(JSON.stringify(v)!==JSON.stringify(synced.notes[k]||null) && await enviar("PUT","notas/"+k, v||{r:"",n:""})){
        if(v) synced.notes[k]=v; else delete synced.notes[k];
      }
    }
    for(const [k,v] of Object.entries(now.hist)){
      if(JSON.stringify(v)!==JSON.stringify(synced.hist[k]||null) && await enviar("PUT","historial/"+k,v)) synced.hist[k]=v;
    }
    for(const k of new Set([...Object.keys(now.days),...Object.keys(synced.days)])){
      const p=dayPayload(now.days[k]);
      if(JSON.stringify(p)!==JSON.stringify(dayPayload(synced.days[k])) && await enviar("PUT","dias/"+k,p)) synced.days[k]=now.days[k];
    }
    if(!errores.length){
      setStatus("Guardado en la base de datos (ascenso.db).");
      document.dispatchEvent(new Event("ascenso:guardado"));
    } else {
      const e=errores[0];
      const why = e instanceof TypeError ? "el servidor no está en marcha" : e.message;
      setStatus("No se pudo guardar todo en la base de datos ("+why+"). Queda guardado en este navegador y se reintentará.","error");
      retryTimer=setTimeout(sync,5000);
    }
  }finally{
    syncing=false;
    if(syncAgain){ syncAgain=false; sync(); }
  }
}

document.getElementById("w").addEventListener("change",e=>{
  const k=key(sel), v=parseFloat(String(e.target.value).replace(",","."));
  state.days[k]=state.days[k]||{};
  if(isNaN(v)) delete state.days[k].w; else state.days[k].w=Math.round(v*10)/10;
  save(); render();
});
document.getElementById("prev").onclick=()=>{sel=addDays(sel,-1);render();};
document.getElementById("next").onclick=()=>{ if(key(sel)!==key(today())){sel=addDays(sel,1);render();} };
document.getElementById("today").onclick=()=>{sel=today();render();};

// ---------- Carga inicial ----------
// Estado inicial de una instalación nueva (sin datos personales; el plan es DEFAULT_PLAN)
const SEED={"days":{}};
function readLocal(){
  try{ const s=JSON.parse(localStorage.getItem(STORE)||localStorage.getItem("rutina-v1")||"null"); return s&&s.days?s:null; }
  catch(e){ return null; }
}
async function init(){
  const local=readLocal();
  state=cleanState(local||SEED);
  if(API){
    try{
      let remote=await api("GET","estado");
      if(remote.vacia){
        // Primera conexión: la base de datos empieza con lo que ya había en este navegador
        await api("POST","importar",snapshot());
        remote=await api("GET","estado");
      }
      if((remote.version||0)<VERSION_NECESARIA){
        // El servidor que responde es de una versión anterior: no conoce las funciones nuevas
        serverMsg="El servidor de Ascenso que está en marcha es de una versión anterior y no puede guardar todo. Cierra Ascenso, espera un minuto y vuelve a abrirlo.";
        throw new Error("servidor antiguo");
      }
      state=cleanState(remote);
      synced=snapshot(); online=true;
      // Tableros que solo están en este navegador (creados mientras no se guardaban en la base de datos):
      // se recuperan, con sus listas, tarjetas y etiquetas, y se suben
      if(local){
        const loc=cleanBoardData(local), nuevos=new Set(Object.keys(loc.boards).filter(id=>!state.boards[id]));
        if(nuevos.size){
          for(const id of nuevos) state.boards[id]=loc.boards[id];
          for(const [id,l] of Object.entries(loc.blabels)) if(nuevos.has(l.board) && !state.blabels[id]) state.blabels[id]=l;
          for(const [id,l] of Object.entries(loc.blists)) if(nuevos.has(l.board) && !state.blists[id]) state.blists[id]=l;
          for(const [id,c] of Object.entries(loc.cards)) if(loc.blists[c.list] && nuevos.has(loc.blists[c.list].board) && !state.cards[id]) state.cards[id]=c;
          save();
        }
      }
      saveLocal();
      setStatus("Conectado a la base de datos (ascenso.db).");
    }catch(e){ setStatus(serverMsg||"Sin conexión con la base de datos: guardado en este navegador.", serverMsg?"error":"aviso"); }
  } else {
    setStatus("Guardado en este navegador. Abre Ascenso con servidor.py para usar la base de datos.","aviso");
  }
  renderAll();
  discoverImages();
}
init();
// Señal periódica al servidor: así sabe que la ventana sigue abierta (modo aplicación)
if(API){ const latido=()=>fetch("api/ping").catch(()=>{}); latido(); setInterval(latido,20000); }


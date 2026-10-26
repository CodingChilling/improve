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
  ...cleanBoardData(x),
  ...cleanMapData(x)
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
// ---------- Mapas de nodos: datos ----------
// maps   {id: {title, color, fav, order, notes, created}}           color = acento del mapa
// mnodes {id: {map, parent, title, color, x, y, notes, created}}    parent null = primer nivel; color "" = acento
// mlinks {id: {a, b}}                                               hilos entre nodos del mismo nivel
const LIMITE_LIBRETA=1000000;   // caracteres por libreta (unas 350 páginas)
const M_COLORS=["#7F77DD","#BA7517","#1D9E75","#378ADD","#D4537E","#D85A30","#639922","#888780"];
function cleanMapData(x){
  const ID=/^[A-Za-z0-9_-]{1,40}$/, HEX=/^#[0-9A-Fa-f]{6}$/, obj=v=>v&&typeof v==="object"?v:{};
  const pos=v=>(v===null||v===undefined||v==="")?null:(Number.isFinite(+v)?Math.round(+v*10)/10:null);
  const maps={}, mnodes={}, mlinks={};
  for(const [id,m] of Object.entries(obj(x.maps))){
    if(!ID.test(id)||!m) continue;
    const title=String(m.title||"").trim().slice(0,80); if(!title) continue;
    maps[id]={title, color:HEX.test(m.color||"")?m.color.toUpperCase():M_COLORS[0], fav:!!m.fav,
      order:Number.isFinite(+m.order)?Math.round(+m.order):0, notes:String(m.notes||"").slice(0,LIMITE_LIBRETA), created:String(m.created||"").slice(0,40)};
  }
  const raw={};
  for(const [id,n] of Object.entries(obj(x.mnodes))){
    if(!ID.test(id)||!n||!maps[n.map]) continue;
    const title=String(n.title||"").trim().slice(0,120); if(!title) continue;
    raw[id]={map:n.map, parent:typeof n.parent==="string"&&n.parent?n.parent:null, title,
      color:HEX.test(n.color||"")?n.color.toUpperCase():"", x:pos(n.x), y:pos(n.y), notes:String(n.notes||"").slice(0,LIMITE_LIBRETA), created:String(n.created||"").slice(0,40)};
  }
  // Solo nodos cuya cadena de padres existe, es del mismo mapa y no da vueltas
  for(const [id,n] of Object.entries(raw)){
    let p=n.parent, ok=true, seen=new Set([id]);
    while(p){ const q=raw[p]; if(!q||q.map!==n.map||seen.has(p)){ ok=false; break; } seen.add(p); p=q.parent; }
    if(ok) mnodes[id]=n;
  }
  const pairs=new Set();
  for(const [id,l] of Object.entries(obj(x.mlinks))){
    if(!ID.test(id)||!l) continue;
    const a=mnodes[l.a], b=mnodes[l.b];
    if(!a||!b||l.a===l.b||a.map!==b.map||a.parent!==b.parent) continue;
    const k=[l.a,l.b].sort().join("|"); if(pairs.has(k)) continue; pairs.add(k);
    mlinks[id]={a:l.a, b:l.b};
  }
  return {maps, mnodes, mlinks};
}
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
  if(curBoard!=="home" && !state.boards[curBoard] && !(curMapId() && state.maps[curMapId()])) curBoard="home";
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
  const mid=curMapId(), m=mid&&state.maps[mid], b=!mid&&state.boards[curBoard];
  if(!b && !m && curBoard!=="home") curBoard="home";
  document.getElementById("bv-current").textContent=m?m.title:b?b.name:"Todos los tableros";
  boardsView.style.setProperty("--bc", m?m.color:b?b.color:"var(--gold)");
  boardsView.classList.toggle("on-map",!!m);
  renderPicker();
  const lists=document.getElementById("bd-lists"), sx=lists?lists.scrollLeft:0;
  bvBody.innerHTML=m?mapViewHTML(mid,m):b?boardHTML(curBoard,b):homeHTML();
  const nl=document.getElementById("bd-lists"); if(nl) nl.scrollLeft=sx;
  if(m) mountMap();
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
    `<hr><button type="button" class="pk-item" data-gohome>Todos los tableros</button><button type="button" class="pk-item" data-gonew>+ Nuevo tablero</button>`+
    `<hr><p class="pk-h">Mapas</p>`+mapsSorted().map(([id,mp])=>
    `<button type="button" class="pk-item${"m:"+id===curBoard?" on":""}" data-gomap="${id}" style="--c:${mp.color}"><span class="pk-dot pk-round"></span>${esc(mp.title)}${mp.fav?'<span class="pk-star">★</span>':""}</button>`).join("")+
    `<button type="button" class="pk-item" data-gonewmap>+ Nuevo mapa</button>`;
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
    <p class="hint">Arrastra los tableros y los mapas para ordenarlos. Los favoritos (★) aparecen primero.</p>
    ${mapsSectionHTML()}</div>`;
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
  const mp=e.target.closest("[data-gomap]"); if(mp){ setMap(mp.dataset.gomap); return; }
  if(e.target.closest("[data-gonewmap]")){ openNewMap(); setBoard("home"); const f=document.getElementById("nm-name"); if(f){ f.focus(); f.scrollIntoView({block:"center"}); } return; }
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
  if(mHelpOpen && !e.target.closest(".mv-help-wrap")) toggleHelp(false);
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
  // También nodos de los mapas (por título o por lo escrito en su libreta)
  const nodes=Object.entries(state.mnodes)
    .filter(([,n])=>fold(n.title).includes(q)||fold(n.notes).includes(q))
    .sort((a,b)=>(fold(b[1].title).includes(q))-(fold(a[1].title).includes(q))).slice(0,30);
  const where=n=>{ const p=[]; let x=n.parent; while(x&&state.mnodes[x]){ p.unshift(state.mnodes[x].title); x=state.mnodes[x].parent; } return [state.maps[n.map].title,...p].map(esc).join(" › "); };
  const html=res.map(([id,c])=>{ const l=state.blists[c.list], b=state.boards[l.board];
      return `<button type="button" class="sr" data-sr="${id}" style="--c:${b.color}"><span class="sr-t">${esc(c.title)}</span><span class="sr-w">Tarjeta · ${esc(b.name)} · ${esc(l.title)}</span></button>`; }).join("")+
    nodes.map(([id,n])=>`<button type="button" class="sr sr-node" data-srn="${id}" style="--c:${n.color||state.maps[n.map].color}"><span class="sr-t">${esc(n.title)}</span><span class="sr-w">Nodo · ${where(n)}</span></button>`).join("");
  bvResults.innerHTML = html || `<p class="sr-empty">No hay tarjetas ni nodos con «${esc(bvQ.value.trim())}».</p>`;
  bvResults.hidden=false;
}
bvQ.addEventListener("input",renderSearch);
bvQ.addEventListener("focus",renderSearch);
bvQ.addEventListener("keydown",e=>{
  if(e.key==="Escape"){ bvQ.value=""; bvResults.hidden=true; }
  else if(e.key==="Enter"){ const f=bvResults.querySelector("[data-sr],[data-srn]"); if(f) f.click(); }
});
bvResults.addEventListener("click",e=>{
  const rn=e.target.closest("[data-srn]");
  if(rn){ const n=state.mnodes[rn.dataset.srn]; if(!n) return;
    bvQ.value=""; bvResults.hidden=true;
    setMap(n.map); goLevel(n.parent); selectOnly(rn.dataset.srn); selectionChanged(); ensureVisible(rn.dataset.srn); return; }
  const r=e.target.closest("[data-sr]"); if(!r) return;
  const c=state.cards[r.dataset.sr]; if(!c) return;
  bvQ.value=""; bvResults.hidden=true;
  setBoard(state.blists[c.list].board); openCard(r.dataset.sr);
});

// ======================================================================
// ---------- Mapas de nodos (en la vista de tableros, sección «Mapas») ----------
// ======================================================================
let mapLevel=null, mSel=null, mSelLink=null, mNoteEditing=false;
let nbMapOpen=false, nmDraft={title:"", color:M_COLORS[0]};
// Reparto mapa | libreta, en % del mapa. Empieza con la libreta más grande (40 | 60), y se puede ajustar
let mSplit=(()=>{ try{ const v=+localStorage.getItem("ascenso-reparto-mapa-libreta"); return v>=20&&v<=80?v:40; }catch(e){ return 40; } })();
const mCam={};          // cámara (zoom y desplazamiento) de cada nivel visitado en esta sesión
let MG=null;            // estado del lienzo montado
const curMapId=()=>typeof curBoard==="string"&&curBoard.startsWith("m:")?curBoard.slice(2):null;
const mapsSorted=()=>Object.entries(state.maps).sort((a,b)=>(b[1].fav-a[1].fav)||(a[1].order-b[1].order));
const levelNodes=(mid,lvl)=>Object.entries(state.mnodes).filter(([,n])=>n.map===mid&&(n.parent||null)===(lvl||null));
function childrenIndex(){ const ch={}; for(const [id,n] of Object.entries(state.mnodes)) if(n.parent) (ch[n.parent]=ch[n.parent]||[]).push(id); return ch; }
function descCount(id,ch){ let c=0; for(const k of ch[id]||[]) c+=1+descCount(k,ch); return c; }
// Carga de un nodo: los nodos que contiene (en todos sus niveles) más su texto (cada 250 caracteres cuentan como uno)
const nodeLoad=(id,ch)=>{ const t=state.mnodes[id].notes; return descCount(id,ch)+t.length/250+countImages(t); };
const glowLevel=l=>l<1?0:l<4?1:l<10?2:3;
const GLOW_NAMES=["ninguno","suave","medio","intenso"];
function levelPath(){ const p=[]; let n=mapLevel; while(n&&state.mnodes[n]){ p.unshift(n); n=state.mnodes[n].parent; } return p; }

// ---- deshacer y rehacer (durante la sesión) ----
// Historial ligero: se guarda una sola copia de referencia (cada elemento como texto) y, en cada paso,
// solo los elementos que cambiaron. Así deshacer no ocupa más memoria aunque haya libretas muy largas.
let mUndo=[], mRedo=[], mTyping=false, mBase=null, mBaseOf=null;
const MCOLS=["maps","mnodes","mlinks"];
function mEnsureBase(){
  if(mBase && mBaseOf===state) return;
  mBase={}; mBaseOf=state; mUndo=[]; mRedo=[];          // datos nuevos (importados o recargados): historial nuevo
  for(const k of MCOLS){ mBase[k]={}; for(const [id,v] of Object.entries(state[k])) mBase[k][id]=JSON.stringify(v); }
}
// Cambios desde la última referencia, como «cómo estaban antes»; y la referencia se pone al día
function mDiff(){
  const patch={}; let n=0;
  for(const k of MCOLS){ const cur=state[k], base=mBase[k];
    for(const id in cur){ const j=JSON.stringify(cur[id]); if(base[id]!==j){ (patch[k]=patch[k]||{})[id]=base[id]??null; base[id]=j; n++; } }
    for(const id in base) if(!(id in cur)){ (patch[k]=patch[k]||{})[id]=base[id]; delete base[id]; n++; }
  }
  return n?patch:null;
}
function mApply(patch){
  const back={};
  for(const k in patch){ back[k]={};
    for(const id in patch[k]){ back[k][id]=mBase[k][id]??null; const v=patch[k][id];
      if(v==null){ delete state[k][id]; delete mBase[k][id]; } else { state[k][id]=JSON.parse(v); mBase[k][id]=v; } } }
  return back;
}
// Se llama justo antes de cada acción: cierra el paso anterior
function mRemember(){ mEnsureBase(); const p=mDiff(); if(p){ mUndo.push(p); if(mUndo.length>200) mUndo.shift(); mRedo=[]; } }
function mAfterRestore(){
  const mid=curMapId();
  if(mid && !state.maps[mid]){ curBoard="home"; mapLevel=null; }
  while(mapLevel && !state.mnodes[mapLevel]) mapLevel=null;
  if(mSel && !state.mnodes[mSel]) mSel=null;
  mMulti=new Set([...mMulti].filter(id=>state.mnodes[id]));
  if(mSelLink && !state.mlinks[mSelLink]) mSelLink=null;
  save(); renderBoards();
}
function mUndoDo(){
  mEnsureBase(); const p=mDiff(); if(p){ mUndo.push(p); mRedo=[]; }
  if(!mUndo.length) return; mRedo.push(mApply(mUndo.pop())); mAfterRestore();
}
function mRedoDo(){
  mEnsureBase(); const p=mDiff(); if(p){ mUndo.push(p); mRedo=[]; return; }
  if(!mRedo.length) return; mUndo.push(mApply(mRedo.pop())); mAfterRestore();
}

// ---- inicio: sección «Mapas» bajo los tableros ----
function mapsSectionHTML(){
  const count=id=>Object.values(state.mnodes).filter(n=>n.map===id).length;
  const items=mapsSorted().map(([id,m])=>{ const n=count(id);
    return `<article class="bcard mcard" data-map="${id}" style="--bc:${m.color}" tabindex="0">
      <span class="bcard-band"></span><h3>${esc(m.title)}</h3>
      <p>${n} ${n===1?"nodo":"nodos"}</p>
      <button type="button" class="bfav" data-mfav="${id}" aria-pressed="${m.fav}" aria-label="${m.fav?"Quitar de favoritos":"Marcar como favorito"}">★</button>
    </article>`; }).join("");
  const form = nbMapOpen
    ? `<div class="bcard bnew-form" style="--bc:${nmDraft.color}">
        <input type="text" id="nm-name" maxlength="80" placeholder="Título del mapa" value="${esc(nmDraft.title)}" aria-label="Título del mapa">
        <div class="swatches">${M_COLORS.map(c=>`<button type="button" class="sw" data-nmcolor="${c}" aria-pressed="${c===nmDraft.color}" style="--c:${c}" aria-label="Color de acento"></button>`).join("")}</div>
        <div class="eacts"><button type="button" class="add" data-nmcreate>Crear mapa</button><button type="button" class="add alt" data-nmcancel>Cancelar</button></div>
      </div>`
    : `<button type="button" class="bcard bnew" data-newmap>+ Nuevo mapa</button>`;
  return `<section class="bh-maps" aria-labelledby="h-mapas"><h2 id="h-mapas">Mapas</h2>
    ${Object.keys(state.maps).length?"":`<p class="bh-empty">Organiza ideas y apuntes en mapas de nodos conectados.</p>`}
    <div class="bh-grid" id="mh-grid">${items}${form}</div></section>`;
}
function openNewMap(){
  if(!nbMapOpen && !nmDraft.title){ const used=Object.values(state.maps).map(m=>m.color); nmDraft.color=M_COLORS.find(c=>!used.includes(c))||M_COLORS[0]; }
  nbMapOpen=true;
}
function createMap(){
  const title=nmDraft.title.trim(); if(!title){ const f=document.getElementById("nm-name"); if(f) f.focus(); return; }
  mRemember();
  const id=newId("m");
  state.maps[id]={title:title.slice(0,80), color:nmDraft.color, fav:false,
    order:Math.max(-1,...Object.values(state.maps).map(m=>m.order))+1, notes:"", created:new Date().toISOString()};
  nbMapOpen=false; nmDraft={title:"", color:M_COLORS[0]};
  save(); setMap(id);
}
function setMap(id){
  curBoard="m:"+id; try{ localStorage.setItem("ascenso-tablero",curBoard); }catch(e){}
  openMenuKey=null; pickerOpen=false; mapLevel=null; mSel=null; mSelLink=null; mNoteEditing=false;
  renderBoards(); window.scrollTo(0,0);
}
function deleteMap(mid){
  mRemember();
  for(const [id,n] of Object.entries(state.mnodes)) if(n.map===mid){
    for(const [lid,l] of Object.entries(state.mlinks)) if(l.a===id||l.b===id) delete state.mlinks[lid];
    delete state.mnodes[id];
  }
  delete state.maps[mid];
  save(); setBoard("home");
}

// ---- vista de un mapa ----
function mapViewHTML(mid,m){
  const path=levelPath();
  const crumbs=`<button type="button" class="mv-crumb${mapLevel?"":" cur"}" data-mlevel="">${esc(m.title)}</button>`+
    path.map((nid,i)=>`<span class="mv-sep">/</span><button type="button" class="mv-crumb${i===path.length-1?" cur":""}" data-mlevel="${nid}">${esc(state.mnodes[nid].title)}</button>`).join("");
  const solo = mapLevel && !levelNodes(mid,mapLevel).length;
  return `<div class="mv" style="--acc:${m.color}">
    <div class="mv-head">
      <nav class="mv-crumbs" aria-label="Ruta"><span class="mv-root">Mapas</span><span class="mv-sep">/</span>${crumbs}</nav>
      <span class="bd-sp"></span>
      <span class="mv-acc-l">Acento</span>
      <div class="swatches mv-acc">${M_COLORS.map(c=>`<button type="button" class="sw" data-macc="${c}" aria-pressed="${c===m.color}" style="--c:${c}" aria-label="Color de acento"></button>`).join("")}</div>
      <button type="button" class="bfav" data-mfav="${mid}" aria-pressed="${m.fav}" aria-label="${m.fav?"Quitar de favoritos":"Marcar como favorito"}">★</button>
      <div class="menu-wrap"><button type="button" class="bd-more" data-menu="map" aria-label="Opciones del mapa" aria-expanded="${openMenuKey==="map"}">⋯</button>
        ${openMenuKey==="map"?`<div class="bmenu" role="menu"><button type="button" class="bm-item danger" data-delmap>Eliminar mapa</button></div>`:""}</div>
      <div class="mv-help-wrap"><button type="button" class="mv-help-btn" data-mhelp aria-label="Comandos y atajos" aria-expanded="${mHelpOpen}" title="Comandos y atajos (?)">?</button>
        ${mHelpOpen?helpHTML():""}</div>
    </div>
    <div class="mv-body${solo?" solo":""}" id="mv-body" style="--split:${mSplit}%">
      <div class="mv-graph" id="mv-graph">
        <canvas id="mv-cv" aria-label="Mapa de nodos"></canvas>
        <div class="mv-tools">
          <button type="button" data-mtool="new">+ Nodo</button>
          <button type="button" data-mtool="out" aria-label="Alejar">−</button>
          <button type="button" data-mtool="in" aria-label="Acercar">+</button>
          <button type="button" data-mtool="fit" aria-label="Ajustar a la pantalla" title="Ajustar a la pantalla">⤢</button>
        </div>
        <div class="mv-confirm" id="mv-confirm" hidden></div>
      </div>
      <div class="mv-split" id="mv-split" role="separator" aria-orientation="vertical" title="Arrastra para cambiar el reparto"></div>
      <div class="mv-note" id="mv-note"></div>
    </div>
  </div>`;
}
// ---- ayuda: comandos y atajos («?» arriba a la derecha) ----
let mHelpOpen=false;
const K=t=>t.split("+").map(k=>`<kbd>${k}</kbd>`).join("+");
function helpHTML(){
  const groups=[
    ["Crear",[["Doble clic en un hueco","Nuevo nodo"],[K("Tab"),"Nuevo nodo conectado al seleccionado"],[K("Intro")+" al nombrar un nodo nuevo","Otro nodo al mismo nivel"],
      [K("Mayús")+" + arrastrar de un nodo a un hueco","Nuevo nodo ya conectado"],["Botón «+ Nodo»","Nuevo nodo en el centro"]]],
    ["Conectar",[[K("Mayús")+" + arrastrar de un nodo a otro","Conectar dos nodos"],["Clic derecho › Conectar con…","Elegir el otro nodo con un clic"],["Clic en un hilo + "+K("Supr"),"Quitar la conexión"]]],
    ["Seleccionar",[["Clic","Seleccionar un nodo"],[K("Ctrl")+" + clic","Añadir o quitar de la selección"],[K("Mayús")+" + arrastrar en el fondo","Seleccionar con un recuadro"],[K("Ctrl+A"),"Todos los nodos del nivel"],[K("Esc"),"Quitar la selección"]]],
    ["Organizar",[["Arrastrar","Mover los nodos seleccionados"],["Soltar un nodo sobre otro","Meterlo dentro de ese nodo"],["Clic derecho › Mover a…","Llevarlo a otro nivel"],
      [K("Ctrl+C")+" · "+K("Ctrl+X")+" · "+K("Ctrl+V"),"Copiar, cortar y pegar (también entre mapas)"],["Pegar una lista de texto","Un nodo por línea; las sangradas, dentro"],
      [K("Supr"),"Eliminar"],[K("Ctrl+Z")+" · "+K("Ctrl+Y"),"Deshacer y rehacer"]]],
    ["Moverse",[["Doble clic en un nodo o "+K("Intro"),"Entrar en su nivel"],[K("Retroceso")+" o "+K("Alt")+"+"+K("←"),"Subir un nivel"],["La ruta de arriba","Ir a cualquier nivel"],
      ["Rueda del ratón","Acercar y alejar"],["Arrastrar el fondo","Desplazarse"],["Botón ⤢","Ajustar a la pantalla"]]],
    ["Libreta",[[K("F2"),"Cambiar el nombre"],["Clic en el texto","Escribir justo ahí"],[K("Ctrl+I"),"Índice de títulos"],["Rueda o segmentos de la barra","Pasar de tramo; el número de arriba, de página"],
      ["<code># título</code> · <code>**negrita**</code> · <code>*cursiva*</code> · <code>~~tachado~~</code> · <code>`código`</code>","Formato de texto"],
      ["<code>- lista</code> · <code>1. lista</code> · <code>- [ ] casilla</code> · <code>&gt; cita</code> · <code>---</code>","Listas (con sangría, anidadas), citas y separadores"],
      ["<code>```bash</code> … <code>```</code>","Bloque de código (con botón «Copiar»)"],
      ["<code>| a | b |</code> + <code>| --- | --- |</code>","Tabla"],["<code>[texto](https://…)</code>","Enlace"]]],
    ["Imágenes",[[K("Ctrl+V")+" con una captura o imagen copiada","Pegarla en la libreta"],["Arrastrar archivos a la libreta","Añadirlos donde los sueltes"],["Botón «+ Imagen»","Elegir archivos (en el móvil, también la cámara)"],
      ["Varias a la vez","Quedan en fila"],["Arrastrar la imagen","Moverla a cualquier sitio de la libreta"],["Escribir al lado","El texto ocupa el hueco que deja la imagen (en el lado con más sitio)"],["Arrastrar su esquina","Hacerla más grande o más pequeña"],
      ["Barra sobre la imagen","Pie de foto, ver en grande y quitar"],["Clic en la imagen","Verla en grande (rueda: zoom)"],
      [K("Retroceso")+" justo detrás","Quitar la imagen ("+K("Ctrl+Z")+" la devuelve)"]]],
  ];
  return `<div class="mv-help" role="dialog" aria-label="Comandos y atajos">
    <div class="mh-head"><b>Comandos y atajos</b><span>${K("?")} para abrir y cerrar</span></div>
    <div class="mh-grid">${groups.map(([t,rows])=>`<section><h4>${t}</h4><dl>${rows.map(([k,d])=>`<dt>${k}</dt><dd>${d}</dd>`).join("")}</dl></section>`).join("")}</div>
  </div>`;
}
function toggleHelp(force){ mHelpOpen=force==null?!mHelpOpen:force; renderBoards(); }
function goLevel(id){
  flushNoteTyping(); mapLevel=id||null; clearSel(); mChain=null; mNoteEditing=false; renderBoards();
}
const goUp=()=>{ if(mapLevel) goLevel(state.mnodes[mapLevel].parent); };

// ---- libreta (al estilo del editor de Obsidian) ----
function noteSubject(){
  if(mSel && state.mnodes[mSel]) return {kind:"node", id:mSel, o:state.mnodes[mSel]};
  if(mapLevel && state.mnodes[mapLevel]) return {kind:"node", id:mapLevel, o:state.mnodes[mapLevel]};
  const mid=curMapId(); return {kind:"map", id:mid, o:state.maps[mid]};
}
// Markdown de la libreta. Cada línea de los apuntes ocupa una fila también al leer (incluidas las líneas en blanco,
// las de apertura y cierre de un bloque de código y la de separación de una tabla), y lleva su número (data-line):
// así leer y escribir se ven a la misma altura y se puede pasar de uno a otro sin perder el sitio.
// Admite: títulos (# a ######), **negrita**, *cursiva*, ~~tachado~~, `código`, [enlaces](https://…), listas
// (con viñetas, numeradas, de casillas y anidadas), > citas, --- separadores, bloques ``` de código y tablas.
function mdInline(s){
  // Código, enlaces y direcciones se apartan primero, para que lo que llevan dentro (**, _, [) no se interprete
  const keep=[], put=h=>{ keep.push(h); return "\u0000"+(keep.length-1)+"\u0000"; };
  const fmt=x=>x.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/(^|[^\w])__(.+?)__(?!\w)/g,"$1<strong>$2</strong>")
               .replace(/(^|[^*])\*([^*\s][^*]*?)\*/g,"$1<em>$2</em>").replace(/(^|[^\w])_([^_\s][^_]*?)_(?!\w)/g,"$1<em>$2</em>")
               .replace(/~~(.+?)~~/g,"<del>$1</del>");
  const link=(url,label)=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  s=s.replace(/`([^`\n]+)`/g,(_,c)=>put(`<code>${esc(c)}</code>`));
  s=s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g,(m,txt,url)=>/^(https?:\/\/|mailto:)/i.test(url)?put(link(url,fmt(esc(txt)))):m);
  s=s.replace(/https?:\/\/[^\s<>()]*[^\s<>().,;:!?'"]/g,url=>put(link(url,esc(url))));
  s=fmt(esc(s));
  for(let k=keep.length-1;k>=0;k--) s=s.split("\u0000"+k+"\u0000").join(keep[k]);
  return s.replace(/\u0000(\d+)\u0000/g,(_,k)=>keep[+k]);
}
const isTableRow=l=>/^\s*\|.*\|\s*$/.test(l);
const isTableSep=l=>/^\s*\|(\s*:?-{3,}:?\s*\|)+\s*$/.test(l);
const tableCells=l=>l.trim().replace(/^\||\|$/g,"").split(/(?<!\\)\|/).map(c=>c.trim().replace(/\\\|/g,"|"));
function mdRender(t){
  let h="", list=null, para=[];
  const closeList=()=>{ if(list){ h+="</ul>"; list=null; } };
  const closePara=()=>{ if(para.length){ h+=`<p>${para.map(([l,i])=>`<span class="ln" data-line="${i}">${mdInline(l)}</span>`).join("<br>")}</p>`; para=[]; } };
  const lines=t.split("\n");
  for(let i=0;i<lines.length;i++){
    const l=lines[i]; let m;
    // Bloque de código: la línea de apertura muestra el lenguaje y un botón para copiar; la de cierre, el final del bloque
    if((m=l.match(/^\s*(`{3,}|~{3,})\s*([\w+#.-]*)\s*$/))){
      closePara(); closeList();
      const fence=m[1], lang=m[2]; let j=i+1; const body=[];
      while(j<lines.length && !lines[j].trim().startsWith(fence)) { body.push(j); j++; }
      h+=`<div class="mn-code">`;
      h+=`<div class="mn-fence" data-line="${i}"><span>${esc(lang||"código")}</span><button type="button" class="mn-copy" data-copy="${i}">Copiar</button></div>`;
      h+=`<pre>${body.map(k=>`<span class="cl" data-line="${k}">${esc(lines[k])||" "}</span>`).join("\n")}</pre>`;
      if(j<lines.length) h+=`<div class="mn-fence end" data-line="${j}"></div>`;
      h+=`</div>`;
      i=j; continue;
    }
    // Tabla: fila de cabecera + separación (|---|) + filas. La cabecera ocupa dos filas de la rejilla (la suya y la separación)
    if(isTableRow(l) && i+1<lines.length && isTableSep(lines[i+1])){
      closePara(); closeList();
      const align=tableCells(lines[i+1]).map(c=>/^:-+:$/.test(c)?"center":/-:$/.test(c)?"right":"left");
      const cell=(tag,c,k)=>`<${tag} style="text-align:${align[k]||"left"}">${mdInline(c)}</${tag}>`;
      h+=`<div class="mn-table"><table><thead><tr class="th2" data-line="${i}">${tableCells(l).map((c,k)=>cell("th",c,k)).join("")}</tr></thead><tbody>`;
      let j=i+2;
      while(j<lines.length && isTableRow(lines[j])){ h+=`<tr data-line="${j}">${tableCells(lines[j]).map((c,k)=>cell("td",c,k)).join("")}</tr>`; j++; }
      h+=`</tbody></table></div>`;
      i=j-1; continue;
    }
    if(isImgLine(l)){ closePara(); closeList(); h+=`<div class="ln-img" data-line="${i}" data-src="${esc(l)}"></div>`; continue; }
    // Listas (también anidadas, según la sangría): con casillas, con viñetas o numeradas
    if((m=l.match(/^(\s*)([-*+]|\d+[.)]) (\[( |x|X)\] )?(.*)$/))){
      closePara(); if(!list){ h+='<ul class="mn-ul">'; list="ul"; }
      const depth=Math.min(6,Math.floor(m[1].replace(/\t/g,"    ").length/2)), num=/\d/.test(m[2]);
      const mark=num?`<span class="mn-num">${esc(m[2])}</span>`:"";
      if(m[3]) h+=`<li class="mn-ck" data-line="${i}" style="--d:${depth}"><input type="checkbox" data-ckline="${i}"${m[4]===" "?"":" checked"} aria-label="Hecho"><span${m[4]===" "?"":' class="done"'}>${mdInline(m[5])}</span></li>`;
      else h+=`<li class="${num?"mn-oli":"mn-uli"}" data-line="${i}" style="--d:${depth}">${mark}${mdInline(m[5])}</li>`;
      continue;
    }
    closeList();
    if((m=l.match(/^(#{1,6})\s+(.*)$/))){ closePara(); const n=Math.min(6,m[1].length+1); h+=`<h${n} data-line="${i}">${mdInline(m[2])}</h${n}>`; continue; }
    if((m=l.match(/^>\s?(.*)$/))){ closePara(); h+=`<blockquote data-line="${i}">${mdInline(m[1])||"&nbsp;"}</blockquote>`; continue; }
    if(/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)){ closePara(); h+=`<hr data-line="${i}">`; continue; }
    if(l.trim()) para.push([l,i]);
    else if(i<lines.length-1 || h || para.length){ closePara(); h+=`<div class="gap" data-line="${i}"></div>`; }
  }
  closePara(); closeList();
  return h || '<p class="mn-empty">Escribe aquí tus apuntes…</p>';
}
// Títulos para el índice (Ctrl+I): # ## ###, sin contar los que hay dentro de un bloque de código
function headingsOf(text){
  const out=[]; let fence=null;
  text.split("\n").forEach((l,i)=>{
    const f=l.match(/^\s*(`{3,}|~{3,})/);
    if(f){ if(!fence) fence=f[1]; else if(l.trim().startsWith(fence)) fence=null; return; }
    if(fence) return;
    const m=l.match(/^(#{1,3})\s+(.*)$/); if(m&&m[2].trim()) out.push({line:i, lvl:m[1].length, text:m[2].trim()});
  });
  return out;
}
// Copiar el contenido de un bloque de código
function copyCodeBlock(openLine){
  const lines=noteSubject().o.notes.split("\n"), m=(lines[openLine]||"").match(/^\s*(`{3,}|~{3,})/); if(!m) return;
  const out=[]; for(let j=openLine+1;j<lines.length && !lines[j].trim().startsWith(m[1]);j++) out.push(lines[j]);
  const txt=out.join("\n");
  (navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>mvToast("Código copiado"),()=>{
    const ta=document.createElement("textarea"); ta.value=txt; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); mvToast("Código copiado"); });
}
// ======================================================================
// ---------- Imágenes en las libretas ----------
// En los apuntes, una imagen es una línea propia: ![pie de foto](imagen:ID) (o |p, |m, |g para el tamaño;
// varias en la misma línea forman una fila). Se ve igual al leer y al escribir: ocupa un número exacto de líneas
// de la rejilla, nunca más que un tramo, y si no cabe en lo que queda del tramo pasa entera al siguiente.
// La imagen flota a un lado y el texto ocupa el hueco que deja libre, al leer y al escribir.
// Tamaño y posición son libres: ![pie](imagen:ID|w=0.45,x=0.2) (ancho y posición, en fracción del ancho de la libreta).
// ======================================================================
let attMeta={};                                   // datos de cada imagen: {t: tipo, w: ancho, h: alto}
const IMG_REF=/!\[([^\]\n]*)\]\(imagen:([A-Za-z0-9_-]{1,40})(?:\|([A-Za-z0-9=.,]*))?\)/g;
const IMG_LINE=/^\s*(?:!\[[^\]\n]*\]\(imagen:[A-Za-z0-9_-]{1,40}(?:\|[A-Za-z0-9=.,]*)?\)\s*)+$/;
const isImgLine=l=>IMG_LINE.test(l);
function imgOpts(o){
  const r={}; if(!o) return r;
  const old={p:1/3, m:2/3, g:1}; if(old[o]) { r.w=old[o]; return r; }          // formato anterior (P, M, G)
  for(const kv of o.split(",")){ const [k,v]=kv.split("="), n=parseFloat(v); if((k==="w"||k==="x")&&isFinite(n)) r[k]=Math.min(1,Math.max(0,n)); }
  return r;
}
const imgRefs=l=>[...l.matchAll(IMG_REF)].map(m=>({cap:m[1], id:m[2], ...imgOpts(m[3])}));
const fmt3=n=>String(Math.round(n*1000)/1000);
const imgRefText=r=>{ const o=[]; if(r.w!=null&&r.w<0.999) o.push("w="+fmt3(r.w)); if(r.x!=null) o.push("x="+fmt3(r.x));
  return `![${(r.cap||"").replace(/[\]\n]/g,"")}](imagen:${r.id}${o.length?"|"+o.join(","):""})`; };
const imgLineText=refs=>refs.map(imgRefText).join(" ");
const imgURL=id=>API?API+"adjuntos/"+encodeURIComponent(id):"";
const countImages=t=>t.indexOf("imagen:")<0?0:(t.match(IMG_REF)||[]).length;

// Medidas de un bloque de imagen: filas que ocupa y tamaño y posición de cada imagen
function imgBlock(line, W, lh, L){
  const refs=imgRefs(line), n=Math.max(1,refs.length), gap=10;
  const capRows=refs.some(r=>r.cap.trim())?1:0;
  const maxH=Math.max(lh*2,(L-capRows)*lh-12);                 // nunca más alta que un tramo
  const meta=r=>attMeta[r.id]||{w:4,h:3};
  const fit=(r,w)=>{ const m=meta(r); let h=w*m.h/m.w; if(h>maxH){ w*=maxH/h; h=maxH; } return [Math.min(w,W),h]; };
  let cells;
  if(n>1 && refs.every(r=>r.w==null&&r.x==null)){              // varias recién pegadas: en fila, a partes iguales
    const w=(W-gap*(n-1))/n; cells=refs.map((r,k)=>{ const [cw,h]=fit(r,w); return {...r, w:cw, h, x:k*(w+gap)}; });
  } else cells=refs.map(r=>{ const [w,h]=fit(r,W*(r.w??1)); const x=r.x!=null?Math.min(r.x*W,W-w):(W-w)/2; return {...r, w, h, x:Math.max(0,x)}; });
  const imgH=Math.max(...cells.map(c=>c.h));
  return {cells, imgH, rows:Math.ceil((imgH+12)/lh)+capRows, capRows, maxH, W};
}
function imgBlockHTML(b, srcLine, lh){ return `<div class="mi-row" style="height:${b.rows*lh}px">${cellsHTML(b,lh)}</div>`; }
function cellsHTML(b, lh){
  return b.cells.map((c,k)=>`
    <figure class="mi-cell${NP.newImgs&&NP.newImgs.has(c.id)?" mi-new":""}" data-ref="${k}" style="left:${c.x}px;width:${c.w}px">
      ${attMeta[c.id]?`<img src="${imgURL(c.id)}" alt="${esc(c.cap)}" style="height:${c.h}px" draggable="false" loading="lazy" title="Arrastra para moverla · clic para verla en grande">`
                     :`<div class="mi-missing" style="height:${c.h}px">Imagen no disponible</div>`}
      ${b.capRows?`<figcaption style="height:${lh}px">${esc(c.cap)}</figcaption>`:""}
      <div class="mi-tb">
        <button type="button" data-icap title="Pie de foto">Pie</button>
        <button type="button" data-izoom title="Ver en grande">⤢</button>
        <button type="button" data-idel title="Quitar la imagen" class="danger">×</button>
      </div>
      <span class="mi-rs" title="Arrastra para cambiar el tamaño" aria-hidden="true"></span>
    </figure>`).join("");
}

// ---------- Editor de la libreta ----------
// Al escribir, la libreta es un editor con un bloque por línea de los apuntes. Las imágenes flotan a un lado
// y el texto ocupa el hueco que dejan libre (igual que al leer). Todo sigue en la rejilla de líneas.
const IMG_GAP=14;                                   // separación entre una imagen y el texto de al lado
function edRender(el, src){
  el.innerHTML=src.split("\n").map(l=>isImgLine(l)
    ? `<div class="ln-img" contenteditable="false" data-src="${esc(l)}"></div>`
    : `<div class="ln">${l?esc(l):"<br>"}</div>`).join("");
}
// Líneas que aporta un nodo del editor (normalmente una; un <br> dentro de un bloque es otro salto de línea)
function nodeLines(n){
  if(n.nodeType===3) return n.textContent.replace(/\u00a0/g," ").split("\n");
  if(n.nodeType!==1) return [];
  if(n.classList.contains("ln-img")) return [n.dataset.src||""];
  const parts=[]; let cur="";
  const walk=x=>{ for(const c of x.childNodes){
    if(c.nodeType===3) cur+=c.textContent.replace(/\u00a0/g," ");
    else if(c.nodeName==="BR"){ parts.push(cur); cur=""; }
    else if(c.nodeType===1){ if(/^(DIV|P)$/.test(c.nodeName)&&cur){ parts.push(cur); cur=""; } walk(c); } } };
  walk(n);
  if(cur!==""||!parts.length) parts.push(cur);
  return parts;
}
const edLines=el=>{ const out=[]; for(const n of el.childNodes) out.push(...nodeLines(n)); return out.length?out:[""]; };
const edSource=el=>edLines(el).join("\n");
// Arriba de cada línea de los apuntes, en píxeles desde el principio de la libreta
function edLineTops(el){
  const out=[]; let line=0;
  for(const n of el.childNodes){ const k=nodeLines(n).length; if(!k) continue;
    const top=n.nodeType===1?n.offsetTop:(out.length?out[out.length-1].top+24:0);
    for(let i=0;i<k;i++) out.push({line:line+i, top:top+i*24, node:n});
    line+=k; }
  return out;
}
// Cursor ⇄ línea y columna de los apuntes
function edCaret(el){
  const sel=getSelection(); if(!sel.rangeCount||!el.contains(sel.anchorNode)) return null;
  let node=sel.anchorNode, off=sel.anchorOffset;
  if(node===el){ let line=0; for(let i=0;i<off&&i<el.childNodes.length;i++) line+=nodeLines(el.childNodes[i]).length; return {line, col:0}; }
  let top=node; while(top.parentNode!==el) top=top.parentNode;
  let line=0; for(const n of el.childNodes){ if(n===top) break; line+=nodeLines(n).length; }
  const r=document.createRange(); r.setStart(top,0); r.setEnd(node,off);
  // dentro del bloque, los <br> anteriores cuentan como saltos de línea
  const frag=r.cloneContents(), tmp=document.createElement("div"); tmp.appendChild(frag);
  const before=nodeLines(tmp); return {line:line+before.length-1, col:before[before.length-1].length};
}
const edCaretPos=el=>{ const c=edCaret(el); if(!c) return null; const lines=edLines(el); return lines.slice(0,c.line).reduce((a,l)=>a+l.length+1,0)+c.col; };
function edSetCaret(el,line,col){
  let li=0, target=null;
  for(const n of el.childNodes){ const k=nodeLines(n).length; if(line<li+k){ target=n; break; } li+=k; }
  if(!target){ target=el.lastChild; col=Infinity; }
  if(target&&target.nodeType===1&&target.classList.contains("ln-img")){ target=target.nextSibling||target.previousSibling; col=0; }
  if(!target) return;
  const r=document.createRange();
  if(target.nodeType===3) r.setStart(target,Math.min(col,target.length));
  else {
    const tw=document.createTreeWalker(target,NodeFilter.SHOW_TEXT); let t, last=null, rest=col, done=false;
    while((t=tw.nextNode())){ last=t; if(rest<=t.length){ r.setStart(t,rest); done=true; break; } rest-=t.length; }
    if(!done){ if(last) r.setStart(last,last.length); else r.setStart(target,0); }
  }
  r.collapse(true); const sel=getSelection(); sel.removeAllRanges(); sel.addRange(r);
}

// ---- Imágenes flotantes: a un lado, con el texto en el hueco libre ----
function floatHTML(b, lh, W){
  let side="left", ml=0, mr=0, fw=W, shift=0;
  if(b.cells.length===1){ const c=b.cells[0], toRight=c.x+c.w/2<W/2;   // si la imagen está a la izquierda, el texto va a su derecha
    const free=toRight?W-(c.x+c.w)-IMG_GAP:c.x-IMG_GAP;
    if(free>=80){ fw=c.w; if(toRight){ side="left"; ml=c.x; mr=IMG_GAP; } else { side="right"; mr=W-c.x-c.w; ml=IMG_GAP; } shift=c.x; } }
  const cells=b.cells.map(c=>({...c, x:c.x-shift}));
  return {html:cellsHTML({...b, cells},lh), style:`float:${side};width:${fw}px;height:${b.rows*lh}px;margin:0 ${mr}px 0 ${ml}px`, rows:b.rows};
}
function renderFloats(el){
  const anchors=el.querySelectorAll(".ln-img"); if(!anchors.length) return;
  const lh=parseFloat(getComputedStyle(el).lineHeight)||24, L=Math.max(3,Math.round(NP.pageH/lh)), W=el.clientWidth;
  anchors.forEach(a=>{ const f=floatHTML(imgBlock(a.dataset.src,W,lh,L),lh,W);
    a.innerHTML=`<div class="mi-float" data-rows="${f.rows}" style="${f.style}">${f.html}</div>`; });
  layoutFloats(el);
}
// Ninguna imagen cruza el salto entre tramos: si no cabe en lo que queda, baja entera al siguiente
function layoutFloats(el){
  const fl=[...el.querySelectorAll(".mi-float")]; if(!fl.length) return;
  const lh=parseFloat(getComputedStyle(el).lineHeight)||24, L=Math.max(3,Math.round(NP.pageH/lh));
  fl.forEach(f=>{ f.style.marginTop="0px"; });
  const base=()=>el.getBoundingClientRect().top-el.scrollTop;
  for(const f of fl){
    const row=Math.round((f.getBoundingClientRect().top-base())/lh), rows=+f.dataset.rows, inT=row%L;
    if(inT && inT+rows>L) f.style.marginTop=(L-inT)*lh+"px";
  }
}
// Línea de los apuntes de una imagen (al leer la lleva escrita; al escribir, por su sitio en el editor)
function hostLine(host){
  const ed=host.closest("#mn-text");
  if(!ed) return +host.dataset.line;
  let line=0; for(const n of ed.childNodes){ if(n===host) break; line+=nodeLines(n).length; } return line;
}

// ---- Teclado y entrada del editor ----
function edKeydown(e){
  const el=NP.el, mod=e.ctrlKey||e.metaKey;
  if(mod && /^[bu]$/i.test(e.key)){ e.preventDefault(); return; }       // sin negritas ni subrayados del navegador
  if(e.key!=="Backspace"&&e.key!=="Delete") return;
  const sel=getSelection(); if(!sel.isCollapsed) return;
  const c=edCaret(el); if(!c) return;
  const lines=edLines(el);
  // Retroceso al principio de la línea que hay tras una imagen, o Supr al final de la de antes: se quita la imagen
  let anchor=null;
  const tops=edLineTops(el), here=tops[c.line]&&tops[c.line].node;
  if(e.key==="Backspace"&&c.col===0&&here&&here.previousSibling&&here.previousSibling.classList&&here.previousSibling.classList.contains("ln-img")) anchor=here.previousSibling;
  if(e.key==="Delete"&&c.col===lines[c.line].length&&here&&here.nextSibling&&here.nextSibling.classList&&here.nextSibling.classList.contains("ln-img")) anchor=here.nextSibling;
  if(!anchor) return;
  e.preventDefault();
  const r=document.createRange(); r.selectNode(anchor); sel.removeAllRanges(); sel.addRange(r);
  document.execCommand("delete");
  mvToast("Imagen quitada (Ctrl+Z la devuelve)");
}
function edBeforeInput(e){
  const t=e.inputType||"";
  if(t.startsWith("format")||t==="insertFromDrop"||t==="deleteByDrag"){ e.preventDefault(); return; }
  if(t.startsWith("insert") && (NP.srcLen||0)+((e.data||"").length||1)>LIMITE_LIBRETA){ e.preventDefault(); noteCount(LIMITE_LIBRETA); }
}
// Pegar texto: siempre como texto sin formato, una línea por párrafo (y deshacible con Ctrl+Z)
function edPasteText(text){
  const el=NP.el, lines=text.replace(/\r\n?/g,"\n").split("\n");
  if((NP.srcLen||0)+text.length>LIMITE_LIBRETA){ noteCount(LIMITE_LIBRETA); return; }
  if(lines.length>400){                                                   // textos enormes: de una vez
    const c=edCaret(el)||{line:0,col:0}, src=edLines(el), cur=src[c.line]||"";
    src.splice(c.line,1,cur.slice(0,c.col)+lines[0],...lines.slice(1,-1),lines[lines.length-1]+cur.slice(c.col));
    const s=noteSubject(); mRemember(); s.o.notes=src.join("\n"); save();
    NP.pendingCaret={line:c.line+lines.length-1, col:lines[lines.length-1].length}; renderMapNote(); return;
  }
  document.execCommand("insertText",false,lines[0]);
  for(const l of lines.slice(1)){ document.execCommand("insertParagraph"); if(l) document.execCommand("insertText",false,l); }
}

// ---- Añadir imágenes: comprimir, guardar y colocar en los apuntes ----
async function compressImage(file){
  const bmp=await createImageBitmap(file);
  if(file.type==="image/gif" && file.size<8e6) return {blob:file, type:"image/gif", w:bmp.width, h:bmp.height};
  const k=Math.min(1,2000/Math.max(bmp.width,bmp.height)), w=Math.max(1,Math.round(bmp.width*k)), h=Math.max(1,Math.round(bmp.height*k));
  const cv=document.createElement("canvas"); cv.width=w; cv.height=h; cv.getContext("2d").drawImage(bmp,0,0,w,h);
  let blob=await new Promise(r=>cv.toBlob(r,"image/webp",0.9));
  if(!blob||blob.type!=="image/webp") blob=await new Promise(r=>cv.toBlob(r,"image/jpeg",0.9));
  return {blob, type:blob.type, w, h};
}
const blobToBase64=b=>new Promise((ok,ko)=>{ const r=new FileReader(); r.onload=()=>ok(String(r.result).split(",")[1]); r.onerror=ko; r.readAsDataURL(b); });
async function uploadImages(files){
  const ids=[];
  for(const f of files){
    const c=await compressImage(f), id=newId("i");
    await api("PUT","adjuntos/"+id,{tipo:c.type, ancho:c.w, alto:c.h, datos:await blobToBase64(c.blob)});
    attMeta[id]={t:c.type, w:c.w, h:c.h}; ids.push(id);
  }
  return ids;
}
// where: {line: línea de los apuntes tras la que va la imagen} o {caret: posición en los apuntes}
async function addImagesToNote(files, where){
  files=[...files].filter(f=>/^image\/(png|jpeg|webp|gif|bmp)$/.test(f.type)); if(!files.length) return false;
  if(!online||!API){ mvToast("Para añadir imágenes, abre Ascenso con su servidor (necesitan la base de datos)."); return true; }
  const s=noteSubject(); if(!s.o) return true;
  let ids; try{ ids=await uploadImages(files); }catch(err){ mvToast("No se pudo guardar la imagen: "+err.message); return true; }
  // Una sola imagen se pega a su tamaño natural (una captura pequeña no se agranda); varias, en fila
  const Wn=(NP.el&&NP.el.clientWidth)||700, dpr=window.devicePixelRatio||1;
  const marker=ids.length===1
    ? imgRefText({cap:"", id:ids[0], w:Math.min(1,(attMeta[ids[0]].w/dpr)/Wn), x:where&&where.x!=null?Math.min(Math.max(0,where.x-(attMeta[ids[0]].w/dpr)/Wn/2),1):undefined})
    : ids.map(id=>`![](imagen:${id})`).join(" ");
  const lines=s.o.notes.split("\n");
  let at;                                                  // índice de la línea nueva
  if(where && where.caret!=null){
    let rest=where.caret, li=0; while(li<lines.length-1 && rest>lines[li].length){ rest-=lines[li].length+1; li++; }
    if(rest===0 && lines[li].trim()){ at=li; }             // al principio de una línea con texto: delante
    else if(rest>=lines[li].length){ at=li+1; }            // al final de una línea: detrás
    else { lines.splice(li,1,lines[li].slice(0,rest),lines[li].slice(rest)); at=li+1; }
  } else at=where&&where.line!=null?Math.min(lines.length,where.line+1):lines.length;
  if(lines.length===1&&lines[0]==="") { lines[0]=marker; at=0; } else lines.splice(at,0,marker);
  // Siempre hay una línea de texto antes y después, para poder escribir alrededor de la imagen
  if(at===0){ lines.unshift(""); at=1; }
  if(at===lines.length-1) lines.push("");
  mRemember(); s.o.notes=lines.join("\n").slice(0,LIMITE_LIBRETA); save();
  NP.pendingCaret={line:at+1, col:0};
  NP.newImgs=new Set(ids); setTimeout(()=>{ NP.newImgs=null; },1600);   // un destello para ver dónde ha quedado
  renderMapNote(); if(MG) mgDraw();
  mvToast(ids.length===1?"Imagen añadida":ids.length+" imágenes añadidas");
  return true;
}
// Pegar (Ctrl+V) una captura o una imagen copiada
bvBody.addEventListener("paste",e=>{
  if(!curMapId()||!e.target.closest||!e.target.closest("#mv-note")) return;
  const files=[...(e.clipboardData&&e.clipboardData.files||[])].filter(f=>f.type.startsWith("image/"));
  const ed=document.getElementById("mn-text"), inEd=ed&&ed.contains(e.target);
  if(!files.length){                                       // texto: sin formato
    if(inEd){ e.preventDefault(); e.stopPropagation(); edPasteText(e.clipboardData.getData("text/plain")||""); }
    return;
  }
  e.preventDefault(); e.stopPropagation();
  const p=inEd?edCaretPos(ed):null;
  addImagesToNote(files,p!=null?{caret:p}:{line:hoverSrcLine()??lastVisibleSrcLine()});
});
// Con el foco en el mapa, una imagen pegada va a la libreta que se ve al lado
document.addEventListener("paste",e=>{
  if(!mapActive()||isTyping()) return;
  const files=[...(e.clipboardData&&e.clipboardData.files||[])].filter(f=>f.type.startsWith("image/"));
  if(!files.length) return;
  e.preventDefault(); e.stopImmediatePropagation();
  addImagesToNote(files,{line:hoverSrcLine()??lastVisibleSrcLine()});
},true);
// Línea de los apuntes bajo el ratón, si está sobre la libreta (para pegar justo ahí)
let noteHover=null;
bvBody.addEventListener("pointermove",e=>{ const b=e.target.closest&&e.target.closest("#mn-body"); noteHover=b?{y:e.clientY, t:performance.now()}:null; });
function hoverSrcLine(){
  if(!noteHover||performance.now()-noteHover.t>8000||!NP.el) return null;
  const c=lineTops().filter(t=>t.top-NP.el.scrollTop<=noteHover.y-NP.el.getBoundingClientRect().top);
  return c.length?c[c.length-1].line:null;
}
function lastVisibleSrcLine(){
  const el=NP.el; if(!el) return null;
  if(el.id==="mn-text"){ let li=null; for(const t of edLineTops(el)) if(t.top<el.scrollTop+NP.pageH) li=t.line; return li; }
  let line=null; for(const n of el.querySelectorAll("[data-line]")){ if(n.offsetTop<el.scrollTop+NP.pageH) line=+n.dataset.line; } return line;
}
// Arrastrar imágenes desde el Explorador hasta la libreta
bvBody.addEventListener("dragover",e=>{
  if(!curMapId()||!e.target.closest("#mn-body")||![...e.dataTransfer.types].includes("Files")) return;
  e.preventDefault(); e.dataTransfer.dropEffect="copy"; document.getElementById("mn-body").classList.add("dropping");
});
bvBody.addEventListener("dragleave",e=>{ const b=document.getElementById("mn-body"); if(b&&!b.contains(e.relatedTarget)) b.classList.remove("dropping"); });
bvBody.addEventListener("drop",e=>{
  const body=e.target.closest&&e.target.closest("#mn-body"); if(!curMapId()||!body) return;
  e.preventDefault(); body.classList.remove("dropping");
  const el=NP.el; let line=null;
  if(el.id==="mn-text"){ const y=e.clientY-el.getBoundingClientRect().top+el.scrollTop; for(const t of edLineTops(el)) if(t.top<=y) line=t.line; }
  else { for(const n of el.querySelectorAll("[data-line]")){ if(n.getBoundingClientRect().top<=e.clientY) line=+n.dataset.line; } }
  const W=el.clientWidth; addImagesToNote(e.dataTransfer.files,{line, x:W?(e.clientX-el.getBoundingClientRect().left)/W:null});
});
// Botón «Imagen» de la libreta (en el móvil abre también la cámara)
bvBody.addEventListener("change",e=>{
  if(e.target.id!=="mn-file") return;
  const ed=document.getElementById("mn-text"), p=ed?edCaretPos(ed):null;
  addImagesToNote(e.target.files, p!=null?{caret:p}:{line:lastVisibleSrcLine()});
  e.target.value="";
});

// ---- Barra de cada imagen: pie, ampliar y quitar ----
function editImageRef(srcLine, k, fn){
  const s=noteSubject(); if(!s.o) return;
  const lines=s.o.notes.split("\n"), refs=imgRefs(lines[srcLine]||""); if(!refs[k]) return;
  const r=fn(refs[k]); if(r===null) refs.splice(k,1); else refs[k]=r;
  mRemember();
  if(refs.length) lines[srcLine]=imgLineText(refs); else lines.splice(srcLine,1);
  s.o.notes=lines.join("\n"); save(); renderMapNote(); if(MG) mgDraw();
}
bvBody.addEventListener("click",e=>{
  const tb=e.target.closest&&e.target.closest(".mi-tb"), cell=e.target.closest&&e.target.closest(".mi-cell");
  if(!cell) return;
  e.stopImmediatePropagation();
  if(!tb) return;                        // pulsar la imagen se gestiona al soltar el ratón (ampliar o mover)
  const host=cell.closest(".ln-img"), srcLine=hostLine(host), k=+cell.dataset.ref;
  if(e.target.closest("[data-idel]")){ editImageRef(srcLine,k,()=>null); mvToast("Imagen quitada"); return; }
  if(e.target.closest("[data-izoom]")){ const img=cell.querySelector("img"); if(img) openLightbox(img.src,img.alt); return; }
  if(e.target.closest("[data-icap]")){
    const cur=imgRefs(noteSubject().o.notes.split("\n")[srcLine]||"")[k]; if(!cur) return;
    const inp=document.createElement("input"); inp.type="text"; inp.className="mi-capin"; inp.value=cur.cap; inp.placeholder="Pie de foto…"; inp.maxLength=200;
    cell.appendChild(inp); inp.focus();
    let done=false; const fin=ok=>{ if(done) return; done=true; const v=inp.value.trim(); inp.remove(); if(ok && v!==cur.cap) editImageRef(srcLine,k,r=>({...r,cap:v})); };
    inp.addEventListener("keydown",ev=>{ ev.stopPropagation(); if(ev.key==="Enter"){ ev.preventDefault(); fin(true); } else if(ev.key==="Escape"){ ev.preventDefault(); fin(false); } });
    inp.addEventListener("blur",()=>fin(true));
  }
},true);

// ---- Mover y cambiar el tamaño con el ratón ----
// Arrastrar la imagen la lleva a cualquier sitio de la libreta (a cualquier línea y a cualquier altura horizontal);
// arrastrar su esquina cambia el tamaño, sin pasar nunca del ancho de la libreta ni del alto de un tramo.
// Sitios posibles donde dejar una imagen: el principio de cada línea de los apuntes (y el final)
function lineTops(){
  const el=NP.el; if(!el) return [];
  const out=[], seen=new Set();
  if(el.id==="mn-text"){
    const t=edLineTops(el); t.forEach(x=>out.push({line:x.line, top:x.top}));
    out.push({line:t.length, top:el.scrollHeight-(parseFloat(el.style.paddingBottom)||0)});
  } else {
    const base=el.getBoundingClientRect().top-el.scrollTop;
    for(const n of el.querySelectorAll("[data-line]")){ const ln=+n.dataset.line; if(seen.has(ln)) continue; seen.add(ln);
      out.push({line:ln, top:n.getBoundingClientRect().top-base}); }
    const last=el.lastElementChild; out.push({line:noteSubject().o.notes.split("\n").length, top:last?last.getBoundingClientRect().bottom-base:0});
  }
  return out.sort((a,b)=>a.top-b.top);
}
let IMGD=null;
bvBody.addEventListener("pointerdown",e=>{
  const t=e.target;
  // En escritura, pulsar una imagen o el botón «+ Imagen» no debe sacar el foco de la caja de texto
  if(t.closest&&(t.closest("#mn-text .ln-img")||t.closest(".mn-addimg"))&&!t.closest("input")) e.preventDefault();
  const cell=t.closest&&t.closest(".mi-cell"); if(!cell||e.button!==0||t.closest(".mi-tb")||t.closest("input")) return;
  const host=cell.closest(".ln-img"), body=document.getElementById("mn-body"); if(!host||!body||!NP.el) return;
  e.preventDefault();
  const r=cell.getBoundingClientRect(), img=cell.querySelector("img,.mi-missing"), a=attMeta[imgRefs(host.dataset.src||"")[+cell.dataset.ref]?.id]||{w:4,h:3};
  IMGD={mode:t.closest(".mi-rs")?"resize":"move", cell, img, host, srcLine:hostLine(host), k:+cell.dataset.ref,
        x0:e.clientX, y0:e.clientY, gx:e.clientX-r.left, gy:e.clientY-r.top, w0:r.width, left0:r.left-NP.el.getBoundingClientRect().left,
        ratio:a.h/a.w, moved:false, edgeT:0};
  document.addEventListener("pointermove",imgDragMove);
  document.addEventListener("pointerup",imgDragEnd,{once:true});
},true);
function noteGeom(){ const el=NP.el, lh=parseFloat(getComputedStyle(el).lineHeight)||24; return {el, W:el.clientWidth, lh, L:Math.round(NP.pageH/lh), maxH:(Math.round(NP.pageH/lh))*lh-12-lh}; }
function imgDragMove(e){
  const d=IMGD; if(!d) return;
  if(!d.moved){ if(Math.hypot(e.clientX-d.x0,e.clientY-d.y0)<4) return; d.moved=true; document.body.classList.add("img-dragging");
    if(d.mode==="move"){
      d.ghost=d.cell.cloneNode(true); d.ghost.classList.add("mi-ghost"); d.ghost.querySelectorAll(".mi-tb,.mi-rs").forEach(n=>n.remove());
      Object.assign(d.ghost.style,{left:"0",top:"0",width:d.w0+"px"}); document.body.appendChild(d.ghost);
      d.cell.classList.add("mi-moving");
      d.mark=document.createElement("div"); d.mark.className="mi-drop"; document.getElementById("mn-body").appendChild(d.mark);
      d.tops=lineTops();
    } }
  const g=noteGeom();
  if(d.mode==="resize"){
    // Mantiene la proporción; no pasa del ancho libre a su derecha ni del alto de un tramo
    const maxW=Math.min(g.W-d.left0, g.maxH/d.ratio), w=Math.max(60,Math.min(maxW,d.w0+(e.clientX-d.x0)));
    d.w=w; d.cell.style.width=w+"px"; if(d.img) d.img.style.height=w*d.ratio+"px";
    d.cell.classList.add("mi-resizing"); return;
  }
  // Mover: la imagen sigue al ratón; la marca muestra dónde quedará (al principio de la línea más cercana)
  d.ghost.style.transform=`translate(${e.clientX-d.gx}px,${e.clientY-d.gy}px)`;
  const er=g.el.getBoundingClientRect(), topY=e.clientY-d.gy-er.top+g.el.scrollTop;
  let best=d.tops[0]; for(const t of d.tops) if(Math.abs(t.top-topY)<Math.abs(best.top-topY)) best=t;
  d.target=best.line; d.x=Math.max(0,Math.min(g.W-d.w0,e.clientX-d.gx-er.left));
  Object.assign(d.mark.style,{top:(best.top-g.el.scrollTop)+"px", left:d.x+"px", width:d.w0+"px"});
  d.mark.hidden=best.top-g.el.scrollTop<0||best.top-g.el.scrollTop>NP.pageH;
  // Si el borde de arriba de la imagen sale por debajo del tramo (o por encima), pasa al siguiente (o al anterior)
  const now=performance.now(), gt=e.clientY-d.gy-er.top, edge=gt<-g.lh?-1:gt>NP.pageH-4?1:0;
  if(edge && now-d.edgeT>750){ d.edgeT=now; npGoScreen(NP.screen+edge); setTimeout(()=>{ if(IMGD===d) d.tops=lineTops(); },450); }
}
function imgDragEnd(e){
  const d=IMGD; IMGD=null; document.removeEventListener("pointermove",imgDragMove); document.body.classList.remove("img-dragging");
  if(!d) return;
  if(!d.moved){ if(d.mode==="move"&&d.img&&d.img.tagName==="IMG") openLightbox(d.img.src,d.img.alt); return; }
  const g=noteGeom();
  if(d.mode==="resize"){
    const cells=currentCells(d.srcLine,g);
    cells.forEach((c,i)=>{ c.w=c.w/g.W; c.x=c.x/g.W; if(i===d.k){ c.w=d.w/g.W; c.x=Math.min(c.x,1-c.w); } });
    commitCells(d.srcLine,cells); return;
  }
  if(d.ghost) d.ghost.remove(); if(d.mark) d.mark.remove();
  if(d.target==null){ renderMapNote(); return; }
  moveImage(d.srcLine,d.k,d.target,d.x/g.W,d.w0/g.W);
}
// Posiciones actuales (en píxeles) de las imágenes de una línea
function currentCells(srcLine,g){
  const line=noteSubject().o.notes.split("\n")[srcLine]||"";
  return imgBlock(line,g.W,g.lh,g.L).cells.map(c=>({cap:c.cap, id:c.id, w:c.w, x:c.x}));
}
function commitCells(srcLine,cells){
  const s=noteSubject(), lines=s.o.notes.split("\n");
  mRemember(); lines[srcLine]=imgLineText(cells); s.o.notes=lines.join("\n"); save(); renderMapNote();
}
function moveImage(srcLine,k,before,xFrac,wFrac){
  const s=noteSubject(), lines=s.o.notes.split("\n"), g=noteGeom();
  // Las demás imágenes de esa línea conservan su sitio
  const cells=currentCells(srcLine,g).map(c=>({...c, w:c.w/g.W, x:c.x/g.W}));
  const moved={...cells[k], w:wFrac, x:Math.min(xFrac,1-wFrac)}; cells.splice(k,1);
  if(lines.length>1 && (before===srcLine||before===srcLine+1) && !cells.length){   // misma línea: solo cambia de lado
    mRemember(); lines[srcLine]=imgLineText([moved]); s.o.notes=lines.join("\n"); save(); renderMapNote(); return;
  }
  mRemember();
  if(cells.length) lines[srcLine]=imgLineText(cells); else { lines.splice(srcLine,1); if(before>srcLine) before--; }
  before=Math.max(0,Math.min(before,lines.length));
  lines.splice(before,0,imgLineText([moved]));
  if(before===0){ lines.unshift(""); before++; }
  if(before===lines.length-1) lines.push("");
  s.o.notes=lines.join("\n"); save();
  NP.newImgs=new Set([moved.id]); setTimeout(()=>{ NP.newImgs=null; },1600);
  renderMapNote(); if(MG) mgDraw();
}

// ---- Ver una imagen en grande: rueda para el zoom, arrastrar para moverla, Esc para cerrar ----
function openLightbox(src,alt){
  const lb=document.createElement("div"); lb.className="lbx"; lb.setAttribute("role","dialog"); lb.setAttribute("aria-label","Imagen ampliada");
  lb.innerHTML=`<img alt=""><p class="lbx-cap"></p><button type="button" class="lbx-x" aria-label="Cerrar">×</button>`;
  const im=lb.querySelector("img"); im.src=src; im.alt=alt||""; lb.querySelector(".lbx-cap").textContent=alt||"";
  let z=1, x=0, y=0, drag=null;
  const apply=()=>{ im.style.transform=`translate(${x}px,${y}px) scale(${z})`; };
  lb.addEventListener("wheel",e=>{ e.preventDefault(); z=Math.min(8,Math.max(1,z*(e.deltaY<0?1.15:1/1.15))); if(z===1){ x=0; y=0; } apply(); },{passive:false});
  im.addEventListener("pointerdown",e=>{ e.preventDefault(); drag={sx:e.clientX-x, sy:e.clientY-y, moved:false}; im.setPointerCapture(e.pointerId); });
  im.addEventListener("pointermove",e=>{ if(!drag) return; x=e.clientX-drag.sx; y=e.clientY-drag.sy; drag.moved=true; apply(); });
  im.addEventListener("pointerup",()=>{ drag=null; });
  im.addEventListener("dblclick",()=>{ z=z>1?1:2.5; if(z===1){ x=0; y=0; } apply(); });
  const close=()=>{ lb.remove(); document.removeEventListener("keydown",onKey,true); };
  // Mientras está abierta, el teclado no escribe en la libreta de detrás; Esc la cierra
  const onKey=e=>{ e.stopPropagation(); e.preventDefault(); if(e.key==="Escape") close(); };
  document.addEventListener("keydown",onKey,true);
  lb.addEventListener("click",e=>{ if(e.target===lb||e.target.closest(".lbx-x")) close(); });
  document.body.appendChild(lb);   // sin mover el foco: si se estaba escribiendo, se sigue escribiendo al cerrarla
}

function renderMapNote(){
  NP.rerendering=true;
  try{ renderMapNoteNow(); } finally { NP.rerendering=false; }
}
function renderMapNoteNow(){
  const box=document.getElementById("mv-note"); if(!box) return;
  const many=selIds();
  if(many.length>1){
    if(NP.ro) NP.ro.disconnect(); NP.el=null;
    box.innerHTML=`<div class="mn-multi">
      <h2>${many.length} nodos seleccionados</h2>
      <p class="mn-multi-list">${many.map(id=>esc(state.mnodes[id].title)).join(" · ")}</p>
      <div class="mn-meta"><span>Color para todos</span>
        <button type="button" class="sw auto" data-mcolor="" aria-label="Automático: el acento del mapa" title="Automático: el acento del mapa"></button>
        ${M_COLORS.map(cc=>`<button type="button" class="sw" data-mcolor="${cc}" style="--c:${cc}" aria-label="Color"></button>`).join("")}</div>
      <ul class="mn-multi-tips">
        <li>Arrástralos juntos, o suéltalos encima de otro nodo para meterlos dentro.</li>
        <li><kbd>Ctrl</kbd>+<kbd>C</kbd> / <kbd>Ctrl</kbd>+<kbd>X</kbd> para copiarlos o cortarlos, y <kbd>Ctrl</kbd>+<kbd>V</kbd> para pegarlos aquí o en otro mapa.</li>
        <li><kbd>Supr</kbd> para eliminarlos · clic derecho para más opciones.</li>
      </ul>
      <div class="eacts"><button type="button" class="add alt" data-mmove>Mover a…</button><button type="button" class="add alt" data-mdel>Eliminar</button></div>
    </div>`;
    return;
  }
  const s=noteSubject(); if(!s.o) return;
  const ch=childrenIndex();
  const c = s.kind==="map" ? Object.values(state.mnodes).filter(n=>n.map===s.id).length : descCount(s.id,ch);
  const meta = (c?`${c} ${c===1?"nodo":"nodos"} dentro`:"Sin subnodos") + (s.kind==="node"?` · brillo ${GLOW_NAMES[glowLevel(nodeLoad(s.id,ch))]}`:"");
  const colors = s.kind==="node" ? `<span class="mn-sp"></span><span>Color</span>
      <button type="button" class="sw auto" data-ncolor="" aria-pressed="${!s.o.color}" aria-label="Automático: el acento del mapa" title="Automático: el acento del mapa"></button>
      ${M_COLORS.map(cc=>`<button type="button" class="sw" data-ncolor="${cc}" aria-pressed="${cc===s.o.color}" style="--c:${cc}" aria-label="Color del nodo"></button>`).join("")}` : "";
  const addSub = s.kind==="node" && s.id===mapLevel && !(ch[s.id]||[]).length;
  box.innerHTML=`<div class="mn-head">
      <input type="text" class="mn-title" id="mn-title" maxlength="${s.kind==="map"?80:120}" aria-label="Título">
      <label class="mn-page" title="Escribe un número para ir a esa página">Página
        <input type="number" id="mn-pg" min="1" value="1" aria-label="Página actual"> de <b id="mn-pgs">1</b></label>
    </div>
    <div class="mn-meta"><span>${meta}</span><span class="mn-key">Ctrl+I: índice</span><label class="mn-addimg" title="Añadir imágenes (también puedes pegarlas con Ctrl+V o arrastrarlas)">+ Imagen<input type="file" id="mn-file" accept="image/*" multiple hidden></label><span class="mn-count" id="mn-count" hidden></span>${colors}</div>
    ${addSub?`<button type="button" class="mn-addsub" data-maddsub>+ Añadir subnodos</button>`:""}
    <div class="mn-body" id="mn-body">
      ${mNoteEditing
        ? `<div class="mn-scroll mn-text" id="mn-text" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Libreta" spellcheck="true"></div>`
        : `<div class="mn-scroll mn-md" id="mn-md" tabindex="0">${mdRender(s.o.notes)}</div>`}
      <div class="np-hint" id="np-hint" aria-live="polite"></div>
      <div class="mn-rail" id="mn-rail" role="scrollbar" aria-label="Páginas" aria-controls="${mNoteEditing?"mn-text":"mn-md"}"></div>
      <div class="mn-index" id="mn-index" hidden></div>
    </div>`;
  document.getElementById("mn-title").value=s.o.title;
  if(mNoteEditing){ const ed=document.getElementById("mn-text"); edRender(ed,s.o.notes); NP.srcLen=s.o.notes.length; }
  npMount(s); noteCount(s.o.notes.length);
}

// ======================================================================
// ---------- Páginas de la libreta y barra de desplazamiento ----------
// La libreta se divide en páginas (5 veces el alto visible). Cada página es como una hoja: desde ella no se
// ve nada de la siguiente. Ascenso controla el desplazamiento él mismo (la caja no se desplaza sola), así la
// vista nunca se pasa del final de la página:
//  · Dentro de la página, la rueda, el teclado, el dedo o la barra la recorren con suavidad, sin encajes.
//  · Al llegar al final, la hoja se detiene. Si se sigue tirando un poco (un «tirón»), la hoja cede un poco y
//    un aviso indica que se va a pasar de página; al completar el tirón, se pasa a la siguiente con un
//    deslizamiento suave: la nueva hoja empieza arriba del todo. Si se suelta antes, vuelve a su sitio.
//  · Lo que quede del mismo gesto se descarta: para avanzar por la hoja nueva hay que volver a mover la rueda.
//  · Escribiendo, al pasar de la última línea de una página se pasa igual a la siguiente.
// ======================================================================
const SEGS_POR_PAGINA=5;          // tramos (altos de pantalla) por página
const TIRON=150;                  // cuánto hay que seguir tirando en el borde para pasar de página (px de rueda)
const notePage={};                // posición en la que se dejó cada libreta (durante la sesión)
const NP={el:null, key:"", pageH:1, screen:0, screens:1, page:1, pages:1, cp:0, drag:null, ro:null,
          pendingCaret:null, pendingTopLine:null, target:null, expect:null, anim:null, turning:false,
          pull:0, pullDir:0, pullT:null, lock:false, lastWheel:0};
const pageSpan=()=>SEGS_POR_PAGINA*NP.pageH;
function pageBounds(cp){
  const el=NP.el, P=pageSpan(), max=Math.max(0,el.scrollHeight-el.clientHeight), lo=Math.min(cp*P,max);
  return [lo, Math.max(lo,Math.min(lo+P-NP.pageH,max))];
}
// Mover la vista (siempre por aquí, para distinguir nuestros movimientos de los del navegador)
function npRaw(v){ const el=NP.el; NP.expect=v; el.scrollTop=v; NP.expect=el.scrollTop; }
function npStop(){ if(NP.anim){ cancelAnimationFrame(NP.anim); NP.anim=null; } }
// Colocar la vista al instante en «t», dentro de la página que contiene «anchor» (por defecto, la de «t»)
function npSetTop(t, anchor){
  const el=NP.el; if(!el) return;
  npStop(); npElastic(0,true);
  NP.cp=Math.min(NP.pages-1,Math.max(0,Math.floor((anchor??t)/pageSpan())));
  const [lo,hi]=pageBounds(NP.cp); const v=Math.min(hi,Math.max(lo,t));
  npRaw(v); NP.target=v; npUpdate();
}
// Desplazamiento suave hasta «T» (dentro de la página actual)
function npSmoothTo(T){
  const el=NP.el; if(!el) return;
  NP.target=T;
  if(NP.anim) return;
  const step=()=>{
    const cur=el.scrollTop, d=NP.target-cur;
    if(Math.abs(d)<0.6){ npRaw(NP.target); NP.anim=null; npUpdate(); return; }
    npRaw(cur+d*0.24); npUpdate();
    NP.anim=requestAnimationFrame(step);
  };
  NP.anim=requestAnimationFrame(step);
}
// La hoja cede un poco en el borde mientras se tira (y vuelve a su sitio al soltar)
function npElastic(pull, instant){
  const el=NP.el; if(!el) return;
  const k=Math.min(26,pull*0.17), dir=NP.pullDir;
  el.style.transition=instant||pull?"none":"transform .28s cubic-bezier(.2,.8,.2,1)";
  el.style.transform=k?`translateY(${-dir*k}px)`:"";
  const hint=document.getElementById("np-hint");
  if(hint){
    const show=pull>8 && !instant;
    hint.classList.toggle("on",show); hint.classList.toggle("up",dir<0);
    hint.style.setProperty("--p",Math.min(1,pull/TIRON));
    if(show) hint.textContent=dir>0?`Sigue bajando para pasar a la página ${NP.page+1}`:`Sigue subiendo para volver a la página ${NP.page-1}`;
  }
}
function npRelease(){ NP.pull=0; npElastic(0); }
// Pasar de hoja: la vista se desliza exactamente un alto de pantalla, del final de una página al principio de la
// otra (son contiguas), así que el movimiento es continuo y sin saltos
function npTurn(dir){
  const el=NP.el; if(!el||NP.turning) return;
  const cp=NP.cp+dir; if(cp<0||cp>NP.pages-1){ npRelease(); return; }
  npStop(); NP.turning=true; NP.pull=0;
  const from=el.scrollTop, [nlo,nhi]=pageBounds(cp), to=dir>0?nlo:nhi;
  NP.cp=cp; npUpdate();
  el.style.transition="transform .3s cubic-bezier(.2,.8,.2,1)"; el.style.transform="";
  const hint=document.getElementById("np-hint"); if(hint) hint.classList.remove("on");
  const rail=document.getElementById("mn-rail"); if(rail) rail.classList.add("flipping");
  const finish=()=>{ npRaw(to); NP.target=to; NP.turning=false; NP.lock=true; NP.lastWheel=performance.now(); npUpdate();
    if(rail) setTimeout(()=>rail.classList.remove("flipping"),40); };
  if(reduceMotion()){ finish(); return; }
  const t0=performance.now(), dur=440, ease=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
  const step=now=>{ const p=Math.min(1,(now-t0)/dur); npRaw(from+(to-from)*ease(p)); npRail();
    if(p<1) NP.anim=requestAnimationFrame(step); else { NP.anim=null; finish(); } };
  NP.anim=requestAnimationFrame(step);
}
// Un desplazamiento pedido (rueda, teclado, dedo): dentro de la página, suave; en el borde, tirón
function npScrollBy(dy, tiron){
  const el=NP.el; if(!el||NP.turning||!dy) return;
  const [lo,hi]=pageBounds(NP.cp), T=NP.target??el.scrollTop, dir=Math.sign(dy);
  const edge=dir>0?hi:lo, atEdge=Math.abs(T-edge)<0.5;
  if(!atEdge){ npRelease(); npSmoothTo(dir>0?Math.min(hi,T+dy):Math.max(lo,T+dy)); return; }
  if(dir>0?NP.cp>=NP.pages-1:NP.cp<=0){ return; }          // primera o última página: no hay a dónde pasar
  if(NP.pullDir!==dir) NP.pull=0;
  NP.pullDir=dir; NP.pull+=Math.abs(dy); npElastic(NP.pull);
  clearTimeout(NP.pullT); NP.pullT=setTimeout(npRelease,260);   // si se deja de tirar, vuelve a su sitio
  if(NP.pull>=(tiron??TIRON)){ clearTimeout(NP.pullT); npTurn(dir); }
}
function npWheel(e){
  if(e.ctrlKey) return;                                      // Ctrl + rueda: zoom del navegador
  e.preventDefault();
  const now=performance.now();
  // Tras pasar de hoja, el resto del mismo gesto se descarta (hasta una pausa en la rueda)
  if(NP.lock){ if(now-NP.lastWheel<180){ NP.lastWheel=now; return; } NP.lock=false; }
  NP.lastWheel=now;
  const dy=e.deltaMode===1?e.deltaY*24:e.deltaMode===2?e.deltaY*NP.pageH:e.deltaY;
  npScrollBy(dy);
}
// Teclado al leer (la libreta en lectura también se recorre con las flechas, Av Pág, Re Pág, Inicio y Fin)
function npKeys(e){
  if(mNoteEditing||e.ctrlKey||e.altKey||e.metaKey) return;
  const [lo,hi]=pageBounds(NP.cp), map={ArrowDown:48, ArrowUp:-48, PageDown:NP.pageH*0.85, PageUp:-NP.pageH*0.85, " ":NP.pageH*0.85};
  if(e.key==="Home"){ e.preventDefault(); npSmoothTo(lo); return; }
  if(e.key==="End"){ e.preventDefault(); npSmoothTo(hi); return; }
  const dy=map[e.key]; if(!dy) return;
  e.preventDefault(); npScrollBy(e.shiftKey&&e.key===" "?-dy:dy, Math.abs(dy)>100?1:96);
}
// Con el dedo (pantallas táctiles)
function npTouch(el){
  let y=null;
  el.addEventListener("touchstart",e=>{ if(e.touches.length===1) y=e.touches[0].clientY; },{passive:true});
  el.addEventListener("touchmove",e=>{ if(y==null||e.touches.length!==1) return; const ny=e.touches[0].clientY; e.preventDefault(); npScrollBy(y-ny,90); y=ny; },{passive:false});
  el.addEventListener("touchend",()=>{ y=null; if(NP.pull) npRelease(); });
}
// Si quien mueve la vista es el navegador (por ejemplo, para que se vea el cursor al escribir), se respeta dentro
// de la página; si se sale por abajo o por arriba, se pasa de hoja
function npOnScroll(){
  const el=NP.el; if(!el) return;
  const t=el.scrollTop;
  if(NP.expect!=null && Math.abs(t-NP.expect)<1.5){ return; }
  if(NP.turning){ npRaw(NP.expect); return; }
  const [lo,hi]=pageBounds(NP.cp);
  if(t>hi+0.5){ npRaw(hi); if(NP.cp<NP.pages-1) npTurn(1); }
  else if(t<lo-0.5){ npRaw(lo); if(NP.cp>0) npTurn(-1); }
  else { NP.expect=t; NP.target=t; npStop(); }
  npUpdate();
}
function npGoScreen(sc){
  const el=NP.el; if(!el) return;
  sc=Math.min(NP.screens-1,Math.max(0,Math.round(sc)||0));
  npSetTop(sc*NP.pageH);
  if(mNoteEditing) npCaretAt(el.scrollTop);
}
const npGo=page=>npGoScreen((Math.min(NP.pages,Math.max(1,Math.round(page)||1))-1)*SEGS_POR_PAGINA);
// Barra de desplazamiento de la página actual: el carril es solo esta página; el tirador, siempre del mismo tamaño
function npRail(){
  const r=document.getElementById("mn-rail"), el=NP.el; if(!r||!el) return;
  if(!r.firstChild) r.innerHTML='<span class="rl-thumb"><span class="rl-tip"></span></span>';
  const [lo,hi]=pageBounds(NP.cp||0), range=hi-lo, H=r.clientHeight, th=Math.min(H,64);
  const top=range<=1?0:(H-th)*Math.min(1,Math.max(0,(el.scrollTop-lo)/range));
  const thumb=r.firstChild; thumb.style.height=th+"px"; thumb.style.transform=`translateY(${top}px)`;
  r.classList.toggle("full",range<=1);
  thumb.firstChild.textContent=`Página ${NP.page} de ${NP.pages}`;
  r.setAttribute("aria-valuenow",NP.page); r.setAttribute("aria-valuemin",1); r.setAttribute("aria-valuemax",NP.pages);
}

function npMount(s){
  const el=document.getElementById(mNoteEditing?"mn-text":"mn-md"), body=document.getElementById("mn-body");
  if(NP.ro) NP.ro.disconnect();
  npStop(); clearTimeout(NP.pullT);
  Object.assign(NP,{el, key:s.kind+":"+s.id, drag:null, turning:false, pull:0, pullDir:0, lock:false, target:null, expect:null});
  NP.ro=new ResizeObserver(()=>npLayout(true)); NP.ro.observe(body);
  el.addEventListener("scroll",npOnScroll);
  el.addEventListener("wheel",npWheel,{passive:false});
  el.addEventListener("keydown",npKeys);
  npTouch(el);
  if(mNoteEditing){
    // Al escribir, el navegador mantiene el cursor a la vista desplazando lo justo
    el.addEventListener("input",()=>{ layoutFloats(el); npPad(); npUpdate(); });
    el.addEventListener("keydown",edKeydown);
    el.addEventListener("beforeinput",edBeforeInput);
  }
  npLayout(false);
  const view=()=>el.getBoundingClientRect().top;
  if(!mNoteEditing && NP.pendingTopLine!=null){
    // Al salir de la escritura, la línea que estaba arriba de la vista sigue arriba
    const {line, off}=NP.pendingTopLine; NP.pendingTopLine=null;
    const els=[...el.querySelectorAll("[data-line]")].filter(n=>+n.dataset.line<=line);
    const target=els[els.length-1];
    if(target){ const top=target.getBoundingClientRect().top-view()+el.scrollTop; npSetTop(top-off, top); }
  }
  if(mNoteEditing){
    el.focus();
    if(NP.pendingCaret){
      // Al pulsar una línea leyendo, el cursor va justo ahí y esa línea se queda a la misma altura en la pantalla
      const {line,col,y}=NP.pendingCaret; NP.pendingCaret=null;
      const lines=edLines(el), li=line==null?lines.length-1:Math.min(line,lines.length-1);
      edSetCaret(el,li,line==null?Infinity:col);
      const t=edLineTops(el)[Math.max(0,li)];
      if(t && y!=null) npSetTop(t.top-y, t.top);
      else if(t && (t.top<el.scrollTop || t.top>el.scrollTop+NP.pageH-24)) npSetTop(t.top-NP.pageH/2, t.top);
      else npUpdate();
    } else npCaretAt(el.scrollTop);     // si se entra a escribir de otra forma, el cursor va a la primera línea que se ve
  }
}
// Primera línea de los apuntes que se ve en el tramo actual de la escritura
function topLineOfScreen(ed){
  const tops=edLineTops(ed), t=tops.find(x=>x.top>=ed.scrollTop-1)||tops[tops.length-1];
  return t?{line:t.line, off:t.top-ed.scrollTop}:{line:0, off:0};
}
// Línea y columna de los apuntes en el punto pulsado al leer
function caretFromClick(e){
  const box=document.getElementById("mn-md"), el=e.target.closest&&e.target.closest("[data-line]");
  if(!box||!el||!box.contains(el)) return {line:null, col:0};      // fuera del texto: al final
  const line=+el.dataset.line, src=(noteSubject().o.notes.split("\n")[line])||"";
  let rendered="";
  const cp=document.caretRangeFromPoint?document.caretRangeFromPoint(e.clientX,e.clientY)
         :document.caretPositionFromPoint?(p=>p&&{startContainer:p.offsetNode,startOffset:p.offset})(document.caretPositionFromPoint(e.clientX,e.clientY)):null;
  if(cp && el.contains(cp.startContainer)){ const r=document.createRange(); r.setStart(el,0); r.setEnd(cp.startContainer,cp.startOffset); rendered=r.toString(); }
  else rendered=el.textContent;
  // Se recorre la línea original saltando las marcas (#, -, [ ], **, `) para encontrar la misma posición
  const pre=(src.match(/^(#{1,6}\s+|\s*[-*+] \[[ xX]\] |\s*[-*+] |\s*\d+[.)] |>\s?)/)||[""])[0];
  let j=pre.length;
  for(const ch of rendered){
    while(j<src.length && src[j]!==ch && (src[j]==="*"||src[j]==="`")) j++;
    if(j<src.length && src[j]===ch) j++;
  }
  return {line, col:j};
}
function npCaretAt(top){
  const el=NP.el, tops=edLineTops(el), t=tops.find(x=>x.top>=top-1);
  edSetCaret(el,t?t.line:Math.max(0,tops.length-1),0);
}
function npLayout(keep){
  const el=NP.el; if(!el||!document.body.contains(el)) return;
  const body=el.parentElement, avail=body.clientHeight; if(!avail) return;
  const lh=parseFloat(getComputedStyle(el).lineHeight)||24;
  // Cada tramo mide un número exacto de líneas (sirve para contar páginas y para que las imágenes no se partan)
  NP.pageH=Math.max(lh*3, Math.floor(avail/lh)*lh);
  const before=el.scrollTop;
  el.style.height=NP.pageH+"px";
  renderFloats(el);
  npPad();
  NP.pages=Math.max(1,Math.ceil(NP.screens/SEGS_POR_PAGINA));
  npSetTop(keep?before:(notePage[NP.key]||0));     // donde estabas
}
// Relleno al final para que el último tramo también sea un tramo completo
function npPad(){
  const el=NP.el; if(!el) return;
  // Alto del contenido = alto total menos el relleno actual. No se quita el relleno para medir:
  // quitarlo un instante recortaba el desplazamiento y la vista subía de golpe al escribir en el último tramo
  const pad=parseFloat(el.style.paddingBottom)||0, ch=el.scrollHeight-pad;
  NP.screens=Math.max(1,Math.ceil((ch-2)/NP.pageH));
  const np=Math.max(0,NP.screens*NP.pageH-ch);
  if(Math.abs(np-pad)>.5) el.style.paddingBottom=np+"px";
}
// Mientras se escribe, la vista sigue al cursor: siempre se ve el tramo en el que está
function npUpdate(){
  const el=NP.el; if(!el) return;
  NP.pages=Math.max(1,Math.ceil(NP.screens/SEGS_POR_PAGINA));
  NP.cp=Math.min(NP.pages-1,Math.max(0,NP.cp||0));
  NP.page=NP.cp+1;
  NP.screen=Math.min(NP.screens-1,Math.max(0,Math.floor((el.scrollTop+1)/NP.pageH)));
  notePage[NP.key]=el.scrollTop;
  const pg=document.getElementById("mn-pg"), pgs=document.getElementById("mn-pgs");
  if(pg && document.activeElement!==pg){ pg.value=NP.page; pg.max=NP.pages; }
  if(pgs) pgs.textContent=NP.pages;
  npRail();
}
// ---------- Índice (Ctrl+I): los títulos con # de la libreta ----------
let miItems=[], miActive=0;
function toggleIndex(){
  const box=document.getElementById("mn-index"); if(!box) return;
  if(!box.hidden){ closeIndex(); return; }
  const s=noteSubject(), el=NP.el, hs=headingsOf(mNoteEditing?edSource(el):s.o.notes);
  // Página de cada título
  if(mNoteEditing){ const tops=edLineTops(el); hs.forEach(h=>{ h.screen=Math.floor(((tops[h.line]||{}).top||0)/NP.pageH); }); }
  else { const els=[...el.querySelectorAll("h2,h3,h4")]; hs.forEach((h,i)=>{ h.screen=els[i]?Math.floor(els[i].offsetTop/NP.pageH):0; }); }
  hs.forEach(h=>{ h.page=Math.floor(h.screen/SEGS_POR_PAGINA)+1; });
  miItems=hs; miActive=Math.max(0,hs.findIndex(h=>h.screen>=NP.screen));
  box.innerHTML=`<div class="mi-head"><b>Índice</b><input type="text" id="mi-q" placeholder="Filtrar títulos…" aria-label="Filtrar títulos" autocomplete="off"><kbd>Esc</kbd></div>
    <ul class="mi-list" id="mi-list" role="listbox"></ul>`;
  box.hidden=false; miRender(""); document.getElementById("mi-q").focus();
}
function miRender(f){
  const list=document.getElementById("mi-list"); if(!list) return;
  const q=fold(f.trim()), vis=miItems.map((h,i)=>({h,i})).filter(({h})=>!q||fold(h.text).includes(q));
  if(!vis.some(v=>v.i===miActive) && vis.length) miActive=vis[0].i;
  list.innerHTML = vis.length ? vis.map(({h,i})=>`<li><button type="button" class="mi-item lv${h.lvl}${i===miActive?" on":""}" data-mi="${i}" role="option" aria-selected="${i===miActive}">
      <span class="mi-t">${esc(h.text)}</span><span class="mi-p">p. ${h.page}</span></button></li>`).join("")
    : `<li class="mi-empty">${miItems.length?"Ningún título coincide.":"Esta libreta aún no tiene títulos. Empieza una línea con # para crear uno."}</li>`;
  const on=list.querySelector(".on"); if(on) on.scrollIntoView({block:"nearest"});
}
function closeIndex(){ const box=document.getElementById("mn-index"); if(box){ box.hidden=true; box.innerHTML=""; } if(NP.el) NP.el.focus(); }
function miGo(i){
  const h=miItems[i], el=NP.el; if(!h||!el) return;
  closeIndex();
  // Se va al propio título, que queda arriba de la vista
  let top;
  if(mNoteEditing){ el.focus(); edSetCaret(el,h.line,0); const t=edLineTops(el)[h.line]; top=t?t.top:0; }
  else { const n=el.querySelector(`[data-line="${h.line}"]`); top=n?n.getBoundingClientRect().top-el.getBoundingClientRect().top+el.scrollTop:0; }
  npSetTop(Math.max(0,top-4), top);
}
bvBody.addEventListener("click",e=>{
  const it=e.target.closest("[data-mi]"); if(it){ miGo(+it.dataset.mi); return; }
});
bvBody.addEventListener("input",e=>{ if(e.target.id==="mi-q") miRender(e.target.value); });
bvBody.addEventListener("keydown",e=>{
  const t=e.target;
  if(t.id==="mi-q"){
    const vis=[...document.querySelectorAll("#mi-list [data-mi]")].map(b=>+b.dataset.mi), k=vis.indexOf(miActive);
    if(e.key==="ArrowDown"||e.key==="ArrowUp"){ e.preventDefault(); if(vis.length){ miActive=vis[(k+(e.key==="ArrowDown"?1:-1)+vis.length)%vis.length]; miRender(t.value); } }
    else if(e.key==="Enter"){ e.preventDefault(); if(vis.length) miGo(miActive); }
    else if(e.key==="Escape"){ e.preventDefault(); e.stopPropagation(); closeIndex(); }
    return;
  }
  if(t.id==="mn-pg" && e.key==="Enter"){ e.preventDefault(); e.stopPropagation(); npGo(+t.value); t.blur(); }
});
bvBody.addEventListener("change",e=>{ if(e.target.id==="mn-pg") npGo(+e.target.value); });
// Barra: arrastrar el tirador recorre la página actual; pulsar en el carril salta a ese punto de la página.
// La vista se queda donde la dejas; la barra no cambia de página (eso lo hacen la rueda, la escritura o el número)
bvBody.addEventListener("pointerdown",e=>{
  const r=e.target.closest("#mn-rail"); if(!r||!NP.el||e.button!==0) return;
  e.preventDefault(); r.setPointerCapture(e.pointerId);
  const el=NP.el, R=r.getBoundingClientRect(), thumb=r.querySelector(".rl-thumb"), tr=thumb.getBoundingClientRect();
  const [lo,hi]=pageBounds(NP.cp||0), range=hi-lo; if(range<=1) return;
  const free=Math.max(1,R.height-tr.height), onThumb=e.clientY>=tr.top && e.clientY<=tr.bottom;
  const go=t=>{ npStop(); const v=Math.min(hi,Math.max(lo,t)); npRaw(v); NP.target=v; npUpdate(); };
  NP.drag={}; r.classList.add("dragging"); npRelease();
  if(!onThumb) go(lo+Math.min(1,Math.max(0,(e.clientY-R.top-tr.height/2)/free))*range);
  const y0=e.clientY, s0=el.scrollTop;
  const mv=ev=>go(s0+(ev.clientY-y0)*range/free);
  const up=()=>{ r.removeEventListener("pointermove",mv); r.removeEventListener("pointerup",up); r.removeEventListener("pointercancel",up);
    r.classList.remove("dragging"); NP.drag=null; };
  r.addEventListener("pointermove",mv); r.addEventListener("pointerup",up); r.addEventListener("pointercancel",up);
});

// Aviso de espacio: solo aparece al acercarse al límite; al llegar, se avisa en lugar de cortar el texto
function noteCount(len){
  const el=document.getElementById("mn-count"); if(!el) return;
  const left=LIMITE_LIBRETA-len;
  if(len<LIMITE_LIBRETA*0.9){ el.hidden=true; return; }
  el.hidden=false; el.classList.toggle("full",left<=0);
  el.textContent=left<=0?"Libreta llena: sigue en un nodo dentro de este (Tab o «+ Añadir subnodos»)"
                        :`Quedan ${left.toLocaleString("es-ES")} caracteres`;
}
function flushNoteTyping(){ mTyping=false; }
function focusTitle(){ const t=document.getElementById("mn-title"); if(t){ t.focus(); t.select(); } }

// ---- crear, borrar, conectar ----
function createNode(wx,wy,from){
  const mid=curMapId(); if(!mid) return;
  mRemember();
  const wasSolo = mapLevel && !levelNodes(mid,mapLevel).length;
  const id=newId("n");
  state.mnodes[id]={map:mid, parent:mapLevel, title:"Nuevo nodo", color:"", x:wx==null?null:Math.round(wx), y:wy==null?null:Math.round(wy), notes:"", created:new Date().toISOString()};
  if(from) state.mlinks[newId("x")]={a:from, b:id};
  selectOnly(id); mNoteEditing=false; save();
  if(MG&&MG.birth) MG.birth[id]=performance.now();
  mChain={id, from:from||null};          // al poner su nombre, Intro crea otro al mismo nivel
  if(wasSolo) renderBoards(); else { renderMapNote(); mgSettle(); mgDraw(); }
  focusTitle();
  return id;
}
function linkNodes(a,b){
  if(a===b) return;
  if(Object.values(state.mlinks).some(l=>(l.a===a&&l.b===b)||(l.a===b&&l.b===a))) return;
  mRemember(); state.mlinks[newId("x")]={a,b}; save(); mgDraw();
}
function removeNodes(ids){
  const all=new Set(ids), ch=childrenIndex();
  const add=id=>{ for(const k of ch[id]||[]){ all.add(k); add(k); } };
  ids.forEach(add);
  for(const [lid,l] of Object.entries(state.mlinks)) if(all.has(l.a)||all.has(l.b)) delete state.mlinks[lid];
  all.forEach(id=>delete state.mnodes[id]);
}
function askDeleteNode(id){
  const n=state.mnodes[id]; if(!n) return;
  const inside=descCount(id,childrenIndex());
  const doIt=()=>{ mRemember(); removeNodes([id]); clearSel(); save(); renderBoards(); };
  if(!inside && !n.notes.trim()) return doIt();
  mvConfirm(inside ? `¿Eliminar «${n.title}» y ${inside===1?"el nodo":"los "+inside+" nodos"} que contiene?` : `¿Eliminar «${n.title}» y sus apuntes?`, doIt);
}
function mvConfirm(text,ok){
  const box=document.getElementById("mv-confirm"); if(!box) return;
  box.innerHTML=`<span></span><button type="button" class="add" data-cok>Eliminar</button><button type="button" class="add alt" data-cno>Cancelar</button>`;
  box.querySelector("span").textContent=text+" Podrás deshacerlo con Ctrl+Z.";
  box.hidden=false; box.querySelector("[data-cok]").focus();
  box.onclick=e=>{ if(e.target.closest("[data-cok]")){ box.hidden=true; ok(); } else if(e.target.closest("[data-cno]")) box.hidden=true; };
  box.onkeydown=e=>{ if(e.key==="Escape"){ e.stopPropagation(); box.hidden=true; } };
}

// ---- lienzo ----
function mountMap(){
  const cv=document.getElementById("mv-cv"); if(!cv) return;
  if(MG&&MG.ro) MG.ro.disconnect();
  const key=curMapId()+":"+(mapLevel||"");
  MG={cv, ctx:cv.getContext("2d"), W:0, H:0, dpr:window.devicePixelRatio||1, key, f:{}, tmp:null, alpha:0, anim:null,
      drag:null, pan:null, wire:null, menu:null, hover:null};
  const g=document.getElementById("mv-graph");
  const size=()=>{ if(!MG||MG.cv!==cv) return;
    const w=g.clientWidth, h=g.clientHeight, c=mCam[MG.key];
    // Al cambiar el tamaño (ventana o reparto), el centro de la vista se mantiene en su sitio
    if(c && MG.W && w){ c.ox+=(w-MG.W)/2; c.oy+=(h-MG.H)/2; }
    MG.W=w; MG.H=h; cv.width=w*MG.dpr; cv.height=h*MG.dpr; cv.style.width=w+"px"; cv.style.height=h+"px"; mgDraw(); };
  // Se decide antes de medir: al medir se dibuja, y dibujar crearía una cámara por defecto
  const needFit=!mCam[key];
  MG.ro=new ResizeObserver(size); MG.ro.observe(g); size();
  if(needFit){ delete mCam[key]; mgFit(true); mgDraw(); }
  bindCanvas(cv);
  MG.birth={};
  if(key!==lastMountKey){ const t0=performance.now(); levelNodes(curMapId(),mapLevel).forEach(([id],i)=>{ MG.birth[id]=t0+Math.min(i,20)*28; }); lastMountKey=key; }
  mgSettle(); mgDraw(); renderMapNote(); mgIdle();
}
// Cámara del nivel; mientras el lienzo no tiene tamaño (libreta a pantalla completa) no se guarda
const cam=()=>mCam[MG.key]||(MG.W?(mCam[MG.key]={z:1, ox:MG.W/2, oy:MG.H/2}):{z:1, ox:0, oy:0});
const toWorld=(x,y)=>{ const c=cam(); return [(x-c.ox)/c.z,(y-c.oy)/c.z]; };
const posOf=id=>(MG.tmp&&MG.tmp[id])||state.mnodes[id];
function mgFit(silent){
  if(!MG||!MG.W) return;
  const items=levelNodes(curMapId(),mapLevel).map(([id])=>posOf(id)).filter(p=>p.x!=null);
  if(!items.length){ mCam[MG.key]={z:1, ox:MG.W/2, oy:MG.H/2}; if(!silent) mgDraw(); return; }
  const xs=items.map(p=>p.x), ys=items.map(p=>p.y);
  const x0=Math.min(...xs)-60, x1=Math.max(...xs)+60, y0=Math.min(...ys)-50, y1=Math.max(...ys)+70;
  const z=Math.max(.35, Math.min(1.6, MG.W/(x1-x0), MG.H/(y1-y0)));
  mCam[MG.key]={z, ox:MG.W/2-(x0+x1)/2*z, oy:MG.H/2-(y0+y1)/2*z};
  if(!silent) mgDraw();
}
function zoomAt(x,y,k){ const c=cam(), z=Math.min(3,Math.max(.25,c.z*k)); c.ox=x-(x-c.ox)*z/c.z; c.oy=y-(y-c.oy)*z/c.z; c.z=z; c.user=true; mgDraw(); }
// Los nodos sin posición (creados con «+ Nodo» o «Añadir subnodos») se colocan solos, con una pequeña simulación,
// sin mover los que ya tienen sitio; al terminar, su posición se guarda
function mgSettle(){
  if(!MG) return;
  const lv=levelNodes(curMapId(),mapLevel), free=lv.filter(([,n])=>n.x==null);
  if(!free.length) return;
  const placed=lv.filter(([,n])=>n.x!=null);
  const cx=placed.length?placed.reduce((s,[,n])=>s+n.x,0)/placed.length:0, cy=placed.length?placed.reduce((s,[,n])=>s+n.y,0)/placed.length:0;
  MG.tmp={}; free.forEach(([id],i)=>{ const a=i*2.4+Math.random(), r=40+Math.random()*30; MG.tmp[id]={x:cx+Math.cos(a)*r, y:cy+Math.sin(a)*r, vx:0, vy:0}; });
  MG.alpha=1; mgLoop();
}
function mgStep(){
  if(!MG.tmp) return;
  const lv=levelNodes(curMapId(),mapLevel).map(([id])=>id), P=id=>posOf(id), al=MG.alpha;
  for(const id of Object.keys(MG.tmp)){ const a=MG.tmp[id];
    for(const o of lv){ if(o===id) continue; const b=P(o); if(b.x==null) continue; let dx=a.x-b.x, dy=a.y-b.y, d2=dx*dx+dy*dy+.01, d=Math.sqrt(d2), f=2200/d2*al; a.vx+=dx/d*f; a.vy+=dy/d*f; }
  }
  for(const l of Object.values(state.mlinks)){ const ta=MG.tmp[l.a], tb=MG.tmp[l.b]; if(!ta&&!tb) continue;
    const a=P(l.a), b=P(l.b); if(!a||!b||a.x==null||b.x==null) continue;
    let dx=b.x-a.x, dy=b.y-a.y, d=Math.hypot(dx,dy)||1, f=(d-110)*.02*al;
    if(ta){ ta.vx+=dx/d*f; ta.vy+=dy/d*f; } if(tb){ tb.vx-=dx/d*f; tb.vy-=dy/d*f; } }
  for(const t of Object.values(MG.tmp)){ t.x+=t.vx; t.y+=t.vy; t.vx*=.55; t.vy*=.55; }
  MG.alpha*=.96;
  if(MG.alpha<.02){ for(const [id,t] of Object.entries(MG.tmp)) if(state.mnodes[id]){ state.mnodes[id].x=Math.round(t.x); state.mnodes[id].y=Math.round(t.y); }
    MG.tmp=null; save();
    if(!(mCam[MG.key]&&mCam[MG.key].user)) mgFit(true); }
}
function mgLoop(){
  if(!MG||MG.anim) return;
  const tick=()=>{ if(!MG) return; MG.anim=null; mgStep(); const moving=mgDraw(); if((MG.tmp||moving) && !MG.anim) MG.anim=requestAnimationFrame(tick); };
  MG.anim=requestAnimationFrame(tick);
}
function hexA(h,a){ const v=parseInt(h.slice(1),16); return `rgba(${v>>16&255},${v>>8&255},${v&255},${a})`; }
// Animación suave: los nodos flotan unos pocos píxeles, el brillo respira, los hilos del nodo activo llevan
// una pequeña luz y los nodos aparecen con un leve rebote. Se dibuja a 30 imágenes por segundo como mucho,
// se detiene si la ventana no está a la vista y se desactiva si el sistema pide reducir el movimiento.
const reduceMotion=()=>window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const phaseOf=id=>{ let h=0; for(let i=0;i<id.length;i++) h=(h*31+id.charCodeAt(i))%9973; return h/9973*Math.PI*2; };
const easeOutBack=t=>{ const c1=1.4, c3=c1+1; return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2); };
let lastMountKey=null;
function mgIdle(){
  if(reduceMotion()||!MG||MG.idleOn) return;
  const me=MG; me.idleOn=true; let last=0;
  const tick=ts=>{
    // Se detiene al salir del mapa o de la vista (al volver, el mapa se monta de nuevo y la reanuda)
    if(MG!==me||!document.body.contains(me.cv)||boardsView.hidden){ me.idleOn=false; return; }
    if(!document.hidden && !boardsView.hidden && ts-last>=33){ last=ts; mgDraw(); }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function mgDraw(){
  if(!MG||!MG.W||!document.body.contains(MG.cv)) return false;
  const {ctx,W,H,dpr}=MG, c=cam(), mid=curMapId(), m=state.maps[mid]; if(!m) return false;
  const css=getComputedStyle(document.documentElement), v=n=>css.getPropertyValue(n).trim();
  const ink=v("--ink"), muted=v("--muted"), line=v("--line"), font=getComputedStyle(document.body).fontFamily;
  const lv=levelNodes(mid,mapLevel), ids=new Set(lv.map(([id])=>id)), ch=childrenIndex(), selSet=new Set(selIds());
  const links=Object.entries(state.mlinks).filter(([,l])=>ids.has(l.a)&&ids.has(l.b));
  const focus=MG.hover, near=new Set();
  if(focus){ near.add(focus); for(const [,l] of links){ if(l.a===focus) near.add(l.b); if(l.b===focus) near.add(l.a); } }
  const anim=!reduceMotion(), nowMs=performance.now(), now=nowMs/1000;
  const dragging=new Set(MG.drag?MG.drag.ids:[]);
  // Posición animada: un pequeño vaivén distinto para cada nodo (no afecta a la posición guardada)
  const ap=id=>{ const p=posOf(id); if(!anim||p.x==null||dragging.has(id)) return p; const ph=phaseOf(id);
    return {x:p.x+Math.cos(now*.55+ph)*1.6, y:p.y+Math.sin(now*.7+ph*1.3)*2.2}; };
  const birth=id=>{ const bt=MG.birth&&MG.birth[id]; if(!anim||bt==null) return 1; const e=(nowMs-bt)/420;
    if(e>=1){ delete MG.birth[id]; return 1; } return e<=0?0:easeOutBack(e); };
  let moving=false;
  for(const [id] of lv){ const t=focus?(near.has(id)?1:0):1, f=MG.f[id]??1, nf=f+(t-f)*.25; MG.f[id]=Math.abs(t-nf)<.01?t:nf; if(MG.f[id]!==t) moving=true; }
  ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,W,H);
  ctx.setTransform(dpr*c.z,0,0,dpr*c.z,dpr*c.ox,dpr*c.oy);
  const colorOf=n=>n.color||m.color;
  // hilos
  for(const [lid,l] of links){ const a=ap(l.a), b=ap(l.b); if(a.x==null||b.x==null) continue;
    const via=focus&&(l.a===focus||l.b===focus)?focus:(mSel&&(l.a===mSel||l.b===mSel)?mSel:null);
    const on=lid===mSelLink || !!via, vis=Math.min(MG.f[l.a]??1, MG.f[l.b]??1)*Math.min(birth(l.a),birth(l.b),1);
    ctx.globalAlpha=on?1:(.15+.6*vis); ctx.strokeStyle=on?(via?colorOf(state.mnodes[via]):m.color):line;
    ctx.lineWidth=(lid===mSelLink?2.4:on?1.6:1)/c.z; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
    // Una pequeña luz recorre los hilos del nodo activo
    if(on && anim){ const col=via?colorOf(state.mnodes[via]):m.color, from=via&&l.b===via?b:a, to=via&&l.b===via?a:b, u=(now*.45+phaseOf(lid))%1;
      ctx.fillStyle=col; ctx.globalAlpha=.9*Math.sin(u*Math.PI); ctx.beginPath(); ctx.arc(from.x+(to.x-from.x)*u, from.y+(to.y-from.y)*u, 3.2/c.z, 0, 7); ctx.fill(); } }
  if(MG.wire){ const a=ap(MG.wire.from); ctx.globalAlpha=1; ctx.strokeStyle=colorOf(state.mnodes[MG.wire.from]); ctx.setLineDash([5/c.z,5/c.z]); ctx.lineWidth=1.4/c.z;
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(MG.wire.x,MG.wire.y); ctx.stroke(); ctx.setLineDash([]); }
  // nodos
  for(const [id,n] of lv){ const p=ap(id); if(p.x==null) continue;
    const k=birth(id); if(k<1) moving=true; if(k<=0) continue;
    const load=nodeLoad(id,ch), g=glowLevel(load), r=(6+Math.min(10,Math.sqrt(load)*2.3))*k, col=colorOf(n), f=MG.f[id]??1, vis=(.18+.82*f)*Math.min(1,k), hi=id===focus;
    // El brillo respira despacio
    const breath=anim?.82+.18*Math.sin(now*1.25+phaseOf(id)):1;
    for(let i=g;i>0;i--){ ctx.globalAlpha=vis*breath; ctx.fillStyle=hexA(col,.1*(g-i+1)); ctx.beginPath(); ctx.arc(p.x,p.y,r+i*5.5*k,0,7); ctx.fill(); }
    ctx.globalAlpha=vis; ctx.fillStyle=(hi||g>=2||n.color)?col:muted; ctx.beginPath(); ctx.arc(p.x,p.y,r,0,7); ctx.fill();
    if((ch[id]||[]).length){ ctx.strokeStyle=hi?col:muted; ctx.lineWidth=1.3/c.z; ctx.beginPath(); ctx.arc(p.x,p.y,r+3.5,0,7); ctx.stroke(); }
    const sel=selSet.has(id);
    if(sel){ ctx.globalAlpha=1; ctx.strokeStyle=ink; ctx.lineWidth=1.6/c.z; ctx.beginPath(); ctx.arc(p.x,p.y,r+7,0,7); ctx.stroke(); }
    if(MG.dropTarget===id){ ctx.globalAlpha=1; ctx.fillStyle=hexA(col,.18); ctx.beginPath(); ctx.arc(p.x,p.y,r+16,0,7); ctx.fill();
      ctx.strokeStyle=col; ctx.lineWidth=2.4/c.z; ctx.setLineDash([4/c.z,3/c.z]); ctx.beginPath(); ctx.arc(p.x,p.y,r+16,0,7); ctx.stroke(); ctx.setLineDash([]); }
    if(c.z>.6||g>=2||hi||sel||MG.dropTarget===id){ ctx.globalAlpha=vis; ctx.fillStyle=hi||sel?ink:muted; ctx.textAlign="center";
      ctx.font=`${hi||sel?600:500} ${Math.round(13/Math.max(c.z,.75))}px ${font}`; ctx.fillText(n.title,p.x,p.y+r+16); }
  }
  ctx.globalAlpha=1; ctx.setTransform(dpr,0,0,dpr,0,0);
  if(MG.rect){ const R=MG.rect, x=Math.min(R.x0,R.x1), y=Math.min(R.y0,R.y1), w=Math.abs(R.x1-R.x0), h=Math.abs(R.y1-R.y0);
    ctx.fillStyle=hexA(m.color,.08); ctx.fillRect(x,y,w,h); ctx.strokeStyle=m.color; ctx.lineWidth=1; ctx.setLineDash([5,4]); ctx.strokeRect(x+.5,y+.5,w,h); ctx.setLineDash([]); }
  if(MG.dropTarget && state.mnodes[MG.dropTarget]){ ctx.fillStyle=ink; ctx.font=`600 13px ${font}`; ctx.textAlign="left";
    ctx.fillText(`Suelta para meterlo dentro de «${state.mnodes[MG.dropTarget].title}»`,14,24); }
  if(!lv.length){ ctx.fillStyle=muted; ctx.textAlign="center"; ctx.font=`15px ${font}`; ctx.fillText("Doble clic en cualquier sitio para crear el primer nodo",W/2,H/2); }
  if(moving && !MG.idleOn) mgLoop();
  return moving;
}
function hitNode(x,y,skip){
  const c=cam(), [wx,wy]=toWorld(x,y), ch=childrenIndex();
  let best=null, bd=1e9;
  for(const [id] of levelNodes(curMapId(),mapLevel)){ if(skip&&skip.has(id)) continue; const p=posOf(id); if(p.x==null) continue;
    const r=6+Math.min(10,Math.sqrt(nodeLoad(id,ch))*2.3), d=Math.hypot(p.x-wx,p.y-wy);
    if(d<r+8/c.z && d<bd){ bd=d; best=id; } }
  return best;
}
function hitLink(x,y){
  const c=cam(), [wx,wy]=toWorld(x,y), ids=new Set(levelNodes(curMapId(),mapLevel).map(([id])=>id));
  for(const [lid,l] of Object.entries(state.mlinks)){ if(!ids.has(l.a)||!ids.has(l.b)) continue;
    const a=posOf(l.a), b=posOf(l.b); if(a.x==null||b.x==null) continue;
    const dx=b.x-a.x, dy=b.y-a.y, t=Math.max(0,Math.min(1,((wx-a.x)*dx+(wy-a.y)*dy)/(dx*dx+dy*dy||1)));
    if(Math.hypot(a.x+t*dx-wx, a.y+t*dy-wy) < 6/c.z) return lid; }
  return null;
}
function closeMgMenu(){ if(MG&&MG.menu){ MG.menu.remove(); MG.menu=null; } }
function openMgMenu(x,y,items){
  closeMgMenu();
  const g=document.getElementById("mv-graph"), el=document.createElement("div"); el.className="mv-menu"; el.setAttribute("role","menu");
  items.forEach(([t,fn,cls])=>{ const b=document.createElement("button"); b.type="button"; b.textContent=t; if(cls) b.className=cls; b.onclick=()=>{ closeMgMenu(); fn(); }; el.appendChild(b); });
  g.appendChild(el);
  el.style.left=Math.min(x, MG.W-el.offsetWidth-8)+"px"; el.style.top=Math.min(y, MG.H-el.offsetHeight-8)+"px";
  MG.menu=el; const f=el.querySelector("button"); if(f) f.focus();
}
// ---- selección (uno o varios nodos del nivel actual) ----
let mMulti=new Set(), mClip=null, mChain=null;
function selIds(){
  const s=new Set(mMulti); if(mSel) s.add(mSel);
  return [...s].filter(id=>{ const n=state.mnodes[id]; return n && n.map===curMapId() && (n.parent||null)===(mapLevel||null); });
}
function selectOnly(id){ mSel=id||null; mMulti=new Set(id?[id]:[]); mSelLink=null; }
function clearSel(){ mSel=null; mMulti=new Set(); mSelLink=null; }
function selectionChanged(){ mNoteEditing=false; renderMapNote(); mgDraw(); }
const mapActive=()=>!boardsView.hidden && !!curMapId() && !!MG && !cdlg.open;
const isTyping=()=>{ const a=document.activeElement; return !!a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)||a.isContentEditable); };

// ---- avisos breves con «Deshacer» ----
function mvToast(text){
  const g=document.getElementById("mv-graph"); if(!g) return;
  let t=g.querySelector(".mv-toast"); if(!t){ t=document.createElement("div"); t.className="mv-toast"; t.setAttribute("role","status"); g.appendChild(t); }
  t.innerHTML=`<span></span><button type="button">Deshacer</button>`; t.querySelector("span").textContent=text;
  t.querySelector("button").onclick=()=>{ t.remove(); mUndoDo(); };
  clearTimeout(t._h); t._h=setTimeout(()=>t.remove(),4500);
}

// ---- posiciones ----
// Hueco libre alrededor de un nodo, para los nodos creados con Tab o Intro
function spotNear(refId){
  const p=posOf(refId); if(!p||p.x==null) return [null,null];
  const others=levelNodes(curMapId(),mapLevel).map(([id])=>posOf(id)).filter(q=>q&&q.x!=null);
  for(let k=0;k<30;k++){ const a=-Math.PI/2+k*0.62, r=120+Math.floor(k/10)*55, x=p.x+Math.cos(a)*r, y=p.y+Math.sin(a)*r;
    if(others.every(q=>Math.hypot(q.x-x,q.y-y)>72)) return [x,y]; }
  return [p.x+140,p.y];
}
function ensureVisible(id){
  const p=posOf(id); if(!MG||!p||p.x==null) return;
  const c=cam(), sx=p.x*c.z+c.ox, sy=p.y*c.z+c.oy, m=60;
  if(sx<m||sx>MG.W-m||sy<m||sy>MG.H-m){ c.ox+=MG.W/2-sx; c.oy+=MG.H/2-sy; mgDraw(); }
}
// Si lo pegado o creado queda fuera de la vista, se encuadra todo
function revealAll(ids){
  if(!MG) return; const c=cam(), m=40;
  const out=ids.some(id=>{ const p=posOf(id); if(!p||p.x==null) return false; const sx=p.x*c.z+c.ox, sy=p.y*c.z+c.oy; return sx<m||sx>MG.W-m||sy<m||sy>MG.H-m; });
  if(out) mgFit(false);
}
function pastePoint(){
  if(MG.lastPointer){ const [x,y]=MG.lastPointer; if(x>0&&y>0&&x<MG.W&&y<MG.H) return toWorld(x,y); }
  return toWorld(MG.W/2,MG.H/2);
}

// ---- crear nodos encadenados (Tab e Intro) ----
function createNear(refId, linkFrom){
  const [x,y]=refId?spotNear(refId):pastePoint();
  const id=createNode(x,y,linkFrom);
  if(id) ensureVisible(id);
  return id;
}

// ---- borrar varios ----
function askDeleteNodes(ids){
  if(ids.length<=1){ if(ids[0]) askDeleteNode(ids[0]); return; }
  const ch=childrenIndex(), inside=ids.reduce((a,id)=>a+descCount(id,ch),0);
  mvConfirm(`¿Eliminar ${ids.length} nodos${inside?` y ${inside===1?"el nodo":"los "+inside+" nodos"} que contienen`:""}?`,
    ()=>{ mRemember(); removeNodes(ids); clearSel(); save(); renderBoards(); });
}

// ---- mover nodos a otro nivel (arrastrando encima de otro nodo o con «Mover a…») ----
function moveNodes(ids,dest){
  const set=new Set(ids);
  for(const id of ids){ const n=state.mnodes[id]; if(n){ n.parent=dest||null; n.x=null; n.y=null; } }
  // Los hilos solo unen nodos del mismo nivel: se quitan los que unían lo movido con lo que se queda
  for(const [lid,l] of Object.entries(state.mlinks)) if(set.has(l.a)!==set.has(l.b)) delete state.mlinks[lid];
}
function destName(dest){ return dest?`«${state.mnodes[dest].title}»`:`el primer nivel de «${state.maps[curMapId()].title}»`; }
function openMoveTo(ids){
  closeMgMenu();
  const g=document.getElementById("mv-graph"); if(!g||!ids.length) return;
  const ch=childrenIndex(), excl=new Set(ids), add=id=>{ for(const k of ch[id]||[]){ excl.add(k); add(k); } }; ids.forEach(add);
  const mid=curMapId(), roots=levelNodes(mid,null).map(([id])=>id);
  const rows=[`<button type="button" data-moveto=""${mapLevel?"":" disabled"}><span>${esc(state.maps[mid].title)}</span><small>primer nivel</small></button>`];
  const walk=(id,d)=>{ if(excl.has(id)) return; const n=state.mnodes[id];
    rows.push(`<button type="button" data-moveto="${id}" style="padding-left:${12+d*16}px"${id===mapLevel?" disabled":""}><span>${esc(n.title)}</span></button>`);
    for(const k of ch[id]||[]) walk(k,d+1); };
  roots.forEach(r=>walk(r,1));
  const box=document.createElement("div"); box.className="mv-move"; box.setAttribute("role","dialog"); box.setAttribute("aria-label","Mover a");
  box.innerHTML=`<div class="mm-head"><b>Mover ${ids.length===1?`«${esc(state.mnodes[ids[0]].title)}»`:ids.length+" nodos"} a…</b><button type="button" data-movecancel aria-label="Cerrar">×</button></div>
    <input type="text" placeholder="Filtrar…" aria-label="Filtrar destinos" autocomplete="off"><div class="mm-list">${rows.join("")}</div>`;
  g.appendChild(box);
  const inp=box.querySelector("input"); inp.focus();
  inp.oninput=()=>{ const q=fold(inp.value.trim()); box.querySelectorAll("[data-moveto]").forEach(b=>{ b.hidden=!!q && !fold(b.textContent).includes(q); }); };
  box.onkeydown=e=>{ if(e.key==="Escape"){ e.stopPropagation(); box.remove(); } if(e.key==="Enter"){ const f=[...box.querySelectorAll("[data-moveto]:not([hidden]):not([disabled])")][0]; if(f) f.click(); } };
  box.onclick=e=>{
    if(e.target.closest("[data-movecancel]")){ box.remove(); return; }
    const b=e.target.closest("[data-moveto]"); if(!b||b.disabled) return;
    const dest=b.dataset.moveto||null; box.remove();
    mRemember(); moveNodes(ids,dest); clearSel(); save(); renderBoards();
    mvToast(`${ids.length===1?"Nodo movido":ids.length+" nodos movidos"} a ${destName(dest)}`);
  };
}

// ---- copiar, cortar y pegar (también entre mapas) ----
function outlineText(ids,ch){
  const out=[], walk=(id,d)=>{ out.push("  ".repeat(d)+"- "+state.mnodes[id].title); for(const k of ch[id]||[]) walk(k,d+1); };
  ids.forEach(id=>walk(id,0)); return out.join("\n");
}
function copySelection(){
  const ids=selIds(); if(!ids.length) return null;
  const ch=childrenIndex(), all=[], add=id=>{ all.push(id); for(const k of ch[id]||[]) add(k); }; ids.forEach(add);
  const set=new Set(all), tops=new Set(ids);
  mClip={nodes:all.map(id=>{ const n=state.mnodes[id]; return {id, parent:tops.has(id)?null:n.parent, title:n.title, color:n.color, x:n.x, y:n.y, notes:n.notes}; }),
         links:Object.values(state.mlinks).filter(l=>set.has(l.a)&&set.has(l.b)).map(l=>[l.a,l.b]),
         text:outlineText(ids,ch), count:ids.length};
  return mClip.text;
}
function pasteClip(wx,wy){
  const c=mClip, mid=curMapId(); if(!c||!mid) return;
  mRemember();
  const ids={}; c.nodes.forEach(n=>{ ids[n.id]=newId("n"); });
  const tops=c.nodes.filter(n=>n.parent===null), placed=tops.filter(n=>n.x!=null);
  const cx=placed.length?placed.reduce((a,n)=>a+n.x,0)/placed.length:0, cy=placed.length?placed.reduce((a,n)=>a+n.y,0)/placed.length:0;
  const now=new Date().toISOString();
  for(const n of c.nodes){ const top=n.parent===null;
    state.mnodes[ids[n.id]]={map:mid, parent:top?(mapLevel||null):ids[n.parent], title:n.title, color:n.color,
      x:top?(n.x!=null?Math.round(n.x-cx+wx):null):n.x, y:top?(n.y!=null?Math.round(n.y-cy+wy):null):n.y, notes:n.notes, created:now}; }
  for(const [a,b] of c.links) state.mlinks[newId("x")]={a:ids[a], b:ids[b]};
  clearSel(); tops.forEach((n,i)=>{ if(i===0) mSel=ids[n.id]; mMulti.add(ids[n.id]); });
  save(); renderBoards(); revealAll(selIds());
  mvToast(`${c.count===1?"Nodo pegado":c.count+" nodos pegados"}`);
}
// Una lista de texto pegada (una idea por línea) se convierte en nodos; las líneas sangradas, en nodos de dentro
function pasteList(text,wx,wy){
  const mid=curMapId(); if(!mid) return;
  const items=[];
  for(const raw of text.replace(/\r/g,"").split("\n").slice(0,300)){
    if(!raw.trim()) continue;
    const ws=(raw.match(/^[ \t]*/)[0]).replace(/\t/g,"    ").length;
    const h=raw.trim().match(/^(#{1,6})\s+/);
    const title=raw.trim().replace(/^(#{1,6}\s+|[-*+•]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+)/,"").trim().slice(0,120);
    if(title) items.push({indent:h?(h[1].length-1)*100:ws, title});
  }
  if(!items.length) return;
  mRemember();
  const stack=[], now=new Date().toISOString(), tops=[];
  for(const it of items){
    while(stack.length && stack[stack.length-1].indent>=it.indent) stack.pop();
    const parent=stack.length?stack[stack.length-1].id:(mapLevel||null), id=newId("n");
    let x=null, y=null;
    if(!stack.length){ const k=tops.length, col=k%4, row=Math.floor(k/4); x=Math.round(wx+(col-1.5)*150); y=Math.round(wy+row*95); tops.push(id); }
    state.mnodes[id]={map:mid, parent, title:it.title, color:"", x, y, notes:"", created:now};
    stack.push({indent:it.indent, id});
  }
  clearSel(); tops.forEach((id,i)=>{ if(i===0) mSel=id; mMulti.add(id); });
  save(); renderBoards(); revealAll(selIds());
  mvToast(`${items.length} ${items.length===1?"nodo creado":"nodos creados"} a partir del texto`);
}
document.addEventListener("copy",e=>{
  if(!mapActive()||isTyping()) return;
  const t=copySelection(); if(t==null) return;
  e.preventDefault(); e.clipboardData.setData("text/plain",t);
});
document.addEventListener("cut",e=>{
  if(!mapActive()||isTyping()) return;
  const ids=selIds(), t=copySelection(); if(t==null) return;
  e.preventDefault(); e.clipboardData.setData("text/plain",t);
  mRemember(); removeNodes(ids); clearSel(); save(); renderBoards();
  mvToast(`${ids.length===1?"Nodo cortado":ids.length+" nodos cortados"}: pégalo donde quieras con Ctrl+V`);
});
document.addEventListener("paste",e=>{
  if(!mapActive()||isTyping()) return;
  const text=e.clipboardData.getData("text/plain")||"";
  e.preventDefault();
  const [wx,wy]=pastePoint();
  if(mClip && text===mClip.text) pasteClip(wx,wy);
  else if(text.trim()) pasteList(text,wx,wy);
  else if(mClip) pasteClip(wx,wy);
});
// ---- lienzo: ratón ----
function bindCanvas(cv){
  const pos=e=>{ const r=cv.getBoundingClientRect(); return [e.clientX-r.left, e.clientY-r.top]; };
  cv.addEventListener("pointerdown",e=>{
    if(e.button===2) return;
    closeMgMenu(); const mv=document.querySelector(".mv-move"); if(mv) mv.remove();
    const [x,y]=pos(e), id=hitNode(x,y), multi=e.ctrlKey||e.metaKey;
    if(MG.wire && MG.wire.pick){ const from=MG.wire.from; MG.wire=null; if(id) linkNodes(from,id); else mgDraw(); return; }
    cv.setPointerCapture(e.pointerId);
    if(id){
      if(multi){                                       // Ctrl+clic: añade o quita de la selección
        const s=new Set(selIds()); s.has(id)?s.delete(id):s.add(id);
        mMulti=s; mSel=s.has(id)?id:([...s][0]||null); mSelLink=null; selectionChanged(); return;
      }
      if(e.shiftKey){ if(!selIds().includes(id)) selectOnly(id); const [wx,wy]=toWorld(x,y); MG.wire={from:id, x:wx, y:wy}; selectionChanged(); return; }
      const sel=selIds();
      if(!sel.includes(id)){ selectOnly(id); selectionChanged(); }
      else if(mSel!==id){ mSel=id; selectionChanged(); }
      // Se arrastran todos los seleccionados a la vez
      const [wx,wy]=toWorld(x,y), ids=selIds();
      MG.drag={ids, ox:wx, oy:wy, from:Object.fromEntries(ids.map(i=>[i,{x:state.mnodes[i].x, y:state.mnodes[i].y}])), moved:false};
      mgDraw(); return;
    }
    const lid=hitLink(x,y);
    if(lid && !multi && !e.shiftKey){ clearSel(); mSelLink=lid; selectionChanged(); return; }
    if(multi || e.shiftKey){                           // Mayús o Ctrl + arrastrar en el fondo: recuadro de selección
      MG.rect={x0:x, y0:y, x1:x, y1:y, base:multi?new Set(selIds()):new Set()}; mgDraw(); return;
    }
    MG.pan={x, y, ox:cam().ox, oy:cam().oy};
    if(selIds().length||mSelLink){ clearSel(); selectionChanged(); }
    cv.classList.add("panning"); mgDraw();
  });
  cv.addEventListener("pointermove",e=>{
    const [x,y]=pos(e); MG.lastPointer=[x,y];
    if(MG.drag){
      const [wx,wy]=toWorld(x,y), dx=wx-MG.drag.ox, dy=wy-MG.drag.oy;
      if(!MG.drag.moved){ if(Math.hypot(dx,dy)*cam().z<3) return; mRemember(); MG.drag.moved=true; }
      for(const id of MG.drag.ids){ const n=state.mnodes[id], f=MG.drag.from[id]; if(n&&f.x!=null){ n.x=Math.round(f.x+dx); n.y=Math.round(f.y+dy); } }
      // ¿Se está soltando encima de otro nodo? Entonces se meterá dentro de él
      const over=hitNode(x,y,new Set(MG.drag.ids)); MG.dropTarget=over||null;
      mgDraw(); return;
    }
    if(MG.rect){
      MG.rect.x1=x; MG.rect.y1=y;
      const [ax,ay]=toWorld(Math.min(MG.rect.x0,x),Math.min(MG.rect.y0,y)), [bx,by]=toWorld(Math.max(MG.rect.x0,x),Math.max(MG.rect.y0,y));
      const s=new Set(MG.rect.base);
      for(const [id] of levelNodes(curMapId(),mapLevel)){ const p=posOf(id); if(p.x!=null && p.x>=ax&&p.x<=bx&&p.y>=ay&&p.y<=by) s.add(id); }
      mMulti=s; mSel=[...s][0]||null; mgDraw(); return;
    }
    if(MG.pan){ const c=cam(); c.ox=MG.pan.ox+x-MG.pan.x; c.oy=MG.pan.oy+y-MG.pan.y; c.user=true; mgDraw(); return; }
    if(MG.wire){ const [wx,wy]=toWorld(x,y); MG.wire.x=wx; MG.wire.y=wy; mgDraw(); }
    const h=hitNode(x,y);
    if(h!==MG.hover){ MG.hover=h; cv.style.cursor=h?"pointer":""; mgDraw(); }
  });
  cv.addEventListener("pointerup",e=>{
    const [x,y]=pos(e);
    if(MG.drag){
      const d=MG.drag; MG.drag=null;
      if(d.moved && MG.dropTarget){
        const dest=MG.dropTarget; MG.dropTarget=null;
        // Al soltar encima de otro nodo, lo arrastrado vuelve a su sitio y pasa a estar dentro de ese nodo
        for(const id of d.ids){ const n=state.mnodes[id], f=d.from[id]; if(n){ n.x=f.x; n.y=f.y; } }
        moveNodes(d.ids,dest); clearSel(); save(); renderBoards();
        mvToast(`${d.ids.length===1?"Nodo movido":d.ids.length+" nodos movidos"} dentro de «${state.mnodes[dest].title}»`);
        return;
      }
      MG.dropTarget=null; if(d.moved) save(); mgDraw();
    }
    if(MG.rect){ MG.rect=null; selectionChanged(); }
    if(MG.wire && !MG.wire.pick){ const from=MG.wire.from, to=hitNode(x,y); MG.wire=null;
      if(to && to!==from) linkNodes(from,to);
      else if(!to){ const [wx,wy]=toWorld(x,y); createNode(wx,wy,from); }
      else mgDraw(); }
    if(MG.pan){ MG.pan=null; cv.classList.remove("panning"); }
  });
  cv.addEventListener("pointerleave",()=>{ if(MG&&!MG.drag&&!MG.pan&&!MG.rect&&MG.hover){ MG.hover=null; mgDraw(); } });
  cv.addEventListener("dblclick",e=>{
    const [x,y]=pos(e), id=hitNode(x,y);
    if(id){ goLevel(id); return; }
    const [wx,wy]=toWorld(x,y); createNode(wx,wy,null);
  });
  cv.addEventListener("wheel",e=>{ e.preventDefault(); const [x,y]=pos(e); zoomAt(x,y,e.deltaY<0?1.12:1/1.12); },{passive:false});
  cv.addEventListener("contextmenu",e=>{
    e.preventDefault(); const [x,y]=pos(e), id=hitNode(x,y), lid=id?null:hitLink(x,y);
    MG.lastPointer=[x,y];
    if(id){
      if(!selIds().includes(id)) selectOnly(id); else mSel=id;
      selectionChanged();
      const ids=selIds();
      if(ids.length>1) openMgMenu(x,y,[["Mover a…",()=>openMoveTo(ids)],["Eliminar "+ids.length+" nodos",()=>askDeleteNodes(ids),"danger"]]);
      else openMgMenu(x,y,[["Abrir",()=>goLevel(id)],["Cambiar nombre",focusTitle],
        ["Conectar con…",()=>{ const p=posOf(id); MG.wire={from:id, x:p.x, y:p.y, pick:true}; mgDraw(); }],
        ["Nuevo nodo conectado",()=>{ mChain=null; createNear(id,id); }],
        ["Mover a…",()=>openMoveTo([id])],
        ["Eliminar",()=>askDeleteNode(id),"danger"]]);
    }
    else if(lid){ clearSel(); mSelLink=lid; selectionChanged();
      openMgMenu(x,y,[["Quitar conexión",()=>{ mRemember(); delete state.mlinks[lid]; mSelLink=null; save(); mgDraw(); },"danger"]]); }
    else { const [wx,wy]=toWorld(x,y);
      const items=[["Nuevo nodo aquí",()=>createNode(wx,wy,null)]];
      if(mClip) items.push(["Pegar "+(mClip.count===1?"el nodo copiado":mClip.count+" nodos copiados"),()=>pasteClip(wx,wy)]);
      items.push(["Seleccionar todo",()=>{ const all=levelNodes(curMapId(),mapLevel).map(([i])=>i); mMulti=new Set(all); mSel=all[0]||null; selectionChanged(); }],
                 ["Ajustar a la pantalla",()=>mgFit(false)]);
      openMgMenu(x,y,items); }
  });
}

// ---- eventos de la vista de mapa (delegados en el cuerpo de la vista de tableros) ----
bvBody.addEventListener("click",e=>{
  if(!curMapId() && !e.target.closest(".mcard,[data-newmap],[data-nmcolor],[data-nmcreate],[data-nmcancel],[data-mfav]")) return;
  const t=e.target, q=s=>t.closest(s); let el;
  if((el=q("[data-mfav]"))){ e.stopImmediatePropagation(); const m=state.maps[el.dataset.mfav]; mRemember(); m.fav=!m.fav; boardsChanged(); return; }
  if(q("[data-newmap]")){ e.stopImmediatePropagation(); openNewMap(); renderBoards(); document.getElementById("nm-name").focus(); return; }
  if((el=q("[data-nmcolor]"))){ e.stopImmediatePropagation(); nmDraft.color=el.dataset.nmcolor; renderBoards(); return; }
  if(q("[data-nmcreate]")){ e.stopImmediatePropagation(); createMap(); return; }
  if(q("[data-nmcancel]")){ e.stopImmediatePropagation(); nbMapOpen=false; renderBoards(); return; }
  if((el=q(".mcard[data-map]"))){ e.stopImmediatePropagation(); if(!bJustDragged) setMap(el.dataset.map); return; }
  if(!curMapId()) return;
  if(q("[data-mhelp]")){ toggleHelp(); return; }
  if((el=q("[data-mlevel]"))){ goLevel(el.dataset.mlevel||null); return; }
  if((el=q("[data-macc]"))){ mRemember(); state.maps[curMapId()].color=el.dataset.macc; boardsChanged(); return; }
  if((el=q("[data-delmap]"))){ armDelete(el,()=>deleteMap(curMapId()),"Pulsa otra vez para eliminar el mapa"); return; }
  if((el=q("[data-mtool]"))){ const k=el.dataset.mtool;
    if(k==="new"){ const c=cam(); createNode((MG.W/2-c.ox)/c.z+(Math.random()-.5)*60, (MG.H/2-c.oy)/c.z+(Math.random()-.5)*60, mSel); }
    else if(k==="in") zoomAt(MG.W/2,MG.H/2,1.2); else if(k==="out") zoomAt(MG.W/2,MG.H/2,1/1.2); else mgFit(false);
    return; }
  if((el=q("[data-mcolor]"))){ mRemember(); for(const id of selIds()) state.mnodes[id].color=el.dataset.mcolor; save(); mgDraw(); return; }
  if(q("[data-mmove]")){ openMoveTo(selIds()); return; }
  if(q("[data-mdel]")){ askDeleteNodes(selIds()); return; }
  if((el=q("[data-ncolor]"))){ const s=noteSubject(); if(s.kind!=="node") return; mRemember(); s.o.color=el.dataset.ncolor; save(); renderMapNote(); mgDraw(); return; }
  if(q("[data-maddsub]")){ createNode(null,null,null); return; }
  if((el=q("[data-ckline]"))){ const s=noteSubject(), lines=s.o.notes.split("\n"), i=+el.dataset.ckline;
    mRemember(); lines[i]=lines[i].replace(/\[( |x|X)\]/, el.checked?"[x]":"[ ]"); s.o.notes=lines.join("\n"); save(); renderMapNote(); mgDraw(); return; }
  if((el=q("[data-copy]"))){ copyCodeBlock(+el.dataset.copy); return; }
  if(q("#mn-md") && !q("a") && !q(".ln-img")){ NP.pendingCaret=caretFromClick(e);
    { const md=document.getElementById("mn-md"), ln=t.closest("[data-line]"); if(md&&ln&&NP.pendingCaret.line!=null) NP.pendingCaret.y=ln.getBoundingClientRect().top-md.getBoundingClientRect().top; } mNoteEditing=true; mTyping=false; renderMapNote(); }
}, true);
bvBody.addEventListener("input",e=>{
  const t=e.target;
  if(t.id==="nm-name"){ nmDraft.title=t.value; return; }
  if(!curMapId()) return;
  if(t.id==="mn-title"||t.id==="mn-text"){
    const s=noteSubject(); if(!s.o) return;
    if(!mTyping){ mRemember(); mTyping=true; }
    if(t.id==="mn-title"){ const v=t.value.trim(); if(!v) return; s.o.title=v.slice(0,s.kind==="map"?80:120);
      const cr=bvBody.querySelector(`.mv-crumb[data-mlevel="${s.kind==="map"?"":s.id}"]`); if(cr) cr.textContent=s.o.title;
      if(s.kind==="map") document.getElementById("bv-current").textContent=s.o.title; }
    else { const src=edSource(t); NP.srcLen=src.length; s.o.notes=src.slice(0,LIMITE_LIBRETA); noteCount(src.length); saveSoon(); if(!(MG&&MG.idleOn)) mgDraw(); return; }
    save(); mgDraw();
  }
});
bvBody.addEventListener("focusin",e=>{ if(e.target.id==="mn-title"||e.target.id==="mn-text") mTyping=false; });
bvBody.addEventListener("focusout",e=>{
  if(!curMapId()) return;
  // Si el foco pasa a otro control de la libreta (un color, una casilla), su propio clic ya la repinta
  const dentro=e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest("#mv-note");
  // Mientras el foco siga dentro de la libreta (índice, número de página, colores) se sigue en modo escritura
  if(e.target.id==="mn-text") flushSave();
  if(NP.rerendering) return;            // la libreta se está repintando (p. ej. tras cambiar una imagen): se sigue escribiendo
  if(e.target.id==="mn-text" && !dentro){ NP.pendingTopLine=topLineOfScreen(e.target); mNoteEditing=false; renderMapNote(); }
  if(e.target.id==="mn-title"){ const s=noteSubject(); if(s.o) e.target.value=s.o.title; }
});
bvBody.addEventListener("keydown",e=>{
  const t=e.target;
  if(t.id==="nm-name"){ if(e.key==="Enter"){ e.preventDefault(); createMap(); } else if(e.key==="Escape"){ nbMapOpen=false; renderBoards(); } return; }
  // Estas teclas son para el campo; no deben llegar a los atajos del mapa (Intro abriría el nodo)
  if(t.id==="mn-title" && (e.key==="Enter"||e.key==="Escape"||e.key==="Tab")){
    e.preventDefault(); e.stopPropagation();
    const sub=noteSubject(), inLevel=sub.kind==="node" && sub.id!==mapLevel;
    if(e.key==="Tab" && inLevel){ mChain=null; createNear(sub.id,sub.id); return; }                 // Tab: uno conectado a este
    if(e.key==="Enter" && inLevel && mChain && mChain.id===sub.id){                                    // Intro: otro al mismo nivel
      const from=mChain.from; createNear(from||sub.id,from); return; }
    mChain=null; t.blur();
  }
  if(t.id==="mn-md" && (e.key==="Enter"||e.key===" ")){ e.preventDefault(); e.stopPropagation(); mNoteEditing=true; renderMapNote(); }
  if(t.id==="mn-text" && e.key==="Escape"){ e.preventDefault(); e.stopPropagation(); t.blur(); }
});
// Reparto entre el mapa y la libreta, arrastrando la separación
bvBody.addEventListener("pointerdown",e=>{
  if(!e.target.closest("#mv-split")) return;
  const body=document.getElementById("mv-body"), r=body.getBoundingClientRect();
  e.preventDefault(); e.target.setPointerCapture(e.pointerId); document.body.classList.add("is-resizing");
  const mv=ev=>{ mSplit=Math.round(Math.min(80,Math.max(20,(ev.clientX-r.left)/r.width*100))); body.style.setProperty("--split",mSplit+"%"); };
  const up=()=>{ e.target.removeEventListener("pointermove",mv); e.target.removeEventListener("pointerup",up); document.body.classList.remove("is-resizing");
    try{ localStorage.setItem("ascenso-reparto-mapa-libreta",mSplit); }catch(err){} };
  e.target.addEventListener("pointermove",mv); e.target.addEventListener("pointerup",up);
});
// Atajos de teclado del mapa
document.addEventListener("keydown",e=>{
  if(boardsView.hidden || !curMapId() || cdlg.open) return;
  const a=document.activeElement, typing=a&&(/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)||a.isContentEditable);
  const k=e.key, mod=e.ctrlKey||e.metaKey;
  if(mod && (k==="i"||k==="I") && !e.shiftKey && !e.altKey){ e.preventDefault(); toggleIndex(); return; }
  if(mod && !typing && (k==="z"||k==="Z")){ e.preventDefault(); if(e.shiftKey) mRedoDo(); else mUndoDo(); return; }
  if(mod && !typing && (k==="y"||k==="Y")){ e.preventDefault(); mRedoDo(); return; }
  if(typing) return;
  if(k==="?" ){ e.preventDefault(); toggleHelp(); return; }
  if(k==="Escape"){ const mv=document.querySelector(".mv-move");
    if(mHelpOpen) toggleHelp(false); else if(mv) mv.remove(); else if(MG&&MG.wire){ MG.wire=null; mgDraw(); } else if(MG&&MG.menu) closeMgMenu(); else if(selIds().length||mSelLink){ clearSel(); selectionChanged(); } return; }
  if(mod && (k==="a"||k==="A")){ e.preventDefault(); const all=levelNodes(curMapId(),mapLevel).map(([i])=>i); mMulti=new Set(all); mSel=all[0]||null; selectionChanged(); return; }
  if(k==="Tab" && mSel && selIds().length===1){ e.preventDefault(); createNear(mSel,mSel); return; }
  if(k==="F2" && (mSel||mapLevel)){ e.preventDefault(); focusTitle(); return; }
  if(k==="Delete"){ const ids=selIds(); if(ids.length) askDeleteNodes(ids); else if(mSelLink){ mRemember(); delete state.mlinks[mSelLink]; mSelLink=null; save(); mgDraw(); } return; }
  if(k==="Enter" && mSel){ e.preventDefault(); goLevel(mSel); return; }
  if(k==="Backspace" || (e.altKey && k==="ArrowLeft")){ if(mapLevel){ e.preventDefault(); goUp(); } }
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
  else if((el=t.closest(".mcard[data-map]"))) kind="map";
  if(!kind) return;
  const r=el.getBoundingClientRect();
  bdrag={kind, el, id:el.dataset.card||el.dataset.list||el.dataset.board||el.dataset.map, x0:e.clientX, y0:e.clientY,
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
    const grid=document.getElementById(d.kind==="map"?"mh-grid":"bh-grid");
    let best=null, bd=Infinity;
    for(const n of grid.querySelectorAll(d.kind==="map"?".mcard[data-map]":".bcard[data-board]")){
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
    } else if(d.kind==="map"){
      mRemember();
      [...document.getElementById("mh-grid").children].filter(n=>n!==d.el).map(n=>n===d.ph?d.id:n.dataset.map).filter(Boolean).forEach((id,i)=>{ state.maps[id].order=i; });
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
  // El alto del título solo se puede medir con la ficha ya visible
  autoGrow(cdlg.querySelector(".dlg-title"));
  cdlg.querySelector(".dlg-x").focus();
}
// Si cambia el ancho de la ventana, el título puede ocupar más o menos líneas
window.addEventListener("resize",()=>{
  for(const d of [cdlg,dlg]) if(d.open){ const ti=d.querySelector(".dlg-title"); if(ti) autoGrow(ti); }
});
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
document.getElementById("exp").addEventListener("click",async()=>{
  // Con la base de datos, la copia incluye también las imágenes de las libretas
  let copia=state;
  if(online&&API){ try{ copia={...state, adjuntos:await api("GET","adjuntos-copia")}; }catch(err){} }
  const blob=new Blob([JSON.stringify(copia,null,1)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="ascenso-copia-"+key(today())+".json";
  document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);
  document.getElementById("bmsg").textContent="Copia descargada.";
});
document.getElementById("imp").addEventListener("change",async e=>{
  const f=e.target.files[0]; if(!f) return;
  try{ const d=JSON.parse(await f.text()); if(!d||typeof d.days!=="object") throw 0;
    state=cleanState(d);
    const adj=d.adjuntos&&typeof d.adjuntos==="object"?d.adjuntos:null;
    if(adj) for(const [id,a] of Object.entries(adj)) if(a&&a.ancho&&a.alto) attMeta[id]={t:a.tipo, w:a.ancho, h:a.alto};
    if(online){ await api("POST","importar",adj?{...snapshot(), adjuntos:adj}:snapshot()); synced=snapshot(); }
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
// Ajusta el alto de un cuadro de texto a su contenido (sumando sus bordes, porque el alto incluye el borde)
const autoGrow=el=>{ if(!el) return; el.style.height="auto"; el.style.height=(el.scrollHeight+el.offsetHeight-el.clientHeight)+"px"; };
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
const VERSION_NECESARIA=9;
function saveLocal(){
  try{
    const j=JSON.stringify(state);
    // El navegador admite unos 5 MB: si los datos no caben, se quita la copia antigua para que nunca se use una copia desfasada
    if(j.length>4500000){ localStorage.removeItem(STORE); return false; }
    localStorage.setItem(STORE,j); return true;
  }catch(e){ try{ localStorage.removeItem(STORE); }catch(e2){} return false; }
}
function snapshot(){ return JSON.parse(JSON.stringify({plan:state.plan,thr:state.thr,habits:state.habits,days:state.days,hist:state.hist,tags:state.tags,tasks:state.tasks,notes:state.notes,events:state.events,
  boards:state.boards,blabels:state.blabels,blists:state.blists,cards:state.cards,maps:state.maps,mnodes:state.mnodes,mlinks:state.mlinks})); }
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
// Guardado con espera: mientras se escribe en una libreta, se guarda 0,7 s después de la última tecla
// (y siempre al salir de la libreta, al cambiar de ventana o al cerrar)
let saveSoonT=null;
function saveSoon(){ clearTimeout(saveSoonT); saveSoonT=setTimeout(()=>{ saveSoonT=null; save(); },700); }
function flushSave(){ if(saveSoonT){ clearTimeout(saveSoonT); saveSoonT=null; save(); } }
document.addEventListener("visibilitychange",()=>{ if(document.hidden) flushSave(); });
window.addEventListener("pagehide",flushSave);
function save(){
  if(saveSoonT){ clearTimeout(saveSoonT); saveSoonT=null; }
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
    const COLS=[["tags","etiquetas"],["tasks","tareas"],["boards","tableros"],["blabels","etiquetas-tablero"],["blists","listas"],["cards","tarjetas"],["events","eventos"],
                ["maps","mapas"],["mnodes","nodos"],["mlinks","conexiones"]];
    // Los nodos se envían de los de primer nivel hacia dentro (un padre siempre antes que sus hijos)
    const depth=(coll,id)=>{ let d=0, p=coll[id]&&coll[id].parent; while(p&&coll[p]&&d<500){ d++; p=coll[p].parent; } return d; };
    const ordered=(k,coll)=>k==="mnodes"?Object.entries(coll).sort((a,b)=>depth(coll,a[0])-depth(coll,b[0])):Object.entries(coll);
    for(const [k,ruta] of COLS) for(const [id,v] of ordered(k,now[k])){
      if(JSON.stringify(v)!==JSON.stringify(synced[k][id]||null) && await enviar("PUT",ruta+"/"+id,v)) synced[k][id]=v;
    }
    for(const [k,ruta] of [...COLS].reverse()) for(const [id] of ordered(k,synced[k]).reverse()){
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
      attMeta=remote.att&&typeof remote.att==="object"?remote.att:{};
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


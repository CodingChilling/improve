// Modo «texto» de las libretas de los mapas: un editor con formato a la vista (títulos, negrita, subrayado,
// listas, checklist…) y una barra de herramientas sencilla. Lo que se guarda sigue siendo el mismo Markdown que en el
// modo «MD»: cada bloque del editor es una línea de los apuntes, así se puede pasar de un modo a otro sin perder nada,
// y las páginas, las imágenes, el índice y la sincronización funcionan igual.
//
//   p        párrafo                         línea normal (con los caracteres especiales escapados)
//   h1…h6    título, subtítulo…              # Título · ## Subtítulo · ###…
//   ul / ol  lista con viñetas / numerada    - texto · 1. texto      (sangría: 2 espacios por nivel)
//   ck       checklist                       - [ ] texto · - [x] texto
//   cita     cita                            > texto
//   hr       separador                       ---
//   raw      código, tablas y fórmulas       la línea tal cual (se escriben como texto, en letra de código)
//   img      imagen                          ![…](imagen:…), igual que en el editor Markdown
//
// En línea: **negrita**, *cursiva*, ++subrayado++, ~~tachado~~, `código` y [enlaces](https://…).
"use strict";
window.AscensoTexto=(()=>{
  const e=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const ENLACE_OK=/^(https?:\/\/|mailto:)/i;
  const esImagen=l=>typeof isImgLine==="function"&&isImgLine(l);
  const TIPOS_LISTA=new Set(["ul","ol","ck"]);

  // ---------------------------------------------------------------- Markdown → bloques
  function enLinea(s){
    const keep=[], put=h=>{ keep.push(h); return "\u0000"+(keep.length-1)+"\u0000"; };
    s=s.replace(/\\([\\`*_~+#\-.>|[\]()!$])/g,(m,c)=>put(e(c)));
    s=s.replace(/`([^`\n]+)`/g,(m,c)=>put(`<code>${e(c)}</code>`));
    const fmt=x=>x.replace(/\*\*(.+?)\*\*/g,"<b>$1</b>").replace(/(^|[^\w])__(.+?)__(?!\w)/g,"$1<b>$2</b>")
      .replace(/(^|[^*])\*([^*\s][^*]*?)\*/g,"$1<i>$2</i>").replace(/(^|[^\w])_([^_\s][^_]*?)_(?!\w)/g,"$1<i>$2</i>")
      .replace(/~~(.+?)~~/g,"<s>$1</s>").replace(/\+\+(.+?)\+\+/g,"<u>$1</u>");
    s=s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g,(m,t,u)=>ENLACE_OK.test(u)?put(`<a href="${e(u)}">${fmt(e(t))}</a>`):m);
    s=fmt(e(s));
    for(let k=keep.length-1;k>=0;k--) s=s.split("\u0000"+k+"\u0000").join(keep[k]);
    return s;
  }
  const profundidad=sang=>Math.min(6,Math.floor(sang.replace(/\t/g,"    ").length/2));
  // Tipo y contenido de una línea (crudo: dentro de un bloque de código, una tabla o una fórmula)
  function analizar(l,crudo){
    let m;
    if(crudo) return {t:"raw", txt:l};
    if(esImagen(l)) return {t:"img", src:l};
    if((m=l.match(/^(\s*)(?:[-*+]|\d+[.)]) \[( |x|X)\] ?(.*)$/))) return {t:"ck", d:profundidad(m[1]), ok:m[2]!==" ", html:enLinea(m[3])};
    if((m=l.match(/^(\s*)[-*+] (.*)$/))) return {t:"ul", d:profundidad(m[1]), html:enLinea(m[2])};
    if((m=l.match(/^(\s*)\d+[.)] (.*)$/))) return {t:"ol", d:profundidad(m[1]), html:enLinea(m[2])};
    if((m=l.match(/^(#{1,6})\s+(.*)$/))) return {t:"h"+m[1].length, html:enLinea(m[2])};
    if((m=l.match(/^>\s?(.*)$/))) return {t:"cita", html:enLinea(m[1])};
    if(/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) return {t:"hr"};
    return {t:"p", html:enLinea(l)};
  }
  const CAJA=ok=>`<span class="rc-caja" contenteditable="false" role="checkbox" aria-checked="${ok}" aria-label="Hecho"></span>`;
  function htmlBloque(b){
    if(b.t==="img") return `<div class="ln-img" contenteditable="false" data-src="${e(b.src)}"></div>`;
    if(b.t==="hr") return `<div class="ln rc rc-hr" data-t="hr" contenteditable="false"></div>`;
    if(b.t==="raw") return `<div class="ln rc rc-raw" data-t="raw">${b.txt?e(b.txt):"<br>"}</div>`;
    const d=b.d?` data-d="${b.d}"`:"", ok=b.t==="ck"?` data-ok="${b.ok?1:0}"`:"";
    return `<div class="ln rc rc-${b.t}" data-t="${b.t}"${d}${ok}>${b.t==="ck"?CAJA(!!b.ok):""}${b.html||"<br>"}</div>`;
  }
  function bloques(md){
    const lineas=md.split("\n"), out=[];
    let valla=null, formula=false;
    for(const l of lineas){
      const tl=l.trim();
      if(valla){ out.push(analizar(l,true)); if(tl.startsWith(valla)) valla=null; continue; }
      if(formula){ out.push(analizar(l,true)); if(tl.endsWith("$$")) formula=false; continue; }
      const m=tl.match(/^(`{3,}|~{3,})/);
      if(m){ valla=m[1]; out.push(analizar(l,true)); continue; }
      if(tl.startsWith("$$")){ formula=!(tl.length>4&&tl.endsWith("$$")); out.push(analizar(l,true)); continue; }
      if(/^\s*\|.*\|\s*$/.test(l)){ out.push(analizar(l,true)); continue; }
      out.push(analizar(l,false));
    }
    return out;
  }
  function pintar(el,md){ el.innerHTML=bloques(md).map(htmlBloque).join(""); numerar(el); }

  // ---------------------------------------------------------------- bloques → Markdown
  const PALABRA=/[\p{L}\p{N}]/u;
  function escapar(t){
    let s=t.replace(/\\/g,"\\\\").replace(/`/g,"\\`").replace(/\*/g,"\\*").replace(/~~/g,"\\~\\~").replace(/\+\+/g,"\\+\\+");
    s=s.replace(/_/g,(m,i)=>PALABRA.test(s[i-1]||"")&&PALABRA.test(s[i+1]||"")?"_":"\\_");
    if(/\]\(/.test(s)) s=s.replace(/\[/g,"\\[");
    return s;
  }
  const MARCAS={B:"**",STRONG:"**",I:"*",EM:"*",U:"++",S:"~~",STRIKE:"~~",DEL:"~~"};
  function envolver(m,dentro){
    if(!dentro.trim()) return dentro;
    const a=dentro.match(/^\s*/)[0], z=dentro.match(/\s*$/)[0];
    return a+m+dentro.trim()+m+z;
  }
  function enLineaMd(nodo){
    let out="";
    for(const c of nodo.childNodes){
      if(c.nodeType===3){ out+=escapar(c.textContent.replace(/\u00a0/g," ")); continue; }
      if(c.nodeType!==1||c.classList.contains("rc-caja")||c.nodeName==="BR") continue;
      const tag=c.nodeName;
      if(MARCAS[tag]) out+=envolver(MARCAS[tag],enLineaMd(c));
      else if(tag==="A"){ const h=c.getAttribute("href")||"", t=enLineaMd(c); out+=ENLACE_OK.test(h)&&t.trim()?`[${t}](${h.replace(/[()\s]/g,m=>encodeURIComponent(m))})`:t; }
      else if(tag==="CODE") out+="`"+c.textContent.replace(/`/g,"")+"`";
      else out+=enLineaMd(c);
    }
    return out;
  }
  // Un párrafo que empieza como un título, una lista, una cita o un separador se escapa para seguir siendo párrafo
  function escaparInicio(s){
    if(/^\s*\d+[.)] /.test(s)) return s.replace(/^(\s*\d+)([.)])/,"$1\\$2");
    if(/^\s*([-*+] |#{1,6}\s|>|\||`{3,}|~{3,}|\$\$)/.test(s)||/^\s*([-*_])(\s*\1){2,}\s*$/.test(s)||esImagen(s)) return s.replace(/^(\s*)(\S)/,"$1\\$2");
    return s;
  }
  const sangria=b=>"  ".repeat(+b.dataset.d||0);
  function lineaMd(b,n){
    if(b.classList.contains("ln-img")) return b.dataset.src||"";
    const t=b.dataset.t||"p";
    if(t==="raw") return b.textContent.replace(/\u00a0/g," ");
    if(t==="hr") return "---";
    let x=enLineaMd(b);
    if(t==="p") return escaparInicio(x);
    if(/^h[1-6]$/.test(t)) return "#".repeat(+t[1])+" "+x;
    if(t==="cita") return "> "+x;
    if(TIPOS_LISTA.has(t)&&/^\[( |x|X)\]/.test(x)) x="\\"+x;
    if(t==="ul") return sangria(b)+"- "+x;
    if(t==="ol") return sangria(b)+(n||1)+". "+x;
    if(t==="ck") return sangria(b)+"- ["+(b.dataset.ok==="1"?"x":" ")+"] "+x;
    return escaparInicio(x);
  }
  // Numera las listas numeradas (cada nivel cuenta por su lado; un bloque que no es de lista corta la cuenta)
  function numerar(el){
    let cuenta=[];
    for(const b of el.children){
      const t=b.dataset&&b.dataset.t;
      if(!TIPOS_LISTA.has(t)){ cuenta=[]; continue; }
      const d=+b.dataset.d||0; cuenta.length=d+1;
      if(t==="ol"){ cuenta[d]=(cuenta[d]||0)+1; b.dataset.n=cuenta[d]; } else cuenta[d]=0;
    }
  }
  function fuente(el){
    numerar(el);
    const out=[];
    for(const b of el.children) out.push(lineaMd(b,+(b.dataset&&b.dataset.n)||1));
    return out.length?out.join("\n"):"";
  }

  // ---------------------------------------------------------------- utilidades del cursor
  const bloqueDe=(el,n)=>{ while(n&&n.parentNode!==el) n=n.parentNode; return n&&n.parentNode===el?n:null; };
  function rango(){ const s=getSelection(); return s.rangeCount?s.getRangeAt(0):null; }
  function textoAntes(b,r){ const x=document.createRange(); x.selectNodeContents(b); x.setEnd(r.startContainer,r.startOffset); return x.toString(); }
  function textoDespues(b,r){ const x=document.createRange(); x.selectNodeContents(b); x.setStart(r.endContainer,r.endOffset); return x.toString(); }
  function cursorAl(b,alFinal){
    const r=document.createRange(), caja=b.querySelector(".rc-caja");
    if(alFinal){ r.selectNodeContents(b); r.collapse(false); }
    else if(caja){ r.setStartAfter(caja); r.collapse(true); }
    else { r.setStart(b,0); r.collapse(true); }
    const s=getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  const vacio=b=>!b.textContent.replace(/\u200b/g,"").length;
  function limpiarVacio(b){ if(vacio(b)&&!b.querySelector("br")){ b.appendChild(document.createElement("br")); } }
  // Cambia el tipo de un bloque conservando su texto
  function ponerTipo(b,t,{d=null,ok=false}={}){
    if(b.classList.contains("ln-img")||b.dataset.t==="hr") return;
    const caja=b.querySelector(".rc-caja");
    b.className="ln rc rc-"+t; b.dataset.t=t;
    if(d!=null){ if(d) b.dataset.d=d; else delete b.dataset.d; }
    if(!TIPOS_LISTA.has(t)) delete b.dataset.d;
    if(t==="ck"){ b.dataset.ok=ok?"1":"0"; if(!caja) b.insertAdjacentHTML("afterbegin",CAJA(ok)); }
    else { delete b.dataset.ok; if(caja) caja.remove(); }
    delete b.dataset.n; limpiarVacio(b);
  }
  function nuevoBloque(t,{d=0}={}){
    const div=document.createElement("div");
    div.innerHTML=htmlBloque({t, d, ok:false, html:"", txt:""}); return div.firstChild;
  }

  // ---------------------------------------------------------------- teclado y edición
  function avisar(el){ el.dispatchEvent(new Event("input",{bubbles:true})); }
  // Intro: parte el bloque; en listas y checklist sigue la lista (en un elemento vacío, sale de ella)
  function intro(el){
    const r=rango(); if(!r) return;
    if(!r.collapsed) r.deleteContents();
    const b=bloqueDe(el,r.startContainer); if(!b) return;
    const t=b.dataset.t||"p";
    if(b.classList.contains("ln-img")||t==="hr"){ const n=nuevoBloque("p"); b.after(n); cursorAl(n); avisar(el); return; }
    if((TIPOS_LISTA.has(t)||t==="cita")&&vacio(b)){ ponerTipo(b,"p",{d:0}); cursorAl(b); numerar(el); avisar(el); return; }
    if(t==="p"&&b.textContent.trim()==="---"){
      b.innerHTML=""; ponerTipo(b,"p"); const hr=nuevoBloque("hr"); b.replaceWith(hr);
      const n=nuevoBloque("p"); hr.after(n); cursorAl(n); avisar(el); return;
    }
    // Lo que queda a la derecha del cursor pasa a un bloque nuevo
    const resto=document.createRange(); resto.setStart(r.startContainer,r.startOffset); resto.setEnd(b,b.childNodes.length);
    const trozo=resto.extractContents();
    const sigue=TIPOS_LISTA.has(t)||t==="cita"||t==="raw"?t:"p";
    const n=nuevoBloque(sigue,{d:+b.dataset.d||0}); n.querySelectorAll("br").forEach(x=>x.remove());
    n.appendChild(trozo); n.querySelectorAll(".rc-caja").forEach((x,i)=>{ if(i>0||sigue!=="ck") x.remove(); });
    limpiarVacio(n); limpiarVacio(b);
    b.after(n); cursorAl(n); numerar(el); avisar(el);
  }
  // Une el bloque b con el anterior (el cursor queda en la unión)
  function unirConAnterior(el,b){
    const prev=b.previousElementSibling; if(!prev) return;
    if(prev.classList.contains("ln-img")||prev.dataset.t==="hr"){
      const r=document.createRange(); r.selectNode(prev); const s=getSelection(); s.removeAllRanges(); s.addRange(r);
      document.execCommand("delete"); return;
    }
    prev.querySelectorAll(":scope > br").forEach(x=>x.remove());
    const marca=document.createTextNode(""); prev.appendChild(marca);
    for(const c of [...b.childNodes]) if(!(c.classList&&c.classList.contains("rc-caja"))&&c.nodeName!=="BR") prev.appendChild(c);
    b.remove(); limpiarVacio(prev);
    const r=document.createRange(); r.setStart(marca,0); r.collapse(true); const s=getSelection(); s.removeAllRanges(); s.addRange(r);
    numerar(el); avisar(el);
  }
  // Retroceso al principio de un bloque: primero se le quita el formato; si ya es un párrafo, se une al anterior
  function retroceso(el,ev){
    const r=rango(); if(!r||!r.collapsed) return;
    const b=bloqueDe(el,r.startContainer); if(!b||b.classList.contains("ln-img")) return;
    if(textoAntes(b,r).length) return;
    ev.preventDefault();
    const t=b.dataset.t||"p";
    if(t!=="p"&&t!=="raw"){ if(TIPOS_LISTA.has(t)&&+b.dataset.d){ b.dataset.d=+b.dataset.d-1; if(b.dataset.d==="0") delete b.dataset.d; } else ponerTipo(b,"p"); cursorAl(b); numerar(el); avisar(el); return; }
    unirConAnterior(el,b);
  }
  function suprimir(el,ev){
    const r=rango(); if(!r||!r.collapsed) return;
    const b=bloqueDe(el,r.startContainer); if(!b||b.classList.contains("ln-img")) return;
    if(textoDespues(b,r).length) return;
    const n=b.nextElementSibling; if(!n) return;
    ev.preventDefault(); unirConAnterior(el,n);
  }
  // Atajos al escribir: «- », «* », «1. », «[] », «[x] », «# », «## », «> » al principio de un párrafo
  const ATAJOS=[[/^[-*+]$/,"ul"],[/^\d+[.)]$/,"ol"],[/^\[ ?\]$/,"ck"],[/^\[[xX]\]$/,"ck",true],[/^#$/,"h1"],[/^##$/,"h2"],[/^###$/,"h3"],[/^>$/,"cita"]];
  function atajo(el,ev){
    const r=rango(); if(!r||!r.collapsed) return false;
    const b=bloqueDe(el,r.startContainer); if(!b||(b.dataset.t||"p")!=="p") return false;
    const antes=textoAntes(b,r);
    for(const [re,t,ok] of ATAJOS) if(re.test(antes)){
      ev.preventDefault();
      const x=document.createRange(); x.selectNodeContents(b); x.setEnd(r.startContainer,r.startOffset); x.deleteContents();
      ponerTipo(b,t,{ok:!!ok}); cursorAl(b); numerar(el); avisar(el); return true;
    }
    return false;
  }
  function antesDeEntrada(el,ev,{limite}={}){
    const t=ev.inputType||"";
    if(t==="insertFromDrop"||t==="deleteByDrag"){ ev.preventDefault(); return; }
    if(t==="insertParagraph"||t==="insertLineBreak"){ ev.preventDefault(); intro(el); return; }
    if(t==="deleteContentBackward"){ retroceso(el,ev); return; }
    if(t==="deleteContentForward"){ suprimir(el,ev); return; }
    if(t==="insertText"&&ev.data===" "&&atajo(el,ev)) return;
    if(t.startsWith("insert")&&limite&&limite((ev.data||"").length||1)) ev.preventDefault();
  }
  function sangrar(el,mas){
    const bs=seleccionados(el).filter(b=>TIPOS_LISTA.has(b.dataset.t));
    if(!bs.length) return false;
    for(const b of bs){ const d=Math.max(0,Math.min(6,(+b.dataset.d||0)+(mas?1:-1))); if(d) b.dataset.d=d; else delete b.dataset.d; }
    numerar(el); avisar(el); return true;
  }
  function teclado(el,ev){
    const mod=ev.ctrlKey||ev.metaKey;
    if(ev.key==="Tab"&&!mod&&!ev.altKey){ if(sangrar(el,!ev.shiftKey)) ev.preventDefault(); return; }
    if(mod&&ev.shiftKey&&/^x$/i.test(ev.key)){ ev.preventDefault(); aplicar(el,"s"); return; }
    if(mod&&/^k$/i.test(ev.key)){ ev.preventDefault(); aplicar(el,"enlace"); return; }
    if(mod&&!ev.shiftKey&&/^[biu]$/i.test(ev.key)){ ev.preventDefault(); aplicar(el,ev.key.toLowerCase()); }
  }
  // Pegar texto: la primera línea en el sitio del cursor; las demás, como bloques (se entiende su Markdown)
  function pegar(el,texto){
    const lineas=texto.replace(/\r\n?/g,"\n").split("\n");
    document.execCommand("insertText",false,lineas[0]);
    if(lineas.length===1) return;
    const r=rango(), b=r&&bloqueDe(el,r.startContainer); if(!b) return;
    const resto=document.createRange(); resto.setStart(r.startContainer,r.startOffset); resto.setEnd(b,b.childNodes.length);
    const trozo=resto.extractContents(); limpiarVacio(b);
    const tmp=document.createElement("div"); tmp.innerHTML=bloques(lineas.slice(1).join("\n")).map(htmlBloque).join("");
    let ultimo=b; for(const n of [...tmp.children]){ ultimo.after(n); ultimo=n; }
    if(ultimo.classList.contains("ln-img")||ultimo.dataset.t==="hr"){ const n=nuevoBloque("p"); ultimo.after(n); ultimo=n; }
    ultimo.querySelectorAll(":scope > br").forEach(x=>x.remove());
    const marca=document.createTextNode(""); ultimo.appendChild(marca); ultimo.appendChild(trozo); limpiarVacio(ultimo);
    const x=document.createRange(); x.setStart(marca,0); x.collapse(true); const s=getSelection(); s.removeAllRanges(); s.addRange(x);
    numerar(el); avisar(el);
  }

  // ---------------------------------------------------------------- barra de herramientas
  const ICONOS={
    enlace:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
    ck:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12.5l2.6 2.6L16 9.6"/></svg>',
    ul:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="7" r="1.3"/><circle cx="5" cy="12" r="1.3"/><circle cx="5" cy="17" r="1.3"/><path d="M9.5 7H20M9.5 12H20M9.5 17H20"/></svg>',
    ol:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 7H20M9.5 12H20M9.5 17H20"/><text x="2.6" y="9" font-size="6.5">1</text><text x="2.6" y="14" font-size="6.5">2</text><text x="2.6" y="19" font-size="6.5">3</text></svg>',
    cita:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6v12M9.5 8H19M9.5 12H19M9.5 16H15"/></svg>',
    hr:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16"/></svg>',
  };
  const BOTONES=[
    [["h1","Título","T",'class="rc-t1"'],["h2","Subtítulo","T",'class="rc-t2"']],
    [["b","Negrita (Ctrl+B)","B",'class="rc-neg"'],["i","Cursiva (Ctrl+I)","I",'class="rc-cur"'],["u","Subrayado (Ctrl+U)","U",'class="rc-sub"'],["s","Tachado (Ctrl+Mayús+X)","S",'class="rc-tac"']],
    [["ck","Checklist",ICONOS.ck],["ul","Lista con viñetas",ICONOS.ul],["ol","Lista numerada",ICONOS.ol]],
    [["cita","Cita",ICONOS.cita],["enlace","Enlace (Ctrl+K)",ICONOS.enlace],["hr","Separador",ICONOS.hr]],
  ];
  function barraHTML(){
    return `<div class="rc-barra" role="toolbar" aria-label="Formato del texto">${BOTONES.map(g=>`<span class="rc-grupo">${g.map(([k,n,ico,extra])=>
      `<button type="button" data-rc="${k}" aria-label="${n}" title="${n}" aria-pressed="false" ${extra||""}>${ico}</button>`).join("")}</span>`).join("")}</div>
      <div class="rc-enlace" hidden><input type="url" inputmode="url" placeholder="https://…" aria-label="Dirección del enlace"><button type="button" data-rcl="poner">Aplicar</button><a class="rc-abrir" target="_blank" rel="noopener noreferrer" hidden>Abrir ↗</a><button type="button" data-rcl="quitar" hidden>Quitar</button></div>`;
  }
  function seleccionados(el){
    const r=rango(); if(!r||!el.contains(r.commonAncestorContainer)) return [];
    const a=bloqueDe(el,r.startContainer), z=bloqueDe(el,r.endContainer); if(!a||!z) return [];
    const out=[]; for(let b=a; b; b=b.nextElementSibling){ out.push(b); if(b===z) break; } return out;
  }
  let rangoGuardado=null;
  function aplicar(el,accion){
    if(document.activeElement!==el&&!el.contains(document.activeElement)) el.focus();
    if(/^(h[1-3]|ul|ol|ck|cita)$/.test(accion)){
      const bs=seleccionados(el).filter(b=>!b.classList.contains("ln-img")&&b.dataset.t!=="hr"&&b.dataset.t!=="raw"); if(!bs.length) return;
      const todos=bs.every(b=>b.dataset.t===accion);
      for(const b of bs) ponerTipo(b,todos?"p":accion,{d:TIPOS_LISTA.has(accion)?(+b.dataset.d||0):0});
      const r=rango(); if(r&&r.collapsed){ const b=bloqueDe(el,r.startContainer); if(b&&vacio(b)) cursorAl(b); }
      numerar(el); avisar(el); return;
    }
    if(accion==="b"||accion==="i"||accion==="u"||accion==="s"){
      document.execCommand("styleWithCSS",false,false);
      document.execCommand({b:"bold",i:"italic",u:"underline",s:"strikeThrough"}[accion]);
      avisar(el); return;
    }
    if(accion==="hr"){
      const r=rango(), b=r&&bloqueDe(el,r.startContainer); if(!b) return;
      const hr=nuevoBloque("hr"); b.after(hr);
      let sig=hr.nextElementSibling; if(!sig||sig.classList.contains("ln-img")||sig.dataset.t==="hr"){ sig=nuevoBloque("p"); hr.after(sig); }
      cursorAl(sig); avisar(el); return;
    }
    if(accion==="enlace") abrirEnlace(el);
  }
  function enlaceActual(el){ const r=rango(); if(!r) return null; let n=r.startContainer; while(n&&n!==el){ if(n.nodeName==="A") return n; n=n.parentNode; } return null; }
  function abrirEnlace(el){
    const p=document.querySelector(".rc-enlace"); if(!p) return;
    const r=rango(); rangoGuardado=r&&el.contains(r.commonAncestorContainer)?r.cloneRange():null;
    const a=enlaceActual(el), input=p.querySelector("input"), abrir=p.querySelector(".rc-abrir");
    input.value=a?a.getAttribute("href"):"";
    abrir.hidden=!a; if(a) abrir.href=a.getAttribute("href");
    p.querySelector('[data-rcl="quitar"]').hidden=!a;
    p.hidden=false; input.focus(); input.select();
  }
  function cerrarEnlace(el,volver=true){
    const p=document.querySelector(".rc-enlace"); if(!p||p.hidden) return;
    p.hidden=true;
    if(volver&&rangoGuardado){ el.focus(); const s=getSelection(); s.removeAllRanges(); s.addRange(rangoGuardado); }
  }
  function ponerEnlace(el,url){
    url=String(url||"").trim();
    if(url&&!/^[a-z][a-z0-9+.-]*:/i.test(url)) url=(url.includes("@")&&!url.includes("/")?"mailto:":"https://")+url;
    cerrarEnlace(el);
    if(!url||!ENLACE_OK.test(url)) return;
    const r=rango(); if(!r) return;
    const a=enlaceActual(el);
    if(a){ a.setAttribute("href",url); }
    else if(r.collapsed) document.execCommand("insertHTML",false,`<a href="${e(url)}">${e(url.replace(/^mailto:/,""))}</a>&nbsp;`);
    else document.execCommand("createLink",false,url);
    avisar(el);
  }
  function quitarEnlace(el){
    cerrarEnlace(el);
    const a=enlaceActual(el); if(!a) return;
    const r=document.createRange(); r.selectNodeContents(a); const s=getSelection(); s.removeAllRanges(); s.addRange(r);
    document.execCommand("unlink"); avisar(el);
  }
  // Botones encendidos según dónde está el cursor
  function estado(el,barra){
    if(!barra) return;
    const r=rango(), dentro=r&&el.contains(r.commonAncestorContainer);
    const b=dentro?bloqueDe(el,r.startContainer):null, t=b&&b.dataset?b.dataset.t:"";
    // Las marcas se miran en el propio texto (los títulos ya son gruesos y el navegador los daría por negrita)
    const marcas=new Set(); if(dentro) for(let n=r.startContainer; n&&n!==el; n=n.parentNode) if(n.nodeType===1) marcas.add(n.nodeName);
    const tiene=(...x)=>x.some(m=>marcas.has(m));
    const on={h1:t==="h1",h2:t==="h2",ck:t==="ck",ul:t==="ul",ol:t==="ol",cita:t==="cita",b:tiene("B","STRONG"),i:tiene("I","EM"),u:tiene("U"),s:tiene("S","STRIKE","DEL"),enlace:tiene("A"),hr:false};
    for(const btn of barra.querySelectorAll("[data-rc]")) btn.setAttribute("aria-pressed",String(!!on[btn.dataset.rc]));
  }

  // ---------------------------------------------------------------- montaje
  // opciones: {limite(n): true si n caracteres más superan el límite de la libreta}
  function montar(el,barra,opciones={}){
    document.execCommand("defaultParagraphSeparator",false,"div");
    el.addEventListener("beforeinput",ev=>antesDeEntrada(el,ev,opciones));
    el.addEventListener("keydown",ev=>teclado(el,ev));
    // Casillas: un toque las marca (sin mover el cursor)
    el.addEventListener("pointerdown",ev=>{
      const c=ev.target.closest&&ev.target.closest(".rc-caja"); if(!c||!el.contains(c)) return;
      ev.preventDefault();
      const b=c.parentNode, ok=b.dataset.ok!=="1";
      b.dataset.ok=ok?"1":"0"; c.setAttribute("aria-checked",String(ok)); avisar(el);
    });
    // Ctrl/Cmd + clic abre un enlace
    el.addEventListener("click",ev=>{
      const a=ev.target.closest&&ev.target.closest("a"); if(!a||!el.contains(a)) return;
      if(ev.ctrlKey||ev.metaKey){ ev.preventDefault(); const h=a.getAttribute("href"); if(ENLACE_OK.test(h||"")) window.open(h,"_blank","noopener"); }
    });
    if(barra){
      const panel=barra.parentNode.querySelector(".rc-enlace");
      // La barra no se lleva el foco: el texto sigue seleccionado
      barra.addEventListener("pointerdown",ev=>{ if(ev.target.closest("button")) ev.preventDefault(); });
      barra.addEventListener("click",ev=>{ const btn=ev.target.closest("[data-rc]"); if(!btn) return; aplicar(el,btn.dataset.rc); estado(el,barra); });
      if(panel){
        const input=panel.querySelector("input");
        panel.addEventListener("click",ev=>{ const k=ev.target.closest("[data-rcl]"); if(!k) return;
          if(k.dataset.rcl==="poner") ponerEnlace(el,input.value); else quitarEnlace(el); estado(el,barra); });
        input.addEventListener("keydown",ev=>{ ev.stopPropagation();
          if(ev.key==="Enter"){ ev.preventDefault(); ponerEnlace(el,input.value); }
          else if(ev.key==="Escape"){ ev.preventDefault(); cerrarEnlace(el); } });
      }
      const alCambiar=()=>estado(el,barra);
      document.addEventListener("selectionchange",alCambiar);
      el.addEventListener("input",alCambiar);
      // Al quitar la libreta de la página, se deja de escuchar
      new MutationObserver((m,o)=>{ if(!document.body.contains(el)){ document.removeEventListener("selectionchange",alCambiar); o.disconnect(); } }).observe(document.body,{childList:true,subtree:true});
    }
  }
  // Línea de los apuntes en la que está el cursor (para colocar imágenes)
  function lineaDelCursor(el){
    const r=rango(); if(!r||!el.contains(r.startContainer)) return null;
    const b=bloqueDe(el,r.startContainer); return b?[...el.children].indexOf(b):null;
  }

  return {pintar, fuente, montar, pegar, barraHTML, lineaDelCursor, enLinea, aplicar};
})();

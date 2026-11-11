// La librería de Ascenso: una estantería de libros (EPUB y PDF) con su lector. Se entra por el nombre del autor
// de la frase del día (y, en el móvil, por la barra de abajo). Solo existe en la aplicación nueva, no en la clásica.
//
// Cada libro es un registro más (ver servidor-local.js): su ficha, por dónde va la lectura y los subrayados se
// sincronizan con la cuenta como todo lo demás; el archivo, solo si cabe en el almacenamiento (ver sync.js).
// El contenido de un libro no es de fiar: el EPUB se muestra ya limpio (epub.js) y el PDF lo pinta pdf.js en un lienzo.
"use strict";
window.AscensoLibreria=(()=>{
  const Local=window.AscensoLocal, Epub=window.AscensoEpub, Sync=window.AscensoSync, config=window.ASCENSO_CONFIG||{};
  const nada={disponible:false, abierta:()=>false, nivel:()=>0, atras:()=>false, abrir(){}, cerrar(){}};
  if(config.clasico||!Local||!Epub||!window.indexedDB) return nada;

  const $=id=>document.getElementById(id);
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const nuevoId=()=>"l"+[...crypto.getRandomValues(new Uint8Array(10))].map(x=>x.toString(16).padStart(2,"0")).join("");
  const MAX_LIBRO=300*1024*1024, LIMITE_CUENTA=Sync&&Sync.LIMITE_ARCHIVO||0;
  const COLORES=["amarillo","verde","azul","rosa"];
  const tamano=b=>b>=1048576?(b/1048576).toFixed(b>=10485760?0:1).replace(".",",")+" MB":Math.max(1,Math.round(b/1024))+" KB";
  const pct=p=>Math.round((p||0)*100)+" %";
  const tactil=()=>matchMedia("(pointer: coarse)").matches;
  const ICONO={
    indice:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h9"/></svg>',
    notas:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10.500-10.500a2.100 2.100 0 0 0-3-3L5 17v3z"/><path d="M13.500 6.500l3 3"/></svg>',
    menos:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg>',
    mas:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12M12 6v12"/></svg>',
  };

  // ---------------------------------------------------------------- datos
  let datos={libros:{},lecturas:{},subrayados:{},archivos:{}};
  const cargar=async()=>{ datos=await Local.api("GET","libreria"); };
  const sesion=()=>!!(Sync&&Sync.informe&&Sync.informe().email);
  const subrayadosDe=(id,lugar)=>Object.entries(datos.subrayados).filter(([,s])=>s.libro===id&&(lugar===undefined||s.lugar===lugar))
    .sort((a,b)=>a[1].lugar-b[1].lugar||a[1].ini-b[1].ini);

  // ---------------------------------------------------------------- la estantería
  const vista=document.createElement("div");
  vista.className="boards libreria"; vista.id="libreria"; vista.hidden=true;
  vista.innerHTML=`<header class="bv-top lb-top">
      <button type="button" class="bv-brand" id="lb-volver" aria-label="Ascenso. Volver al día">Ascenso</button>
      <h2 class="lb-nombre">Librería</h2>
      <label class="add lb-anadir">+ Añadir libro<input type="file" class="lb-archivo" accept=".epub,.pdf,application/epub+zip,application/pdf" multiple hidden></label>
    </header>
    <div class="bv-body"><div class="bh" id="lb-cuerpo"></div></div>`;
  const barra=$("barra"); document.body.insertBefore(vista,barra||null);
  const cuerpo=$("lb-cuerpo");
  let aviso=null, ocupada=false;                       // aviso: {texto, nivel}

  const TONOS=["#2e6f8e","#8e4a2e","#3d7a5a","#6a4a8e","#8e2e4f","#4a5f8e","#7a6a2e","#2e7a78"];
  const tono=t=>{ let h=0; for(const c of t) h=(h*31+c.codePointAt(0))>>>0; return TONOS[h%TONOS.length]; };
  function estadoArchivo(l){
    const a=datos.archivos[l.archivo]||{};
    if(a.aqui) return "";
    return a.cuenta&&sesion()&&l.bytes<=LIMITE_CUENTA?"Se descargará al abrirlo":"El archivo no está en este dispositivo";
  }
  function pintar(){
    if(vista.hidden) return;
    const libros=Object.entries(datos.libros).sort((a,b)=>{
      const la=datos.lecturas[a[0]], lb=datos.lecturas[b[0]];
      return ((lb&&lb.leido)||"").localeCompare((la&&la.leido)||"")||b[1].creado.localeCompare(a[1].creado);
    });
    const tarjetas=libros.map(([id,l])=>{
      const lec=datos.lecturas[id], falta=estadoArchivo(l);
      return `<article class="lb-libro${falta?" lb-fuera":""}">
        <button type="button" class="lb-abrir" data-abrir="${id}" aria-label="Abrir «${esc(l.titulo)}»">
          <span class="lb-portada" style="--bc:${tono(l.titulo)}">${l.portada?`<img src="${esc(l.portada)}" alt="">`:`<span class="lb-pt">${esc(l.titulo)}</span>`}<span class="lb-formato">${l.formato.toUpperCase()}</span></span>
          <span class="lb-avance" aria-hidden="true"><i style="width:${lec?Math.round(lec.pct*100):0}%"></i></span>
          <strong>${esc(l.titulo)}</strong>
          ${l.autor?`<small>${esc(l.autor)}</small>`:""}
          <small class="lb-estado">${esc(falta||(lec?pct(lec.pct)+" leído":"Sin empezar"))}</small>
        </button>
        <button type="button" class="bl-more lb-mas" data-ficha="${id}" aria-label="Ficha de «${esc(l.titulo)}»">⋯</button>
      </article>`;
    }).join("");
    cuerpo.innerHTML=`
      <p class="lb-aviso" role="status" data-nivel="${aviso?aviso.nivel:""}"${aviso?"":" hidden"}>${aviso?esc(aviso.texto):""}</p>
      ${libros.length?"":`<p class="bh-empty">Aún no hay libros. Añade un EPUB o un PDF para empezar a leer.</p>`}
      <div class="lb-estante">${tarjetas}
        <label class="bcard bnew lb-nuevo"${ocupada?' aria-disabled="true"':""}><span>${ocupada?"Añadiendo…":"+ Añadir libro"}</span><input type="file" class="lb-archivo" accept=".epub,.pdf,application/epub+zip,application/pdf" multiple hidden${ocupada?" disabled":""}></label>
      </div>
      <p class="hint">Se admiten libros en EPUB y PDF (sin protección). Se guardan en este dispositivo${Sync&&Sync.disponible?"; con la sesión iniciada, la ficha, la lectura y los subrayados se sincronizan, y también el archivo si pesa menos de "+tamano(LIMITE_CUENTA):""}. Los libros no entran en la copia de seguridad.</p>`;
  }
  const avisar=(texto,nivel)=>{ aviso=texto?{texto,nivel:nivel||""}:null; pintar(); };

  // ---- entrar y salir
  let abriendo=false;
  async function abrir(){
    if(!vista.hidden||abriendo) return;
    abriendo=true;
    try{ await cargar(); }catch(e){ /* se muestra vacía */ }
    abriendo=false;
    for(const d of document.querySelectorAll("dialog[open]")) d.close();
    if(typeof closeCal==="function") closeCal(); if(typeof closePad==="function") closePad();
    $("boardsview").hidden=true; document.querySelector("main").hidden=true;
    vista.hidden=false; aviso=null; pintar(); scrollTo(0,0);
  }
  function cerrar(){
    if(vista.hidden) return;
    if(L) cerrarLector();
    vista.hidden=true;
    if(typeof showDay==="function") showDay(); else document.querySelector("main").hidden=false;
  }

  // ---------------------------------------------------------------- añadir libros
  let pdfjs=null;
  async function cargarPdfjs(){
    if(!pdfjs){
      const base=new URL("assets/vendor/pdfjs/",document.baseURI).href, m=await import(base+"pdf.min.mjs");
      m.GlobalWorkerOptions.workerSrc=base+"pdf.worker.min.mjs";
      pdfjs={m,base};
    }
    return pdfjs;
  }
  // (pdf.js se queda con los datos que recibe: quien llama pasa una copia si los necesita después)
  async function abrirPdf(buf){
    const {m,base}=await cargarPdfjs();
    try{ return await m.getDocument({data:new Uint8Array(buf),isEvalSupported:false,useWasm:false,wasmUrl:base+"wasm/",enableXfa:false,verbosity:0}).promise; }
    catch(e){ throw new Error(e&&e.name==="PasswordException"?"el PDF tiene contraseña":"no se pudo abrir el PDF"); }
  }
  // Suelta el documento y su trabajador
  function cerrarPdf(doc){ try{ const t=doc&&(doc.loadingTask||doc); if(t&&t.destroy) Promise.resolve(t.destroy()).catch(()=>{}); }catch(e){} }
  function aJpeg(fuente,w,h){
    if(!(w>0&&h>0)) return "";
    const W=240, alto=Math.round(h*W/w), c=document.createElement("canvas");
    c.width=W; c.height=Math.min(alto,Math.round(W*1.7));
    const x=c.getContext("2d"); x.fillStyle="#fff"; x.fillRect(0,0,c.width,c.height); x.drawImage(fuente,0,0,W,alto);
    try{ for(const q of [0.72,0.55,0.4]){ const d=c.toDataURL("image/jpeg",q); if(d.length<=110000) return d; } }catch(e){}
    return "";
  }
  async function miniatura(blob){
    if(!blob) return "";
    const u=URL.createObjectURL(blob);
    try{ const im=new Image(); im.src=u; await im.decode(); return aJpeg(im,im.naturalWidth,im.naturalHeight); }
    catch(e){ return ""; }
    finally{ URL.revokeObjectURL(u); }
  }
  async function miniaturaPdf(doc){
    try{
      const p=await doc.getPage(1), v1=p.getViewport({scale:1}), v=p.getViewport({scale:480/v1.width}), c=document.createElement("canvas");
      c.width=Math.floor(v.width); c.height=Math.floor(v.height);
      await p.render({canvasContext:c.getContext("2d"),canvas:c,viewport:v}).promise;
      return aJpeg(c,c.width,c.height);
    }catch(e){ return ""; }
  }
  const formatoDe=f=>/\.pdf$/i.test(f.name)||f.type==="application/pdf"?"pdf":/\.epub$/i.test(f.name)||f.type==="application/epub+zip"?"epub":null;
  async function leerFicha(formato,buf,nombre){
    let titulo=String(nombre||"").replace(/\.(epub|pdf)$/i,"").replace(/_+/g," ").trim()||"Sin título", autor="", portada="";
    if(formato==="epub"){
      const l=await Epub.abrir(buf);
      titulo=l.titulo||titulo; autor=l.autor; portada=await miniatura(await l.portada());
    } else {
      const d=await abrirPdf(buf.slice(0));
      try{
        const info=((await d.getMetadata().catch(()=>null))||{}).info||{}, limpio=v=>typeof v==="string"?v.replace(/\s+/g," ").trim():"";
        if(limpio(info.Title)&&!/^(untitled|sin t[ií]tulo|microsoft word)/i.test(limpio(info.Title))) titulo=limpio(info.Title);
        autor=limpio(info.Author); portada=await miniaturaPdf(d);
      } finally { cerrarPdf(d); }
    }
    return {titulo:titulo.slice(0,200),autor:autor.slice(0,200),portada};
  }
  async function anadirUno(f){
    const formato=formatoDe(f);
    if(!formato) throw new Error("solo se admiten EPUB y PDF");
    if(!(f.size>0)) throw new Error("el archivo está vacío");
    if(f.size>MAX_LIBRO) throw new Error("pesa más de "+tamano(MAX_LIBRO));
    const buf=await f.arrayBuffer(), ficha=await leerFicha(formato,buf,f.name);
    if(Object.values(datos.libros).some(l=>l.titulo===ficha.titulo&&l.bytes===buf.byteLength)) throw new Error("ya está en la librería");
    const id=nuevoId(), archivo=nuevoId();
    await Local.guardarArchivo(archivo,formato,buf);
    await Local.api("PUT","libros/"+id,{...ficha,formato,bytes:buf.byteLength,archivo});
  }
  async function anadir(archivos){
    archivos=[...archivos||[]];
    if(!archivos.length||ocupada) return;
    ocupada=true; const fallos=[]; let hechos=0;
    for(const f of archivos){
      avisar("Añadiendo «"+f.name+"»…");
      try{ await anadirUno(f); hechos++; }
      catch(e){ fallos.push("«"+f.name+"»: "+(e&&e.message||"no se pudo añadir")); }
      try{ await cargar(); }catch(e){}
    }
    ocupada=false;
    const grandes=sesion()?archivos.filter(f=>f.size>LIMITE_CUENTA&&!fallos.some(x=>x.includes("«"+f.name+"»"))).length:0;
    avisar(fallos.length?fallos.join(" · "):grandes?(grandes===1?"El libro pesa":"Algunos libros pesan")+" más de "+tamano(LIMITE_CUENTA)+": el archivo se queda solo en este dispositivo.":
      hechos===1?"Libro añadido.":hechos+" libros añadidos.",fallos.length?"error":"");
  }
  vista.addEventListener("change",e=>{ const i=e.target.closest("input.lb-archivo"); if(i){ const fs=[...i.files]; i.value=""; anadir(fs); } });
  vista.addEventListener("dragover",e=>{ if(e.dataTransfer&&[...e.dataTransfer.types].includes("Files")) e.preventDefault(); });
  vista.addEventListener("drop",e=>{ if(e.dataTransfer&&e.dataTransfer.files.length){ e.preventDefault(); anadir(e.dataTransfer.files); } });
  vista.addEventListener("click",e=>{
    if(e.target.closest("#lb-volver")){ cerrar(); return; }
    const a=e.target.closest("[data-abrir]"), f=e.target.closest("[data-ficha]");
    if(f) abrirFicha(f.dataset.ficha); else if(a) abrirLibro(a.dataset.abrir);
  });

  // ---------------------------------------------------------------- ficha de un libro (título, autor, quitar)
  let ficha=null, fichaId=null, fichaQuitar=false, fichaError="";
  function abrirFicha(id){
    if(!datos.libros[id]) return;
    if(!ficha){
      ficha=document.createElement("dialog"); ficha.className="tdlg cuenta lb-ficha"; ficha.id="lb-ficha"; ficha.setAttribute("aria-label","Ficha del libro");
      document.body.appendChild(ficha);
      ficha.addEventListener("mousedown",e=>{ ficha._fondo=e.target===ficha; });
      ficha.addEventListener("click",e=>{
        if(e.target===ficha&&ficha._fondo){ ficha.close(); return; }
        const b=e.target.closest("[data-f]"); if(!b) return;
        if(b.dataset.f==="cerrar") ficha.close();
        else if(b.dataset.f==="quitar"){ if(!fichaQuitar){ fichaQuitar=true; pintarFicha(); } else quitarLibro(fichaId); }
        else if(b.dataset.f==="traer") ficha.querySelector(".lb-traer").click();
      });
      ficha.addEventListener("change",e=>{ const i=e.target.closest(".lb-traer"); if(i&&i.files[0]) traerArchivo(fichaId,i.files[0]).then(pintarFicha); });
      ficha.addEventListener("submit",e=>{ e.preventDefault(); guardarFicha(); });
      ficha.addEventListener("close",()=>{ ficha.innerHTML=""; fichaId=null; });
    }
    fichaId=id; fichaQuitar=false; fichaError="";
    pintarFicha();
    if(!ficha.open) ficha.showModal();
  }
  function pintarFicha(){
    const l=datos.libros[fichaId]; if(!l||!ficha){ if(ficha&&ficha.open) ficha.close(); return; }
    const falta=estadoArchivo(l), n=subrayadosDe(fichaId).length, fecha=new Date(l.creado);
    ficha.innerHTML=`<div class="dlg-head"><h3 class="c-titulo">Ficha del libro</h3><button type="button" class="dlg-x" data-f="cerrar" aria-label="Cerrar">×</button></div>
      <form class="c-cuerpo">
        <p class="c-error" role="alert"${fichaError?"":" hidden"}>${esc(fichaError)}</p>
        <label class="c-campo"><span>Título</span><input name="titulo" type="text" maxlength="200" required value="${esc(l.titulo)}"></label>
        <label class="c-campo"><span>Autor</span><input name="autor" type="text" maxlength="200" value="${esc(l.autor)}"></label>
        <p class="c-nota">${l.formato.toUpperCase()} · ${tamano(l.bytes)}${isNaN(fecha)?"":" · añadido el "+fecha.toLocaleDateString("es-ES",{day:"numeric",month:"long",year:"numeric"})}${n?" · "+n+(n===1?" subrayado":" subrayados"):""}</p>
        ${falta?`<p class="c-nota">${esc(falta)}. <button type="button" class="linklike" data-f="traer">Elegir el archivo</button><input type="file" class="lb-traer" accept=".${l.formato}" hidden></p>`:""}
        <div class="c-botones"><button type="submit" class="add c-pral">Guardar</button>
          <button type="button" class="add alt lb-quitar" data-f="quitar">${fichaQuitar?"Sí, quitar el libro"+(n?" y sus subrayados":""):"Quitar el libro"}</button></div>
        ${fichaQuitar?`<p class="c-nota">Se quita de todos tus dispositivos. No se puede deshacer.</p>`:""}
      </form>`;
  }
  async function guardarFicha(){
    const l=datos.libros[fichaId], f=ficha.querySelector("form"); if(!l) return;
    try{
      await Local.api("PUT","libros/"+fichaId,{...l,titulo:f.titulo.value,autor:f.autor.value});
      await cargar(); ficha.close(); pintar();
    }catch(e){ fichaError=e.message||"No se pudo guardar."; pintarFicha(); }
  }
  async function quitarLibro(id){
    try{ await Local.api("DELETE","libros/"+id); await cargar(); }catch(e){}
    if(ficha&&ficha.open) ficha.close();
    avisar("Libro quitado.");
  }
  // El archivo de un libro que llegó de otro dispositivo sin él: se elige aquí y queda guardado
  async function traerArchivo(id,f){
    const l=datos.libros[id]; if(!l) return false;
    try{
      if(formatoDe(f)!==l.formato) throw new Error("El archivo debe ser un "+l.formato.toUpperCase()+".");
      if(f.size>MAX_LIBRO) throw new Error("El archivo pesa más de "+tamano(MAX_LIBRO)+".");
      await Local.guardarArchivo(l.archivo,l.formato,await f.arrayBuffer());
      await cargar(); fichaError=""; pintar(); return true;
    }catch(e){ fichaError=e.message||"No se pudo guardar el archivo."; return false; }
  }

  // ======================================================================
  // El lector
  // ======================================================================
  const lector=document.createElement("div");
  lector.className="lector"; lector.id="lector"; lector.hidden=true;
  lector.setAttribute("role","dialog"); lector.setAttribute("aria-label","Lector");
  lector.innerHTML=`<header class="lc-top">
      <button type="button" class="lc-b" data-l="cerrar" aria-label="Volver a la librería">‹</button>
      <div class="lc-tit"><strong id="lc-titulo"></strong><small id="lc-autor"></small></div>
      <button type="button" class="lc-b" data-l="indice" aria-label="Índice">${ICONO.indice}</button>
      <button type="button" class="lc-b" data-l="notas" aria-label="Subrayados y notas">${ICONO.notas}</button>
      <button type="button" class="lc-b lc-aa" data-l="ajustes" aria-label="Ajustes de lectura">Aa</button>
    </header>
    <div class="lc-area" id="lc-area" tabindex="0">
      <p class="lc-cargando" id="lc-cargando" role="status"></p>
      <article class="lc-texto" id="lc-texto" hidden></article>
      <div class="lc-fin" id="lc-fin" hidden><button type="button" class="add alt" data-l="sig">Siguiente capítulo →</button></div>
      <div class="lc-pdf" id="lc-pdf" hidden></div>
    </div>
    <footer class="lc-pie">
      <button type="button" class="lc-b" data-l="ant" id="lc-ant">‹</button>
      <span class="lc-donde" id="lc-donde"></span>
      <button type="button" class="lc-b" data-l="sig" id="lc-sig">›</button>
    </footer>
    <aside class="lc-panel" id="lc-panel" hidden></aside>
    <div class="lc-sel" id="lc-sel" role="toolbar" aria-label="Subrayar" hidden>${COLORES.map(c=>`<button type="button" class="lc-color" data-color="${c}" aria-label="Subrayar en ${c}"></button>`).join("")}<button type="button" class="lc-sel-nota" data-color="nota">Nota</button></div>`;
  document.body.insertBefore(lector,barra||null);
  const area=$("lc-area"), texto=$("lc-texto"), hojas=$("lc-pdf"), panel=$("lc-panel"), selBarra=$("lc-sel"), donde=$("lc-donde"), cargando=$("lc-cargando");

  // Ajustes de lectura: son de este dispositivo (no viajan a la cuenta)
  const AJUSTES_DEFECTO={tam:100,letra:"serif",tema:"auto"};
  let ajustes=(()=>{ try{ const a=JSON.parse(localStorage.getItem("ascenso-lector")||"{}");
    return {tam:Math.min(180,Math.max(70,Number(a.tam)||100)),letra:a.letra==="sans"?"sans":"serif",tema:["auto","claro","sepia","oscuro"].includes(a.tema)?a.tema:"auto"}; }catch(e){ return {...AJUSTES_DEFECTO}; } })();
  function aplicarAjustes(){
    lector.dataset.tema=ajustes.tema; lector.dataset.letra=ajustes.letra; lector.style.setProperty("--lc-tam",ajustes.tam/100);
    try{ localStorage.setItem("ascenso-lector",JSON.stringify(ajustes)); }catch(e){}
  }

  // L: el libro abierto. {id, libro, formato, lugar, frac, epub|pdf, …}
  let L=null, turno=0;
  const esperar=ms=>new Promise(r=>setTimeout(r,ms));

  async function abrirLibro(id){
    const libro=datos.libros[id]; if(!libro||L) return;
    const mio=++turno;
    L={id,libro,formato:libro.formato,lugar:0,frac:0,urls:[],zoom:1,guardado:""};
    lector.hidden=false; lector.dataset.formato=libro.formato; document.body.classList.add("leyendo");
    $("lc-titulo").textContent=libro.titulo; $("lc-autor").textContent=libro.autor||"";
    texto.hidden=true; hojas.hidden=true; $("lc-fin").hidden=true; texto.replaceChildren(); hojas.replaceChildren(); donde.textContent="";
    $("lc-ant").setAttribute("aria-label",libro.formato==="pdf"?"Página anterior":"Capítulo anterior");
    $("lc-sig").setAttribute("aria-label",libro.formato==="pdf"?"Página siguiente":"Capítulo siguiente");
    aplicarAjustes(); cerrarPanel(); decir("Abriendo el libro…");
    area.focus({preventScroll:true});
    try{
      const buf=await Local.leerArchivo(libro.archivo);
      if(mio!==turno) return;
      if(!buf){ sinArchivo(); return; }
      const lec=datos.lecturas[id]||{lugar:0,frac:0};
      if(libro.formato==="epub"){
        L.epub=await Epub.abrir(buf);
        if(mio!==turno) return;
        L.total=L.epub.capitulos.reduce((s,c)=>s+c.bytes,0)||1;
        await mostrarCapitulo(Math.min(lec.lugar,L.epub.capitulos.length-1),{frac:lec.frac});
      } else {
        L.pdf=await abrirPdf(buf);
        if(mio!==turno){ L&&cerrarPdf(L.pdf); return; }
        await montarPdf(Math.min(lec.lugar,L.pdf.numPages-1),lec.frac);
      }
    }catch(e){ if(mio===turno) decir("No se pudo abrir el libro: "+(e&&e.message||"error")+"."); }
  }
  function decir(t,html){ cargando.hidden=!t; if(html) cargando.innerHTML=html; else cargando.textContent=t||""; }
  function sinArchivo(){
    const l=L.libro, enCuenta=(datos.archivos[l.archivo]||{}).cuenta&&sesion()&&l.bytes<=LIMITE_CUENTA;
    decir("x",`<span>${enCuenta?"No se pudo descargar el archivo de este libro. Comprueba la conexión e inténtalo de nuevo, o elige el archivo.":"El archivo de este libro no está en este dispositivo: se añadió en otro y pesa demasiado para la cuenta, o aún no se ha subido."}</span>
      <label class="add lc-traer">Elegir el archivo<input type="file" accept=".${l.formato}" hidden></label><span class="lc-error" role="alert"></span>`);
  }
  cargando.addEventListener("change",async e=>{
    const i=e.target.closest("input[type=file]"); if(!i||!i.files[0]||!L) return;
    const id=L.id, ok=await traerArchivo(id,i.files[0]);
    if(!ok){ const s=cargando.querySelector(".lc-error"); if(s) s.textContent=fichaError; return; }
    cerrarLector(); abrirLibro(id);
  });

  function cerrarLector(){
    if(!L) return;
    guardarLectura(true);
    turno++;
    const l=L; L=null;
    for(const u of l.urls) URL.revokeObjectURL(u);
    if(l.obs) l.obs.disconnect();
    cerrarPdf(l.pdf);
    cerrarPanel(); ocultarSel();
    lector.hidden=true; document.body.classList.remove("leyendo");
    texto.replaceChildren(); hojas.replaceChildren();
    cargar().then(pintar,()=>{});
  }

  // ---------------------------------------------------------------- por dónde va la lectura
  let tGuardar=null;
  function porcentaje(){
    if(!L) return 0;
    if(L.epub){ let antes=0; for(let i=0;i<L.lugar;i++) antes+=L.epub.capitulos[i].bytes; return Math.min(1,(antes+L.frac*L.epub.capitulos[L.lugar].bytes)/L.total); }
    if(L.pdf) return Math.min(1,(L.lugar+L.frac)/L.pdf.numPages);
    return 0;
  }
  function guardarLectura(ya){
    clearTimeout(tGuardar);
    if(!L||(!L.epub&&!L.pdf)||!L.listo) return;
    const hacer=()=>{
      if(!L||!datos.libros[L.id]) return;
      const v={lugar:L.lugar,frac:Math.round(L.frac*10000)/10000,pct:Math.round(porcentaje()*10000)/10000}, clave=JSON.stringify(v);
      if(clave===L.guardado) return;
      L.guardado=clave; datos.lecturas[L.id]={...v,leido:new Date().toISOString()};
      Local.api("PUT","lecturas/"+L.id,datos.lecturas[L.id]).catch(()=>{});
    };
    if(ya) hacer(); else tGuardar=setTimeout(hacer,2500);
  }
  function pintarDonde(){
    if(!L) return;
    if(L.epub) donde.textContent="Capítulo "+(L.lugar+1)+" de "+L.epub.capitulos.length+" · "+pct(porcentaje());
    else if(L.pdf){
      if(!donde.querySelector("input")) donde.innerHTML=`<label>Página <input type="number" id="lc-pag" min="1" max="${L.pdf.numPages}" inputmode="numeric" aria-label="Ir a la página"> de ${L.pdf.numPages}</label>`;
      const i=donde.querySelector("input"); if(document.activeElement!==i) i.value=L.lugar+1;
    }
    $("lc-ant").disabled=L.lugar<=0;
    $("lc-sig").disabled=L.lugar>=(L.epub?L.epub.capitulos.length:L.pdf?L.pdf.numPages:1)-1;
  }
  let enMarcha=false;
  area.addEventListener("scroll",()=>{
    ocultarSel(true);
    if(enMarcha||!L||!L.listo) return; enMarcha=true;
    requestAnimationFrame(()=>{ enMarcha=false; if(!L||!L.listo) return;
      if(L.epub){ const max=area.scrollHeight-area.clientHeight; L.frac=max>0?Math.min(1,area.scrollTop/max):0; }
      else if(L.pdf) situarPdf();
      pintarDonde(); guardarLectura();
    });
  },{passive:true});
  addEventListener("pagehide",()=>guardarLectura(true));
  document.addEventListener("visibilitychange",()=>{ if(document.hidden) guardarLectura(true); });

  // ---------------------------------------------------------------- subrayados: se guardan como posiciones dentro del texto
  const nodosTexto=raiz=>{ const w=document.createTreeWalker(raiz,NodeFilter.SHOW_TEXT), l=[]; for(let n;(n=w.nextNode());) l.push(n); return l; };
  const posicion=(raiz,nodo,off)=>{ const r=document.createRange(); r.selectNodeContents(raiz); r.setEnd(nodo,off); return r.toString().length; };
  function marcar(raiz,id,s){
    let ini=s.ini, fin=s.fin; const todo=raiz.textContent;
    // Si el texto ya no cae donde estaba (otra versión del lector), se busca por su contenido
    if(s.texto&&todo.slice(ini,ini+s.texto.length)!==s.texto){ const i=todo.indexOf(s.texto); if(i<0) return; fin=i+(fin-ini); ini=i; }
    let pos=0;
    for(const n of nodosTexto(raiz)){
      const largo=n.data.length, a=Math.max(ini,pos), b=Math.min(fin,pos+largo);
      if(a<b){
        let trozo=n; if(a>pos) trozo=trozo.splitText(a-pos); if(b<pos+largo) trozo.splitText(b-a);
        const m=document.createElement("mark"); m.className="lc-marca"; m.dataset.sub=id; m.dataset.color=s.color; if(s.nota) m.dataset.nota="1";
        trozo.parentNode.insertBefore(m,trozo); m.appendChild(trozo);
      }
      pos+=largo; if(pos>=fin) break;
    }
  }
  function desmarcar(raiz,id){
    for(const m of raiz.querySelectorAll('mark[data-sub="'+CSS.escape(id)+'"]')){ const p=m.parentNode; m.replaceWith(...m.childNodes); p.normalize(); }
  }
  const raizDe=nodo=>{ const el=nodo&&(nodo.nodeType===1?nodo:nodo.parentElement); return el?el.closest("#lc-texto, .lc-capa"):null; };
  const lugarDe=raiz=>raiz===texto?L.lugar:Number(raiz.dataset.pagina);
  const raizDeLugar=lugar=>L.epub?(lugar===L.lugar?texto:null):hojas.querySelector('.lc-capa[data-pagina="'+lugar+'"]');
  function marcarTodo(raiz){
    for(const m of [...raiz.querySelectorAll("mark.lc-marca")]) desmarcar(raiz,m.dataset.sub);
    for(const [id,s] of subrayadosDe(L.id,lugarDe(raiz))) marcar(raiz,id,s);
  }

  // ---- la barrita que aparece al seleccionar texto
  let seleccion=null, tSel=null, enBarra=false;
  function ocultarSel(soloSiNoHay){ if(soloSiNoHay&&seleccion&&!getSelection().isCollapsed) return; selBarra.hidden=true; if(!enBarra) seleccion=null; }
  function mirarSeleccion(){
    if(!L||enBarra) return;
    const s=getSelection();
    if(!s||s.isCollapsed||!s.rangeCount){ ocultarSel(); return; }
    const r=s.getRangeAt(0), raiz=raizDe(r.startContainer);
    if(!raiz||raiz!==raizDe(r.endContainer)){ ocultarSel(); return; }
    const ini=posicion(raiz,r.startContainer,r.startOffset), fin=posicion(raiz,r.endContainer,r.endOffset);
    if(!(fin>ini)||fin-ini>20000||!raiz.textContent.slice(ini,fin).trim()){ ocultarSel(); return; }
    seleccion={raiz,lugar:lugarDe(raiz),ini,fin};
    selBarra.hidden=false;
    const c=r.getBoundingClientRect(), w=selBarra.offsetWidth, h=selBarra.offsetHeight;
    if(tactil()){ selBarra.style.left="50%"; selBarra.style.top=""; selBarra.style.bottom="calc(64px + env(safe-area-inset-bottom, 0px))"; selBarra.style.transform="translateX(-50%)"; }
    else {
      selBarra.style.transform=""; selBarra.style.bottom="";
      selBarra.style.left=Math.min(Math.max(8,c.left+c.width/2-w/2),innerWidth-w-8)+"px";
      selBarra.style.top=(c.top-h-10>56?c.top-h-10:Math.min(c.bottom+10,innerHeight-h-60))+"px";
    }
  }
  document.addEventListener("selectionchange",()=>{ if(!L) return; clearTimeout(tSel); tSel=setTimeout(mirarSeleccion,180); });
  selBarra.addEventListener("pointerdown",e=>{ enBarra=true; if(e.pointerType==="mouse") e.preventDefault(); });
  selBarra.addEventListener("click",async e=>{
    const b=e.target.closest("[data-color]"), s=seleccion; enBarra=false;
    if(!b||!s||!L){ ocultarSel(); return; }
    const conNota=b.dataset.color==="nota", id=nuevoId();
    const sub={libro:L.id,lugar:s.lugar,ini:s.ini,fin:s.fin,texto:s.raiz.textContent.slice(s.ini,s.fin).slice(0,1000),nota:"",color:conNota?"amarillo":b.dataset.color,creado:new Date().toISOString()};
    getSelection().removeAllRanges(); seleccion=null; selBarra.hidden=true;
    try{ await Local.api("PUT","subrayados/"+id,sub); }catch(err){ return; }
    datos.subrayados[id]=sub;
    if(s.raiz.isConnected) marcar(s.raiz,id,sub);
    if(conNota) abrirPanel("marca",id);
  });
  async function cambiarSubrayado(id,cambios){
    const s=datos.subrayados[id]; if(!s) return;
    Object.assign(s,cambios);
    for(const m of lector.querySelectorAll('mark[data-sub="'+CSS.escape(id)+'"]')){ m.dataset.color=s.color; if(s.nota) m.dataset.nota="1"; else delete m.dataset.nota; }
    try{ await Local.api("PUT","subrayados/"+id,s); }catch(e){}
  }
  async function quitarSubrayado(id){
    const s=datos.subrayados[id]; if(!s) return;
    delete datos.subrayados[id];
    const raiz=raizDeLugar(s.lugar); if(raiz) desmarcar(raiz,id);
    try{ await Local.api("DELETE","subrayados/"+id); }catch(e){}
  }

  // ---------------------------------------------------------------- EPUB
  async function mostrarCapitulo(i,{frac=0,ancla="",marca=""}={}){
    const mio=turno, l=L;
    l.listo=false; decir("Cargando…"); cerrarPanel(); ocultarSel();
    const frag=await l.epub.capitulo(i);
    if(mio!==turno) return;
    for(const u of l.urls) URL.revokeObjectURL(u); l.urls=[];
    l.lugar=i; l.frac=frac;
    texto.replaceChildren(frag); texto.hidden=false; decir("");
    $("lc-fin").hidden=i>=l.epub.capitulos.length-1;
    // Las imágenes salen del propio libro
    const imagenes=[...texto.querySelectorAll("img[data-ruta]")].map(async im=>{
      try{
        const b=await l.epub.imagen(im.dataset.ruta); if(!b||mio!==turno) return;
        const u=URL.createObjectURL(b); l.urls.push(u); im.src=u;
        await im.decode().catch(()=>{});
      }catch(e){}
    });
    marcarTodo(texto);
    await Promise.race([Promise.all(imagenes),esperar(1500)]);
    if(mio!==turno) return;
    const el=marca?texto.querySelector('mark[data-sub="'+CSS.escape(marca)+'"]'):ancla?texto.querySelector('[data-ancla="'+CSS.escape(ancla)+'"]'):null;
    if(el){ area.scrollTop=Math.max(0,el.getBoundingClientRect().top-area.getBoundingClientRect().top+area.scrollTop-(marca?area.clientHeight/3:12)); if(marca) destello(marca); }
    else area.scrollTop=frac*Math.max(0,area.scrollHeight-area.clientHeight);
    const max=area.scrollHeight-area.clientHeight; l.frac=max>0?Math.min(1,area.scrollTop/max):0;
    l.listo=true; pintarDonde(); guardarLectura();
  }
  function destello(id){
    for(const m of lector.querySelectorAll('mark[data-sub="'+CSS.escape(id)+'"]')){ m.classList.add("lc-destello"); setTimeout(()=>m.classList.remove("lc-destello"),1600); }
  }

  // ---------------------------------------------------------------- PDF
  const MAX_PIXELES=()=>tactil()?5e6:12e6;
  function anchoHoja(){ return Math.max(120,Math.min(area.clientWidth-(area.clientWidth<600?12:48),920)*L.zoom); }
  function dimensionar(){ const w=anchoHoja(); for(const p of L.paginas){ p.el.style.width=w+"px"; p.el.style.height=Math.round(w*p.h/p.w)+"px"; } }
  async function montarPdf(lugar,frac){
    const l=L, mio=turno, p1=await l.pdf.getPage(1), v=p1.getViewport({scale:1});
    if(mio!==turno) return;
    l.paginas=[];
    const f=document.createDocumentFragment();
    for(let i=0;i<l.pdf.numPages;i++){
      const el=document.createElement("div"); el.className="lc-hoja"; el.dataset.hoja=i; el.setAttribute("aria-label","Página "+(i+1));
      f.appendChild(el); l.paginas.push({i,el,w:v.width,h:v.height,ancho:0,vista:false,gen:0});
    }
    hojas.replaceChildren(f); hojas.hidden=false; decir("");
    dimensionar();
    l.obs=new IntersectionObserver(es=>{ for(const e of es){ const p=l.paginas[Number(e.target.dataset.hoja)]; if(p) p.vista=e.isIntersecting; } pintarHojas(); },{root:area,rootMargin:"700px 0px"});
    for(const p of l.paginas) l.obs.observe(p.el);
    irAPagina(lugar,frac);
    l.lugar=lugar; l.frac=frac; l.listo=true; pintarDonde();
  }
  function irAPagina(i,frac){ const p=L.paginas[Math.min(Math.max(0,i),L.paginas.length-1)]; area.scrollTop=p.el.offsetTop-hojas.offsetTop+(frac||0)*p.el.offsetHeight; }
  function situarPdf(){
    const y=area.scrollTop+hojas.offsetTop+area.clientHeight*0.25;
    let a=0, b=L.paginas.length-1;
    while(a<b){ const m=(a+b+1)>>1; if(L.paginas[m].el.offsetTop<=y) a=m; else b=m-1; }
    const el=L.paginas[a].el; L.lugar=a;
    L.frac=Math.min(1,Math.max(0,(area.scrollTop+hojas.offsetTop-el.offsetTop)/Math.max(1,el.offsetHeight)));
  }
  let pintando=false;
  async function pintarHojas(){
    if(pintando||!L||!L.pdf) return; pintando=true;
    const l=L, mio=turno;
    try{
      for(;;){
        if(mio!==turno) return;
        const w=anchoHoja(), p=l.paginas.find(x=>x.vista&&x.ancho!==w);
        if(!p) break;
        await pintarHoja(l,p,w);
      }
      // Las hojas que quedan lejos sueltan su lienzo: un PDF largo no llena la memoria
      const pintadas=l.paginas.filter(x=>x.ancho&&!x.vista);
      if(pintadas.length>6) for(const p of pintadas.slice(0,pintadas.length-6)){ p.ancho=0; p.el.replaceChildren(); }
    } finally { pintando=false; }
  }
  async function pintarHoja(l,p,w){
    const mio=turno;
    try{
      const pagina=await l.pdf.getPage(p.i+1), v1=pagina.getViewport({scale:1});
      if(mio!==turno) return;
      if(v1.width!==p.w||v1.height!==p.h){ p.w=v1.width; p.h=v1.height; p.el.style.height=Math.round(w*p.h/p.w)+"px"; }
      const escala=w/p.w, alto=w*p.h/p.w, dpr=Math.min(window.devicePixelRatio||1,Math.sqrt(MAX_PIXELES()/(w*alto)));
      const vp=pagina.getViewport({scale:escala*dpr}), lienzo=document.createElement("canvas");
      lienzo.width=Math.floor(vp.width); lienzo.height=Math.floor(vp.height);
      await pagina.render({canvasContext:lienzo.getContext("2d"),canvas:lienzo,viewport:vp}).promise;
      if(mio!==turno) return;
      const capa=document.createElement("div"); capa.className="textLayer lc-capa"; capa.dataset.pagina=p.i;
      p.el.style.setProperty("--scale-factor",escala); p.el.style.setProperty("--total-scale-factor",escala);
      p.el.replaceChildren(lienzo,capa);
      try{
        await new pdfjs.m.TextLayer({textContentSource:await pagina.getTextContent(),container:capa,viewport:pagina.getViewport({scale:escala})}).render();
        if(mio===turno) marcarTodo(capa);
      }catch(e){ /* sin capa de texto la hoja se lee igual; solo no se puede subrayar */ }
      p.ancho=w;
    }catch(e){ p.ancho=w; }                                   // una hoja que falla no bloquea a las demás
  }
  function cambiarZoom(z){
    if(!L||!L.pdf) return;
    z=Math.min(3,Math.max(0.5,Math.round(z*4)/4)); if(z===L.zoom) return;
    const lugar=L.lugar, frac=L.frac;
    L.zoom=z; dimensionar(); irAPagina(lugar,frac); pintarHojas();
  }
  let tAncho=null;
  if(typeof ResizeObserver==="function") new ResizeObserver(()=>{ if(!L||!L.pdf||!L.paginas) return; clearTimeout(tAncho);
    tAncho=setTimeout(()=>{ if(!L||!L.pdf||!L.paginas) return; const lugar=L.lugar, frac=L.frac; dimensionar(); irAPagina(lugar,frac); pintarHojas(); },200); }).observe(area);
  async function indicePdf(){
    if(L.indice) return L.indice;
    const l=L, out=[];
    try{
      const bajar=async(items,nivel)=>{
        for(const it of items||[]){
          if(out.length>=500) return;
          try{
            const dest=typeof it.dest==="string"?await l.pdf.getDestination(it.dest):it.dest;
            if(Array.isArray(dest)&&dest[0]!=null){
              const pag=typeof dest[0]==="object"?await l.pdf.getPageIndex(dest[0]):Number(dest[0]);
              if(Number.isInteger(pag)&&pag>=0) out.push({titulo:String(it.title||"").replace(/\s+/g," ").trim().slice(0,300)||"Sin título",nivel:Math.min(nivel,4),lugar:pag});
            }
          }catch(e){}
          await bajar(it.items,nivel+1);
        }
      };
      await bajar(await l.pdf.getOutline(),0);
    }catch(e){}
    l.indice=out; return out;
  }

  // ---------------------------------------------------------------- ir a un sitio
  async function ir(lugar,opciones={}){
    if(!L||!L.listo) return;
    if(L.epub){
      lugar=Math.min(Math.max(0,lugar),L.epub.capitulos.length-1);
      if(lugar===L.lugar&&(opciones.marca||opciones.ancla)){
        const el=texto.querySelector(opciones.marca?'mark[data-sub="'+CSS.escape(opciones.marca)+'"]':'[data-ancla="'+CSS.escape(opciones.ancla)+'"]');
        if(el){ el.scrollIntoView({block:opciones.marca?"center":"start"}); if(opciones.marca) destello(opciones.marca); return; }
      }
      await mostrarCapitulo(lugar,opciones);
    } else if(L.pdf){
      lugar=Math.min(Math.max(0,lugar),L.pdf.numPages-1);
      irAPagina(lugar,0); situarPdf(); pintarDonde(); guardarLectura();
      if(opciones.marca){
        const id=opciones.marca, mio=turno;
        for(let k=0;k<30&&mio===turno;k++){
          const m=hojas.querySelector('mark[data-sub="'+CSS.escape(id)+'"]');
          if(m){ m.scrollIntoView({block:"center"}); destello(id); break; }
          await esperar(150);
        }
      }
    }
  }

  // ---------------------------------------------------------------- paneles: índice, notas, ajustes y la ficha de un subrayado
  let panelDe=null, panelId=null, tNota=null;
  function cerrarPanel(){ if(panelDe==="marca") guardarNota(); panelDe=null; panelId=null; panel.hidden=true; panel.innerHTML="";
    for(const b of lector.querySelectorAll(".lc-top [aria-expanded]")) b.removeAttribute("aria-expanded"); }
  function guardarNota(){
    clearTimeout(tNota);
    const t=panel.querySelector("textarea"), s=datos.subrayados[panelId];
    if(t&&s&&t.value.slice(0,5000)!==s.nota) cambiarSubrayado(panelId,{nota:t.value.slice(0,5000)});
  }
  const cabeza=t=>`<div class="lc-p-cab"><h3>${esc(t)}</h3><button type="button" class="dlg-x" data-p="cerrar" aria-label="Cerrar">×</button></div>`;
  const dondeEsta=s=>L.pdf?"Página "+(s.lugar+1):((L.epub.indice.find(x=>x.cap===s.lugar)||L.epub.indice.filter(x=>x.cap<s.lugar).pop()||{}).titulo||"Capítulo "+(s.lugar+1));
  async function abrirPanel(cual,id){
    if(!L||!L.listo) return;
    if(panelDe===cual&&cual!=="marca"){ cerrarPanel(); return; }
    cerrarPanel(); panelDe=cual; panelId=id||null;
    const b=lector.querySelector('.lc-top [data-l="'+cual+'"]'); if(b) b.setAttribute("aria-expanded","true");
    let html="";
    if(cual==="indice"){
      let items;
      if(L.epub) items=L.epub.indice.length?L.epub.indice.map(x=>({titulo:x.titulo,nivel:x.nivel,lugar:x.cap,ancla:x.ancla})):L.epub.capitulos.map((c,i)=>({titulo:"Capítulo "+(i+1),nivel:0,lugar:i,ancla:""}));
      else { panel.innerHTML=cabeza("Índice")+`<p class="lc-p-vacio">Cargando…</p>`; panel.hidden=false; items=await indicePdf(); if(panelDe!=="indice"||!L) return; }
      const actual=items.reduce((m,x,i)=>x.lugar<=L.lugar?i:m,-1);
      html=cabeza("Índice")+(items.length?`<ol class="lc-indice">${items.map((x,i)=>`<li><button type="button" data-ir="${x.lugar}" data-ancla="${esc(x.ancla||"")}" style="--nivel:${x.nivel}"${i===actual?' aria-current="true"':""}>${esc(x.titulo)}${L.pdf?`<small>${x.lugar+1}</small>`:""}</button></li>`).join("")}</ol>`
        :`<p class="lc-p-vacio">Este libro no trae índice. Usa el número de página de abajo para moverte.</p>`);
    } else if(cual==="notas"){
      const subs=subrayadosDe(L.id);
      html=cabeza("Subrayados y notas")+(subs.length?`<ul class="lc-notas">${subs.map(([sid,s])=>`<li data-color="${s.color}">
          <button type="button" class="lc-n-ir" data-marca="${sid}" data-ir="${s.lugar}"><small>${esc(dondeEsta(s))}</small><q>${esc(s.texto.length>280?s.texto.slice(0,280)+"…":s.texto)}</q>${s.nota?`<span>${esc(s.nota)}</span>`:""}</button>
          <button type="button" class="lc-n-ed" data-editar="${sid}" aria-label="Editar la nota">${ICONO.notas}</button></li>`).join("")}</ul>`
        :`<p class="lc-p-vacio">Selecciona un pasaje del libro para subrayarlo o ponerle una nota. Aparecerán aquí.</p>`);
    } else if(cual==="ajustes"){
      const op=(grupo,valor,nombre,actual)=>`<button type="button" data-aj="${grupo}" data-v="${valor}" aria-pressed="${actual===valor}">${nombre}</button>`;
      html=cabeza("Ajustes de lectura")+(L.epub?`
        <div class="lc-aj"><span>Tamaño de letra</span><div class="lc-aj-g"><button type="button" data-aj="tam" data-v="-10" aria-label="Letra más pequeña">${ICONO.menos}</button><output>${ajustes.tam} %</output><button type="button" data-aj="tam" data-v="10" aria-label="Letra más grande">${ICONO.mas}</button></div></div>
        <div class="lc-aj"><span>Tipo de letra</span><div class="lc-aj-g">${op("letra","serif","Con remates",ajustes.letra)}${op("letra","sans","Sin remates",ajustes.letra)}</div></div>`
        :`<div class="lc-aj"><span>Tamaño de la página</span><div class="lc-aj-g"><button type="button" data-aj="zoom" data-v="-0.25" aria-label="Página más pequeña">${ICONO.menos}</button><output>${Math.round(L.zoom*100)} %</output><button type="button" data-aj="zoom" data-v="0.25" aria-label="Página más grande">${ICONO.mas}</button></div></div>`)+`
        <div class="lc-aj"><span>Tema</span><div class="lc-aj-g lc-temas">${op("tema","auto","Automático",ajustes.tema)}${op("tema","claro","Claro",ajustes.tema)}${op("tema","sepia","Sepia",ajustes.tema)}${op("tema","oscuro","Oscuro",ajustes.tema)}</div></div>`;
    } else if(cual==="marca"){
      const s=datos.subrayados[id]; if(!s){ cerrarPanel(); return; }
      html=cabeza("Subrayado")+`<q class="lc-m-texto" data-color="${s.color}">${esc(s.texto.length>400?s.texto.slice(0,400)+"…":s.texto)}</q>
        <div class="lc-m-colores" role="group" aria-label="Color">${COLORES.map(c=>`<button type="button" class="lc-color" data-mcolor="${c}" aria-pressed="${c===s.color}" aria-label="${c}"></button>`).join("")}</div>
        <textarea class="lc-m-nota" maxlength="5000" rows="4" placeholder="Escribe una nota…" aria-label="Nota">${esc(s.nota)}</textarea>
        <div class="lc-m-pie"><button type="button" class="linklike lc-m-quitar" data-p="quitar">Quitar el subrayado</button><button type="button" class="add" data-p="cerrar">Hecho</button></div>`;
    }
    panel.dataset.de=cual; panel.innerHTML=html; panel.hidden=false;
    const act=panel.querySelector('[aria-current="true"]'); if(act) act.scrollIntoView({block:"center"});
    if(cual==="marca"&&!datos.subrayados[id].nota&&!tactil()) panel.querySelector("textarea").focus();
  }
  panel.addEventListener("input",e=>{ if(e.target.matches("textarea")){ clearTimeout(tNota); tNota=setTimeout(guardarNota,600); } });
  panel.addEventListener("click",async e=>{
    const b=e.target.closest("button"); if(!b||!L) return;
    if(b.dataset.p==="cerrar"){ cerrarPanel(); return; }
    if(b.dataset.p==="quitar"){ const id=panelId; panelDe=null; cerrarPanel(); quitarSubrayado(id); return; }
    if(b.dataset.editar){ abrirPanel("marca",b.dataset.editar); return; }
    if(b.dataset.mcolor){ await cambiarSubrayado(panelId,{color:b.dataset.mcolor}); for(const x of panel.querySelectorAll("[data-mcolor]")) x.setAttribute("aria-pressed",x===b); panel.querySelector(".lc-m-texto").dataset.color=b.dataset.mcolor; return; }
    if(b.dataset.ir!==undefined){ const lugar=Number(b.dataset.ir), o={ancla:b.dataset.ancla||"",marca:b.dataset.marca||""}; cerrarPanel(); ir(lugar,o); return; }
    if(b.dataset.aj){
      const v=b.dataset.v;
      if(b.dataset.aj==="tam"){ const frac=L.frac; ajustes.tam=Math.min(180,Math.max(70,ajustes.tam+Number(v))); aplicarAjustes(); area.scrollTop=frac*Math.max(0,area.scrollHeight-area.clientHeight); }
      else if(b.dataset.aj==="zoom") cambiarZoom(L.zoom+Number(v));
      else { const frac=L.frac; ajustes[b.dataset.aj]=v; aplicarAjustes(); if(L.epub) area.scrollTop=frac*Math.max(0,area.scrollHeight-area.clientHeight); }
      panelDe=null; abrirPanel("ajustes");
    }
  });

  // ---------------------------------------------------------------- botones, enlaces y teclado del lector
  lector.addEventListener("click",e=>{
    if(!L) return;
    const b=e.target.closest("[data-l]");
    if(b){
      const a=b.dataset.l;
      if(a==="cerrar") cerrarLector();
      else if(a==="ant"||a==="sig") ir(L.lugar+(a==="sig"?1:-1));
      else abrirPanel(a);
      return;
    }
    if(!e.target.isConnected||e.target.closest("#lc-panel, #lc-sel")) return;      // (un botón del panel que se acaba de redibujar ya no está en la página)
    const m=e.target.closest("mark.lc-marca");
    if(m&&getSelection().isCollapsed){ abrirPanel("marca",m.dataset.sub); return; }
    const en=e.target.closest("a[data-cap]");
    if(en){ e.preventDefault(); ir(Number(en.dataset.cap),{ancla:en.dataset.destino||""}); return; }
    if(panelDe&&!e.target.closest("a")) cerrarPanel();
  });
  donde.addEventListener("change",e=>{ if(e.target.id==="lc-pag"&&L&&L.pdf){ const n=Math.round(Number(e.target.value)); if(n>=1) ir(n-1); e.target.blur(); } });
  document.addEventListener("keydown",e=>{
    if(!L) return;
    const a=document.activeElement, escribe=a&&(/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)||a.isContentEditable);
    if(e.key==="Escape"){ e.preventDefault(); e.stopPropagation(); if(panelDe) cerrarPanel(); else cerrarLector(); return; }
    if(e.key==="Enter"&&a&&a.matches&&a.matches("a[data-cap]")){ e.preventDefault(); a.click(); return; }
    if(escribe||e.ctrlKey||e.metaKey||e.altKey) return;
    if(e.key==="ArrowRight"){ e.preventDefault(); ir(L.lugar+1); }
    else if(e.key==="ArrowLeft"){ e.preventDefault(); ir(L.lugar-1); }
  },true);

  // ---------------------------------------------------------------- cambios llegados de otro dispositivo u otra pestaña
  document.addEventListener("ascenso:datos-externos",async()=>{
    if(vista.hidden) return;
    try{ await cargar(); }catch(e){ return; }
    if(L){
      if(!datos.libros[L.id]){ cerrarLector(); return; }
      if(getSelection().isCollapsed&&panelDe!=="marca") for(const raiz of L.epub?[texto]:hojas.querySelectorAll(".lc-capa")) marcarTodo(raiz);
    } else { pintar(); if(ficha&&ficha.open&&!ficha.querySelector(":focus")) pintarFicha(); }
  });
  document.addEventListener("ascenso:sync",()=>{ if(!vista.hidden&&!L&&!ocupada&&!cuerpo.querySelector(":focus")) pintar(); });

  // ---------------------------------------------------------------- la puerta: el nombre del autor de la frase del día
  document.addEventListener("click",e=>{ if(e.target.closest("#quote .q-autor")) abrir(); });

  return {
    disponible:true, abrir, cerrar,
    abierta:()=>!vista.hidden,
    // Para el botón «atrás» del teléfono (movil.js): cuántas cosas hay abiertas y cómo cerrar la última
    nivel:()=>vista.hidden?0:1+(L?1:0)+(L&&panelDe?1:0),
    atras(){ if(L&&panelDe){ cerrarPanel(); return true; } if(L){ cerrarLector(); return true; } if(!vista.hidden){ cerrar(); return true; } return false; },
  };
})();

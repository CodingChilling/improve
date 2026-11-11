// Lector de EPUB de Ascenso: abre el archivo (un ZIP), lee su índice y prepara cada capítulo para mostrarlo.
//
// El contenido de un libro no es de fiar: nunca se inserta tal cual. De cada capítulo se copian solo las etiquetas
// de texto conocidas (párrafos, títulos, listas, tablas, imágenes…), sin estilos, sin scripts y sin atributos que
// no estén en la lista. Las imágenes salen del propio archivo; los enlaces de fuera se abren en otra pestaña.
"use strict";
window.AscensoEpub=(()=>{
  const dec=new TextDecoder();
  const MAX_ENTRADA=120*1024*1024;        // tamaño máximo, ya descomprimido, de un archivo de dentro del EPUB
  const MAX_CAPITULO=8*1024*1024;         // y de un capítulo
  class ErrorLibro extends Error{}

  // ---------------------------------------------------------------- ZIP
  function leerIndiceZip(buf){
    const dv=new DataView(buf), u=new Uint8Array(buf), fin=buf.byteLength;
    let i=fin-22; const tope=Math.max(0,fin-22-65535);
    for(;i>=tope;i--) if(dv.getUint32(i,true)===0x06054b50) break;
    if(i<tope) throw new ErrorLibro("el archivo no es un EPUB válido");
    const n=dv.getUint16(i+10,true); let p=dv.getUint32(i+16,true);
    const entradas=new Map();
    for(let k=0;k<n&&p+46<=fin;k++){
      if(dv.getUint32(p,true)!==0x02014b50) break;
      const metodo=dv.getUint16(p+10,true), comprimido=dv.getUint32(p+20,true), tamano=dv.getUint32(p+24,true);
      const ln=dv.getUint16(p+28,true), le=dv.getUint16(p+30,true), lc=dv.getUint16(p+32,true), cabecera=dv.getUint32(p+42,true);
      entradas.set(dec.decode(u.subarray(p+46,p+46+ln)),{metodo,comprimido,tamano,cabecera});
      p+=46+ln+le+lc;
    }
    return entradas;
  }
  async function leerEntrada(buf,e,maximo){
    if(e.tamano>(maximo||MAX_ENTRADA)) throw new ErrorLibro("el libro contiene un archivo demasiado grande");
    const dv=new DataView(buf), ini=e.cabecera+30+dv.getUint16(e.cabecera+26,true)+dv.getUint16(e.cabecera+28,true);
    const datos=new Uint8Array(buf,ini,e.comprimido);
    if(e.metodo===0) return datos;
    if(e.metodo!==8||typeof DecompressionStream!=="function") throw new ErrorLibro("este navegador no puede abrir el libro");
    const flujo=new Blob([datos]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    // Se lee por trozos para parar si el contenido resulta ser mucho mayor de lo que declara
    const lector=flujo.getReader(), trozos=[]; let total=0;
    for(;;){
      const {done,value}=await lector.read(); if(done) break;
      total+=value.length;
      if(total>(maximo||MAX_ENTRADA)){ try{ await lector.cancel(); }catch(err){} throw new ErrorLibro("el libro contiene un archivo demasiado grande"); }
      trozos.push(value);
    }
    const out=new Uint8Array(total); let o=0; for(const t of trozos){ out.set(t,o); o+=t.length; }
    return out;
  }

  // ---------------------------------------------------------------- rutas dentro del libro
  const sinAncla=h=>String(h).split("#")[0];
  const anclaDe=h=>{ const i=String(h).indexOf("#"); return i<0?"":String(h).slice(i+1); };
  function resolver(base,href){
    let ruta=sinAncla(href); try{ ruta=decodeURIComponent(ruta); }catch(e){}
    if(/^[a-z][a-z0-9+.-]*:/i.test(ruta)) return null;                      // con esquema: no es del libro
    const partes=ruta.startsWith("/")?[]:base.split("/").slice(0,-1);
    for(const p of ruta.split("/")){ if(p===".."){ partes.pop(); } else if(p&&p!=="."){ partes.push(p); } }
    return partes.join("/");
  }
  const xml=(texto,tipo)=>new DOMParser().parseFromString(texto,tipo||"application/xml");
  const hijos=(nodo,nombre)=>[...nodo.getElementsByTagNameNS("*",nombre)];
  const TIPOS_IMAGEN={png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",gif:"image/gif",webp:"image/webp",svg:"image/svg+xml",avif:"image/avif"};
  const tipoImagen=ruta=>TIPOS_IMAGEN[(ruta.split(".").pop()||"").toLowerCase()]||null;

  // ---------------------------------------------------------------- limpieza del contenido
  const BLOQUES=new Set(["p","div","section","article","aside","header","footer","main","h1","h2","h3","h4","h5","h6","blockquote","pre",
    "ul","ol","li","dl","dt","dd","figure","figcaption","table","thead","tbody","tfoot","tr","td","th","caption","hr","br"]);
  const EN_LINEA=new Set(["span","a","em","i","strong","b","u","s","small","sub","sup","code","kbd","cite","q","abbr","img","ruby","rt","rp",
    "del","ins","dfn","var","samp","wbr","bdi","bdo"]);
  const CAMBIOS={nav:"div",center:"div",font:"span",tt:"code",mark:"span",strike:"s",big:"span",acronym:"abbr",hgroup:"div",details:"div",summary:"p",address:"div"};
  const FUERA=new Set(["script","style","head","title","link","meta","iframe","frame","frameset","object","embed","applet","form","input","button",
    "select","textarea","audio","video","canvas","template","noscript","base","math"]);
  const ATRIBUTOS=new Set(["colspan","rowspan","lang","dir","title","alt","start"]);

  function limpiar(origen,destino,ctx){
    for(const n of origen.childNodes){
      if(n.nodeType===3||n.nodeType===4){ destino.appendChild(document.createTextNode(n.nodeValue)); continue; }
      if(n.nodeType!==1) continue;
      let nombre=n.localName.toLowerCase();
      if(FUERA.has(nombre)) continue;
      if(nombre==="svg"){
        // Las portadas suelen ser un SVG con una imagen dentro: se conserva solo la imagen
        for(const im of hijos(n,"image")){
          const ruta=resolver(ctx.base,im.getAttribute("xlink:href")||im.getAttributeNS("http://www.w3.org/1999/xlink","href")||im.getAttribute("href")||"");
          if(ruta&&ctx.entradas.has(ruta)&&tipoImagen(ruta)){ const img=document.createElement("img"); img.dataset.ruta=ruta; img.alt=""; destino.appendChild(img); }
        }
        continue;
      }
      nombre=CAMBIOS[nombre]||nombre;
      if(!BLOQUES.has(nombre)&&!EN_LINEA.has(nombre)){ limpiar(n,destino,ctx); continue; }      // etiqueta desconocida: queda su texto
      const el=document.createElement(nombre);
      for(const a of n.attributes){ const k=a.localName.toLowerCase(); if(ATRIBUTOS.has(k)) el.setAttribute(k,a.value.slice(0,500)); }
      const id=n.getAttribute("id")||(nombre==="a"?n.getAttribute("name"):"");
      if(id) el.dataset.ancla=id.slice(0,200);          // los identificadores del libro no se mezclan con los de la página
      if(nombre==="img"){
        const ruta=resolver(ctx.base,n.getAttribute("src")||"");
        if(!ruta||!ctx.entradas.has(ruta)||!tipoImagen(ruta)) continue;
        el.dataset.ruta=ruta; if(!el.hasAttribute("alt")) el.alt="";
      } else if(nombre==="a"){
        const href=(n.getAttribute("href")||"").trim();
        if(/^(https?:|mailto:)/i.test(href)){ el.href=href; el.target="_blank"; el.rel="noopener noreferrer"; }
        else if(href){
          const ruta=href.startsWith("#")?ctx.base:resolver(ctx.base,href), cap=ruta===null?-1:ctx.capitulos.findIndex(c=>c.ruta===ruta);
          if(cap>=0){ el.dataset.cap=cap; el.dataset.destino=anclaDe(href); el.setAttribute("role","link"); el.tabIndex=0; }
        }
      }
      limpiar(n,el,ctx);
      destino.appendChild(el);
    }
  }

  // ---------------------------------------------------------------- abrir
  async function abrir(buf){
    let entradas;
    try{ entradas=leerIndiceZip(buf); }catch(e){ throw new ErrorLibro("el archivo no es un EPUB válido"); }
    const texto=async(ruta,maximo)=>{ const e=entradas.get(ruta); if(!e) throw new ErrorLibro("el EPUB está incompleto"); return dec.decode(await leerEntrada(buf,e,maximo)); };
    if(!entradas.has("META-INF/container.xml")) throw new ErrorLibro("el archivo no es un EPUB válido");
    // Protegido (DRM): hay cifrado que no es el de ocultar tipos de letra
    if(entradas.has("META-INF/encryption.xml")){
      const cif=xml(await texto("META-INF/encryption.xml",2e6));
      if(hijos(cif,"EncryptionMethod").some(m=>!/font-obfuscation|idpf\.org\/2008\/embedding/i.test(m.getAttribute("Algorithm")||"")))
        throw new ErrorLibro("el libro está protegido (DRM) y no se puede abrir");
    }
    const cont=xml(await texto("META-INF/container.xml",2e6)), raiz=hijos(cont,"rootfile")[0];
    const rutaOpf=raiz&&raiz.getAttribute("full-path");
    if(!rutaOpf||!entradas.has(rutaOpf)) throw new ErrorLibro("el archivo no es un EPUB válido");
    const opf=xml(await texto(rutaOpf,8e6));
    const primero=n=>{ const e=hijos(opf,n)[0]; return e?e.textContent.replace(/\s+/g," ").trim():""; };
    const manifiesto=new Map();
    for(const it of hijos(opf,"item")){
      const ruta=resolver(rutaOpf,it.getAttribute("href")||"");
      if(ruta) manifiesto.set(it.getAttribute("id"),{ruta,tipo:it.getAttribute("media-type")||"",props:(it.getAttribute("properties")||"").split(/\s+/)});
    }
    const capitulos=[];
    for(const ref of hijos(opf,"itemref")){
      const it=manifiesto.get(ref.getAttribute("idref"));
      if(it&&entradas.has(it.ruta)&&/html|xml/i.test(it.tipo||"html")) capitulos.push({ruta:it.ruta,bytes:entradas.get(it.ruta).tamano||1});
    }
    if(!capitulos.length) throw new ErrorLibro("el EPUB no tiene capítulos");

    // ---- índice: el de EPUB 3 (nav) o el de EPUB 2 (NCX)
    const indice=[];
    const apuntar=(titulo,href,base,nivel)=>{
      const ruta=resolver(base,href), cap=ruta===null?-1:capitulos.findIndex(c=>c.ruta===ruta);
      titulo=titulo.replace(/\s+/g," ").trim();
      if(cap>=0&&titulo&&indice.length<2000) indice.push({titulo:titulo.slice(0,300),nivel:Math.min(nivel,4),cap,ancla:anclaDe(href)});
    };
    try{
      const nav=[...manifiesto.values()].find(i=>i.props.includes("nav")&&entradas.has(i.ruta));
      const spine=hijos(opf,"spine")[0], ncx=manifiesto.get(spine&&spine.getAttribute("toc"))||[...manifiesto.values()].find(i=>/ncx/i.test(i.tipo));
      if(nav){
        const d=xml(await texto(nav.ruta,MAX_CAPITULO),"application/xhtml+xml");
        const navs=hijos(d,"nav"), toc=navs.find(n=>/(^|\s)toc(\s|$)/.test(n.getAttribute("epub:type")||n.getAttributeNS("http://www.idpf.org/2007/ops","type")||""))||navs[0];
        const bajar=(ol,nivel)=>{ for(const li of ol.children){ if(li.localName!=="li") continue;
          const a=[...li.children].find(c=>c.localName==="a"); if(a) apuntar(a.textContent,a.getAttribute("href")||"",nav.ruta,nivel);
          for(const sub of li.children) if(sub.localName==="ol") bajar(sub,nivel+1); } };
        const ol=toc&&[...toc.children].find(c=>c.localName==="ol"); if(ol) bajar(ol,0);
      }
      if(!indice.length&&ncx&&entradas.has(ncx.ruta)){
        const d=xml(await texto(ncx.ruta,MAX_CAPITULO));
        const bajar=(nodo,nivel)=>{ for(const pt of nodo.children){ if(pt.localName!=="navPoint") continue;
          const t=hijos(pt,"text")[0], c=[...pt.children].find(x=>x.localName==="content");
          if(t&&c) apuntar(t.textContent,c.getAttribute("src")||"",ncx.ruta,nivel);
          bajar(pt,nivel+1); } };
        const mapa=hijos(d,"navMap")[0]; if(mapa) bajar(mapa,0);
      }
    }catch(e){ /* sin índice se puede leer igual */ }

    // ---- portada
    const metaPortada=hijos(opf,"meta").find(m=>m.getAttribute("name")==="cover");
    const itemPortada=[...manifiesto.values()].find(i=>i.props.includes("cover-image"))||manifiesto.get(metaPortada&&metaPortada.getAttribute("content"));
    async function imagen(ruta){
      const e=entradas.get(ruta), tipo=tipoImagen(ruta);
      if(!e||!tipo) return null;
      return new Blob([await leerEntrada(buf,e,40*1024*1024)],{type:tipo});
    }

    // ---- un capítulo, ya limpio, como fragmento listo para insertar
    async function capitulo(i){
      const c=capitulos[i]; if(!c) throw new ErrorLibro("capítulo no encontrado");
      const fuente=await texto(c.ruta,MAX_CAPITULO);
      let d=xml(fuente,"application/xhtml+xml");
      if(d.getElementsByTagName("parsererror").length||!d.body) d=xml(fuente,"text/html");
      const frag=document.createDocumentFragment();
      limpiar(d.body||d.documentElement,frag,{base:c.ruta,entradas,capitulos});
      return frag;
    }

    return {
      titulo:primero("title"), autor:hijos(opf,"creator").map(c=>c.textContent.replace(/\s+/g," ").trim()).filter(Boolean).join(", "),
      capitulos, indice, capitulo, imagen,
      async portada(){
        try{
          if(itemPortada&&tipoImagen(itemPortada.ruta)) return await imagen(itemPortada.ruta);
          // Sin portada declarada: la primera imagen del primer capítulo
          const img=(await capitulo(0)).querySelector("img[data-ruta]");
          return img?await imagen(img.dataset.ruta):null;
        }catch(e){ return null; }
      },
    };
  }

  return {abrir, ErrorLibro};
})();

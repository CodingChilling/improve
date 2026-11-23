// Bloqueo de este dispositivo con un PIN (y, si se quiere, con la huella o la cara): una barrera para que quien coja
// el móvil no vea Ascenso. No cifra lo guardado en el dispositivo. Solo en la aplicación nueva.
//
// Se guarda en IndexedDB («meta», clave «bloqueo»), que no se sincroniza:
//   pin      {sal, hash, iter, largo}   PBKDF2-SHA256 del PIN con una sal aleatoria (el PIN nunca se guarda)
//   huella   {id}                       el identificador de la credencial WebAuthn del dispositivo, o null
//   espera   minutos en segundo plano antes de volver a pedirlo (0 = en cuanto se sale)
//   fallos, hasta                       intentos fallidos seguidos y hasta cuándo hay que esperar
// En localStorage solo queda una marca («ascenso-bloqueo» = "1") para que tema.js oculte la página antes de pintarla.
"use strict";
window.AscensoBloqueo=(()=>{
  const Almacen=window.AscensoAlmacen, clasico=!!(window.ASCENSO_CONFIG||{}).clasico;
  const disponible=!!(Almacen&&!clasico&&window.crypto&&crypto.subtle);
  const MARCA="ascenso-bloqueo", raiz=document.documentElement;
  const nada={disponible:false, configurado:()=>false, bloqueada:()=>false, pintarAjustes(){}, bloquear(){}};
  const ponerMarca=si=>{ try{ if(si) localStorage.setItem(MARCA,"1"); else localStorage.removeItem(MARCA); }catch(e){} };
  if(!disponible){ raiz.classList.remove("bloqueada"); ponerMarca(false); return nada; }

  const $=id=>document.getElementById(id);
  const ITER=250000, ESPERAS=[30,60,300,900,3600];          // segundos de espera a partir del quinto fallo
  const b64=u8=>btoa(String.fromCharCode(...u8)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
  const deB64=s=>Uint8Array.from(atob(String(s).replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
  const azar=n=>crypto.getRandomValues(new Uint8Array(n));
  const PIN_OK=/^\d{4,8}$/;

  let ajustes=null, bloqueada=false, ocultaDesde=null, entrada="", ocupado=false, reloj=null, sitioAjustes=null;
  const leer=async()=>{ try{ ajustes=(await Almacen.meta("bloqueo"))||null; }catch(e){ ajustes=null; } return ajustes; };
  const guardar=async a=>{ ajustes=a; if(a) await Almacen.ponerMeta("bloqueo",a); else await Almacen.tx(["meta"],"readwrite",s=>s.meta.delete("bloqueo")); ponerMarca(!!(a&&a.pin)); };
  const configurado=()=>!!(ajustes&&ajustes.pin);

  async function derivar(pin,sal,iter){
    const k=await crypto.subtle.importKey("raw",new TextEncoder().encode(pin),"PBKDF2",false,["deriveBits"]);
    return new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:sal,iterations:iter},k,256));
  }
  async function pinCorrecto(pin){
    if(!configurado()||!PIN_OK.test(pin)) return false;
    const h=await derivar(pin,deB64(ajustes.pin.sal),ajustes.pin.iter), g=deB64(ajustes.pin.hash);
    let d=h.length^g.length; for(let i=0;i<Math.min(h.length,g.length);i++) d|=h[i]^g[i];
    return d===0;
  }
  async function hacerPin(pin){ const sal=azar(16); return {sal:b64(sal), hash:b64(await derivar(pin,sal,ITER)), iter:ITER, largo:pin.length}; }

  // ---------------------------------------------------------------- huella o cara (WebAuthn)
  async function huellaPosible(){
    try{ return !!(window.PublicKeyCredential&&await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); }catch(e){ return false; }
  }
  async function registrarHuella(){
    const cred=await navigator.credentials.create({publicKey:{
      challenge:azar(32), rp:{name:"Ascenso"}, user:{id:azar(16), name:"Ascenso", displayName:"Ascenso en este dispositivo"},
      pubKeyCredParams:[{type:"public-key",alg:-7},{type:"public-key",alg:-257}],
      authenticatorSelection:{authenticatorAttachment:"platform", userVerification:"required", residentKey:"discouraged"},
      timeout:60000, attestation:"none"}});
    if(!cred) throw new Error("cancelada");
    return {id:b64(new Uint8Array(cred.rawId))};
  }
  async function comprobarHuella(){
    const reto=azar(32);
    const r=await navigator.credentials.get({publicKey:{challenge:reto, allowCredentials:[{type:"public-key",id:deB64(ajustes.huella.id)}], userVerification:"required", timeout:60000}});
    if(!r||b64(new Uint8Array(r.rawId))!==ajustes.huella.id) return false;
    // El dispositivo tiene que haber verificado a la persona (bit UV de los datos del autenticador) y responder a este reto
    const datos=new Uint8Array(r.response.authenticatorData), cliente=JSON.parse(new TextDecoder().decode(r.response.clientDataJSON));
    return !!(datos[32]&0x04)&&cliente.type==="webauthn.get"&&cliente.challenge===b64(reto)&&cliente.origin===location.origin;
  }

  // ---------------------------------------------------------------- la pantalla de bloqueo
  const capa=document.createElement("div");
  capa.className="bloqueo"; capa.id="bloqueo"; capa.hidden=true;
  capa.setAttribute("role","dialog"); capa.setAttribute("aria-modal","true"); capa.setAttribute("aria-labelledby","bq-titulo");
  capa.innerHTML=`<div class="bq-caja">
      <p class="bq-marca">Ascenso</p>
      <h2 id="bq-titulo">Escribe tu PIN</h2>
      <div class="bq-puntos" id="bq-puntos" aria-hidden="true"></div>
      <p class="bq-msg" id="bq-msg" role="status" aria-live="polite"></p>
      <div class="bq-teclado" id="bq-teclado" role="group" aria-label="Teclado del PIN">
        ${[1,2,3,4,5,6,7,8,9].map(n=>`<button type="button" data-tecla="${n}">${n}</button>`).join("")}
        <button type="button" class="bq-huella" id="bq-huella" aria-label="Usar huella o cara" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 11v3m-3.5-2.5c0-2 1.5-3.5 3.5-3.5s3.5 1.5 3.5 3.5V14c0 2-.5 3.6-1.4 5M8.5 14c0 1.6-.4 3-1.1 4.2M5.5 9.5A7 7 0 0 1 19 11.5v2.5M6 13.5c0 1.2-.2 2.3-.6 3.3M12 17.5c-.2 1.2-.6 2.3-1.2 3.3"/></svg></button>
        <button type="button" data-tecla="0">0</button>
        <button type="button" data-tecla="borrar" aria-label="Borrar la última cifra">⌫</button>
      </div>
      <button type="button" class="add bq-entrar" id="bq-entrar">Entrar</button>
      <button type="button" class="linklike bq-olvido" id="bq-olvido" aria-expanded="false" aria-controls="bq-olvido-panel">¿Has olvidado el PIN?</button>
      <div class="bq-olvido-panel" id="bq-olvido-panel" hidden>
        <p>El PIN no se puede recuperar: es una barrera de este dispositivo. La única forma de volver a entrar es <strong>borrar los datos de Ascenso de este dispositivo</strong>.</p>
        <p>Si usas una cuenta, tus datos siguen en ella: vuelve a entrar con tu correo y tu contraseña para recuperarlos (lo que aún no se haya subido se perderá). Sin cuenta, se pierde lo que haya en este dispositivo.</p>
        <button type="button" class="add alt bq-borrar" id="bq-borrar">Borrar los datos de este dispositivo</button>
      </div>
    </div>`;
  document.body.appendChild(capa);

  const pintarPuntos=()=>{ const n=ajustes&&ajustes.pin?ajustes.pin.largo:4; $("bq-puntos").innerHTML=Array.from({length:Math.max(n,entrada.length)},(_,i)=>`<i${i<entrada.length?' class="on"':""}></i>`).join(""); };
  const mensaje=t=>{ $("bq-msg").textContent=t||""; };
  function esperaRestante(){ return ajustes&&ajustes.hasta?Math.max(0,Math.ceil((ajustes.hasta-Date.now())/1000)):0; }
  const comoTiempo=s=>s>=3600?Math.ceil(s/3600)+" h":s>=60?Math.ceil(s/60)+" min":s+" s";
  function pintarEspera(){
    clearInterval(reloj); reloj=null;
    const s=esperaRestante(), teclas=capa.querySelectorAll("#bq-teclado button, #bq-entrar");
    for(const b of teclas) if(b.id!=="bq-huella") b.disabled=s>0;
    if(s>0){
      mensaje(`Demasiados intentos. Espera ${comoTiempo(s)} para volver a probar.`);
      reloj=setInterval(()=>{ const r=esperaRestante(); if(r<=0){ pintarEspera(); mensaje(""); } else mensaje(`Demasiados intentos. Espera ${comoTiempo(r)} para volver a probar.`); },1000);
    }
  }
  function bloquear(){
    if(!configurado()||bloqueada) return;
    bloqueada=true; entrada=""; raiz.classList.add("bloqueada");
    $("bq-olvido-panel").hidden=true; $("bq-olvido").setAttribute("aria-expanded","false");
    capa.hidden=false; pintarPuntos(); mensaje(""); pintarEspera();
    huellaPosible().then(si=>{ $("bq-huella").hidden=!(si&&ajustes&&ajustes.huella); });
    const b=capa.querySelector('[data-tecla="1"]'); if(b&&!b.disabled) b.focus({preventScroll:true});
    document.dispatchEvent(new CustomEvent("ascenso:bloqueo",{detail:{bloqueada:true}}));
  }
  function desbloquear(){
    bloqueada=false; entrada=""; capa.hidden=true; raiz.classList.remove("bloqueada");
    clearInterval(reloj); reloj=null; mensaje("");
    document.dispatchEvent(new CustomEvent("ascenso:bloqueo",{detail:{bloqueada:false}}));
  }
  async function intentar(){
    if(ocupado||!bloqueada||esperaRestante()>0) return;
    if(entrada.length<4){ mensaje("El PIN tiene entre 4 y 8 cifras."); return; }
    ocupado=true;
    const pin=entrada; entrada="";
    try{
      if(await pinCorrecto(pin)){ if(ajustes.fallos||ajustes.hasta) await guardar({...ajustes,fallos:0,hasta:0}); desbloquear(); return; }
      const fallos=(ajustes.fallos||0)+1, s=fallos>=5?ESPERAS[Math.min(fallos-5,ESPERAS.length-1)]:0;
      await guardar({...ajustes,fallos,hasta:s?Date.now()+s*1000:0});
      pintarPuntos(); capa.querySelector(".bq-puntos").classList.remove("mal"); void capa.offsetWidth; capa.querySelector(".bq-puntos").classList.add("mal");
      if(s) pintarEspera(); else mensaje(fallos>=3?`PIN incorrecto. ${5-fallos===1?"Te queda 1 intento":`Te quedan ${5-fallos} intentos`} antes de tener que esperar.`:"PIN incorrecto.");
    }finally{ ocupado=false; }
  }
  function tecla(t){
    if(!bloqueada||esperaRestante()>0) return;
    if(t==="borrar"){ entrada=entrada.slice(0,-1); pintarPuntos(); return; }
    if(entrada.length>=8) return;
    entrada+=t; mensaje(""); pintarPuntos();
    if(ajustes.pin&&entrada.length===ajustes.pin.largo) intentar();
  }
  async function conHuella(){
    if(ocupado) return; ocupado=true;
    try{ if(await comprobarHuella()){ if(ajustes.fallos||ajustes.hasta) await guardar({...ajustes,fallos:0,hasta:0}); desbloquear(); } else mensaje("No se ha podido comprobar. Usa tu PIN."); }
    catch(e){ mensaje("No se ha podido comprobar. Usa tu PIN."); }
    finally{ ocupado=false; }
  }
  // Olvidé el PIN: borrar los datos de este dispositivo (con cuenta, también se cierra la sesión) y quitar el bloqueo
  async function borrarTodo(){
    ocupado=true; mensaje("Borrando los datos de este dispositivo…");
    try{
      const Sync=window.AscensoSync;
      if(Sync&&Sync.disponible) await Sync.salir(true); else if(window.AscensoLocal) await window.AscensoLocal.vaciarDatos();
      await guardar(null);
      location.reload();
    }catch(e){ ocupado=false; mensaje("No se han podido borrar los datos. Inténtalo de nuevo."); }
  }
  capa.addEventListener("click",ev=>{
    const t=ev.target.closest("[data-tecla]"); if(t){ tecla(t.dataset.tecla); return; }
    if(ev.target.closest("#bq-entrar")){ intentar(); return; }
    if(ev.target.closest("#bq-huella")){ conHuella(); return; }
    if(ev.target.closest("#bq-olvido")){ const p=$("bq-olvido-panel"); p.hidden=!p.hidden; $("bq-olvido").setAttribute("aria-expanded",String(!p.hidden)); return; }
    const b=ev.target.closest("#bq-borrar");
    if(b){
      if(b.dataset.armed){ borrarTodo(); return; }
      b.dataset.armed="1"; b.textContent="Pulsa otra vez para borrarlos";
      setTimeout(()=>{ if(b.isConnected&&!ocupado){ delete b.dataset.armed; b.textContent="Borrar los datos de este dispositivo"; } },4000);
    }
  });
  document.addEventListener("keydown",ev=>{
    if(!bloqueada) return;
    if(/^\d$/.test(ev.key)){ ev.preventDefault(); tecla(ev.key); }
    else if(ev.key==="Backspace"){ ev.preventDefault(); tecla("borrar"); }
    else if(ev.key==="Enter"&&!ev.target.closest("#bloqueo button")){ ev.preventDefault(); intentar(); }
    else if(ev.key==="Escape") ev.preventDefault();
  },true);

  // Al volver de segundo plano tras la espera elegida (con «Inmediatamente», se bloquea al salir)
  document.addEventListener("visibilitychange",()=>{
    if(!configurado()) return;
    if(document.hidden){ ocultaDesde=Date.now(); if(!ajustes.espera) bloquear(); return; }
    if(ocultaDesde!=null&&Date.now()-ocultaDesde>=(ajustes.espera||0)*60000) bloquear();
    ocultaDesde=null;
  });

  // ---------------------------------------------------------------- Ajustes › Bloqueo
  let formAjuste=null;     // null | "poner" | "cambiar" | "quitar"
  const campoPin=(id,etiqueta,auto="new-password")=>`<label class="pf-campo"><span>${etiqueta}</span><input type="password" id="${id}" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="${auto}" enterkeyhint="done"></label>`;
  async function pintarAjustes(el){
    if(el) sitioAjustes=el;
    const s=sitioAjustes; if(!s) return;
    if(s.contains(document.activeElement)&&document.activeElement.tagName==="INPUT") return;
    await leer();
    const huella=await huellaPosible();
    const seg=`<div class="pf-seg" role="radiogroup" aria-label="Bloquear tras">${[[0,"Al salir"],[1,"1 min"],[5,"5 min"],[15,"15 min"]].map(([m,n])=>`<button type="button" role="radio" data-bq-espera="${m}" aria-checked="${(ajustes&&ajustes.espera||0)===m}">${n}</button>`).join("")}</div>`;
    let h;
    if(formAjuste){
      const titulo={poner:"Elige un PIN de 4 a 8 cifras",cambiar:"Cambiar el PIN",quitar:"Quitar el bloqueo"}[formAjuste];
      h=`<form class="bq-form" id="bq-form" novalidate><p class="pf-nota">${titulo}</p>
        ${formAjuste!=="poner"?campoPin("bq-actual","PIN actual","current-password"):""}
        ${formAjuste!=="quitar"?campoPin("bq-nuevo","PIN nuevo")+campoPin("bq-repite","Repite el PIN"):""}
        <p class="pf-error" id="bq-error" role="alert" hidden></p>
        <div class="bq-botones"><button type="submit" class="add">${formAjuste==="quitar"?"Quitar el bloqueo":"Guardar"}</button><button type="button" class="add alt" data-bq="cancelar">Cancelar</button></div></form>`;
    }else if(!configurado()){
      h=`<p class="pf-nota">Pide un PIN${huella?" (o tu huella o tu cara)":""} para abrir Ascenso en este dispositivo. Es una barrera para quien coja el dispositivo: no cifra los datos guardados en él, y cada dispositivo tiene la suya.</p>
        <button type="button" class="add" data-bq="poner">Poner un PIN</button>`;
    }else{
      h=`<p class="pf-nota">Ascenso pide tu PIN al abrirse en este dispositivo y al volver tras un rato en segundo plano.</p>
        <h4 class="bq-sub">Volver a pedirlo tras</h4>${seg}
        ${huella?`<h4 class="bq-sub">Huella o cara</h4><p class="pf-nota">${ajustes.huella?"Activada: puedes abrir con tu huella o tu cara; el PIN sigue sirviendo.":"Abre Ascenso con el desbloqueo de este dispositivo en vez del PIN."}</p>
          <button type="button" class="add alt" data-bq="${ajustes.huella?"quitar-huella":"huella"}">${ajustes.huella?"Quitar la huella o la cara":"Activar huella o cara"}</button>`:""}
        <p class="pf-error" id="bq-error" role="alert" hidden></p>
        <div class="bq-botones"><button type="button" class="add alt" data-bq="bloquear">Bloquear ahora</button><button type="button" class="add alt" data-bq="cambiar">Cambiar el PIN</button><button type="button" class="add alt" data-bq="quitar">Quitar el bloqueo</button></div>`;
    }
    s.innerHTML=h;
    const primero=s.querySelector("input"); if(primero) primero.focus();
  }
  const errorAjuste=t=>{ const p=sitioAjustes&&sitioAjustes.querySelector("#bq-error"); if(p){ p.textContent=t; p.hidden=!t; } };
  async function enviarForm(){
    const v=id=>{ const i=$(id); return i?i.value:""; }, limpiar=()=>{ for(const i of sitioAjustes.querySelectorAll("input")) i.value=""; };
    const actual=v("bq-actual"), nuevo=v("bq-nuevo"), repite=v("bq-repite");
    try{
      if(formAjuste!=="poner"){
        if(esperaRestante()>0){ errorAjuste(`Demasiados intentos. Espera ${comoTiempo(esperaRestante())}.`); return; }
        if(!await pinCorrecto(actual)){ limpiar(); errorAjuste("El PIN actual no es correcto."); $("bq-actual").focus(); return; }
      }
      if(formAjuste==="quitar"){ await guardar(null); formAjuste=null; await pintarAjustes(); return; }
      if(!PIN_OK.test(nuevo)){ errorAjuste("El PIN tiene que tener entre 4 y 8 cifras, solo números."); $("bq-nuevo").focus(); return; }
      if(nuevo!==repite){ $("bq-repite").value=""; errorAjuste("Los dos PIN no coinciden."); $("bq-repite").focus(); return; }
      const pin=await hacerPin(nuevo);
      await guardar({espera:1, huella:null, ...(ajustes||{}), pin, fallos:0, hasta:0});
      formAjuste=null; limpiar(); await pintarAjustes();
    }catch(e){ errorAjuste("No se ha podido guardar. Inténtalo de nuevo."); }
  }
  document.addEventListener("submit",ev=>{ if(ev.target.id!=="bq-form") return; ev.preventDefault(); enviarForm(); });
  document.addEventListener("click",async ev=>{
    if(!sitioAjustes||!sitioAjustes.contains(ev.target)) return;
    const esp=ev.target.closest("[data-bq-espera]");
    if(esp){ await guardar({...ajustes,espera:Number(esp.dataset.bqEspera)}); pintarAjustes(); return; }
    const b=ev.target.closest("[data-bq]"); if(!b) return;
    const a=b.dataset.bq;
    if(a==="poner"||a==="cambiar"||a==="quitar"){ formAjuste=a; pintarAjustes(); return; }
    if(a==="cancelar"){ formAjuste=null; pintarAjustes(); return; }
    if(a==="bloquear"){ bloquear(); return; }
    if(a==="quitar-huella"){ await guardar({...ajustes,huella:null}); pintarAjustes(); return; }
    if(a==="huella"){
      b.disabled=true;
      try{ const h=await registrarHuella(); await guardar({...ajustes,huella:h}); pintarAjustes(); }
      catch(e){ b.disabled=false; errorAjuste("No se ha podido activar. Comprueba que el dispositivo tiene huella, cara o bloqueo de pantalla."); }
    }
  });

  // ---------------------------------------------------------------- al abrir
  const listo=leer().then(a=>{
    if(a&&a.pin){ ponerMarca(true); bloquear(); }
    else{ ponerMarca(false); raiz.classList.remove("bloqueada"); }
  },()=>{ raiz.classList.remove("bloqueada"); });

  return {disponible:true, listo, configurado, bloqueada:()=>bloqueada, bloquear, pintarAjustes};
})();

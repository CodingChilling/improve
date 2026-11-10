// Panel de la cuenta y de la sincronización. No tiene botón propio: se abre pulsando el texto de estado
// («Guardado…», «Sincronizado…») del pie de la página o de la cabecera de los tableros.
"use strict";
window.AscensoCuenta=(()=>{
  const Sync=window.AscensoSync;
  if(!Sync||!Sync.disponible) return {disponible:false};

  const esc=t=>String(t==null?"":t).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const MIN_CONTRASENA=10;
  let dlg=null, vista="inicio", datos={}, enlace=null, info=Sync.informe();
  // Lo que ya haya escrito ascenso.js en el estado (puede haber terminado de cargar antes que este archivo)
  let base={t:(document.getElementById("status")||{}).textContent||"", nivel:((document.getElementById("bv-sync")||{}).dataset||{}).nivel||"ok"};

  // ---------------------------------------------------------------- indicador de estado
  function textos(){
    const n=info.pendientes, cambios=n===1?"1 cambio pendiente":n+" cambios pendientes";
    switch(info.estado){
      case "sincronizado": return ["Sincronizado con tu cuenta.","Sincronizado","ok"];
      case "sincronizando": return ["Sincronizando con tu cuenta…","Sincronizando…","ok"];
      case "sin-conexion": return ["Sin conexión: "+(n?cambios+" de enviar. ":"")+"Todo está guardado en este dispositivo.","Sin conexión"+(n?" · "+n:""),"aviso"];
      case "error": return info.detalle==="sesion"
        ? ["La sesión ha caducado: pulsa aquí para iniciar sesión de nuevo. Todo está guardado en este dispositivo.","Inicia sesión","error"]
        : ["No se pudo sincronizar; se reintentará. Todo está guardado en este dispositivo.","Sin sincronizar","error"];
      default: return null;                                      // sin cuenta: se deja el texto de siempre
    }
  }
  function pintarEstado(){
    const st=document.getElementById("status"), bv=document.getElementById("bv-sync"), t=base.nivel==="error"?null:textos();
    if(st){ st.textContent=t?t[0]:base.t; st.dataset.nivel=t?t[2]:base.nivel; }
    if(bv&&t){ bv.textContent=t[1]; bv.dataset.nivel=t[2]; bv.title=t[0]; }
    if(dlg&&dlg.open&&vista==="cuenta"){
      pintar();
      // Tras la primera sincronización, este dispositivo ya está en la lista
      if(info.estado==="sincronizado"&&(!Array.isArray(lista)||!lista.length)) cargarDispositivos();
    }
  }
  // ascenso.js avisa de lo que diría él («Guardado en este dispositivo.»); con cuenta, manda el estado de la sincronización
  document.addEventListener("ascenso:estado",e=>{ base=e.detail; pintarEstado(); });
  document.addEventListener("ascenso:sync",e=>{ info=e.detail; pintarEstado(); });
  for(const id of ["status","bv-sync"]){
    const el=document.getElementById(id); if(!el) continue;
    el.classList.add("abre-cuenta"); el.setAttribute("role","button"); el.tabIndex=0; el.setAttribute("aria-haspopup","dialog");
    if(id==="status") el.title="Cuenta y sincronización";
    el.addEventListener("click",()=>abrir());
    el.addEventListener("keydown",e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); abrir(); } });
  }

  // ---------------------------------------------------------------- diálogo
  function crearDialogo(){
    dlg=document.createElement("dialog"); dlg.className="tdlg cuenta"; dlg.id="cuentadlg"; dlg.setAttribute("aria-label","Cuenta y sincronización");
    document.body.appendChild(dlg);
    dlg.addEventListener("mousedown",e=>{ dlg._fondo=e.target===dlg; });
    dlg.addEventListener("click",e=>{ if(e.target===dlg&&dlg._fondo&&!datos.ocupado&&vista!=="clave") dlg.close(); });
    dlg.addEventListener("cancel",e=>{ if(datos.ocupado||vista==="clave") e.preventDefault(); });   // la clave de recuperación no se cierra con Esc
    dlg.addEventListener("close",()=>{ Sync.cancelarEntrada(); datos={}; dlg.innerHTML=""; });
    dlg.addEventListener("click",alPulsar);
    dlg.addEventListener("submit",e=>{ e.preventDefault(); alEnviar(e.target); });
  }
  function abrir(v){
    if(!dlg) crearDialogo();
    ir(v||(info.email?(info.estado==="error"&&info.detalle==="sesion"?"entrar":"cuenta"):"inicio"));
    if(!dlg.open) dlg.showModal();
  }
  function ir(v,d){ vista=v; datos=d||{}; pintar(); const f=dlg.querySelector("input:not([type=checkbox]),button.c-pral"); if(f) f.focus(); if(v==="cuenta") cargarDispositivos(); }

  const cabecera=t=>`<div class="dlg-head"><h3 class="c-titulo">${esc(t)}</h3><button type="button" class="dlg-x" data-accion="cerrar" aria-label="Cerrar">×</button></div>`;
  const aviso=()=>`<p class="c-error" role="alert"${datos.error?"":" hidden"}>${esc(datos.error||"")}</p>`;
  const campo=(nombre,etiqueta,tipo,auto,extra="")=>`<label class="c-campo"><span>${esc(etiqueta)}</span><input name="${nombre}" type="${tipo}" autocomplete="${auto}" required ${extra}></label>`;
  const boton=(texto,ocupado)=>`<button type="submit" class="add c-pral"${datos.ocupado?" disabled":""}>${esc(datos.ocupado?ocupado:texto)}</button>`;
  const nuevaContrasena=()=>campo("clave1","Contraseña nueva (al menos "+MIN_CONTRASENA+" caracteres)","password","new-password")+campo("clave2","Repite la contraseña","password","new-password");
  const fecha=s=>{ const d=new Date(s); return isNaN(d)?"":d.toLocaleDateString("es-ES",{day:"numeric",month:"long",year:"numeric"}); };

  function pintar(){
    const V={
      inicio:()=>cabecera("Cuenta")+`<div class="c-cuerpo">
        <p>Ascenso guarda todo en este dispositivo y funciona sin cuenta. Con una cuenta, tus datos se sincronizan entre tus dispositivos
        <strong>cifrados de extremo a extremo</strong>: se cifran aquí, con tu contraseña, antes de salir, y el servidor no puede leerlos.</p>
        <div class="c-botones"><button type="button" class="add c-pral" data-accion="ir" data-vista="entrar">Iniciar sesión</button>
        <button type="button" class="add alt" data-accion="ir" data-vista="crear">Crear una cuenta</button></div></div>`,

      entrar:()=>cabecera("Iniciar sesión")+`<form class="c-cuerpo" data-form="entrar">
        ${datos.nota?`<p class="c-nota">${esc(datos.nota)}</p>`:""}
        ${campo("email","Email","email","username",info.email?`value="${esc(info.email)}" readonly`:"")}${campo("clave","Contraseña","password","current-password")}
        ${aviso()}<div class="c-botones">${boton("Entrar","Comprobando…")}</div>
        <p class="c-enlaces"><button type="button" class="c-enlace" data-accion="ir" data-vista="olvidada">He olvidado la contraseña</button>
        ${info.email?"":`<button type="button" class="c-enlace" data-accion="ir" data-vista="crear">Crear una cuenta</button>`}</p></form>`,

      crear:()=>cabecera("Crear una cuenta")+`<form class="c-cuerpo" data-form="crear">
        ${campo("email","Email","email","username")}${nuevaContrasena()}
        <div class="c-aviso"><p><strong>Tu contraseña es la llave de tus datos.</strong> Nunca sale de este dispositivo y nadie más la conoce: ni Ascenso ni el servidor.</p>
        <p>Si la olvidas, solo podrás recuperar tus datos con la <strong>clave de recuperación</strong> que verás la primera vez que inicies sesión.
        <strong>Sin la contraseña y sin la clave de recuperación, los datos de la cuenta no se pueden recuperar de ninguna manera.</strong></p>
        <label class="c-check"><input type="checkbox" name="entendido" required> <span>Lo he entendido</span></label></div>
        ${aviso()}<div class="c-botones">${boton("Crear la cuenta","Creando…")}</div>
        <p class="c-enlaces"><button type="button" class="c-enlace" data-accion="ir" data-vista="entrar">Ya tengo cuenta</button></p></form>`,

      creada:()=>cabecera("Confirma tu email")+`<div class="c-cuerpo"><p>Te hemos enviado un email a <strong>${esc(datos.email)}</strong>. Abre el enlace que contiene para confirmar la cuenta y, después, inicia sesión aquí.</p>
        <p class="c-nota">Si no llega en unos minutos, mira en la carpeta de correo no deseado.</p>
        <div class="c-botones"><button type="button" class="add c-pral" data-accion="ir" data-vista="entrar">Iniciar sesión</button></div></div>`,

      clave:()=>cabecera("Tu clave de recuperación")+`<form class="c-cuerpo" data-form="clave">
        <p>Guárdala ahora en un lugar seguro (un gestor de contraseñas, un papel). <strong>Solo se muestra esta vez.</strong></p>
        <p class="c-recuperacion" id="c-recuperacion">${esc(datos.claveRecuperacion)}</p>
        <div class="c-botones"><button type="button" class="add alt" data-accion="copiar">Copiar</button></div>
        <div class="c-aviso"><p>Si olvidas la contraseña, esta clave es la única forma de recuperar tus datos. Si pierdes las dos, <strong>los datos de la cuenta no se pueden recuperar</strong>.</p>
        <label class="c-check"><input type="checkbox" name="guardada" required> <span>La he guardado</span></label></div>
        ${aviso()}<div class="c-botones">${boton("Continuar","Preparando…")}</div></form>`,

      mezcla:()=>cabecera("Este dispositivo ya tiene datos")+`<div class="c-cuerpo">
        <p>¿Qué quieres hacer con lo que hay guardado en este dispositivo?</p>
        ${aviso()}<div class="c-opciones">
        <button type="button" class="c-opcion" data-accion="activar" data-modo="fusionar"${datos.ocupado?" disabled":""}><strong>Fusionar con la cuenta</strong><span>Se conserva todo: lo de aquí se une a lo de la cuenta. Si algo está en los dos sitios, queda la versión más reciente.</span></button>
        <button type="button" class="c-opcion" data-accion="activar" data-modo="reemplazar"${datos.ocupado?" disabled":""}><strong>Usar solo lo de la cuenta</strong><span>Lo que hay en este dispositivo se borra y se sustituye por los datos de la cuenta.</span></button>
        </div></div>`,

      olvidada:()=>cabecera("Contraseña olvidada")+`<form class="c-cuerpo" data-form="olvidada">
        <p>Te enviaremos un enlace por email. Al abrirlo podrás poner una contraseña nueva; para recuperar tus datos necesitarás además tu <strong>clave de recuperación</strong>.</p>
        ${campo("email","Email","email","username")}${aviso()}<div class="c-botones">${boton("Enviar el enlace","Enviando…")}</div></form>`,

      enviado:()=>cabecera("Revisa tu email")+`<div class="c-cuerpo"><p>Si hay una cuenta con <strong>${esc(datos.email)}</strong>, recibirás un enlace para poner una contraseña nueva. Ábrelo en este dispositivo.</p>
        <div class="c-botones"><button type="button" class="add alt" data-accion="cerrar">Cerrar</button></div></div>`,

      recuperar:()=>cabecera("Nueva contraseña")+`<form class="c-cuerpo" data-form="recuperar">
        <p>Escribe tu clave de recuperación y elige una contraseña nueva.</p>
        ${campo("recuperacion","Clave de recuperación","text","off",'spellcheck="false" autocapitalize="characters" class="c-mono"')}${nuevaContrasena()}
        ${aviso()}<div class="c-botones">${boton("Cambiar la contraseña","Comprobando…")}</div></form>`,

      cuenta:()=>{ const t=textos()||["","",""]; return cabecera("Cuenta")+`<div class="c-cuerpo">
        <p class="c-quien">${esc(info.email)}</p>
        <p class="c-estado" data-nivel="${t[2]}">${esc(t[0])}</p>
        <div class="c-botones"><button type="button" class="add alt" data-accion="sincronizar">Sincronizar ahora</button></div>
        <h4>Dispositivos</h4><div id="c-dispositivos" class="c-dispositivos">${pintarDispositivos()}</div>
        <h4>Seguridad</h4>
        <p class="c-nota">Tus datos se cifran en este dispositivo antes de enviarse. El servidor solo guarda contenido cifrado.</p>
        <div class="c-botones"><button type="button" class="add alt" data-accion="ir" data-vista="contrasena">Cambiar la contraseña</button>
        <button type="button" class="add alt" data-accion="ir" data-vista="salir">Cerrar sesión</button></div></div>`; },

      contrasena:()=>cabecera("Cambiar la contraseña")+`<form class="c-cuerpo" data-form="contrasena">
        ${campo("actual","Contraseña actual","password","current-password")}${nuevaContrasena()}
        <p class="c-nota">Tus datos no se vuelven a cifrar: solo cambia la llave que los abre. La clave de recuperación sigue siendo la misma.</p>
        ${aviso()}<div class="c-botones">${boton("Cambiar la contraseña","Cambiando…")}<button type="button" class="add alt" data-accion="ir" data-vista="cuenta">Cancelar</button></div></form>`,

      hecho:()=>cabecera(datos.titulo||"Hecho")+`<div class="c-cuerpo"><p>${esc(datos.texto)}</p><div class="c-botones"><button type="button" class="add c-pral" data-accion="ir" data-vista="cuenta">Aceptar</button></div></div>`,

      salir:()=>cabecera("Cerrar sesión")+`<div class="c-cuerpo">
        <p>Se borrarán de este dispositivo la sesión y las claves de cifrado. Para volver a sincronizar tendrás que iniciar sesión otra vez.</p>
        ${info.pendientes?`<p class="c-error">Hay ${info.pendientes===1?"1 cambio que aún no se ha enviado":info.pendientes+" cambios que aún no se han enviado"} a la cuenta. Si borras los datos de este dispositivo, se perderán.</p>`:""}
        ${aviso()}<div class="c-opciones">
        <button type="button" class="c-opcion" data-accion="salir" data-borrar="0"${datos.ocupado?" disabled":""}><strong>Cerrar sesión y conservar los datos aquí</strong><span>Ascenso sigue funcionando en este dispositivo, sin sincronizar.</span></button>
        <button type="button" class="c-opcion peligro" data-accion="salir" data-borrar="1"${datos.ocupado?" disabled":""}><strong>Cerrar sesión y borrar los datos de este dispositivo</strong><span>Los datos de la cuenta no se tocan: siguen en tus otros dispositivos y vuelven al iniciar sesión.</span></button>
        </div><div class="c-botones"><button type="button" class="add alt" data-accion="ir" data-vista="cuenta">Cancelar</button></div></div>`,
    };
    dlg.innerHTML=(V[vista]||V.inicio)();
  }

  // ---------------------------------------------------------------- dispositivos
  let lista=null;
  function pintarDispositivos(){
    if(!lista) return `<p class="c-nota">Cargando…</p>`;
    if(lista==="error") return `<p class="c-nota">No se pudo cargar la lista (sin conexión).</p>`;
    if(!lista.length) return `<p class="c-nota">Aparecerán aquí después de la primera sincronización.</p>`;
    return lista.map(d=>`<div class="c-disp"><div><strong>${esc(d.nombre)}</strong>${d.este?' <span class="c-este">este dispositivo</span>':""}<small>Último uso: ${esc(fecha(d.visto))}</small></div>
      ${d.este?`<button type="button" class="c-enlace" data-accion="renombrar">Cambiar nombre</button>`:`<button type="button" class="c-enlace" data-accion="quitar" data-id="${esc(d.id)}">Quitar de la lista</button>`}</div>`).join("")
      +`<p class="c-nota">La lista es informativa. Para dejar de sincronizar un dispositivo, cierra la sesión en él; si lo has perdido, cambia la contraseña.</p>`;
  }
  async function cargarDispositivos(){
    try{ lista=await Sync.dispositivos(); }catch(e){ lista="error"; }
    const c=dlg&&dlg.querySelector("#c-dispositivos"); if(c) c.innerHTML=pintarDispositivos();
  }

  // ---------------------------------------------------------------- acciones
  const ocupar=si=>{ datos.ocupado=si; if(si){ datos.error=""; for(const e of dlg.querySelectorAll(".c-error[role=alert]")) e.hidden=true; } for(const b of dlg.querySelectorAll("button[type=submit],.c-opcion")) b.disabled=si; const p=dlg.querySelector("button[type=submit]"); if(p&&si) p.textContent="Un momento…"; };
  const fallo=e=>{ datos.ocupado=false; datos.error=e&&e.message?e.message:"No se pudo completar."; const valores=[...dlg.querySelectorAll("input")].map(i=>[i.name,i.type==="checkbox"?i.checked:i.value]);
    pintar(); for(const [n,v] of valores){ const i=dlg.querySelector(`input[name="${n}"]`); if(i){ if(i.type==="checkbox") i.checked=v; else i.value=v; } } };
  function contrasenaNueva(f){
    const a=f.clave1.value, b=f.clave2.value;
    if(a.length<MIN_CONTRASENA) throw new Error("La contraseña debe tener al menos "+MIN_CONTRASENA+" caracteres. Una frase larga es fácil de recordar y difícil de adivinar.");
    if(a!==b) throw new Error("Las dos contraseñas no coinciden.");
    return a;
  }
  // Después de comprobar la contraseña: clave de recuperación (cuenta nueva), pregunta de fusión o directamente a sincronizar
  async function trasEntrar(r,mismaCuenta){
    if(r.nueva) return ir("clave",{claveRecuperacion:r.claveRecuperacion});
    if(r.hayDatosLocales&&!mismaCuenta) return ir("mezcla");
    await Sync.activar(mismaCuenta?"fusionar":"reemplazar");
    ir("cuenta");
  }
  async function alEnviar(f){
    if(datos.ocupado) return;
    const que=f.dataset.form;
    try{
      if(que==="entrar"){
        const email=f.email.value, clave=f.clave.value, misma=!!info.email;
        ocupar(true); await trasEntrar(await Sync.entrar(email,clave),misma);
      } else if(que==="crear"){
        const email=f.email.value.trim(), clave=contrasenaNueva(f);
        ocupar(true);
        const r=await Sync.crearCuenta(email,clave);
        if(r.confirmar) ir("creada",{email}); else await trasEntrar(await Sync.entrar(email,clave),false);
      } else if(que==="clave"){
        ocupar(true); await Sync.activar("fusionar"); ir("cuenta");
      } else if(que==="olvidada"){
        const email=f.email.value.trim(); ocupar(true); await Sync.pedirEnlace(email); ir("enviado",{email});
      } else if(que==="recuperar"){
        const clave=contrasenaNueva(f), rec=f.recuperacion.value;
        if(!enlace) throw new Error("El enlace ha caducado. Pide uno nuevo.");
        ocupar(true); const r=await Sync.recuperar(enlace,clave,rec); enlace=null; await trasEntrar(r,false);
      } else if(que==="contrasena"){
        const actual=f.actual.value, clave=contrasenaNueva(f);
        ocupar(true); await Sync.cambiarContrasena(actual,clave);
        ir("hecho",{titulo:"Contraseña cambiada",texto:"A partir de ahora, usa la contraseña nueva para iniciar sesión. Tus otros dispositivos siguen conectados."});
      }
    }catch(e){ fallo(e); }
  }
  async function alPulsar(e){
    const b=e.target.closest("[data-accion]"); if(!b||datos.ocupado) return;
    const a=b.dataset.accion;
    try{
      if(a==="cerrar") dlg.close();
      else if(a==="ir") ir(b.dataset.vista);
      else if(a==="copiar"){ await navigator.clipboard.writeText(datos.claveRecuperacion); b.textContent="Copiada"; }
      else if(a==="sincronizar") Sync.sincronizarAhora();
      else if(a==="activar"){ ocupar(true); await Sync.activar(b.dataset.modo); ir("cuenta"); }
      else if(a==="salir"){
        ocupar(true); const borrar=b.dataset.borrar==="1";
        await Sync.salir(borrar);
        if(borrar){ location.reload(); return; }                 // la página vuelve a empezar, como recién instalada
        dlg.close();
      }
      else if(a==="renombrar"){
        const actual=(lista||[]).find(d=>d.este), nombre=prompt("Nombre de este dispositivo",actual?actual.nombre:"");
        if(nombre&&nombre.trim()){ await Sync.renombrarDispositivo(nombre); await cargarDispositivos(); }
      }
      else if(a==="quitar"){ await Sync.quitarDispositivo(b.dataset.id); await cargarDispositivos(); }
    }catch(err){ if(a==="copiar") return; fallo(err); }
  }

  // ---------------------------------------------------------------- enlaces de los emails (confirmación y contraseña olvidada)
  // Supabase devuelve a la página con los datos en la parte «#…» de la dirección: se leen y se quitan enseguida
  function leerEnlace(){
    const h=location.hash.slice(1);
    if(!/(^|&)(access_token|error|error_description)=/.test(h)) return;
    const p=new URLSearchParams(h);
    try{ history.replaceState(null,"",location.pathname+location.search); }catch(e){ location.hash=""; }
    if(p.get("error")||p.get("error_description")){
      abrir("entrar"); datos.error=/expired|otp/i.test((p.get("error_code")||"")+(p.get("error_description")||""))?"El enlace ha caducado o ya se ha usado. Pide uno nuevo.":"El enlace no es válido."; pintar(); return;
    }
    if(p.get("type")==="recovery"&&p.get("access_token")){
      enlace=Sync.sesionDe({access_token:p.get("access_token"),refresh_token:p.get("refresh_token"),expires_in:p.get("expires_in")});
      abrir("recuperar"); return;
    }
    // Confirmación de la cuenta: la sesión que trae el enlace no sirve sin la contraseña (de ella salen las claves)
    abrir("entrar"); datos.nota="Email confirmado. Inicia sesión con tu contraseña."; pintar();
  }

  Sync.iniciar().then(leerEnlace).catch(()=>{});
  window.addEventListener("hashchange",leerEnlace);              // el enlace se abre con la aplicación ya abierta
  return {disponible:true, abrir};
})();

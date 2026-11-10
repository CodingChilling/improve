// Sincronización de Ascenso con la cuenta (Supabase), cifrada de extremo a extremo.
//
// Habla directamente con las API de Supabase usando fetch (Auth, PostgREST, Storage) y un WebSocket (Realtime):
// no hace falta ninguna librería. Lo que sube y baja son «cambios»: una fila por cada versión de un registro,
// con una etiqueta opaca y el contenido cifrado (ver cifrado.js). El servidor no puede leer nada.
//
//   Subida   cada cambio local espera en «pendientes» y se envía en lotes, 0,8 s después del último cambio.
//            Sin conexión se queda esperando y se reintenta (al volver la conexión, al volver a la app y cada cierto tiempo).
//   Bajada   se piden los cambios posteriores al último recibido. Realtime solo avisa de que hay algo nuevo.
//   Conflictos  gana la versión más reciente de cada registro (lo decide servidor-local.js al aplicarlos).
//
// La sesión (tokens) y las claves viven en IndexedDB; las claves no se pueden exportar. Nada va a localStorage
// ni a la consola.
"use strict";
window.AscensoSync=(()=>{
  const config=window.ASCENSO_CONFIG||{}, Local=window.AscensoLocal, Almacen=window.AscensoAlmacen, Cifrado=window.AscensoCifrado;
  const URL_BASE=String(config.supabaseUrl||"").replace(/\/+$/,""), CLAVE_PUBLICA=String(config.supabaseClave||"");
  const disponible=!config.clasico&&!!URL_BASE&&!!CLAVE_PUBLICA&&!!Local&&!!Cifrado&&typeof crypto==="object"&&!!crypto.subtle;
  const ESPERA_SUBIDA=800, LOTE_FILAS=40, LOTE_BYTES=3000000, PAGINA=100;

  // ---------------------------------------------------------------- peticiones
  class ErrorRed extends Error{ constructor(){ super("sin conexión"); } }
  class ErrorServidor extends Error{ constructor(estado,codigo,mensaje){ super(mensaje||codigo||("error "+estado)); this.estado=estado; this.codigo=String(codigo||""); } }
  class ErrorSesion extends Error{ constructor(){ super("la sesión ha caducado"); } }

  async function pedir(ruta,{metodo="GET",cuerpo,token,cabeceras,binario}={}){
    const h={apikey:CLAVE_PUBLICA,...(cabeceras||{})};
    if(token) h.Authorization="Bearer "+token;
    let body;
    if(cuerpo instanceof Uint8Array){ body=cuerpo; h["Content-Type"]="application/octet-stream"; }
    else if(cuerpo!==undefined){ body=JSON.stringify(cuerpo); h["Content-Type"]="application/json"; }
    let r;
    try{ r=await fetch(URL_BASE+ruta,{method:metodo,headers:h,body,cache:"no-store",credentials:"omit",referrerPolicy:"no-referrer"}); }
    catch(e){ throw new ErrorRed(); }
    if(!r.ok){
      let j={}; try{ j=await r.json(); }catch(e){}
      throw new ErrorServidor(r.status,j.error_code||j.code||j.error||j.statusCode,j.msg||j.message||j.error_description);
    }
    if(binario) return r.arrayBuffer();
    const t=await r.text();
    return t?JSON.parse(t):null;
  }
  const direccionVuelta=()=>location.origin+location.pathname;      // adonde vuelven los enlaces de los emails

  // ---------------------------------------------------------------- cuenta y sesión
  // {email, userId, sesion:{acceso, renovacion, caduca}, claves:{cifrado, etiquetas}}
  let cuenta=null, dispositivo="", lider=false;
  const canal=typeof BroadcastChannel==="function"?new BroadcastChannel("ascenso-sync"):null;

  const sesionDe=j=>({acceso:j.access_token,renovacion:j.refresh_token,caduca:Date.now()+(Number(j.expires_in)||3600)*1000});
  async function guardarCuenta(){ await Almacen.ponerMeta("cuenta",cuenta); if(canal) canal.postMessage({tipo:"cuenta"}); }

  let renovando=null;
  function renovar(){
    if(!renovando) renovando=(async()=>{
      const c=cuenta; if(!c) throw new ErrorSesion();
      let j;
      try{ j=await pedir("/auth/v1/token?grant_type=refresh_token",{metodo:"POST",cuerpo:{refresh_token:c.sesion.renovacion}}); }
      catch(e){ if(e instanceof ErrorServidor&&e.estado>=400&&e.estado<500) throw new ErrorSesion(); throw e; }
      if(cuenta!==c) throw new ErrorSesion();
      c.sesion=sesionDe(j); await guardarCuenta();
      tiempoReal.nuevoToken();
    })().finally(()=>{ renovando=null; });
    return renovando;
  }
  // Ejecuta una petición con el token de la sesión; si ha caducado, lo renueva y repite una vez
  async function conSesion(f){
    if(!cuenta) throw new ErrorSesion();
    if(cuenta.sesion.caduca-Date.now()<60000) await renovar();
    try{ return await f(cuenta.sesion.acceso); }
    catch(e){
      if(!(e instanceof ErrorServidor)||e.estado!==401) throw e;
      await renovar(); return f(cuenta.sesion.acceso);
    }
  }

  // ---------------------------------------------------------------- estado visible
  // "sin-cuenta" | "sincronizado" | "sincronizando" | "sin-conexion" | "error"
  let estado="sin-cuenta", detalle="", pendientes=0;
  function poner(e,d){
    estado=e; detalle=d||"";
    const info=informe();
    document.dispatchEvent(new CustomEvent("ascenso:sync",{detail:info}));
    if(canal&&lider) canal.postMessage({tipo:"estado",info});
  }
  const informe=()=>({estado,detalle,pendientes,email:cuenta?cuenta.email:null});

  // ---------------------------------------------------------------- bajada
  async function bajar(){
    const c=cuenta;
    for(;;){
      const ultimo=(await Almacen.meta("ultimo_seq"))||0, completa=!!(await Almacen.meta("descarga_completa"));
      // Tras la primera descarga completa, lo que ha subido este mismo dispositivo no hace falta volver a bajarlo
      const filtro=completa?"&dispositivo=neq."+encodeURIComponent(dispositivo):"";
      const filas=await conSesion(t=>pedir("/rest/v1/cambios?select=seq,dispositivo,registro,datos&seq=gt."+ultimo+filtro+"&order=seq.asc&limit="+PAGINA,{token:t}));
      if(cuenta!==c) return;
      const remotos=[]; let hasta=ultimo;
      for(const f of filas||[]){
        hasta=Math.max(hasta,Number(f.seq)||0);
        try{
          const o=await Cifrado.descifrar(c.claves,f.datos);
          // La etiqueta debe corresponder al contenido: el servidor no puede hacer pasar un registro por otro
          if(!o||await Cifrado.etiqueta(c.claves,o.tabla,o.id)!==f.registro) continue;
          remotos.push({tabla:o.tabla,id:o.id,actualizado:o.actualizado,borrado:o.borrado===true,valores:o.valores,dispositivo:f.dispositivo});
        }catch(e){ /* una fila que no se puede descifrar se ignora: no debe parar al resto */ }
      }
      const fin=!filas||filas.length<PAGINA;
      const meta={ultimo_seq:hasta}; if(fin&&!completa) meta.descarga_completa=true;
      await Local.aplicarRemotos(remotos,meta);
      if(fin) return;
    }
  }

  // ---------------------------------------------------------------- subida
  const rutaAdjunto=async(c,id)=>"/storage/v1/object/adjuntos/"+c.userId+"/"+await Cifrado.etiqueta(c.claves,"adjunto",id);
  async function subirAdjunto(c,id){
    const a=await Almacen.leer("adjuntos",id);
    if(!a||!a.datos) return;                                   // no está en este dispositivo: lo subió (o lo subirá) otro
    const ruta=await rutaAdjunto(c,id), cifrado=await Cifrado.cifrarArchivo(c.claves,a.datos);
    try{ await conSesion(t=>pedir(ruta,{metodo:"POST",cuerpo:cifrado,token:t})); }
    catch(e){ if(!(e instanceof ErrorServidor)||!(e.estado===409||/duplicate|exists/i.test(e.codigo+" "+e.message))) throw e; }   // ya estaba subida
  }
  async function subir(){
    const c=cuenta;
    for(;;){
      const todos=(await Almacen.todos("pendientes")).sort((a,b)=>a.actualizado<b.actualizado?-1:1);
      pendientes=todos.length;
      if(!todos.length||cuenta!==c) return;
      poner("sincronizando");
      const lote=[], filas=[]; let bytes=0;
      for(const p of todos){
        if(p.tabla==="adjuntos"){
          if(!p.borrado) await subirAdjunto(c,p.id);
          else { try{ await conSesion(async t=>pedir(await rutaAdjunto(c,p.id),{metodo:"DELETE",token:t})); }catch(e){ if(e instanceof ErrorRed||e instanceof ErrorSesion) throw e; } }
        }
        const datos=await Cifrado.cifrar(c.claves,{tabla:p.tabla,id:p.id,actualizado:p.actualizado,borrado:p.borrado===true,valores:p.borrado?null:p.datos});
        filas.push({dispositivo,registro:await Cifrado.etiqueta(c.claves,p.tabla,p.id),datos});
        lote.push(p); bytes+=datos.length;
        if(lote.length>=LOTE_FILAS||bytes>=LOTE_BYTES) break;
      }
      await conSesion(t=>pedir("/rest/v1/cambios",{metodo:"POST",cuerpo:filas,token:t,cabeceras:{Prefer:"return=minimal"}}));
      // Se quitan de la cola solo si no han vuelto a cambiar mientras se enviaban
      await Almacen.tx(["pendientes"],"readwrite",async s=>{
        for(const p of lote){
          const ahora=await Almacen.pedir(s.pendientes.get([p.tabla,p.id]));
          if(ahora&&ahora.actualizado===p.actualizado) s.pendientes.delete([p.tabla,p.id]);
        }
      });
    }
  }

  // ---------------------------------------------------------------- ciclo: bajar y subir
  let enCurso=false, otraVez=false, temporizador=null, fallos=0, ultimoCiclo=0;
  function pedirCiclo(espera=0){
    if(!cuenta||!lider) return;
    clearTimeout(temporizador);
    temporizador=setTimeout(ciclo,espera);
  }
  async function ciclo(){
    if(!cuenta||!lider) return;
    if(enCurso){ otraVez=true; return; }
    enCurso=true; otraVez=false;
    const c=cuenta;
    try{
      if(estado!=="sincronizado") poner("sincronizando");
      await bajar();
      await subir();
      if(cuenta!==c) return;
      pendientes=(await Almacen.todos("pendientes")).length;
      fallos=0; ultimoCiclo=Date.now();
      try{ await anotarDispositivo(); }catch(e){ /* la lista de dispositivos es informativa: no debe parar nada */ }
      poner(pendientes?"sincronizando":"sincronizado");
      if(pendientes) otraVez=true;
      tiempoReal.conectar();
    }catch(e){
      if(cuenta!==c) return;
      try{ pendientes=(await Almacen.todos("pendientes")).length; }catch(e2){}
      fallos++;
      if(e instanceof ErrorSesion){ poner("error","sesion"); tiempoReal.cerrar(); return; }
      if(e instanceof ErrorRed) poner("sin-conexion");
      else poner("error",e instanceof ErrorServidor?"servidor":"interno");
      // Reintento con espera creciente: 2 s, 4 s, 8 s… hasta 1 minuto (5 minutos si el fallo no es de conexión)
      clearTimeout(temporizador);
      temporizador=setTimeout(ciclo,Math.min(e instanceof ErrorRed?60000:300000,1000*2**Math.min(fallos,9)));
    }finally{
      enCurso=false;
      if(otraVez&&cuenta===c){ otraVez=false; pedirCiclo(ESPERA_SUBIDA); }
    }
  }

  // ---------------------------------------------------------------- Realtime: aviso de cambios en la cuenta
  const tiempoReal=(()=>{
    let ws=null, latido=null, ref=0, reintento=null, intentos=0, tema="";
    const enviar=(evento,carga)=>{ if(ws&&ws.readyState===1) ws.send(JSON.stringify({topic:evento==="heartbeat"?"phoenix":tema,event:evento,payload:carga,ref:String(++ref)})); };
    function cerrar(){
      clearInterval(latido); clearTimeout(reintento); latido=reintento=null;
      if(ws){ ws.onclose=ws.onmessage=ws.onerror=ws.onopen=null; try{ ws.close(); }catch(e){} ws=null; }
    }
    function conectar(){
      if(ws||!cuenta||!lider||typeof WebSocket!=="function") return;
      const c=cuenta;
      tema="realtime:cambios-"+c.userId;
      let s;
      try{ s=new WebSocket(URL_BASE.replace(/^http/,"ws")+"/realtime/v1/websocket?apikey="+encodeURIComponent(CLAVE_PUBLICA)+"&vsn=1.0.0"); }catch(e){ return; }
      ws=s;
      s.onopen=()=>{
        intentos=0;
        enviar("phx_join",{config:{broadcast:{self:false},presence:{key:""},
          postgres_changes:[{event:"INSERT",schema:"public",table:"cambios",filter:"user_id=eq."+c.userId}]},access_token:c.sesion.acceso});
        latido=setInterval(()=>enviar("heartbeat",{}),25000);
        pedirCiclo(0);                                            // por si llegó algo mientras no había conexión
      };
      s.onmessage=m=>{
        let d; try{ d=JSON.parse(m.data); }catch(e){ return; }
        // Solo es un aviso: los cambios se piden después por la vía normal (una libreta puede no caber en el mensaje)
        if(d&&d.event==="postgres_changes"){
          const fila=d.payload&&d.payload.data&&d.payload.data.record;
          if(!fila||fila.dispositivo!==dispositivo) pedirCiclo(150);
        }
      };
      s.onclose=s.onerror=()=>{
        if(ws!==s) return;
        cerrar();
        if(cuenta&&lider&&estado!=="error") reintento=setTimeout(conectar,Math.min(60000,1000*2**Math.min(++intentos,6)));
      };
    }
    const nuevoToken=()=>{ if(cuenta) enviar("access_token",{access_token:cuenta.sesion.acceso}); };
    return {conectar,cerrar,nuevoToken};
  })();

  // ---------------------------------------------------------------- imágenes de las libretas
  const tipoDe=u=>u[0]===0x89&&u[1]===0x50?"image/png":u[0]===0xFF&&u[1]===0xD8?"image/jpeg":u[0]===0x47&&u[1]===0x49?"image/gif":"image/webp";
  // Una imagen que está en la cuenta pero aún no en este dispositivo se descarga la primera vez que hace falta
  async function descargarAdjunto(id){
    const c=cuenta; if(!c) return null;
    try{
      const cifrado=await conSesion(async t=>pedir(await rutaAdjunto(c,id),{token:t,binario:true}));
      const datos=await Cifrado.descifrarArchivo(c.claves,cifrado), tipo=tipoDe(new Uint8Array(datos));
      await Local.guardarBlob(id,tipo,datos);
      return {id,tipo,datos};
    }catch(e){ return null; }
  }

  // ---------------------------------------------------------------- dispositivos
  function nombrePorDefecto(){
    const ua=navigator.userAgent||"";
    const nav=/Edg\//.test(ua)?"Edge":/Firefox\//.test(ua)?"Firefox":/Chrome\//.test(ua)?"Chrome":/Safari\//.test(ua)?"Safari":"Navegador";
    const so=/iPhone/.test(ua)?"iPhone":/iPad/.test(ua)?"iPad":/Android/.test(ua)?"Android":/Mac OS X/.test(ua)?"Mac":/Windows/.test(ua)?"Windows":/Linux/.test(ua)?"Linux":"";
    return so?nav+" en "+so:nav;
  }
  const hoy=()=>new Date().toISOString().slice(0,10);
  // Una vez al día, este dispositivo anota en la cuenta que sigue en uso (su nombre va cifrado)
  async function anotarDispositivo(forzar){
    const c=cuenta; if(!c) return;
    if(!forzar&&await Almacen.meta("dispositivo_visto")===hoy()) return;
    const nombre=(await Almacen.meta("dispositivo_nombre"))||nombrePorDefecto();
    await conSesion(async t=>pedir("/rest/v1/dispositivos?on_conflict=user_id,dispositivo",{metodo:"POST",token:t,
      cabeceras:{Prefer:"resolution=merge-duplicates,return=minimal"},
      cuerpo:{dispositivo,nombre:await Cifrado.cifrar(c.claves,{nombre}),visto:new Date().toISOString()}}));
    await Almacen.ponerMeta("dispositivo_visto",hoy());
  }
  async function dispositivos(){
    const c=cuenta; if(!c) return [];
    const filas=await conSesion(t=>pedir("/rest/v1/dispositivos?select=dispositivo,nombre,creado,visto&order=visto.desc",{token:t}));
    const out=[];
    for(const f of filas||[]){
      let nombre="Dispositivo"; try{ nombre=String((await Cifrado.descifrar(c.claves,f.nombre)).nombre||nombre).slice(0,60); }catch(e){}
      out.push({id:f.dispositivo,nombre,creado:f.creado,visto:f.visto,este:f.dispositivo===dispositivo});
    }
    return out;
  }
  async function renombrarDispositivo(nombre){
    await Almacen.ponerMeta("dispositivo_nombre",String(nombre||"").trim().slice(0,60)||nombrePorDefecto());
    await anotarDispositivo(true);
  }
  const quitarDispositivo=id=>conSesion(t=>pedir("/rest/v1/dispositivos?dispositivo=eq."+encodeURIComponent(id),{metodo:"DELETE",token:t}));

  // ---------------------------------------------------------------- crear cuenta, entrar, salir
  const mensajeDe=e=>{
    if(e instanceof ErrorRed) return "No hay conexión. Inténtalo de nuevo cuando la tengas.";
    if(e instanceof ErrorSesion) return "La sesión ha caducado. Inicia sesión de nuevo.";
    if(e instanceof ErrorServidor){
      const c=e.codigo+" "+e.message;
      if(/invalid_credentials|invalid login|invalid_grant/i.test(c)) return "El email o la contraseña no son correctos.";
      if(/email_not_confirmed|not confirmed/i.test(c)) return "Falta confirmar el email: abre el enlace que te enviamos.";
      if(/user_already_exists|already registered/i.test(c)) return "Ya hay una cuenta con ese email.";
      if(/rate_limit|too many|429/i.test(c)||e.estado===429) return "Demasiados intentos seguidos. Espera unos minutos.";
      if(/email_address_invalid|validation_failed/i.test(c)) return "Ese email no parece válido.";
      if(/signup_disabled/i.test(c)) return "El registro de cuentas nuevas está desactivado en el servidor.";
      if(/same_password/i.test(c)) return "La contraseña nueva es igual que la anterior.";
      if(/otp_expired|expired/i.test(c)) return "El enlace ha caducado. Pide uno nuevo.";
      return "El servidor no lo ha aceptado ("+(e.codigo||e.estado)+").";
    }
    return e&&e.message?e.message:"No se pudo completar.";
  };
  // Los fallos que llegan a la interfaz llevan ya un mensaje para la persona
  const paraPersona=async f=>{ try{ return await f(); }catch(e){ const x=new Error(mensajeDe(e)); x.causa=e; throw x; } };

  const crearCuenta=(email,contrasena)=>paraPersona(async()=>{
    email=Cifrado.normalizarEmail(email);
    const d=await Cifrado.derivar(email,contrasena);
    const j=await pedir("/auth/v1/signup?redirect_to="+encodeURIComponent(direccionVuelta()),{metodo:"POST",cuerpo:{email,password:d.acceso}});
    // Con la confirmación por email activada no hay sesión hasta abrir el enlace
    return {confirmar:!(j&&j.access_token)};
  });

  // Entrar es en dos pasos: «entrar» comprueba la contraseña y abre las claves; «activar» une este dispositivo a la cuenta
  let entrada=null;
  async function abrirPerfil(sesion,userId,envoltorio){
    const leer=()=>pedir("/rest/v1/perfiles?select=clave_envuelta,clave_envuelta_anterior,clave_recuperacion_envuelta&user_id=eq."+userId,{token:sesion.acceso});
    let perfil=(await leer()||[])[0], claveRecuperacion=null;
    if(!perfil){
      // Primera vez que se entra en la cuenta: se crea la clave de datos y, con ella, la clave de recuperación
      const bruta=Cifrado.nuevaClaveDeDatos(), recuperacion=Cifrado.nuevaClaveRecuperacion();
      try{
        await pedir("/rest/v1/perfiles",{metodo:"POST",token:sesion.acceso,cabeceras:{Prefer:"return=minimal"},cuerpo:{
          clave_envuelta:await Cifrado.envolver(envoltorio,bruta),
          clave_recuperacion_envuelta:await Cifrado.envolver(await Cifrado.envoltorioDeRecuperacion(recuperacion),bruta),
          version_cifrado:Cifrado.VERSION}});
        return {claves:await Cifrado.clavesDeDatos(bruta),nueva:true,claveRecuperacion:recuperacion};
      }catch(e){
        if(!(e instanceof ErrorServidor)||e.estado!==409) throw e;
        perfil=(await leer()||[])[0];                             // otro dispositivo la creó a la vez
        if(!perfil) throw e;
      }finally{ bruta.fill(0); }
    }
    for(const sobre of [perfil.clave_envuelta,perfil.clave_envuelta_anterior]){
      if(!sobre) continue;
      try{ const bruta=await Cifrado.desenvolver(envoltorio,sobre); try{ return {claves:await Cifrado.clavesDeDatos(bruta),nueva:false,claveRecuperacion}; } finally{ bruta.fill(0); } }
      catch(e){ /* se prueba con la siguiente */ }
    }
    throw new Error("La contraseña es correcta, pero no abre la clave de tus datos. Usa «He olvidado la contraseña» con tu clave de recuperación.");
  }
  const entrar=(email,contrasena)=>paraPersona(async()=>{
    email=Cifrado.normalizarEmail(email);
    const d=await Cifrado.derivar(email,contrasena);
    const j=await pedir("/auth/v1/token?grant_type=password",{metodo:"POST",cuerpo:{email,password:d.acceso}});
    const sesion=sesionDe(j), userId=j.user&&j.user.id;
    if(!userId) throw new Error("El servidor no ha devuelto la cuenta.");
    const p=await abrirPerfil(sesion,userId,d.envoltorio);
    entrada={email,userId,sesion,claves:p.claves};
    return {nueva:p.nueva,claveRecuperacion:p.claveRecuperacion,hayDatosLocales:await Local.hayDatosPropios()};
  });
  // modo: "fusionar" (lo de aquí se une a lo de la cuenta) o "reemplazar" (lo de aquí se borra y se baja lo de la cuenta)
  async function activar(modo){
    if(!entrada) throw new Error("No hay ningún inicio de sesión en curso.");
    const nueva=entrada; entrada=null;
    detener();
    if(modo==="reemplazar") await Local.vaciarDatos(); else await Local.encolarTodo();
    await Almacen.tx(["meta"],"readwrite",s=>{ s.meta.put({clave:"ultimo_seq",valor:0}); s.meta.delete("descarga_completa"); s.meta.delete("dispositivo_visto"); });
    cuenta=nueva; await guardarCuenta();
    arrancar();
    return modo;
  }
  const cancelarEntrada=()=>{ entrada=null; };

  // Cierra la sesión en este dispositivo: se borran la sesión y las claves y, si se pide, también los datos
  async function salir(borrarDatos){
    const c=cuenta;
    detener();
    if(c){
      // De cortesía (si hay conexión): se retira este dispositivo de la lista y se anula la sesión en el servidor
      try{ await pedir("/rest/v1/dispositivos?dispositivo=eq."+encodeURIComponent(dispositivo),{metodo:"DELETE",token:c.sesion.acceso}); }catch(e){}
      try{ await pedir("/auth/v1/logout?scope=local",{metodo:"POST",token:c.sesion.acceso}); }catch(e){}
    }
    cuenta=null;
    await Almacen.tx(["meta"],"readwrite",s=>{ for(const k of ["cuenta","ultimo_seq","descarga_completa","dispositivo_visto"]) s.meta.delete(k); });
    if(borrarDatos) await Local.vaciarDatos();
    if(canal) canal.postMessage({tipo:"cuenta"});
    pendientes=0; poner("sin-cuenta");
  }

  const cambiarContrasena=(actual,nueva)=>paraPersona(async()=>{
    const c=cuenta; if(!c) throw new ErrorSesion();
    const viejo=await Cifrado.derivar(c.email,actual);
    const perfil=(await conSesion(t=>pedir("/rest/v1/perfiles?select=clave_envuelta,clave_envuelta_anterior&user_id=eq."+c.userId,{token:t}))||[])[0];
    if(!perfil) throw new Error("No se encuentra el perfil de la cuenta.");
    let bruta=null;
    for(const sobre of [perfil.clave_envuelta,perfil.clave_envuelta_anterior]){ if(sobre&&!bruta){ try{ bruta=await Cifrado.desenvolver(viejo.envoltorio,sobre); }catch(e){} } }
    if(!bruta) throw new Error("La contraseña actual no es correcta.");
    try{ await reenvolver(c.userId,c.email,nueva,bruta,perfil.clave_envuelta,t=>conSesion(t)); }
    finally{ bruta.fill(0); }
  });
  // Cambia la contraseña sin volver a cifrar los datos: solo se envuelve de nuevo la clave de datos.
  // Primero se guarda el envoltorio nuevo (conservando el anterior) y después se cambia la clave de acceso:
  // si el segundo paso falla, se sigue pudiendo entrar con la contraseña anterior.
  async function reenvolver(userId,email,contrasena,bruta,envueltaActual,conToken){
    const d=await Cifrado.derivar(email,contrasena);
    const filtro="/rest/v1/perfiles?user_id=eq."+userId, minimo={Prefer:"return=minimal"};
    await conToken(async t=>pedir(filtro,{metodo:"PATCH",token:t,cabeceras:minimo,cuerpo:{clave_envuelta:await Cifrado.envolver(d.envoltorio,bruta),clave_envuelta_anterior:envueltaActual}}));
    try{ await conToken(t=>pedir("/auth/v1/user",{metodo:"PUT",token:t,cuerpo:{password:d.acceso}})); }
    catch(e){
      try{ await conToken(t=>pedir(filtro,{metodo:"PATCH",token:t,cabeceras:minimo,cuerpo:{clave_envuelta:envueltaActual,clave_envuelta_anterior:null}})); }catch(e2){}
      throw e;
    }
  }

  // ---- contraseña olvidada: enlace por email + clave de recuperación ----
  const pedirEnlace=email=>paraPersona(()=>pedir("/auth/v1/recover?redirect_to="+encodeURIComponent(direccionVuelta()),{metodo:"POST",cuerpo:{email:Cifrado.normalizarEmail(email)}}));
  // «enlace» es la sesión temporal que trae el enlace del email: {acceso, renovacion, caduca}
  const recuperar=(enlace,contrasena,claveRecuperacion)=>paraPersona(async()=>{
    const u=await pedir("/auth/v1/user",{token:enlace.acceso});
    const email=Cifrado.normalizarEmail(u&&u.email), userId=u&&u.id;
    if(!email||!userId) throw new Error("El enlace no es válido. Pide uno nuevo.");
    const perfil=(await pedir("/rest/v1/perfiles?select=clave_envuelta,clave_recuperacion_envuelta&user_id=eq."+userId,{token:enlace.acceso})||[])[0];
    if(!perfil) throw new Error("Esta cuenta aún no tiene datos guardados: crea la cuenta de nuevo o inicia sesión.");
    let bruta;
    try{ bruta=await Cifrado.desenvolver(await Cifrado.envoltorioDeRecuperacion(claveRecuperacion),perfil.clave_recuperacion_envuelta); }
    catch(e){ throw new Error("La clave de recuperación no es correcta."); }
    try{
      await reenvolver(userId,email,contrasena,bruta,perfil.clave_envuelta,f=>f(enlace.acceso));
      entrada={email,userId,sesion:enlace,claves:await Cifrado.clavesDeDatos(bruta)};
    } finally { bruta.fill(0); }
    return {nueva:false,claveRecuperacion:null,hayDatosLocales:await Local.hayDatosPropios()};
  });

  // ---------------------------------------------------------------- arranque
  function detener(){
    clearTimeout(temporizador); temporizador=null; tiempoReal.cerrar(); fallos=0;
  }
  function arrancar(){
    if(!cuenta){ poner("sin-cuenta"); return; }
    if(lider){ poner("sincronizando"); pedirCiclo(0); }
  }
  async function cargarCuenta(){
    const c=await Almacen.meta("cuenta");
    cuenta=c&&c.sesion&&c.claves?c:null;
  }
  async function iniciar(){
    if(!disponible) return;
    dispositivo=await Local.dispositivo();
    await cargarCuenta();
    Local.alFaltarAdjunto(descargarAdjunto);
    // Con cuenta, las imágenes huérfanas solo se borran cuando este dispositivo está al día
    Local.permitirLimpieza(()=>!cuenta||estado==="sincronizado");
    Local.alCambiar(()=>{ if(cuenta&&lider){ if(estado==="sincronizado") poner("sincronizando"); pedirCiclo(ESPERA_SUBIDA); } });
    window.addEventListener("online",()=>pedirCiclo(0));
    document.addEventListener("visibilitychange",()=>{ if(!document.hidden&&(estado!=="sincronizado"||Date.now()-ultimoCiclo>30000)) pedirCiclo(0); });
    // Por si Realtime no llega (redes que cortan los WebSocket): una comprobación cada 5 minutos con la app a la vista
    setInterval(()=>{ if(!document.hidden&&cuenta&&lider&&estado!=="error"&&Date.now()-ultimoCiclo>240000) pedirCiclo(0); },60000);
    if(canal) canal.onmessage=async e=>{
      const d=e.data; if(!d) return;
      if(d.tipo==="cuenta"){                                      // otra pestaña ha entrado, salido o renovado la sesión
        const antes=cuenta&&cuenta.userId;
        await cargarCuenta();
        if((cuenta&&cuenta.userId)!==antes){ detener(); arrancar(); }
      }
      if(d.tipo==="pregunta"&&lider) canal.postMessage({tipo:"estado",info:informe()});      // una pestaña recién abierta pregunta cómo va
      if(d.tipo==="estado"&&!lider&&d.info){ estado=d.info.estado; detalle=d.info.detalle; pendientes=d.info.pendientes; document.dispatchEvent(new CustomEvent("ascenso:sync",{detail:informe()})); }
    };
    poner(cuenta?"sincronizando":"sin-cuenta");
    if(canal) canal.postMessage({tipo:"pregunta"});
    // Con varias pestañas abiertas, solo una sincroniza; las demás ven sus cambios al momento
    const serLider=()=>{ lider=true; arrancar(); };
    if(navigator.locks&&navigator.locks.request) navigator.locks.request("ascenso-sync",()=>{ serLider(); return new Promise(()=>{}); }).catch(serLider);
    else serLider();
  }

  return {disponible, iniciar, informe, crearCuenta, entrar, activar, cancelarEntrada, salir, cambiarContrasena, pedirEnlace, recuperar,
          dispositivos, renombrarDispositivo, quitarDispositivo, sincronizarAhora:()=>{ fallos=0; pedirCiclo(0); }, sesionDe};
})();

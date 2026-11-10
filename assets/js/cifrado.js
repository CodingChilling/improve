// Cifrado de extremo a extremo de Ascenso. Solo usa WebCrypto (lo que trae el navegador).
//
//   contraseña + email ──PBKDF2-SHA256 (600.000 vueltas)──► clave maestra (nunca sale de aquí)
//   clave maestra ──HKDF──► clave de acceso      lo que se envía al servidor como «contraseña»
//                 ──HKDF──► clave de envoltorio  cifra la clave de datos para guardarla en la cuenta
//   clave de datos (aleatoria, 256 bits) ──HKDF──► clave de cifrado (AES-256-GCM) + clave de etiquetas (HMAC-SHA256)
//
// El servidor solo ve la clave de acceso, la clave de datos envuelta y contenido cifrado. Sin la contraseña
// o la clave de recuperación no se puede descifrar nada. Nada de esto se escribe en la consola ni en localStorage.
"use strict";
window.AscensoCifrado=(()=>{
  const VERSION=1, VUELTAS=600000;
  const cs=crypto.subtle, cod=new TextEncoder(), dec=new TextDecoder();

  const aB64u=buf=>{ const u=new Uint8Array(buf); let s=""; for(let i=0;i<u.length;i+=0x8000) s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));
    return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,""); };
  const deB64u=t=>{ const bin=atob(String(t).replace(/-/g,"+").replace(/_/g,"/")); const u=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i); return u; };
  const normalizarEmail=e=>String(e||"").trim().toLowerCase();

  const hkdf=async(material,info,bits=256)=>{
    const base=material instanceof CryptoKey?material:await cs.importKey("raw",material,"HKDF",false,["deriveBits","deriveKey"]);
    return new Uint8Array(await cs.deriveBits({name:"HKDF",hash:"SHA-256",salt:new Uint8Array(32),info:cod.encode(info)},base,bits));
  };
  const claveAes=(bytes,usos)=>cs.importKey("raw",bytes,{name:"AES-GCM"},false,usos);

  // De la contraseña salen la clave de acceso (para el servidor) y la de envoltorio (para la clave de datos)
  async function derivar(email,contrasena){
    const sal=cod.encode("ascenso:"+normalizarEmail(email));
    const base=await cs.importKey("raw",cod.encode(String(contrasena).normalize("NFKC")),"PBKDF2",false,["deriveBits"]);
    const maestra=new Uint8Array(await cs.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:sal,iterations:VUELTAS},base,256));
    try{
      return {acceso:aB64u(await hkdf(maestra,"ascenso/acceso/v1")), envoltorio:await claveAes(await hkdf(maestra,"ascenso/envoltorio/v1"),["encrypt","decrypt"])};
    } finally { maestra.fill(0); }
  }

  // ---- cifrado autenticado: «v1.<iv>.<contenido>» en base64url, con un IV aleatorio de 12 bytes ----
  async function cifrarBytes(clave,bytes){
    const iv=crypto.getRandomValues(new Uint8Array(12));
    return {iv,datos:new Uint8Array(await cs.encrypt({name:"AES-GCM",iv},clave,bytes))};
  }
  async function cifrarTexto(clave,texto){ const c=await cifrarBytes(clave,cod.encode(texto)); return "v"+VERSION+"."+aB64u(c.iv)+"."+aB64u(c.datos); }
  async function descifrarTexto(clave,sobre){
    const p=String(sobre).split(".");
    if(p.length!==3||p[0]!=="v"+VERSION) throw new Error("formato de cifrado desconocido");
    return dec.decode(await cs.decrypt({name:"AES-GCM",iv:deB64u(p[1])},clave,deB64u(p[2])));
  }

  // ---- clave de datos ----
  // Las claves que se guardan en el dispositivo no se pueden exportar: se usan, pero no se pueden leer
  async function clavesDeDatos(bruta){
    return {cifrado:await claveAes(await hkdf(bruta,"ascenso/datos/cifrado/v1"),["encrypt","decrypt"]),
            etiquetas:await cs.importKey("raw",await hkdf(bruta,"ascenso/datos/etiquetas/v1"),{name:"HMAC",hash:"SHA-256"},false,["sign"])};
  }
  const nuevaClaveDeDatos=()=>crypto.getRandomValues(new Uint8Array(32));
  const envolver=(envoltorio,bruta)=>cifrarTexto(envoltorio,aB64u(bruta));
  // Devuelve la clave de datos en bruto: quien la pide debe usarla y borrarla (bruta.fill(0)) enseguida
  async function desenvolver(envoltorio,sobre){ const b=deB64u(await descifrarTexto(envoltorio,sobre)); if(b.length!==32) throw new Error("clave de datos no válida"); return b; }

  // ---- clave de recuperación: 160 bits al azar, que se enseñan una sola vez en grupos fáciles de copiar ----
  const LETRAS="ABCDEFGHJKMNPQRSTVWXYZ23456789";            // sin letras ni cifras que se confundan (I, L, O, U, 0, 1)
  function nuevaClaveRecuperacion(){
    // 32 caracteres de un alfabeto de 30: unos 157 bits
    const out=[]; const lim=Math.floor(256/LETRAS.length)*LETRAS.length;
    while(out.length<32){ for(const b of crypto.getRandomValues(new Uint8Array(48))){ if(b<lim&&out.length<32) out.push(LETRAS[b%LETRAS.length]); } }
    return out.join("").replace(/(.{4})(?=.)/g,"$1-");
  }
  const limpiarRecuperacion=t=>String(t||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
  async function envoltorioDeRecuperacion(clave){
    const limpia=limpiarRecuperacion(clave);
    if(limpia.length!==32||[...limpia].some(c=>!LETRAS.includes(c))) throw new Error("clave de recuperación no válida");
    return claveAes(await hkdf(cod.encode(limpia),"ascenso/recuperacion/v1"),["encrypt","decrypt"]);
  }

  // ---- lo que viaja a la cuenta ----
  // Etiqueta de un registro: no revela ni la tabla ni el identificador
  const etiqueta=async(claves,tabla,id)=>aB64u(await cs.sign("HMAC",claves.etiquetas,cod.encode(tabla+":"+id)));
  const cifrar=(claves,objeto)=>cifrarTexto(claves.cifrado,JSON.stringify(objeto));
  const descifrar=async(claves,sobre)=>JSON.parse(await descifrarTexto(claves.cifrado,sobre));
  // Imágenes: IV (12 bytes) seguido del contenido cifrado
  async function cifrarArchivo(claves,buffer){ const c=await cifrarBytes(claves.cifrado,buffer); const u=new Uint8Array(12+c.datos.length); u.set(c.iv); u.set(c.datos,12); return u; }
  async function descifrarArchivo(claves,buffer){ const u=new Uint8Array(buffer); return cs.decrypt({name:"AES-GCM",iv:u.subarray(0,12)},claves.cifrado,u.subarray(12)); }

  return {VERSION, normalizarEmail, derivar, nuevaClaveDeDatos, clavesDeDatos, envolver, desenvolver,
          nuevaClaveRecuperacion, envoltorioDeRecuperacion, etiqueta, cifrar, descifrar, cifrarArchivo, descifrarArchivo};
})();

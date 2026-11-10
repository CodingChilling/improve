// Almacén de Ascenso en el navegador: una base de datos IndexedDB, que es la fuente de verdad local.
//
//   registros   un registro por entidad: {tabla, id, actualizado, borrado, valores}
//   pendientes  cambios aún no enviados a la cuenta: {tabla, id, actualizado, borrado, datos}
//   adjuntos    contenido de las imágenes de las libretas: {id, tipo, datos (ArrayBuffer), huerfano_desde}
//   meta        ajustes internos del dispositivo: {clave, valor}
"use strict";
window.AscensoAlmacen=(()=>{
  const NOMBRE="ascenso", VERSION=1;
  let abierta=null;

  function abrir(){
    if(abierta) return abierta;
    abierta=new Promise((ok,ko)=>{
      let p;
      try{ p=indexedDB.open(NOMBRE,VERSION); }catch(e){ ko(e); return; }
      p.onupgradeneeded=()=>{
        const bd=p.result;
        if(!bd.objectStoreNames.contains("registros")) bd.createObjectStore("registros",{keyPath:["tabla","id"]});
        if(!bd.objectStoreNames.contains("pendientes")) bd.createObjectStore("pendientes",{keyPath:["tabla","id"]});
        if(!bd.objectStoreNames.contains("adjuntos")) bd.createObjectStore("adjuntos",{keyPath:"id"});
        if(!bd.objectStoreNames.contains("meta")) bd.createObjectStore("meta",{keyPath:"clave"});
      };
      p.onsuccess=()=>{
        const bd=p.result;
        // Otra pestaña con una versión más nueva necesita actualizar la base de datos: se le deja paso
        bd.onversionchange=()=>{ bd.close(); abierta=null; };
        ok(bd);
      };
      p.onerror=()=>ko(p.error||new Error("no se pudo abrir la base de datos"));
      p.onblocked=()=>ko(new Error("la base de datos está ocupada por otra pestaña"));
    });
    abierta.catch(()=>{ abierta=null; });
    return abierta;
  }

  const pedir=p=>new Promise((ok,ko)=>{ p.onsuccess=()=>ok(p.result); p.onerror=()=>ko(p.error); });

  // Una transacción: «hacer» recibe los almacenes por nombre y puede devolver un valor (o una promesa).
  // Se resuelve cuando la transacción ha terminado de guardarse; si algo falla, no se guarda nada.
  async function tx(almacenes, modo, hacer){
    const bd=await abrir();
    return new Promise((ok,ko)=>{
      const t=bd.transaction(almacenes,modo), s={};
      for(const n of almacenes) s[n]=t.objectStore(n);
      let resultado;
      t.oncomplete=()=>ok(resultado);
      t.onerror=()=>ko(t.error||new Error("error de la base de datos"));
      t.onabort=()=>ko(t.error||new Error("error de la base de datos"));
      try{
        const r=hacer(s);
        if(r&&typeof r.then==="function") r.then(v=>{ resultado=v; },e=>{ try{ t.abort(); }catch(e2){} ko(e); });
        else resultado=r;
      }catch(e){ try{ t.abort(); }catch(e2){} ko(e); }
    });
  }

  const todos=almacen=>tx([almacen],"readonly",s=>pedir(s[almacen].getAll()));
  const leer=(almacen,clave)=>tx([almacen],"readonly",s=>pedir(s[almacen].get(clave)));
  const guardar=(almacen,valor)=>tx([almacen],"readwrite",s=>{ s[almacen].put(valor); });
  const quitar=(almacen,clave)=>tx([almacen],"readwrite",s=>{ s[almacen].delete(clave); });

  // Ajustes internos (identificador del dispositivo, último cambio recibido…)
  const meta=async clave=>{ const r=await leer("meta",clave); return r?r.valor:undefined; };
  const ponerMeta=(clave,valor)=>guardar("meta",{clave,valor});

  // Borra todo lo guardado en este dispositivo
  const vaciar=()=>tx(["registros","pendientes","adjuntos","meta"],"readwrite",s=>{ for(const a of Object.values(s)) a.clear(); });

  return {abrir, tx, pedir, todos, leer, guardar, quitar, meta, ponerMeta, vaciar};
})();

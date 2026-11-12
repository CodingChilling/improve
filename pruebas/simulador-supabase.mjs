// Simulador mínimo de Supabase para las pruebas: Auth, PostgREST (perfiles, cambios, dispositivos), Storage y Realtime.
// Imita solo lo que usa Ascenso, con las mismas reglas que la migración (cada persona ve y añade solo lo suyo;
// los cambios no se modifican ni se borran). No sustituye a probar contra un proyecto real: no ejecuta el SQL.
// Todo queda en memoria, a la vista de las pruebas, para comprobar qué llega al servidor (y que llega cifrado).
import http from "node:http";
import crypto from "node:crypto";

const azar = () => crypto.randomBytes(18).toString("base64url");

export function simuladorSupabase({ confirmarEmail = true, caducidad = 3600 } = {}) {
  const bd = { usuarios: new Map(), tokens: new Map(), renovaciones: new Map(), perfiles: new Map(), cambios: [], dispositivos: [], archivos: new Map(), seq: 0, emails: [], peticiones: [] };
  const enchufes = new Set();           // conexiones de Realtime: {socket, userId, tema}
  let cortado = false;                  // simula una caída del servidor

  // Como en Supabase, el testigo de renovación es de un solo uso: quien presenta uno ya gastado pierde la sesión
  // entera (todos los testigos de esa «familia»). bd.usados recuerda los gastados y a qué familia pertenecían.
  bd.usados = new Map(); bd.familias = new Map();
  const sesion = (u, familia = azar()) => {
    const access_token = "acc." + azar(), refresh_token = "ren." + azar();
    bd.tokens.set(access_token, { userId: u.id, caduca: Date.now() + caducidad * 1000, familia });
    bd.renovaciones.set(refresh_token, u.id); bd.familias.set(refresh_token, familia);
    return { access_token, refresh_token, token_type: "bearer", expires_in: caducidad, user: { id: u.id, email: u.email } };
  };
  const quien = req => {
    const t = (req.headers.authorization || "").replace(/^Bearer /, ""), s = bd.tokens.get(t);
    return s && s.caduca > Date.now() ? bd.usuarios.get(s.userId) : null;
  };
  const avisar = fila => {
    for (const e of enchufes) if (e.userId === fila.user_id && e.tema)
      enviarWs(e.socket, { topic: e.tema, event: "postgres_changes", ref: null, payload: { data: { type: "INSERT", schema: "public", table: "cambios", record: { seq: fila.seq, dispositivo: fila.dispositivo } }, ids: [1] } });
  };

  const srv = http.createServer(async (req, res) => {
    const u = new URL(req.url, "http://x"), ruta = u.pathname, q = u.searchParams;
    const cors = { "Access-Control-Allow-Origin": req.headers.origin || "*", "Access-Control-Allow-Headers": "apikey, authorization, content-type, prefer, x-upsert", "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS" };
    const responder = (estado, cuerpo, tipo = "application/json") => { res.writeHead(estado, { ...cors, "Content-Type": tipo }); res.end(cuerpo === undefined ? "" : Buffer.isBuffer(cuerpo) ? cuerpo : JSON.stringify(cuerpo)); };
    if (req.method === "OPTIONS") return responder(204);
    if (cortado) { req.socket.destroy(); return; }
    const trozos = []; for await (const t of req) trozos.push(t);
    const crudo = Buffer.concat(trozos);
    let cuerpo = null; if ((req.headers["content-type"] || "").includes("json") && crudo.length) { try { cuerpo = JSON.parse(crudo.toString("utf8")); } catch (e) { return responder(400, { message: "JSON no válido" }); } }
    bd.peticiones.push({ metodo: req.method, ruta, cuerpo: crudo.toString("latin1"), cabeceras: JSON.stringify(req.headers) });
    if (!req.headers.apikey) return responder(401, { message: "No API key found in request" });
    const yo = quien(req);

    // ---- Auth
    if (ruta === "/auth/v1/signup" && req.method === "POST") {
      const email = String(cuerpo.email || "").toLowerCase();
      if ([...bd.usuarios.values()].some(x => x.email === email)) return responder(422, { error_code: "user_already_exists", msg: "User already registered" });
      const nuevo = { id: crypto.randomUUID(), email, clave: cuerpo.password, confirmado: !confirmarEmail };
      bd.usuarios.set(nuevo.id, nuevo);
      if (!confirmarEmail) return responder(200, sesion(nuevo));
      bd.emails.push({ para: email, tipo: "signup", vuelta: q.get("redirect_to") });
      return responder(200, { id: nuevo.id, email });
    }
    if (ruta === "/auth/v1/token" && req.method === "POST") {
      if (q.get("grant_type") === "password") {
        const x = [...bd.usuarios.values()].find(x => x.email === String(cuerpo.email || "").toLowerCase());
        if (!x || x.clave !== cuerpo.password) return responder(400, { error_code: "invalid_credentials", msg: "Invalid login credentials" });
        if (!x.confirmado) return responder(400, { error_code: "email_not_confirmed", msg: "Email not confirmed" });
        return responder(200, sesion(x));
      }
      const id = bd.renovaciones.get(cuerpo.refresh_token), familia = bd.familias.get(cuerpo.refresh_token);
      if (!id && bd.usados.has(cuerpo.refresh_token)) {
        const f = bd.usados.get(cuerpo.refresh_token);
        for (const [t, x] of bd.familias) if (x === f) { bd.renovaciones.delete(t); bd.familias.delete(t); }
        for (const [t, x] of bd.tokens) if (x.familia === f) bd.tokens.delete(t);
        return responder(400, { error_code: "refresh_token_already_used", msg: "Invalid Refresh Token: Already Used" });
      }
      if (!id) return responder(400, { error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" });
      bd.renovaciones.delete(cuerpo.refresh_token); bd.familias.delete(cuerpo.refresh_token); bd.usados.set(cuerpo.refresh_token, familia);
      if (bd.fallarRenovacion) { const estado = bd.fallarRenovacion; bd.fallarRenovacion = 0; bd.renovaciones.set(cuerpo.refresh_token, id); bd.familias.set(cuerpo.refresh_token, familia); bd.usados.delete(cuerpo.refresh_token); return responder(estado, { code: estado, msg: "inténtalo más tarde" }); }
      return responder(200, sesion(bd.usuarios.get(id), familia));
    }
    if (ruta === "/auth/v1/recover" && req.method === "POST") {
      bd.emails.push({ para: String(cuerpo.email || "").toLowerCase(), tipo: "recovery", vuelta: q.get("redirect_to") });
      return responder(200, {});
    }
    if (ruta.startsWith("/auth/v1/") || ruta.startsWith("/rest/v1/") || ruta.startsWith("/storage/v1/")) {
      if (!yo) return responder(401, { code: "PGRST301", message: "JWT expired" });
    }
    if (ruta === "/auth/v1/user" && req.method === "GET") return responder(200, { id: yo.id, email: yo.email });
    if (ruta === "/auth/v1/user" && req.method === "PUT") { yo.clave = cuerpo.password; return responder(200, { id: yo.id, email: yo.email }); }
    if (ruta === "/auth/v1/logout" && req.method === "POST") { bd.tokens.delete(req.headers.authorization.replace(/^Bearer /, "")); return responder(204); }

    // ---- PostgREST
    const filtro = (nombre, valor) => { const f = q.get(nombre); if (!f) return true; const [op, ...r] = f.split("."), v = r.join(".");
      return op === "eq" ? String(valor) === v : op === "neq" ? String(valor) !== v : op === "gt" ? Number(valor) > Number(v) : true; };
    if (ruta === "/rest/v1/perfiles") {
      if (req.method === "GET") { const p = bd.perfiles.get(yo.id); return responder(200, p && filtro("user_id", yo.id) ? [p] : []); }
      if (req.method === "POST") {
        if (bd.perfiles.has(yo.id)) return responder(409, { code: "23505", message: "duplicate key value" });
        bd.perfiles.set(yo.id, { user_id: yo.id, clave_envuelta_anterior: null, ...cuerpo, user_id: yo.id }); return responder(201);
      }
      if (req.method === "PATCH") { if (bd.perfiles.has(yo.id) && filtro("user_id", yo.id)) Object.assign(bd.perfiles.get(yo.id), cuerpo, { user_id: yo.id }); return responder(204); }
    }
    if (ruta === "/rest/v1/cambios") {
      if (req.method === "GET") {
        const filas = bd.cambios.filter(c => c.user_id === yo.id && filtro("seq", c.seq) && filtro("dispositivo", c.dispositivo)).slice(0, Number(q.get("limit")) || 1000);
        return responder(200, filas.map(({ seq, dispositivo, registro, datos }) => ({ seq, dispositivo, registro, datos })));
      }
      if (req.method === "POST") {
        for (const f of [].concat(cuerpo)) { const fila = { seq: ++bd.seq, user_id: yo.id, dispositivo: f.dispositivo, registro: f.registro, datos: f.datos, creado: new Date().toISOString() }; bd.cambios.push(fila); avisar(fila); }
        return responder(201);
      }
      return responder(403, { code: "42501", message: "permission denied for table cambios" });      // ni UPDATE ni DELETE
    }
    if (ruta === "/rest/v1/dispositivos") {
      if (req.method === "GET") return responder(200, bd.dispositivos.filter(d => d.user_id === yo.id));
      if (req.method === "POST") {
        const d = bd.dispositivos.find(d => d.user_id === yo.id && d.dispositivo === cuerpo.dispositivo);
        if (d) Object.assign(d, cuerpo); else bd.dispositivos.push({ creado: new Date().toISOString(), ...cuerpo, user_id: yo.id });
        return responder(201);
      }
      if (req.method === "DELETE") { bd.dispositivos = bd.dispositivos.filter(d => !(d.user_id === yo.id && filtro("dispositivo", d.dispositivo))); return responder(204); }
    }

    // ---- Storage: cada persona, solo su carpeta
    const m = ruta.match(/^\/storage\/v1\/object\/adjuntos\/([^/]+)\/([^/]+)$/);
    if (m) {
      if (m[1] !== yo.id) return responder(403, { statusCode: "403", error: "Unauthorized", message: "new row violates row-level security policy" });
      const clave = m[1] + "/" + m[2];
      if (req.method === "POST") { if (bd.archivos.has(clave)) return responder(400, { statusCode: "409", error: "Duplicate", message: "The resource already exists" }); bd.archivos.set(clave, crudo); return responder(200, { Key: "adjuntos/" + clave }); }
      if (req.method === "GET") return bd.archivos.has(clave) ? responder(200, bd.archivos.get(clave), "application/octet-stream") : responder(404, { statusCode: "404", error: "not_found", message: "Object not found" });
      if (req.method === "DELETE") { bd.archivos.delete(clave); return responder(200, {}); }
    }
    responder(404, { message: "ruta no simulada: " + req.method + " " + ruta });
  });

  // ---- Realtime: un WebSocket con el protocolo de Phoenix (unirse, latidos y avisos de inserciones)
  function enviarWs(socket, objeto) {
    const datos = Buffer.from(JSON.stringify(objeto)), n = datos.length;
    const cab = n < 126 ? Buffer.from([0x81, n]) : n < 65536 ? Buffer.from([0x81, 126, n >> 8, n & 255]) : Buffer.concat([Buffer.from([0x81, 127]), (() => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(n)); return b; })()]);
    try { socket.write(Buffer.concat([cab, datos])); } catch (e) { /* ya cerrado */ }
  }
  srv.on("upgrade", (req, socket) => {
    if (cortado || !req.url.startsWith("/realtime/v1/websocket")) return socket.destroy();
    const acepta = crypto.createHash("sha1").update(req.headers["sec-websocket-key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
    socket.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + acepta + "\r\n\r\n");
    const e = { socket, userId: null, tema: null }; enchufes.add(e);
    let resto = Buffer.alloc(0);
    socket.on("data", trozo => {
      resto = Buffer.concat([resto, trozo]);
      for (;;) {
        if (resto.length < 2) return;
        let n = resto[1] & 127, pos = 2;
        if (n === 126) { if (resto.length < 4) return; n = resto.readUInt16BE(2); pos = 4; } else if (n === 127) { if (resto.length < 10) return; n = Number(resto.readBigUInt64BE(2)); pos = 10; }
        if (resto.length < pos + 4 + n) return;
        const mascara = resto.subarray(pos, pos + 4), carga = Buffer.from(resto.subarray(pos + 4, pos + 4 + n)), op = resto[0] & 15;
        resto = resto.subarray(pos + 4 + n);
        for (let i = 0; i < carga.length; i++) carga[i] ^= mascara[i & 3];
        if (op === 8) { socket.end(); return; }
        if (op !== 1) continue;
        let msj; try { msj = JSON.parse(carga.toString("utf8")); } catch (err) { continue; }
        if (msj.event === "phx_join") {
          const s = bd.tokens.get(msj.payload && msj.payload.access_token);
          if (s && s.caduca > Date.now()) { e.userId = s.userId; e.tema = msj.topic; }
          enviarWs(socket, { topic: msj.topic, event: "phx_reply", ref: msj.ref, payload: { status: e.userId ? "ok" : "error", response: {} } });
        } else if (msj.event === "heartbeat") enviarWs(socket, { topic: "phoenix", event: "phx_reply", ref: msj.ref, payload: { status: "ok", response: {} } });
      }
    });
    const fuera = () => enchufes.delete(e);
    socket.on("close", fuera); socket.on("error", fuera);
  });

  return new Promise(ok => srv.listen(0, "127.0.0.1", () => {
    const url = "http://127.0.0.1:" + srv.address().port;
    ok({
      url, bd,
      // Lo que haría la persona al abrir el enlace del email
      confirmar(email) { const x = [...bd.usuarios.values()].find(x => x.email === email.toLowerCase()); x.confirmado = true; const e = bd.emails.find(e => e.para === x.email && e.tipo === "signup"); return e.vuelta + "#access_token=" + sesion(x).access_token + "&expires_in=3600&refresh_token=x&token_type=bearer&type=signup"; },
      enlaceRecuperacion(email) { const x = [...bd.usuarios.values()].find(x => x.email === email.toLowerCase()); const e = bd.emails.findLast(e => e.para === x.email && e.tipo === "recovery"), s = sesion(x); return e.vuelta + "#access_token=" + s.access_token + "&expires_in=3600&refresh_token=" + s.refresh_token + "&token_type=bearer&type=recovery"; },
      cortar(si) { cortado = si; if (si) for (const e of enchufes) e.socket.destroy(); },
      caducarSesiones() { for (const t of bd.tokens.values()) t.caduca = 0; },
      // Todo lo que el servidor ha llegado a ver, en un solo texto (para buscar si se ha escapado algo sin cifrar)
      todoLoVisto() { return JSON.stringify([...bd.perfiles.values(), bd.cambios, bd.dispositivos]) + bd.peticiones.map(p => p.ruta + p.cuerpo).join("\n") + [...bd.archivos.values()].map(b => b.toString("latin1")).join("\n"); },
      cerrar: () => new Promise(r => { for (const e of enchufes) e.socket.destroy(); srv.closeAllConnections(); srv.close(r); }),
    });
  }));
}

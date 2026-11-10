// La migración de Supabase (supabase/migraciones/001_inicial.sql), ejecutada en un PostgreSQL de verdad:
// se puede ejecutar dos veces, y las reglas (RLS) hacen lo que dicen. Cada persona solo ve y añade lo suyo,
// y los cambios no se pueden modificar ni borrar.
// Necesita PostgreSQL instalado (initdb, pg_ctl, psql); si no lo encuentra, la prueba se salta.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { RAIZ } from "./util.mjs";

function carpetaPostgres() {
  for (const base of ["/usr/lib/postgresql", "/usr/local/opt/postgresql/bin", "/opt/homebrew/bin", "/usr/bin"]) {
    if (!fs.existsSync(base)) continue;
    const candidatas = base.endsWith("postgresql") ? fs.readdirSync(base).sort((a, b) => b - a).map(v => path.join(base, v, "bin")) : [base];
    for (const c of candidatas) if (fs.existsSync(path.join(c, "initdb"))) return c;
  }
  return null;
}
const BIN = carpetaPostgres();

test("migración SQL: se ejecuta, se puede repetir y las reglas de acceso se cumplen", { skip: BIN ? false : "PostgreSQL no está instalado" }, () => {
  // PostgreSQL no arranca como administrador del sistema: en ese caso se usa el usuario «postgres»
  const root = process.getuid && process.getuid() === 0;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ascenso-pg-")), puerto = String(40000 + Math.floor(Math.random() * 20000));
  const correr = (prog, args, entrada) => { const r = spawnSync(root ? "runuser" : path.join(BIN, prog), root ? ["-u", "postgres", "--", path.join(BIN, prog), ...args] : args, { encoding: "utf8", input: entrada }); return r; };
  if (root) { fs.chmodSync(dir, 0o755); spawnSync("chown", ["postgres", dir]); }
  const datos = path.join(dir, "datos");
  try {
    let r = correr("initdb", ["-D", datos, "-A", "trust", "-U", "postgres", "--no-sync"]); assert.equal(r.status, 0, r.stderr);
    r = correr("pg_ctl", ["-D", datos, "-o", `-p ${puerto} -k ${dir} -c listen_addresses=''`, "-w", "-l", path.join(dir, "registro.log"), "start"]); assert.equal(r.status, 0, r.stderr + r.stdout);
    // Ejecuta SQL y devuelve {ok, salida, error}
    const sql = texto => { const x = correr("psql", ["-h", dir, "-p", puerto, "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qAt", "-f", "-"], texto);
      return { ok: x.status === 0, salida: x.stdout.trim(), error: x.stderr.trim() }; };
    const bien = texto => { const x = sql(texto); assert.ok(x.ok, x.error + "\n" + texto); return x.salida; };
    const como = (uid, texto) => `set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);\n` + texto;
    const falla = (texto, motivo) => { const x = sql(texto); assert.ok(!x.ok, "debería fallar: " + texto); assert.match(x.error, motivo); };

    bien(fs.readFileSync(path.join(RAIZ, "pruebas", "datos", "supabase-minimo.sql"), "utf8"));
    const migracion = fs.readFileSync(path.join(RAIZ, "supabase", "migraciones", "001_inicial.sql"), "utf8");
    bien(migracion);
    bien(migracion);                                               // se puede volver a ejecutar

    const [A, B] = bien("insert into auth.users (email) values ('a@x'), ('b@x') returning id;").split("\n");
    const sobre = "v1.aaaa.bbbb";

    // ---- perfiles: cada persona crea y cambia solo el suyo
    bien(como(A, `insert into perfiles (clave_envuelta, clave_recuperacion_envuelta) values ('${sobre}', '${sobre}');`));
    bien(como(B, `insert into perfiles (clave_envuelta, clave_recuperacion_envuelta) values ('${sobre}', '${sobre}');`));
    falla(como(A, `insert into perfiles (user_id, clave_envuelta, clave_recuperacion_envuelta) values ('${B}', 'x', 'x');`), /duplicate key|row-level security/);
    assert.equal(bien(como(A, "select count(*) from perfiles;")).split("\n").pop(), "1");
    assert.equal(bien(como(A, `update perfiles set clave_envuelta = 'nueva', clave_envuelta_anterior = '${sobre}' where true returning user_id;`)).split("\n").pop(), A, "solo cambia el propio");
    assert.equal(bien(`select clave_envuelta from perfiles where user_id = '${B}';`), sobre, "el perfil de otra persona no se toca");
    falla(como(A, `update perfiles set user_id = '${B}';`), /permission denied/);
    falla(como(A, "delete from perfiles;"), /permission denied/);

    // ---- cambios: se añaden y se leen los propios; el dueño es siempre quien inserta
    bien(como(A, `insert into cambios (dispositivo, registro, datos) values ('d1', 'r1', 'x1'), ('d1', 'r2', 'x2');`));
    bien(como(A, `insert into cambios (user_id, seq, dispositivo, registro, datos) values ('${B}', 1, 'd1', 'r3', 'x3');`));   // ni dueño ni número falsos
    bien(como(B, `insert into cambios (dispositivo, registro, datos) values ('d9', 'r1', 'de B');`));
    assert.equal(bien(`select count(*) from cambios where user_id = '${A}';`), "3");
    const seqs = bien(como(A, "select seq from cambios order by seq;")).split("\n").slice(1).map(Number);
    assert.equal(seqs.length, 3, "A solo ve sus tres cambios");
    assert.ok(seqs[0] < seqs[1] && seqs[1] < seqs[2] && seqs[2] > 1, "números de orden crecientes, puestos por el servidor");
    assert.equal(bien(como(B, "select datos from cambios;")).split("\n").pop(), "de B");
    assert.equal(bien(como(A, `select count(*) from cambios where seq > ${seqs[0]} and dispositivo <> 'd9';`)).split("\n").pop(), "2");
    falla(como(A, "update cambios set datos = 'manipulado';"), /permission denied/);
    falla(como(A, "delete from cambios;"), /permission denied/);
    falla(como(A, `insert into cambios (dispositivo, registro, datos) values ('${"d".repeat(41)}', 'r', 'x');`), /cambios_tamano/);
    // Sin sesión no se puede nada
    for (const t of ["perfiles", "cambios", "dispositivos"]) falla(`set role anon; select * from ${t};`, /permission denied/);
    falla("set role anon; insert into cambios (dispositivo, registro, datos) values ('d', 'r', 'x');", /permission denied/);

    // ---- dispositivos
    bien(como(A, `insert into dispositivos (dispositivo, nombre) values ('d1', 'n') on conflict (user_id, dispositivo) do update set nombre = excluded.nombre, visto = now();`));
    bien(como(A, `insert into dispositivos (dispositivo, nombre) values ('d1', 'n2') on conflict (user_id, dispositivo) do update set nombre = excluded.nombre, visto = now();`));
    assert.equal(bien(como(A, "select nombre from dispositivos;")).split("\n").pop(), "n2");
    assert.equal(bien(como(B, "select count(*) from dispositivos;")).split("\n").pop(), "0");
    bien(como(A, "delete from dispositivos where dispositivo = 'd1';"));

    // ---- Storage: cada persona, solo su carpeta del bucket privado
    assert.equal(bien("select public::text || ' ' || file_size_limit from storage.buckets where id = 'adjuntos';"), "false 16777216");
    bien(como(A, `insert into storage.objects (bucket_id, name) values ('adjuntos', '${A}/etiqueta');`));
    falla(como(A, `insert into storage.objects (bucket_id, name) values ('adjuntos', '${B}/etiqueta');`), /row-level security/);
    assert.equal(bien(como(B, "select count(*) from storage.objects;")).split("\n").pop(), "0");
    assert.equal(bien(como(A, "delete from storage.objects returning 1;")).split("\n").pop(), "1");

    // ---- Realtime y compactación
    assert.equal(bien("select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'cambios';"), "1");
    falla(como(A, "select public.compactar_cambios();"), /permission denied/);
    bien(como(A, `insert into cambios (dispositivo, registro, datos) values ('d1', 'r1', 'x1 más nuevo');`));
    bien(`update cambios set creado = now() - interval '40 days' where datos in ('x1', 'x2');`);
    assert.equal(bien("select public.compactar_cambios();"), "1", "solo se borra la versión antigua que tiene otra posterior");
    assert.equal(bien(`select string_agg(datos, ',' order by seq) from cambios where user_id = '${A}';`), "x2,x3,x1 más nuevo");
  } finally {
    correr("pg_ctl", ["-D", datos, "-m", "immediate", "stop"]);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

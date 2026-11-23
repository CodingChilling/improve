# Pruebas de Ascenso

Pruebas automáticas con [Playwright](https://playwright.dev) y el ejecutor de pruebas de Node. La aplicación no
depende de nada de esta carpeta: aquí solo hay herramientas de desarrollo.

## Lanzarlas

Hace falta Node 20 o superior, Python 3 y, para la prueba del SQL, PostgreSQL (si no está, esa prueba se salta).

```bash
cd pruebas
```

```bash
npm install
```

```bash
npx playwright install chromium
```

```bash
npm test
```

Las capturas de la prueba móvil quedan en `pruebas/resultados/`.

## Qué comprueba cada una

| Archivo | Qué comprueba |
|---|---|
| `paridad.test.mjs` | `servidor-local.js` responde igual que `servidor.py` a más de cien operaciones (válidas y no válidas), y la copia que exporta la versión de Python se importa tal cual. |
| `local.test.mjs` | La página guarda en IndexedDB y no en `localStorage`; migración de datos antiguos; imágenes de las libretas y limpieza de huérfanas; la versión clásica sigue funcionando (con el perfil y los objetivos en `ascenso.db`, y sin bloqueo). |
| `movil.test.mjs` | iPhone y Android emulados: nada desborda la pantalla; arrastrar tareas, tarjetas y nodos con el dedo; zoom con dos dedos; la barra de abajo, el botón «atrás» y los tamaños para el dedo. |
| `libreria.test.mjs` | La librería: añadir un EPUB y un PDF (generados en `libros.mjs`), que el contenido hostil de un libro no llegue a la página, leer, índice, subrayados y notas, posición recordada, ajustes, móvil, y sincronización cifrada entre dos dispositivos. |
| `pwa.test.mjs` | Lo que se publica en GitHub Pages: solo la aplicación, rutas relativas, política de seguridad, funcionamiento sin conexión y aviso de versión nueva. |
| `cifrado.test.mjs` | Derivación de claves, cifrado de ida y vuelta, claves equivocadas y contenido manipulado. |
| `sync.test.mjs` | Dos dispositivos con la misma cuenta: altas, cambios, borrados (también en cascada), edición sin conexión, conflictos, imágenes, dos pestañas, sesión recordada. Y que el servidor no recibe nada sin cifrar. |
| `perfil.test.mjs` | El perfil: niveles (120 nombres, curva, experiencia que sube y baja con los datos), acceso por la racha y la barra, Ajustes (figura, nombre, «mi porqué», tema, configuración movida, cuenta). |
| `estadisticas.test.mjs` | Las estadísticas con datos sintéticos: periodos, % y rachas por hábito, calendario, productividad, ánimo, zonas del cuerpo y descubrimientos (solo con datos suficientes, nunca como causas). |
| `objetivos.test.mjs` | Los objetivos con datos sintéticos: cómo se mide cada tipo, cuándo se cumplen o no, y los 150 puntos de experiencia (también con objetivos de nivel). |
| `objetivos-ui.test.mjs` | Los objetivos desde el perfil: crear (con errores), progreso, cuadrado de la figura, título escapado, archivar y eliminar con dos toques. |
| `resumenes.test.mjs` | Los resúmenes: periodos cerrados y sus títulos, cifras de una semana, aviso del lunes en el día, navegar ‹ ›, mes, y la imagen PNG de 1080 × 1350. |
| `bloqueo.test.mjs` | El bloqueo: poner el PIN (sin guardarlo), oculta desde antes de pintar, espera tras 5 fallos (también al recargar), segundo plano, huella con un autenticador virtual de WebAuthn, cambiar el PIN y «olvidé el PIN». |
| `zonas.test.mjs` | Áreas de color de los mapas, con ratón y con el dedo: crear, mover con los nodos de dentro o sola, tamaño, forma, color, bloquear, título, buscar, borrar y deshacer. |
| `notas.test.mjs` | Las frases (ids únicos y completos) y el diario de reflexiones y notas: lista con la frase de cada día, filtros, búsqueda e ir al día. |
| `entreno.test.mjs` | Tipos de entreno propios (añadir, color, quitar con sustituto o archivar) y cambios de entreno de un día: hacia las semanas siguientes, nunca hacia las pasadas. |
| `sin-conexion.test.mjs` | Con cuenta y sin red: Ascenso abre con la sesión y todo lo de la cuenta (tareas, imágenes de las libretas y libros, bajados antes sin abrirlos); lo hecho sin conexión se envía al volver; si la sesión se pierde, volver a entrar continúa sin subir todo otra vez. |
| `sesion.test.mjs` | La sesión guardada: sigue ahí al reabrir, y no se pierde con Ascenso abierto en varias ventanas, con una pestaña dormida o por un fallo pasajero del servidor. |
| `cuenta.test.mjs` | El panel: crear cuenta, fusionar o reemplazar, cambiar la contraseña, recuperarla con la clave de recuperación, sesión caducada, servidor caído y cerrar sesión. |
| `sql.test.mjs` | La migración de Supabase en un PostgreSQL real: se puede repetir y las reglas de acceso (RLS) se cumplen. |
| `sync-real.test.mjs` | Sincronización contra un proyecto de Supabase de verdad. Se salta si no se configura (ver abajo). |

## El simulador de Supabase

`sync.test.mjs` y `cuenta.test.mjs` usan `simulador-supabase.mjs`: un servidor mínimo que imita las partes de
Supabase que usa Ascenso (Auth, PostgREST, Storage y Realtime) y guarda en memoria todo lo que recibe. Sirve para
probar la sincronización sin credenciales ni conexión, y para comprobar qué llega exactamente al servidor.
No ejecuta el SQL: de eso se encarga `sql.test.mjs`.

## Contra un proyecto de Supabase real

Usa un **proyecto de pruebas aparte**, no el de uso diario: la prueba escribe datos en la cuenta.

1. Crea el proyecto y ejecuta en él `supabase/migraciones/001_inicial.sql` (como explica el README).
2. Abre Ascenso apuntando a ese proyecto, crea una cuenta de pruebas y confirma el email.
3. Lanza la prueba con sus datos (solo la clave publicable; nunca la `service_role`):

```bash
SUPABASE_URL="https://<proyecto>.supabase.co" SUPABASE_CLAVE="sb_publishable_…" ASCENSO_EMAIL="pruebas@ejemplo.com" ASCENSO_CONTRASENA="…" node --test sync-real.test.mjs
```

No guardes esos valores en el repositorio (`pruebas/.env` está en `.gitignore` por si quieres tenerlos a mano).

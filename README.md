# Ascenso

Aplicación personal para seguir hábitos, tareas y progreso, con una frase para cada día.

Se puede usar de dos maneras:

- **Aplicación instalable** (móvil y escritorio): una página que se instala como una app, guarda todo en el
  propio dispositivo y funciona sin conexión. Si quieres, con una cuenta sincroniza tus dispositivos entre sí,
  **cifrando los datos de extremo a extremo**: el servidor nunca puede leerlos.
- **Versión clásica**, solo en tu ordenador: la misma página servida por un pequeño servidor en Python que guarda
  todo en una base de datos SQLite. No necesita internet ni cuenta.

En los dos casos, sin dependencias: ni frameworks, ni paquetes que instalar para usarla.

## Qué incluye

- **Hábitos** diarios configurables (en qué días aplican, si cuentan para la racha o el porcentaje semanal), racha y progreso semanal, registro de peso.
- **Plan semanal** de entrenamiento (escalada, fuerza, descanso activo, descanso).
- **Tareas** por día al estilo de Trello: tres listas (Pendientes, En proceso, Hechas), arrastrar y soltar, prioridades (urgente, alta, media, baja) y etiquetas con color.
- **Frase del día** y **imagen del día**, sin repetirse hasta agotar todas, con historial guardado.
- **Copia de seguridad**: exportar e importar todos los datos en JSON.

Además, hay varias funciones que no se ven a simple vista (ver más abajo).

## Funciones ocultas

Para mantener la página limpia, algunas funciones no tienen botón propio: se abren pulsando
elementos que ya están en la página y que, a primera vista, parecen solo decorativos.

| Dónde pulsar | Qué se abre |
|---|---|
| El título **«Ascenso»** | Los tableros |
| La **fecha** bajo el título | El calendario con los eventos |
| Las **comillas** de la frase del día | La reflexión y las notas del día |
| El **marco** de la imagen del día | Otra imagen para ese día |
| El **texto de estado** («Guardado…», al pie de la página y en la cabecera de los tableros) | La cuenta y la sincronización |
| El **nombre del autor** de la frase del día | La librería (solo en la aplicación instalable) |

Todas se cierran con <kbd>Esc</kbd>, pulsando fuera o volviendo a pulsar el mismo elemento
(en los tableros, pulsando de nuevo «Ascenso» para volver al día).

### Tableros (título «Ascenso»)

Una vista propia, al estilo de Trello, que no depende del día: lo que hay en los tableros es igual
hoy que dentro de un mes.

- **Tableros**: varios, cada uno con su color (que tiñe su cabecera). Una página de inicio los muestra
  todos; se pueden marcar como favoritos (★, aparecen primero) y ordenar arrastrándolos. Al crear uno,
  se elige empezar vacío o con las listas «Por hacer · En proceso · Hecho». Ascenso recuerda el último
  tablero abierto.
- **Listas**: con el título que se quiera (se cambia haciendo clic en él), con contador de tarjetas.
  Se ordenan arrastrándolas por la cabecera. Desde su menú ⋯ se pueden plegar, mover a otro tablero o
  eliminar (eligiendo si sus tarjetas pasan a otra lista o se borran).
- **Tarjetas**: se crean escribiendo al final de una lista y pulsando Intro, y se arrastran entre listas
  o dentro de la misma. Al hacer clic se abre su ficha: prioridad (o sin prioridad), etiquetas propias
  del tablero, fecha límite opcional (gris, naranja si vence hoy o mañana, roja si ya venció),
  descripción y checklist. También se pueden duplicar.
- **Buscador**: busca en todos los tableros, por título, descripción o checklist.
- **Pasar entre tareas y tableros**: desde la ficha de una tarjeta, «Pasar a tareas del día»; desde la
  ficha de una tarea, «Pasar a un tablero».

### Calendario (la fecha)

Calendario mensual con eventos de colores. Cada evento tiene título, color, hora opcional y puede durar
uno o varios días (se dibuja como una barra que cruza las casillas). Al pulsar un día, toda la página
salta a ese día. Los eventos solo aparecen dentro del calendario.

### Reflexión y notas (las comillas de la frase)

Una ventanita con dos pestañas, **Reflexión** y **Notas**, ligada al día seleccionado. Se guarda sola
mientras escribes, sin botones. Los días en que hay algo escrito, las comillas se ven un poco más intensas.

### Imagen del día (el marco)

Al pulsar el marco, Ascenso pregunta sobre la propia imagen si quieres otra («Sí» o «No»), para que un toque sin
querer no la cambie. Con «Sí» se elige otra imagen para ese día, que queda guardada en el historial. La pregunta se
va sola a los pocos segundos, con <kbd>Esc</kbd> o pulsando fuera.

### Librería (el nombre del autor de la frase)

En la aplicación instalable, el nombre del autor de la frase abre una estantería de libros. En el móvil está
también en la barra de abajo. No existe en la versión clásica.

- **Añadir libros** en **EPUB** o **PDF** (sin protección anticopia), con el botón o arrastrándolos a la ventana.
  El título, el autor y la portada salen del propio archivo; se pueden corregir en la ficha del libro (⋯).
- **Leer** dentro de Ascenso, también sin conexión. El EPUB se muestra con la letra y el tema del lector (no con los
  estilos del libro); el PDF, página a página. Hay índice, y las flechas del teclado pasan de capítulo o de página.
- **Se recuerda por dónde ibas** en cada libro, y la estantería muestra el porcentaje leído.
- **Ajustes de lectura** (botón «Aa»): tamaño y tipo de letra en EPUB, tamaño de página en PDF y tema automático,
  claro, sepia u oscuro. Son de cada dispositivo.
- **Subrayados y notas**: selecciona un pasaje y elige un color o «Nota». Pulsando un subrayado se cambia su color,
  se le escribe una nota o se quita. El botón del lápiz reúne todos los del libro y lleva a cada uno. En un PDF
  escaneado (sin texto) no hay nada que seleccionar.
- **Con cuenta**, la ficha, la lectura y los subrayados se sincronizan cifrados, como todo lo demás. El archivo del
  libro también, si pesa menos de 16 MB (el tope por archivo del almacén de la cuenta): en los demás
  dispositivos se descarga la primera vez que lo abres. Un libro más grande se queda en el dispositivo donde lo
  añadiste; en los otros aparece en la estantería y se puede elegir ahí el archivo.
- Los libros **no entran en la copia de seguridad** (pesarían demasiado) y quitar un libro lo quita de todos tus
  dispositivos, con sus subrayados.

### Cuenta y sincronización (el texto de estado)

En la aplicación instalable, el texto que dice «Guardado en este dispositivo» abre el panel de la cuenta. Sin cuenta,
Ascenso funciona igual, solo en ese dispositivo. Con cuenta:

- **Crear una cuenta**: email y contraseña. Llega un email para confirmarla. La primera vez que inicias sesión se
  muestra, una sola vez, tu **clave de recuperación**: guárdala.
- **Iniciar sesión** en otro dispositivo: se escribe la contraseña una vez y el dispositivo queda conectado hasta
  que cierres la sesión. Si ese dispositivo ya tenía datos, Ascenso pregunta si los fusiona con la cuenta o los
  sustituye por los de la cuenta.
- **Estado**, siempre a la vista en ese mismo texto: sincronizado, sincronizando, sin conexión (con los cambios
  pendientes) o error. Sin conexión todo sigue funcionando; los cambios se envían solos al volver.
- **Cambiar la contraseña**, **recuperarla** (enlace por email + clave de recuperación), ver los **dispositivos**
  y **cerrar sesión** (eligiendo si los datos se quedan en el dispositivo o se borran de él).

> **Importante.** Tu contraseña es la llave de tus datos y nunca sale de tu dispositivo. Si la olvidas, solo la
> clave de recuperación permite recuperarlos. **Sin la contraseña y sin la clave de recuperación, los datos de la
> cuenta no se pueden recuperar**: nadie más tiene con qué descifrarlos.

Si dos dispositivos cambian lo mismo a la vez, queda el último cambio (por tarea, tarjeta, nota, nodo…).

## Aplicación instalable

La aplicación se publica como una página web con HTTPS (por ejemplo en GitHub Pages, ver más abajo) y desde ahí
se instala. Una vez instalada abre sin conexión.

### Instalarla

- **Android (Chrome)**: abre la dirección de la aplicación, pulsa el menú ⋮ y «Instalar aplicación» (o «Añadir a
  pantalla de inicio»).
- **iPhone y iPad (Safari)**: abre la dirección en Safari, pulsa **Compartir** y «Añadir a pantalla de inicio».
  Tiene que ser Safari: desde otros navegadores no se instala. Ábrela siempre desde su icono: en iOS, la app
  instalada y Safari guardan sus datos por separado.
- **Ordenador (Chrome o Edge)**: abre la dirección y pulsa el icono de instalar que aparece en la barra de
  direcciones.

Cuando haya una versión nueva, aparece un aviso discreto para recargar.

Los datos viven en el almacenamiento del navegador de ese dispositivo (IndexedDB). Ascenso pide al navegador que
no los borre por falta de espacio, pero conviene **exportar una copia** de vez en cuando (o usar una cuenta):
desinstalar la app o borrar los datos del sitio los elimina.

### Publicarla en GitHub Pages

1. En GitHub: *Settings → Pages → Build and deployment → Source: **GitHub Actions***.
2. Cada vez que se actualiza `main`, el workflow `.github/workflows/pages.yml` publica la aplicación en
   `https://<usuario>.github.io/<repositorio>/`. Solo sube los archivos de la aplicación (ni `servidor.py`, ni
   los lanzadores, ni `instalar.py`, ni las pruebas).

GitHub Pages gratuito exige que el repositorio sea público: el código y las imágenes de `assets/images` quedan a
la vista (tus datos no: nunca están en el repositorio).

### Crear el proyecto de Supabase (para la cuenta)

Solo hace falta si quieres sincronizar. Paso a paso:

1. Crea un proyecto en [supabase.com](https://supabase.com) (el plan gratuito basta).
2. **Ejecuta la migración**: *SQL Editor → New query*, pega el contenido de
   `supabase/migraciones/001_inicial.sql` y pulsa *Run*. Crea las tablas, las reglas de acceso (RLS), el
   almacén privado de imágenes y libros y activa los avisos en tiempo real. Se puede ejecutar más de una vez.
3. **Comprueba Realtime**: en *Database → Publications*, la publicación `supabase_realtime` debe incluir la tabla
   `cambios` (la migración ya la añade).
4. **Email de confirmación**: en *Authentication → Sign In / Providers → Email*, deja activado «Confirm email».
   En *Authentication → URL Configuration*, pon en **Site URL** la dirección de la aplicación
   (`https://<usuario>.github.io/<repositorio>/ascenso.html`) y añádela también en **Redirect URLs**. Ahí vuelven
   los enlaces de confirmación y de «contraseña olvidada».
5. **Rellena `assets/js/config.js`** con la *Project URL* y la clave *publishable* (o la `anon`) de
   *Project Settings → API Keys*. Las dos son públicas: lo que puede hacer cada persona lo deciden las reglas de la
   base de datos. **Nunca pongas ahí la clave `service_role`** ni ningún otro secreto.
6. Ejecuta `python3 herramientas/generar.py` (actualiza en `ascenso.html` el dominio al que la página tiene
   permitido conectarse) y sube los cambios.

El servicio de email que trae Supabase por defecto envía muy pocos mensajes por hora; para un uso personal es
suficiente. La compactación del historial de cambios es opcional y está explicada al final de la migración.

### Pasar los datos desde la versión clásica

1. En la versión clásica (la de `servidor.py`), abre «Copia de seguridad» y pulsa **Exportar datos**. La copia
   incluye las imágenes de las libretas.
2. En la aplicación instalable, abre «Copia de seguridad» y pulsa **Importar datos** con ese archivo.
3. Si tienes cuenta, lo importado se sube solo y aparece en tus demás dispositivos.

Importar sustituye los datos que hubiera en ese dispositivo.

## Versión clásica (solo en tu ordenador)

Requisitos:

- Python 3.8 o superior (solo la biblioteca estándar).
- Para abrirlo en su propia ventana, como una aplicación: Chrome, Edge o Brave (en Windows, Edge viene de serie).

### Uso

| Qué | Windows | macOS / Linux |
|---|---|---|
| Crear el icono de la aplicación | `instalar.bat` | `instalar.command` o `python3 instalar.py` |
| Abrir con consola (en el navegador) | `iniciar-ascenso.bat` | `iniciar-ascenso.command` |
| Ver errores al abrir como aplicación | `diagnostico.bat` | `python3 servidor.py --app` |

Opciones de `servidor.py`:

```
python servidor.py               # abre http://127.0.0.1:8000 en el navegador
python servidor.py --app         # ventana propia; se cierra al cerrar la ventana
python servidor.py --puerto 8080 # otro puerto
python servidor.py --red         # accesible desde otros dispositivos de la misma wifi
```

Con `--red`, la consola muestra una dirección con una clave (`?clave=...`) que cambia en cada arranque: los demás dispositivos solo pueden entrar con ella.

Para quitar los iconos: `python instalar.py --quitar`.

## Estructura

```
ascenso.html              Página (estructura HTML)
index.html                Redirige a ascenso.html (para la dirección de la carpeta)
service-worker.js         Guarda la aplicación en el dispositivo para abrirla sin conexión
assets/
  css/estilos.css         Estilos
  css/fuentes.css         Tipografías incrustadas (Cormorant Garamond y Figtree, licencia OFL)
  js/ascenso.js           Lógica de la página (la interfaz)
  js/config.js            Dirección y clave pública del proyecto de Supabase
  js/almacen.js           Base de datos del dispositivo (IndexedDB)
  js/servidor-local.js    «Servidor de bolsillo»: las mismas rutas y validaciones que servidor.py, en el navegador
  js/cifrado.js           Derivación de claves y cifrado (WebCrypto)
  js/sync.js              Sincronización con la cuenta (Supabase)
  js/cuenta.js            Panel de la cuenta
  js/movil.js             Barra de navegación del móvil y botón «atrás» del teléfono
  js/libreria.js          La librería: estantería y lector de EPUB y PDF, subrayados y notas
  js/epub.js              Abre un EPUB y deja cada capítulo limpio para mostrarlo
  js/pwa.js               Registro del service worker y aviso de versión nueva
  icono/                  Iconos de la aplicación
  images/                 Imágenes del marco
  manifest.webmanifest    Datos de la aplicación para el navegador
  vendor/                 KaTeX y Mermaid (fórmulas y diagramas de las libretas) y pdf.js (para leer los PDF de
                          la librería), con sus licencias
supabase/migraciones/     SQL del proyecto de Supabase
herramientas/generar.py   Prepara lo que se publica (lista de imágenes, precaché, política de seguridad)
pruebas/                  Pruebas automáticas (ver pruebas/LEEME.md)
.github/workflows/        Publicación en GitHub Pages

servidor.py               Versión clásica: servidor local y base de datos SQLite
instalar.py               Versión clásica: crea el icono de la aplicación (Windows, macOS, Linux)
*.bat / *.command         Versión clásica: lanzadores de doble clic
```

```
ascenso.js (interfaz)
   └─ api(método, ruta, datos) ──► servidor-local.js
                                      ├─ almacen.js   → IndexedDB (la fuente de verdad en el dispositivo)
                                      ├─ cifrado.js   → WebCrypto
                                      └─ sync.js      → Supabase (cambios cifrados + avisos en tiempo real)
```

En la versión clásica, `servidor.py` responde él mismo a `assets/js/config.js` y la página guarda en su base de
datos, como siempre. Se crean al usarla, y están excluidos del repositorio: `ascenso.db` (tus datos), `ascenso.log`
y `.perfil-app/`.

## Imágenes

Copia las imágenes en `assets/images/`. Si el nombre de un archivo contiene el de un autor
(`seneca`, `marco-aurelio`, `epicteto`, `zenon`, `montaigne`...), aparece los días en que la frase es suya.

En la aplicación instalable, las imágenes son las que hay en el repositorio al publicar, y las ve todo el que use
la aplicación. Se van guardando en el dispositivo en segundo plano para verlas también sin conexión.

La aplicación las encuentra por la lista `assets/images/lista.json`. Al añadir o quitar imágenes, actualízala con
`python3 herramientas/generar.py` y sube el cambio (al publicar en GitHub Pages, el workflow lo hace solo).

## Base de datos

En la aplicación instalable, cada tarea, tarjeta, nota, nodo… es un registro en la base de datos del navegador
(IndexedDB), con la fecha de su último cambio y una marca de borrado; lo que se borra queda marcado (así el
borrado también llega a los demás dispositivos) y deja de mostrarse.

En la versión clásica, tablas de `ascenso.db`:

- Día a día: `config`, `habitos`, `dias`, `marcas`, `historial`, `etiquetas`, `tareas`, `tarea_etiquetas` y `notas`.
- Calendario: `eventos`.
- Tableros: `tableros`, `listas`, `tarjetas`, `etiquetas_tablero`, `tarjeta_etiquetas_tablero` y `checklist`.

Al arrancar, el servidor crea o actualiza las tablas sin tocar los datos existentes.

## Seguridad

### Aplicación instalable y cuenta

**Cifrado de extremo a extremo.** Todo se cifra en tu dispositivo antes de enviarse, con claves que salen de tu
contraseña:

- De la contraseña y el email se obtiene una clave maestra (PBKDF2-SHA256, 600.000 vueltas) que no sale del
  dispositivo. De ella se derivan (HKDF) dos claves: una **clave de acceso**, que es lo que el servidor recibe como
  «contraseña», y una **clave de envoltorio**.
- Tus datos se cifran con una **clave de datos** aleatoria (AES-256-GCM). En la cuenta se guarda solo *envuelta*
  (cifrada) con la clave de envoltorio, y otra copia envuelta con la **clave de recuperación**. Por eso cambiar la
  contraseña no obliga a volver a cifrar nada.
- En el dispositivo, la clave de datos se guarda de forma que el navegador puede usarla pero no mostrarla ni
  exportarla, junto con la sesión, en IndexedDB. La contraseña no se guarda nunca. Nada de esto va a
  `localStorage` ni a la consola.

**Los libros no son de fiar.** Un EPUB es, por dentro, una web: su contenido nunca se inserta tal cual. De cada
capítulo se copian solo las etiquetas de texto conocidas, sin scripts, sin estilos y sin atributos que no estén en
una lista corta; las imágenes salen del propio archivo y los enlaces de fuera se abren en otra pestaña. Los PDF los
dibuja pdf.js (incluido en el repositorio, sin servicios externos) en un lienzo, sin `eval` ni WebAssembly, de modo
que la política de seguridad de la página no se relaja.

**Qué ve Supabase (el servidor):**

- tu email y la clave de acceso (que no sirve para descifrar);
- la clave de datos envuelta (inútil sin la contraseña o la clave de recuperación);
- bloques cifrados: cuántos cambios haces, cuándo, desde qué dispositivo (un identificador al azar) y cuánto
  ocupan; y una etiqueta opaca por registro, que permite saber que dos cambios son del mismo registro, pero no de
  qué registro ni de qué tipo;
- tu dirección IP, como cualquier servidor.

**Qué no ve:** el contenido (hábitos, tareas, tableros, notas, mapas, imágenes), los nombres de las tablas, los
identificadores, los nombres de tus dispositivos ni tu contraseña.

**Además:**

- Cada persona solo puede leer y añadir sus propias filas (RLS); los cambios no se pueden modificar ni borrar
  desde un dispositivo. En el repositorio y en la página solo están la dirección del proyecto y su clave pública.
- La página lleva una política de seguridad de contenido (CSP) estricta: solo carga sus propios archivos, sin
  scripts externos ni `eval`, y solo puede conectarse al proyecto de Supabase configurado.
- El texto que se muestra se escapa antes de insertarlo en la página.

**Limitaciones conocidas:**

- Quien publica la aplicación controla su código: una versión manipulada podría robar la contraseña al escribirla.
  Publica desde un repositorio que controles y protege tu cuenta de GitHub.
- En el dispositivo, los datos están sin cifrar en el almacenamiento del navegador (como en cualquier app):
  conviene tener bloqueo de pantalla y el cifrado del dispositivo activado.
- El email de la cuenta no se puede cambiar (forma parte de la derivación de las claves).
- Los conflictos se resuelven por registro, quedándose con el último cambio; no se mezclan dos ediciones del
  mismo texto.

### Versión clásica

Pensada para uso personal en tu propio equipo.

- El servidor solo escucha en `127.0.0.1` (este equipo). Con `--red` escucha en la red local, pero los demás dispositivos necesitan la clave que muestra la consola.
- Solo sirve `ascenso.html` y la carpeta `assets`; la base de datos, el registro y los scripts no son accesibles desde el navegador.
- Las escrituras exigen JSON, una cabecera propia y el mismo origen, para que otras webs abiertas en el navegador no puedan modificar los datos (CSRF). Se rechazan las peticiones dirigidas a dominios que no sean `localhost`, una IP o el nombre del equipo (DNS rebinding).
- La página lleva una política de seguridad de contenido (CSP) que solo permite sus propios archivos, y cabeceras que impiden incrustarla en otras webs.
- Todas las consultas a la base de datos usan parámetros; el texto que se muestra se escapa antes de insertarlo en la página.
- No hace ninguna conexión a internet.

Limitaciones conocidas: con `--red` la conexión no va cifrada (HTTP), así que úsalo solo en redes de confianza; y `ascenso.db` y las copias exportadas no están cifradas, por lo que conviene tener activado el cifrado del disco (BitLocker, FileVault).

## Pruebas

Hay pruebas automáticas del almacenamiento, la aplicación instalable, el móvil, el cifrado, la sincronización y el
SQL de Supabase. Cómo lanzarlas: [`pruebas/LEEME.md`](pruebas/LEEME.md).

## Créditos

- Frases: autores clásicos de dominio público; traducciones propias.
- pdf.js (Mozilla), bajo licencia Apache 2.0 (ver `assets/vendor/pdfjs/LICENSE`).
- Tipografías: Cormorant Garamond y Figtree, bajo SIL Open Font License 1.1 (ver `assets/css/LICENCIA-FUENTES.txt`).

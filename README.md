# Ascenso

Aplicación personal para seguir hábitos, tareas y progreso, con una frase para cada día.
Funciona en local: una página web servida por un pequeño servidor en Python que guarda
todo en una base de datos SQLite. No necesita internet ni instalar dependencias.

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

Al pulsar el marco se elige otra imagen para ese día, que queda guardada en el historial.

## Requisitos

- Python 3.8 o superior (solo la biblioteca estándar).
- Para abrirlo en su propia ventana, como una aplicación: Chrome, Edge o Brave (en Windows, Edge viene de serie).

## Uso

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
servidor.py               Servidor local y base de datos SQLite
instalar.py               Crea el icono de la aplicación (Windows, macOS, Linux)
*.bat / *.command         Lanzadores de doble clic
assets/
  css/estilos.css         Estilos
  css/fuentes.css         Tipografías incrustadas (Cormorant Garamond y Figtree, licencia OFL)
  js/ascenso.js           Lógica de la página
  icono/                  Iconos de la aplicación
  images/                 Imágenes del marco (no se suben al repositorio)
  manifest.webmanifest    Datos de la aplicación para el navegador
```

Se crean al usarlo, y están excluidos del repositorio: `ascenso.db` (tus datos), `ascenso.log` y `.perfil-app/`.

## Imágenes

Copia las imágenes en `assets/images/`. Si el nombre de un archivo contiene el de un autor
(`seneca`, `marco-aurelio`, `epicteto`, `zenon`, `montaigne`...), aparece los días en que la frase es suya.

## Base de datos

Tablas de `ascenso.db`:

- Día a día: `config`, `habitos`, `dias`, `marcas`, `historial`, `etiquetas`, `tareas`, `tarea_etiquetas` y `notas`.
- Calendario: `eventos`.
- Tableros: `tableros`, `listas`, `tarjetas`, `etiquetas_tablero`, `tarjeta_etiquetas_tablero` y `checklist`.

Al arrancar, el servidor crea o actualiza las tablas sin tocar los datos existentes.

## Seguridad

Ascenso está pensado para uso personal en tu propio equipo.

- El servidor solo escucha en `127.0.0.1` (este equipo). Con `--red` escucha en la red local, pero los demás dispositivos necesitan la clave que muestra la consola.
- Solo sirve `ascenso.html` y la carpeta `assets`; la base de datos, el registro y los scripts no son accesibles desde el navegador.
- Las escrituras exigen JSON, una cabecera propia y el mismo origen, para que otras webs abiertas en el navegador no puedan modificar los datos (CSRF). Se rechazan las peticiones dirigidas a dominios que no sean `localhost`, una IP o el nombre del equipo (DNS rebinding).
- La página lleva una política de seguridad de contenido (CSP) que solo permite sus propios archivos, y cabeceras que impiden incrustarla en otras webs.
- Todas las consultas a la base de datos usan parámetros; el texto que se muestra se escapa antes de insertarlo en la página.
- Sin dependencias externas ni conexiones a internet.

Limitaciones conocidas: con `--red` la conexión no va cifrada (HTTP), así que úsalo solo en redes de confianza; y `ascenso.db` y las copias exportadas no están cifradas, por lo que conviene tener activado el cifrado del disco (BitLocker, FileVault).

## Créditos

- Frases: autores clásicos de dominio público; traducciones propias.
- Tipografías: Cormorant Garamond y Figtree, bajo SIL Open Font License 1.1 (ver `assets/css/LICENCIA-FUENTES.txt`).

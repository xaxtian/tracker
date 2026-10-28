# Grabación de vídeo

El vídeo grabado incluye la cámara, el esqueleto, el contador, los avisos de cada repetición y el cartel de fin de
serie, exactamente como se ven al entrenar.

<pre class="mermaid">
flowchart LR
  V["`**video** de la cámara`"] --> C
  P["`Esqueleto
  drawPose`"] --> C
  H["`Contador, avisos, carteles
  drawHud`"] --> C
  C["`**Canvas oculto**
  máx. 1280 px`"] -->|"captureStream(30)"| M["`**MediaRecorder**
  MP4 si se puede, si no WebM
  2,5 Mbit/s`"]
  M -->|"trozo cada 2 s"| DB[("`**IndexedDB**
  trackbody-videos`")]
</pre>

## Por qué en trozos

`MediaRecorder` entrega un trozo cada 2 segundos y [SessionRecorder](../classes/SessionRecorder.html) lo guarda al
momento. Una sesión larga no tiene que caber en memoria y, si la página se cierra de golpe, lo grabado hasta entonces
sigue guardado.

## Capítulos

Cada vez que termina una serie, `markSet()` añade un capítulo al vídeo que empieza **2 segundos antes** de la primera
repetición. La serie del historial guarda el vídeo y ese segundo (`recordingId`, `videoOffsetSec`) para poder abrirla
directamente desde el historial.

## Base de datos

| Almacén | Clave | Contenido |
|---|---|---|
| `meta` | `id` | [RecordingMeta](../interfaces/RecordingMeta.html): ejercicio, fechas, duración, formato, tamaño, capítulos |
| `chunks` | `[id, i]` | Trozo número `i` del vídeo `id` (Blob) |

[VideoStoreService](../injectables/VideoStoreService.html) une los trozos en orden para reproducir o descargar, y al
borrar elimina el vídeo con todos sus trozos. Al arrancar pide almacenamiento **persistente** para que el navegador
no borre los vídeos cuando falte espacio (cada navegador decide si lo concede).

## Reproducción

[RecordingPlayerComponent](../components/RecordingPlayerComponent.html):

- crea una URL temporal para el vídeo y la libera al cerrar;
- en vídeos WebM grabados en el navegador la duración es desconocida hasta llegar al final, así que salta al final una
  vez para que la barra de tiempo y los capítulos funcionen;
- resalta el capítulo que se está viendo;
- **Descargar** usa un enlace temporal; **Compartir** usa el menú del sistema del móvil (guardar en galería, WhatsApp…).

## Espacio

A 2,5 Mbit/s son unos **19 MB por minuto**. La pantalla de vídeos muestra el espacio usado y el disponible que da el
navegador (`navigator.storage.estimate()`).

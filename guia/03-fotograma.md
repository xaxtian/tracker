# Del vídeo al contador

Cada fotograma de la cámara recorre el mismo camino dentro de `WorkoutComponent.onFrame()`. Todo el trabajo se hace en
el hilo principal, en unos pocos milisegundos por fotograma.

<pre class="mermaid">
sequenceDiagram
  autonumber
  participant Cam as Cámara
  participant W as WorkoutComponent
  participant P as PoseService
  participant A as Analyzer
  participant R as RepCounter
  participant S as SetTracker
  participant UI as Pantalla y vídeo

  Cam->>W: fotograma nuevo con su hora de captura
  W->>P: detect(video, hora)
  P-->>W: 33 puntos normalizados
  W->>W: a píxeles y suavizado
  W->>A: evaluate(puntos, ajustes del ejercicio, generales)
  A-->>W: FrameEval con ángulo, extendido, profundidad, fallos
  W->>R: update(eval, puntos, hora, opciones)
  R-->>W: repetición terminada o nada
  W->>S: addRep() y tick()
  S-->>W: serie terminada o nada
  W->>UI: contador, avisos, esqueleto, HUD del vídeo
</pre>

## 1. El fotograma y su hora

- Con **requestVideoFrameCallback** el navegador avisa una vez por fotograma real de la cámara y da su hora de
  captura (`captureTime`). Si no existe, se usa `mediaTime` corregido al reloj de la página.
- Sin esa API (navegadores antiguos) se usa `requestAnimationFrame` y se descartan los fotogramas repetidos.
- Se ignoran fotogramas con hora igual o anterior a la del anterior.
- Se mide el ritmo real de análisis (fps) con una media móvil.

La hora exacta de cada fotograma es lo que permite medir las fases con centésimas aunque la cámara vaya a 30 fps.

## 2. Puntos del cuerpo

[PoseService](../injectables/PoseService.html) llama a MediaPipe en modo vídeo, que exige horas estrictamente
crecientes (el servicio lo garantiza). Devuelve 33 puntos con coordenadas 0-1 y su visibilidad.
`toPixels()` los pasa a píxeles del vídeo y aplica un **suavizado exponencial** (ajuste *Suavizado*) para quitar
temblores.

Los índices que usa la app están en [LM](../miscellaneous/variables.html#LM): hombros 11-12, codos 13-14,
muñecas 15-16, caderas 23-24, rodillas 25-26, tobillos 27-28, talones 29-30, puntas 31-32 y boca 9-10.

## 3. Evaluación del fotograma

El *analyzer* del módulo del ejercicio ([Añadir un ejercicio](añadir-un-ejercicio.html)) convierte los puntos
en un [FrameEval](../interfaces/FrameEval.html):

| Campo | Significado |
|---|---|
| `ok` | Se ven las articulaciones necesarias |
| `inPosition` | La persona está en posición de ejercicio (en la barra, en plancha…) |
| `angle` | Ángulo principal: rodilla en sentadilla, codo en flexión y dominada |
| `extended` / `bottom` | Extensión completa / profundidad alcanzada |
| `faults` | Fallos de técnica vistos en este fotograma |
| `trackY`, `bodyPx` | Altura del punto cuya velocidad se mide y tamaño del cuerpo en píxeles |

## 4. Repetición, serie y avisos

- [RepCounter](../classes/RepCounter.html) decide cuándo empieza y termina una repetición y si es estricta
  ([capítulo](repeticiones-estrictas.html)).
- [SetTracker](../classes/SetTracker.html) agrupa las repeticiones y detecta el final de la serie
  ([capítulo](series-automáticas.html)).
- `onRep()` actualiza contadores, muestra el aviso, habla y pita. `onSetEnded()` añade el peso, marca la serie en el
  vídeo, la guarda en el historial y muestra el cartel.

## 5. Dibujo

- En pantalla: el vídeo es un `<video>` y encima hay un `<canvas>` con el esqueleto
  ([drawPose](../miscellaneous/functions.html#drawPose)). El contador y los avisos son HTML.
- En la grabación todo se dibuja en un canvas aparte, incluido el HUD ([drawHud](../miscellaneous/functions.html#drawHud)).
  Ver [Grabación de vídeo](grabación-de-vídeo.html).

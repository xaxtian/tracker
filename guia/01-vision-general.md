# Visión general

TrackBody cuenta **sentadillas, flexiones y dominadas estrictas** mirando la cámara del móvil o del ordenador.
Todo ocurre en el navegador: ni el vídeo ni los datos salen del dispositivo.

## Qué hace

| Función | Dónde está |
|---|---|
| Detecta el cuerpo (33 puntos) en cada fotograma | [PoseService](../injectables/PoseService.html) con MediaPipe |
| Decide si cada repetición es estricta | [analyzers.ts](../miscellaneous/functions.html#createAnalyzer) + [RepCounter](../classes/RepCounter.html) |
| Agrupa las repeticiones en series sin tocar nada | [SetTracker](../classes/SetTracker.html) |
| Mide la duración de cada fase y la velocidad en m/s | [computeTempo](../miscellaneous/functions.html#computeTempo) |
| Graba vídeo con el esqueleto y los avisos | [SessionRecorder](../classes/SessionRecorder.html) + [VideoStoreService](../injectables/VideoStoreService.html) |
| Guarda el historial, el peso/lastre y los ajustes | [HistoryService](../injectables/HistoryService.html), [SettingsService](../injectables/SettingsService.html) |

## Arquitectura

La aplicación tiene tres capas sobre las APIs del navegador. La de **análisis** es TypeScript puro, sin Angular: recibe puntos y tiempos y devuelve
resultados, lo que la hace fácil de probar con movimientos simulados.

<pre class="mermaid">
flowchart LR
  subgraph UI["Pantallas · pages/"]
    direction TB
    Home["Inicio"] ~~~ Workout["Entrenar"] ~~~ History["Historial"] ~~~ Videos["Vídeos"] ~~~ Settings["Ajustes"]
  end
  subgraph Analysis["Análisis · analysis/"]
    direction TB
    Analyzers["analyzers"] --> Counter["rep-counter"] --> Tempo["tempo"]
    Tracker["set-tracker"] ~~~ Overlay["overlay"] ~~~ Stats["set-stats"]
  end
  subgraph Services["Servicios · services/"]
    direction TB
    Pose["PoseService"] ~~~ Feedback["FeedbackService"] ~~~ Hist["HistoryService"] ~~~ Sett["SettingsService"] ~~~ Store["VideoStoreService"] ~~~ Rec["SessionRecorder"]
  end
  subgraph Browser["Navegador"]
    direction TB
    Cam[["Cámara"]] ~~~ MP[("MediaPipe")] ~~~ Audio[["Voz y pitidos"]] ~~~ LS[("localStorage")] ~~~ IDB[("IndexedDB")]
  end
  UI -->|"puntos y ajustes"| Analysis
  UI -->|"datos, cámara, sonido, vídeo"| Services
  Services --> Browser
</pre>

## Tecnología

- **Angular 19**: componentes *standalone*, *signals* y **sin zone.js** (*zoneless*). La interfaz se actualiza con
  señales, así el bucle de la cámara (30-60 veces por segundo) no dispara la detección de cambios de Angular.
- **MediaPipe Pose Landmarker** (`@mediapipe/tasks-vision`) en modo vídeo, en GPU con alternativa en CPU.
- **requestVideoFrameCallback**: da la hora exacta de captura de cada fotograma, la base de los tiempos con centésimas.
- **Canvas + MediaRecorder** para grabar el vídeo con todo dibujado encima; **IndexedDB** para guardarlo.
- **Jest** para los tests y **Compodoc** para esta documentación.

## Estructura de carpetas

| Carpeta | Contenido |
|---|---|
| `src/app/analysis/` | Lógica de análisis: geometría, criterios, contador, tempo, series, dibujo |
| `src/app/models/` | Tipos de datos y textos (ejercicios, fallos, pausas) |
| `src/app/services/` | Cámara/IA, voz, historial, ajustes, vídeos |
| `src/app/pages/` | Una carpeta por pantalla |
| `src/testing/` | Utilidades para los tests: poses sintéticas, movimientos, *mocks* del navegador |
| `public/models/` | Modelos de MediaPipe (`lite` y `full`) |
| `guia/` | Estos capítulos |
| `scripts/` | Utilidades de la documentación |

## Comandos

| Comando | Para qué |
|---|---|
| `npm start` | Servidor de desarrollo |
| `npm run start:mobile` | Servidor accesible desde el móvil (HTTPS) |
| `npm test` | Tests unitarios |
| `npm run test:coverage` | Tests con informe de cobertura |
| `npm run docs` | Genera esta documentación en `docs/` |
| `npm run docs:serve` | La genera y la abre en el navegador |

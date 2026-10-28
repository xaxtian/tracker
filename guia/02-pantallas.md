# Pantallas y navegación

Cada pantalla es un componente *standalone* que se carga solo cuando se visita (*lazy loading*).
La barra superior ([AppComponent](../components/AppComponent.html)) da acceso a las cuatro secciones.

<pre class="mermaid">
flowchart LR
  Nav{{"Barra superior"}}
  Nav --> Home["`**Entrenar**
  /`"]
  Nav --> History["`**Historial**
  /history`"]
  Nav --> Videos["`**Vídeos**
  /videos`"]
  Nav --> Settings["`**Ajustes**
  /settings`"]
  Home -->|"elige ejercicio"| Workout["`**Entrenamiento**
  /workout/:exercise`"]
  Workout -->|"Ver vídeo"| Player["`**Vídeo**
  /videos/:id`"]
  Videos --> Player
  History -->|"▶ popup"| Popup(["RecordingPlayerComponent"])
  Player --> Popup2(["RecordingPlayerComponent"])
</pre>

| Ruta | Componente | Qué hace |
|---|---|---|
| `/` | [HomeComponent](../components/HomeComponent.html) | Tarjetas de los tres ejercicios con las repeticiones válidas de hoy |
| `/workout/:exercise` | [WorkoutComponent](../components/WorkoutComponent.html) | Cámara, contador, series, peso/lastre, tempo y grabación |
| `/history` | [HistoryComponent](../components/HistoryComponent.html) | Series por día y ejercicio, detalle por repetición, corregir peso, ver vídeo |
| `/videos` | [VideosComponent](../components/VideosComponent.html) | Lista de vídeos guardados y espacio usado |
| `/videos/:id` | [VideoPlayerComponent](../components/VideoPlayerComponent.html) | Reproduce un vídeo con capítulos por serie |
| `/settings` | [SettingsComponent](../components/SettingsComponent.html) | Todos los criterios ajustables, ver [Ajustes](ajustes.html) |
| cualquier otra | — | Vuelve al inicio |

## Entrenamiento

Es la pantalla central. Un ciclo completo:

<pre class="mermaid">
flowchart TD
  A["Iniciar cámara"] --> B["Carga el modelo y abre la cámara a 60 fps si se puede"]
  B --> C{"¿Hay persona en posición?"}
  C -->|no| H["Muestra una pista: «No te veo», «Cuélgate de la barra»…"]
  H --> C
  C -->|sí| D["Cuenta repeticiones y avisa: número, pitido, motivo si no vale"]
  D --> E{"¿Fin de serie?"}
  E -->|no| D
  E -->|sí| F["Guarda la serie con su peso, la marca en el vídeo y anuncia el resumen"]
  F --> G["Cronómetro de descanso"]
  G --> C
</pre>

Lo que se ve en pantalla:

- **Contador** grande (válidas) y rojo (no válidas), **píldora** de serie o descanso y **peso** si lo hay.
- **Aviso** al terminar cada repetición, con su tempo; **cartel** al terminar cada serie.
- **Esqueleto** con color según el estado: gris (fuera de posición), azul (listo), ámbar (bajando),
  verde (profundidad alcanzada), rojo (fallo de técnica). Ver [poseColor](../miscellaneous/functions.html#poseColor).
- **Panel «Última repetición»**: excéntrica, concéntrica, pausas, velocidades y pérdida de velocidad de la serie.
- **Peso / lastre**: botones −/+ de 2,5 kg; negativo = asistencia. Se recuerda por ejercicio.
- **Cámara frontal/trasera** y selector de cámara cuando hay más de dos.

## Historial

- Récord (mejor serie) por ejercicio y filtros.
- Series agrupadas por **día** y **ejercicio**, con hora, peso, válidas, no válidas, velocidad media, pérdida de
  velocidad y descanso previo.
- Al tocar una serie se despliega cada repetición con sus tiempos, y un campo para **corregir el peso**.
- **▶** abre el vídeo de esa serie en una ventana flotante, ya colocado en su inicio.
- Exportar a JSON y borrar.

## Vídeos

La lista muestra fecha, duración, tamaño, series y repeticiones válidas de cada grabación. El reproductor
([RecordingPlayerComponent](../components/RecordingPlayerComponent.html)) se usa en la página del vídeo y en la
ventana del historial: tiene un botón por serie para saltar a ella, y botones de descargar y compartir.

# Datos y almacenamiento

Todo se guarda en el navegador del dispositivo. No hay servidor.

<pre class="mermaid">
classDiagram
  direction LR
  class SetRecord {
    +string id
    +ExerciseId exercise
    +number start
    +number end
    +number valid
    +number invalid
    +Record reasons
    +number restBeforeSec
    +number loadKg
    +string recordingId
    +number videoOffsetSec
  }
  class RepRecord {
    +boolean valid
    +string[] reasons
  }
  class RepTempo {
    +number eccentricSec
    +number concentricSec
    +number pauseTurnSec
    +number pauseBetweenSec
    +number meanConVel
    +number peakConVel
    +number meanEccVel
    +number fps
  }
  class RecordingMeta {
    +string id
    +ExerciseId exercise
    +number start
    +number durationSec
    +string mime
    +number size
    +number chunks
  }
  class RecordingMark {
    +string setId
    +number index
    +number startSec
    +number endSec
    +number valid
    +number invalid
  }
  class Chunk {
    +string id
    +number i
    +Blob data
  }
  SetRecord "1" *-- "0..*" RepRecord : reps
  RepRecord "1" *-- "0..1" RepTempo : tempo
  SetRecord ..> RecordingMeta : recordingId
  RecordingMeta "1" *-- "0..*" RecordingMark : sets
  RecordingMeta "1" -- "1..*" Chunk : trozos
</pre>

Campos opcionales: `loadKg` (sin él, peso corporal), `reps` (las series anteriores a la medición del tempo no lo
tienen), `recordingId` y `videoOffsetSec` (solo si se grababa), `tempo` en cada repetición.
Ver [SetRecord](../interfaces/SetRecord.html), [RepRecord](../interfaces/RepRecord.html),
[RepTempo](../interfaces/RepTempo.html) y [RecordingMeta](../interfaces/RecordingMeta.html).

## Dónde se guarda cada cosa

| Clave | Almacén | Contenido | Servicio |
|---|---|---|---|
| `trackbody.history` | localStorage | Lista de series (JSON) | [HistoryService](../injectables/HistoryService.html) |
| `trackbody.settings` | localStorage | Ajustes (JSON) | [SettingsService](../injectables/SettingsService.html) |
| `trackbody.camera` | localStorage | Última cámara: frontal/trasera e id | `WorkoutComponent` |
| `trackbody.load` | localStorage | Peso/lastre por ejercicio | `WorkoutComponent` |
| `trackbody-videos` | IndexedDB | Vídeos: almacenes `meta` y `chunks` | [VideoStoreService](../injectables/VideoStoreService.html) |

## Compatibilidad entre versiones

- Los **ajustes** guardados se mezclan con los valores por defecto al cargar: un ajuste nuevo de una versión posterior
  toma su valor por defecto sin perder los demás.
- Las **series** antiguas sin `reps` o sin `loadKg` se muestran con «—».
- Si el almacenamiento está lleno o corrupto la app sigue funcionando con los datos en memoria o con valores por
  defecto.

## Exportar

El historial se exporta desde su pantalla como un archivo `trackbody-historial-AAAA-MM-DD.json` con todas las series,
repeticiones, tiempos y pesos.

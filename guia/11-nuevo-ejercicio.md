# Añadir un ejercicio

Cada ejercicio es **un único módulo** en `src/app/exercises/`. Contiene todo lo que la app necesita saber de él: cómo
se analiza, sus ajustes, sus textos y cómo termina una serie. El resto de la app (inicio, entrenamiento, ajustes,
historial, avisos, velocidad, documentación) lo lee del registro.

<pre class="mermaid">
flowchart LR
  subgraph Module["`**dips.ts** · un módulo`"]
    direction TB
    A["`**DipsAnalyzer**
    criterios de estricto`"]
    D["`**defaults**
    valores por defecto`"]
    F["`**fields**
    controles de Ajustes`"]
    T["`**textos**
    nombre, consejos, pistas,
    fallos, pausas`"]
    E["`**setEnd**
    cómo termina la serie`"]
    A ~~~ D ~~~ F ~~~ T ~~~ E
  end
  Module --> R[("`**index.ts**
  EXERCISE_MODULES`")]
  R --> Home["Inicio: tarjeta en su categoría"]
  R --> Workout["Entrenar: analyzer, pistas, cierre de serie"]
  R --> Settings["Ajustes: su sección"]
  R --> History["Historial y vídeos: nombre e icono"]
  R --> Faults["Avisos y voz de sus fallos"]
</pre>

## Qué contiene un módulo

Un módulo es un objeto [ExerciseModule](../interfaces/ExerciseModule.html):

| Campo | Para qué |
|---|---|
| `id` | Identificador guardado en el historial. **No cambiarlo nunca** una vez usado |
| `name`, `icon`, `category` | Tarjeta de inicio y títulos. Categorías: Piernas, Empuje, Tracción, Brazos, Core |
| `camera`, `tips` | Dónde poner la cámara; se muestra antes de empezar |
| `hints.position`, `hints.start` | Qué decir si la persona no está en posición, o está pero no extendida |
| `pauseLabels` | Nombre de la pausa en el cambio de sentido y entre repeticiones |
| `setEnd` | `inactivity` (descanso), `longInactivity` (el triple) u `offPosition` (solo al salir de la posición) |
| `unilateral` | Opcional: guarda en cada serie el lado trabajado (`{ limb: 'brazo' }`) |
| `defaults` | Valores por defecto de sus ajustes, incluida la bajada mínima (`ECCENTRIC_DEFAULTS`) |
| `fields` | Controles de la pantalla Ajustes ([SettingField](../interfaces/SettingField.html)). La bajada mínima se añade sola |
| `faults` | Texto y frase de voz de sus fallos, incluido el de no llegar a la profundidad |
| `createAnalyzer()` | Crea su [Analyzer](../interfaces/Analyzer.html) |

## El analyzer

Recibe los 33 puntos de cada fotograma y devuelve un [FrameEval](../interfaces/FrameEval.html). Lo importante:

<pre class="mermaid">
flowchart TD
  P["Puntos del fotograma"] --> V{"¿Se ven las articulaciones clave?"}
  V -->|no| X(["EMPTY"])
  V -->|sí| A["`**angle**: la articulación que se estira y se flexiona`"]
  A --> E["`**extended**: ángulo ≥ umbral de arriba`"]
  A --> B["`**bottom**: llegó a la profundidad o altura exigida`"]
  P --> I["`**inPosition**: está en la postura del ejercicio`"]
  P --> F["`**faults**: fallos de técnica de este fotograma`"]
  P --> S["`**trackY** + **bodyPx**: para la velocidad en m/s`"]
</pre>

- **El ángulo debe ser alto con la articulación extendida y bajo flexionada.** El contador espera *extendido → flexionado
  → extendido*. En ejercicios donde subir es flexionar (dominadas, remo, curl, elevaciones), `flexIsEccentric = false`.
- **`inPosition` evita contar movimientos fuera del ejercicio.** Por ejemplo, los fondos exigen el antebrazo vertical
  para no confundirse con doblar los brazos de pie.
- **Fallos con línea base** (impulso, balanceo): guarda la referencia en `startRep()`. `KipDetector` y las utilidades
  de [common.ts](../miscellaneous/functions.html) ya resuelven los casos habituales.
- **Velocidad**: `trackY` es la altura del punto que se mueve; `bodyPx` la longitud en píxeles de unos segmentos cuya
  fracción de la altura es `bodyRatio` (usa `SEGMENT`).

## Pasos

1. Copia un módulo parecido (por ejemplo `dips.ts`) a `src/app/exercises/mi-ejercicio.ts`.
2. Define la interfaz de sus ajustes (`extends EccentricRule`), el analyzer y el objeto del módulo.
3. Añade el módulo a `EXERCISE_MODULES` en `src/app/exercises/index.ts`. El tipo `ExerciseId` y los ajustes se
   actualizan solos; TypeScript avisará si falta algo.
4. Escribe `mi-ejercicio.spec.ts` con poses sintéticas: posición extendida, objetivo alcanzado, cada fallo y una
   postura que **no** debe contar como el ejercicio.
5. Añade el caso a `reps.integration.spec.ts`: una repetición completa debe contar una válida y media repetición
   ninguna.
6. Ejecuta `npm test`. El test del registro (`index.spec.ts`) comprueba automáticamente que el módulo tiene textos,
   valores por defecto para cada control dentro de sus límites, voz para cada fallo y que no redefine un fallo
   existente con otro texto.
7. Añade sus criterios a la guía ([Repeticiones estrictas](repeticiones-estrictas.html) y [Ajustes](ajustes.html)).

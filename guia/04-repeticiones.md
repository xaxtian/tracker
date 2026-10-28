# Repeticiones estrictas

Los tres ejercicios comparten la misma idea: una articulación que se **extiende → flexiona → extiende**
(rodilla en la sentadilla, codo en flexiones y dominadas). [RepCounter](../classes/RepCounter.html) sigue ese
movimiento con una máquina de estados.

## Máquina de estados

<pre class="mermaid">
stateDiagram-v2
  direction LR
  [*] --> idle
  idle --> top: extensión completa
  top --> moving: se flexiona más que el recorrido mínimo
  moving --> top: vuelve a extender del todo y la repetición queda pendiente
  moving --> moving: sube a medias y vuelve a bajar, repetición sin bloqueo
  top --> idle: sale de posición
  moving --> idle: sale de posición
</pre>

| Estado | Qué significa |
|---|---|
| `idle` | Esperando la primera extensión completa. No se cuenta nada hasta entonces. |
| `top` | Extendido y listo. Guarda el ángulo de referencia de arriba. |
| `moving` | Repetición en curso: registra el ángulo mínimo, si llegó a la profundidad y los fallos. |

**Recorrido mínimo** (ajuste *Recorrido mínimo para intento*, 30° por defecto): pequeños movimientos no cuentan como
intento, ni válido ni inválido.

## Cuándo es válida

Al terminar, `judge()` reúne los motivos. Si no hay ninguno, la repetición es válida.

<pre class="mermaid">
flowchart LR
  R(["Repetición terminada"]) --> D{"¿Llegó a la profundidad?"}
  D -->|no| X1["noDepth del ejercicio"]
  D -->|sí| S{"¿Empezó extendido?"}
  S -->|no| X2["noStart"]
  S -->|sí| L{"¿Terminó extendido?"}
  L -->|no| X3["noLockout"]
  L -->|sí| F{"¿Fallos confirmados?"}
  F -->|sí| X4["hipSag, swing…"]
  F -->|no| E{"¿Bajada más rápida que el mínimo?"}
  E -->|"sí, si está activado"| X5["fastEccentric"]
  E -->|no| OK(["✓ Válida"])
</pre>

- **Fallos confirmados**: un fallo solo invalida si aparece en *N* fotogramas seguidos (ajuste *Fotogramas para
  confirmar un fallo*, 3 por defecto). Así un punto mal detectado en un fotograma no anula una repetición buena.
- Una repetición que **sube a medias y vuelve a bajar** se da por terminada sin bloqueo (`noLockout`) y la siguiente
  queda marcada como `noStart`. La subida se mide desde el punto más profundo: seguir bajando más allá del umbral de
  profundidad no cuenta como subir.

## Repetición pendiente

Para medir bien la subida hay que ver cómo **se para** la articulación. Por eso, al extender del todo, la repetición
queda pendiente y se anuncia cuando ocurre lo primero de esto:

- La articulación está quieta: la media de los últimos 75 ms difiere menos de 2° de la de los 75 ms anteriores
  (como pronto 150 ms después).
- Han pasado 700 ms.
- Empieza la siguiente repetición, la persona sale de posición o se para la cámara.

En la práctica el número suena **unos 0,2 s** después de terminar.


## Criterios por ejercicio

Cada ejercicio es un módulo en `src/app/exercises/` con su propio *analyzer* (ver
[Añadir un ejercicio](añadir-un-ejercicio.html)). Todos los umbrales se cambian en [Ajustes](ajustes.html).
"Ángulo" es la articulación que sigue el contador: alto = extendido, bajo = flexionado.

### 🏋️ Sentadilla — cámara de lado

| | Criterio | Por defecto |
|---|---|---|
| Ángulo | Cadera-rodilla-tobillo | |
| Extensión | Rodilla ≥ *Extensión arriba* | 165° |
| Profundidad | Cadera por debajo de la rodilla (con margen) **o** rodilla ≤ ángulo | cadera bajo rodilla |
| `torsoLean` | Tronco más inclinado que el máximo respecto a la vertical | 50° |
| `heelsUp` | Talón se levanta más que la tolerancia (opcional) | apagado |
| Posición | Siempre en posición si se ve el cuerpo | |

### 💪 Flexión — cámara de lado

| | Criterio | Por defecto |
|---|---|---|
| Ángulo | Hombro-codo-muñeca | |
| Extensión / profundidad | Codo ≥ 160° / codo ≤ 90° | |
| Posición | Cuerpo a menos de 40° de la horizontal, rodillas > 120°, manos no por encima de los hombros | |
| `hipSag` / `hipPike` | Hombro-cadera-tobillo < 160°, con la cadera por debajo / por encima de la línea | 160° |
| `kneesBent` | Rodilla < 150° | 150° |

### 🔻 Fondos en paralelas — cámara de lado

| | Criterio | Por defecto |
|---|---|---|
| Ángulo | Hombro-codo-muñeca | |
| Extensión | Codo ≥ *Extensión arriba* | 160° |
| Profundidad | El hombro baja hasta la altura del codo (margen en % del brazo) | 0 % |
| Posición | Manos por debajo de codos y hombros, **antebrazo casi vertical** (< 35°) y tronco < 60° | |
| `kip` | El ángulo de rodilla cambia más que el máximo durante la repetición | 45° |

El antebrazo vertical es lo que distingue un fondo de estar de pie doblando los brazos: al doblar el codo de pie, el
antebrazo se inclina y la persona sale de posición.

### ⛰️ Flexiones pike — cámara de lado

| | Criterio | Por defecto |
|---|---|---|
| Ángulo | Hombro-codo-muñeca | |
| Extensión | Codo ≥ *Extensión arriba* | 160° |
| Profundidad | La nariz llega cerca de las manos (distancia en % del brazo) | 40 % |
| Posición | V invertida: cadera por encima de hombros y pies, manos en el suelo, hombro-cadera-tobillo < 155° | |
| `pikeFlat` | Hombro-cadera-tobillo mayor que el máximo: la cadera bajó | 120° |
| `kneesBent` | Rodilla < 150° | 150° |

### 🤸 Flexiones de pino — cámara de lado

| | Criterio | Por defecto |
|---|---|---|
| Ángulo | Hombro-codo-muñeca | |
| Extensión | Codo ≥ *Extensión arriba* | 160° |
| Profundidad | La nariz llega cerca de las manos: cabeza al suelo | 40 % |
| Posición | Boca abajo: cadera por encima de los hombros, manos por debajo, cuerpo a menos de 45° de la vertical | |
| `archedBack` | Hombro-cadera-tobillo menor que el mínimo: cuerpo arqueado o doblado | 150° |
| `kip` | El ángulo de rodilla cambia más que el máximo (patada) | 45° |

### 🧗 Dominada — cámara de frente

| | Criterio | Por defecto |
|---|---|---|
| Ángulo | Media de los codos visibles | |
| Extensión | Codo ≥ *Colgado completo* | 160° |
| Profundidad | Boca por encima de las manos (margen en % del tronco) | 0 % |
| Posición | Manos por encima de los hombros (colgado) | |
| `swing` | La cadera se desplaza en horizontal más que el % del tronco desde el inicio | 30 % |
| `kip` | El ángulo de rodilla cambia más que el máximo durante la repetición | 45° |

### 🚣 Remo invertido — cámara de lado

| | Criterio | Por defecto |
|---|---|---|
| Ángulo | Hombro-codo-muñeca | |
| Extensión | Codo ≥ *Brazos estirados abajo* | 160° |
| Profundidad | El hombro sube hasta cerca de las manos: pecho a la barra (% del brazo) | 50 % |
| Posición | Manos por encima de los hombros y cuerpo a menos de 50° de la horizontal | |
| `hipSag` / `hipPike` | Hombro-cadera-tobillo < 160° | 160° |

### 🦾 Curl de bíceps y ✊ curl unilateral — cámara de lado

| | Criterio | Por defecto |
|---|---|---|
| Ángulo | Hombro-codo-muñeca del brazo más cercano a la cámara | |
| Extensión | Codo ≥ *Brazo estirado abajo* | 150° |
| Profundidad | Codo ≤ *Ángulo de codo arriba* | 50° |
| Posición | Codo por debajo del hombro y tronco a menos de 45° de la vertical | |
| `elbowDrift` | El brazo se separa de la vertical más que el máximo: el codo se adelanta | 30° |
| `torsoSwing` | La inclinación del tronco cambia más que el máximo durante la repetición | 10° |

El **unilateral** usa el mismo análisis y además guarda en cada serie qué brazo se ha trabajado. Si cambias de brazo
a mitad de serie, la serie se cierra y empieza otra.

### 🦵 Elevaciones de piernas — cámara de lado

| | Criterio | Por defecto |
|---|---|---|
| Ángulo | Hombro-cadera-rodilla | |
| Extensión | Cadera ≥ *Colgado recto* | 160° |
| Profundidad | Cadera ≤ *Ángulo de cadera arriba* (90° = piernas paralelas, ~40° = pies a la barra) | 90° |
| Posición | Manos por encima de los hombros (colgado) | |
| `kneesBent` | Rodilla < mínimo, si se exigen piernas estiradas | 140°, activado |
| `swing` | La cadera se desplaza en horizontal más que el % del tronco desde el inicio | 40 % |

El lado del cuerpo que se analiza en los ejercicios de lado lo elige [SidePicker](../classes/SidePicker.html): el más
visible, con histéresis para que no salte de un lado a otro.

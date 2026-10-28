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
  queda marcada como `noStart`.

## Repetición pendiente

Para medir bien la subida hay que ver cómo **se para** la articulación. Por eso, al extender del todo, la repetición
queda pendiente y se anuncia cuando ocurre lo primero de esto:

- La articulación está quieta: la media de los últimos 75 ms difiere menos de 2° de la de los 75 ms anteriores
  (como pronto 150 ms después).
- Han pasado 700 ms.
- Empieza la siguiente repetición, la persona sale de posición o se para la cámara.

En la práctica el número suena **unos 0,2 s** después de terminar.

## Criterios por ejercicio

Todos los umbrales se cambian en [Ajustes](ajustes.html).

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

### 🧗 Dominada — cámara de frente

| | Criterio | Por defecto |
|---|---|---|
| Ángulo | Media de los codos visibles | |
| Extensión | Codo ≥ *Colgado completo* | 160° |
| Profundidad | Boca por encima de las manos (margen en % del tronco) | 0 % |
| Posición | Manos por encima de los hombros (colgado) | |
| `swing` | La cadera se desplaza en horizontal más que el % del tronco desde el inicio | 30 % |
| `kip` | El ángulo de rodilla cambia más que el máximo durante la repetición | 45° |

El lado del cuerpo que se analiza (sentadilla y flexión) lo elige [SidePicker](../classes/SidePicker.html): el más
visible, con histéresis para que no salte de un lado a otro.

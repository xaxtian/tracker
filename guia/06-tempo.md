# Tempo y velocidad

[computeTempo](../miscellaneous/functions.html#computeTempo) mide cada repetición **después** de que termine, con
todos sus fotogramas. Así puede usar un suavizado centrado (sin el retraso de un filtro en tiempo real).

## Las cuatro fases

<pre class="mermaid">
flowchart LR
  P1["`**Pausa entre repeticiones**
  arriba / colgado`"] --> F["`**Flexión**
  la articulación se cierra`"]
  F --> P2["`**Pausa de cambio**
  abajo / arriba`"]
  P2 --> E["`**Extensión**
  la articulación se abre`"]
  E --> P1
</pre>

| Ejercicio | Excéntrica | Concéntrica |
|---|---|---|
| Sentadilla, flexión | flexión (bajar) | extensión (subir) |
| Dominada | extensión (bajar de la barra) | flexión (subir) |

Lo decide `flexIsEccentric` de cada [Analyzer](../interfaces/Analyzer.html).

## Cómo se miden los tiempos

<pre class="mermaid">
flowchart TD
  A["Ángulo de cada fotograma con su hora exacta"] --> B["`**Pasada 1**
  regresión lineal local ponderada, ventana ±120 ms
  → ángulo suavizado y velocidad angular`"]
  B --> C["Punto más bajo y velocidad máxima de bajada y de subida"]
  C --> D["`Inicio y fin de cada fase: cuando la velocidad cruza el
  **10 % de su máximo**, interpolado entre fotogramas`"]
  D --> E["`**Pasada 2**
  cada fase se vuelve a medir con una ventana del 8 % de su duración, entre 60 y 160 ms`"]
  E --> F["Duraciones redondeadas al milisegundo"]
</pre>

- **Regresión local centrada**: para cada fotograma ajusta una recta a sus vecinos con pesos gaussianos. Da a la vez
  el valor suavizado y la velocidad, sin desfase temporal.
- **Ventana adaptada**: una fase lenta necesita más suavizado; una rápida, menos, para no difuminar sus extremos.
- **Cruces interpolados**: el instante en que la velocidad cruza el umbral se calcula entre dos fotogramas, así que la
  resolución es mejor que la separación entre fotogramas.

### Precisión medida con movimientos simulados

| Medida | Real | Medido |
|---|---|---|
| Excéntrica | 2,00 s | 1,96-2,00 s (±0,03-0,05) |
| Concéntrica | 1,00 s | 1,00-1,02 s (±0,03) |
| Pausas | 0,50 / 1,00 s | 0,50-0,51 / 0,99-1,02 s |
| Velocidad media | 0,619 m/s | 0,60-0,61 m/s (±0,02) |

Si el arranque es extremadamente gradual, el tramo inicial por debajo del 10 % de la velocidad máxima no cuenta y la
fase sale algo más corta. El criterio es siempre el mismo, así que las repeticiones son comparables entre sí.

## Velocidad en m/s

<pre class="mermaid">
flowchart LR
  H["Altura del usuario (Ajustes)"] --> S
  R["`Proporción de los segmentos
  (tablas de Winter)`"] --> S
  B["`Longitud de esos segmentos en píxeles
  mediana cerca de la extensión`"] --> S
  S(["metros por píxel"]) --> V
  Y["Altura del punto seguido, suavizada"] --> V(["velocidad media y pico"])
</pre>

| Ejercicio | Punto seguido | Segmentos de referencia | Fracción de la altura |
|---|---|---|---|
| Sentadilla | cadera | muslo + pierna + tronco | 0,779 |
| Flexión | hombro | tronco + muslo + pierna | 0,779 |
| Dominada | centro de los hombros | tronco + brazo + antebrazo | 0,620 |

- **Velocidad media** de una fase = desplazamiento vertical × metros/píxel ÷ duración.
- **Velocidad pico** = máximo de la derivada de la altura suavizada.
- Si no se ven los segmentos de referencia, los tiempos se miden igual pero la velocidad queda vacía.

En condiciones reales cuenta con un **5-15 %** de error en el valor absoluto. La pérdida de velocidad dentro de una
serie es más fiable porque los errores de escala se cancelan.

## Tiempo mínimo de bajada (opcional)

Con *Exigir bajada controlada* activado en el ejercicio, una repetición cuya excéntrica dure menos del mínimo se marca
como `fastEccentric` («Bajada demasiado rápida») y no cuenta.

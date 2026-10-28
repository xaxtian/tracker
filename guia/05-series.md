# Series automáticas

Una **serie** son las repeticiones seguidas sin descansar ni bajarse de la barra. [SetTracker](../classes/SetTracker.html)
la abre con la primera repetición y la cierra sola. La siguiente empieza también sola.

<pre class="mermaid">
stateDiagram-v2
  direction LR
  [*] --> Descanso
  Descanso --> EnSerie: primera repetición, válida o no
  EnSerie --> EnSerie: más repeticiones
  EnSerie --> Descanso: fuera de posición demasiado tiempo
  EnSerie --> Descanso: sin actividad demasiado tiempo
  EnSerie --> Descanso: botón Terminar serie o Parar
</pre>

## Reglas de cierre por ejercicio

| Ejercicio | Fuera de posición | Sin actividad |
|---|---|---|
| Sentadilla | *Tiempo fuera de posición* (2 s) | *Descanso para cerrar serie* (10 s) |
| Flexión | 2 s (levantarse de la plancha) | el triple: 30 s |
| Dominada | 2 s (bajarse de la barra) | nunca: puedes colgar lo que quieras |

- Una repetición en curso cuenta como actividad: una bajada lenta no cierra la serie.
- Un momento corto fuera de posición (menos del tiempo configurado) se perdona.

## Qué se guarda de cada serie

Al cerrarse, la serie ([SetRecord](../interfaces/SetRecord.html)) se guarda en el historial con:

- hora de inicio y fin, repeticiones válidas y no válidas, y cuántas veces apareció cada fallo;
- **descanso previo**: desde el final de la serie anterior hasta la primera repetición de esta;
- **peso/lastre** elegido en ese momento (si no es 0);
- el detalle de **cada repetición** con su tempo;
- el vídeo y el segundo en que empieza, si se estaba grabando.

La pausa antes de la primera repetición es descanso, no parte de la serie, así que su «pausa entre repeticiones» se
deja vacía.

## Pérdida de velocidad

[velocityLoss](../miscellaneous/functions.html#velocityLoss) compara la velocidad media de subida de la **última**
repetición válida con la de la **más rápida** de la serie:

```
pérdida (%) = (mejor − última) / mejor × 100
```

Es un indicador habitual de fatiga. La app la marca en naranja a partir del 20 %.

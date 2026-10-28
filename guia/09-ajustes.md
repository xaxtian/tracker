# Ajustes

Todos los criterios se cambian en la pantalla **Ajustes** y se aplican al momento, también durante un entrenamiento.
Los valores por defecto están en [DEFAULT_SETTINGS](../miscellaneous/variables.html#DEFAULT_SETTINGS); cada sección
tiene un botón para restaurarlos.

## 🏋️ Sentadillas

| Ajuste | Por defecto | Efecto |
|---|---|---|
| Extensión arriba | 165° | Ángulo de rodilla para considerar que estás de pie del todo |
| Criterio de profundidad | Cadera bajo rodilla | O bien *Ángulo de rodilla* |
| Margen de profundidad | 0 % | Positivo = más exigente. En % del muslo |
| Ángulo de rodilla abajo | 90° | Solo con el criterio de ángulo |
| Inclinación máxima del tronco | 50° | Respecto a la vertical |
| Comprobar talones | No | Invalida si levantas los talones |
| Tolerancia de talones | 8 % | En % de la espinilla |
| Exigir bajada controlada | No | Activa el tiempo mínimo de bajada |
| Tiempo mínimo de bajada | 1,5 s | Duración mínima de la excéntrica |

## 💪 Flexiones

| Ajuste | Por defecto | Efecto |
|---|---|---|
| Extensión arriba | 160° | Codo con los brazos estirados |
| Ángulo de codo abajo | 90° | Más bajo = más exigente |
| Cuerpo recto | 160° | Ángulo hombro-cadera-tobillo mínimo |
| Rodillas estiradas | 150° | Ángulo de rodilla mínimo |
| Exigir bajada controlada / tiempo mínimo | No / 1,5 s | Como en sentadillas |

## 🔻 Fondos en paralelas

| Ajuste | Por defecto | Efecto |
|---|---|---|
| Extensión arriba | 160° | Codo con los brazos estirados |
| Profundidad | 0 % | Cuánto baja el hombro respecto al codo, en % del brazo. 0 = brazo paralelo al suelo |
| Movimiento máximo de rodillas | 45° | Detecta impulso con las piernas |
| Exigir bajada controlada / tiempo mínimo | No / 1,5 s | Como en sentadillas |

## ⛰️ Flexiones pike

| Ajuste | Por defecto | Efecto |
|---|---|---|
| Extensión arriba | 160° | Codo con los brazos estirados |
| Cabeza al suelo | 40 % | Distancia máxima de la nariz a las manos, en % del brazo |
| Cadera alta | 120° | Ángulo hombro-cadera-tobillo máximo: por encima, la cadera ha bajado |
| Rodillas estiradas | 150° | Ángulo de rodilla mínimo |
| Exigir bajada controlada / tiempo mínimo | No / 1,5 s | Como en sentadillas |

## 🤸 Flexiones de pino

| Ajuste | Por defecto | Efecto |
|---|---|---|
| Extensión arriba | 160° | Codo con los brazos estirados |
| Cabeza al suelo | 40 % | Con la cabeza tocando el suelo suele estar en un 30-40 % |
| Cuerpo recto | 150° | Ángulo hombro-cadera-tobillo mínimo |
| Movimiento máximo de rodillas | 45° | Detecta patadas |
| Exigir bajada controlada / tiempo mínimo | No / 1,5 s | Como en sentadillas |

## 🧗 Dominadas

| Ajuste | Por defecto | Efecto |
|---|---|---|
| Colgado completo | 160° | Codo abajo con los brazos estirados |
| Altura de la barbilla | 0 % | Cuánto pasa la boca de las manos, en % del tronco |
| Balanceo máximo | 30 % | Desplazamiento horizontal de la cadera, en % del tronco |
| Movimiento máximo de rodillas | 45° | Detecta el *kipping* |
| Exigir bajada controlada / tiempo mínimo | No / 1,5 s | La bajada desde la barra |

## 🚣 Remo invertido

| Ajuste | Por defecto | Efecto |
|---|---|---|
| Brazos estirados abajo | 160° | Codo abajo |
| Pecho a la barra | 50 % | Distancia máxima del hombro por debajo de las manos, en % del brazo |
| Cuerpo recto | 160° | Ángulo hombro-cadera-tobillo mínimo |
| Exigir bajada controlada / tiempo mínimo | No / 1,5 s | La bajada del cuerpo |

## 🦾 Curl de bíceps y ✊ curl unilateral

Cada curl tiene sus propios ajustes, con los mismos valores por defecto.

| Ajuste | Por defecto | Efecto |
|---|---|---|
| Brazo estirado abajo | 150° | Codo abajo |
| Ángulo de codo arriba | 50° | Más bajo = más exigente |
| Movimiento máximo del codo | 30° | Ángulo máximo del brazo respecto a la vertical |
| Balanceo máximo del tronco | 10° | Cambio máximo de inclinación del tronco |
| Exigir bajada controlada / tiempo mínimo | No / 1,5 s | La bajada del peso |

## 🦵 Elevaciones de piernas

| Ajuste | Por defecto | Efecto |
|---|---|---|
| Colgado recto | 160° | Ángulo de cadera abajo |
| Ángulo de cadera arriba | 90° | 90° = piernas paralelas; unos 40° = pies a la barra |
| Piernas estiradas | Sí | Invalida si doblas las rodillas |
| Ángulo de rodilla mínimo | 140° | Solo con piernas estiradas |
| Balanceo máximo | 40 % | Desplazamiento horizontal de la cadera, en % del tronco |
| Exigir bajada controlada / tiempo mínimo | No / 1,5 s | La bajada de las piernas |

## ⚙️ General

| Ajuste | Por defecto | Efecto |
|---|---|---|
| Tu altura | 175 cm | Escala para la velocidad en m/s |
| Cámara a 60 fps | Sí | Más precisión, más batería. Se aplica al encender la cámara |
| Descanso para cerrar serie | 10 s | ×3 en flexiones y pike; no aplica en dominadas, remo, pino y elevaciones |
| Tiempo fuera de posición | 2 s | Para cerrar la serie al salir de posición |
| Recorrido mínimo para intento | 30° | Movimientos menores no cuentan |
| Fotogramas para confirmar un fallo | 3 | Más alto = más permisivo con el ruido |
| Visibilidad mínima | 0,5 | Confianza mínima de cada articulación |
| Suavizado | 0,4 | Más alto = menos temblor, más retraso |
| Modelo | Completo | *Ligero* para móviles antiguos |
| Voz / Pitidos | Sí / Sí | Avisos sonoros |
| Grabar vídeo automáticamente | No | Graba al encender la cámara |
| Mostrar ángulos | Sí | Muestra los ángulos medidos, útil para ajustar criterios |

## Dentro del código

[SettingsComponent](../components/SettingsComponent.html) monta una sección por cada módulo del registro con sus
`fields` y añade los dos controles de la bajada mínima (`eccentricFields`). La sección General es la única definida en
la propia pantalla. Cada campo indica su tipo (deslizador, interruptor o lista), límites, unidad y, si depende de otro
ajuste, una condición `when` que recibe los ajustes de su sección (por ejemplo, *Tolerancia de talones* solo con
*Comprobar talones*).

Los valores por defecto ([DEFAULT_SETTINGS](../miscellaneous/variables.html#DEFAULT_SETTINGS)) son los generales más
los `defaults` de cada módulo. Al cargar los ajustes guardados se mezclan con ellos, así que un ejercicio nuevo
aparece con sus valores por defecto sin tocar los demás. Ver [Añadir un ejercicio](añadir-un-ejercicio.html).

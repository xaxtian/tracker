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

## 🧗 Dominadas

| Ajuste | Por defecto | Efecto |
|---|---|---|
| Colgado completo | 160° | Codo abajo con los brazos estirados |
| Altura de la barbilla | 0 % | Cuánto pasa la boca de las manos, en % del tronco |
| Balanceo máximo | 30 % | Desplazamiento horizontal de la cadera, en % del tronco |
| Movimiento máximo de rodillas | 45° | Detecta el *kipping* |
| Exigir bajada controlada / tiempo mínimo | No / 1,5 s | La bajada desde la barra |

## ⚙️ General

| Ajuste | Por defecto | Efecto |
|---|---|---|
| Tu altura | 175 cm | Escala para la velocidad en m/s |
| Cámara a 60 fps | Sí | Más precisión, más batería. Se aplica al encender la cámara |
| Descanso para cerrar serie | 10 s | Sentadillas; ×3 en flexiones; no aplica en dominadas |
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

[SettingsComponent](../components/SettingsComponent.html) se construye a partir de una lista de campos (`SECTIONS`).
Cada campo indica su tipo (deslizador, interruptor o lista), límites, unidad y, si depende de otro ajuste, una
condición `when` para mostrarse solo cuando aplica (por ejemplo, *Tolerancia de talones* solo con *Comprobar talones*).
Añadir un ajuste nuevo es añadir su valor por defecto en `DEFAULT_SETTINGS`, su tipo en
[GeneralSettings](../interfaces/GeneralSettings.html) o la sección del ejercicio, y su campo en `SECTIONS`.

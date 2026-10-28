# TrackBody

App Angular que usa la cámara (móvil o webcam) para contar **repeticiones estrictas** de 10 ejercicios: sentadillas,
flexiones, fondos en paralelas, flexiones pike, flexiones de pino, dominadas, remo invertido, curl de bíceps, curl de
bíceps unilateral y elevaciones de piernas.
La detección del cuerpo se hace con MediaPipe Pose Landmarker en el propio navegador: el vídeo no sale del dispositivo.

## Arrancar

```bash
npm install
npm start            # http://localhost:4200 (webcam del ordenador)
npm run start:mobile # https://<ip-del-pc>:4200 para abrirla desde el móvil en la misma red
```

El móvil solo da acceso a la cámara por HTTPS. Con `start:mobile` el certificado es autofirmado: acepta el aviso del navegador.

## Cómo funciona

- **Repeticiones** ([rep-counter.ts](src/app/analysis/rep-counter.ts)): máquina de estados `extendido → flexionado → extendido`
  sobre el ángulo principal de cada ejercicio (rodilla, codo o cadera). Una repetición solo es válida si empieza
  y termina en extensión completa, llega a la profundidad exigida y no aparece ningún fallo de técnica.
- **Un módulo por ejercicio** ([src/app/exercises/](src/app/exercises/)): cada archivo contiene sus criterios de
  estricto, sus ajustes, sus textos y cómo termina la serie. Para añadir un ejercicio basta con escribir su módulo y
  añadirlo al registro ([index.ts](src/app/exercises/index.ts)); ver el capítulo «Añadir un ejercicio» de la guía.
  - Sentadilla: cadera por debajo de la rodilla, inclinación del tronco y (opcional) talones.
  - Flexión: codo a 90°, cuerpo recto (cadera caída o levantada) y rodillas estiradas.
  - Fondos: el hombro baja hasta el codo, extensión completa y sin impulso de piernas.
  - Flexiones pike: cabeza hacia el suelo con la cadera alta y las rodillas estiradas.
  - Flexiones de pino: cabeza al suelo, cuerpo recto y sin patada.
  - Dominada: colgado completo, boca por encima de las manos, sin balanceo ni kipping.
  - Remo invertido: pecho a la barra con el cuerpo recto.
  - Curl de bíceps: recorrido completo con el codo quieto y sin balanceo del tronco. El unilateral guarda el brazo.
  - Elevaciones de piernas: piernas a la altura de la cadera (o a la barra), estiradas y sin balanceo.
- **Series automáticas** ([set-tracker.ts](src/app/analysis/set-tracker.ts)): la serie empieza con la primera repetición
  y termina al salir de la posición (bajarte de la barra, levantarte de la plancha, salir de cámara) o, en los
  ejercicios que no son de barra, tras un tiempo sin repeticiones. La siguiente serie empieza sola.
- **Ajustes**: todos los umbrales se pueden cambiar en la pantalla Ajustes y se guardan en el navegador.
- **Historial**: series agrupadas por día y ejercicio, con motivos de las repeticiones no válidas. Exportable a JSON.
- **Peso / lastre**: en la pantalla de entrenamiento eliges los kg extra (negativo = asistida con goma). Se recuerda por
  ejercicio, se guarda en cada serie y se puede corregir después desde el detalle de la serie en el historial.
- **Tempo y velocidad** ([tempo.ts](src/app/analysis/tempo.ts)): duración de la fase excéntrica, concéntrica y de las
  pausas, y velocidad media/pico en m/s (escala calibrada con la altura del usuario y proporciones antropométricas).
  Usa la marca de tiempo real de cada fotograma (requestVideoFrameCallback), suavizado centrado sin retraso y cruces de
  velocidad interpolados entre fotogramas. Opcional: tiempo mínimo de bajada como criterio de repetición estricta.
- **Vídeos** ([session-recorder.ts](src/app/services/session-recorder.ts)): graba la cámara con el esqueleto, el contador y
  los avisos dibujados encima (canvas + MediaRecorder). Se guardan en IndexedDB en trozos de 2 s, solo en el dispositivo.
  Cada serie queda marcada en el vídeo para saltar a ella; se pueden descargar o compartir (galería, WhatsApp…).

## Tests

Tests unitarios con Jest (`jest-preset-angular`, modo zoneless). Cubren la lógica de análisis, los servicios y todas
las pantallas, más una prueba de integración que pasa dos sentadillas simuladas por todo el proceso.

```bash
npm test               # todos los tests
npm run test:watch     # se repiten al guardar
npm run test:coverage  # con cobertura en coverage/index.html
npm run test:types     # comprueba los tipos de los tests
```

Las utilidades de test (poses sintéticas, movimientos con tiempos conocidos, mocks del navegador) están en
[src/testing/](src/testing/).

## Documentación

```bash
npm run docs        # genera la documentación en docs/ (abre docs/index.html)
npm run docs:serve  # la genera y la sirve en http://localhost:8080
```

Se genera con Compodoc e incluye:

- una **guía con diagramas** ([guia/](guia/)): arquitectura, pantallas, el recorrido de cada fotograma, la máquina de
  estados de las repeticiones, las series, el cálculo de tempo y velocidad, la grabación, los datos y los ajustes;
- la **referencia de cada componente, servicio, clase, interfaz y función**, con su código, plantilla y dependencias;
- el gráfico de rutas, la cobertura de la documentación y la de los tests.

Los capítulos de la guía son Markdown con diagramas Mermaid; [scripts/docs-mermaid.js](scripts/docs-mermaid.js) los
activa en la web generada.

## Colocación de la cámara

- Dominadas: **de frente**, lo bastante lejos para ver manos y pies.
- Todos los demás: **de lado**, a 2-3 m, con el cuerpo entero en el encuadre. En el curl unilateral, con el brazo que
  trabaja hacia la cámara.

## Próxima fase

- Detección automática del ejercicio.

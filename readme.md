# TrackBody

App Angular que usa la cámara (móvil o webcam) para contar **sentadillas, flexiones y dominadas estrictas**.
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
  sobre el ángulo principal (rodilla en sentadilla, codo en flexión y dominada). Una repetición solo es válida si empieza
  y termina en extensión completa, llega a la profundidad exigida y no aparece ningún fallo de técnica.
- **Criterios por ejercicio** ([analyzers.ts](src/app/analysis/analyzers.ts)):
  - Sentadilla: cadera por debajo de la rodilla, inclinación del tronco y (opcional) talones.
  - Flexión: codo a 90°, cuerpo recto (cadera caída o levantada) y rodillas estiradas.
  - Dominada: colgado completo, boca por encima de las manos, sin balanceo ni kipping.
- **Series automáticas** ([set-tracker.ts](src/app/analysis/set-tracker.ts)): la serie empieza con la primera repetición
  y termina al salir de la posición (bajarte de la barra, levantarte de la plancha, salir de cámara) o, en sentadillas,
  tras un tiempo sin repeticiones. La siguiente serie empieza sola.
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

## Colocación de la cámara

- Sentadillas y flexiones: **de lado**, a 2-3 m, con el cuerpo entero en el encuadre.
- Dominadas: **de frente**, lo bastante lejos para ver manos y pies.

## Próxima fase

- Detección automática del ejercicio.

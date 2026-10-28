# Tests

Los tests unitarios usan **Jest** con `jest-preset-angular` en modo *zoneless*, igual que la app.

| Comando | Qué hace |
|---|---|
| `npm test` | Ejecuta todos los tests |
| `npm run test:watch` | Los repite al guardar |
| `npm run test:coverage` | Con informe de cobertura en `coverage/` (abre `coverage/index.html`) |
| `npm run test:types` | Comprueba los tipos de los tests (Jest solo transpila) |

La cobertura también aparece en esta documentación, en *Cobertura de la documentación*, columna de tests.

## Qué se prueba

<pre class="mermaid">
flowchart LR
  E["`**Ejercicios** · exercises/
  un spec por módulo con poses sintéticas
  contrato del registro`"]
  L["`**Lógica** · analysis/
  geometry · rep-counter · tempo
  set-tracker · set-stats · overlay`"]
  S["`**Servicios** · services/
  settings · history · feedback · pose
  video-store con IndexedDB · session-recorder`"]
  P["`**Pantallas** · pages/
  home · workout · history · settings
  videos · video-player · recording-player`"]
  I{{"`**Integración**
  una repetición completa de cada ejercicio
  y dos sentadillas por toda la pantalla`"}}
  E --> I
  L --> I
  S --> I
  P --> I
</pre>

| Área | Ejemplos de lo que se comprueba |
|---|---|
| Geometría | Ángulos, inclinaciones, lado visible con histéresis |
| Ejercicios | Por módulo: extensión, objetivo, posición, cada fallo y posturas que no deben contar. Registro: cada módulo tiene textos, voz, valores por defecto dentro de sus límites, y fallos sin textos contradictorios |
| Integración | Una repetición completa de cada uno de los 10 ejercicios cuenta una válida con su tempo; media repetición, ninguna |
| Contador | Repeticiones válidas, sin profundidad, sin bloqueo, sin inicio, fallos de 2 vs 3 fotogramas, bajada rápida, repetición pendiente |
| Tempo | Fases con error < 0,08 s a 30 y 60 fps, con ruido, velocidades en m/s, dominadas, casos sin datos |
| Series | Cierre por posición e inactividad, descanso previo, motivos acumulados |
| Dibujo | Colores del esqueleto, textos del HUD, avisos que caducan, ajuste de textos largos |
| Servicios | Persistencia y mezcla de ajustes, historial, voz y pitidos, carga del modelo con GPU→CPU, vídeos en IndexedDB, grabación por trozos y capítulos |
| Pantallas | Lo que se ve y lo que hacen los botones: filtros, detalle, corregir peso, popup de vídeo, borrar, exportar, cámaras, peso/lastre, grabación, errores de cámara |

## Utilidades de test · `src/testing/`

| Archivo | Para qué |
|---|---|
| `landmarks.ts` | Poses sintéticas: sentadilla de lado para cualquier ángulo de rodilla, plancha con cadera caída o alta, dominada colgado o arriba |
| `motion.ts` | Movimientos con tiempos conocidos (perfil trapezoidal de velocidad) y `FrameEval` de prueba |
| `canvas.mock.ts` | Contexto 2D que registra textos, tamaños de letra y trazos (jsdom no tiene canvas) |
| `media-recorder.mock.ts` | `MediaRecorder` y `captureStream` falsos |
| `fakes.ts` | Almacén de vídeos en memoria, URLs de objetos, reproducción de vídeo, datos de ejemplo |
| `mediapipe.mock.ts` | Sustituye a MediaPipe, que necesita WASM y GPU |

## Entorno

- `jest.environment.js` añade `structuredClone` al entorno jsdom. Deja pasar los `Blob` sin copiarlos, porque la
  versión de Node no los entiende. Lo usan la app y `fake-indexeddb`.
- `setup-jest.ts` activa IndexedDB falso, el entorno *zoneless* y el idioma español para las fechas.
- `tsconfig.spec.json` compila los tests como CommonJS para Jest.

## Lo que no cubren

Los tests no usan una cámara ni MediaPipe reales. La precisión con personas reales (iluminación, ropa, ángulo de la
cámara) hay que comprobarla entrenando con la app.

# Plan de ejecución inmediato (P0)

Objetivo: dejar SoundPilot estable para operar en vivo con confianza, sin introducir features nuevas hasta cerrar los riesgos más importantes.

## Principio rector

La prioridad no es más IA ni más matching sofisticado. La prioridad es:

1. estabilizar la inicialización real del engine,
2. cerrar la trazabilidad de cada trigger,
3. separar la capa de reproducción del adaptador actual,
4. validar en browser y hardware real.

## Sprint 1 — Observabilidad y decisiones de trigger

### Objetivo

Hacer que cada trigger tenga una razón clara, latencia conocida y diagnóstico útil.

### Tareas

- Asegurar que cada paso del pipeline emite eventos estructurados:
  - transcripción recibida,
  - keyword match,
  - decisión accepted / pending / rejected,
  - playback completado.
- Completar la emisión de `TriggerDiagnosticEvent` para:
  - `stage`,
  - `reason`,
  - `cueId`,
  - `keyword`,
  - `latencyMs`,
  - `details`.
- Revisar la política de `debugLogging` para que siga siendo opt-in en producción.
- Añadir una vista simple de diagnóstico en LIVE para inspeccionar la última decisión.

### Criterio de aceptación

- El operador puede responder: “¿qué pasó, por qué y cuánto tardó?” para cada trigger.
- Los eventos de diagnóstico aparecen solo cuando `debugLogging` está activo.
- Los logs no interrumpen el flujo normal ni añaden riesgo operativo.

### Riesgos

- ocultar un problema real detrás de “detection result” sin contexto,
- sobrecargar la UI con ruido técnico,
- introducir logs que se conviertan en feature de producción sin control.

## Sprint 2 — Separar Audio Engine de la implementación browser

### Objetivo

Desacoplar la lógica de trigger del reproductor actual para no depender de `HTMLAudioElement` como fuente de verdad.

### Tareas

- Consolidar la interfaz `AudioEnginePort` como contrato de reproducción.
- Mover el comportamiento real de reproducción a un adaptador browser dedicado.
- Mantener `LiveSessionService` dependiente solo del contrato, no del adaptador concreto.
- Documentar qué eventos y errores se esperan del engine real.

### Criterio de aceptación

- La decisión de trigger ya no está acoplada al `AudioPlayerService` actual.
- El reproductor browser sigue funcionando como implementación por defecto.
- El código de LIVE no tiene conocimiento de `HTMLAudioElement` ni de la implementación concreta.

### Riesgos

- introducir una capa de abstracción innecesaria sin permitir un adaptador real,
- romper el flujo de playback al cambiar la implementación,
- mezclar estados de reproducción con lógica de sesión.

## Sprint 3 — Validación real en browser y hardware

### Objetivo

Probar el sistema con inputs reales y no solo con mocks y tests unitarios.

### Tareas

- Ejecutar preflight en un browser real con micrófono disponible.
- Validar permisos, dispositivos, sample rate y canales reales.
- Medir la continuidad de `SpeechRecognition` en flujo vivo.
- Registrar resultados de deduplicación y latencia de transcript/trigger.
- Probar con un conjunto mínimo de escenarios de radio: en vivo, cortes, reinicios, denegación.

### Criterio de aceptación

- La validación de hardware responde con datos reales y no con suposiciones.
- Se documenta qué navegadores y configuraciones son seguros.
- Se identifican escenarios bloqueantes antes de declarar “ready”.

### Riesgos

- falsa sensación de readiness con browser perfecto y hardware ideal,
- falla en navegadores no cubiertos por tests unitarios,
- reconocimiento intermitente que no se ve en mocked tests.

## Sprint 4 — Política de severidad y readiness

### Objetivo

Hacer que preflight y LIVE no digan “ready” cuando en realidad la sesión puede fallar.

### Tareas

- Definir severidad configurable para:
  - permisos,
  - dispositivos,
  - audio files,
  - triggers,
  - speech availability,
  - air mode.
- Unificar la política que distinga warning vs failure explícito.
- Evitar que `ready-with-warnings` se use como victoria engañosa.

### Criterio de aceptación

- El sistema puede bloquear air mode si hay riesgos reales.
- Preflight refleja con precisión el estado operativo de la sesión.
- El operador puede distinguir entre “usable” y “seguro para emitir”.

## Qué NO hacer ahora

- No añadir semantic matching ni LLM.
- No invertir en fuzzy matching como prioridad.
- No ampliar la UI con experiencias premium mientras el pipeline no sea estable.
- No declarar producción de radio hasta completar validación real y diagnóstico de triggers.

## Resultado esperado

Al terminar este bloque P0, SoundPilot debería tener una base operativa confiable para:

- escuchar sin romperse,
- detectar con trazabilidad,
- discriminar triggers con evidencia,
- jugar audio con una capa abstracta y verificable,
- operar en vivo con una política de riesgo clara.

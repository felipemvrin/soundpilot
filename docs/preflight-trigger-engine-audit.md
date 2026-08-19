# SoundPilot: Auditoria y plan de Fases 4 y 5

Fecha: 2026-08-19  
Branch: `audit/preflight-trigger-engine-ia`

## Veredicto

**NOT READY - REFACTOR REQUIRED** para una operacion de radio en vivo.

La base funcional es util y los flujos principales estan cubiertos por tests, pero Preflight no
era la fuente de verdad de Settings, Speech Recognition no tenia recuperacion continua,
`sensitivity` no afectaba al motor y el contrato `TriggerEvent` existia sin emitirse.

## Mapa real

```text
MediaDevices / Web Audio
  -> MicrophoneService
  -> SpeechRecognitionService -> TranscriptEvent
  -> CueEngineService -> CueEvent (matching y cooldown)
  -> TriggerEngineService -> DetectionResult (confidence y estado)
  -> LiveSessionService (decision y confirmacion)
  -> AudioPlayerService (HTMLAudioElement)
```

La fuente de cues es `CueRepository`, compartida por `LiveSessionService`, CUES y LIVE.
La fuente de configuracion es `SettingsService`, persistida en localStorage.

## Fase 4: Preflight

### Implementado

- Permisos de microfono con estados granted, denied y prompt.
- Enumeracion de input y output, timeouts y mensajes accionables.
- Validacion de cues, audio files, triggers, nombres, shortcuts, modos, confidence y cooldown.
- Deteccion de conflictos despues de normalizar acentos, puntuacion y espacios.
- Estado global ready, ready-with-warnings o attention-required.
- UI con progreso, acciones y deteccion de reporte outdated.

### Correcciones aplicadas

- Preflight consulta `SettingsService` como source of truth.
- Valida el input y output seleccionados, no solo cualquier dispositivo existente.
- Valida sample rate, canales e input mode implementado.
- Agrega el check explicito de capacidad de inicializacion del Trigger Engine.
- Mantiene los estados de imposibilidad de verificacion como warning o failure explicito.

### Deuda restante

- La validacion no abre permanentemente el microfono ni arranca Speech Recognition.
- La validacion de audio files comprueba acceso, no decodificacion completa.
- Falta invalidar automaticamente el reporte al cambiar Settings o permisos.
- Falta una politica de severidad configurable para permitir o impedir Air Mode.

## Fase 5: Trigger Engine

### Implementado

- Matching exacto con word boundaries.
- Normalizacion de Unicode, acentos, casing, puntuacion y whitespace.
- Frases y multiples keywords por cue.
- Cooldown por cue.
- Cues deshabilitados no generan detecciones.
- Confidence por cue y confirmacion humana para casos medios.
- Historial de sesion limitado a 40 eventos.

### Correcciones aplicadas

- `TriggerEvent` ahora incluye decision, razon, confidence de reconocimiento y source.
- Las decisiones accepted, pending y rejected se emiten por `TriggerEngineService`.
- Speech Recognition intenta recuperarse despues de un `onend` inesperado.
- Errores de permiso detienen el reinicio automatico.
- Resultados finales identicos en una ventana breve se deduplican.
- Confidence ausente ya no autoriza reproduccion automatica.
- Un rechazo por confidence no consume cooldown.

### Deuda restante

- `matchConfidence` todavia no existe como calculo independiente: el matching actual es exacto.
- `sensitivity` necesita una definicion de producto antes de conectarse; no debe alterar el matching
  de forma arbitraria.
- Falta una politica entre cues con keywords solapadas y prioridades distintas.
- Falta mover la reproduccion detras de una interfaz de Audio Engine en Fase 6.
- Falta logging tecnico configurable con latencias y razones estructuradas.

## IA

No existe un modelo propio, LLM, embedding ni clasificador. Web Speech API aporta reconocimiento
de voz y una confidence del proveedor del navegador. El resto es determinista: normalizacion,
regex, thresholds, cooldown y confirmacion.

Para el MVP no se recomienda anadir LLM o semantic matching. La prioridad debe ser baja latencia,
predictibilidad y funcionamiento offline cuando sea posible. Fuzzy matching puede evaluarse como
fallback opt-in despues de medir falsos positivos y falsos negativos.

## Matriz de madurez

| Area                | Estado            | Riesgo                         | Prioridad |
| ------------------- | ----------------- | ------------------------------ | --------- |
| Preflight           | NEEDS IMPROVEMENT | Falso READY                    | P0        |
| Device validation   | NEEDS IMPROVEMENT | Dispositivo incorrecto         | P0        |
| Permissions         | NEEDS IMPROVEMENT | Estado desactualizado          | P1        |
| Cue validation      | READY             | Reglas manuales por precisar   | P1        |
| Trigger Engine      | TECHNICAL DEBT    | Responsabilidades distribuidas | P0        |
| Speech Recognition  | TECHNICAL DEBT    | Se detiene en vivo             | P0        |
| Keyword Matching    | READY             | Solapamientos                  | P1        |
| Confidence          | NEEDS IMPROVEMENT | Valores invalidos              | P0        |
| Sensitivity         | TECHNICAL DEBT    | Configuracion sin efecto       | P1        |
| Duplicate Detection | NEEDS IMPROVEMENT | Interim/final                  | P0        |
| Event Contract      | NEEDS IMPROVEMENT | Consumidor futuro inexistente  | P0        |
| Observability       | TECHNICAL DEBT    | Diagnostico limitado           | P1        |

## Plan posterior

### P0

1. Completar invalidacion reactiva de Preflight ante Settings, devices y permisos.
2. Cubrir la inicializacion real del engine con pruebas de browser y hardware simulado.
3. Terminar deduplicacion basada en resultados Speech Recognition, no solo texto final.
4. Publicar el contrato de eventos como puerto para Audio Engine.

### P1

1. Definir semantica de sensitivity o eliminarla de Settings.
2. Definir especificidad y prioridad para multiples matches.
3. Registrar razones de rechazo y latencia de cada etapa.
4. Diferenciar cues manuales sin audio de cues automaticos.

### P2/P3

- Readiness summary sin porcentaje enganoso.
- Matching fuzzy opt-in.
- Reconocimiento offline.
- OSC, MIDI y semantic matching despues de estabilizar Audio Engine.

## Validacion posterior al refactor

- `npm test`: 80 tests passed en 12 archivos.
- `npm run lint`: passed.
- `npm run build`: passed, incluyendo compilacion y type checking.

Persisten warnings no bloqueantes de Angular sobre `allowSignalWrites` deprecado en tests de
Settings/LIVE. No son introducidos por este cambio y no afectan la compilacion.

El branch queda preparado para continuar con el diseño del puerto de Audio Engine, pero no para
declarar produccion de radio hasta completar la invalidacion reactiva de Preflight y las pruebas
de hardware/browser indicadas en P0.

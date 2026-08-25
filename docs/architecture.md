# SoundPilot Architecture

Quick orientation for codebase questions. This is a map, not a second implementation source.

## Runtime flow

```text
MicrophoneService
  -> SpeechRecognitionService
  -> LiveSessionService.processTranscript()
  -> CueEngineService (normalize, match, cooldown)
  -> TriggerEngineService (confidence, decision, state)
  -> AudioEnginePort
  -> LIVE diagnostics and session history
```

## Ownership map

| Area              | Owner                      | Main files                                          | Responsibility                                                                                   |
| ----------------- | -------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Application shell | Angular root and router    | `src/app/app.ts`, `src/app/app.routes.ts`           | Header, route composition and page loading                                                       |
| LIVE session      | `LiveSessionService`       | `src/app/core/services/live-session.service.ts`     | Single source of truth for listening, detection, confirmation, playback state and session events |
| Microphone        | `MicrophoneService`        | `src/app/core/audio/microphone.service.ts`          | Permission, stream lifecycle, level and frequency bands                                          |
| Speech            | `SpeechRecognitionService` | `src/app/core/speech/speech-recognition.service.ts` | Browser Speech Recognition adapter, transcript events and recovery                               |
| Cue matching      | `CueEngineService`         | `src/app/core/services/cue-engine.service.ts`       | Normalized exact matching, winner selection and cooldown bookkeeping                             |
| Trigger decisions | `TriggerEngineService`     | `src/app/core/services/trigger-engine.service.ts`   | Confidence evaluation, decision diagnostics and derived trigger state                            |
| Preflight         | `PreflightService`         | `src/app/core/services/preflight.service.ts`        | Permissions, devices, audio configuration, engine, cue and trigger checks                        |
| Audio boundary    | `AudioEnginePort`          | `src/app/core/audio/audio-engine.port.ts`           | Playback contract consumed by session logic; browser adapter remains replaceable                 |
| Playback adapter  | `AudioPlayerService`       | `src/app/core/audio/audio-player.service.ts`        | Current browser `HTMLAudioElement` playback and fade transitions                                 |
| Cue persistence   | `CueRepository`            | `src/app/core/services/cue-repository.service.ts`   | LocalStorage persistence and cue loading                                                         |
| Configuration     | `SettingsService`          | `src/app/core/services/settings.service.ts`         | Settings, devices, permissions and operational preferences                                       |
| UI pages          | Feature components         | `src/app/features/`                                 | LIVE, CUES and SETTINGS presentation and user actions                                            |
| Shared UI         | Shared components          | `src/app/shared/components/`                        | Reusable status, cue, meter, event and header components                                         |

## Data contracts

- `Cue` is the persisted unit containing triggers, audio, mode, confidence, cooldown and shortcut.
- `TranscriptEvent` carries accumulated transcript text and the incremental segment used for matching.
- `CueEvent` represents a normalized keyword match from `CueEngineService`.
- `DetectionResult` represents confidence and permission to proceed from `TriggerEngineService`.
- `TriggerEvent` and `TriggerDiagnosticEvent` expose decisions, reasons, latency and source metadata.
- `AudioEnginePort` isolates session decisions from the browser playback implementation.

## State boundaries

- Components call `LiveSessionService`; they should not implement matching, cooldown or playback policy.
- `CueEngineService` owns matching and cooldown, not confidence or UI state.
- `TriggerEngineService` owns confidence evaluation and state derivation, not microphone or audio playback.
- `PreflightService` checks readiness but does not start a permanent live session.
- `AudioPlayerService` implements playback; `AudioEnginePort` is the dependency boundary.

## Safe change routing

- Visual-only change: `src/styles.scss`, feature SCSS, shared component styles or templates.
- Matching behavior: `CueEngineService` plus focused tests.
- Confidence or trigger state: `TriggerEngineService` plus focused tests.
- Listening or transcript lifecycle: microphone/speech services plus focused tests.
- Readiness behavior: `PreflightService`, settings and preflight tests.
- Playback behavior: `AudioPlayerService` and `AudioEnginePort` tests.
- Public behavior, architecture or limitations: update `README.md` and `docs/project-status.md`.

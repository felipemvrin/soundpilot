# SoundPilot

AI-powered real-time audio cue assistant for live podcasts, radio and TV production.

## Concept

SoundPilot focuses on one reliable flow:

**Listen -> Detect -> Match -> Trigger -> Play**

```text
Host:       "Y mi esposa..."
SoundPilot: Detects "esposa"
Cue:        wife-laugh.mp3
Action:     PLAY
```

It is not a DAW, mixer, chatbot, or generative AI system.

## Features

- Browser microphone capture with audio activity meter
- Browser-native `SpeechRecognition` / `webkitSpeechRecognition` adapter
- Configurable exact-word and phrase triggers
- Case, punctuation, whitespace and accent normalization
- Automatic, confirm and manual cue modes
- Per-cue cooldown and duplicate suppression
- Local audio-file selection (MP3, WAV, OGG and M4A)
- `localStorage` cue persistence, transcript display and event history
- Browser audio playback with independent cue volume and simultaneous players

## Tech Stack

- Angular 20, TypeScript strict, RxJS, SCSS and CSS variables
- Angular Material/CDK installed for the evolving operator UI
- Web Audio API, MediaDevices API and HTMLAudioElement
- Vitest, ESLint, Prettier, Husky/lint-staged and Storybook

## Installation

Requires Node `20.20.2` (see `.nvmrc`) and npm `10.8.2` or compatible.

```sh
npm install
npm start
```

Open `http://localhost:4200`. Microphone and speech recognition require a secure browser context (`localhost` is supported) and browser permission.

On macOS Monterey, the project limits Angular builder workers to one through its npm scripts. This avoids a native `esbuild` concurrency abort observed on this platform.

## Development

```sh
npm test
npm run test:watch
npm run lint
npm run format:check
npm run storybook
npm run build
```

## Architecture

```text
Microphone -> SpeechRecognitionService -> Transcript$
                                      -> CueEngineService -> CueDetected$
                                      -> AudioPlayerService -> CuePlayed$
```

`TextNormalizerService` keeps normalization independent. `CueEngineService` receives transcript events and configured cues without knowing the speech provider or audio implementation. `CueRepository` currently uses `localStorage` and can later move to IndexedDB or a backend.

## Trigger Engine

The Trigger Engine is the pipeline that turns live speech into a fired cue. It is split across three
decoupled services so the UI never talks to matching/confidence logic directly:

```text
Audio Input (MicrophoneService)
  -> Speech Recognition (SpeechRecognitionService) -> TranscriptEvent
  -> Keyword Matching + Cooldown (CueEngineService) -> Match (CueEvent)
  -> Confidence Evaluation (TriggerEngineService)   -> DetectionResult
  -> Trigger Validation + Routing (LiveSessionService.processTranscript)
  -> Cue Trigger (AudioPlayerService.play)
  -> Feedback (SessionEvent activity log + LIVE view)
```

- **A `Trigger` is a `Cue`.** `src/app/core/models/trigger.model.ts` defines `Trigger`, `Keyword` and
  `Match` as aliases over the existing `Cue`/`CueTrigger`/`CueEvent` models instead of duplicating
  storage or validation. `DetectionResult` is the Trigger Engine's own output shape (`match`,
  `confidence`, `level`, `allowed`).
- **Keyword matching + cooldown** stay in `CueEngineService`: word-boundary matching against the
  normalized transcript, longest-trigger-first, and per-cue cooldown enforcement
  (`cooldownMs`, tracked per `cue.id`).
- **Confidence evaluation** lives in `TriggerEngineService.evaluateConfidence()`: classifies a match
  as `high` / `medium` / `low` / `unknown` against the cue's `confidenceThreshold` (falls back to
  `DEFAULT_CONFIDENCE_THRESHOLD = 0.9`; anything below `MIN_CONFIDENCE = 0.7` is `low`), and marks it
  `allowed` unless it's a low-confidence automatic trigger.
- **State derivation** lives in `TriggerEngineService.deriveState()`, a pure function that turns a
  snapshot of session signals into one `TriggerState`.

### Trigger Engine states

`idle -> initializing -> listening -> detecting -> matched -> triggering -> cooldown -> listening`
(`paused` when explicitly stopped after preflight, `error` overrides everything else).

| State          | Meaning                                                             | Shown in                                     |
| -------------- | ------------------------------------------------------------------- | -------------------------------------------- |
| `idle`         | Never started listening this session                                | LIVE header, System Status                   |
| `initializing` | Waiting on microphone/speech APIs                                   | LIVE header                                  |
| `listening`    | Actively listening for triggers                                     | LIVE LISTENING panel                         |
| `detecting`    | Interim speech is arriving                                          | Current Detection badge                      |
| `matched`      | A keyword just matched (MATCH DETECTED) or is awaiting confirmation | Current Detection panel (flash)              |
| `triggering`   | The matched cue is playing                                          | Current Detection / Playback panels          |
| `cooldown`     | At least one cue is still cooling down                              | Current Detection badge, Armed Triggers chip |
| `paused`       | Preflight approved but listening stopped                            | LIVE header                                  |
| `error`        | Microphone/speech/playback failure                                  | Error banner, System Status                  |

`LiveSessionService.triggerState` (a computed signal) derives this from existing signals
(`isListening`, `hasPendingConfirmations`, `nowPlaying`, a short-lived `detectionActive` window, and
a `cooldownActive` map) — no extra timers, it rides the session's existing 500ms clock tick.

### Confidence and cooldown

- Threshold is per-cue (`Cue.confidenceThreshold`, editable in CUES), so different triggers can
  require different certainty before firing automatically.
- `LiveSessionService.cooldownRemainingMs(cueId)` exposes the live countdown (in ms) used by the
  ARMED TRIGGERS chip; it mirrors the cooldown window `CueEngineService` already enforces
  internally, it does not add a second cooldown mechanism.

### Adding a new trigger

Add or edit a cue in **CUES**: give it a name, one or more keyword variations (`triggers`), an audio
file, a mode (`automatic` / `confirm` / `manual`), a confidence threshold and a cooldown. No code
changes are required — the Trigger Engine reads the live cue list on every transcript.

### Changing the speech recognition provider

Swap the implementation behind `SpeechRecognitionService` (it only needs to emit `TranscriptEvent`s
on `transcript$` and expose `available`/`isRecognizing`/`start`/`stop`). Nothing downstream
(`CueEngineService`, `TriggerEngineService`, `LiveSessionService`) depends on the Web Speech API
directly.

### Extending matching later

The `Keyword`/`Match` vocabulary is intentionally minimal today (exact word-boundary matching per
keyword). It is designed so fuzzy matching, stemming or semantic/NLP matching can be added inside
`CueEngineService`/`TriggerEngineService` later without changing the `Cue` storage model or the LIVE
UI contract (`DetectionResult`).

## Environment

Copy `.env.example` only when future integrations require configuration. No API keys or external AI services are used by the MVP.

## Roadmap

1. MVP Cue Engine
2. Better Speech-to-Text
3. Offline speech recognition
4. Improved phrase/context matching
5. AI semantic matching
6. Sound library
7. MIDI integration
8. OSC integration
9. Professional broadcast integrations
10. Multi-channel audio

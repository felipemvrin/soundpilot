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

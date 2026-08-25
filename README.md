# SoundPilot

SoundPilot is a browser-based real-time audio cue assistant for live podcasts, radio and TV production. It listens for configured words or phrases, evaluates the match, and plays the corresponding cue.

**Current status:** stabilization and validation stage. The browser MVP and core P0 work are implemented, but the project is not production-ready for live radio until real browser and hardware validation is documented.

The canonical status is maintained in [docs/project-status.md](docs/project-status.md). The original execution objectives remain in [docs/p0-execution-plan.md](docs/p0-execution-plan.md).

For a compact code map, see [docs/architecture.md](docs/architecture.md). For real browser and hardware evidence, see [docs/browser-validation.md](docs/browser-validation.md).

## Core flow

```text
Listen -> Detect -> Match -> Validate -> Trigger -> Play
```

SoundPilot is not a DAW, mixer, chatbot or generative AI system. Recognition is provided by the browser's Speech Recognition API; matching and routing are deterministic.

## Implemented features

- Browser microphone capture with live input-level visualization.
- Browser-native `SpeechRecognition` / `webkitSpeechRecognition` adapter with recovery after unexpected end.
- Exact word and phrase triggers with accent, punctuation, casing and whitespace normalization.
- Automatic, confirmation and manual cue modes.
- Per-cue confidence thresholds, cooldowns, duplicate suppression and stable winner selection.
- Local MP3, WAV, OGG and M4A cue selection with LocalStorage persistence.
- Controlled audio fade transitions and playback status in LIVE.
- Preflight checks for permissions, devices, audio configuration, speech availability, engine startup and cue configuration.
- Structured trigger decisions and operator diagnostics in LIVE.
- Keyboard operation: `SPACE`, `ENTER`, `ESC`, `P`, `M`, `S`, `R` and `F1-F9`.

## Current limitations

- Real browser and hardware validation is still pending.
- Preflight severity policy for blocking Air Mode is not yet configurable.
- `sensitivity` does not yet have finalized product semantics.
- Matching is deterministic exact matching; fuzzy, semantic and LLM matching are intentionally out of scope for the current stabilization stage.
- The current playback implementation remains a browser adapter behind `AudioEnginePort`; the target real Audio Engine is not yet defined.
- The premium broadcast UI redesign is a separate workstream and requires visual QA before being considered complete.

See [docs/project-status.md](docs/project-status.md) for the complete phase matrix and release gate.

## Requirements

- Node `20.20.2`, specified in `.nvmrc`.
- npm `10.8.2` or a compatible version.
- A browser that supports microphone access and Speech Recognition. Use `localhost` or HTTPS.

## Installation

```sh
npm install
npm start
```

Open the URL printed by Angular, usually `http://localhost:4200`. Grant microphone permission before running Preflight or entering Air Mode.

On macOS, the npm scripts limit Angular builder workers to one to avoid the native esbuild concurrency issue observed on this project.

## Development commands

```sh
npm test
npm run test:watch
npm run lint
npm run format:check
npm run build
npm run storybook
```

Before declaring a change ready, run tests, lint and build. LIVE/audio/speech changes also require browser validation; UI changes require desktop, tablet and mobile review.

## Application areas

- **LIVE:** microphone monitoring, transcript, current detection, diagnostics, playback actions, Air Mode and armed triggers.
- **CUES:** create and edit cue names, trigger phrases, audio files, modes, confidence thresholds, cooldowns and shortcuts.
- **SETTINGS:** configure microphone, output, speech, playback and operational preferences.
- **Preflight:** verify the environment and cue configuration before Air Mode.

## Architecture

```text
MicrophoneService
  -> SpeechRecognitionService -> TranscriptEvent
  -> CueEngineService -> CueEvent (matching and cooldown)
  -> TriggerEngineService -> DetectionResult (confidence and state)
  -> LiveSessionService (decision, confirmation and routing)
  -> AudioEnginePort -> browser audio adapter
  -> LIVE diagnostics and session history
```

`CueRepository` persists cues in LocalStorage. `TextNormalizerService` is independent of the speech provider. `LiveSessionService` is the single session source of truth shared by LIVE, CUES and SETTINGS.

## Trigger states

```text
idle -> initializing -> listening -> detecting -> matched -> triggering -> cooldown -> listening
```

`paused` represents an approved preflight with listening stopped. `error` overrides other states. The LIVE view exposes these states together with the decision reason, cue, keyword and available latency information.

## Project phases

1. MVP cue engine: complete.
2. P0 observability and trigger decisions: complete.
3. P0 AudioEnginePort boundary: complete.
4. Browser and real hardware validation: pending.
5. Configurable readiness and severity policy: pending.
6. Real Audio Engine definition and integration: pending.
7. UI redesign visual QA and completion: needs review.

Do not declare production readiness until the release gate in [docs/project-status.md](docs/project-status.md) is satisfied.

## Pull requests and documentation

Every pull request that changes source code, dependencies, build configuration, operational behavior or UI must:

- Review [docs/project-status.md](docs/project-status.md).
- Update the status, README or explain why no status changed.
- Add a dated entry to [docs/changelog.md](docs/changelog.md).
- Include current validation results and risks in the pull request description.

The repository includes a pull request template and the `project-status` Copilot skill at [.github/skills/project-status/SKILL.md](.github/skills/project-status/SKILL.md).

## Roadmap

- Validate supported browser and hardware combinations.
- Define readiness severity and Air Mode blocking rules.
- Finalize sensitivity and match-confidence semantics.
- Complete technical observability and latency review.
- Define the real Audio Engine target.
- Consider offline recognition, fuzzy matching, MIDI, OSC and semantic matching only after operational stability is proven.

## License

See [NOTICE.md](NOTICE.md) for dependency licensing notes.

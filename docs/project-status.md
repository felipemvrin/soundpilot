# SoundPilot Project Status

Last reviewed: 2026-09-04  
Reviewed branch: `main`  
Reviewed commit: `a2f46f2` (`docs: actualizar STATUS.md automáticamente`)

## Current Position

SoundPilot is in the stabilization and validation stage after the main P0 work. The core browser MVP is functional and the recent work has added operator diagnostics and the `AudioEnginePort` abstraction. The project is **not production-ready for live radio** until real browser and hardware validation is documented.

The UI redesign is a separate workstream. It must not be treated as completed based on this branch unless its pull request is merged here and its visual QA evidence is recorded.

For fast codebase orientation, see [architecture.md](architecture.md). Real browser and device evidence belongs in [browser-validation.md](browser-validation.md).

## Phase Matrix

| Phase               | Scope                                                        | Status       | Evidence or next step                                                      |
| ------------------- | ------------------------------------------------------------ | ------------ | -------------------------------------------------------------------------- |
| MVP cue engine      | Cue persistence, exact matching, cooldown and playback       | DONE         | Current services and unit tests                                            |
| P0 Sprint 1         | Diagnostics, decisions and trigger traceability              | DONE         | `TriggerDiagnosticEvent`, LIVE diagnostics and current tests               |
| P0 Sprint 2         | `AudioEnginePort` boundary and browser adapter compatibility | DONE         | `src/app/core/audio/audio-engine.port.ts` and PR #12                       |
| P0 Sprint 3         | Browser and real hardware validation                         | PENDING      | Record scenarios in `docs/browser-validation.md`                           |
| P0 Sprint 4         | Configurable severity and readiness policy                   | PENDING      | Define when warnings block Air Mode                                        |
| P1 sensitivity      | Product definition and implementation of `sensitivity`       | PENDING      | Decide semantics before changing matching                                  |
| P1 match confidence | Independent confidence calculation                           | PENDING      | Current matching is deterministic exact matching                           |
| P1 observability    | Structured technical logging and latency review              | IN PROGRESS  | Diagnostic events exist; review production logging policy                  |
| Fase 6 Audio Engine | Replace or extend the browser adapter with the real engine   | PENDING      | Define the target runtime and adapter contract                             |
| UI redesign         | Premium broadcast control-surface visual treatment           | NEEDS REVIEW | Review the dedicated branch/PR with desktop, tablet and mobile screenshots |

## Implemented Behavior

- Browser microphone capture with an audio activity meter.
- Browser-native Speech Recognition adapter with recovery after unexpected end.
- Accumulated transcript handling with incremental matching text.
- Unicode, accent, punctuation, casing and whitespace normalization.
- Exact word and phrase matching, longest-match selection, priority tie-breaker and stable cue ID tie-breaker.
- Automatic, confirmation and manual cue modes.
- Confidence thresholds, low-confidence rejection and confirmation flow.
- Per-cue cooldown and duplicate suppression.
- One active playback with controlled fade transitions.
- Preflight checks for permissions, devices, audio configuration, speech availability, engine startup, cues and trigger configuration.
- Structured trigger decisions and diagnostic activity in LIVE.
- LocalStorage persistence for cues and session state.

## Remaining Work

1. Validate microphone, speech recognition, output routing, permissions and Air Mode in real browsers and hardware.
2. Record supported browser and device combinations, including failure and recovery scenarios.
3. Define configurable warning versus blocking severity for Preflight and Air Mode.
4. Decide whether `sensitivity` is meaningful; remove it or implement it with tests.
5. Define independent match-confidence semantics before adding fuzzy or semantic matching.
6. Finish technical logging review without making debug logging noisy in production.
7. Define the real Audio Engine target before replacing the browser adapter.
8. Review the UI redesign separately for visual fidelity, accessibility, responsive behavior and performance.

## Release Gate

Do not declare production readiness until all of the following are documented:

- `npm test` passes.
- `npm run lint` passes.
- `npm run build` passes.
- Browser permission, microphone, speech, output and playback scenarios pass on supported hardware.
- Air Mode behavior is defined for warnings and failures.
- Trigger decisions include an inspectable reason and latency evidence.
- The README and this status file match the current implementation.

## Documentation Rule

For every pull request that changes `src/`, dependencies, build configuration, operational behavior or UI:

- Review this file and update the phase matrix or explain why no status changed.
- Update `README.md` when public usage, architecture or limitations change.
- Add a dated entry to `docs/changelog.md`.
- Include current validation commands and results in the pull request description.

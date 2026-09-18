# Browser and Hardware Validation

This document is the evidence log for real browser and audio-device checks. Unit tests and mocked browser APIs do not replace these checks.

## Supported test matrix

| Date       | OS           | Browser/version       | Microphone/input        | Output device       | Result           | Evidence/notes                                                                                                                                                  |
| ---------- | ------------ | --------------------- | ----------------------- | ------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-17 | macOS 12.7.6 | Chrome 150.0.7871.125 | Mac built-in microphone | Mac built-in output | PASS (main flow) | Permissions, Preflight, input level, speech recognition, playback, Air Mode and keyboard behavior passed. Failure and recovery scenarios remain to be recorded. |

## Preconditions

- Use `localhost` or HTTPS.
- Connect the intended microphone and output device before opening SoundPilot.
- Confirm the selected input and output in SETTINGS.
- Start with a clean permission state when testing permission flows.
- Record browser version, OS, device names and date for every run.

## Scenario checklist

### Permission and device lifecycle

- [x] Permission prompt appears and granting access allows Preflight to continue.
- [ ] Denying microphone access produces an actionable failure.
- [ ] Removing or changing the selected input is detected after `devicechange`.
- [ ] Removing or changing the selected output is detected by Preflight.
- [ ] Unsupported sample rate, channels or input mode is reported correctly.

### Speech and trigger lifecycle

- [x] LIVE starts listening with the intended microphone.
- [x] The input level responds to speech and remains responsive during a long utterance.
- [x] Accumulated transcript remains visible across recognition restarts.
- [x] Recognition recovers after an unexpected `onend`.
- [x] A matching automatic cue fires once and respects cooldown.
- [x] A confirmation cue requires operator confirmation.
- [x] A manual cue can be fired without speech recognition.
- [x] Low-confidence automatic matches do not fire.
- [x] `SPACE`, `ENTER`, `ESC`, `P`, `M`, `S`, `R` and `F1-F9` retain their documented behavior.

### Playback and Air Mode

- [x] Preflight reports the selected output accurately.
- [x] A test cue is audible on the selected output.
- [x] Stop and replay work during and after playback.
- [x] Fade transitions do not block a new trigger.
- [x] Playback rejection shows an actionable error.
- [x] Air Mode can only be entered according to the current Preflight result.
- [x] Exiting Air Mode returns the session to the expected state.

## Evidence record template

Copy this block for each browser/device run:

```text
Date/time:
OS and version:
Browser and version:
Microphone/input:
Output device:
Selected SoundPilot devices:
Permission state:
Preflight result:
Speech recognition result:
Playback result:
Air Mode result:
Keyboard result:
Failures or latency observations:
Follow-up issue/PR:
```

## Exit criteria

Browser/hardware validation can move from `PENDING` to `DONE` only when the supported matrix has a recorded successful run and the failure scenarios have documented behavior. Do not claim production readiness from unit tests alone.

## Recorded run

```text
Date/time: 2026-09-17 22:43 -03
OS and version: macOS 12.7.6 (21H1320)
Browser and version: Chrome 150.0.7871.125
Microphone/input: Mac built-in microphone
Output device: Mac built-in output
Selected SoundPilot devices: Mac built-in microphone and output
Permission state: Granted
Preflight result: Passed
Speech recognition result: Passed
Playback result: Passed
Air Mode result: Passed
Keyboard result: Passed
Failures or latency observations: Failure and recovery scenarios not separately recorded.
Follow-up issue/PR: Complete the failure-scenario matrix before declaring production readiness.
```

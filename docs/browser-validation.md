# Browser and Hardware Validation

This document is the evidence log for real browser and audio-device checks. Unit tests and mocked browser APIs do not replace these checks.

## Supported test matrix

| Date      | OS        | Browser/version | Microphone/input | Output device | Result  | Evidence/notes          |
| --------- | --------- | --------------- | ---------------- | ------------- | ------- | ----------------------- |
| _pending_ | _pending_ | _pending_       | _pending_        | _pending_     | PENDING | Run the scenarios below |

## Preconditions

- Use `localhost` or HTTPS.
- Connect the intended microphone and output device before opening SoundPilot.
- Confirm the selected input and output in SETTINGS.
- Start with a clean permission state when testing permission flows.
- Record browser version, OS, device names and date for every run.

## Scenario checklist

### Permission and device lifecycle

- [ ] Permission prompt appears and granting access allows Preflight to continue.
- [ ] Denying microphone access produces an actionable failure.
- [ ] Removing or changing the selected input is detected after `devicechange`.
- [ ] Removing or changing the selected output is detected by Preflight.
- [ ] Unsupported sample rate, channels or input mode is reported correctly.

### Speech and trigger lifecycle

- [ ] LIVE starts listening with the intended microphone.
- [ ] The input level responds to speech and remains responsive during a long utterance.
- [ ] Accumulated transcript remains visible across recognition restarts.
- [ ] Recognition recovers after an unexpected `onend`.
- [ ] A matching automatic cue fires once and respects cooldown.
- [ ] A confirmation cue requires operator confirmation.
- [ ] A manual cue can be fired without speech recognition.
- [ ] Low-confidence automatic matches do not fire.
- [ ] `SPACE`, `ENTER`, `ESC`, `P`, `M`, `S`, `R` and `F1-F9` retain their documented behavior.

### Playback and Air Mode

- [ ] Preflight reports the selected output accurately.
- [ ] A test cue is audible on the selected output.
- [ ] Stop and replay work during and after playback.
- [ ] Fade transitions do not block a new trigger.
- [ ] Playback rejection shows an actionable error.
- [ ] Air Mode can only be entered according to the current Preflight result.
- [ ] Exiting Air Mode returns the session to the expected state.

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

---
name: project-status
description: "Use when reviewing SoundPilot's current phase, technical debt, pending work, release readiness, or documentation updates for a pull request."
---

# SoundPilot Project Status

Use this workflow when a change may affect the project's phase, readiness, architecture, user workflow, or known risks.

## Source of truth

- `docs/project-status.md` is the canonical status record.
- `README.md` is the user-facing project overview and must summarize the canonical status.
- `docs/changelog.md` records meaningful changes merged through pull requests.
- `docs/p0-execution-plan.md` contains the original P0 objectives and acceptance criteria.
- `docs/preflight-trigger-engine-audit.md` contains historical audit context; do not treat old branch names or old test counts as current facts.

## Required workflow

1. Read `docs/project-status.md` and the relevant implementation files.
2. Inspect the current branch and recent merge history.
3. Map the change to the phase matrix in `docs/project-status.md`.
4. Run the narrowest relevant checks, then run `npm test`, `npm run lint`, and `npm run build` for cross-cutting changes.
5. Update the phase, completed work, pending work, risks, validation evidence, and last reviewed commit.
6. Update `README.md` when installation, architecture, supported behavior, limitations, or roadmap changes.
7. Add a dated entry to `docs/changelog.md` for every merged pull request that changes behavior, architecture, UI, validation, or project status.
8. Confirm that no item is marked complete without implementation or test evidence.

## Pull request rule

Every pull request must state whether project-status documentation was reviewed. A PR that changes `src/`, build configuration, dependencies, or operational behavior must update at least one of:

- `docs/project-status.md`
- `README.md`
- `docs/changelog.md`

If none require changes, explain why in the PR description.

## Status vocabulary

Use only these values in the phase matrix:

- `DONE`: implemented and covered by current validation evidence.
- `IN PROGRESS`: partially implemented or actively being changed.
- `PENDING`: planned but not implemented.
- `BLOCKED`: cannot be validated or completed because an external dependency is missing.
- `NEEDS REVIEW`: implementation exists but lacks adequate current evidence.

Do not claim production readiness until browser and real hardware validation are documented.

# Phase 1: Verified Transaction Foundation - Context

**Gathered:** 2026-08-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish one guarded transaction path for destructive archive and restore work. The path captures a single source, rejects invalid or concurrent mutations, never changes source identity mid-operation, and publishes archive results only after byte comparison and successful OP-Z parsing. Archive shelf design, complete bundle manifests, restore execution, split projects, and automatic clearing remain in later phases.

</domain>

<decisions>
## Implementation Decisions

### Transaction Lifecycle
- Permit one destructive mutation globally at a time; reject competing requests rather than queueing them.
- Capture source bytes once at operation start and reuse that snapshot throughout the transaction.
- Bind the transaction to the source kind, resolved source root, and captured project identity.
- If a mounted OP-Z disappears or changes, stop immediately, preserve existing data, and never fall back to `opzdisk/`.

### Archive Verification
- Show unverified drafts only as unmistakably unverified items, separate from verified archives and unavailable for restore.
- Write drafts under the library root as hidden partial directories, then publish them by atomic rename only after verification.
- Record SHA-256 and byte length; exact byte comparison and successful OP-Z parsing remain mandatory verification checks.
- Retain a labelled failed copy for diagnosis, segregated from the shelf and unavailable for restore; leave the source slot untouched.

### Status, Guidance, and Errors
- Keep a persistent mounted-OP-Z/local-fixture badge and repeat the active source in destructive confirmations.
- Confirm the operation, source, slot, current song, and whether device data may change.
- Disable mutation controls while work runs, show the current operation, and reject competing requests.
- Give an explicit result plus the relevant eject, reconnect, refresh, or recovery instructions after completion or failure.

### the agent's Discretion
- Exact hidden-partial and failed-draft naming, retention metadata, and cleanup mechanics may follow the smallest safe filesystem design.
- Exact UI wording and placement may reuse the existing source badge, confirmation dialogs, and toast patterns while meeting the accepted visibility requirements.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getSource()`, `findDeviceRoot()`, and `projFile()` already locate mounted OP-Z and local fixture projects.
- `parseProject()` already rejects malformed or undersized `.opz` data and can serve as the required parse check.
- `safeName()`, `stamp()`, `readBody()`, and the existing crypto import provide basic naming, request parsing, and hashing building blocks.
- The browser already has a persistent source badge, a shared `api()` error path, confirmation dialogs, and toast feedback.

### Established Patterns
- The dependency-free Node server performs synchronous filesystem work inside route handlers and returns plain JSON.
- Project metadata is keyed by a short MD5 content identifier for existing UI behavior; verification evidence needs full SHA-256 without replacing that compatibility key.
- Library items are bundle directories containing `song.opz` and `info.json`.
- Expected filesystem and parse failures become JSON errors and user-facing toasts.

### Integration Points
- Guard all destructive routes through one shared transaction boundary rather than adding route-specific locks.
- Replace repeated `getSource()` calls during a mutation with a captured source transaction object.
- Route `/api/backup` through staged write, reread, byte comparison, parse, evidence recording, and atomic publication.
- Extend `/api/state` and the existing source/status UI with mutation and unverified-draft state as needed.

</code_context>

<specifics>
## Specific Ideas

- The user has mounted the OP-Z and wants live UAT as phases complete.
- Use mounted hardware for safe live checks; require an explicit checkpoint before any UAT step that could alter device data.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

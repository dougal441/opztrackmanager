# Phase 3: Guarded Restore & Instrument Recovery - Context

**Gathered:** 2026-08-26
**Status:** Ready for planning
**Mode:** Autonomous recommendations accepted by prior user instruction

<domain>
## Phase Boundary

Restore a freshly revalidated archive to an explicitly chosen project slot only after preserving that slot in a verified automatic recovery archive. Whole-grid instrument restoration is a separate explicit operation with its own verified recovery snapshot. This phase also restores the existing swap and instrument-management actions only where they can share the same guarded recovery transaction. Automatic slot clearing remains Phase 6.

</domain>

<decisions>
## Implementation Decisions

### Explicit Restore Intent
- **D-01:** Begin with no target selected. Before confirmation, show the chosen slot, current song name, source kind, project identity, and current pattern matrix.
- **D-02:** Bind confirmation to that exact target fingerprint. If the source, slot bytes, or archive changes before the transaction starts, stop without a backup or write. Represent source identity and archive revision with bounded opaque digests; never expose canonical paths or raw device/inode values.
- **D-03:** Offer project restore only for a freshly classified archive whose stored project bytes, manifest evidence, and parser result still agree.
- **D-04:** Project restore is always the default. Never infer or silently include instrument files.

### Guarded Project Transaction
- **D-05:** Reuse the existing global mutation guard, captured source identity, immutable byte buffer, archive classifier, and verified archive publisher.
- **D-06:** Lock the sequence: validate request; acquire the mutation guard; resolve one source; capture the target; pin freshly revalidated archive bytes; publish a verified automatic backup; recheck source, target, and archive; replace only the chosen project; reread, exact-byte-compare, hash/length-check, and parse the written project.
- **D-07:** A mounted operation never calls the fallback resolver again. A missing or malformed target fails closed rather than becoming an unprotected empty slot.
- **D-08:** Retain the verified recovery archive after success. Update annotations only after the written project verifies.

### Failure and Recovery Receipt
- **D-09:** Once canonical target mutation begins, every later failure returns non-success plus the retained recovery archive ID and a sanitized recovery state.
- **D-10:** Report `rolled_back` only after the original bytes are rewritten and reread successfully against the same still-pinned source. Otherwise report `recovery_required`.
- **D-11:** Source loss or source replacement forbids further writes, including rollback. Preserve the recovery artifact and provide reconnect/restore guidance.
- **D-12:** Never claim success from a completed write alone; stored bytes must pass exact reread and parse checks.

### Whole-Grid Instrument Recovery
- **D-13:** Whole-grid restoration is a separate, clearly labelled action and is available only when the archive's complete sample-pack manifest still verifies.
- **D-14:** Before any live-grid mutation, create and verify a complete recovery snapshot of the current grid.
- **D-15:** Stage and verify the archived grid, replace it as one guarded batch, and verify every declared file and required absence afterward. Stop at the first mismatch or source failure and return the recovery reference.
- **D-16:** Reuse this recovery boundary for existing instrument move/swap, remove, import, snapshot, and pack-install actions; do not reintroduce weaker one-off write paths. Require import/install targets to be empty and validate stored AIFF bytes.
- **D-17:** Protect both project slots with verified automatic backups before a slot swap changes either one.

### Source Modes and UAT
- **D-18:** Apply the same transaction contract to mounted OP-Z and `opzdisk/`; keep the initially selected source kind visible and fixed for the operation.
- **D-19:** Local tests cover busy conflicts, stale confirmation, bad archives, write/readback failures, rollback, source disappearance, fallback substitution, exact grid replacement, and recovery receipts.
- **D-20:** Direct mounted UAT uses API/filesystem access only: restore a live slot's own verified bytes to that explicitly selected slot, exercise a whole-grid same-byte restore, verify recovery references, and prove final content hashes with no unrelated device-byte changes.
- **D-21:** Host readback proves Content Mode byte acceptance only. Do not claim post-eject firmware load or playback acceptance without a separate physical test.

### the agent's Discretion
- Exact receipt field names, restore-panel spacing, status copy, and the smallest shared helper boundaries may follow existing conventions.
- If authenticated op1.fun response validity cannot be proved safely, keep installation fenced while enabling the locally verifiable Phase 3 operations.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `withMutation()`, `captureSource()`, and `assertCapturedSource()` already provide serialization and source pinning.
- `archiveCapturedProject()` already stages, rereads, parses, hashes, and atomically publishes verified recovery artifacts.
- `classifyArchive()` and `findBundle()` already derive truth from current stored bytes; close their remaining classify-then-read gap before restoration.
- `copyDir()` and `manifestMatches()` already provide dependency-free whole-grid copy evidence.
- `api()` and `runMutation()` already expose operation state and one browser-native mutation flow.

### Established Patterns
- Keep runtime changes inside `server.js`, `app/index.html`, and `test/transaction.test.js`; add no module, dependency, build step, or parser change.
- Trust freshly reread bytes and evidence, not filenames, stale UI state, or prior classification.
- Use plain JSON receipts with sanitized public codes and retain recovery material on every uncertain outcome.
- Keep unavailable actions disabled unless their complete mutation path shares the guarded recovery contract.

### Integration Points
- Add strict body validators and enable only completed Phase 3 routes in the mutation inventory.
- Extend the archive shelf classifier with truthful project/grid restore eligibility and render target preview plus separate restore controls.
- Extract the source-root identity check needed after intentional project replacement without weakening captured-source validation elsewhere.
- Extend the single built-in Node test file and existing temporary source/library hooks.

</code_context>

<specifics>
## Specific Ideas

- The user requested autonomous best recommendations, adaptive model selection, and Ponytail planning. Prefer reuse and the fewest shared helpers, but never simplify away recovery evidence or trust-boundary validation.
- No screen or browser control may be used because another unrelated agent is using the Mac display.
- The OP-Z was mounted earlier but is currently absent. Continue local planning and implementation, then recheck the mount at the hardware gate without substituting fixture evidence for device UAT.

</specifics>

<deferred>
## Deferred Ideas

- Automatic project clearing and undocumented empty-slot representations remain Phase 6.
- Per-song instrument dependency inference and partial-grid restore remain v2.
- Firmware playback acceptance requires a separate physical safe-eject, reconnect, load, and listening check.
- Authenticated op1.fun installation remains fenced if its live response and redirect contract cannot be safely validated without credentials.

</deferred>

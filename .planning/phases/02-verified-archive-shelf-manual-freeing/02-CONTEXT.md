# Phase 2: Verified Archive Shelf & Manual Freeing - Context

**Gathered:** 2026-08-26
**Status:** Ready for planning
**Mode:** Autonomous recommendations accepted by prior user instruction

<domain>
## Phase Boundary

Create versioned, inspectable archive records and a first-class archive shelf. A fully portable verified archive may unlock a guided manual on-device clearing checklist, but this phase never writes, deletes, renames, or synthesizes project data on the OP-Z. Restore execution remains Phase 3 and automatic clearing remains Phase 6.

</domain>

<decisions>
## Implementation Decisions

### Archive Completeness and Eligibility
- Keep project verification and safe-to-free eligibility distinct: a valid project-only archive is verified, but only a complete deep archive may unlock manual-free guidance.
- A complete archive includes the verified project, the captured whole sample-pack grid, a snapshot of song annotations, source/provenance facts, and explicit snippet portability status.
- If a linked snippet can be canonically resolved inside an allowed recording root, copy and verify it inside the archive; otherwise record `unlinked`, `missing`, or `unavailable` without pretending it is portable.
- Never infer required packs from unresolved OP-Z identifiers. Whole-grid capture is the only v1 basis for declaring instrument context portable.

### Versioned Manifest and Evidence
- Use one plain JSON manifest with an explicit schema version, creation time, source slot/kind, project evidence, metadata snapshot, snippet status/evidence, and sample-pack manifest.
- Store only archive-relative paths and sanitized public facts; never persist mounted absolute paths, credentials, or raw internal errors.
- Revalidate every included file from stored bytes before publication and again before reporting the archive as verified or safe to free.
- Unknown, malformed, incomplete, or evidence-mismatched manifests remain visible as diagnostics and are never restore- or free-eligible.

### First-Class Archive Shelf
- Add a top-level Archive Shelf view beside the existing Songs and Instruments views rather than expanding the small sidebar list.
- Default to newest first and show name, tags, step matrix, source slot/kind, creation time, snippet status, archive completeness, and verification status at a glance.
- Keep the default row compact; an expanded detail exposes the full evidence and portability breakdown without a separate page or framework.
- Keep failed, legacy, partial, and corrupt items in a clearly separate diagnostics section with no restore or manual-free action.

### Guided Manual Freeing
- Offer the manual-free checklist only from a currently verified, complete archive whose source slot is known and whose mounted source still matches the archived project identity.
- Revalidate the archive and source immediately before showing the checklist; never translate the checklist into a filesystem mutation in this phase.
- Source the physical OP-Z clearing sequence from official Teenage Engineering documentation during research, then present one short ordered checklist covering safe eject, on-device clearing, reconnecting in disk mode, and refreshing confirmation.
- If the mount disappears, source bytes change, or eligibility cannot be reconfirmed, stop and show recovery/reconnect guidance; the archive remains retained.

### the agent's Discretion
- Exact manifest field names, shelf spacing, disclosure styling, and copy may follow existing conventions and the smallest browser-native implementation.
- Use existing parser output for the archived step matrix rather than storing duplicated presentation markup.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `archiveCapturedProject()` already owns hidden staging, project/sample-pack verification, atomic publication, and retained failure diagnostics.
- `scanLibrary()` and `findBundle()` already distinguish verified bundles from diagnostics and revalidate stored evidence.
- `scanRecordings()` plus the hardened `/audio` containment rules identify portable recording roots without exposing unrelated files.
- Existing slot rows already render names, tags, matrices, provenance-adjacent source facts, recordings, and expandable detail patterns.

### Established Patterns
- Keep all runtime code dependency-free using Node built-ins, synchronous filesystem transactions, plain JSON, and browser-native DOM/WebAudio.
- Trust stored bytes and evidence, not filenames or earlier in-memory success; publish by atomic rename only after verification.
- Use one shared mutation boundary and stable, sanitized public error codes.
- Render unverified material separately and keep native controls disabled when an action is unavailable.

### Integration Points
- Extend the Phase 1 archive transaction to produce the versioned manifest and optional verified snippet before its existing atomic rename.
- Extend library scanning to derive shelf and safe-to-free eligibility from current stored-byte revalidation.
- Add an Archive Shelf tab and reuse the current render/data-fetch flow in `app/index.html`.
- Replace the fenced `/api/clear-slot` behavior only with a read/revalidate/manual-instructions response; it must perform zero device writes.

</code_context>

<specifics>
## Specific Ideas

- The mounted OP-Z is available for direct API/filesystem UAT, but no screen control may be used because another unrelated agent is using the Mac display.
- The user requested YOLO/autonomous choices and Ponytail planning: prefer the fewest fields, views, and helpers that fully preserve the safety contract.

</specifics>

<deferred>
## Deferred Ideas

- Actual restore controls and target-slot writes remain Phase 3.
- Automatic filesystem clearing and its hardware acceptance gate remain Phase 6.
- Per-song inferred sample-pack subsets, archive history, and descendant linking remain v2.

</deferred>

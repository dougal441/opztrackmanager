# Architecture Patterns

**Domain:** Verified OP-Z archive, free-slot, split-project backup, and restore workflow
**Researched:** 2026-08-20
**Confidence:** HIGH for integration and safety flow; MEDIUM for synthesized-project firmware acceptance

## Recommended Architecture

Keep the existing single Node process, `server.js` route/helper layout, `parser.js` binary-format boundary, and `app/index.html` client. Do not introduce a service/repository layer or dependency. The needed boundary is behavioural rather than structural:

```text
Browser UI
  │ explicit confirmation + renders evidence/status
  ▼
server.js workflow helpers
  ├─ read-only: inspect slot, detect likely split, scan verified archive
  ├─ archive transaction: capture source → stage bundle → verify → publish bundle
  ├─ restore transaction: capture target → verified auto-backup → validated write
  └─ clear transaction: only after an approved hardware-tested strategy exists
  │
  ├─ parser.js: parse project; synthesize/validate a confirmed half
  └─ Node fs/crypto: copies, byte/hash comparisons, manifests, exclusive mutation gate
       │
       ├─ mounted OP-Z or `opzdisk/` source captured once per mutation
       └─ `library/` bundles and `.staging/` directories
```

`getSource()` remains the selector for read-only work, but a mutation must capture its returned `{ root, path, device, label }` once and use that exact root throughout. It must never call `getSource()` again after staging begins: a lost device mount must fail the request, not silently redirect the remaining write to `opzdisk/`.

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `server.js` archive helpers | Create a complete staged bundle, create an instrument/snippet manifest, compare stored bytes to the captured source bytes, reparse the stored `.opz`, then publish it to `library/`. | `parser.js`, Node `fs`/`crypto`, captured source, `library/` |
| `server.js` mutation guard | Admit one destructive workflow at a time; preflight slot/body values; capture source paths and original bytes; recheck source identity immediately before each device write; return an explicit partial-state error on mount loss. | All archive/restore/clear routes |
| `server.js` split detector | Derive candidate groups from existing `parsed.chains`, `usedPatterns`, `patterns[*].stepGrid`, and track profiles. It returns evidence only; it never classifies a slot as two songs. | `/api/state` or a narrow inspection route, metadata confirmation route |
| `parser.js` synthesis helper | Given immutable source bytes, a confirmed pattern set, and an empty-pattern template from the same fixture/source, produce a new buffer and validate its chain references and used pattern set after reparsing. | `server.js` only |
| Bundle schema / scanner | Add a versioned `info.json` discriminator (`kind: "archive" | "split-half"`, `verified`, source hash, source slot, embedded metadata, snippet and instrument manifest, optional selected patterns). `scanLibrary()` exposes this evidence as first-class archive shelf fields. | `library/`, browser |
| `app/index.html` | Ask for destructive confirmation, display verification evidence and manual-clear instructions, show split candidates, collect confirmation/names, and invoke routes. It does not calculate split semantics or mutate files. | Server APIs |

The only justified new module boundary is inside `parser.js`: synthesis changes binary buffers and must sit beside the fixed-offset parser. Keep archive transactions, device-source checks, and bundle storage in `server.js`, where the equivalent backup/restore helpers already live.

### Archive Bundle Contract

Use the existing directory bundle format, extended rather than replaced:

```text
library/<timestamp>_<safe-name>/
  song.opz                 # source bytes, or validated synthesized-half bytes
  info.json                # schema version, provenance, user metadata, verification result
  instruments.json         # recursive relative-path + hash manifest of copied grid
  samplepacks/             # whole captured grid for complete restoration
  snippet/<safe-name>.*    # copied linked recording when one is linked
```

Complete archive is deliberately whole-grid for this milestone. The current application cannot reliably map every project `plugId` to a pack, so copying only inferred packs would weaken the core promise. The existing ~25 MB grid is a small cost for a personal laptop archive. If a linked snippet exists, copy it into the bundle and include its hash in `info.json`; a path reference alone is not preservation. If required bundle content cannot be copied and verified, publish no `verified` archive and do not clear the slot.

An automatic restore backup can use the same schema. It must always preserve the target project; when the user elects to overwrite instruments, it must also snapshot the target grid before doing so. Reuse this one contract rather than maintaining a weaker `autoBackupSlot()` format in parallel.

### Data Flow

#### Verified archive and free slot

1. The browser asks to archive a numbered slot. The server validates the slot, acquires the in-process mutation gate, captures the current source descriptor, and reads the project once into `sourceBytes` with a content hash.
2. The server copies `sourceBytes` (not a second live source read), the entire captured sample-pack grid, selected metadata, and the linked snippet into `library/.staging/<id>/`.
3. It verifies the staged bundle: `song.opz` is byte-identical to the expected buffer; `parseProject(storedBytes)` succeeds; every manifest entry matches the staged copy; and the copied snippet matches when present. `info.json` records the verifier version, source and output hashes, timestamp, and verified status.
4. The server moves the verified staging directory into the visible `library/` location, then rescans/reopens its `song.opz` to ensure the published archive still meets the contract. A failed stage is left outside the shelf as recoverable diagnostics, never presented as an archive.
5. Only now does it re-read `projectNN.opz` from the captured root and compare it with `sourceBytes`. If bytes differ or the root is gone, stop: the archive exists, the source remains untouched, and the browser reports that freeing was not attempted.
6. Until hardware validation approves a clear strategy, finish with “archive verified; clear this project on the OP-Z” rather than deleting or replacing the slot. After approval, the clear strategy is a final transaction step, followed by a read/parse check of the cleared result. No subsequent work occurs after a failed device check.

#### Restore

1. The browser chooses a verified archive and target slot. The server refuses non-verified archives for the new workflow, captures the target source and existing target bytes, and validates the archive again before touching the device.
2. It creates and verifies an automatic backup of target project bytes. If the request includes instrument restoration, it also stages and verifies the target grid snapshot before overwriting it.
3. The server rechecks that the target still matches the captured bytes, writes the archive project using the hardware-validated replacement method, then reads it back and requires byte equality plus successful parsing. Instrument restoration is separately copied/manifest-verified.
4. Only after the device write succeeds does it import/archive-provided metadata for the restored project hash and return the exact auto-backup reference. On any write or mount failure, stop immediately; the verified pre-write backup is the recovery path.

#### Split detection, confirmation, and half archives

1. On state scan, derive candidates from disjoint saved-chain pattern sets first. Gap-separated used-pattern clusters and materially different active-track/density profiles add evidence; overlapping or one-chain material is shown as ambiguous/no candidate.
2. The UI presents the evidence and the two proposed pattern sets. The user must select/adjust the sets, give each half a name, and explicitly confirm. Store this confirmation under the **full project hash** in `meta.json`; an edited project receives a new hash and must be reconsidered.
3. For a confirmed half, `parser.js` starts with `Buffer.from(sourceBytes)`, retains only confirmed pattern blocks, blanks excluded blocks from a known empty template, and rewrites chains so no entry references an excluded pattern. It must not alter the original source file.
4. Reparse the synthesized bytes and assert the exact selected used-pattern set and valid chain references. Archive those synthesized bytes through the same staging/verification workflow. The verification compares the stored archive to the synthesized expected buffer, not to the original full project.
5. A synthesized half remains `deviceValidated: false` until it has passed the fixture suite and a real OP-Z restore/eject/reconnect/playback check. Before that gate it can be previewed/archived as experimental but must not be offered as a trusted free-slot or automatic restore path.

## Patterns to Follow

### Pattern 1: Stage, verify, publish, then mutate

**What:** Every destructive workflow creates a durable, self-contained artifact before changing the source or target device.

**When:** Archive-and-free, restore/overwrite, and split-half archive.

**Example:**

```javascript
function verifyProjectCopy(expected, storedPath) {
  const actual = fs.readFileSync(storedPath);
  if (!actual.equals(expected)) throw new Error('archive bytes do not match source');
  parseProject(actual); // verifies the stored bytes, not an earlier in-memory parse
  return hashFile(actual);
}
```

Use a unique `.staging/<id>` directory and keep the final rename on the laptop `library/` filesystem. Node documents filename writes as replacements and warns that concurrent filesystem modifications are not synchronized; the small process-local gate is therefore sufficient here, while a device replacement strategy still needs real-hardware validation.

### Pattern 2: Captured source descriptor and recheck

**What:** Capture mount root, slot path, and starting bytes once. Recheck against those bytes before any destructive write.

**When:** Any route that could clear, overwrite, swap, or change sample packs.

**Example:**

```javascript
function assertUnchanged(captured) {
  if (!fs.existsSync(captured.projectPath)) throw new Error('device disconnected; stopped safely');
  if (!fs.readFileSync(captured.projectPath).equals(captured.bytes)) {
    throw new Error('slot changed during operation; stopped before mutation');
  }
}
```

This directly fixes the dangerous fallback case: a disappearing mounted source cannot cause a later `getSource()` call to write the local fixture.

### Pattern 3: Heuristic proposes; confirmation creates intent

**What:** The detector emits evidence and candidate groups; only persisted user confirmation is authoritative.

**When:** Rendering possible split slots and creating virtual-song archive requests.

**Example:**

```javascript
{ evidence: ['two disjoint saved chains'], groups: [[0, 1, 2], [9, 10, 11]] }
```

Use a simple pure helper over the parser output. There is no classifier model, score database, or background job to add.

### Pattern 4: Separate byte and semantic verification

**What:** Normal archives require source-to-stored byte identity plus parsing. Synthetic halves require expected-output-to-stored byte identity plus semantic checks of selected patterns/chains.

**When:** All archive paths, especially format transformation.

**Why:** A byte-equal synthetic archive could still retain an excluded chain; a parseable file could still be a corrupt copy of the source.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Reuse `getSource()` during a transaction

**What:** Each helper independently resolves device versus `opzdisk/`.

**Why bad:** A removed mount changes the resolver's answer mid-request, allowing the remaining operation to target a different filesystem.

**Instead:** Pass the captured source descriptor and exact paths into every transaction helper; error on any loss of that root.

### Anti-Pattern 2: Mark a copy “backed up” before validating it

**What:** Existing `/api/backup` and `autoBackupSlot()` return success after copying and writing JSON.

**Why bad:** A partial/bad copy becomes the justification for an irreversible clear or overwrite.

**Instead:** Put `verified: true` in `info.json` only after reopening, byte-comparing, reparsing, and checking all declared bundle content. The shelf must distinguish old/unverified bundles from verified archives.

### Anti-Pattern 3: Infer per-pack requirements from incomplete plug IDs

**What:** Copy only a guessed subset of sample packs.

**Why bad:** A missing pack makes a “complete” restoration materially incomplete, and the proprietary mapping is explicitly out of scope.

**Instead:** Archive the full grid with a manifest. Optimize later only after a verified pack-reference model exists.

### Anti-Pattern 4: Auto-split or auto-clear based on local tests

**What:** Treat a pattern gap as a decision, or treat fixture success as firmware proof.

**Why bad:** Musical intent is ambiguous and OP-Z firmware acceptance cannot be inferred from host parsing.

**Instead:** Require user confirmation for split intent and real-device acceptance tests for every new clear/synthesis strategy.

## Safe Build Order

1. **Verification primitive and fixture harness** — Add the smallest shared helpers for captured source, byte/parse verification, recursive manifests, staging, and a mutation gate. Test against copied `opzdisk/` fixtures, including malformed copy and simulated missing path. This is the foundation for every destructive feature.
2. **Verified archive plus shelf** — Version the bundle schema, make the full-grid/snippet archive path, expose verified status in `scanLibrary()`, and render first-class archive entries. Keep existing legacy backups readable but not eligible for “safe free.”
3. **Archive-and-free, manual clear only** — Compose archive verification with the current safe manual-clear instruction. This delivers confidence without asserting untested device write behavior.
4. **Transactional restore** — Replace the new workflow's direct copy with verified target auto-backup, archive revalidation, captured-target recheck, and post-write byte/parse verification. Add target-grid snapshot only when restoring instruments.
5. **Split detection and confirmation** — Add pure read-only candidate detection, confirmation UI, and hash-keyed split intent. No binary mutation yet, so heuristic quality can be reviewed safely on real projects.
6. **Synthesized half archive and device gate** — Implement the tiny `parser.js` synthesis helper and fixture assertions. Validate restore/playback after eject/reconnect on a sacrificial device slot before allowing trusted half restore/free-slot actions.
7. **Automatic clearing only after hardware evidence** — Implement the specifically proven clear method (delete or a known-good empty project), with the same pre/post checks. If evidence is inconclusive, leave the manual-clear flow as the shipped capability.

This order ensures that every later write route inherits the verified archive primitive. It also keeps each hardware uncertainty behind a product gate instead of a runtime guess.

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| Intended deployment | One local user; synchronous stdlib filesystem operations are appropriate. | Out of scope: app has no hosted/multi-user contract. | Out of scope. |
| Archive size | Full-grid archives are acceptable on a laptop; show size/progress if copy time is noticeable. | Would require deduplicated content-addressed storage, not justified here. | Would require a different product architecture. |
| Mutation serialization | One module-level in-process lock is enough because one localhost server owns the device. | Per-device/process coordination would be required. | Requires a service/storage redesign, explicitly out of scope. |

## Sources

- [Current project architecture](../codebase/ARCHITECTURE.md) — HIGH: direct codebase analysis of `server.js`, `parser.js`, and the existing bundle/restore flow.
- [Project context and safety decisions](../PROJECT.md) and [handover format notes](../../HANDOVER.md) — HIGH: project requirements and locally verified format observations.
- [Teenage Engineering OP-Z project guide](https://teenage.engineering/guides/op-z/project) — MEDIUM: 10 projects, 16 patterns/project, and saved chain semantics.
- [Node.js file-system documentation](https://nodejs.org/api/fs.html) — MEDIUM: replacement writes, flush support, and unsynchronized concurrent modifications.
- [z-po-project project-file-format reference](https://github.com/lrk/z-po-project/wiki/Project-file-format) — MEDIUM: community binary-format reference; validate synthesized bytes on fixture and hardware rather than relying on it alone.

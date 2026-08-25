---
phase: 2
slug: verified-archive-shelf-manual-freeing
status: draft
shadcn_initialized: false
preset: none
created: 2026-08-26
---

# Phase 2 — UI Design Contract

> Visual and interaction contract for the verified archive shelf and guided manual-device freeing. Generated from Phase 2 context and the existing browser UI.

---

## Design System

| Property | Value | Source |
|----------|-------|--------|
| Tool | Existing inline CSS; no design-system package | `app/index.html`, project constraint |
| Preset | Not applicable | No React/Vite/Next.js or `components.json` detected |
| Component library | Browser-native HTML controls | Existing stack |
| Icon library | None; retain the existing text/SVG marks | Existing stack |
| Font | `-apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif`; `ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace` for evidence | Existing `--sans` and `--mono` tokens |

Do not introduce dependencies, a build step, CSS files, a framework, a registry, or a design-system rewrite. Add the Phase 2 markup, CSS, and JavaScript to `app/index.html` and reuse the existing `.tab`, `.btn`, `.lbl`, `.matrix`, `.empty`, `.skel`, and status-region patterns.

---

## Spacing Scale

Declared values for Phase 2 additions (multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Badge and inline evidence gaps |
| sm | 8px | Compact control and metadata gaps |
| md | 16px | Shelf-row padding and grouped fields |
| lg | 24px | Expanded evidence padding |
| xl | 32px | Column and section gaps |
| 2xl | 48px | Separation before Archive Diagnostics |
| 3xl | 64px | Page-level breathing room only |

Exceptions: retain existing 1px borders and 2px focus outline; use a 44px minimum hit target for new tabs, disclosure summaries, checkboxes/labels, and manual-free controls. Do not normalize unrelated legacy spacing in this phase.

---

## Typography

Use exactly these four sizes and two weights for Phase 2 additions:

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Label | 10px | 600 | 1.4 | Uppercase mono labels and compact status badges |
| Control | 11px | 600 | 1.2 | Tabs, disclosure labels, buttons |
| Body | 14px | 400 | 1.5 | Guidance, checklist, errors, empty states |
| Heading | 15px | 600 | 1.3 | Archive name and section headings |

Use the sans stack for names and prose, and the mono stack with tabular numerals for slot numbers, timestamps, byte counts, schema versions, checksums, and provenance. Long evidence values wrap; they never shrink below 10px.

---

## Color

| Role | Value | Usage | Source |
|------|-------|-------|--------|
| Dominant (60%) | `#efeeea` (`--bg`) | Page background and quiet empty areas | Existing token |
| Secondary (30%) | `#f7f6f3` (`--surface`), with `#e6e4de` (`--sunken`) for inset rows | Archive rows, expanded evidence, tab group, checklist | Existing tokens |
| Accent (10%) | `#ff4b00` (`--accent`) | Focus rings, active disclosure marker, verified badge outline, and the eligible manual-free affordance only | Existing token |
| Destructive | None in Phase 2 | The app performs no destructive action; the physical clear warning uses ink, border, icon, and explicit copy rather than a new alarm color | Phase boundary |

Accent reserved for: keyboard focus, the active Archive Shelf tab marker, verified evidence status, disclosure hover/open state, and `prepare manual freeing` after current eligibility is established. Do not use accent as decoration across every card or as the sole status signal. Every status has visible text.

Track colors remain reserved for the step matrix. `--dim`, `--faint`, and borders may support hierarchy, but diagnostics must not be communicated by muted color alone.

---

## Copywriting Contract

All button labels remain lowercase to match the existing interface.

| Element | Exact copy | Source |
|---------|------------|--------|
| Primary CTA | `archive complete song` | Recommended default for ARCH-03/SAFE-04 |
| Shelf tab | `archive shelf` | Phase context |
| Shelf heading | `Verified archives` | Phase context |
| Empty state heading | `No verified archives yet` | Recommended default |
| Empty state body | `Open a song, then choose “archive complete song”.` | Recommended default |
| Shelf load error | `Archive Shelf couldn’t be refreshed. Refresh to try again. Existing archives remain on this Mac.` | Safety default |
| Diagnostics heading | `Archive diagnostics` | Phase context |
| Diagnostics empty | `No archive diagnostics.` | Recommended default |
| Eligible action | `prepare manual freeing` | Phase context |
| Ineligible: incomplete | `Manual freeing is unavailable until the project, whole sample-pack grid, metadata, and snippet status are portable and verified.` | Phase context |
| Ineligible: source | `Connect the original OP–Z in content mode, then refresh. The mounted slot must still match this archive.` | Phase context |
| Preflight busy | `Checking archive and source…` | Recommended default |
| Preflight failure | `Manual freeing stopped. The archive or mounted source no longer matches. Reconnect the original OP–Z, refresh, and try again. The archive remains on this Mac.` | Phase context |
| Checklist warning | `You are about to clear slot {NN} on the OP–Z itself. OP-Z Manager will not delete or change device files.` | Phase boundary |
| Identity acknowledgement | `I confirmed slot {NN} is “{song name}” on this OP–Z.` | Safety default |
| Final check CTA | `refresh and verify slot` | Recommended default |
| Clear confirmed | `Slot {NN} is free. “{song name}” remains verified in Archive Shelf.` | Recommended default |
| Still present | `Slot {NN} still contains “{song name}”. Nothing was removed by OP-Z Manager. Repeat the on-device clear steps when ready.` | Safety default |
| Unexpected replacement | `Slot {NN} changed but is not empty. Stop here. The archive remains retained; review the device before doing anything else.` | Safety default |
| Mount missing | `The OP-Z is not available for confirmation. Reconnect it in content mode, then refresh and verify slot {NN}.` | SAFE-03/SAFE-04 |
| Destructive confirmation | No app-side destructive confirmation. The physical action is gated by a fresh preflight and the exact-slot identity checkbox above. | Phase boundary |

Do not show raw internal errors, mounted absolute paths, or credentials. Diagnostic copy may show a stable public error code, supported manifest version, archive-relative path, source kind/label, and slot.

---

## Information Architecture

### Top-level navigation

Add one `archive shelf` tab beside `songs` and `instruments`. The tab opens `#view-archives`, a full-width page region; it does not add a third column to Songs.

Replace the current Songs sidebar archive list with a compact summary only: verified count, diagnostic count, and an `open archive shelf` button. Do not maintain two archive-card renderers.

The Archive Shelf contains, in this order:

1. Page heading, one-sentence explanation, and verified archive count.
2. Verified archive list, newest first by manifest creation time.
3. Archive Diagnostics after a 48px section break and divider.

No search, filters, pagination, restore controls, or automatic-clear controls are added in this phase.

### Compact verified archive row

Use one native `<details>` per archive and make its `<summary>` the compact row. The row shows all of the following without opening it:

- Song name; use `untitled` only when the metadata snapshot has no name.
- Tags, wrapping naturally.
- Existing 8×16 step matrix derived from archived parser output.
- `slot {NN} · mounted OP-Z` or `slot {NN} · local fixture` provenance.
- Local creation date and time from the manifest.
- Three independent text badges: `verified`; `complete` or `project only`/`partial`; and one of `snippet included`, `no snippet linked`, `snippet missing`, `snippet unavailable`.
- Disclosure label `evidence` and a visible chevron.

Do not collapse the three status concepts into a single “safe” badge. A project-only archive can be verified while remaining ineligible for manual freeing.

### Expanded evidence

Opening the native disclosure reveals four groups in a two-column desktop grid and one column on narrow screens:

1. **Project verification:** manifest schema version, archive-relative project path, full SHA-256, byte length, stored-byte match, successful parse, verification time.
2. **Song snapshot:** name, tags, notes, tempo, used patterns/chains, and the full step matrix. Missing optional values read `Not recorded`; they are never blank placeholders.
3. **Portability:** snippet status plus path/hash/bytes when included; whole-grid capture status, file count, total bytes, and per-track counts. A nested native `<details>` labelled `sample-pack file evidence ({N})` may expose the archive-relative path, slot/type, bytes, and full hash for each file.
4. **Provenance and action:** source kind/label, source slot, creation time, current manual-free eligibility, and the eligible action or a visible reason it is unavailable.

Full SHA-256 values use `overflow-wrap: anywhere`. Evidence tables may scroll horizontally inside their own container below 720px; the page itself must never gain horizontal scrolling.

### Archive Diagnostics

Diagnostics are a separate landmark and list, not interleaved with verified archives. Each compact diagnostic row shows its display name/fallback identifier, one of `legacy`, `partial`, `failed`, `corrupt`, or `unsupported`, creation time when known, source slot/kind when safe to expose, and a stable public reason. A native disclosure may show sanitized evidence.

Diagnostic rows never contain restore, manual-free, or target-slot controls. They use neutral surfaces and the explicit `needs attention` label; do not use `verified` styling.

---

## Interaction Contract

### Archive creation

`archive complete song` is available from the expanded Songs row. It always requests the complete deep archive: verified project bytes, whole sample-pack grid, annotation snapshot, provenance, and explicit snippet status. Keep the name prompt prefilled. The final native confirmation states the song name, source kind/label, slot, that the complete grid is included, and `Device data will not change.`

During capture, disable all mutation controls through the existing shared mutation state and show `archiving slot {NN}…` in the live status area. Success copy is `verified archive created · open Archive Shelf`; activating that shelf link focuses the new archive summary. Failure leaves the source unchanged and routes the retained sanitized record to Archive Diagnostics.

### Manual-free eligibility

Derive eligibility on every shelf scan from current stored-byte evidence; never trust a stored `eligible` flag. `prepare manual freeing` appears only when all are true:

- Manifest schema is supported and all stored evidence revalidates.
- The archive contains the verified project, metadata snapshot, and verified whole sample-pack grid.
- Snippet status is `included` with verified stored bytes or `unlinked`; `missing` and `unavailable` are not portable.
- Source slot is known, the current source is a mounted OP-Z (not `opzdisk/`), and the mounted device identity plus current slot project hash match the archive provenance.

If any condition is false, show the corresponding ineligible copy inline. Do not render a misleading disabled action whose reason exists only in a tooltip.

### Guided manual freeing

Selecting `prepare manual freeing` first calls the read-only preflight endpoint. The control changes to `checking…`, is disabled, and exposes `aria-busy="true"`. If archive or source revalidation fails or the mount vanishes during preflight, reveal the preflight-failure message, focus it, and do not show clearing instructions.

On success, reveal an inline checklist beneath the same archive evidence and move focus to its heading. Show the exact song, slot, source label, and archive identifier above the steps. Require the identity acknowledgement checkbox before enabling the ordered checklist controls.

The ordered checklist is:

1. **Safely eject.** `Eject the OP-Z disk in Finder, or press play while it is in content/boot mode. Wait for the disk to disappear and the OP-Z to finish syncing/restarting before unplugging USB or powering off.`
2. **Select the archived project.** `Disconnect USB if needed. On the OP-Z, hold project and press value key {1–0 mapped from slot NN} to select slot {NN}. Confirm the song before continuing.`
3. **Clear the project on the device.** `Hold project + stop + shift to clear the entire selected project.`
4. **Reconnect in content mode.** `Power the OP-Z off. Hold track while turning it on, connect USB, and wait for the OP-Z disk to mount.`
5. **Confirm.** Activate `refresh and verify slot`.

Steps 1–4 are instructions and checkboxes only. Checking them never calls a mutation endpoint. Step 5 performs a fresh read and reports exactly one of: confirmed empty, archived song still present, unexpected non-empty replacement, or mount unavailable. Keep the verified archive in every outcome.

Official interaction basis, researched 2026-08-26:

- [Teenage Engineering OP-Z project guide](https://teenage.engineering/guides/op-z/project) — project selection and entire-project clear gesture.
- [Teenage Engineering OP-Z disk modes guide](https://teenage.engineering/guides/op-z/disk-modes) — content mode and safe eject behavior.

Do not infer, automate, or send any device clear operation from these instructions.

---

## Keyboard, Focus, and Semantics

- Give the navigation `role="tablist"`; each tab has `role="tab"`, `aria-selected`, `aria-controls`, and a roving `tabindex`. Left/Right moves between tabs, Home/End moves to the ends, and Enter/Space activates. Focus remains on the selected tab.
- Use native `<details><summary>` for archive and diagnostic disclosure. Enter/Space toggles it. The whole row is not a click handler, and nested links/buttons do not toggle the disclosure.
- Every visible control retains the existing 2px orange `:focus-visible` outline. Add summaries and checkbox inputs to that selector.
- Give each matrix an archive-specific accessible name, for example `Step activity matrix for “Night Drive”`; never expose 128 decorative cells individually.
- Use `<time datetime="…">` for creation and verification times and `<code>`/mono styling for hashes, versions, and byte counts.
- Announce shelf refresh, archive completion, preflight failure, and final slot result through the existing polite live status region. Use `role="alert"` only for a stop condition that needs immediate attention.
- After successful archive creation and navigation, focus the new archive summary. After successful preflight, focus the checklist heading with `tabindex="-1"`. After final confirmation, focus the result message. Never steal focus during passive refresh.
- Labels and status text accompany every badge/icon. Color, chevrons, and disabled state are never the only cues.

---

## Responsive Layout

- At widths above 900px, the compact shelf summary uses columns for name/tags, 136px matrix, provenance/time/status, and disclosure marker. Expanded evidence uses two columns.
- At 900px and below, the compact summary becomes a single content column with the matrix and badges wrapping below the name. Expanded evidence becomes one column.
- At 720px and below, tabs wrap below the brand/source status, buttons use the full available width where needed, badges wrap, and checklist labels remain beside their checkboxes. Preserve 16px page gutters.
- Long names, tags, notes, source labels, archive-relative paths, and hashes wrap with `overflow-wrap: anywhere`; do not clip critical safety copy or provenance.
- Only the per-file evidence table may scroll horizontally. The shelf, diagnostics, and checklist may not.

---

## Motion

Use only the existing short hover/focus transitions and disclosure reveal. Add one global `prefers-reduced-motion: reduce` override that disables smooth scrolling, the `.detail` reveal animation, skeleton shimmer, and nonessential transitions. In reduced motion, loading skeletons use a static `--sunken` fill. No auto-scroll, parallax, bounce, or progress animation is permitted.

---

## UI Considerations

Applicable state considerations resolved: 8 covered, 0 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | Verified shelf; diagnostics | ✅ covered | Each list renders its documented empty copy independently; an empty verified shelf does not hide diagnostics. |
| loading | Shelf; archive creation; preflight; final confirmation | ✅ covered | Initial shelf uses three static/shimmer skeleton rows with `aria-busy`; action labels expose the in-flight operation and mutation controls remain disabled. |
| error | Shelf; preflight; confirmation | ✅ covered | Initial failure shows the documented inline error and refresh action; safety failures retain the archive, focus the message, and stop the flow. |
| populated | Verified shelf | ✅ covered | Newest-first native disclosures expose all at-a-glance fields and full evidence without a separate page. |
| partial | Archive collection | ✅ covered | Project-only, incomplete, legacy, malformed, and evidence-mismatched items route to Archive Diagnostics and never receive free/restore actions. |
| overflow | Shelf rows; evidence table | ✅ covered | Text wraps; the per-file evidence table alone may contain its own horizontal scroll; the page does not scroll sideways. |
| zero-one-many | Verified shelf; diagnostics | ✅ covered | Counts use `1 verified archive` versus `{N} verified archives`; rows keep the same spacing at one or many items and require no pagination in Phase 2. |
| long-text | Names; tags; notes; paths; hashes; source labels | ✅ covered | Safety and evidence text wraps with `overflow-wrap: anywhere`; no critical value is ellipsized or available only by tooltip. |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| None | None | Not applicable — dependency-free browser UI confirmed 2026-08-26 |

No shadcn or third-party registry code is permitted by the project stack, so no registry vetting is required.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

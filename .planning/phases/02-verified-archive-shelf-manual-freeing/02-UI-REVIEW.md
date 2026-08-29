# Phase 2 — UI Review

**Audited:** 2026-08-26
**Baseline:** `02-UI-SPEC.md` (approved)
**Implementation:** post-fix commit `ec20efa`
**Screenshots:** Not captured — explicit code-only/no-screen constraint

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | All approved shelf, unavailable, preflight, archive-busy, checklist, identity, and result copy now matches the contract. |
| 2. Visuals | 4/4 | Source structure supplies the contracted hierarchy, warning treatment, evidence grouping, status labels, and responsive disclosures. |
| 3. Color | 4/4 | The darker dim/focus tokens now pass their intended backgrounds; verified status uses a bright outline and accessible dark text. |
| 4. Typography | 4/4 | Phase 2 controls and checklist emphasis now use the approved 600 weight and the shelf stays within its four-size/two-weight scale. |
| 5. Spacing | 4/4 | Shelf/checklist layout uses the approved scale, 44px controls, 88px summaries, and required responsive gutters. |
| 6. Experience Design | 4/4 | Fail-closed manual freeing, exact identity/results, slot 10, focus, polite shelf errors, and keyboard/state contracts are covered. |

**Overall: 24/24**

---

## Top Priority Fixes

No open priority fixes. The three highest-risk prior findings are resolved:

1. **Exact safety copy — resolved.** Both source-ineligible and preflight-failure templates now use the contracted `OP–Z` spelling (`app/index.html:665,682`).
2. **Phase 2 contrast and emphasis — resolved.** Dim text, focus outlines, verified status roles, 600-weight controls, and checklist emphasis meet the contract (`app/index.html:11,54,60,159,179`).
3. **Fail-closed interaction semantics — resolved.** Slot 10, exact identity/results, state-specific guidance, padded archive-busy status, and polite shelf errors remain covered (`app/index.html:426-432,624-685`).

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

- **PASS — archive-busy copy is exact and slot-padded.** The shared live region maps `archive slot N` to `archiving slot NN…` (`app/index.html:426-432`), with a source assertion at `test/transaction.test.js:1226`.
- **PASS — unavailable and stop states are safely mapped at the UI boundary.** Incomplete archives receive the complete portability prerequisite, source mismatch receives fixed reconnect guidance, and all preflight failures receive a single retained-archive stop message (`app/index.html:665-667,680-685`). Raw internal guidance is not rendered.
- **PASS — exact identity and final-result copy remains complete.** The checklist identifies archive, song, padded slot, source label, and slot-10 key mapping; the four allowed outcomes name the song and slot and never claim confirmed empty (`app/index.html:654-679`). Rendered VM evidence covers hostile markup, key 0, and all four outcomes (`test/transaction.test.js:1362-1423`).
- **PASS — the final exact-template warning is resolved.** The source-ineligible and preflight-failure literals use `OP–Z` and match the approved sentences byte for byte (`app/index.html:665,682`; `02-UI-SPEC.md:94,96`). Tests explicitly require both corrected en-dash fragments (`test/transaction.test.js:1229-1230`).
- **PASS — the apparent busy-label discrepancy is resolved by the interaction contract.** The button changes to lowercase `checking…` (`app/index.html:723`), exactly as the guided-manual-freeing interaction section directs; this is the control label, while the retained failure text remains the full fixed sentence.

### Pillar 2: Visuals (4/4)

- **PASS — hierarchy is explicit in the implementation.** `Verified archives` leads the page, four-column summaries provide name/matrix/provenance/status/disclosure, and expanded evidence is grouped into Project verification, Song snapshot, Portability, and Provenance and action (`app/index.html:143-174,686-711`).
- **PASS — safety treatment is distinct without inventing destructive styling.** The manual-free panel is sunken with an ink border; its warning receives a 4px ink rule and surface fill (`app/index.html:175-182`). Verified state has visible text plus a distinct outline, and diagnostics remain neutral.
- **PASS — visual signals are redundant with text.** Matrix accessible names, badges, evidence chevrons, diagnostic labels, manual results, and availability explanations do not rely on color alone (`app/index.html:445-465,626-711`).
- **Audit limit:** Optical rendering was not screenshot-tested because browser/screen control was explicitly prohibited. No source-level visual contract gap was found.

### Pillar 3: Color (4/4)

- **PASS — dim text now clears normal-text contrast on its actual Phase 2 backgrounds.** `--dim: #6e6b64` (`app/index.html:11`) measures **4.58:1** on page `--bg` and **4.92:1** on row `--surface`; the shelf's dim intro, counts, facts, tags, and diagnostics use those backgrounds.
- **PASS — focus contrast is fixed on the sunken checklist.** Phase 2 summary/button/input outlines use `--accent-text: #c93400` (`app/index.html:58-60`), measuring **4.16:1** against `--sunken`, above the 3:1 non-text contrast threshold.
- **PASS — verified status uses the required split roles.** `.badge.verified` uses bright `--accent` for its border and darker `--accent-text` for 10px text (`app/index.html:157-159`). The border measures **3.10:1** and text **4.89:1** against its `--surface` background.
- **PASS — accent remains scoped.** It marks active/open disclosure state, focus, verified outline, and the eligible manual-free action; the latter pairs orange with ink at **5.14:1** (`app/index.html:39,150,159,182`).

### Pillar 4: Typography (4/4)

- **PASS — Phase 2 uses the approved hierarchy.** The shelf is limited to 10px evidence/badges, 11px controls/counts, 14px body, and 15px headings/names with 400/600 weights (`app/index.html:143-185`).
- **PASS — reused controls now meet the Phase 2 weight contract.** `nav.tabs .tab` and `.archiveShelf .btn` override the legacy 500 shorthand with 600 while retaining a 44px target (`app/index.html:51-54`).
- **PASS — checklist emphasis no longer introduces 700.** `.manualFree b` is explicitly 600 (`app/index.html:179`), matching headings and evidence labels.
- **PASS — long technical evidence remains readable.** Mono treatment is reserved for hashes, versions, counts, and table evidence; values wrap rather than shrink below 10px (`app/index.html:163-170`).

### Pillar 5: Spacing (4/4)

- **PASS — Phase 2 additions follow the declared 4px scale.** Rows, badges, evidence, diagnostics, error, and checklist declarations use 4/8/12/16/24/48px values (`app/index.html:141-185`).
- **PASS — structural exceptions match the contract.** Borders are 1px, focus outlines 2px, warning rule 4px, archive summaries at least 88px, and interactive shelf controls at least 44px (`app/index.html:54,58-60,147-149,175-185`).
- **PASS — responsive spacing is complete.** The 900px one-column transition, 720px tab/button treatment, 16px mobile gutters, wrapping, and table-only horizontal scrolling are present (`app/index.html:168,187-195`).

### Pillar 6: Experience Design (4/4)

- **PASS — safety remains fail closed.** Eligibility is current-source derived; the checklist is hidden after stale eligibility, requires exact identity acknowledgement, issues no mutation call, and only the final refresh performs a GET. Phase 2 reports still-present, replacement, unavailable, or unclassified — never confirmed empty (`app/index.html:654-685,720-747`; `test/transaction.test.js:1252-1423`).
- **PASS — slot 10 is correct in rendered output.** The implementation maps slot 10 to value key 0 (`app/index.html:654-656,676`), and the VM assertion proves the user-visible instruction (`test/transaction.test.js:1404-1409`).
- **PASS — shelf refresh errors are polite.** The error container now uses `role="status" aria-live="polite"` (`app/index.html:624-627`), while immediate manual stop/result messages retain alert semantics (`app/index.html:665-669`).
- **PASS — focus and keyboard behavior are covered.** Roving tab focus, native disclosures, focus-visible rings, archive-success navigation/focus, preflight heading focus, and final-result focus are implemented and asserted (`app/index.html:388-415,596-607,720-747`; `test/transaction.test.js:1155-1171,1239-1250,1426-1435`).
- **Automated result:** the targeted UI/VM selection passed **10/10**, with no screen, browser, device, or hardware-UAT body used.

---

## Automated Evidence

- Targeted command: `node --test --test-name-pattern='archive shelf|shelf states|tab semantics|archive escaping|diagnostic actions|archive success|manual checklist|archive refresh|final manual-free' test/transaction.test.js`
- Result: **10 passed, 0 failed**.
- Exact-template comparison: **2 passed, 0 failed** — both full UI literals match the approved contract.
- Contrast calculations: dim/bg **4.58:1**; dim/surface **4.92:1**; accent-text/sunken **4.16:1**; accent/surface **3.10:1**; accent-text/surface **4.89:1**; ink/accent **5.14:1**.
- Registry audit: skipped — `components.json` is absent and no third-party registry is declared.

---

## Files Audited

- `app/index.html`
- `test/transaction.test.js`
- `.planning/phases/02-verified-archive-shelf-manual-freeing/02-UI-SPEC.md`
- Commit `ec20efa` diff

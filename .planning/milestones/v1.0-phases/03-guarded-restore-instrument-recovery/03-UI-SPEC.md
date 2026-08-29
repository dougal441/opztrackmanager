---
phase: 3
slug: guarded-restore-instrument-recovery
status: approved
shadcn_initialized: false
preset: none
created: 2026-08-27
reviewed_at: 2026-08-27
---

# Phase 3 — UI Design Contract

> Browser-native interaction contract for explicit target preview, guarded project restore, recovery receipts, and separate whole-grid restoration.

## Design System

Use the existing inline CSS and browser-native controls in `app/index.html`. Reuse `.btn`, `.lbl`, `.matrix`, Archive Shelf `<details>`, status badges, focus outline, result region, and `runMutation()`. Add no dependency, framework, component file, CSS file, icon library, modal library, or build step.

New controls use the existing system font and evidence uses the existing mono stack. New buttons, selects, summaries, and acknowledgement labels have a 44px minimum hit target. Preserve the existing 2px orange `:focus-visible` outline and reduced-motion behavior.

Use the existing Phase 2 scale for additions: 10px labels, 11px controls, 14px body text at 1.5 line height, and 15px headings; weights are 400 and 600 only. Evidence values never shrink below 10px.

Use the 4/8/16/24/32/48/64px spacing scale. Exceptions are existing 1px borders, the 2px focus outline, 44px hit targets, and the 720/900px responsive breakpoints.

## Color and Hierarchy

- `--bg` remains the page background and `--surface`/`--sunken` contain restore evidence.
- `--accent` is reserved for focus, the verified archive marker, and the enabled primary `restore project` action.
- Whole-grid restoration remains visually secondary but uses a strong ink border and explicit warning copy.
- Retain the Phase 2 60/30/10 balance: `--bg` dominates, `--surface`/`--sunken` group evidence, and `--accent` is sparse.
- `--ink` is the warning/destructive role, reinforced by border, icon/text label, and explicit copy rather than color alone.
- Status is always communicated by text, not color alone.
- Do not introduce gradients, shadows, animated progress, or a new destructive palette.

## Information Architecture

Keep Phase 3 inside the existing Archive Shelf and Instruments view.

### Verified archive row

The expanded evidence area gains one `Restore` group after current project evidence:

1. Label: `restore to slot`
2. Native `<select>` with first option `choose a slot…` and options `slot 01` through `slot 10`; no slot is preselected.
3. A target-preview panel that appears only after selection.
4. Primary button `restore project`.
5. A visually separated secondary section and button `restore whole instrument grid`, rendered whenever current archive grid evidence verifies; it does not require project-slot selection.

The selected target preview plus `restore project` is the primary visual anchor. The whole-grid action sits after a divider and explanatory copy so its independent scope cannot be mistaken for an option on project restore.

Diagnostic archives never render a target selector or restore action.

### Target preview

Before `restore project` enables, show all of:

- `slot {NN}` and current song name or `untitled`;
- exact current source label and `mounted OP-Z` or `local fixture`;
- current project hash prefix and modified time;
- tempo and existing 8×16 matrix;
- `A verified automatic backup will be created before this slot changes.`

If the slot is missing, unreadable, or the source changed, show a stop message and no enabled action. Never call it empty unless a later hardware-validated classifier says so.

The UI carries a bounded opaque source token and archive revision from the same rendered state into the request. Neither is presented as technical evidence to the user. If either changes, the server stops before backup/write and the UI uses the documented stale copy.

### Project restore confirmation

Use one native `confirm()` after the inline preview; the inline preview is the primary evidence, not the dialog. Exact copy:

`Restore “{archive name}” to slot {NN}, replacing “{current name}”? A verified automatic backup of slot {NN} will be retained. Instruments will not change.`

The request includes the selected slot's exact fingerprint. During restore, the shared status region says `protecting and restoring slot {NN}…`; all mutation controls disable.

### Whole-grid confirmation

The grid action is never nested inside project restore. Its exact confirmation is:

`Restore the complete instrument grid from “{archive name}”? The current whole grid will first be retained as a verified recovery snapshot. The project slot will not change.`

The action is available only for a complete freshly verified grid. During work, status says `protecting and restoring the whole instrument grid…`.

### Recovery result

On success, focus the result region and show:

- `restore verified`;
- target slot for project restore;
- recovery reference;
- mounted source: `Written bytes were reread and verified on the mounted OP-Z in Content Mode.`
- local source: `Written bytes were reread and verified in the local fixture.`

On any failure after mutation begins, focus a `role="alert"` result and show:

- `restore did not complete`;
- recovery reference;
- exactly one truthful state: `original bytes were restored and verified`, `project bytes verified; annotations incomplete`, or `recovery is required`;
- sanitized reconnect/restore guidance.

For the annotation-incomplete state, keep the verified project bytes in place, return non-success, retain the pre-restore recovery archive, and show: `Project bytes were restored and verified, but song annotations were not saved. The restore did not fully complete. Recovery {id} remains retained.`

Never show raw paths, temporary filenames, device identifiers, or stack errors.

### Swap and Instruments

Keep the existing compact swap and instrument controls. When enabled, route them through the shared busy/result treatment. A successful swap shows both recovery references. Instrument move/remove/import results show the whole-grid recovery reference. `snapshot instruments` remains a separate non-destructive laptop-copy action with verified evidence.

Keep op1.fun installation disabled with visible copy: `installation remains unavailable until authenticated downloads can be verified safely.` Browsing remains read-only.

## Interaction and State Contract

| State | Required behavior |
|-------|-------------------|
| Initial | Target placeholder selected; project restore disabled; no implicit slot. Whole-grid availability depends only on fresh complete-grid verification. |
| Selected | Current live target preview shown; project restore enabled only when readable and fingerprinted. Whole-grid availability remains independent and depends only on fresh complete-grid verification. |
| Archive stale | A changed revision digest hides/disables actions and says `Archive changed. Refresh before restoring.` |
| Target stale | A changed project fingerprint or opaque source token stops without backup/write and says `Slot {NN} changed after preview. Refresh and review it again.` |
| Busy | All mutation controls disabled; `aria-busy="true"`; shared live status names the operation. |
| Success | Refresh state, keep Archive Shelf open, focus verified result with recovery reference. |
| Rolled back | Non-success alert; show verified rollback and retained recovery reference. |
| Annotations incomplete | Non-success alert; show that project bytes verified and remain in place, annotations were not saved, and the pre-restore recovery reference remains retained. |
| Recovery required | Non-success alert; show retained recovery reference and reconnect guidance. |
| Mount lost | Stop further writes; do not switch to local fixture; show source-specific reconnect copy. |

Changing the selected slot replaces the preview synchronously from current state and clears any previous result. A state refresh invalidates selections whose fingerprints changed. Do not preserve a stale confirmation across refresh.

## Keyboard, Focus, and Accessibility

- Every selector has a visible `<label>` and a unique archive-specific ID.
- Native selects, buttons, disclosures, and confirmation dialogs retain platform keyboard behavior.
- Target matrices have accessible names and decorative cells remain hidden.
- Busy and result updates use the existing polite live region; post-mutation failure uses `role="alert"`.
- Focus moves only after an explicit action: to the target preview after selection when needed, and to the result after completion/failure.
- Disabled reasons are visible inline, never tooltip-only.
- Long names, receipt IDs, and evidence wrap with `overflow-wrap: anywhere`.

## Responsive Layout

- Above 900px, the target selector/action column sits beside the preview matrix/evidence.
- At 900px and below, it becomes one column; buttons wrap beneath the preview.
- At 720px and below, selectors and action buttons use the available width and retain 16px page gutters.
- No page-level horizontal scrolling. Only existing evidence tables may scroll within their own container.

## Motion

Use only existing focus/hover/disclosure transitions. Respect the existing `prefers-reduced-motion` override. Do not auto-scroll, animate verification, or use timed progress that could imply success.

## Exact Copy

| Element | Copy |
|---------|------|
| Group heading | `Restore` |
| Selector label | `restore to slot` |
| Placeholder | `choose a slot…` |
| Primary | `restore project` |
| Secondary | `restore whole instrument grid` |
| Safety note | `A verified automatic backup will be created before this slot changes.` |
| Project busy | `protecting and restoring slot {NN}…` |
| Grid busy | `protecting and restoring the whole instrument grid…` |
| Success | `restore verified` |
| Failure | `restore did not complete` |
| Annotation failure | `Project bytes were restored and verified, but song annotations were not saved. The restore did not fully complete. Recovery {id} remains retained.` |
| Stale archive | `Archive changed. Refresh before restoring.` |
| Stale target | `Slot {NN} changed after preview. Refresh and review it again.` |
| Mounted verification | `Written bytes were reread and verified on the mounted OP-Z in Content Mode.` |
| Local verification | `Written bytes were reread and verified in the local fixture.` |
| Hardware boundary | `Safely eject and let the OP-Z synchronize before relying on the restored content in normal mode.` |

Show the hardware-boundary copy only when the completed operation used a mounted OP-Z source.

## UI Considerations

| Category | Resolution |
|----------|------------|
| empty | Archive Shelf retains existing empty state; restore controls do not render. |
| loading | Existing shelf skeletons; mutation busy copy and global disabling. |
| error | Focused sanitized result with retained recovery reference when available. |
| populated | Unselected target → exact live preview → one explicit action. |
| partial | Project-only verified archive can restore project but never exposes grid restore. |
| overflow | Names/IDs wrap; no clipped safety copy. |
| zero-one-many | Same row contract for every archive and all ten targets. |
| long-text | Full recovery reference remains selectable and visible. |

## Registry Safety

No registry, shadcn component, third-party dependency, or external UI code is used.

## Approval

Approved after UI safety review: 6/6 dimensions pass. The smallest safe UI is one Archive Shelf action group using native controls and the existing mutation/result state.

# Phase 1: Verified Transaction Foundation - Pattern Map

**Mapped:** 2026-08-25
**Files analyzed:** 3 new/modified files
**Analogs found:** 2 / 3

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `server.js` | controller / composition root | request-response + file-I/O | `server.js` source, helper, scan, and route sections | structural exact; transaction behavior is new |
| `app/index.html` | component / browser controller | event-driven + request-response | `app/index.html` source badge, API, confirmation, and toast paths | structural exact |
| `test/transaction.test.js` | integration test | file-I/O + request-response + concurrency | none | no analog |

Ponytail scope: keep the transaction seam and archive orchestration in `server.js`, keep UI feedback in `app/index.html`, and add one test file. Do not add a transaction module, framework, dependency, package manifest, queue, database, or generalized workflow abstraction.

## Pattern Assignments

### `server.js` (controller / composition root, request-response + file-I/O)

**Analog:** `server.js`

This is an in-place extension of the existing composition root. Copy its CommonJS, plain-function, synchronous-filesystem, and JSON route patterns. The current archive implementation is the behavior being replaced, not a safety pattern to preserve.

**Imports and path constants pattern** (`server.js:5-20`):

```js
'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { parseProject, parseNotes, parseTrackChunks } = require('./parser.js');
const { aifToWav, packInfo } = require('./aif.js');

const ROOT = __dirname;
const APP_DIR = path.join(ROOT, 'app');
const LIB_DIR = path.join(ROOT, 'library');
const AUTO_DIR = path.join(LIB_DIR, 'auto-backups');
const TRASH_DIR = path.join(LIB_DIR, 'instrument-trash');
```

Apply this directly: use the already imported `fs`, `path`, `crypto`, and `parseProject`. Add no dependency. New library paths should be constants next to `LIB_DIR` only if more than one call site needs them.

**Idle source-selection pattern** (`server.js:41-63`):

```js
function findDeviceRoot() {
  if (process.env.OPZ_ROOT && fs.existsSync(path.join(process.env.OPZ_ROOT, 'projects'))) {
    return { root: process.env.OPZ_ROOT, device: true, label: path.basename(process.env.OPZ_ROOT) };
  }
  try {
    for (const v of fs.readdirSync('/Volumes')) {
      const r = path.join('/Volumes', v);
      if (fs.existsSync(path.join(r, 'projects')) && fs.existsSync(path.join(r, 'samplepacks'))) {
        return { root: r, device: true, label: v };
      }
    }
  } catch {}
  return null;
}
function getSource() {
  const dev = findDeviceRoot();
  if (dev) return { ...dev, path: path.join(dev.root, 'projects') };
  const copyRoot = path.join(ROOT, 'opzdisk');
  if (fs.existsSync(path.join(copyRoot, 'projects'))) {
    return { root: copyRoot, path: path.join(copyRoot, 'projects'), device: false, label: 'local copy (opzdisk)' };
  }
  return null;
}
```

Reuse `getSource()` exactly once when capturing a transaction. Do not copy its fallback behavior into revalidation: after capture, validate the pinned canonical root and device identity directly and pass the captured plain object through every source-dependent helper.

**Read-once and parse pattern** (`server.js:66-90`):

```js
function scanSlots(meta) {
  const src = getSource();
  if (!src) return { source: null, slots: [] };
  const slots = [];
  for (let i = 1; i <= 10; i++) {
    const nn = String(i).padStart(2, '0');
    const file = path.join(src.path, `project${nn}.opz`);
    if (!fs.existsSync(file)) { slots.push({ slot: i, empty: true }); continue; }
    try {
      const buf = fs.readFileSync(file);
      const hash = hashFile(buf);
      const parsed = parseProject(buf);
      slots.push({
        slot: i, file: `project${nn}.opz`, hash,
        modified: fs.statSync(file).mtime,
        tempo: parsed.tempo, swing: parsed.swing, mixer: parsed.mixer,
        chains: parsed.chains, usedPatterns: parsed.usedPatterns,
        patterns: parsed.patterns.filter(p => p.noteCount > 0),
        meta: meta.songs[hash] || null,
      });
    } catch (e) {
      slots.push({ slot: i, file: `project${nn}.opz`, error: e.message });
    }
  }
  return { source: { device: src.device, label: src.label }, slots };
}
```

Copy the buffer-first shape, but transaction capture must validate the slot before deriving its filename, read the project exactly once, and retain the buffer in the transaction object. Keep the existing short MD5 `hashFile()` only for metadata compatibility; compute separate full SHA-256 verification evidence with the existing `crypto` import.

**Filesystem helper style** (`server.js:128-143`):

```js
function slotFiles(dir) {
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => !f.startsWith('.')) : [];
}
function moveSlotContents(fromDir, toDir) {
  fs.mkdirSync(toDir, { recursive: true });
  for (const f of slotFiles(fromDir)) fs.renameSync(path.join(fromDir, f), path.join(toDir, f));
}
function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from)) {
    if (f.startsWith('.')) continue;
    const a = path.join(from, f), b = path.join(to, f);
    if (fs.statSync(a).isDirectory()) copyDir(a, b);
    else fs.copyFileSync(a, b);
  }
}
```

Keep new filesystem helpers focused and adjacent to this subsystem. Use Node primitives directly: `fs.mkdtempSync()` for a unique hidden draft, `fs.writeFileSync(..., { flush: true })`, `fs.readFileSync()`, `Buffer.equals()`, and one final `fs.renameSync()` within `LIB_DIR`.

**Library eligibility and evidence-reading pattern** (`server.js:147-180`):

```js
const scanDir = (dir, auto) => {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    try {
      const st = fs.statSync(full);
      if (st.isDirectory() && fs.existsSync(path.join(full, 'song.opz'))) {
        const buf = fs.readFileSync(path.join(full, 'song.opz'));
        let info = {};
        try { info = JSON.parse(fs.readFileSync(path.join(full, 'info.json'), 'utf8')); } catch {}
        const parsed = parseProject(buf);
        items.push({
          file: f, bundle: true, auto, hash: hashFile(buf),
          modified: st.mtime, tempo: parsed.tempo, usedPatterns: parsed.usedPatterns,
          name: info.name, fromSlot: info.fromSlot,
          hasInstruments: fs.existsSync(path.join(full, 'samplepacks')),
          instruments: info.instruments || null,
          meta: meta.songs[hashFile(buf)] || null,
        });
      }
    } catch {}
  }
};
```

Preserve the scan-and-parse shape, but make eligibility stricter: skip dot-prefixed root entries, require verification evidence for restore-eligible bundles, and report hidden partial/failed drafts separately as `verified: false`. Never rely on CSS to hide them.

**Request parsing, naming, and current bundle boundary** (`server.js:223-255`):

```js
function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }
function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', c => { b += c; if (b.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch (e) { reject(e); } });
  });
}
function safeName(s) { return (s || 'untitled').replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 60) || 'untitled'; }
function stamp() { return new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19); }
function projFile(slot) {
  const src = getSource();
  if (!src) throw new Error('no source');
  return path.join(src.path, `project${String(slot).padStart(2, '0')}.opz`);
}
function findBundle(file, auto) {
  const dir = path.join(auto ? AUTO_DIR : LIB_DIR, path.basename(file));
  if (fs.existsSync(path.join(dir, 'song.opz'))) return { dir, opz: path.join(dir, 'song.opz'), bundle: true };
  if (fs.existsSync(dir) && dir.endsWith('.opz')) return { dir: null, opz: dir, bundle: false };
  throw new Error('library item not found');
}
```

Reuse `json()`, `readBody()`, `safeName()`, and `stamp()`. Do not reuse `projFile(slot)` inside a transaction because it resolves the source again. Harden `findBundle()` instead of copying its basename-normalization weakness: require the supplied identifier to equal its basename, positively validate its type/length, derive under the chosen library root, and verify containment with `path.resolve()`/`path.relative()` before filesystem access.

**Route orchestration and centralized API error pattern** (`server.js:313-325`, `server.js:342-360`, `server.js:546-548`):

```js
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  try {
    if (p === '/api/state') {
      const meta = loadMeta();
      return json(res, 200, {
        ...scanSlots(meta),
        library: scanLibrary(meta),
        recordings: scanRecordings(),
        instruments: scanInstruments(),
      });
    }
```

```js
if (p === '/api/backup' && req.method === 'POST') {
  const body = await readBody(req); // {slot, name, deep}
  const meta = loadMeta();
  const src = getSource();
  const buf = fs.readFileSync(projFile(body.slot));
  const hash = hashFile(buf);
  const name = safeName(body.name || (meta.songs[hash] && meta.songs[hash].name) || `slot${body.slot}`);
  const dir = path.join(LIB_DIR, `${stamp()}_${name}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(projFile(body.slot), path.join(dir, 'song.opz'));
  const info = { name: body.name || name, fromSlot: body.slot, created: new Date().toISOString(), instruments: instrumentsSummary() };
  if (body.deep && src && fs.existsSync(path.join(src.root, 'samplepacks'))) {
    copyDir(path.join(src.root, 'samplepacks'), path.join(dir, 'samplepacks'));
    info.deep = true;
  }
  fs.writeFileSync(path.join(dir, 'info.json'), JSON.stringify(info, null, 2));
  if (body.name) { meta.songs[hash] = { ...(meta.songs[hash] || {}), name: body.name }; saveMeta(meta); }
  return json(res, 200, { ok: true, file: path.basename(dir) });
}
```

```js
} catch (e) {
  return json(res, 500, { error: e.message });
}
```

Keep route dispatch and the outer JSON error boundary. Replace only the unsafe archive body with this order:

1. Validate request fields and reject if the global mutation guard is occupied.
2. Capture one source, canonical root/device identity, validated project path, source buffer, SHA-256, and byte length.
3. Create one hidden draft under `LIB_DIR` and write the captured buffer, never the source path.
4. Reread `song.opz`; compare length and `Buffer.equals()`; call `parseProject()` on the reread buffer.
5. Write and flush verification evidence inside the draft.
6. Revalidate the pinned source directly, then atomically rename the complete draft to its visible bundle name.
7. On failure, retain it below a hidden failure location (or leave it hidden if moving fails), never touch the source slot, and let the shared error path return guidance.
8. Clear the one module-level active transaction in an async-capable `try/finally` wrapper.

Guard all destructive routes through the same wrapper; do not create route-specific busy flags. Phase 1 only routes `/api/backup` through full stage/verify/publish behavior; restore execution and clearing remain outside the phase boundary, but their inputs/concurrency boundary can be guarded now as required by SAFE-02.

**Testability seam** (`server.js:551-559`):

```js
server.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}`;
  const src = getSource();
  console.log(`\n  OP-Z Manager running at ${url}`);
  console.log(`  Project source: ${src ? `${src.label}${src.device ? ' (DEVICE — writes go to the OP-Z)' : ''}` : 'NONE FOUND'}\n`);
  if (process.platform === 'darwin' && !process.env.NO_OPEN) {
    try { execSync(`open ${url}`); } catch {}
  }
});
```

Guard startup with `require.main === module` and export only the critical transaction/archive helpers needed by `test/transaction.test.js`. Do not split production logic into a new module solely for testing.

---

### `app/index.html` (component / browser controller, event-driven + request-response)

**Analog:** `app/index.html`

Keep markup, CSS, and browser JavaScript co-located. Extend the existing source badge, buttons, native dialogs, shared `api()`, and toast rather than adding components or a client state library.

**Source badge visual pattern** (`app/index.html:40-44`):

```css
#source { margin-left: auto; font: 11px/1.4 var(--mono); color: var(--dim); text-align: right; }
#source .st { display: inline-flex; align-items: center; gap: 6px; }
#source .st::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--faint); }
#source .st.on::before { background: #3f9e5f; }
#source .st.copy::before { background: #d9a514; }
```

Reuse these status classes for mounted OP-Z versus local fixture. Add the current mutation text in or beside this persistent area using the same small mono treatment; no new status component is needed.

**Native disabled-button styling point** (`app/index.html:51-62`):

```css
.btn { font: 500 11px/1 var(--mono); letter-spacing: .06em; color: var(--ink);
       background: var(--surface); border: 1px solid var(--line2); border-radius: 5px;
       padding: 7px 13px; cursor: pointer; transition: all .18s; white-space: nowrap; }
.btn:hover { border-color: var(--ink); }
.btn:active { transform: scale(.97); }
.btn:focus-visible, .tab:focus-visible, select:focus-visible, input:focus-visible, textarea:focus-visible {
  outline: 2px solid var(--accent); outline-offset: 1px; }
.btn.acc { background: var(--ink); border-color: var(--ink); color: var(--bg); }
```

Use the native `disabled` property on mutation controls and add one `.btn:disabled` rule. Preserve focus visibility and do not replace buttons with non-semantic elements.

**Shared result/error path** (`app/index.html:265-275`):

```js
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.style.display = 'block';
  clearTimeout(t._h); t._h = setTimeout(() => t.style.display = 'none', 3200);
}
async function api(path, body) {
  const r = await fetch(path, body ? { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) } : {});
  const j = await r.json();
  if (j.error) { toast(j.error); throw new Error(j.error); }
  return j;
}
```

Keep this one API funnel. Add the agreed same-origin mutation header here for POST bodies so every mutation receives it without route duplication. Continue displaying server error text through `toast()` and rethrowing for caller cleanup.

**Persistent source rendering** (`app/index.html:291-301`):

```js
function render() {
  setTab(tab);
  const srcEl = document.getElementById('source');
  if (!STATE.source) srcEl.innerHTML = '<span class="st">no device — connect OP-Z in disk mode<br>(hold a track key while powering on)</span>';
  else srcEl.innerHTML = STATE.source.device
    ? '<span class="st on">OP-Z connected · disk mode<br>changes write to device</span>'
    : '<span class="st copy">local copy · opzdisk/<br>not the connected device</span>';
  renderSlots(); renderLibrary(); renderInstruments();
  for (const id of ['swapA','swapB']) document.getElementById(id).innerHTML = slotOptions();
  if (SETTINGS.op1funEmail) document.getElementById('op1email').value = SETTINGS.op1funEmail;
  if (SETTINGS.op1funToken) document.getElementById('op1token').value = SETTINGS.op1funToken;
}
```

Reuse `STATE.source.device` and `STATE.source.label`; extend `/api/state` with server-owned mutation/draft state and render it here. The browser busy flag is immediate feedback only; the server guard remains authoritative across tabs.

**Archive confirmation and completion pattern** (`app/index.html:440-447`):

```js
async function backup(slot) {
  const s = STATE.slots.find(x => x.slot === slot);
  const name = prompt('Name for the library:', s.meta && s.meta.name || '');
  if (name === null) return;
  const deep = confirm('Deep backup?\n\nOK — include every sample pack (~25 MB) so the song can be fully reloaded later, instruments and all.\nCancel — song data only.');
  const r = await api('/api/backup', { slot, name, deep });
  toast('saved → ' + r.file); load();
}
```

Keep native `prompt()`/`confirm()` and async `api()` flow. Before the POST, explicitly confirm operation, captured source kind/label, slot, current song, and whether device data may change. Wrap mutation busy state in `try/finally`, use the server result for verified/failure wording and eject/reconnect/refresh guidance, then refresh state.

**Restore confirmation pattern** (`app/index.html:475-484`):

```js
async function restore(file, auto, hasInstruments, rid) {
  const slot = parseInt(document.getElementById(rid).value, 10);
  const target = STATE.slots.find(x => x.slot === slot);
  const tn = target && target.meta && target.meta.name || ('slot ' + slot);
  if (!confirm('Load "' + file + '" into slot ' + slot + '?\nCurrent contents (' + tn + ') back up automatically first.')) return;
  let restoreInstruments = false;
  if (hasInstruments) restoreInstruments = confirm('Also restore the saved instrument setup?\nSample packs on the device will be overwritten with the saved versions.');
  const r = await api('/api/restore', { file, auto, slot, restoreInstruments });
  toast('loaded' + (r.instrumentsRestored ? ' · instruments restored' : ''));
  load();
}
```

Reuse this as the confirmation model for destructive controls. Do not make unverified drafts restoreable: render them separately, label them unmistakably, and omit/disable their load action based on server-owned `verified: false` state.

---

### `test/transaction.test.js` (integration test, file-I/O + request-response + concurrency)

**Analog:** None in this repository.

Use the Phase 1 `RESEARCH.md` pattern and Node built-ins only:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
```

Keep one integration file and temporary copied fixture roots. Exercise exported critical helpers rather than duplicating their logic. Minimum runnable coverage:

- capture resolver called once and captured buffer/root/device identity remain pinned;
- successful hidden stage → reread → exact compare → parse → SHA-256/length evidence → publish;
- injected corruption or parse failure leaves source bytes unchanged, no visible archive, and a retained hidden failure;
- missing/replaced captured root fails without invoking fallback;
- invalid slots, non-boolean flags, path-shaped bundle IDs, and escaped paths fail before filesystem access;
- a second mutation is rejected while the first is held behind a Promise barrier;
- state/result exposes captured source and source-specific guidance.

Run with `node --test test/transaction.test.js`; do not introduce Jest, Vitest, fixtures framework, or per-helper test files.

## Shared Patterns

### OP-Z structural verification

**Source:** `parser.js:87-121`
**Apply to:** staged `song.opz` verification and fixture validity checks

```js
function parseProject(buf) {
  if (buf.length < PATTERN_BASE + NUM_PATTERNS * PATTERN_SIZE) {
    throw new Error(`unexpected .opz size ${buf.length}`);
  }
  const patterns = [];
  for (let p = 0; p < NUM_PATTERNS; p++) {
    const notes = parseNotes(buf, p);
    const perTrack = {};
    const stepGrid = MUSICAL_TRACKS.map(() => new Array(NUM_STEPS).fill(0));
    for (const n of notes) {
      const name = TRACKS[n.track][0];
      perTrack[name] = (perTrack[name] || 0) + 1;
      if (n.track < 8) stepGrid[n.track][n.step]++;
    }
    const musicalCount = notes.filter(n => MUSICAL_TRACKS.includes(n.track)).length;
    patterns.push({
      index: p,
      noteCount: musicalCount,
      totalNotes: notes.length,
      trackNotes: perTrack,
      activeTracks: Object.keys(perTrack),
      stepGrid,
    });
  }
  return {
    tempo: buf[520],
    mixer: { drums: buf[516], synth: buf[517], punch: buf[518], master: buf[519] },
    swing: buf[565],
    chains: parseChains(buf),
    patterns,
    usedPatterns: patterns.filter(p => p.noteCount > 0).map(p => p.index),
  };
}

module.exports = { parseProject, parseNotes, parseTrackChunks, TRACKS, PATTERN_BASE, PATTERN_SIZE };
```

The parse check must run against the reread stored buffer, not the captured source buffer. Do not add another validator or change `parser.js` for this phase.

### Error handling

**Sources:** `server.js:546-548`, `app/index.html:265-275`
**Apply to:** every guarded mutation

Server helpers throw `Error`; the composition-root catch converts it to `{ error }`; `api()` shows it and rethrows. Preserve retained failure-draft details and recovery guidance in the server message/result rather than adding logging or a second client error system.

### Source identity

**Source:** `server.js:41-63`
**Apply to:** all destructive routes

`getSource()` is for initial resolution only. The shared transaction boundary captures one plain object containing source kind/label, canonical root, filesystem device identity, validated project path, buffer, SHA-256, and byte length. Every transactional helper receives that object explicitly; none calls `getSource()` or zero-argument `projFile()`.

### Mutation serialization

**Source:** no existing implementation; required by `01-CONTEXT.md`
**Apply to:** every destructive route

Use one module-level active transaction and one async-capable wrapper with `try/finally`. Reject competing requests; do not queue. Publish active operation/source through `/api/state` for UI visibility.

### Filesystem publication

**Sources:** existing bundle root/layout at `server.js:18-20`, `server.js:145-180`; required ordering from `01-RESEARCH.md`
**Apply to:** `/api/backup`

Draft and final directory must both be children of `LIB_DIR` so `fs.renameSync()` stays on one filesystem. Write all bytes and evidence while hidden, verify the reread stored bytes, then publish once. Failures remain hidden and restore-ineligible; never delete them automatically in Phase 1.

### Input and path validation

**Sources:** current trust boundary at `server.js:225-255`; stricter behavior from `01-RESEARCH.md`
**Apply to:** mutation bodies before any filesystem access

Accept only integer slots 1–10, real booleans for flags, bounded strings for names, and identifiers equal to their basename. Resolve server-controlled children and use `path.relative()` to reject empty, absolute, or `..` escape paths. Browser validation/disabled state is not authoritative.

### Browser operation feedback

**Sources:** `app/index.html:265-301`, `app/index.html:440-484`
**Apply to:** all mutation controls

Reuse native `confirm()`, native `disabled`, shared `api()`, `toast()`, and the existing source badge. Confirmation and result text must repeat the captured source and operation. Mounted-device outcomes include eject/reconnect guidance; local-fixture outcomes say no OP-Z was changed and prompt refresh as appropriate.

## No Analog Found

| File / Pattern | Role | Data Flow | Reason |
|----------------|------|-----------|--------|
| `test/transaction.test.js` | integration test | file-I/O + request-response + concurrency | No tests or test conventions exist; use `node:test` and `node:assert/strict` from research. |
| Shared global mutation guard | middleware / utility | request-response + concurrency | No coordination primitive exists; implement one module-level guard in `server.js`, not a new module. |
| Hidden stage/verify/publish archive | service / filesystem utility | file-I/O | Existing backup publishes before verification; follow the locked research ordering and Node built-ins. |

## Metadata

**Analog search scope:** repository root JavaScript/HTML and test-like paths, excluding device/library data and legacy Unity bundle contents
**Files scanned in depth:** `server.js`, `app/index.html`, `parser.js`
**Pattern extraction date:** 2026-08-25
**Dependencies to add:** none

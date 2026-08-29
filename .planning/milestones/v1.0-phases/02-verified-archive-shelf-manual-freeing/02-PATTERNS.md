# Phase 2: Verified Archive Shelf & Manual Freeing - Pattern Map

**Mapped:** 2026-08-26
**Files analyzed:** 3 existing files to modify
**Analogs found:** 3 / 3

## Ponytail Scope Guard

The smallest implementation is an in-place extension of the three files below. Do not create a manifest module, archive service, controller layer, repository, component file, second archive renderer, test file, package manifest, dependency, build step, cache, router, session token, or stored eligibility flag. Keep `info.json` as the one manifest, `scanLibrary()` as the current-evidence classifier, `renderLibrary()` as the Songs-sidebar summary seam, and add the one Archive Shelf renderer beside the existing render loop.

Do not implement restore, automatic clearing, device writes, inferred pack subsets, synthesized empty projects, search, filters, pagination, or archive history. A `confirmed empty` result remains hardware-UAT-gated because no existing code or official documentation establishes the post-clear disk representation.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `server.js` | composition root / controller / filesystem service | file-I/O transaction + request-response | `server.js:193-285`, `server.js:581-679`, `server.js:725-800` | exact, same file and flow |
| `app/index.html` | browser component / view | request-response + DOM event-driven rendering | `app/index.html:267-363`, `app/index.html:483-540` | exact role; extend existing renderer |
| `test/transaction.test.js` | integration / security / static-UI / hardware-gated test | file-I/O + request-response | `test/transaction.test.js:22-170`, `test/transaction.test.js:488-633`, `test/transaction.test.js:785-844` | exact, same suite and fixtures |

## Pattern Assignments

### `server.js` (composition root/controller/filesystem service, file-I/O + request-response)

**Analog:** Extend the Phase 1 archive transaction, library scanner, containment checks, and route dispatch already in `server.js`. Keep focused helpers adjacent to those sections; do not split them into modules or layers.

**Imports and dependency boundary** (`server.js:5-14`):

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
```

Use Node built-ins and the existing parser only. No schema, routing, database, archive, or validation package belongs in this phase.

**Device-only versus fallback source pattern** (`server.js:103-124`):

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

Archive creation may preserve `getSource()` compatibility. Manual-free preflight and final confirmation must call the device-only seam (`findDeviceRoot()` or an adjacent focused equivalent) so a missing mount can never fall through to `opzdisk/`.

**Existing directory-copy and stored-byte evidence pattern** (`server.js:193-228`):

```js
function copyDir(from, to, manifest = [], relative = '') {
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from)) {
    if (f.startsWith('.')) continue;
    const a = path.join(from, f), b = path.join(to, f);
    const rel = path.join(relative, f);
    if (fs.statSync(a).isDirectory()) copyDir(a, b, manifest, rel);
    else {
      const buf = fs.readFileSync(a);
      fs.writeFileSync(b, buf, { flush: true });
      manifest.push({ path: rel.split(path.sep).join('/'), bytes: buf.length, sha256: sha256(buf) });
    }
  }
  return manifest;
}
function manifestMatches(root, manifest) {
  if (!Array.isArray(manifest)) return false;
  const actual = [];
  const walk = (dir, relative = '') => {
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir)) {
      if (f.startsWith('.')) continue;
      const full = path.join(dir, f);
      const rel = path.join(relative, f);
      const st = fs.lstatSync(full);
      if (st.isDirectory()) walk(full, rel);
      else if (st.isFile()) {
        const buf = fs.readFileSync(full);
        actual.push({ path: rel.split(path.sep).join('/'), bytes: buf.length, sha256: sha256(buf) });
      } else throw new Error('unsupported archive entry');
    }
  };
  try { walk(root); }
  catch { return false; }
  const byPath = (a, b) => a.path.localeCompare(b.path);
  return JSON.stringify(actual.sort(byPath)) === JSON.stringify(manifest.slice().sort(byPath));
}
```

Reuse the evidence shape `{ path, bytes, sha256 }`, archive-relative slash normalization, hidden-file exclusion, and fail-closed symlink/non-file behavior. Derive counts and totals during scan; do not duplicate them as authoritative manifest fields.

**Current-evidence scanner pattern** (`server.js:233-285`):

```js
function scanLibrary(meta, libraryRoot = LIB_DIR, autoRoot = AUTO_DIR) {
  const items = [];
  const scanDir = (dir, auto) => {
    for (const f of fs.readdirSync(dir)) {
      if (f.startsWith('.')) continue;
      const full = path.join(dir, f);
      let bundle = null;
      let modified = null;
      try {
        const st = fs.statSync(full);
        modified = st.mtime;
        if (st.isDirectory() && fs.existsSync(path.join(full, 'song.opz'))) {
          bundle = true;
          const buf = fs.readFileSync(path.join(full, 'song.opz'));
          let info = {};
          try { info = JSON.parse(fs.readFileSync(path.join(full, 'info.json'), 'utf8')); } catch {}
          const parsed = parseProject(buf);
          const evidence = info.verification || {};
          const storedPacks = path.join(full, 'samplepacks');
          const verified = evidence.verified === true
            && evidence.bytes === buf.length
            && evidence.sha256 === sha256(buf)
            && (info.deep !== true || (fs.existsSync(storedPacks) && manifestMatches(storedPacks, info.manifest)));
          items.push({
            file: f, bundle: true, auto, hash: hashFile(buf),
            modified: st.mtime, tempo: parsed.tempo, usedPatterns: parsed.usedPatterns,
            name: info.name, fromSlot: Number.isInteger(info.fromSlot) && info.fromSlot >= 1 && info.fromSlot <= 10 ? info.fromSlot : null,
            hasInstruments: fs.existsSync(path.join(full, 'samplepacks')),
            instruments: info.instruments || null,
            verified,
            meta: meta.songs[hashFile(buf)] || null,
          });
        }
      } catch {
        if (bundle !== null) items.push({ file: f, bundle, auto, modified, verified: false, errorCode: 'ARCHIVE_PARSE_FAILED' });
      }
    }
  };
  scanDir(libraryRoot, false);
  if (autoRoot && fs.existsSync(autoRoot)) scanDir(autoRoot, true);
  items.sort((a, b) => new Date(b.modified) - new Date(a.modified));
  return items;
}
```

Turn this seam into the sole strict schema-1 reader/classifier used by `/api/state`, one-bundle lookup, and manual-free inspection. Re-read manifest/project/pack/snippet bytes on each call. Return separate derived facts for `verified`, portability completeness, and current manual-free eligibility. Keep supported project-only records verified but ineligible; route legacy, malformed, unsupported, corrupt, or evidence-mismatched records to sanitized diagnostics.

**Pinned source identity and root-cause safety pattern** (`server.js:513-551`):

```js
function captureSource(slot, source) {
  validateSlot(slot);
  if (!source || typeof source.root !== 'string') throw new Error('no source');
  const root = fs.realpathSync(source.root);
  const rootStat = fs.statSync(root, { bigint: true });
  const projects = fs.realpathSync(path.join(root, 'projects'));
  const relative = path.relative(root, projects);
  if (!relative || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw new Error('invalid source projects path');
  const projectPath = path.join(projects, `project${String(slot).padStart(2, '0')}.opz`);
  const buffer = fs.readFileSync(projectPath);
  return {
    slot,
    device: source.device === true,
    label: String(source.label || (source.device ? 'OP-Z' : 'local copy')),
    root,
    rootDevice: String(rootStat.dev),
    rootInode: String(rootStat.ino),
    projectPath,
    buffer,
    sha256: sha256(buffer),
    bytes: buffer.length,
  };
}
```

Reuse this exact read-once project capture and SHA-256/byte identity. Persist only sanitized provenance and, if UAT proves it stable across remount, an opaque fingerprint—not root paths, credentials, or raw stat values.

**Archive transaction and atomic publication pattern** (`server.js:581-627`):

```js
function archiveCapturedProject(captured, options) {
  const libraryRoot = fs.realpathSync(options.libraryRoot);
  const name = safeName(options.name);
  const draft = fs.mkdtempSync(path.join(libraryRoot, '.partial-'));
  try {
    const storedPath = path.join(draft, 'song.opz');
    fs.writeFileSync(storedPath, captured.buffer, { flush: true });
    let manifest = null;
    let samplepacks = null;
    if (options.deep) {
      assertCapturedSource(captured);
      try {
        samplepacks = fs.realpathSync(path.join(captured.root, 'samplepacks'));
        if (!fs.statSync(samplepacks).isDirectory()) throw new Error('not a directory');
      } catch { throw sourceError('SOURCE_UNAVAILABLE', 'Captured sample packs are unavailable.'); }
      manifest = copyDir(samplepacks, path.join(draft, 'samplepacks'));
      assertCapturedSource(captured);
    }
    const stored = fs.readFileSync(storedPath);
    if (stored.length !== captured.bytes || !stored.equals(captured.buffer)) {
      throw archiveError('ARCHIVE_BYTES_MISMATCH', 'Stored project does not match the captured source.');
    }
    try { parseProject(stored); }
    catch (error) { throw archiveError('ARCHIVE_PARSE_FAILED', error.message); }
    assertCapturedSource(captured);
    const finalName = `${stamp()}_${name}_${path.basename(draft).slice(-6)}`;
    fs.renameSync(draft, path.join(libraryRoot, finalName));
    return { ok: true, verified: true, file: finalName, source: publicSource(captured) };
  } catch (error) {
    retainFailedDraft(draft, libraryRoot, captured, options.operation, error);
    throw error;
  }
}
```

Extend this function before its one final rename: snapshot sanitized metadata, resolve/copy an allowed snippet when portable, write/flush the versioned `info.json`, reread it through the shared strict classifier, revalidate every claimed included file, and call `assertCapturedSource()` once more. Do not add a second archive writer or publish before all checks pass.

**Identifier containment and verified lookup pattern** (`server.js:642-679`):

```js
function resolveChild(root, id) {
  validateBundleId(id);
  let base;
  let child;
  try {
    base = fs.realpathSync(root);
    child = fs.realpathSync(path.resolve(base, id));
  } catch { throw requestError(404, 'PATH_NOT_FOUND', 'Library item was not found.'); }
  const relative = path.relative(base, child);
  if (!relative || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw requestError(400, 'PATH_OUTSIDE_ROOT', 'Library item is outside the library.');
  }
  return child;
}
```

Use the existing positive `validateBundleId()` plus canonical child containment for any shelf detail or manual-free bundle ID. Extract the recording-root containment already used at `server.js:875-919` into one adjacent read-only resolver for snippet capture; do not create a new allowlist.

**Route and public error response pattern** (`server.js:725-745`, `server.js:928-934`):

```js
const server = http.createServer(async (req, res) => {
  try {
    let url;
    try { url = new URL(req.url, 'http://x'); }
    catch { throw requestError(400, 'INVALID_URL', 'Request URL is invalid.'); }
    requireLoopbackHost(req);
    const p = url.pathname;
    if (req.method === 'POST') requireMutationRequest(req);
    if (p === '/api/state') {
      const meta = loadMeta(testHooks.metaFile || META_FILE);
      return json(res, 200, {
        ...scanSlots(meta),
        library: scanLibrary(meta),
        drafts: scanDrafts(),
      });
    }
  } catch (e) {
    const safe = Number.isInteger(e.status) && /^[A-Z][A-Z0-9_]+$/.test(e.code || '')
      ? { error: e.message, code: e.code, guidance: e.guidance }
      : { error: 'Operation failed safely.', code: 'OPERATION_FAILED', guidance: 'Refresh and retry. If the source disconnected, reconnect it first.' };
    return json(res, Number.isInteger(e.status) ? e.status : 500, safe);
  }
});
```

Add one GET/read-only manual-free inspection route inside this dispatcher. It must rerun archive and mounted-slot checks and must not call `withMutation()`, `getSource()` fallback, or any filesystem write/delete/rename helper. Leave POST `/api/clear-slot` fenced for Phase 6.

---

### `app/index.html` (browser component/view, request-response + event-driven)

**Analog:** Extend the existing single-file tabs, fetch/render loop, matrix renderer, archive creation action, and `renderLibrary()` separation. Add one Archive Shelf renderer only; reduce the Songs sidebar to counts plus a link to it.

**Fetch, error, and shared mutation-state pattern** (`app/index.html:267-290`):

```js
function toast(msg) {
  const t = document.getElementById('toast');
  lastStatus = msg; t.textContent = msg; t.style.display = 'block';
  clearTimeout(t._h); t._h = setTimeout(() => t.style.display = 'none', 3200);
}
async function api(path, body) {
  const r = await fetch(path, body ? { method: 'POST', headers: {'Content-Type':'application/json','X-OPZ-Mutation':'1'}, body: JSON.stringify(body) } : {});
  const j = await r.json();
  if (j.error) {
    const message = [j.error, j.guidance || sourceGuidance(j.source, 'failure')].filter(Boolean).join(' · ');
    toast(message); throw new Error(message);
  }
  return j;
}
async function runMutation(operation, callback) {
  if (mutationBusy) return;
  mutationBusy = { operation, source: STATE && STATE.source };
  render();
  try { return await callback(); }
  finally {
    mutationBusy = null;
    render();
  }
}
```

Use `api(path)` with no body for manual-free GET checks. Keep archive creation inside `runMutation()` and checklist/preflight state outside it because the latter is read-only. Surface sanitized server guidance through the existing live status/toast path.

**Escaping boundary** (`app/index.html:291-293`):

```js
function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
function attr(s) { return String(s || '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;'); }
function audioUrl(path, root) { return '/audio?path=' + encodeURIComponent(path) + (root === 'device' ? '&root=device' : ''); }
```

Every manifest-derived name, tag, note, label, relative path, diagnostic reason, and hash inserted into HTML must pass `esc()` or `attr()` according to context. Never render raw internal errors or local absolute paths.

**Existing tab and render loop pattern** (`app/index.html:302-339`):

```js
async function load() {
  STATE = await api('/api/state');
  render();
}
function setTab(t) {
  tab = t; localStorage.setItem('opz.tab', t);
  document.getElementById('tab-songs').classList.toggle('active', t === 'songs');
  document.getElementById('tab-inst').classList.toggle('active', t === 'inst');
  document.getElementById('view-songs').style.display = t === 'songs' ? '' : 'none';
  document.getElementById('view-inst').classList.toggle('on', t === 'inst');
}

function render() {
  setTab(tab);
  const currentMutation = mutationBusy || STATE.mutation;
  renderSlots(); renderLibrary(); renderInstruments();
  document.querySelectorAll('[data-mutation]').forEach(button => {
    button.disabled = Boolean(currentMutation) || button.dataset.mutation === 'unavailable';
  });
}
```

Add `tab-archives`, `view-archives`, and one `renderArchives()` call here. Upgrade the three existing buttons to the approved native tablist/roving-tab semantics in place; do not add a router. Preserve the stored `tab` value and focus behavior.

**Matrix reuse pattern** (`app/index.html:342-363`):

```js
function matrixSvg(s, w) {
  const agg = Array.from({length: 8}, () => new Array(16).fill(0));
  let max = 0;
  for (const p of s.patterns) if (p.stepGrid) {
    for (let t = 0; t < 8; t++) for (let st = 0; st < 16; st++) {
      agg[t][st] += p.stepGrid[t][st];
      if (agg[t][st] > max) max = agg[t][st];
    }
  }
  // existing SVG cell rendering follows
}
```

Pass archive parser output into this function. Add an optional accessible-label argument if needed, but do not store SVG/HTML in the manifest and do not create a second matrix renderer.

**Archive creation action pattern** (`app/index.html:483-495`):

```js
async function backup(slot) {
  const s = STATE.slots.find(x => x.slot === slot);
  const name = prompt('Name for the library:', s.meta && s.meta.name || '');
  if (name === null) return;
  const source = STATE.source ? STATE.source.label : 'no source';
  const song = s.meta && s.meta.name || name || 'untitled';
  if (!confirm('Archive slot ' + slot + ' — "' + song + '"?\nSource: ' + source + '\nDevice data: will not change.')) return;
  await runMutation('archive slot ' + slot, async () => {
    const r = await api('/api/backup', { slot, name, deep: true });
    toast('verified → ' + r.file + ' · ' + (r.guidance || sourceGuidance(r.source, 'success')));
    await load();
  });
}
```

Keep the same action seam, change the label/copy to `archive complete song`, and always request the complete deep archive. On success, select Archive Shelf and focus the new archive summary. No second archive action is needed.

**Verified/diagnostic separation pattern** (`app/index.html:497-540`):

```js
function renderLibrary() {
  const lib = document.getElementById('library');
  const verified = STATE.library.filter(i => i.verified === true);
  const unverified = STATE.library.filter(i => i.verified !== true);
  lib.innerHTML = '<div class="lbl">verified archives</div><div id="verifiedArchives"></div>' +
    '<div class="lbl">unverified diagnostics</div><div id="unverifiedDrafts"></div>';
  // verified and diagnostics are rendered in separate loops
}
```

Preserve the two independent collections, but make `renderLibrary()` output counts plus `open archive shelf` only. Move the actual rows into one `renderArchives()` function. Use native `<details><summary>` for verified and diagnostic rows; diagnostics must never render manual-free, restore, or target-slot controls. Do not keep sidebar cards as a second renderer.

**Browser-native disclosure/checklist pattern:** no existing `<details>` or checklist analog exists. Use the native platform controls required by `02-UI-SPEC.md`: one `<details><summary>` per archive, labelled checkboxes for physical steps 1-4, and a button for the read-only final refresh. This is a platform extension inside the existing renderer, not a reason to add a UI library or component abstraction.

---

### `test/transaction.test.js` (integration/security/static UI test, file-I/O + request-response)

**Analog:** Extend the one existing dependency-free suite. Reuse `tempRoots()`, `request()`, `requestJson()`, `testHooks`, static HTML assertions, and the `OPZ_HARDWARE_UAT` skip gate. Do not add a second test file, framework, fixture system, or browser harness.

**Imports and disposable filesystem fixture pattern** (`test/transaction.test.js:1-37`):

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { parseProject } = require('../parser.js');

function tempRoots(t, bytes = fs.readFileSync(FIXTURE)) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'opz-transaction-'));
  const sourceRoot = path.join(base, 'source');
  const projects = path.join(sourceRoot, 'projects');
  const libraryRoot = path.join(base, 'library');
  fs.mkdirSync(projects, { recursive: true });
  fs.mkdirSync(path.join(sourceRoot, 'samplepacks'), { recursive: true });
  fs.mkdirSync(libraryRoot, { recursive: true });
  fs.writeFileSync(path.join(projects, 'project01.opz'), bytes);
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  return { sourceRoot, libraryRoot, source: { root: sourceRoot, path: projects, device: false, label: 'temporary fixture' } };
}
```

Extend this fixture locally with metadata, recording roots, snippets, and versioned manifests. Keep cleanup registered through `t.after()`.

**Archive stored-byte tamper test pattern** (`test/transaction.test.js:92-136`):

```js
const result = subject.archiveCapturedProject(captured, { libraryRoot, name: 'Tracer song', deep: false });
const bundle = path.join(libraryRoot, result.file);
const stored = fs.readFileSync(path.join(bundle, 'song.opz'));
const info = JSON.parse(fs.readFileSync(path.join(bundle, 'info.json'), 'utf8'));
assert.ok(stored.equals(fixture));
assert.equal(info.verification.sha256, crypto.createHash('sha256').update(stored).digest('hex'));
assert.equal(subject.scanLibrary({ songs: {} }, libraryRoot, null)[0].verified, true);

info.verification.sha256 = '0'.repeat(64);
fs.writeFileSync(path.join(bundle, 'info.json'), JSON.stringify(info));
assert.equal(subject.scanLibrary({ songs: {} }, libraryRoot, null)[0].verified, false);
```

Repeat this one-tamper-at-a-time pattern for schema version, project bytes, pack bytes, included snippet bytes/path, missing files, unsupported schema, and malformed evidence. Assert project verification, completeness, and eligibility independently.

**Containment and fail-closed lookup pattern** (`test/transaction.test.js:488-521`):

```js
for (const id of ['', '.', '..', '/tmp/x', '../x', 'x/y', 'x\\y']) {
  assert.throws(() => subject.validateBundleId(id), error => error.code === 'INVALID_BUNDLE_ID');
}
assert.throws(() => subject.resolveChild(libraryRoot, 'escaped'), error => error.code === 'PATH_OUTSIDE_ROOT');
assert.throws(() => subject.findBundle('legacy', false, libraryRoot, null), error => error.code === 'BUNDLE_UNVERIFIED');
assert.throws(() => subject.findBundle('mismatch', false, libraryRoot, null), error => error.code === 'BUNDLE_UNVERIFIED');
```

Use the same pattern for snippet traversal, symlink escape, absolute paths, unknown status, and diagnostic-only bundles.

**Sanitized diagnostic pattern** (`test/transaction.test.js:544-633`):

```js
const drafts = subject.scanDrafts(corrupt.libraryRoot);
assert.equal(drafts[0].verified, false);
assert.equal(drafts[0].errorCode, 'ARCHIVE_BYTES_MISMATCH');
assert.ok(!JSON.stringify(drafts).includes(corrupt.sourceRoot));

const items = subject.scanLibrary({ songs: {} }, libraryRoot, null);
assert.equal(items[0].verified, false);
assert.equal(items[0].errorCode, 'ARCHIVE_PARSE_FAILED');
assert.ok(!JSON.stringify(items).includes(libraryRoot));
```

Assert that unknown/legacy/partial/corrupt/unsupported records remain visible, never contain absolute roots/raw errors/settings secrets, and never receive manual-free or restore eligibility.

**Read-only HTTP route pattern** (`test/transaction.test.js:368-393`):

```js
await new Promise((resolve, reject) => subject.server.listen(0, '127.0.0.1', resolve).once('error', reject));
t.after(() => { if (subject.server.listening) subject.server.close(); });

const hostile = await request(subject.server, '/api/state', { headers: { Host: 'attacker.example' } });
assert.equal(hostile.status, 403);
assert.equal(hostile.body.code, 'HOST_MISMATCH');

subject.testHooks.sourceResolver = () => null;
const disconnected = await request(subject.server, '/audio?root=device&path=' + encodeURIComponent('bounces/escape.wav'), { raw: true });
assert.equal(disconnected.status, 404);
```

Exercise manual-free inspection through the real HTTP server. Snapshot source and archive directory names/hashes before and after both preflight and final refresh; assert byte-for-byte equality and that no write helper is reached. Cover mount unavailable, exact archived song present, unexpected replacement, and only the hardware-proven empty representation.

**Static UI segregation and action-absence pattern** (`test/transaction.test.js:785-799`):

```js
const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
const body = /function renderLibrary\(\) \{([\s\S]*?)\n\}\nasync function restore/.exec(html)[1];
assert.match(body, /STATE\.library\.filter\(i => i\.verified === true\)/);
assert.match(body, /STATE\.library\.filter\(i => i\.verified !== true\)/);

const unverified = /for \(const it of unverified\)([\s\S]*?)for \(const draft/.exec(body)[1];
assert.doesNotMatch(unverified, /onclick="restore|<select/);
```

Extend static assertions for one `renderArchives()` implementation, `details/summary`, tablist/ARIA semantics, accessible matrix naming, escaped evidence, exact checklist copy, diagnostics action absence, and absence of any POST/device mutation in the manual-free flow.

**Hardware acceptance gate pattern** (`test/transaction.test.js:801-844`):

```js
test('mounted API archive UAT', { skip: process.env.OPZ_HARDWARE_UAT !== '1' }, async t => {
  const mountedRoot = '/Volumes/OP-Z';
  const sourcePath = path.join(mountedRoot, 'projects', 'project01.opz');
  assert.ok(fs.existsSync(sourcePath), 'mounted slot 1 must exist');
  const before = fs.readFileSync(sourcePath);
  const beforeSha256 = crypto.createHash('sha256').update(before).digest('hex');
  // exercise API
  const after = fs.readFileSync(sourcePath);
  assert.equal(after.length, before.length);
  assert.equal(crypto.createHash('sha256').update(after).digest('hex'), beforeSha256);
});
```

Add the Phase 2 mounted preflight/read-only check behind the same explicit flag. The physical clear/remount observation must be a human checkpoint with an expendable fully archived slot; record the actual result before enabling or testing `confirmed empty`. Do not guess from file absence or `usedPatterns.length === 0`.

## Shared Patterns

### Validation and containment

**Sources:** `server.js:436-503`, `server.js:642-679`, `server.js:875-919`

Apply positive type/range/status/schema validation before filesystem access. Resolve bundle and snippet paths canonically, require containment within an allowed root, and require regular supported files. Keep archive-relative paths in manifests and public responses.

### Stored-byte verification

**Sources:** `server.js:193-228`, `server.js:513-551`, `server.js:581-627`

Read once from the pinned source, write the captured buffer into a hidden draft, flush, reread, compare bytes/hash/length, parse the stored `.opz`, verify pack/snippet evidence, reread the manifest through the shared classifier, revalidate the source, then perform one atomic rename. Visible archive publication is the final filesystem action.

### Error handling and diagnostics

**Sources:** `server.js:385-402`, `server.js:565-579`, `server.js:928-934`

Use stable uppercase public codes, sanitized messages/guidance, retained `.failed` drafts, and a generic fallback for unexpected errors. Never serialize absolute paths, credentials, stack traces, or raw internal errors.

### Browser output safety and accessibility

**Sources:** `app/index.html:57-72`, `app/index.html:267-339`, `app/index.html:497-540`

Escape all evidence, retain visible text for every status, use the existing polite live region and focus outline, and use native tab/details/checkbox semantics. Status color is supplementary only.

### Verification, completeness, and eligibility are separate

**Apply to:** `scanLibrary()` output, Archive Shelf badges/details, and manual-free preflight.

- `verified`: current stored project and every claimed included file match evidence and parse/validate.
- `complete`: verified project + metadata snapshot + whole-grid capture + snippet status `included` with valid evidence or `unlinked`.
- `eligible`: ephemeral current preflight result requiring a complete archive, known slot, mounted device, and matching current source/slot identity.

Never persist `eligible`, and never collapse these facts into one `safe` badge.

## Capability Gaps (No Existing Analog)

| Capability | Owning Existing File | Required Minimal Pattern | Why No Analog |
|---|---|---|---|
| Native archive disclosure and manual checklist | `app/index.html` | Browser-native `<details><summary>` and labelled checkboxes inside the one new shelf renderer | No current disclosures/checklists exist; native HTML is sufficient |
| Cleared-slot success classifier | `server.js` + `test/transaction.test.js` | Hardware-observed fixture/rule behind `OPZ_HARDWARE_UAT` | Official docs and current fixtures do not define post-clear disk bytes |

The planner must not answer either gap by adding modules or dependencies. The first is a small in-file native UI addition; the second is a hardware checkpoint, not speculative code.

## Metadata

**Analog search scope:** `server.js`, `app/index.html`, `test/transaction.test.js`; phase context/research/UI contract; project instructions supplied in `AGENTS.md`
**Files scanned:** 3 source/test targets plus 3 required phase artifacts
**Pattern extraction date:** 2026-08-26
**Project skills:** no `.codex/skills/` or `.agents/skills/` project skill indexes found

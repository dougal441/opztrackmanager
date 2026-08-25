#!/usr/bin/env node
// OP-Z Manager — local server. No dependencies.
// Slots, song library (full bundles incl. instrument snapshots), instrument manager, audio.

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
const DATA_DIR = path.join(ROOT, 'data');
const META_FILE = path.join(DATA_DIR, 'meta.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const MUSIC_DIR = path.dirname(ROOT);
const PORT = 8765;

const PACK_TYPES = ['1-kick', '2-snare', '3-perc', '4-fx', '5-bass', '6-lead', '7-arpeggio', '8-chord'];

let activeMutation = null;

for (const d of [LIB_DIR, AUTO_DIR, TRASH_DIR, DATA_DIR]) fs.mkdirSync(d, { recursive: true });

// ---------- metadata ----------
function loadMeta() {
  try { return JSON.parse(fs.readFileSync(META_FILE, 'utf8')); }
  catch { return { songs: {} }; }
}
function saveMeta(meta) { fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2)); }
function hashFile(buf) { return crypto.createHash('md5').update(buf).digest('hex').slice(0, 16); }

// ---------- source detection ----------
// Device root = folder containing projects/ + samplepacks/ (OP-Z in disk mode)
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

// ---------- slots ----------
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

// ---------- instruments ----------
function scanInstruments(source) {
  const src = source || getSource();
  if (!src) return null;
  const spDir = path.join(src.root, 'samplepacks');
  if (!fs.existsSync(spDir)) return null;
  const grid = {};
  for (const type of PACK_TYPES) {
    grid[type] = [];
    for (let s = 1; s <= 10; s++) {
      const dir = path.join(spDir, type, String(s).padStart(2, '0'));
      let item = null;
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir).filter(f => !f.startsWith('.'));
        if (files.length) {
          const f = files[0];
          item = {
            file: f,
            name: f.replace(/^~/, '').replace(/\.(aif|aiff|engine)$/i, ''),
            builtin: f.startsWith('~'),
            engine: f.endsWith('.engine'),
            size: fs.statSync(path.join(dir, f)).size,
          };
        }
      }
      grid[type].push(item);
    }
  }
  return grid;
}
function packSlotDir(type, slot) {
  const src = getSource();
  if (!src || !PACK_TYPES.includes(type) || slot < 1 || slot > 10) throw new Error('bad pack slot');
  return path.join(src.root, 'samplepacks', type, String(slot).padStart(2, '0'));
}
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

// ---------- library (bundles) ----------
// Bundle = folder in library/: song.opz + info.json + optional samplepacks/
function scanLibrary(meta, libraryRoot = LIB_DIR, autoRoot = AUTO_DIR) {
  const items = [];
  const scanDir = (dir, auto) => {
    for (const f of fs.readdirSync(dir)) {
      if (f.startsWith('.')) continue;
      const full = path.join(dir, f);
      try {
        const st = fs.statSync(full);
        if (st.isDirectory() && fs.existsSync(path.join(full, 'song.opz'))) {
          const buf = fs.readFileSync(path.join(full, 'song.opz'));
          let info = {};
          try { info = JSON.parse(fs.readFileSync(path.join(full, 'info.json'), 'utf8')); } catch {}
          const parsed = parseProject(buf);
          const evidence = info.verification || {};
          const verified = evidence.verified === true
            && evidence.bytes === buf.length
            && evidence.sha256 === sha256(buf);
          items.push({
            file: f, bundle: true, auto, hash: hashFile(buf),
            modified: st.mtime, tempo: parsed.tempo, usedPatterns: parsed.usedPatterns,
            name: info.name, fromSlot: info.fromSlot,
            hasInstruments: fs.existsSync(path.join(full, 'samplepacks')),
            instruments: info.instruments || null,
            verified,
            meta: meta.songs[hashFile(buf)] || null,
          });
        } else if (f.endsWith('.opz')) { // legacy flat file
          const buf = fs.readFileSync(full);
          const parsed = parseProject(buf);
          items.push({
            file: f, bundle: false, auto, hash: hashFile(buf),
            modified: st.mtime, tempo: parsed.tempo, usedPatterns: parsed.usedPatterns,
            verified: false,
            meta: meta.songs[hashFile(buf)] || null,
          });
        }
      } catch {}
    }
  };
  scanDir(libraryRoot, false);
  if (autoRoot && fs.existsSync(autoRoot)) scanDir(autoRoot, true);
  items.sort((a, b) => new Date(b.modified) - new Date(a.modified));
  return items;
}

function scanDrafts(libraryRoot = LIB_DIR) {
  const drafts = [];
  const add = (dir, id) => {
    try {
      let diagnostic = {};
      try { diagnostic = JSON.parse(fs.readFileSync(path.join(dir, 'failure.json'), 'utf8')); } catch {}
      const source = diagnostic.source && typeof diagnostic.source === 'object' ? {
        device: diagnostic.source.device === true,
        label: String(diagnostic.source.label || 'unknown source').slice(0, 80),
        slot: Number.isInteger(diagnostic.source.slot) ? diagnostic.source.slot : null,
      } : null;
      drafts.push({
        id,
        verified: false,
        operation: String(diagnostic.operation || 'archive').slice(0, 120),
        source,
        slot: Number.isInteger(diagnostic.slot) ? diagnostic.slot : null,
        time: diagnostic.time || fs.statSync(dir).mtime.toISOString(),
        errorCode: /^[A-Z0-9_]+$/.test(diagnostic.errorCode || '') ? diagnostic.errorCode : 'ARCHIVE_INCOMPLETE',
      });
    } catch {}
  };
  try {
    for (const name of fs.readdirSync(libraryRoot)) {
      if (name.startsWith('.partial-')) add(path.join(libraryRoot, name), name);
    }
    const failedRoot = path.join(libraryRoot, '.failed');
    if (fs.existsSync(failedRoot)) {
      for (const name of fs.readdirSync(failedRoot)) add(path.join(failedRoot, name), name);
    }
  } catch {}
  drafts.sort((a, b) => new Date(b.time) - new Date(a.time));
  return drafts;
}

function instrumentsSummary(source) {
  const grid = scanInstruments(source);
  if (!grid) return null;
  const out = {};
  for (const [type, slots] of Object.entries(grid)) {
    out[type] = slots.map(s => s ? s.name : null);
  }
  return out;
}

// ---------- recordings ----------
function scanRecordings() {
  const src = getSource();
  const roots = [
    path.join(MUSIC_DIR, 'OP-Z songs'),
    path.join(ROOT, 'bounces'),
    path.join(MUSIC_DIR, 'FlowStudio', 'Recordings'),
  ];
  if (src && src.device) roots.push(path.join(src.root, 'bounces'));
  const out = [];
  const walk = (dir, depth, base) => {
    if (depth > 3 || !fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir)) {
      if (f.startsWith('.')) continue;
      const full = path.join(dir, f);
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full, depth + 1, base);
      else if (/\.(wav|aiff?|mp3|m4a)$/i.test(f)) {
        out.push({ path: path.relative(base, full), root: base === MUSIC_DIR ? 'music' : 'device', name: f, size: st.size, modified: st.mtime });
      }
    }
  };
  roots.slice(0, 3).forEach(r => walk(r, 0, MUSIC_DIR));
  if (src && src.device) walk(path.join(src.root, 'bounces'), 0, src.root);
  out.sort((a, b) => new Date(b.modified) - new Date(a.modified));
  return out;
}

// ---------- helpers ----------
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
function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }
function transactionError(code, message, guidance, status) {
  const error = new Error(message);
  error.code = code;
  error.guidance = guidance;
  if (status) error.status = status;
  return error;
}
function sourceError(code, message) {
  return transactionError(code, message,
    'The captured source changed or disconnected. Reconnect the original source, refresh, and retry. No source data was changed.');
}
function archiveError(code, message) {
  return transactionError(code, message,
    'Archive verification failed. The source was not changed. Review the retained failed draft, then refresh and retry.');
}
function validSlot(slot) {
  if (!Number.isInteger(slot) || slot < 1 || slot > 10) throw new Error('slot must be an integer from 1 to 10');
  return slot;
}
function validateBackup(body) {
  if (!body || typeof body !== 'object') throw new Error('invalid archive request');
  validSlot(body.slot);
  if (typeof body.deep !== 'boolean') throw new Error('deep must be a boolean');
  if (typeof body.name !== 'string' || body.name.length > 120) throw new Error('name must be a string of at most 120 characters');
  return body;
}
function publicSource(source) {
  return { device: source.device, label: source.label, slot: source.slot };
}
function sourceGuidance(source) {
  return source.device
    ? 'Verified archive saved. Eject the OP-Z before disconnecting it.'
    : 'Verified archive saved. No OP-Z data changed. Refresh after connecting the OP-Z.';
}
function captureSource(slot, source) {
  validSlot(slot);
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
function assertCapturedSource(captured) {
  let root;
  try { root = fs.realpathSync(captured.root); }
  catch { throw sourceError('SOURCE_UNAVAILABLE', 'Captured source is no longer available.'); }
  let rootStat;
  try { rootStat = fs.statSync(root, { bigint: true }); }
  catch { throw sourceError('SOURCE_UNAVAILABLE', 'Captured source is no longer available.'); }
  if (root !== captured.root || String(rootStat.dev) !== captured.rootDevice || String(rootStat.ino) !== captured.rootInode) {
    throw sourceError('SOURCE_REPLACED', 'Captured source was replaced.');
  }
  let current;
  try { current = fs.readFileSync(captured.projectPath); }
  catch { throw sourceError('SOURCE_UNAVAILABLE', 'Captured project is no longer available.'); }
  if (current.length !== captured.bytes || sha256(current) !== captured.sha256) {
    throw sourceError('SOURCE_CHANGED', 'Captured project changed.');
  }
}
async function withMutation(operation, callback) {
  if (activeMutation) {
    throw transactionError('MUTATION_CONFLICT', 'Another mutation is already running.',
      'Wait for the current operation to finish, then refresh and retry.', 409);
  }
  const mutation = { operation: String(operation).slice(0, 120), started: new Date().toISOString(), source: null };
  activeMutation = mutation;
  try { return await callback(mutation); }
  finally { activeMutation = null; }
}
function retainFailedDraft(draft, libraryRoot, captured, operation, error) {
  const diagnostic = {
    operation: operation || `archive slot ${captured.slot}`,
    source: publicSource(captured),
    slot: captured.slot,
    time: new Date().toISOString(),
    errorCode: error.code || 'ARCHIVE_FAILED',
    verified: false,
  };
  try { fs.writeFileSync(path.join(draft, 'failure.json'), JSON.stringify(diagnostic, null, 2), { flush: true }); } catch {}
  try {
    const failedRoot = path.join(libraryRoot, '.failed');
    fs.mkdirSync(failedRoot, { recursive: true });
    fs.renameSync(draft, path.join(failedRoot, path.basename(draft)));
  } catch {}
}
function archiveCapturedProject(captured, options) {
  const libraryRoot = fs.realpathSync(options.libraryRoot);
  const name = safeName(options.name);
  const draft = fs.mkdtempSync(path.join(libraryRoot, '.partial-'));
  try {
    const storedPath = path.join(draft, 'song.opz');
    fs.writeFileSync(storedPath, captured.buffer, { flush: true });
    if (options.deep) {
      assertCapturedSource(captured);
      const samplepacks = path.join(captured.root, 'samplepacks');
      if (fs.existsSync(samplepacks)) copyDir(samplepacks, path.join(draft, 'samplepacks'));
      assertCapturedSource(captured);
    }
    if (typeof options.beforeVerify === 'function') options.beforeVerify(storedPath, draft);
    const stored = fs.readFileSync(storedPath);
    if (stored.length !== captured.bytes || !stored.equals(captured.buffer)) {
      throw archiveError('ARCHIVE_BYTES_MISMATCH', 'Stored project does not match the captured source.');
    }
    try { parseProject(stored); }
    catch (error) { throw archiveError('ARCHIVE_PARSE_FAILED', error.message); }
    assertCapturedSource(captured);
    const instruments = instrumentsSummary(captured);
    assertCapturedSource(captured);
    const verification = { verified: true, sha256: sha256(stored), bytes: stored.length, checked: new Date().toISOString() };
    const info = {
      name,
      fromSlot: captured.slot,
      created: new Date().toISOString(),
      instruments,
      deep: options.deep,
      verification,
    };
    fs.writeFileSync(path.join(draft, 'info.json'), JSON.stringify(info, null, 2), { flush: true });
    assertCapturedSource(captured);
    const finalName = `${stamp()}_${name}_${path.basename(draft).slice(-6)}`;
    fs.renameSync(draft, path.join(libraryRoot, finalName));
    return { ok: true, verified: true, file: finalName, source: publicSource(captured), evidence: verification, guidance: sourceGuidance(captured) };
  } catch (error) {
    const failure = /^(SOURCE_|ARCHIVE_)/.test(error.code || '')
      ? error
      : archiveError('ARCHIVE_FAILED', 'Archive could not be verified.');
    retainFailedDraft(draft, libraryRoot, captured, options.operation, failure);
    throw failure;
  }
}
function projFile(slot) {
  const src = getSource();
  if (!src) throw new Error('no source');
  return path.join(src.path, `project${String(slot).padStart(2, '0')}.opz`);
}
function autoBackupSlot(slot, meta) {
  const f = projFile(slot);
  if (!fs.existsSync(f)) return null;
  const buf = fs.readFileSync(f);
  const hash = hashFile(buf);
  const name = (meta.songs[hash] && meta.songs[hash].name) || `slot${slot}`;
  const dir = path.join(AUTO_DIR, `${stamp()}_${safeName(name)}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(f, path.join(dir, 'song.opz'));
  fs.writeFileSync(path.join(dir, 'info.json'), JSON.stringify({ name, fromSlot: slot, auto: true, instruments: instrumentsSummary() }, null, 2));
  return path.basename(dir);
}
function findBundle(file, auto) {
  const id = path.basename(file);
  if (id.startsWith('.')) throw new Error('library item not found');
  const dir = path.join(auto ? AUTO_DIR : LIB_DIR, id);
  if (fs.existsSync(path.join(dir, 'song.opz'))) return { dir, opz: path.join(dir, 'song.opz'), bundle: true };
  if (fs.existsSync(dir) && dir.endsWith('.opz')) return { dir: null, opz: dir, bundle: false };
  throw new Error('library item not found');
}

// ---------- op1.fun helpers ----------
function fetchText(u, headers) {
  return new Promise((resolve, reject) => {
    https.get(u, { headers: { 'User-Agent': 'opz-manager/1.0', ...(headers || {}) } }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        return fetchText(new URL(r.headers.location, u).href, headers).then(resolve, reject);
      }
      if (r.statusCode >= 400) { r.resume(); return reject(new Error('op1.fun HTTP ' + r.statusCode)); }
      let b = ''; r.on('data', c => b += c); r.on('end', () => resolve(b));
    }).on('error', reject);
  });
}
function fetchBuffer(u, headers) {
  return new Promise((resolve, reject) => {
    https.get(u, { headers: { 'User-Agent': 'opz-manager/1.0', ...(headers || {}) } }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        return fetchBuffer(new URL(r.headers.location, u).href, headers).then(resolve, reject);
      }
      if (r.statusCode >= 400) { r.resume(); return reject(new Error('op1.fun HTTP ' + r.statusCode)); }
      const chunks = []; r.on('data', c => chunks.push(c)); r.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}
// Parse patch cards out of op1.fun listing HTML. Structure: links to
// /users/<user>/patches/<slug>, preview mp3 s3 URLs, drum/synth svg icons nearby.
function parseOp1FunListing(html) {
  const patches = [];
  const seen = new Set();
  const re = /href="(\/users\/([^"/]+)\/patches\/([^"/?#]+))"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const [, path2, user, slug] = m;
    if (seen.has(path2)) continue;
    seen.add(path2);
    // look around this match for a preview mp3 + type icon
    const ctx = html.slice(Math.max(0, m.index - 1500), m.index + 1500);
    const mp3 = (ctx.match(/https:\/\/op1fun\.s3\.amazonaws\.com\/[^"'\s]+\.mp3/) || [])[0] || null;
    const isDrum = /assets\/drum-/.test(ctx);
    const isSynth = /assets\/synth-/.test(ctx);
    const nameM = new RegExp('href="' + path2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*>([^<]+)<').exec(html);
    patches.push({
      path: path2, user, slug,
      name: nameM ? nameM[1].trim() : slug,
      type: isDrum ? 'drum' : isSynth ? 'synth' : 'unknown',
      preview: mp3,
    });
  }
  return patches.filter(p => p.name && p.name !== p.user);
}

// ---------- server ----------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.wav': 'audio/wav', '.aif': 'audio/aiff', '.aiff': 'audio/aiff',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.svg': 'image/svg+xml' };

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
        mutation: activeMutation,
        drafts: scanDrafts(),
      });
    }
    if (p === '/api/pattern') {
      const slot = parseInt(url.searchParams.get('slot'), 10);
      const pat = parseInt(url.searchParams.get('pattern'), 10);
      const buf = fs.readFileSync(projFile(slot));
      return json(res, 200, { tempo: parseProject(buf).tempo, notes: parseNotes(buf, pat), tracks: parseTrackChunks(buf, pat) });
    }
    if (p === '/api/meta' && req.method === 'POST') {
      const body = await readBody(req);
      const meta = loadMeta();
      if (!body.hash) return json(res, 400, { error: 'hash required' });
      meta.songs[body.hash] = { ...(meta.songs[body.hash] || {}), ...body.fields, updated: new Date().toISOString() };
      saveMeta(meta);
      return json(res, 200, { ok: true });
    }

    // ---- song library ----
    if (p === '/api/backup' && req.method === 'POST') {
      if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '') || req.headers['x-opz-mutation'] !== '1') {
        return json(res, 403, { error: 'archive request requires JSON and X-OPZ-Mutation' });
      }
      const body = validateBackup(await readBody(req));
      return await withMutation(`archive slot ${body.slot}`, async mutation => {
        const meta = loadMeta();
        const source = getSource();
        if (!source) throw new Error('no source');
        const captured = captureSource(body.slot, source);
        mutation.source = publicSource(captured);
        const hash = hashFile(captured.buffer);
        const name = body.name || (meta.songs[hash] && meta.songs[hash].name) || `slot${body.slot}`;
        const result = archiveCapturedProject(captured, {
          libraryRoot: LIB_DIR,
          name,
          deep: body.deep,
          operation: mutation.operation,
        });
        if (body.name) { meta.songs[hash] = { ...(meta.songs[hash] || {}), name: body.name }; saveMeta(meta); }
        return json(res, 200, result);
      });
    }
    if (p === '/api/restore' && req.method === 'POST') {
      const body = await readBody(req); // {file, auto, slot, restoreInstruments}
      const meta = loadMeta();
      const b = findBundle(body.file, body.auto);
      const backedUp = autoBackupSlot(body.slot, meta);
      fs.copyFileSync(b.opz, projFile(body.slot));
      let instrumentsRestored = false;
      if (body.restoreInstruments && b.bundle && fs.existsSync(path.join(b.dir, 'samplepacks'))) {
        const src = getSource();
        copyDir(path.join(b.dir, 'samplepacks'), path.join(src.root, 'samplepacks'));
        instrumentsRestored = true;
      }
      return json(res, 200, { ok: true, previousBackedUpTo: backedUp, instrumentsRestored });
    }
    if (p === '/api/swap' && req.method === 'POST') {
      const body = await readBody(req);
      const fa = projFile(body.a), fb = projFile(body.b);
      const ba = fs.readFileSync(fa), bb = fs.readFileSync(fb);
      fs.writeFileSync(fa, bb); fs.writeFileSync(fb, ba);
      return json(res, 200, { ok: true });
    }
    if (p === '/api/clear-slot' && req.method === 'POST') {
      // backup then overwrite with an empty-ish project? OP-Z has no "empty" file concept in disk mode;
      // safest is: backup to library, leave file. We just do the backup and tell the user to clear on device.
      const body = await readBody(req);
      const meta = loadMeta();
      const backedUp = autoBackupSlot(body.slot, meta);
      return json(res, 200, { ok: true, backedUp, note: 'Slot backed up. Clear the project on the device itself (project + erase) — the OP-Z rebuilds the file.' });
    }

    // ---- instruments ----
    if (p === '/api/instruments/move' && req.method === 'POST') {
      const body = await readBody(req); // {type, from, to}
      const a = packSlotDir(body.type, body.from), bdir = packSlotDir(body.type, body.to);
      const tmp = bdir + '.tmp-swap';
      if (slotFiles(bdir).length) { // swap
        moveSlotContents(bdir, tmp);
        moveSlotContents(a, bdir);
        moveSlotContents(tmp, a);
        fs.rmdirSync(tmp);
      } else {
        moveSlotContents(a, bdir);
      }
      return json(res, 200, { ok: true });
    }
    if (p === '/api/instruments/remove' && req.method === 'POST') {
      const body = await readBody(req); // {type, slot}
      const dir = packSlotDir(body.type, body.slot);
      const dest = path.join(TRASH_DIR, `${stamp()}_${body.type}-${body.slot}`);
      moveSlotContents(dir, dest);
      return json(res, 200, { ok: true, movedTo: path.basename(dest) });
    }
    if (p === '/api/instruments/import' && req.method === 'POST') {
      const body = await readBody(req); // {type, slot, source: relative-to-Music path of .aif}
      const srcFile = path.join(MUSIC_DIR, body.source || '');
      if (!srcFile.startsWith(MUSIC_DIR) || (body.source || '').includes('..')) return json(res, 403, { error: 'bad path' });
      if (!/\.(aif|aiff)$/i.test(srcFile)) return json(res, 400, { error: 'OP-Z accepts .aif sample packs only' });
      const dir = packSlotDir(body.type, body.slot);
      if (slotFiles(dir).length) return json(res, 400, { error: 'slot occupied — remove or move first' });
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(srcFile, path.join(dir, path.basename(srcFile)));
      return json(res, 200, { ok: true });
    }
    if (p === '/api/instruments/aifs') {
      // .aif files available for import (Music folder + instrument trash)
      const out = [];
      const walk = (dir, depth, base, label) => {
        if (depth > 4 || !fs.existsSync(dir)) return;
        for (const f of fs.readdirSync(dir)) {
          if (f.startsWith('.')) continue;
          const full = path.join(dir, f);
          if (fs.statSync(full).isDirectory()) walk(full, depth + 1, base, label);
          else if (/\.(aif|aiff)$/i.test(f)) out.push({ path: path.relative(MUSIC_DIR, full), name: f, from: label });
        }
      };
      walk(MUSIC_DIR, 0, MUSIC_DIR, 'music');
      return json(res, 200, out);
    }
    if (p === '/api/instruments/snapshot' && req.method === 'POST') {
      const src = getSource();
      const dest = path.join(LIB_DIR, `instruments_${stamp()}`);
      copyDir(path.join(src.root, 'samplepacks'), path.join(dest, 'samplepacks'));
      fs.writeFileSync(path.join(dest, 'info.json'), JSON.stringify({ type: 'instrument-snapshot', created: new Date().toISOString(), instruments: instrumentsSummary() }, null, 2));
      return json(res, 200, { ok: true, file: path.basename(dest) });
    }

    // ---- sample pack audio + info ----
    if (p === '/api/pack/audio' || p === '/api/pack/info') {
      const type = url.searchParams.get('type');
      const slot = parseInt(url.searchParams.get('slot'), 10);
      const dir = packSlotDir(type, slot);
      const files = slotFiles(dir).filter(f => /\.(aif|aiff)$/i.test(f));
      if (!files.length) return json(res, 404, { error: 'no sample pack in this slot (synth engine or empty)' });
      const buf = fs.readFileSync(path.join(dir, files[0]));
      if (!buf.length) return json(res, 404, { error: 'factory pack — audio lives in the OP-Z firmware, not on disk' });
      const key = type + '/' + slot + '/' + files[0];
      if (p === '/api/pack/info') {
        const info = packInfo(buf);
        info.file = files[0];
        return json(res, 200, info);
      }
      if (!global.__wavCache) global.__wavCache = new Map();
      let wav = global.__wavCache.get(key);
      if (!wav) { wav = aifToWav(buf); global.__wavCache.set(key, wav); if (global.__wavCache.size > 30) global.__wavCache.delete(global.__wavCache.keys().next().value); }
      res.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': wav.length, 'Cache-Control': 'max-age=60' });
      return res.end(wav);
    }

    // ---- settings ----
    if (p === '/api/settings' && req.method === 'GET') {
      try { return json(res, 200, JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'))); }
      catch { return json(res, 200, {}); }
    }
    if (p === '/api/settings' && req.method === 'POST') {
      const body = await readBody(req);
      let cur = {}; try { cur = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); } catch {}
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ ...cur, ...body }, null, 2));
      return json(res, 200, { ok: true });
    }

    // ---- op1.fun pack browser ----
    if (p === '/api/op1fun/browse') {
      const q = url.searchParams.get('q') || '';
      const ptype = url.searchParams.get('ptype') || ''; // drum | synth
      const page = url.searchParams.get('page') || '1';
      let target = 'https://op1.fun/patches?page=' + encodeURIComponent(page);
      if (q) target += '&q%5Bname_cont%5D=' + encodeURIComponent(q);
      if (ptype) target += '&q%5Bpatch_type_cont%5D=' + encodeURIComponent(ptype);
      const html = await fetchText(target);
      return json(res, 200, { patches: parseOp1FunListing(html), page: parseInt(page, 10) });
    }
    if (p === '/api/op1fun/download' && req.method === 'POST') {
      const body = await readBody(req); // { patchPath: "/users/x/patches/y", type, slot }
      let settings = {}; try { settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); } catch {}
      if (!settings.op1funEmail || !settings.op1funToken) {
        return json(res, 400, { error: 'op1.fun account needed: add email + API token in settings (op1.fun → account settings)' });
      }
      const dir = packSlotDir(body.type, body.slot);
      if (slotFiles(dir).length) return json(res, 400, { error: 'slot occupied — remove or move first' });
      const m = /\/users\/([^/]+)\/patches\/([^/?#]+)/.exec(body.patchPath || '');
      if (!m) return json(res, 400, { error: 'bad patch path' });
      const apiUrl = `https://api.op1.fun/v1/users/${m[1]}/patches/${m[2]}`;
      const j = JSON.parse(await fetchText(apiUrl, {
        'X-User-Email': settings.op1funEmail, 'X-User-Token': settings.op1funToken, 'Accept': 'application/json',
      }));
      const fileUrl = (j.data && j.data.links && j.data.links.file)
        || (JSON.stringify(j).match(/https?:\/\/[^"]+\.aif[^"]*/) || [])[0];
      if (!fileUrl) return json(res, 502, { error: 'no .aif download link in op1.fun response — check token' });
      const fileBuf = await fetchBuffer(fileUrl);
      const name = safeName((j.data && j.data.attributes && j.data.attributes.name) || m[2]) + '.aif';
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, name), fileBuf);
      return json(res, 200, { ok: true, file: name });
    }

    // ---- audio ----
    if (p === '/audio') {
      const rel = url.searchParams.get('path') || '';
      const rootParam = url.searchParams.get('root');
      let base = MUSIC_DIR;
      if (rootParam === 'device') { const src = getSource(); if (src && src.device) base = src.root; }
      const full = path.join(base, rel);
      if (!full.startsWith(base) || rel.includes('..')) { res.writeHead(403); return res.end(); }
      if (!fs.existsSync(full)) { res.writeHead(404); return res.end(); }
      const ext = path.extname(full).toLowerCase();
      const stat = fs.statSync(full);
      const range = req.headers.range;
      if (range) {
        const m = /bytes=(\d+)-(\d*)/.exec(range);
        const start = parseInt(m[1], 10);
        const end = m[2] ? parseInt(m[2], 10) : stat.size - 1;
        res.writeHead(206, { 'Content-Type': MIME[ext] || 'application/octet-stream',
          'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
        return fs.createReadStream(full, { start, end }).pipe(res);
      }
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': stat.size, 'Accept-Ranges': 'bytes' });
      return fs.createReadStream(full).pipe(res);
    }

    // ---- static ----
    let file = p === '/' ? '/index.html' : p;
    const full = path.join(APP_DIR, path.normalize(file));
    if (!full.startsWith(APP_DIR) || !fs.existsSync(full)) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'text/plain' });
    return fs.createReadStream(full).pipe(res);
  } catch (e) {
    const safe = /^(SOURCE_|ARCHIVE_|MUTATION_)/.test(e.code || '')
      ? { error: e.message, code: e.code, guidance: e.guidance }
      : { error: 'Operation failed safely.', code: 'OPERATION_FAILED', guidance: 'Refresh and retry. If the source disconnected, reconnect it first.' };
    return json(res, e.status || 500, safe);
  }
});

if (require.main === module) {
  server.listen(PORT, '127.0.0.1', () => {
    const url = `http://localhost:${PORT}`;
    const src = getSource();
    console.log(`\n  OP-Z Manager running at ${url}`);
    console.log(`  Project source: ${src ? `${src.label}${src.device ? ' (DEVICE — writes go to the OP-Z)' : ''}` : 'NONE FOUND'}\n`);
    if (process.platform === 'darwin' && !process.env.NO_OPEN) {
      try { execSync(`open ${url}`); } catch {}
    }
  });
}

module.exports = {
  captureSource,
  assertCapturedSource,
  withMutation,
  archiveCapturedProject,
  scanLibrary,
  scanDrafts,
  server,
};

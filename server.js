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
const META_TRACKS = ['kick', 'snare', 'hihat', 'sample', 'bass', 'lead', 'arp', 'chord'];
const mutationRouteInventory = Object.freeze({
  enabled: ['/api/backup'],
  unavailable: [
    '/api/restore', '/api/swap', '/api/clear-slot',
    '/api/instruments/move', '/api/instruments/remove', '/api/instruments/import',
    '/api/instruments/snapshot', '/api/op1fun/download',
  ],
});
const unavailableMutationGuidance = Object.freeze({
  '/api/restore': 'Restore returns in Phase 3 with verified target recovery and output checks.',
  '/api/swap': 'Slot swapping returns in Phase 3 with verified recovery capture.',
  '/api/clear-slot': 'Automatic clearing remains disabled until Phase 6 hardware validation.',
  '/api/instruments/move': 'Instrument changes return in Phase 3 with verified instrument recovery.',
  '/api/instruments/remove': 'Instrument changes return in Phase 3 with verified instrument recovery.',
  '/api/instruments/import': 'Instrument changes return in Phase 3 with verified instrument recovery.',
  '/api/instruments/snapshot': 'Instrument snapshots return in Phase 3 with guarded source capture.',
  '/api/op1fun/download': 'Pack installation returns in Phase 3 with verified instrument recovery.',
});

let activeMutation = null;
const testHooks = {};

for (const d of [LIB_DIR, AUTO_DIR, TRASH_DIR, DATA_DIR]) fs.mkdirSync(d, { recursive: true });
try { fs.chmodSync(SETTINGS_FILE, 0o600); } catch {}

// ---------- metadata ----------
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}
function loadMeta(file = META_FILE) {
  try {
    const meta = JSON.parse(fs.readFileSync(file, 'utf8'));
    return isPlainObject(meta) && isPlainObject(meta.songs) ? meta : { songs: {} };
  }
  catch { return { songs: {} }; }
}
function saveMeta(meta) { fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2)); }
function saveSettings(settings, file = SETTINGS_FILE) {
  const temp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}-${crypto.randomBytes(6).toString('hex')}.tmp`);
  try {
    fs.writeFileSync(temp, JSON.stringify(settings, null, 2), { mode: 0o600, flag: 'wx', flush: true });
    fs.renameSync(temp, file);
    fs.chmodSync(file, 0o600);
  } catch (error) {
    try { fs.unlinkSync(temp); } catch {}
    throw error;
  }
}
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

// ---------- library (bundles) ----------
// Bundle = folder in library/: song.opz + info.json + optional samplepacks/
function scanLibrary(meta, libraryRoot = LIB_DIR, autoRoot = AUTO_DIR) {
  const items = [];
  const scanDir = (dir, auto) => {
    for (const f of fs.readdirSync(dir)) {
      if (f.startsWith('.')) continue;
      const full = path.join(dir, f);
      let bundle = false;
      let modified = null;
      try {
        const st = fs.statSync(full);
        if (st.isDirectory() && fs.existsSync(path.join(full, 'song.opz'))) {
          bundle = true;
          modified = st.mtime;
          const buf = fs.readFileSync(path.join(full, 'song.opz'));
          let info = {};
          try { info = JSON.parse(fs.readFileSync(path.join(full, 'info.json'), 'utf8')); } catch {}
          const parsed = parseProject(buf);
          const evidence = info.verification || {};
          const verified = evidence.verified === true
            && evidence.bytes === buf.length
            && evidence.sha256 === sha256(buf)
            && (info.deep !== true || manifestMatches(path.join(full, 'samplepacks'), info.manifest));
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
      } catch {
        if (bundle) items.push({ file: f, bundle: true, auto, modified, verified: false, errorCode: 'ARCHIVE_PARSE_FAILED' });
      }
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
function json(res, code, obj, headers) {
  res.writeHead(code, { 'Content-Type': 'application/json', ...(headers || {}) });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 1e6) return reject(requestError(413, 'BODY_TOO_LARGE', 'Request body is too large.'));
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const body = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
        resolve(body ? JSON.parse(body) : {});
      } catch { reject(requestError(400, 'INVALID_JSON', 'Request body must be valid UTF-8 JSON.')); }
    });
  });
}
function safeName(s) { return (typeof s === 'string' ? s : 'untitled').replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 60) || 'untitled'; }
function stamp() { return new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19); }
function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }
function requestError(status, code, publicMessage, guidance = 'Correct the request and retry.') {
  const error = new Error(publicMessage);
  error.status = status;
  error.code = code;
  error.guidance = guidance;
  return error;
}
function transactionError(code, message, guidance, status) {
  return requestError(status || 500, code, message, guidance);
}
function sourceError(code, message) {
  return transactionError(code, message,
    'The captured source changed or disconnected. Reconnect the original source, refresh, and retry. No source data was changed.');
}
function archiveError(code, message) {
  return transactionError(code, message,
    'Archive verification failed. The source was not changed. Review the retained failed draft, then refresh and retry.');
}
function requireMutationRequest(req) {
  const contentType = String(req.headers['content-type'] || '');
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    throw requestError(415, 'JSON_REQUIRED', 'Mutation requests require application/json.');
  }
  const charset = /;\s*charset\s*=\s*"?([^;"\s]+)/i.exec(contentType);
  if (charset && !/^utf-?8$/i.test(charset[1])) {
    throw requestError(415, 'UNSUPPORTED_ENCODING', 'Mutation request JSON must use UTF-8.');
  }
  if (req.headers['x-opz-mutation'] !== '1') {
    throw requestError(403, 'MUTATION_HEADER_REQUIRED', 'Mutation request header is missing.');
  }
  if (req.headers['sec-fetch-site'] === 'cross-site') {
    throw requestError(403, 'CROSS_SITE_REQUEST', 'Cross-site mutation requests are not allowed.');
  }
  if (req.headers.origin) {
    let origin;
    try { origin = new URL(req.headers.origin); }
    catch { throw requestError(403, 'ORIGIN_MISMATCH', 'Mutation request origin does not match this server.'); }
    if (!/^https?:$/.test(origin.protocol) || origin.host !== req.headers.host) {
      throw requestError(403, 'ORIGIN_MISMATCH', 'Mutation request origin does not match this server.');
    }
  }
}
function validateSlot(slot) {
  if (!Number.isInteger(slot) || slot < 1 || slot > 10) {
    throw requestError(400, 'INVALID_SLOT', 'Slot must be an integer from 1 to 10.');
  }
  return slot;
}
function validateBoolean(value, name) {
  if (typeof value !== 'boolean') throw requestError(400, 'INVALID_BOOLEAN', `${name} must be a boolean.`);
  return value;
}
function validateString(value, name, max, allowEmpty = true) {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.length) || value.includes('\0')) {
    throw requestError(400, 'INVALID_STRING', `${name} must be a valid string of at most ${max} characters.`);
  }
  return value;
}
function validatePackType(type) {
  if (!PACK_TYPES.includes(type)) throw requestError(400, 'INVALID_PACK_TYPE', 'Unknown sample-pack type.');
  return type;
}
function validateBundleId(id) {
  if (typeof id !== 'string' || !id || id.length > 120 || id === '.' || id === '..'
      || id.startsWith('.') || /[\\/\0]/.test(id) || path.isAbsolute(id) || path.basename(id) !== id) {
    throw requestError(400, 'INVALID_BUNDLE_ID', 'Invalid library bundle identifier.');
  }
  return id;
}
function parseByteRange(header, size) {
  if (typeof header !== 'string' || !Number.isSafeInteger(size) || size <= 0) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return null;
  if (!match[1]) {
    const suffix = Number(match[2]);
    return Number.isSafeInteger(suffix) && suffix > 0
      ? { start: Math.max(0, size - suffix), end: size - 1 }
      : null;
  }
  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd)
      || start >= size || requestedEnd < start) return null;
  return { start, end: Math.min(requestedEnd, size - 1) };
}
function validateMetadataFields(fields) {
  const limits = { name: 120, tags: 1000, notes: 10000, wav: 2000, wavMatch: 40 };
  if (!isPlainObject(fields) || JSON.stringify(fields).length > 20000
      || Object.keys(fields).some(key => !Object.hasOwn(limits, key) && key !== 'kit')) {
    throw requestError(400, 'INVALID_METADATA', 'Invalid song metadata.');
  }
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'kit') {
      if (!isPlainObject(value) || Object.keys(value).some(track => !META_TRACKS.includes(track))
          || Object.values(value).some(slot => !Number.isInteger(slot) || slot < 1 || slot > 10)) {
        throw requestError(400, 'INVALID_METADATA', 'Invalid song metadata.');
      }
    } else if (typeof value !== 'string' || value.length > limits[key] || value.includes('\0')) {
      throw requestError(400, 'INVALID_METADATA', 'Invalid song metadata.');
    }
  }
  return fields;
}
function validateBackup(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw requestError(400, 'INVALID_REQUEST', 'Invalid archive request.');
  validateSlot(body.slot);
  validateBoolean(body.deep, 'deep');
  validateString(body.name, 'name', 120);
  return body;
}
function publicSource(source) {
  return { device: source.device, label: source.label, slot: source.slot };
}
function sourceGuidance(source) {
  return source.device
    ? 'Verified archive saved. Eject the OP-Z before disconnecting it; reconnect it and refresh before continuing.'
    : 'Verified archive saved. No OP-Z data changed. Refresh after connecting the OP-Z.';
}
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
    const conflict = transactionError('MUTATION_CONFLICT', 'Another mutation is already running.',
      'Wait for the current operation to finish, then refresh and retry.', 409);
    conflict.active = { operation: activeMutation.operation, started: activeMutation.started, source: activeMutation.source };
    throw conflict;
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
    let manifest = null;
    if (options.deep) {
      assertCapturedSource(captured);
      const samplepacks = path.join(captured.root, 'samplepacks');
      manifest = fs.existsSync(samplepacks) ? copyDir(samplepacks, path.join(draft, 'samplepacks')) : [];
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
    if (options.deep && (!manifestMatches(path.join(draft, 'samplepacks'), manifest)
        || !manifestMatches(path.join(captured.root, 'samplepacks'), manifest))) {
      throw archiveError('ARCHIVE_MANIFEST_MISMATCH', 'Stored sample packs do not match the captured source.');
    }
    const instruments = options.deep ? instrumentsSummary({ root: draft }) : null;
    const verification = { verified: true, sha256: sha256(stored), bytes: stored.length, checked: new Date().toISOString() };
    const info = {
      name,
      fromSlot: captured.slot,
      created: new Date().toISOString(),
      instruments,
      deep: options.deep,
      manifest,
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
    failure.source = publicSource(captured);
    retainFailedDraft(draft, libraryRoot, captured, options.operation, failure);
    throw failure;
  }
}
function projFile(slot) {
  const src = getSource();
  if (!src) throw new Error('no source');
  return path.join(src.path, `project${String(slot).padStart(2, '0')}.opz`);
}
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
function findBundle(file, auto, libraryRoot = LIB_DIR, autoRoot = AUTO_DIR) {
  validateBoolean(auto, 'auto');
  const id = validateBundleId(file);
  const dir = resolveChild(auto ? autoRoot : libraryRoot, id);
  let stored;
  let info;
  try {
    if (!fs.statSync(dir).isDirectory()) throw new Error('not a bundle');
    const opz = resolveChild(dir, 'song.opz');
    stored = fs.readFileSync(opz);
    parseProject(stored);
    info = JSON.parse(fs.readFileSync(resolveChild(dir, 'info.json'), 'utf8'));
    const evidence = info.verification || {};
    if (evidence.verified !== true || evidence.bytes !== stored.length || evidence.sha256 !== sha256(stored)
        || (info.deep === true && !manifestMatches(path.join(dir, 'samplepacks'), info.manifest))) {
      throw new Error('verification mismatch');
    }
    return { dir, opz, bundle: true, buffer: stored };
  } catch (error) {
    if (/^INVALID_/.test(error.code || '') || error.code === 'PATH_OUTSIDE_ROOT') throw error;
    throw requestError(409, 'BUNDLE_UNVERIFIED', 'Library bundle is not verified and cannot be restored.');
  }
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
    if (req.method === 'POST') requireMutationRequest(req);
    if (req.method === 'POST' && unavailableMutationGuidance[p]) {
      throw requestError(409, 'PHASE_UNAVAILABLE', 'This write is not available yet.', unavailableMutationGuidance[p]);
    }
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
      validateString(body.hash, 'hash', 64, false);
      if (!/^[a-f0-9]{16,64}$/i.test(body.hash)) {
        throw requestError(400, 'INVALID_METADATA', 'Invalid song metadata.');
      }
      validateMetadataFields(body.fields);
      const meta = loadMeta();
      meta.songs[body.hash] = { ...(meta.songs[body.hash] || {}), ...body.fields, updated: new Date().toISOString() };
      saveMeta(meta);
      return json(res, 200, { ok: true });
    }

    // ---- song library ----
    if (p === '/api/backup' && req.method === 'POST') {
      const body = validateBackup(await readBody(req));
      return await withMutation(`archive slot ${body.slot}`, async mutation => {
        if (testHooks.beforeBackupCapture) await testHooks.beforeBackupCapture();
        const meta = loadMeta();
        const source = (testHooks.sourceResolver || getSource)();
        if (!source) throw new Error('no source');
        const captured = (testHooks.captureSource || captureSource)(body.slot, source);
        mutation.source = publicSource(captured);
        const hash = hashFile(captured.buffer);
        const name = body.name || (meta.songs[hash] && meta.songs[hash].name) || `slot${body.slot}`;
        const result = archiveCapturedProject(captured, {
          libraryRoot: testHooks.libraryRoot || LIB_DIR,
          name,
          deep: body.deep,
          operation: mutation.operation,
        });
        if (body.name) { meta.songs[hash] = { ...(meta.songs[hash] || {}), name: body.name }; saveMeta(meta); }
        return json(res, 200, result);
      });
    }
    // ---- instruments ----
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
      let settings = {};
      try { settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); } catch {}
      return json(res, 200, {
        op1funEmail: typeof settings.op1funEmail === 'string' ? settings.op1funEmail : '',
        hasOp1funToken: typeof settings.op1funToken === 'string' && settings.op1funToken.length > 0,
      }, { 'Cache-Control': 'no-store' });
    }
    if (p === '/api/settings' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body || typeof body !== 'object' || Array.isArray(body)
          || Object.keys(body).some(key => !['op1funEmail', 'op1funToken'].includes(key))) {
        throw requestError(400, 'INVALID_SETTINGS', 'Invalid settings.');
      }
      if ('op1funEmail' in body) validateString(body.op1funEmail, 'op1funEmail', 320);
      if ('op1funToken' in body) validateString(body.op1funToken, 'op1funToken', 1000);
      let cur = {}; try { cur = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); } catch {}
      saveSettings({ ...cur, ...body });
      return json(res, 200, { ok: true }, { 'Cache-Control': 'no-store' });
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
        const parsedRange = parseByteRange(range, stat.size);
        if (!parsedRange) {
          res.writeHead(416, { 'Content-Range': `bytes */${stat.size}`, 'Accept-Ranges': 'bytes' });
          return res.end();
        }
        const { start, end } = parsedRange;
        res.writeHead(206, { 'Content-Type': MIME[ext] || 'application/octet-stream',
          'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
        const stream = fs.createReadStream(full, { start, end });
        stream.on('error', () => res.destroy());
        return stream.pipe(res);
      }
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': stat.size, 'Accept-Ranges': 'bytes' });
      const stream = fs.createReadStream(full);
      stream.on('error', () => res.destroy());
      return stream.pipe(res);
    }

    // ---- static ----
    let file = p === '/' ? '/index.html' : p;
    const full = path.join(APP_DIR, path.normalize(file));
    if (!full.startsWith(APP_DIR) || !fs.existsSync(full)) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'text/plain' });
    return fs.createReadStream(full).pipe(res);
  } catch (e) {
    const safe = Number.isInteger(e.status) && /^[A-Z][A-Z0-9_]+$/.test(e.code || '')
      ? { error: e.message, code: e.code, guidance: e.guidance,
        ...(e.source ? { source: e.source } : {}), ...(e.active ? { active: e.active } : {}) }
      : { error: 'Operation failed safely.', code: 'OPERATION_FAILED', guidance: 'Refresh and retry. If the source disconnected, reconnect it first.' };
    return json(res, Number.isInteger(e.status) ? e.status : 500, safe);
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
  mutationRouteInventory,
  testHooks,
  requireMutationRequest,
  requestError,
  validateSlot,
  validateBoolean,
  validateString,
  validatePackType,
  validateBundleId,
  parseByteRange,
  validateMetadataFields,
  loadMeta,
  saveSettings,
  resolveChild,
  findBundle,
  captureSource,
  assertCapturedSource,
  withMutation,
  archiveCapturedProject,
  scanLibrary,
  scanDrafts,
  server,
};

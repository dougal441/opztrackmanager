#!/usr/bin/env node
// OP-Z Manager — local server. No dependencies.
// Slots, song library (full bundles incl. instrument snapshots), instrument manager, audio.

'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { execSync } = require('child_process');
const { parseProject, parseNotes, parseTrackChunks, PATTERN_BASE, PATTERN_SIZE } = require('./parser.js');
const { aifToWav, packInfo } = require('./aif.js');

const ROOT = __dirname;
const APP_DIR = path.join(ROOT, 'app');
const LIB_DIR = path.join(ROOT, 'library');
const AUTO_DIR = path.join(LIB_DIR, 'auto-backups');
const TRASH_DIR = path.join(LIB_DIR, 'instrument-trash');
const DATA_DIR = path.join(ROOT, 'data');
const META_FILE = path.join(DATA_DIR, 'meta.json');
const CLEAR_ACCEPTANCE_FILE = path.join(DATA_DIR, 'clear-acceptance.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const MUSIC_DIR = path.dirname(ROOT);
const PORT = 8765;
const SOURCE_TOKEN_SECRET = crypto.randomBytes(32);

const PACK_TYPES = ['1-kick', '2-snare', '3-perc', '4-fx', '5-bass', '6-lead', '7-arpeggio', '8-chord'];
const META_TRACKS = ['kick', 'snare', 'hihat', 'sample', 'bass', 'lead', 'arp', 'chord'];
const mutationRouteInventory = Object.freeze({
  enabled: ['/api/backup', '/api/restore', '/api/swap', '/api/clear-slot', '/api/instruments/restore-grid', '/api/instruments/move', '/api/instruments/remove', '/api/instruments/import', '/api/instruments/snapshot'],
  unavailable: [
    '/api/op1fun/download',
  ],
});
const unavailableMutationGuidance = Object.freeze({
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
function loadMetaForUpdate(file = META_FILE) {
  if (!fs.existsSync(file)) return { songs: {} };
  try {
    const meta = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (isPlainObject(meta) && isPlainObject(meta.songs)) return meta;
  } catch {}
  throw transactionError('METADATA_UNREADABLE', 'Stored song metadata cannot be safely updated.',
    'Keep the existing metadata file unchanged, repair or restore it, then retry.', 409);
}
function loadSettingsForUpdate(file = SETTINGS_FILE) {
  if (!fs.existsSync(file)) return {};
  try {
    const settings = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (isPlainObject(settings)
        && Object.keys(settings).every(key => ['op1funEmail', 'op1funToken'].includes(key))
        && Object.values(settings).every(value => typeof value === 'string')) return settings;
  } catch {}
  throw transactionError('SETTINGS_UNREADABLE', 'Stored settings cannot be safely updated.',
    'Keep the existing settings file unchanged, repair or restore it, then retry.', 409);
}
function saveJsonAtomic(file, value, mode) {
  const temp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}-${crypto.randomBytes(6).toString('hex')}.tmp`);
  try {
    fs.writeFileSync(temp, JSON.stringify(value, null, 2), { ...(mode ? { mode } : {}), flag: 'wx', flush: true });
    if (testHooks.beforeJsonRename) testHooks.beforeJsonRename(file, temp);
    fs.renameSync(temp, file);
  } catch (error) {
    try { fs.unlinkSync(temp); } catch {}
    throw error;
  }
}
function saveMeta(meta, file = META_FILE) { saveJsonAtomic(file, meta); }
function saveSettings(settings, file = SETTINGS_FILE) { saveJsonAtomic(file, settings, 0o600); }
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
function scanSlots(meta, sourceResolver = getSource) {
  const src = sourceResolver();
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
      const captured = captureSource(i, src);
      const splitReview = splitEvidence(parsed, captured.sha256);
      if (meta.splits && meta.splits[captured.sha256]) splitReview.confirmed = meta.splits[captured.sha256];
      slots.push({
        slot: i, file: `project${nn}.opz`, hash,
        sha256: captured.sha256, bytes: captured.bytes, sourceToken: captured.sourceToken,
        modified: fs.statSync(file).mtime,
        tempo: parsed.tempo, swing: parsed.swing, mixer: parsed.mixer,
        chains: parsed.chains, usedPatterns: parsed.usedPatterns,
        patterns: parsed.patterns.filter(p => p.noteCount > 0),
        splitReview,
        meta: meta.songs[hash] || null,
      });
    } catch (e) {
      slots.push({ slot: i, file: `project${nn}.opz`, error: e.message });
    }
  }
  return { source: { device: src.device, label: src.label }, slots };
}

// Evidence only: saved disjoint chains lead; separated pattern and track profiles support review.
function splitEvidence(parsed, parentHash) {
  const used = parsed.usedPatterns.slice().sort((a, b) => a - b);
  const usedSet = new Set(used);
  const groups = parsed.chains.map(chain => [...new Set(chain.patterns.filter(p => usedSet.has(p)))])
    .filter(group => group.length).filter((group, i, all) => all.findIndex(other => JSON.stringify(other) === JSON.stringify(group)) === i)
    .sort((a, b) => a[0] - b[0]);
  const disjoint = groups.length === 2 && groups.every((group, i) => groups.slice(i + 1).every(other => !group.some(p => other.includes(p))));
  const memberships = disjoint ? groups.slice(0, 2).map(group => group.slice().sort((a, b) => a - b)) : [];
  const byPattern = new Map(parsed.patterns.map(pattern => [pattern.index, pattern]));
  const profiles = used.map(index => {
    const pattern = byPattern.get(index) || {};
    return { pattern: index, tracks: Object.keys(pattern.trackNotes || {}).sort() };
  });
  const clusters = memberships.map(patterns => ({ patterns, noteCount: patterns.reduce((n, p) => n + ((byPattern.get(p) || {}).noteCount || 0), 0) }));
  const profileSets = clusters.map(cluster => new Set(cluster.patterns.flatMap(p => (byPattern.get(p) || {}).activeTracks || [])));
  const differingProfiles = profileSets.length === 2 && [...profileSets[0]].some(track => !profileSets[1].has(track))
    || profileSets.length === 2 && [...profileSets[1]].some(track => !profileSets[0].has(track));
  return {
    suggested: Boolean(disjoint && memberships[0].length && memberships[1].length),
    parentHash,
    memberships,
    evidence: {
      chains: parsed.chains.map(chain => ({ index: chain.index, patterns: chain.patterns.slice() })),
      patternClusters: clusters,
      trackProfiles: profiles,
      differingProfiles: Boolean(differingProfiles),
    },
  };
}
function synthesizeSplitProject(parent, patterns) {
  if (!Buffer.isBuffer(parent) || !Array.isArray(patterns) || !patterns.length
      || patterns.some(p => !Number.isInteger(p) || p < 0 || p > 15)) {
    throw requestError(400, 'INVALID_SPLIT_ARCHIVE', 'A non-empty valid pattern membership is required.');
  }
  const selected = new Set(patterns);
  const output = Buffer.from(parent);
  for (let p = 0; p < 16; p++) {
    if (!selected.has(p)) output.fill(0, PATTERN_BASE + p * PATTERN_SIZE, PATTERN_BASE + (p + 1) * PATTERN_SIZE);
  }
  // D-01/D-02: retain original indexes, remove omitted references, and pad deterministically.
  for (let c = 0; c < 16; c++) {
    const base = 4 + c * 32;
    const kept = [];
    for (let i = 0; i < 32; i++) {
      const value = parent[base + i];
      if (value === 0xff) break;
      if (value <= 15 && selected.has(value)) kept.push(value);
    }
    output.fill(0xff, base, base + 32);
    kept.forEach((value, i) => { output[base + i] = value; });
  }
  const parsed = parseProject(output);
  const retained = parsed.usedPatterns.slice().sort((a, b) => a - b);
  const expected = [...selected].sort((a, b) => a - b);
  if (JSON.stringify(retained) !== JSON.stringify(expected)
      || parsed.chains.some(chain => chain.patterns.some(p => !selected.has(p)))) {
    throw archiveError('ARCHIVE_SYNTHESIS_INVALID', 'Synthesized project did not retain the confirmed patterns exactly.');
  }
  return output;
}
function acceptanceValid(acceptance, projectSha256) {
  return isPlainObject(acceptance) && hasExactKeys(acceptance,
    ['version', 'projectSha256', 'eject', 'reconnect', 'rejection', 'playback', 'recovery', 'recorded'])
    && acceptance.version === 1 && acceptance.projectSha256 === projectSha256
    && ['eject', 'reconnect', 'rejection', 'playback', 'recovery'].every(key => acceptance[key] === true)
    && isIsoTime(acceptance.recorded);
}
function loadClearAcceptance(file = CLEAR_ACCEPTANCE_FILE) {
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    return isPlainObject(value) ? value : null;
  } catch { return null; }
}
function clearAcceptanceValid(record, source) {
  if (!isPlainObject(record) || !isPlainObject(source)) return false;
  if (!hasExactKeys(record, ['version', 'method', 'fixture', 'device', 'outcomes', 'recorded'])
      || record.version !== 1 || record.method !== 'delete-project-file' || record.fixture !== true
      || !isPlainObject(record.device) || !hasExactKeys(record.device, ['label', 'projectSha256'])
      || typeof record.device.label !== 'string' || !record.device.label || record.device.label.length > 80
      || typeof record.device.projectSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(record.device.projectSha256)
      || record.device.label !== String(source.label || '')
      || !isPlainObject(record.outcomes)
      || !hasExactKeys(record.outcomes, ['eject', 'reconnect', 'rejection', 'playback', 'recovery', 'emptySlot'])
      || Object.values(record.outcomes).some(value => value !== true)
      || !isIsoTime(record.recorded)) return false;
  return source.device === true;
}
function clearEnabled(source, record = loadClearAcceptance()) {
  return clearAcceptanceValid(record, source);
}
function sanitizeSplitName(value, field) {
  validateString(value, field, 80, false);
  const name = value.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!name) throw requestError(400, 'INVALID_SPLIT_INTENT', `${field} must contain a name.`);
  return name;
}
function validateSplitIntent(body, sourceResolver = getSource) {
  if (!isPlainObject(body) || !hasExactKeys(body, ['parentHash', 'halves'])) {
    throw requestError(400, 'INVALID_SPLIT_INTENT', 'Split confirmation must contain a parent hash and two halves.');
  }
  if (typeof body.parentHash !== 'string' || !/^[a-f0-9]{64}$/i.test(body.parentHash)) {
    throw requestError(400, 'INVALID_SPLIT_INTENT', 'Parent project hash is invalid.');
  }
  if (!Array.isArray(body.halves) || body.halves.length !== 2) {
    throw requestError(400, 'INVALID_SPLIT_INTENT', 'Split confirmation requires exactly two halves.');
  }
  const halves = body.halves.map((half, i) => {
    if (!isPlainObject(half) || !hasExactKeys(half, ['name', 'patterns']) || !Array.isArray(half.patterns)) {
      throw requestError(400, 'INVALID_SPLIT_INTENT', 'Each split half requires a name and pattern list.');
    }
    const patterns = [...new Set(half.patterns)];
    if (!patterns.length || patterns.some(p => !Number.isInteger(p) || p < 0 || p > 15)) {
      throw requestError(400, 'INVALID_SPLIT_INTENT', 'Split pattern lists must contain valid non-empty pattern indexes.');
    }
    return { name: sanitizeSplitName(half.name, `half ${i + 1} name`), patterns: patterns.sort((a, b) => a - b) };
  });
  if (halves[0].patterns.some(p => halves[1].patterns.includes(p))) {
    throw requestError(400, 'INVALID_SPLIT_INTENT', 'Split pattern lists must not overlap.');
  }
  const source = sourceResolver();
  if (!source) throw sourceError('SOURCE_UNAVAILABLE', 'No project source is available.');
  let found = null;
  for (let slot = 1; slot <= 10; slot++) {
    const file = path.join(source.path, `project${String(slot).padStart(2, '0')}.opz`);
    if (!fs.existsSync(file)) continue;
    const bytes = fs.readFileSync(file);
    if (sha256(bytes) === body.parentHash) { found = { slot, bytes, parsed: parseProject(bytes) }; break; }
  }
  if (!found) throw transactionError('SPLIT_PARENT_STALE', 'The parent project changed or is unavailable.', 'Refresh the slot and review the split again.', 409);
  const used = found.parsed.usedPatterns.slice().sort((a, b) => a - b);
  const selected = halves.flatMap(half => half.patterns).sort((a, b) => a - b);
  if (JSON.stringify(selected) !== JSON.stringify(used)) {
    throw requestError(400, 'INVALID_SPLIT_INTENT', 'Split memberships must cover each occupied pattern exactly once.');
  }
  return { parentHash: body.parentHash.toLowerCase(), halves, slot: found.slot };
}
function validateSplitArchiveRequest(body) {
  if (!isPlainObject(body) || !hasExactKeys(body, ['parentHash', 'half'])) {
    throw requestError(400, 'INVALID_SPLIT_ARCHIVE', 'Split archive requires the confirmed parent and half number.');
  }
  if (typeof body.parentHash !== 'string' || !/^[a-f0-9]{64}$/i.test(body.parentHash)
      || !Number.isInteger(body.half) || body.half < 0 || body.half > 1) {
    throw requestError(400, 'INVALID_SPLIT_ARCHIVE', 'Split archive selection is invalid.');
  }
  return { parentHash: body.parentHash.toLowerCase(), half: body.half };
}
function validateAcceptanceRequest(body) {
  if (!isPlainObject(body) || !hasExactKeys(body, ['file', 'auto', 'outcomes'])) {
    throw requestError(400, 'INVALID_ACCEPTANCE', 'Acceptance requires one archive and five outcomes.');
  }
  validateBundleId(body.file); validateBoolean(body.auto, 'auto');
  if (body.auto || !isPlainObject(body.outcomes) || !hasExactKeys(body.outcomes,
    ['eject', 'reconnect', 'rejection', 'playback', 'recovery'])
      || Object.values(body.outcomes).some(value => value !== true)) {
    throw requestError(400, 'INVALID_ACCEPTANCE', 'All five mounted-device outcomes must be confirmed.');
  }
  return body;
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
    const stat = fs.lstatSync(a);
    if (stat.isDirectory()) copyDir(a, b, manifest, rel);
    else if (stat.isFile()) {
      const buf = fs.readFileSync(a);
      fs.writeFileSync(b, buf, { flush: true });
      manifest.push({ path: rel.split(path.sep).join('/'), bytes: buf.length, sha256: sha256(buf) });
    } else throw new Error('unsupported sample-pack entry');
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
function archiveDiagnostic(errorCode, diagnostic, safe = {}) {
  return {
    verified: false,
    complete: false,
    restoreEligible: false,
    manualFreeEligible: false,
    diagnostic,
    errorCode,
    ...safe,
  };
}
function isIsoTime(value) {
  if (typeof value !== 'string') return false;
  try { return new Date(value).toISOString() === value; }
  catch { return false; }
}
function isArchiveRelative(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 500
    && !value.includes('\\') && !value.includes('\0') && !path.posix.isAbsolute(value)
    && path.posix.normalize(value) === value
    && value.split('/').every(part => part && part !== '.' && part !== '..');
}
function isEvidence(value) {
  return isPlainObject(value) && Object.keys(value).length === 3
    && isArchiveRelative(value.path)
    && Number.isSafeInteger(value.bytes) && value.bytes >= 0
    && typeof value.sha256 === 'string' && /^[a-f0-9]{64}$/.test(value.sha256);
}
function hasExactKeys(value, keys) {
  return isPlainObject(value) && Object.keys(value).sort().join('\0') === keys.slice().sort().join('\0');
}
function readArchiveEvidence(root, evidence) {
  if (!isEvidence(evidence)) throw new Error('invalid evidence');
  const base = fs.realpathSync(root);
  let current = base;
  for (const part of evidence.path.split('/')) {
    current = path.join(current, part);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error('symlink evidence');
  }
  const stat = fs.lstatSync(current);
  if (!stat.isFile()) throw new Error('non-file evidence');
  const relative = path.relative(base, fs.realpathSync(current));
  if (!relative || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw new Error('escaped evidence');
  const bytes = fs.readFileSync(current);
  if (bytes.length !== evidence.bytes || sha256(bytes) !== evidence.sha256) throw new Error('evidence mismatch');
  return bytes;
}
function validateArchiveInfo(info) {
  if (!isPlainObject(info)) throw Object.assign(new Error('manifest malformed'), { archiveCode: 'ARCHIVE_CORRUPT' });
  if (info.schemaVersion === undefined) throw Object.assign(new Error('legacy manifest'), { archiveCode: 'ARCHIVE_LEGACY' });
  if (info.schemaVersion !== 1) throw Object.assign(new Error('unsupported manifest'), { archiveCode: 'ARCHIVE_UNSUPPORTED' });
  const required = ['schemaVersion', 'created', 'source', 'project', 'metadata', 'snippet', 'samplepacks'];
  if (!required.every(key => Object.hasOwn(info, key))) {
    throw Object.assign(new Error('partial manifest'), { archiveCode: 'ARCHIVE_PARTIAL' });
  }
  const allowedKeys = required.concat(['split', 'acceptance']);
  if (!Object.keys(info).every(key => allowedKeys.includes(key)) || !required.every(key => Object.hasOwn(info, key)) || !isIsoTime(info.created)
      || !hasExactKeys(info.source, ['device', 'label', 'slot'])
      || typeof info.source.device !== 'boolean'
      || typeof info.source.label !== 'string' || !info.source.label || info.source.label.length > 80 || info.source.label.includes('\0')
      || !Number.isInteger(info.source.slot) || info.source.slot < 1 || info.source.slot > 10
      || !hasExactKeys(info.project, ['path', 'bytes', 'sha256', 'checked'])
      || info.project.path !== 'song.opz'
      || !isEvidence({ path: info.project.path, bytes: info.project.bytes, sha256: info.project.sha256 })
      || !isIsoTime(info.project.checked)) {
    throw Object.assign(new Error('invalid manifest'), { archiveCode: 'ARCHIVE_CORRUPT' });
  }
  const metadata = info.metadata;
  if (!hasExactKeys(metadata, ['name', 'tags', 'notes', 'kit'])
      || typeof metadata.name !== 'string' || metadata.name.length > 120 || metadata.name.includes('\0')
      || typeof metadata.tags !== 'string' || metadata.tags.length > 1000 || metadata.tags.includes('\0')
      || typeof metadata.notes !== 'string' || metadata.notes.length > 10000 || metadata.notes.includes('\0')
      || !isPlainObject(metadata.kit) || Object.keys(metadata.kit).some(track => !META_TRACKS.includes(track))
      || Object.values(metadata.kit).some(slot => !Number.isInteger(slot) || slot < 1 || slot > 10)) {
    throw Object.assign(new Error('invalid metadata'), { archiveCode: 'ARCHIVE_CORRUPT' });
  }
  const snippetStatuses = new Set(['included', 'unlinked', 'missing', 'unavailable']);
  if (!isPlainObject(info.snippet) || !snippetStatuses.has(info.snippet.status)
      || (info.snippet.status === 'included'
        ? !hasExactKeys(info.snippet, ['status', 'path', 'bytes', 'sha256'])
          || !isEvidence({ path: info.snippet.path, bytes: info.snippet.bytes, sha256: info.snippet.sha256 })
        : !hasExactKeys(info.snippet, ['status']))) {
    throw Object.assign(new Error('invalid snippet'), { archiveCode: 'ARCHIVE_CORRUPT' });
  }
  if (!hasExactKeys(info.samplepacks, ['captured', 'files']) || typeof info.samplepacks.captured !== 'boolean'
      || !Array.isArray(info.samplepacks.files) || info.samplepacks.files.some(item => !isEvidence(item))
      || new Set(info.samplepacks.files.map(item => item.path)).size !== info.samplepacks.files.length
      || (!info.samplepacks.captured && info.samplepacks.files.length !== 0)) {
    throw Object.assign(new Error('invalid sample packs'), { archiveCode: 'ARCHIVE_CORRUPT' });
  }
  if (Object.hasOwn(info, 'split')) {
    if (!hasExactKeys(info.split, ['version', 'parentSha256', 'patterns', 'name'])
        || info.split.version !== 1 || !/^[a-f0-9]{64}$/.test(info.split.parentSha256)
        || !Array.isArray(info.split.patterns) || !info.split.patterns.length
        || info.split.patterns.some(p => !Number.isInteger(p) || p < 0 || p > 15)
        || typeof info.split.name !== 'string' || !info.split.name.length || info.split.name.length > 80) {
      throw Object.assign(new Error('invalid split provenance'), { archiveCode: 'ARCHIVE_CORRUPT' });
    }
    if (Object.hasOwn(info, 'acceptance') && info.acceptance !== null
        && (!hasExactKeys(info.acceptance, ['version', 'projectSha256', 'eject', 'reconnect', 'rejection', 'playback', 'recovery', 'recorded'])
          || info.acceptance.version !== 1 || !/^[a-f0-9]{64}$/.test(info.acceptance.projectSha256)
          || ['eject', 'reconnect', 'rejection', 'playback', 'recovery'].some(k => typeof info.acceptance[k] !== 'boolean')
          || !isIsoTime(info.acceptance.recorded))) {
      throw Object.assign(new Error('invalid acceptance evidence'), { archiveCode: 'ARCHIVE_CORRUPT' });
    }
  } else if (Object.hasOwn(info, 'acceptance')) {
    throw Object.assign(new Error('acceptance without split provenance'), { archiveCode: 'ARCHIVE_CORRUPT' });
  }
  return info;
}
function classifyArchive(dir) {
  try {
    const rootStat = fs.lstatSync(dir);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('invalid bundle');
    const manifestPath = path.join(dir, 'info.json');
    if (!fs.existsSync(manifestPath)) return archiveDiagnostic('ARCHIVE_PARTIAL', 'partial');
    const manifestStat = fs.lstatSync(manifestPath);
    if (!manifestStat.isFile() || manifestStat.isSymbolicLink() || manifestStat.size > 2e6) throw new Error('invalid manifest');
    let info;
    try { info = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
    catch { return archiveDiagnostic('ARCHIVE_CORRUPT', 'corrupt'); }
    try { validateArchiveInfo(info); }
    catch (error) {
      const code = error.archiveCode || 'ARCHIVE_CORRUPT';
      const status = code === 'ARCHIVE_LEGACY' ? 'legacy' : code === 'ARCHIVE_UNSUPPORTED' ? 'unsupported'
        : code === 'ARCHIVE_PARTIAL' ? 'partial' : 'corrupt';
      return archiveDiagnostic(code, status);
    }
    const safe = { created: info.created, source: info.source, evidence: { project: info.project } };
    let project;
    try { project = readArchiveEvidence(dir, { path: info.project.path, bytes: info.project.bytes, sha256: info.project.sha256 }); }
    catch { return archiveDiagnostic('ARCHIVE_CORRUPT', 'corrupt', safe); }
    let parsed;
    try { parsed = parseProject(project); }
    catch { return archiveDiagnostic('ARCHIVE_PARSE_FAILED', 'corrupt', safe); }
    if (info.samplepacks.captured) {
      const packRoot = path.join(dir, 'samplepacks');
      try {
        if (!fs.lstatSync(packRoot).isDirectory() || !manifestMatches(packRoot, info.samplepacks.files)) throw new Error('pack mismatch');
      } catch { return archiveDiagnostic('ARCHIVE_CORRUPT', 'corrupt', safe); }
    }
    if (info.snippet.status === 'included') {
      try { readArchiveEvidence(dir, { path: info.snippet.path, bytes: info.snippet.bytes, sha256: info.snippet.sha256 }); }
      catch { return archiveDiagnostic('ARCHIVE_CORRUPT', 'corrupt', safe); }
    }
    const complete = info.samplepacks.captured && ['included', 'unlinked'].includes(info.snippet.status);
    const split = info.split || null;
    const restoreEligible = !split || acceptanceValid(info.acceptance, info.project.sha256);
    const result = {
      verified: true,
      complete,
      restoreEligible,
      ...(split ? { split, acceptance: info.acceptance || null, restoreReason: restoreEligible ? 'hardware accepted' : 'pending sacrificial-device acceptance' } : {}),
      manualFreeEligible: false,
      hash: hashFile(project),
      schemaVersion: info.schemaVersion,
      tempo: parsed.tempo,
      chains: parsed.chains,
      patterns: parsed.patterns,
      usedPatterns: parsed.usedPatterns,
      created: info.created,
      source: info.source,
      fromSlot: info.source.slot,
      project: info.project,
      metadata: info.metadata,
      name: info.metadata.name,
      snippet: info.snippet,
      samplepacks: info.samplepacks,
      hasInstruments: info.samplepacks.captured,
      archiveRevision: sha256(Buffer.concat([fs.readFileSync(manifestPath), project])),
    };
    Object.defineProperty(result, 'buffer', { value: project });
    return result;
  } catch { return archiveDiagnostic('ARCHIVE_CORRUPT', 'corrupt'); }
}
function scanLibrary(meta, libraryRoot = LIB_DIR, autoRoot = AUTO_DIR) {
  const items = [];
  const reserved = new Set([
    autoRoot && path.resolve(autoRoot),
    path.resolve(libraryRoot, path.basename(TRASH_DIR)),
  ].filter(Boolean));
  const scanDir = (dir, auto) => {
    for (const f of fs.readdirSync(dir)) {
      if (f.startsWith('.')) continue;
      const full = path.join(dir, f);
      if (!auto && reserved.has(path.resolve(full))) continue;
      let bundle = null;
      let modified = null;
      try {
        const st = fs.lstatSync(full);
        modified = st.mtime;
        if (st.isDirectory() || st.isSymbolicLink()) {
          bundle = true;
          const classification = classifyArchive(full);
          items.push({
            file: f, bundle: true, auto, modified: st.mtime,
            ...classification,
            meta: classification.hash ? meta.songs[classification.hash] || null : null,
          });
        } else if (st.isFile() && f.endsWith('.opz')) { // legacy flat file
          bundle = false;
          const buf = fs.readFileSync(full);
          const parsed = parseProject(buf);
          items.push({
            file: f, bundle: false, auto, hash: hashFile(buf),
            modified: st.mtime, tempo: parsed.tempo, usedPatterns: parsed.usedPatterns,
            ...archiveDiagnostic('ARCHIVE_LEGACY', 'legacy'),
            meta: meta.songs[hashFile(buf)] || null,
          });
        }
      } catch {
        if (bundle !== null) items.push({ file: f, bundle, auto, modified, ...archiveDiagnostic('ARCHIVE_PARSE_FAILED', 'corrupt') });
      }
    }
  };
  scanDir(libraryRoot, false);
  if (autoRoot && fs.existsSync(autoRoot)) scanDir(autoRoot, true);
  items.sort((a, b) => new Date(b.modified) - new Date(a.modified));
  return items;
}

function archiveShelfData(library, drafts, inspectManualFree) {
  const byNewest = (a, b) => String(b.created || '').localeCompare(String(a.created || ''))
    || String(a.id).localeCompare(String(b.id));
  const verified = library.filter(item => item.verified === true).map(item => {
    let manualFree = null;
    try { manualFree = inspectManualFree ? inspectManualFree(item.file, item.auto) : null; } catch {}
    const perTrack = Object.fromEntries(PACK_TYPES.map(type => [type, { files: 0, bytes: 0 }]));
    const files = item.samplepacks.files.map(evidence => {
      const [type, slotText] = evidence.path.split('/');
      const slot = /^\d{2}$/.test(slotText || '') ? Number(slotText) : null;
      if (perTrack[type]) {
        perTrack[type].files++;
        perTrack[type].bytes += evidence.bytes;
      }
      return { ...evidence, type: PACK_TYPES.includes(type) ? type : null, slot };
    });
    return {
      id: item.file,
      auto: item.auto === true,
      schemaVersion: item.schemaVersion,
      created: item.created,
      source: item.source,
      metadata: item.metadata,
      tempo: item.tempo,
      usedPatterns: item.usedPatterns,
      chains: item.chains,
      patterns: item.patterns,
      project: { ...item.project, storedBytesMatch: true, parsed: true },
      snippet: item.snippet,
      samplepacks: {
        captured: item.samplepacks.captured,
        files,
        summary: {
          fileCount: files.length,
          totalBytes: files.reduce((total, file) => total + file.bytes, 0),
          perTrack,
        },
      },
      verified: true,
      complete: item.complete === true,
      restoreEligible: item.restoreEligible === true,
      archiveRevision: item.archiveRevision,
      manualFreeEligible: manualFree ? manualFree.eligible === true : item.manualFreeEligible === true,
      manualFreeRelation: manualFree && manualFree.relation || null,
      manualFreeReason: manualFree && manualFree.guidance || 'Connect the original mounted OP-Z and refresh to check eligibility.',
    };
  }).sort(byNewest);
  const diagnostics = [
    ...library.filter(item => item.verified !== true).map(item => ({
      id: item.file,
      name: item.metadata && typeof item.metadata.name === 'string' && item.metadata.name.length <= 120
        ? item.metadata.name : item.file,
      category: item.diagnostic,
      reason: item.errorCode,
      ...(item.created ? { created: item.created } : {}),
      ...(item.source ? { source: item.source } : {}),
      ...(item.evidence ? { evidence: item.evidence } : {}),
    })),
    ...drafts.map(draft => ({
      id: draft.id,
      name: draft.id,
      category: 'failed',
      reason: draft.errorCode,
      ...(draft.time ? { created: draft.time } : {}),
      ...(draft.source ? { source: draft.source } : {}),
    })),
  ].sort(byNewest);
  return { verified, diagnostics, verifiedCount: verified.length, diagnosticCount: diagnostics.length };
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
function recordingRoots(source) {
  const roots = [
    { kind: 'music', base: MUSIC_DIR, dir: path.join(MUSIC_DIR, 'OP-Z songs') },
    { kind: 'music', base: MUSIC_DIR, dir: path.join(ROOT, 'bounces') },
    { kind: 'music', base: MUSIC_DIR, dir: path.join(MUSIC_DIR, 'FlowStudio', 'Recordings') },
  ];
  if (source && source.device) roots.push({ kind: 'device', base: source.root, dir: path.join(source.root, 'bounces') });
  return roots;
}
function scanRecordings() {
  const src = getSource();
  const out = [];
  const walk = (dir, depth, base, kind) => {
    if (depth > 3 || !fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir)) {
      if (f.startsWith('.')) continue;
      const full = path.join(dir, f);
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full, depth + 1, base, kind);
      else if (/\.(wav|aiff?|mp3|m4a)$/i.test(f)) {
        out.push({ path: path.relative(base, full), root: kind, name: f, size: st.size, modified: st.mtime });
      }
    }
  };
  for (const root of recordingRoots(src)) walk(root.dir, 0, root.base, root.kind);
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
function recoveryReceipt(id, state) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9 _-]{1,120}$/.test(id)
      || !['retained', 'rolled_back', 'recovery_required'].includes(state)) return null;
  return { id, auto: true, state };
}
function sourceError(code, message) {
  return transactionError(code, message,
    'The captured source changed or disconnected. Reconnect the original source, refresh, and retry. No source data was changed.');
}
function archiveError(code, message) {
  return transactionError(code, message,
    'Archive verification failed. The source was not changed. Review the retained failed draft, then refresh and retry.');
}
function requireLoopbackHost(req) {
  const port = req.socket.localPort;
  const allowedHosts = new Set([`localhost:${port}`, `127.0.0.1:${port}`]);
  if (!allowedHosts.has(String(req.headers.host || '').toLowerCase())) {
    throw requestError(403, 'HOST_MISMATCH', 'Request host does not match this server.');
  }
  return allowedHosts;
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
  const allowedHosts = requireLoopbackHost(req);
  if (req.headers.origin) {
    let origin;
    try { origin = new URL(req.headers.origin); }
    catch { throw requestError(403, 'ORIGIN_MISMATCH', 'Mutation request origin does not match this server.'); }
    if (!new Set([...allowedHosts].map(host => `http://${host}`)).has(origin.origin)) {
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
  const limits = { name: 120, tags: 1000, notes: 10000, wav: 2000, wavRoot: 6, wavMatch: 40 };
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
    } else if (key === 'wavRoot' ? !['music', 'device'].includes(value)
      : typeof value !== 'string' || value.length > limits[key] || value.includes('\0')) {
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
function validateClear(body) {
  if (!isPlainObject(body) || !hasExactKeys(body, ['file', 'auto', 'archiveRevision', 'slot', 'targetFingerprint', 'sourceToken'])) {
    throw requestError(400, 'INVALID_CLEAR_REQUEST', 'Clear request must contain one reviewed archive and target.');
  }
  validateBundleId(body.file); validateBoolean(body.auto, 'auto'); validateSlot(body.slot);
  validateString(body.archiveRevision, 'archiveRevision', 64, false); validateString(body.sourceToken, 'sourceToken', 64, false);
  if (!/^[a-f0-9]{64}$/i.test(body.archiveRevision) || !/^[a-f0-9]{64}$/i.test(body.sourceToken)
      || !isPlainObject(body.targetFingerprint) || !hasExactKeys(body.targetFingerprint, ['sha256', 'bytes'])
      || !/^[a-f0-9]{64}$/i.test(body.targetFingerprint.sha256) || !Number.isSafeInteger(body.targetFingerprint.bytes)
      || body.targetFingerprint.bytes < 1) throw requestError(400, 'INVALID_CLEAR_REQUEST', 'Clear target evidence is invalid.');
  return body;
}
function validateRestore(body) {
  if (!isPlainObject(body) || !hasExactKeys(body, ['file', 'auto', 'archiveRevision', 'slot', 'targetFingerprint', 'sourceToken'])) {
    throw requestError(400, 'INVALID_RESTORE_REQUEST', 'Restore request must contain one reviewed archive and target.');
  }
  validateBundleId(body.file);
  validateBoolean(body.auto, 'auto');
  validateString(body.archiveRevision, 'archiveRevision', 64, false);
  validateString(body.sourceToken, 'sourceToken', 64, false);
  if (!/^[a-f0-9]{64}$/i.test(body.archiveRevision) || !/^[a-f0-9]{64}$/i.test(body.sourceToken)
      || !isPlainObject(body.targetFingerprint) || !hasExactKeys(body.targetFingerprint, ['sha256', 'bytes'])
      || !/^[a-f0-9]{64}$/i.test(body.targetFingerprint.sha256) || !Number.isSafeInteger(body.targetFingerprint.bytes) || body.targetFingerprint.bytes < 1) {
    throw requestError(400, 'INVALID_RESTORE_REQUEST', 'Restore target evidence is invalid.');
  }
  validateSlot(body.slot);
  return body;
}
function validateRestoreGrid(body) {
  if (!isPlainObject(body) || !hasExactKeys(body, ['file', 'auto', 'archiveRevision', 'sourceToken'])) {
    throw requestError(400, 'INVALID_RESTORE_GRID_REQUEST', 'Grid restore request must contain one reviewed archive and source.');
  }
  validateBundleId(body.file); validateBoolean(body.auto, 'auto');
  validateString(body.archiveRevision, 'archiveRevision', 64, false);
  validateString(body.sourceToken, 'sourceToken', 64, false);
  if (!/^[a-f0-9]{64}$/i.test(body.archiveRevision) || !/^[a-f0-9]{64}$/i.test(body.sourceToken)) {
    throw requestError(400, 'INVALID_RESTORE_GRID_REQUEST', 'Grid restore evidence is invalid.');
  }
  return body;
}
function validateSwap(body) {
  if (!isPlainObject(body) || !hasExactKeys(body, ['a', 'b', 'expectedA', 'expectedB', 'sourceToken'])) {
    throw requestError(400, 'INVALID_SWAP_REQUEST', 'Swap request must contain two reviewed slots.');
  }
  validateSlot(body.a); validateSlot(body.b);
  if (body.a === body.b) throw requestError(400, 'INVALID_SWAP_REQUEST', 'Choose two different slots.');
  validateString(body.sourceToken, 'sourceToken', 64, false);
  for (const fingerprint of [body.expectedA, body.expectedB]) {
    if (!isPlainObject(fingerprint) || !hasExactKeys(fingerprint, ['sha256', 'bytes'])
        || !/^[a-f0-9]{64}$/i.test(fingerprint.sha256) || !Number.isSafeInteger(fingerprint.bytes) || fingerprint.bytes < 1) {
      throw requestError(400, 'INVALID_SWAP_REQUEST', 'Swap slot evidence is invalid.');
    }
  }
  if (!/^[a-f0-9]{64}$/i.test(body.sourceToken)) throw requestError(400, 'INVALID_SWAP_REQUEST', 'Swap source evidence is invalid.');
  return body;
}
function publicSource(source) {
  const label = String(source.label || 'unknown source').replace(/\0/g, '').slice(0, 80) || 'unknown source';
  return { device: source.device === true, label, slot: source.slot };
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
    projects,
    projectPath,
    buffer,
    sha256: sha256(buffer),
    bytes: buffer.length,
    sourceToken: sourceToken(root, projects, rootStat),
  };
}
function sourceToken(root, projects, rootStat) {
  return crypto.createHmac('sha256', SOURCE_TOKEN_SECRET)
    .update(`${root}\0${projects}\0${rootStat.dev}\0${rootStat.ino}`).digest('hex');
}
function assertCapturedRoot(captured) {
  let root;
  try { root = fs.realpathSync(captured.root); }
  catch { throw sourceError('SOURCE_UNAVAILABLE', 'Captured source is no longer available.'); }
  let rootStat;
  try { rootStat = fs.statSync(root, { bigint: true }); }
  catch { throw sourceError('SOURCE_UNAVAILABLE', 'Captured source is no longer available.'); }
  let projects;
  try { projects = fs.realpathSync(path.join(root, 'projects')); }
  catch { throw sourceError('SOURCE_UNAVAILABLE', 'Captured projects are no longer available.'); }
  if (root !== captured.root || projects !== captured.projects || String(rootStat.dev) !== captured.rootDevice
      || String(rootStat.ino) !== captured.rootInode || sourceToken(root, projects, rootStat) !== captured.sourceToken) {
    throw sourceError('SOURCE_REPLACED', 'Captured source was replaced.');
  }
}
function assertCapturedSource(captured) {
  assertCapturedRoot(captured);
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
function archiveMetadata(value, fallbackName) {
  const source = isPlainObject(value) ? value : {};
  const fallback = typeof fallbackName === 'string' ? fallbackName.replace(/\0/g, '').slice(0, 120) : '';
  const text = (key, limit, fallback = '') => typeof source[key] === 'string'
    && source[key].length <= limit && !source[key].includes('\0') ? source[key] : fallback;
  const kit = isPlainObject(source.kit)
    && Object.keys(source.kit).every(track => META_TRACKS.includes(track))
    && Object.values(source.kit).every(slot => Number.isInteger(slot) && slot >= 1 && slot <= 10)
    ? { ...source.kit } : {};
  return { name: text('name', 120, fallback), tags: text('tags', 1000), notes: text('notes', 10000), kit };
}
function captureRecording(selection, captured) {
  if (!selection) return { status: 'unlinked' };
  if (!isPlainObject(selection) || !['music', 'device'].includes(selection.root)
      || typeof selection.path !== 'string' || !selection.path || selection.path.length > 2000
      || selection.path.includes('\0') || path.isAbsolute(selection.path)) return { status: 'unavailable' };
  const roots = recordingRoots(captured).filter(root => root.kind === selection.root);
  if (!roots.length) return { status: 'unavailable' };
  const candidate = path.resolve(roots[0].base, selection.path);
  const lexicallyAllowed = roots.some(root => {
    const relative = path.relative(root.dir, candidate);
    return relative && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
  });
  if (!lexicallyAllowed) return { status: 'unavailable' };
  if (!fs.existsSync(candidate)) return { status: 'missing' };
  try {
    if (fs.lstatSync(candidate).isSymbolicLink()) return { status: 'unavailable' };
    const full = fs.realpathSync(candidate);
    const contained = roots.some(root => {
      let canonical;
      try { canonical = fs.realpathSync(root.dir); } catch { return false; }
      const relative = path.relative(canonical, full);
      return relative && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
    });
    const ext = path.extname(full).toLowerCase();
    if (!contained || !new Set(['.wav', '.aif', '.aiff', '.mp3', '.m4a']).has(ext)
        || !fs.statSync(full).isFile()) return { status: 'unavailable' };
    return { status: 'included', bytes: fs.readFileSync(full), ext };
  } catch { return { status: 'unavailable' }; }
}
function archiveCapturedProject(captured, options) {
  const libraryRoot = fs.realpathSync(options.libraryRoot);
  const name = safeName(options.name);
  const draft = fs.mkdtempSync(path.join(libraryRoot, '.partial-'));
  try {
    const storedPath = path.join(draft, 'song.opz');
    const archiveBuffer = options.archiveBuffer || captured.buffer;
    fs.writeFileSync(storedPath, archiveBuffer, { flush: true });
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
    assertCapturedSource(captured);
    const snippetSource = captureRecording(options.recording, captured);
    let snippet = { status: snippetSource.status };
    if (snippetSource.status === 'included') {
      const snippetDir = path.join(draft, 'snippet');
      const snippetPath = `snippet/recording${snippetSource.ext}`;
      fs.mkdirSync(snippetDir);
      const output = path.join(draft, snippetPath);
      fs.writeFileSync(output, snippetSource.bytes, { flush: true });
      const storedSnippet = fs.readFileSync(output);
      if (!storedSnippet.equals(snippetSource.bytes)) throw archiveError('ARCHIVE_BYTES_MISMATCH', 'Stored snippet does not match the captured recording.');
      snippet = { status: 'included', path: snippetPath, bytes: storedSnippet.length, sha256: sha256(storedSnippet) };
    }
    if (typeof options.beforeVerify === 'function') options.beforeVerify(storedPath, draft);
    const stored = fs.readFileSync(storedPath);
    if (stored.length !== archiveBuffer.length || !stored.equals(archiveBuffer)) {
      throw archiveError('ARCHIVE_BYTES_MISMATCH', 'Stored project does not match the captured source.');
    }
    try { parseProject(stored); }
    catch (error) { throw archiveError('ARCHIVE_PARSE_FAILED', error.message); }
    assertCapturedSource(captured);
    const storedPacks = path.join(draft, 'samplepacks');
    if (options.deep && (!fs.existsSync(storedPacks) || !manifestMatches(storedPacks, manifest)
        || !manifestMatches(samplepacks, manifest))) {
      throw archiveError('ARCHIVE_MANIFEST_MISMATCH', 'Stored sample packs do not match the captured source.');
    }
    const checked = new Date().toISOString();
    const project = { path: 'song.opz', sha256: sha256(stored), bytes: stored.length, checked };
    const info = {
      schemaVersion: 1,
      created: checked,
      source: publicSource(captured),
      project,
      metadata: archiveMetadata(options.metadata, options.name || `slot${captured.slot}`),
      snippet,
      samplepacks: { captured: options.deep, files: manifest || [] },
    };
    if (options.split) info.split = options.split;
    if (options.acceptance !== undefined) info.acceptance = options.acceptance;
    fs.writeFileSync(path.join(draft, 'info.json'), JSON.stringify(info, null, 2), { flush: true });
    if (typeof options.beforePublish === 'function') options.beforePublish(storedPath, draft);
    const classification = classifyArchive(draft);
    if (!classification.verified || classification.complete !== (options.deep && ['included', 'unlinked'].includes(snippet.status))) {
      throw archiveError('ARCHIVE_MANIFEST_MISMATCH', 'Stored archive evidence does not match its manifest.');
    }
    if (options.deep && !manifestMatches(samplepacks, manifest)) {
      throw archiveError('ARCHIVE_MANIFEST_MISMATCH', 'Captured sample packs changed before publication.');
    }
    assertCapturedSource(captured);
    const finalName = `${stamp()}_${name}_${path.basename(draft).slice(-6)}`;
    fs.renameSync(draft, path.join(libraryRoot, finalName));
    return { ok: true, verified: true, complete: classification.complete, restoreEligible: classification.restoreEligible,
      restoreReason: classification.restoreReason, file: finalName,
      source: publicSource(captured), evidence: project, guidance: sourceGuidance(captured) };
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
    const candidate = path.resolve(base, id);
    if (fs.lstatSync(candidate).isSymbolicLink()) throw requestError(400, 'PATH_OUTSIDE_ROOT', 'Library item is outside the library.');
    child = fs.realpathSync(candidate);
  } catch (error) {
    if (error.code === 'PATH_OUTSIDE_ROOT') throw error;
    throw requestError(404, 'PATH_NOT_FOUND', 'Library item was not found.');
  }
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
  try {
    if (!fs.statSync(dir).isDirectory()) throw new Error('not a bundle');
    const classification = classifyArchive(dir);
    if (!classification.verified) throw new Error('verification mismatch');
    const opz = path.join(dir, 'song.opz');
    const buffer = fs.readFileSync(opz);
    if (!classification.buffer.equals(buffer) || classification.project.bytes !== buffer.length
        || classification.project.sha256 !== sha256(buffer)) throw new Error('archive changed');
    return { dir, opz, bundle: true, buffer, archiveRevision: classification.archiveRevision, classification };
  } catch (error) {
    if (/^INVALID_/.test(error.code || '') || error.code === 'PATH_OUTSIDE_ROOT') throw error;
    throw requestError(409, 'BUNDLE_UNVERIFIED', 'Library bundle is not verified and cannot be restored.');
  }
}
function writeVerifiedProject(captured, buffer, options = {}) {
  assertCapturedRoot(captured);
  const target = captured.projectPath;
  const temp = path.join(path.dirname(target), `.${path.basename(target)}.${process.pid}-${crypto.randomBytes(6).toString('hex')}.tmp`);
  try {
    fs.writeFileSync(temp, buffer, { flag: 'wx', flush: true });
    assertCapturedRoot(captured);
    if (typeof options.beforeRename === 'function') options.beforeRename();
    fs.renameSync(temp, target);
    fs.rmSync(path.join(path.dirname(target), `._${path.basename(target)}`), { force: true });
    if (typeof options.afterRename === 'function') options.afterRename();
    assertCapturedRoot(captured);
    const reread = fs.readFileSync(target);
    if (!reread.equals(buffer) || reread.length !== buffer.length || sha256(reread) !== sha256(buffer)) {
      throw transactionError('RESTORE_READBACK_FAILED', 'Restored project bytes could not be verified.', 'The verified recovery archive remains retained.');
    }
    try { parseProject(reread); }
    catch { throw transactionError('RESTORE_PARSE_FAILED', 'Restored project could not be parsed.', 'The verified recovery archive remains retained.'); }
    return { sha256: sha256(reread), bytes: reread.length };
  } finally {
    try { fs.unlinkSync(temp); } catch {}
    try { fs.unlinkSync(path.join(path.dirname(temp), `._${path.basename(temp)}`)); } catch {}
  }
}
function swapStale(captured, expected, sourceToken) {
  return captured.sha256 !== expected.sha256 || captured.bytes !== expected.bytes || captured.sourceToken !== sourceToken;
}
function recoveryError(error, recoveries, captured) {
  let state = 'recovery_required';
  try {
    assertCapturedRoot(captured[0]);
    for (const item of captured) writeVerifiedProject(item, item.buffer);
    state = 'rolled_back';
  } catch {}
  error.status = Number.isInteger(error.status) ? error.status : 500;
  error.code = /^[A-Z][A-Z0-9_]+$/.test(error.code || '') ? error.code : 'SWAP_FAILED';
  error.message = 'Swap did not complete.';
  error.guidance = state === 'rolled_back'
    ? 'Original slots were restored and verified. Both verified recovery archives remain retained.'
    : 'Recovery is required. Reconnect the original source and restore the retained recovery archives.';
  error.recovery = recoveries.map(item => recoveryReceipt(item.file, state));
  return error;
}

function validateInstrumentRequest(body, keys) {
  if (!isPlainObject(body) || !hasExactKeys(body, keys)) throw requestError(400, 'INVALID_INSTRUMENT_REQUEST', 'Instrument request is invalid.');
  validatePackType(body.type);
  for (const key of keys.filter(k => k !== 'type' && k !== 'source')) validateSlot(body[key]);
  if (keys.includes('source')) validateString(body.source, 'source', 2000, false);
  return body;
}
function packPathUnder(root, type, slot) {
  validatePackType(type); validateSlot(slot);
  const base = fs.realpathSync(root);
  const packRoot = fs.realpathSync(path.join(base, 'samplepacks'));
  const candidate = path.join(packRoot, type, String(slot).padStart(2, '0'));
  const relative = path.relative(packRoot, candidate);
  if (!relative || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw requestError(400, 'PATH_OUTSIDE_ROOT', 'Instrument path is outside the source.');
  return { packRoot, dir: candidate };
}
function gridManifest(root) {
  const out = [];
  const walk = (dir, relative = '') => {
    for (const name of fs.readdirSync(dir)) {
      if (name.startsWith('.')) continue;
      const full = path.join(dir, name), rel = path.join(relative, name);
      const stat = fs.lstatSync(full);
      if (stat.isDirectory()) walk(full, rel);
      else if (stat.isFile()) { const bytes = fs.readFileSync(full); out.push({ path: rel.split(path.sep).join('/'), bytes: bytes.length, sha256: sha256(bytes) }); }
      else throw new Error('unsupported sample-pack entry');
    }
  };
  try { walk(root); } catch { return null; }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}
function validateImportSource(value) {
  const roots = [MUSIC_DIR, TRASH_DIR];
  let candidate;
  try {
    if (path.isAbsolute(value)) throw new Error('absolute');
    const lexical = path.resolve(MUSIC_DIR, value);
    const full = fs.realpathSync(lexical);
    const allowed = roots.some(root => { const base = fs.realpathSync(root); const rel = path.relative(base, full); return rel && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel); });
    const st = fs.lstatSync(lexical);
    if (!allowed || st.isSymbolicLink() || !st.isFile() || !/\.(aif|aiff)$/i.test(full)) throw new Error('invalid');
    candidate = full;
  } catch { throw requestError(400, 'INVALID_IMPORT_PATH', 'Import source is not an allowed AIFF file.'); }
  const bytes = fs.readFileSync(candidate);
  try { packInfo(bytes); } catch { throw requestError(400, 'INVALID_AIFF', 'Import source is not a valid AIFF sample.'); }
  return { path: candidate, bytes };
}
function restoreGrid(root, backup) {
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  copyDir(backup, root);
  // macOS writes provenance as AppleDouble sidecars on the OP-Z FAT volume.
  const clean = dir => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (name.startsWith('._')) fs.rmSync(full, { recursive: true, force: true });
      else if (fs.lstatSync(full).isDirectory()) clean(full);
    }
  };
  clean(root);
  fs.rmSync(path.join(path.dirname(root), `._${path.basename(root)}`), { force: true });
}
function instrumentRecoveryError(error, recovery, captured, backup, gridRoot) {
  let state = 'recovery_required';
  try { assertCapturedRoot(captured); restoreGrid(gridRoot, backup); if (manifestMatches(gridRoot, gridManifest(backup))) state = 'rolled_back'; } catch {}
  error.status = Number.isInteger(error.status) ? error.status : 500;
  error.code = /^[A-Z][A-Z0-9_]+$/.test(error.code || '') ? error.code : 'INSTRUMENT_FAILED';
  error.message = 'Instrument change did not complete.';
  error.guidance = state === 'rolled_back' ? 'The original instrument grid was restored and verified. The recovery archive remains retained.' : 'Recovery is required. Reconnect the source and restore the retained recovery archive.';
  error.recovery = recoveryReceipt(recovery.file, state);
  return error;
}
function gridRestoreError(error, recovery, captured, backup, gridRoot) {
  let state = 'recovery_required';
  try {
    assertCapturedRoot(captured);
    restoreGrid(gridRoot, backup);
    if (manifestMatches(gridRoot, gridManifest(backup))) state = 'rolled_back';
  } catch {}
  error.status = Number.isInteger(error.status) ? error.status : 500;
  error.code = /^[A-Z][A-Z0-9_]+$/.test(error.code || '') ? error.code : 'GRID_RESTORE_FAILED';
  error.message = 'Whole-grid restore did not complete.';
  error.guidance = state === 'rolled_back'
    ? 'The original instrument grid was restored and verified. The recovery archive remains retained.'
    : 'Recovery is required. Reconnect the source and restore the retained recovery archive.';
  error.recovery = recoveryReceipt(recovery.file, state);
  return error;
}

function manualFreeInspection(file, options = {}) {
  const id = validateBundleId(file);
  const dir = resolveChild(options.libraryRoot || LIB_DIR, id);
  const classification = classifyArchive(dir);
  if (!classification.verified) {
    throw requestError(409, 'BUNDLE_UNVERIFIED', 'Library bundle is not verified and cannot guide manual freeing.');
  }
  const archive = {
    id,
    name: classification.metadata.name || 'untitled',
    slot: classification.source.slot,
    source: classification.source.label,
  };
  const result = (relation, guidance, eligible = false) => ({ eligible, relation, archive, guidance });
  if (!classification.complete) {
    return result('archive_incomplete', 'This verified project archive is not a complete portable song archive. Create a complete archive first.');
  }
  if (!classification.source.device) {
    return result('source_mismatch', 'This archive did not come from a mounted OP-Z. Connect and archive the original device slot.');
  }
  const findDevice = options.findDevice || findDeviceRoot;
  const device = findDevice();
  if (!device) return result('mount_unavailable', 'The mounted OP-Z is unavailable. Reconnect it in content mode, then refresh. The archive remains retained.');
  if (device.label !== classification.source.label) {
    return result('source_mismatch', 'The mounted OP-Z identity does not match this archive. Reconnect the original source. The archive remains retained.');
  }
  let captured;
  try {
    captured = (options.capture || captureSource)(classification.source.slot, {
      ...device,
      device: true,
      path: path.join(device.root, 'projects'),
    });
  } catch {
    return result('unclassified', 'The archived slot could not be read. Stop and reconnect the original OP-Z. The archive remains retained.');
  }
  if (captured.bytes !== classification.project.bytes || captured.sha256 !== classification.project.sha256) {
    return result('unexpected_non_empty_replacement', 'The mounted slot no longer matches the archived song. Stop and inspect the device. The archive remains retained.');
  }
  try { (options.assertCaptured || assertCapturedSource)(captured); }
  catch (error) {
    return result(error.code === 'SOURCE_UNAVAILABLE' ? 'mount_unavailable' : 'unclassified',
      'The mounted source changed or disconnected during inspection. Stop, reconnect the original OP-Z, and refresh. The archive remains retained.');
  }
  return result('archived_song_present',
    'Archive and mounted slot match. Confirm the exact identity before following the on-device checklist.', true);
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
  try {
    let url;
    try { url = new URL(req.url, 'http://x'); }
    catch { throw requestError(400, 'INVALID_URL', 'Request URL is invalid.'); }
    requireLoopbackHost(req);
    const p = url.pathname;
    if (req.method === 'POST') requireMutationRequest(req);
    if (req.method === 'POST' && unavailableMutationGuidance[p]) {
      throw requestError(409, 'PHASE_UNAVAILABLE', 'This write is not available yet.', unavailableMutationGuidance[p]);
    }
    if (p === '/api/state') {
      const meta = loadMeta(testHooks.metaFile || META_FILE);
      const libraryRoot = testHooks.libraryRoot || LIB_DIR;
      const autoRoot = Object.hasOwn(testHooks, 'autoRoot') ? testHooks.autoRoot : AUTO_DIR;
      const library = scanLibrary(meta, libraryRoot, autoRoot);
      const drafts = scanDrafts(libraryRoot);
      const clearResolver = Object.hasOwn(testHooks, 'clearAcceptanceFile') ? (testHooks.sourceResolver || getSource) : getSource;
      const slotState = scanSlots(meta, Object.hasOwn(testHooks, 'clearAcceptanceFile') ? clearResolver : getSource);
      const clearSource = activeMutation ? null : clearResolver();
      const clearSlot = clearSource && slotState.slots.find(slot => slot.sourceToken);
      const manualOptions = {
        libraryRoot,
        findDevice: testHooks.deviceRootResolver || findDeviceRoot,
        capture: testHooks.manualCaptureSource || captureSource,
        assertCaptured: testHooks.manualAssertCapturedSource || assertCapturedSource,
      };
      return json(res, 200, {
        ...slotState,
        clearEnabled: Boolean(clearSlot && clearEnabled(clearSource)),
        library,
        archiveShelf: archiveShelfData(library, drafts, (file, auto) => auto
          ? { eligible: false, relation: 'archive_ineligible', guidance: 'Automatic recovery backups are retained but do not offer manual-free guidance.' }
          : manualFreeInspection(file, manualOptions)),
        recordings: scanRecordings(),
        instruments: scanInstruments(),
        mutation: activeMutation,
        drafts,
      });
    }
    if (p === '/api/manual-free') {
      if (req.method !== 'GET') throw requestError(405, 'READ_ONLY_ROUTE', 'Manual-free inspection is read-only.');
      return json(res, 200, manualFreeInspection(url.searchParams.get('file'), {
        libraryRoot: testHooks.libraryRoot || LIB_DIR,
        findDevice: testHooks.deviceRootResolver || findDeviceRoot,
        capture: testHooks.manualCaptureSource || captureSource,
        assertCaptured: testHooks.manualAssertCapturedSource || assertCapturedSource,
      }), { 'Cache-Control': 'no-store' });
    }
    if (p === '/api/clear-slot' && req.method === 'POST') {
      const body = validateClear(await readBody(req));
      return await withMutation(`clear slot ${body.slot}`, async mutation => {
        const source = (testHooks.sourceResolver || getSource)();
        if (!source || source.device !== true) throw transactionError('CLEAR_UNAVAILABLE', 'Automatic clearing is unavailable.',
          'Connect the original OP-Z in Content Mode, or use the manual-free checklist.', 409);
        const captured = (testHooks.captureSource || captureSource)(body.slot, source);
        mutation.source = publicSource(captured);
        if (captured.sourceToken !== body.sourceToken || captured.sha256 !== body.targetFingerprint.sha256 || captured.bytes !== body.targetFingerprint.bytes) {
          throw transactionError('CLEAR_TARGET_STALE', 'The selected slot changed after preview.', 'Refresh and review the archive and mounted slot again.', 409);
        }
        const acceptance = loadClearAcceptance(testHooks.clearAcceptanceFile || CLEAR_ACCEPTANCE_FILE);
        if (!clearEnabled(source, acceptance)) throw transactionError('CLEAR_UNAVAILABLE', 'Automatic clearing is unavailable.',
          'Complete the exact delete-project-file fixture and sacrificial-device acceptance, or use the manual-free checklist.', 409);
        const bundle = findBundle(body.file, body.auto, testHooks.libraryRoot || LIB_DIR,
          Object.hasOwn(testHooks, 'autoRoot') ? testHooks.autoRoot : AUTO_DIR);
        if (bundle.archiveRevision !== body.archiveRevision || !bundle.classification.verified || !bundle.classification.complete
            || !bundle.classification.samplepacks.captured) throw transactionError('CLEAR_ARCHIVE_INCOMPLETE', 'The reviewed archive is not a complete verified recovery.',
          'Create a complete archive first. The mounted source was not changed.', 409);
        assertCapturedSource(captured);
        const autoRoot = Object.hasOwn(testHooks, 'autoRoot') ? testHooks.autoRoot : AUTO_DIR;
        const recovery = archiveCapturedProject(captured, { libraryRoot: autoRoot, name: `recovery-slot${body.slot}`, deep: true, operation: mutation.operation });
        const receipt = recoveryReceipt(recovery.file, 'retained');
        let deleted = false;
        try {
          assertCapturedSource(captured);
          if (typeof testHooks.beforeClearDelete === 'function') testHooks.beforeClearDelete(captured);
          fs.unlinkSync(captured.projectPath); deleted = true;
          if (typeof testHooks.afterClearDelete === 'function') testHooks.afterClearDelete(captured);
          assertCapturedRoot(captured);
          const confirmed = typeof testHooks.confirmClear === 'function'
            ? testHooks.confirmClear(captured)
            : !fs.existsSync(captured.projectPath);
          if (!confirmed || fs.existsSync(captured.projectPath)) throw transactionError('CLEAR_UNCONFIRMED', 'Automatic clearing could not be confirmed.',
            'Reconnect the original OP-Z in Content Mode and refresh. If the slot is not empty, restore the retained recovery archive.', 409);
          return json(res, 200, { ok: true, verified: true, cleared: true, slot: body.slot, source: publicSource(captured),
            recovery: receipt, guidance: 'Slot cleared and the empty-slot state was confirmed on the same mounted OP-Z. The verified recovery archive remains retained.' });
        } catch (error) {
          error.status = Number.isInteger(error.status) ? error.status : 409;
          error.code = /^[A-Z][A-Z0-9_]+$/.test(error.code || '') ? error.code : 'CLEAR_UNCONFIRMED';
          error.message = 'Automatic clearing was not confirmed.';
          error.guidance = 'Reconnect the original OP-Z in Content Mode and refresh. Restore the retained recovery archive if the slot is not empty.';
          error.recovery = receipt;
          if (!deleted) error.message = 'Automatic clearing did not start.';
          throw error;
        }
      });
    }
    if (p === '/api/pattern') {
      const slot = parseInt(url.searchParams.get('slot'), 10);
      const pat = parseInt(url.searchParams.get('pattern'), 10);
      const buf = fs.readFileSync(projFile(slot));
      return json(res, 200, { tempo: parseProject(buf).tempo, notes: parseNotes(buf, pat), tracks: parseTrackChunks(buf, pat) });
    }
    if (p === '/api/split/confirm' && req.method === 'POST') {
      const body = validateSplitIntent(await readBody(req), testHooks.sourceResolver || getSource);
      const metaFile = testHooks.metaFile || META_FILE;
      const meta = loadMetaForUpdate(metaFile);
      if (!isPlainObject(meta.splits)) meta.splits = {};
      const intent = { parentHash: body.parentHash, halves: body.halves, confirmed: new Date().toISOString() };
      meta.splits[body.parentHash] = intent;
      saveMeta(meta, metaFile);
      return json(res, 200, { ok: true, split: intent });
    }
    if (p === '/api/split/archive' && req.method === 'POST') {
      const body = validateSplitArchiveRequest(await readBody(req));
      return await withMutation('archive confirmed split half', async mutation => {
        const source = (testHooks.sourceResolver || getSource)();
        if (!source) throw sourceError('SOURCE_UNAVAILABLE', 'No project source is available.');
        const meta = loadMeta(testHooks.metaFile || META_FILE);
        const intent = meta.splits && meta.splits[body.parentHash];
        if (!intent || intent.parentHash !== body.parentHash || !Array.isArray(intent.halves) || intent.halves.length !== 2) {
          throw transactionError('SPLIT_INTENT_REQUIRED', 'This split is not currently confirmed.', 'Review and confirm the split again.', 409);
        }
        let captured = null;
        for (let slot = 1; slot <= 10; slot++) {
          try {
            const candidate = (testHooks.captureSource || captureSource)(slot, source);
            if (candidate.sha256 === body.parentHash) { captured = candidate; break; }
          } catch {}
        }
        if (!captured) throw transactionError('SPLIT_PARENT_STALE', 'The parent project changed or is unavailable.', 'Refresh the slot and review the split again.', 409);
        const half = intent.halves[body.half];
        const archiveBuffer = synthesizeSplitProject(captured.buffer, half.patterns);
        mutation.source = publicSource(captured);
        const result = archiveCapturedProject(captured, {
          libraryRoot: testHooks.libraryRoot || LIB_DIR, archiveBuffer, deep: false,
          name: half.name, operation: mutation.operation,
          metadata: { name: half.name },
          split: { version: 1, parentSha256: body.parentHash, patterns: half.patterns.slice(), name: half.name },
          acceptance: null,
        });
        return json(res, 200, { ...result, parentHash: body.parentHash, half: body.half });
      });
    }
    if (p === '/api/split/acceptance' && req.method === 'POST') {
      const body = validateAcceptanceRequest(await readBody(req));
      return await withMutation('record split hardware acceptance', async () => {
        const source = (testHooks.sourceResolver || getSource)();
        if (!source || source.device !== true) throw transactionError('HARDWARE_REQUIRED', 'A mounted OP-Z is required for acceptance.', 'Connect a real OP-Z in Content Mode, then retry.', 409);
        const bundle = findBundle(body.file, false, testHooks.libraryRoot || LIB_DIR, Object.hasOwn(testHooks, 'autoRoot') ? testHooks.autoRoot : AUTO_DIR);
        if (!bundle.classification.split) throw requestError(400, 'INVALID_ACCEPTANCE', 'Only synthesized split archives require acceptance.');
        const acceptance = { version: 1, projectSha256: bundle.classification.project.sha256, ...body.outcomes, recorded: new Date().toISOString() };
        const infoPath = path.join(bundle.dir, 'info.json');
        const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
        info.acceptance = acceptance;
        saveJsonAtomic(infoPath, info);
        const checked = classifyArchive(bundle.dir);
        if (!checked.restoreEligible) throw archiveError('ARCHIVE_ACCEPTANCE_INVALID', 'Hardware acceptance could not be verified.');
        return json(res, 200, { ok: true, file: body.file, restoreEligible: true, acceptance });
      });
    }
    if (p === '/api/meta' && req.method === 'POST') {
      const body = await readBody(req);
      if (!isPlainObject(body)) throw requestError(400, 'INVALID_METADATA', 'Invalid song metadata.');
      validateString(body.hash, 'hash', 64, false);
      if (!/^[a-f0-9]{16,64}$/i.test(body.hash)) {
        throw requestError(400, 'INVALID_METADATA', 'Invalid song metadata.');
      }
      validateMetadataFields(body.fields);
      const metaFile = testHooks.metaFile || META_FILE;
      const meta = loadMetaForUpdate(metaFile);
      meta.songs[body.hash] = { ...(meta.songs[body.hash] || {}), ...body.fields, updated: new Date().toISOString() };
      saveMeta(meta, metaFile);
      return json(res, 200, { ok: true });
    }

    // ---- song library ----
    if (p === '/api/backup' && req.method === 'POST') {
      const body = validateBackup(await readBody(req));
      return await withMutation(`archive slot ${body.slot}`, async mutation => {
        if (testHooks.beforeBackupCapture) await testHooks.beforeBackupCapture();
        const metaFile = testHooks.metaFile || META_FILE;
        const source = (testHooks.sourceResolver || getSource)();
        if (!source) throw new Error('no source');
        const captured = (testHooks.captureSource || captureSource)(body.slot, source);
        mutation.source = publicSource(captured);
        const meta = loadMeta(metaFile);
        const hash = hashFile(captured.buffer);
        const annotation = isPlainObject(meta.songs[hash]) ? meta.songs[hash] : {};
        const name = body.name || (typeof annotation.name === 'string' && annotation.name.length <= 120 ? annotation.name : '') || `slot${body.slot}`;
        const result = archiveCapturedProject(captured, {
          libraryRoot: testHooks.libraryRoot || LIB_DIR,
          name,
          deep: body.deep,
          metadata: { ...annotation, name },
          recording: annotation.wav ? { root: annotation.wavRoot, path: annotation.wav } : null,
          operation: mutation.operation,
        });
        let metadataSaved = true;
        if (body.name) {
          try {
            const updatedMeta = loadMetaForUpdate(metaFile);
            updatedMeta.songs[hash] = { ...(updatedMeta.songs[hash] || {}), name: body.name };
            saveMeta(updatedMeta, metaFile);
          } catch { metadataSaved = false; }
        }
        return json(res, 200, {
          ...result,
          metadataSaved,
          guidance: metadataSaved ? result.guidance : `${result.guidance} The name annotation was not saved; repair the metadata file and add it again.`,
        });
      });
    }
    if (p === '/api/restore' && req.method === 'POST') {
      const body = validateRestore(await readBody(req));
      return await withMutation(`restore slot ${body.slot}`, async mutation => {
        const source = (testHooks.sourceResolver || getSource)();
        if (!source) throw sourceError('SOURCE_UNAVAILABLE', 'No project source is available.');
        const captured = (testHooks.captureSource || captureSource)(body.slot, source);
        mutation.source = publicSource(captured);
        const stale = () => captured.sha256 !== body.targetFingerprint.sha256 || captured.bytes !== body.targetFingerprint.bytes
          || captured.sourceToken !== body.sourceToken;
        if (stale()) throw transactionError('RESTORE_TARGET_STALE', 'The selected target changed after preview.',
          `Slot ${String(body.slot).padStart(2, '0')} changed after preview. Refresh and review it again.`, 409);
        let bundle = findBundle(body.file, body.auto, testHooks.libraryRoot || LIB_DIR,
          Object.hasOwn(testHooks, 'autoRoot') ? testHooks.autoRoot : AUTO_DIR);
        if (bundle.archiveRevision !== body.archiveRevision) throw transactionError('RESTORE_ARCHIVE_STALE', 'The reviewed archive changed.',
          'Archive changed. Refresh before restoring.', 409);
        if (!bundle.classification.restoreEligible) throw transactionError('SPLIT_RESTORE_PENDING', 'This synthesized split archive is not restore-eligible yet.',
          'Complete the five-outcome sacrificial-device acceptance and refresh before restoring.', 409);
        assertCapturedSource(captured);
        const autoRoot = Object.hasOwn(testHooks, 'autoRoot') ? testHooks.autoRoot : AUTO_DIR;
        fs.mkdirSync(autoRoot, { recursive: true });
        const recovery = archiveCapturedProject(captured, {
          libraryRoot: autoRoot,
          name: `recovery-slot${body.slot}`,
          deep: false,
          operation: mutation.operation,
        });
        if (stale()) throw transactionError('RESTORE_TARGET_STALE', 'The selected target changed after preview.',
          `Slot ${String(body.slot).padStart(2, '0')} changed after preview. Refresh and review it again.`, 409);
        bundle = findBundle(body.file, body.auto, testHooks.libraryRoot || LIB_DIR,
          Object.hasOwn(testHooks, 'autoRoot') ? testHooks.autoRoot : AUTO_DIR);
        if (bundle.archiveRevision !== body.archiveRevision) throw transactionError('RESTORE_ARCHIVE_STALE', 'The reviewed archive changed.',
          'Archive changed. Refresh before restoring.', 409);
        let mutationStarted = false;
        const receipt = recoveryReceipt(recovery.file, 'retained');
        try {
          const output = writeVerifiedProject(captured, bundle.buffer, {
            beforeRename() { mutationStarted = true; if (testHooks.beforeRestoreRename) testHooks.beforeRestoreRename(); },
            afterRename() { if (testHooks.afterRestoreRename) testHooks.afterRestoreRename(); },
          });
          const metaFile = testHooks.metaFile || META_FILE;
          try {
            const meta = loadMetaForUpdate(metaFile);
            meta.songs[hashFile(bundle.buffer)] = { ...(meta.songs[hashFile(bundle.buffer)] || {}), ...bundle.classification.metadata };
            saveMeta(meta, metaFile);
          } catch {
            const error = transactionError('RESTORE_METADATA_FAILED', 'Project bytes verified, but annotations were not saved.',
              'Project bytes were restored and verified, but the restore did not fully complete. The verified recovery archive remains retained.', 500);
            error.recovery = receipt;
            throw error;
          }
          return json(res, 200, { ok: true, verified: true, slot: body.slot, source: publicSource(captured), evidence: output, recovery: receipt,
            guidance: captured.device ? 'Written bytes were reread and verified on the mounted OP-Z in Content Mode.' : 'Written bytes were reread and verified in the local fixture.' });
        } catch (error) {
          if (!mutationStarted) throw error;
          if (error.code === 'RESTORE_METADATA_FAILED') throw error;
          let state = 'recovery_required';
          try {
            assertCapturedRoot(captured);
            writeVerifiedProject(captured, captured.buffer);
            state = 'rolled_back';
          } catch {}
          error.status = Number.isInteger(error.status) ? error.status : 500;
          error.code = /^[A-Z][A-Z0-9_]+$/.test(error.code || '') ? error.code : 'RESTORE_FAILED';
          error.message = 'Restore did not complete.';
          error.guidance = state === 'rolled_back'
            ? 'Original bytes were restored and verified. The verified recovery archive remains retained.'
            : 'Recovery is required. Reconnect the original source and restore the retained recovery archive.';
          error.recovery = recoveryReceipt(recovery.file, state);
          throw error;
        }
      });
    }
    if (p === '/api/swap' && req.method === 'POST') {
      const body = validateSwap(await readBody(req));
      return await withMutation(`swap slots ${body.a} and ${body.b}`, async mutation => {
        const source = (testHooks.sourceResolver || getSource)();
        if (!source) throw sourceError('SOURCE_UNAVAILABLE', 'No project source is available.');
        const capture = testHooks.captureSource || captureSource;
        const first = capture(body.a, source), second = capture(body.b, source);
        mutation.source = publicSource(first);
        if (swapStale(first, body.expectedA, body.sourceToken) || swapStale(second, body.expectedB, body.sourceToken)
            || first.sourceToken !== second.sourceToken) {
          throw transactionError('SWAP_TARGET_STALE', 'A selected slot changed after preview.', 'Refresh and review both slots again.', 409);
        }
        const autoRoot = Object.hasOwn(testHooks, 'autoRoot') ? testHooks.autoRoot : AUTO_DIR;
        fs.mkdirSync(autoRoot, { recursive: true });
        const captures = [first, second];
        const recoveries = captures.map((captured, index) => archiveCapturedProject(captured, {
          libraryRoot: autoRoot, name: `recovery-slot${captured.slot}`, deep: false,
          operation: mutation.operation, beforePublish: index === 0 ? testHooks.beforeSecondSwapBackup : undefined,
        }));
        if (swapStale(first, body.expectedA, body.sourceToken) || swapStale(second, body.expectedB, body.sourceToken)) {
          throw transactionError('SWAP_TARGET_STALE', 'A selected slot changed after preview.', 'Refresh and review both slots again.', 409);
        }
        assertCapturedSource(first); assertCapturedSource(second);
        let started = false;
        try {
          writeVerifiedProject(first, second.buffer, { beforeRename() { started = true; if (testHooks.beforeFirstSwapRename) testHooks.beforeFirstSwapRename(); }, afterRename: testHooks.afterFirstSwapRename });
          writeVerifiedProject(second, first.buffer, { beforeRename: testHooks.beforeSecondSwapRename, afterRename: testHooks.afterSecondSwapRename });
          return json(res, 200, { ok: true, verified: true, slots: [body.a, body.b], source: publicSource(first),
            recovery: recoveries.map(item => recoveryReceipt(item.file, 'retained')),
            guidance: 'Both slots were reread and verified. Both recovery archives were retained.' });
        } catch (error) {
          if (!started) throw error;
          throw recoveryError(error, recoveries, captures);
        }
      });
    }
    if (p === '/api/instruments/restore-grid' && req.method === 'POST') {
      const body = validateRestoreGrid(await readBody(req));
      return await withMutation('restore whole instrument grid', async mutation => {
        const source = (testHooks.sourceResolver || getSource)();
        if (!source) throw sourceError('SOURCE_UNAVAILABLE', 'No project source is available.');
        const captured = (testHooks.captureSource || captureSource)(1, source);
        mutation.source = publicSource(captured);
        if (captured.sourceToken !== body.sourceToken) throw transactionError('RESTORE_SOURCE_STALE', 'The selected source changed after preview.', 'Reconnect the original source and refresh before restoring.', 409);
        assertCapturedSource(captured);
        const bundle = findBundle(body.file, body.auto, testHooks.libraryRoot || LIB_DIR,
          Object.hasOwn(testHooks, 'autoRoot') ? testHooks.autoRoot : AUTO_DIR);
        if (bundle.archiveRevision !== body.archiveRevision || !bundle.classification.verified || !bundle.classification.samplepacks.captured) {
          throw transactionError('RESTORE_ARCHIVE_STALE', 'The reviewed archive is no longer a complete grid archive.', 'Archive changed. Refresh before restoring.', 409);
        }
        const archiveRoot = resolveChild(body.auto ? (Object.hasOwn(testHooks, 'autoRoot') ? testHooks.autoRoot : AUTO_DIR) : (testHooks.libraryRoot || LIB_DIR), body.file);
        const incoming = path.join(archiveRoot, 'samplepacks');
        if (!fs.lstatSync(incoming).isDirectory() || !manifestMatches(incoming, bundle.classification.samplepacks.files)) {
          throw transactionError('RESTORE_ARCHIVE_STALE', 'The archived instrument grid could not be verified.', 'Archive changed. Refresh before restoring.', 409);
        }
        assertCapturedRoot(captured);
        const grid = fs.realpathSync(path.join(captured.root, 'samplepacks'));
        const before = gridManifest(grid);
        if (!before) throw sourceError('SOURCE_UNAVAILABLE', 'Sample packs are unavailable.');
        const autoRoot = Object.hasOwn(testHooks, 'autoRoot') ? testHooks.autoRoot : AUTO_DIR;
        fs.mkdirSync(autoRoot, { recursive: true });
        const recovery = archiveCapturedProject(captured, { libraryRoot: autoRoot, name: 'recovery-instruments-grid', deep: true, operation: mutation.operation });
        const rollback = path.join(resolveChild(autoRoot, recovery.file), 'samplepacks');
        if (!manifestMatches(rollback, before)) throw transactionError('GRID_RECOVERY_VERIFY_FAILED', 'Instrument grid recovery could not be verified.', 'The live instrument grid was not changed.', 500);
        let started = false;
        try {
          assertCapturedRoot(captured);
          if (!manifestMatches(grid, before)) throw transactionError('GRID_SOURCE_CHANGED', 'The live instrument grid changed during preparation.', 'Refresh and retry. The live instrument grid was not changed.', 409);
          if (typeof testHooks.beforeGridRename === 'function') testHooks.beforeGridRename();
          assertCapturedRoot(captured);
          started = true;
          restoreGrid(grid, incoming);
          if (typeof testHooks.afterGridFirstRename === 'function') testHooks.afterGridFirstRename();
          if (typeof testHooks.afterGridSecondRename === 'function') testHooks.afterGridSecondRename();
          assertCapturedRoot(captured);
          if (!manifestMatches(grid, bundle.classification.samplepacks.files)) throw transactionError('GRID_VERIFY_FAILED', 'Restored instrument grid could not be verified.', 'The recovery archive remains retained.', 500);
          return json(res, 200, { ok: true, verified: true, source: publicSource(captured), evidence: { files: bundle.classification.samplepacks.files.length }, recovery: recoveryReceipt(recovery.file, 'retained'), guidance: captured.device ? 'Whole grid was reread and verified on the mounted OP-Z in Content Mode.' : 'Whole grid was reread and verified in the local fixture.' });
        } catch (error) {
          if (!started) throw error;
          throw gridRestoreError(error, recovery, captured, rollback, grid);
        }
      });
    }
    // ---- instruments ----
    if (p === '/api/instruments/move' || p === '/api/instruments/remove' || p === '/api/instruments/import' || p === '/api/instruments/snapshot') {
      const action = p.split('/').pop();
      const keys = action === 'move' ? ['type', 'from', 'to'] : action === 'import' ? ['type', 'slot', 'source'] : action === 'remove' ? ['type', 'slot'] : [];
      const body = action === 'snapshot' ? await readBody(req) : validateInstrumentRequest(await readBody(req), keys);
      if (action === 'snapshot' && (!isPlainObject(body) || Object.keys(body).length)) throw requestError(400, 'INVALID_INSTRUMENT_REQUEST', 'Snapshot request must be empty.');
      return await withMutation(`${action} instruments`, async mutation => {
        const source = (testHooks.sourceResolver || getSource)();
        if (!source) throw sourceError('SOURCE_UNAVAILABLE', 'No project source is available.');
        const captured = (testHooks.captureSource || captureSource)(1, source);
        mutation.source = publicSource(captured);
        assertCapturedRoot(captured);
        const grid = packPathUnder(captured.root, PACK_TYPES[0], 1).packRoot;
        const before = gridManifest(grid);
        if (!before) throw sourceError('SOURCE_UNAVAILABLE', 'Sample packs are unavailable.');
        const autoRoot = Object.hasOwn(testHooks, 'autoRoot') ? testHooks.autoRoot : AUTO_DIR;
        fs.mkdirSync(autoRoot, { recursive: true });
        const recovery = archiveCapturedProject(captured, { libraryRoot: autoRoot, name: 'recovery-instruments', deep: true, operation: mutation.operation });
        if (action === 'snapshot') return json(res, 200, { ok: true, verified: true, recovery: recoveryReceipt(recovery.file, 'retained'), guidance: 'Complete instrument recovery was verified and retained.' });
        assertCapturedRoot(captured);
        const backup = fs.mkdtempSync(path.join(os.tmpdir(), 'opz-grid-backup-'));
        copyDir(grid, backup);
        let expectedManifest = before.slice();
        let started = false;
        try {
          if (action === 'move') {
            const from = packPathUnder(captured.root, body.type, body.from).dir;
            const to = packPathUnder(captured.root, body.type, body.to).dir;
            if (!fs.existsSync(from) || !slotFiles(from).length) throw requestError(409, 'SOURCE_PACK_EMPTY', 'Source instrument slot is empty.');
            const fromManifest = gridManifest(from);
            if (fs.existsSync(to) && slotFiles(to).length) {
              const toManifest = gridManifest(to), stage = fs.mkdtempSync(path.join(os.tmpdir(), 'opz-pack-swap-'));
              copyDir(from, path.join(stage, 'from')); copyDir(to, path.join(stage, 'to'));
              if (!manifestMatches(path.join(stage, 'from'), fromManifest) || !manifestMatches(path.join(stage, 'to'), toManifest)) throw transactionError('PACK_VERIFY_FAILED', 'Instrument copy could not be verified.', 'The live instrument grid was not changed.', 500);
              fs.rmSync(from, { recursive: true, force: true }); fs.rmSync(to, { recursive: true, force: true });
              fs.renameSync(path.join(stage, 'from'), to); fs.renameSync(path.join(stage, 'to'), from); fs.rmSync(stage, { recursive: true, force: true });
            } else {
              fs.mkdirSync(path.dirname(to), { recursive: true }); copyDir(from, to);
              if (!manifestMatches(to, fromManifest)) throw transactionError('PACK_VERIFY_FAILED', 'Instrument copy could not be verified.', 'The live instrument grid was not changed.', 500);
              fs.rmSync(from, { recursive: true, force: true });
            }
            const fromPrefix = `${body.type}/${String(body.from).padStart(2, '0')}/`, toPrefix = `${body.type}/${String(body.to).padStart(2, '0')}/`;
            const targetItems = expectedManifest.filter(item => item.path.startsWith(toPrefix));
            expectedManifest = expectedManifest.filter(item => !item.path.startsWith(fromPrefix) && !item.path.startsWith(toPrefix));
            expectedManifest.push(...fromManifest.map(item => ({ ...item, path: toPrefix + item.path })));
            if (targetItems.length) expectedManifest.push(...targetItems.map(item => ({ ...item, path: fromPrefix + item.path.slice(toPrefix.length) })));
            started = true;
          } else if (action === 'remove') {
            const dir = packPathUnder(captured.root, body.type, body.slot).dir;
            if (!fs.existsSync(dir) || !slotFiles(dir).length) throw requestError(409, 'SOURCE_PACK_EMPTY', 'Instrument slot is empty.');
            const trash = path.join(testHooks.trashRoot || TRASH_DIR, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`);
            fs.mkdirSync(trash, { recursive: true });
            const trashManifest = copyDir(dir, trash);
            if (!manifestMatches(trash, trashManifest)) throw transactionError('TRASH_VERIFY_FAILED', 'Instrument trash copy could not be verified.', 'The live instrument grid was not changed.', 500);
            assertCapturedRoot(captured); fs.rmSync(dir, { recursive: true, force: true }); started = true;
            const prefix = `${body.type}/${String(body.slot).padStart(2, '0')}/`;
            expectedManifest = expectedManifest.filter(item => !item.path.startsWith(prefix));
          } else {
            const imported = validateImportSource(body.source);
            const target = packPathUnder(captured.root, body.type, body.slot).dir;
            if (fs.existsSync(target) && slotFiles(target).length) throw requestError(409, 'TARGET_OCCUPIED', 'Instrument target slot is not empty.');
            fs.mkdirSync(target, { recursive: true });
            const out = path.join(target, path.basename(imported.path));
            const tmp = `${out}.${process.pid}-${crypto.randomBytes(4).toString('hex')}.tmp`;
            fs.writeFileSync(tmp, imported.bytes, { flag: 'wx', flush: true });
            if (!fs.readFileSync(tmp).equals(imported.bytes)) throw transactionError('IMPORT_READBACK_FAILED', 'Imported sample could not be verified.', 'The live instrument grid was not changed.', 500);
            fs.renameSync(tmp, out); started = true;
            expectedManifest.push({ path: `${body.type}/${String(body.slot).padStart(2, '0')}/${path.basename(imported.path)}`, bytes: imported.bytes.length, sha256: sha256(imported.bytes) });
          }
          assertCapturedRoot(captured);
          if (!manifestMatches(grid, expectedManifest)) throw transactionError('GRID_VERIFY_FAILED', 'Instrument grid could not be verified.', 'The retained recovery archive remains available.', 500);
          return json(res, 200, { ok: true, verified: true, recovery: recoveryReceipt(recovery.file, 'retained'), guidance: 'Instrument change verified. The complete pre-change grid recovery was retained.' });
        } catch (error) {
          if (!started) throw error;
          throw instrumentRecoveryError(error, recovery, captured, backup, grid);
        } finally { try { fs.rmSync(backup, { recursive: true, force: true }); } catch {} }
      });
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
      try { settings = JSON.parse(fs.readFileSync(testHooks.settingsFile || SETTINGS_FILE, 'utf8')); } catch {}
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
      const settingsFile = testHooks.settingsFile || SETTINGS_FILE;
      const cur = loadSettingsForUpdate(settingsFile);
      saveSettings({ ...cur, ...body }, settingsFile);
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
      let src = null;
      if (rootParam === 'device') {
        src = (testHooks.sourceResolver || getSource)();
        if (!src || !src.device) { res.writeHead(404); return res.end(); }
      } else if (rootParam && rootParam !== 'music') { res.writeHead(403); return res.end(); }
      const rootKind = rootParam === 'device' ? 'device' : 'music';
      const entries = recordingRoots(src).filter(root => root.kind === rootKind);
      const base = entries[0].base;
      const roots = entries.map(root => root.dir);
      let full;
      try { full = fs.realpathSync(path.resolve(base, rel)); }
      catch { res.writeHead(404); return res.end(); }
      const ext = path.extname(full).toLowerCase();
      const allowedRoots = [];
      for (const root of roots) {
        try { allowedRoots.push(fs.realpathSync(root)); } catch {}
      }
      const isChildPath = root => {
        const relative = path.relative(root, full);
        return !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
      };
      if (!new Set(['.wav', '.aif', '.aiff', '.mp3', '.m4a']).has(ext) || !allowedRoots.some(isChildPath)) {
        res.writeHead(403); return res.end();
      }
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
        ...(e.source ? { source: e.source } : {}), ...(e.active ? { active: e.active } : {}),
        ...(Array.isArray(e.recovery) ? { recovery: e.recovery.map(item => recoveryReceipt(item.id, item.state)).filter(Boolean) }
          : e.recovery && recoveryReceipt(e.recovery.id, e.recovery.state) ? { recovery: recoveryReceipt(e.recovery.id, e.recovery.state) } : {}) }
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
  splitEvidence,
  validateSplitIntent,
  validateSplitArchiveRequest,
  validateAcceptanceRequest,
  validateClear,
  loadClearAcceptance,
  clearAcceptanceValid,
  clearEnabled,
  synthesizeSplitProject,
  acceptanceValid,
  validateRestore,
  validateSwap,
  loadMeta,
  loadMetaForUpdate,
  loadSettingsForUpdate,
  saveMeta,
  saveSettings,
  resolveChild,
  findBundle,
  manualFreeInspection,
  classifyArchive,
  captureSource,
  assertCapturedRoot,
  assertCapturedSource,
  writeVerifiedProject,
  withMutation,
  archiveCapturedProject,
  scanLibrary,
  archiveShelfData,
  scanDrafts,
  server,
};

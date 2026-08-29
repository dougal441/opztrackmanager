'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const vm = require('node:vm');
const { parseProject } = require('../parser.js');

// Keep the pre-test server implementation from binding a port during the TDD red run.
const originalListen = http.Server.prototype.listen;
http.Server.prototype.listen = function () { return this; };
const subject = require('../server.js');
http.Server.prototype.listen = originalListen;

const FIXTURE = path.join(__dirname, '..', 'opzdisk', 'projects', 'project01.opz');

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
  return {
    sourceRoot,
    libraryRoot,
    source: { root: sourceRoot, path: projects, device: false, label: 'temporary fixture' },
  };
}

function visibleBundles(libraryRoot) {
  return fs.readdirSync(libraryRoot).filter(name => !name.startsWith('.'));
}

function snapshotRegularFiles(root) {
  const records = [];
  const walk = dir => {
    for (const name of fs.readdirSync(dir).sort()) {
      const file = path.join(dir, name);
      const stat = fs.lstatSync(file, { bigint: true });
      if (stat.isDirectory()) walk(file);
      else if (stat.isFile()) {
        const bytes = fs.readFileSync(file);
        records.push({
          path: path.relative(root, file),
          bytes: Number(stat.size),
          mode: Number(stat.mode & 0o7777n),
          mtimeNs: String(stat.mtimeNs),
          sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
        });
      }
    }
  };
  walk(root);
  return records.sort((a, b) => a.path.localeCompare(b.path));
}

function schemaInfo(bytes, overrides = {}) {
  const checked = '2026-08-25T12:00:00.000Z';
  return {
    schemaVersion: 1,
    created: checked,
    source: { device: false, label: 'temporary fixture', slot: 1 },
    project: {
      path: 'song.opz',
      bytes: bytes.length,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      checked,
    },
    metadata: { name: 'Song', tags: '', notes: '', kit: {} },
    snippet: { status: 'unlinked' },
    samplepacks: { captured: false, files: [] },
    ...overrides,
  };
}

function writeSchemaBundle(libraryRoot, name, info, bytes = fs.readFileSync(FIXTURE)) {
  const dir = path.join(libraryRoot, name);
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'song.opz'), bytes);
  fs.writeFileSync(path.join(dir, 'info.json'), JSON.stringify(info));
  return dir;
}

function useFixtureSource(t, sourceRoot) {
  const previous = process.env.OPZ_ROOT;
  process.env.OPZ_ROOT = sourceRoot;
  t.after(() => {
    if (previous === undefined) delete process.env.OPZ_ROOT;
    else process.env.OPZ_ROOT = previous;
  });
}

function request(server, pathname, options = {}) {
  const address = server.address();
  return new Promise((resolve, reject) => {
    const body = options.body === undefined
      ? (options.payload === undefined ? null : JSON.stringify(options.payload))
      : options.body;
    const req = http.request({
      host: '127.0.0.1',
      port: address.port,
      path: pathname,
      method: options.method || (body === null ? 'GET' : 'POST'),
      headers: options.headers || (body === null ? {} : { 'Content-Type': 'application/json', 'X-OPZ-Mutation': '1' }),
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (options.raw) return resolve({ status: res.statusCode, headers: res.headers, body });
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch (error) { reject(error); }
      });
    });
    req.on('error', reject);
    req.end(body === null ? undefined : body);
  });
}

function requestJson(server, pathname, payload) {
  return request(server, pathname, payload === undefined ? {} : { payload });
}

function rawRequest(server, message) {
  return new Promise((resolve, reject) => {
    let response = '';
    const socket = net.createConnection(server.address().port, '127.0.0.1', () => socket.end(message));
    socket.on('data', chunk => response += chunk);
    socket.on('end', () => resolve(response));
    socket.on('error', reject);
  });
}

test('verified archive tracer publishes reread, parsed bytes with evidence', t => {
  const fixture = fs.readFileSync(FIXTURE);
  const { source, libraryRoot } = tempRoots(t, fixture);
  const captured = subject.captureSource(1, source);
  const result = subject.archiveCapturedProject(captured, { libraryRoot, name: 'Tracer song', deep: false });

  assert.equal(result.verified, true);
  assert.equal(result.source.device, false);
  assert.equal(result.source.label, 'temporary fixture');
  assert.match(result.guidance, /No OP-Z data changed/);

  const bundles = visibleBundles(libraryRoot);
  assert.deepEqual(bundles, [result.file]);
  const bundle = path.join(libraryRoot, result.file);
  const stored = fs.readFileSync(path.join(bundle, 'song.opz'));
  const info = JSON.parse(fs.readFileSync(path.join(bundle, 'info.json'), 'utf8'));
  assert.ok(stored.equals(fixture));
  assert.equal(info.project.sha256, crypto.createHash('sha256').update(stored).digest('hex'));
  assert.equal(info.project.bytes, stored.length);
  assert.equal(info.schemaVersion, 1);
  assert.equal(subject.scanLibrary({ songs: {} }, libraryRoot, null)[0].verified, true);

  info.project.sha256 = '0'.repeat(64);
  fs.writeFileSync(path.join(bundle, 'info.json'), JSON.stringify(info));
  assert.equal(subject.scanLibrary({ songs: {} }, libraryRoot, null)[0].verified, false);
});

test('split review is deterministic, explicitly confirmed, and source immutable', async t => {
  const fixture = fs.readFileSync(FIXTURE);
  const roots = tempRoots(t, fixture);
  const metaFile = path.join(roots.sourceRoot, 'meta.json');
  subject.testHooks.sourceResolver = () => roots.source;
  subject.testHooks.metaFile = metaFile;
  useFixtureSource(t, roots.sourceRoot);
  t.after(() => { for (const key of Object.keys(subject.testHooks)) delete subject.testHooks[key]; if (subject.server.listening) subject.server.close(); });
  await new Promise((resolve, reject) => subject.server.listen(0, '127.0.0.1', resolve).once('error', reject));
  const before = fs.readFileSync(path.join(roots.source.path, 'project01.opz'));
  const parentHash = crypto.createHash('sha256').update(before).digest('hex');
  const state = await requestJson(subject.server, '/api/state');
  const review = state.body.slots[0].splitReview;
  assert.equal(review.suggested, true);
  assert.deepEqual(review, subject.splitEvidence(parseProject(before), parentHash));
  const confirmed = await requestJson(subject.server, '/api/split/confirm', {
    parentHash,
    halves: review.memberships.map((patterns, i) => ({ name: `Half ${i + 1}`, patterns })),
  });
  assert.equal(confirmed.status, 200);
  assert.deepEqual(confirmed.body.split.halves.map(h => h.patterns), review.memberships);
  assert.deepEqual(JSON.parse(fs.readFileSync(metaFile, 'utf8')).splits[parentHash].halves, confirmed.body.split.halves);
  assert.ok(fs.readFileSync(path.join(roots.source.path, 'project01.opz')).equals(before));
  const stale = await requestJson(subject.server, '/api/split/confirm', {
    parentHash: '0'.repeat(64), halves: confirmed.body.split.halves,
  });
  assert.equal(stale.status, 409);
});

test('confirmed split synthesis is deterministic, parent-bound, and repairs chains', t => {
  const parent = fs.readFileSync(FIXTURE);
  const parsed = parseProject(parent);
  const selected = parsed.usedPatterns.slice(0, 2);
  const before = crypto.createHash('sha256').update(parent).digest('hex');
  const first = subject.synthesizeSplitProject(parent, selected);
  const second = subject.synthesizeSplitProject(parent, selected);
  assert.ok(first.equals(second));
  assert.equal(crypto.createHash('sha256').update(parent).digest('hex'), before);
  const output = parseProject(first);
  assert.deepEqual(output.usedPatterns, selected.slice().sort((a, b) => a - b));
  assert.equal(output.chains.every(chain => chain.patterns.every(pattern => selected.includes(pattern))), true);
  assert.ok(first.subarray(572 + 2 * 21392, 572 + 3 * 21392).every(byte => byte === 0));
});

test('split archive acceptance stays pending without exact five-outcome evidence', t => {
  assert.equal(subject.acceptanceValid(null, 'a'.repeat(64)), false);
  assert.equal(subject.acceptanceValid({ version: 1, projectSha256: 'a'.repeat(64), eject: true,
    reconnect: true, rejection: true, playback: true, recovery: false, recorded: '2026-08-25T12:00:00.000Z' }, 'a'.repeat(64)), false);
});

test('split acceptance provenance and five-outcome action reach the browser', t => {
  const roots = tempRoots(t);
  const fixture = fs.readFileSync(FIXTURE);
  const split = { version: 1, parentSha256: 'b'.repeat(64), patterns: [0, 4], name: 'Half one' };
  const dir = writeSchemaBundle(roots.libraryRoot, 'pending-split', schemaInfo(fixture, { split, acceptance: null }), fixture);
  const item = subject.scanLibrary({ songs: {} }, roots.libraryRoot, null).find(entry => entry.file === 'pending-split');
  const shelf = subject.archiveShelfData([item], []).verified[0];
  assert.deepEqual(shelf.split, split);
  assert.equal(shelf.restoreEligible, false);
  assert.match(shelf.restoreReason, /pending sacrificial-device acceptance/);
  assert.equal(subject.classifyArchive(dir).restoreEligible, false);
  const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
  assert.match(html, /data-split-acceptance/);
  assert.match(html, /Five observed hardware outcomes/);
  assert.match(html, /api\('\/api\/split\/acceptance'/);
});

test('archive classification keeps manifest verification completeness and unicode metadata separate', t => {
  const { libraryRoot } = tempRoots(t);
  const fixture = fs.readFileSync(FIXTURE);
  const unicode = { name: '夜の歌 🎶', tags: '深夜, α', notes: 'Ångström — 安全', kit: { kick: 1, chord: 10 } };
  const projectOnly = schemaInfo(fixture, { metadata: unicode });
  writeSchemaBundle(libraryRoot, 'project-only', projectOnly, fixture);

  const complete = schemaInfo(fixture, {
    created: '2026-08-25T13:00:00.000Z',
    samplepacks: { captured: true, files: [] },
  });
  const completeDir = writeSchemaBundle(libraryRoot, 'complete', complete, fixture);
  fs.mkdirSync(path.join(completeDir, 'samplepacks'));

  const items = subject.scanLibrary({ songs: {} }, libraryRoot, null);
  const projectItem = items.find(item => item.file === 'project-only');
  const completeItem = items.find(item => item.file === 'complete');
  assert.equal(projectItem.verified, true);
  assert.equal(projectItem.complete, false);
  assert.equal(projectItem.manualFreeEligible, false);
  assert.deepEqual(projectItem.metadata, unicode);
  assert.equal(completeItem.verified, true);
  assert.equal(completeItem.complete, true);
  assert.equal(completeItem.manualFreeEligible, false);
  assert.equal(subject.findBundle('project-only', false, libraryRoot, null).buffer.equals(fixture), true);
});

test('library scan excludes only app support roots from archive diagnostics', t => {
  const { libraryRoot } = tempRoots(t);
  const fixture = fs.readFileSync(FIXTURE);
  const autoRoot = path.join(libraryRoot, 'auto-backups');
  fs.mkdirSync(autoRoot);
  fs.mkdirSync(path.join(libraryRoot, 'instrument-trash'));
  fs.mkdirSync(path.join(libraryRoot, 'genuine-partial'));
  writeSchemaBundle(libraryRoot, 'valid-archive', schemaInfo(fixture), fixture);

  const items = subject.scanLibrary({ songs: {} }, libraryRoot, autoRoot);
  assert.deepEqual(items.map(item => item.file).sort(), ['genuine-partial', 'valid-archive']);
  assert.equal(items.find(item => item.file === 'valid-archive').verified, true);
  assert.deepEqual(items.filter(item => !item.verified).map(item => item.file), ['genuine-partial']);
});

test('shelf data keeps archive counts evidence and newest first diagnostics separate', t => {
  const { libraryRoot } = tempRoots(t);
  const fixture = fs.readFileSync(FIXTURE);
  const newest = schemaInfo(fixture, {
    created: '2026-08-25T14:00:00.000Z',
    metadata: { name: '夜の歌 🎶', tags: '深夜, α', notes: 'Ångström — 安全', kit: {} },
    samplepacks: { captured: true, files: [
      { path: '1-kick/01/kick.aif', bytes: 4, sha256: crypto.createHash('sha256').update('kick').digest('hex') },
      { path: '1-kick/02/other.aif', bytes: 5, sha256: crypto.createHash('sha256').update('other').digest('hex') },
      { path: '6-lead/01/lead.aif', bytes: 4, sha256: crypto.createHash('sha256').update('lead').digest('hex') },
    ] },
  });
  const newestDir = writeSchemaBundle(libraryRoot, 'z-newest', newest, fixture);
  for (const [relative, content] of [['1-kick/01/kick.aif', 'kick'], ['1-kick/02/other.aif', 'other'], ['6-lead/01/lead.aif', 'lead']]) {
    const file = path.join(newestDir, 'samplepacks', relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }

  writeSchemaBundle(libraryRoot, 'b-tied', schemaInfo(fixture, { created: '2026-08-25T13:00:00.000Z' }), fixture);
  writeSchemaBundle(libraryRoot, 'a-tied', schemaInfo(fixture, { created: '2026-08-25T13:00:00.000Z' }), fixture);
  writeSchemaBundle(libraryRoot, 'bad', schemaInfo(fixture, {
    created: '2026-08-25T15:00:00.000Z',
    source: { device: true, label: 'OP-Z α', slot: 4 },
    project: { ...schemaInfo(fixture).project, sha256: '0'.repeat(64) },
  }), fixture);

  const library = subject.scanLibrary({ songs: {} }, libraryRoot, null);
  const shelf = subject.archiveShelfData(library, [{
    id: '.partial-safe', verified: false, source: { device: false, label: 'fixture β', slot: 2 },
    slot: 2, time: '2026-08-25T12:30:00.000Z', errorCode: 'ARCHIVE_INCOMPLETE',
  }]);

  assert.equal(shelf.verifiedCount, 3);
  assert.equal(shelf.diagnosticCount, 2);
  assert.deepEqual(shelf.verified.map(item => item.id), ['z-newest', 'a-tied', 'b-tied']);
  assert.equal(shelf.verified[0].metadata.name, '夜の歌 🎶');
  assert.equal(shelf.verified[0].project.parsed, true);
  assert.equal(shelf.verified[0].project.storedBytesMatch, true);
  assert.ok(shelf.verified[0].patterns.length > 0);
  assert.ok(Array.isArray(shelf.verified[0].chains));
  assert.deepEqual(shelf.verified[0].samplepacks.summary, {
    fileCount: 3,
    totalBytes: 13,
    perTrack: {
      '1-kick': { files: 2, bytes: 9 },
      '2-snare': { files: 0, bytes: 0 },
      '3-perc': { files: 0, bytes: 0 },
      '4-fx': { files: 0, bytes: 0 },
      '5-bass': { files: 0, bytes: 0 },
      '6-lead': { files: 1, bytes: 4 },
      '7-arpeggio': { files: 0, bytes: 0 },
      '8-chord': { files: 0, bytes: 0 },
    },
  });
  assert.equal(shelf.verified.find(item => item.id === 'a-tied').complete, false);
  assert.deepEqual(shelf.diagnostics.map(item => item.category).sort(), ['corrupt', 'failed']);
  assert.equal(shelf.diagnostics.find(item => item.id === 'bad').source.label, 'OP-Z α');
  for (const diagnostic of shelf.diagnostics) {
    assert.equal(Object.hasOwn(diagnostic, 'restoreEligible'), false);
    assert.equal(Object.hasOwn(diagnostic, 'manualFreeEligible'), false);
    assert.equal(Object.hasOwn(diagnostic, 'targetSlot'), false);
    assert.equal(Object.hasOwn(diagnostic, 'actions'), false);
  }

  assert.deepEqual(subject.archiveShelfData([], []), {
    verified: [], diagnostics: [], verifiedCount: 0, diagnosticCount: 0,
  });
  assert.ok(!JSON.stringify(shelf).includes(libraryRoot));
});

test('manifest diagnostics reject unsupported partial traversal symlink and stored evidence tampering', t => {
  const { libraryRoot } = tempRoots(t);
  const fixture = fs.readFileSync(FIXTURE);
  const cases = [
    ['legacy', { name: 'old record' }, 'ARCHIVE_LEGACY'],
    ['unsupported', schemaInfo(fixture, { schemaVersion: 2 }), 'ARCHIVE_UNSUPPORTED'],
    ['partial', schemaInfo(fixture, { metadata: undefined }), 'ARCHIVE_PARTIAL'],
    ['traversal', schemaInfo(fixture, { project: { ...schemaInfo(fixture).project, path: '../song.opz' } }), 'ARCHIVE_CORRUPT'],
    ['tampered', schemaInfo(fixture, { project: { ...schemaInfo(fixture).project, sha256: '0'.repeat(64) } }), 'ARCHIVE_CORRUPT'],
    ['bad-status', schemaInfo(fixture, { snippet: { status: 'portable' } }), 'ARCHIVE_CORRUPT'],
    ['oversized', schemaInfo(fixture, { metadata: { name: 'x'.repeat(121), tags: '', notes: '', kit: {} } }), 'ARCHIVE_CORRUPT'],
  ];
  for (const [name, info, errorCode] of cases) {
    writeSchemaBundle(libraryRoot, name, info, fixture);
    const item = subject.scanLibrary({ songs: {} }, libraryRoot, null).find(entry => entry.file === name);
    assert.equal(item.verified, false, name);
    assert.equal(item.complete, false, name);
    assert.equal(item.restoreEligible, false, name);
    assert.equal(item.manualFreeEligible, false, name);
    assert.equal(item.errorCode, errorCode, name);
    assert.throws(() => subject.findBundle(name, false, libraryRoot, null), error => error.code === 'BUNDLE_UNVERIFIED');
  }

  const malformed = path.join(libraryRoot, 'malformed');
  fs.mkdirSync(malformed);
  fs.writeFileSync(path.join(malformed, 'song.opz'), fixture);
  fs.writeFileSync(path.join(malformed, 'info.json'), '{');
  assert.equal(subject.scanLibrary({ songs: {} }, libraryRoot, null)
    .find(item => item.file === 'malformed').errorCode, 'ARCHIVE_CORRUPT');

  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'opz-manifest-outside-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  const symlinkInfo = schemaInfo(fixture, {
    snippet: { status: 'included', path: 'snippet/linked.wav', bytes: 7, sha256: crypto.createHash('sha256').update('outside').digest('hex') },
    samplepacks: { captured: true, files: [] },
  });
  const symlinkBundle = writeSchemaBundle(libraryRoot, 'symlink', symlinkInfo, fixture);
  fs.mkdirSync(path.join(symlinkBundle, 'snippet'));
  fs.writeFileSync(path.join(outside, 'linked.wav'), 'outside');
  fs.symlinkSync(path.join(outside, 'linked.wav'), path.join(symlinkBundle, 'snippet', 'linked.wav'));
  const symlink = subject.scanLibrary({ songs: {} }, libraryRoot, null).find(item => item.file === 'symlink');
  assert.equal(symlink.verified, false);
  assert.equal(symlink.errorCode, 'ARCHIVE_CORRUPT');
  assert.ok(!JSON.stringify(subject.scanLibrary({ songs: {} }, libraryRoot, null)).includes(libraryRoot));
  assert.ok(!JSON.stringify(symlink).includes(outside));
});

test('snippet capture records included unlinked missing and unavailable states without escaping roots', t => {
  const fixture = fs.readFileSync(FIXTURE);
  const included = tempRoots(t, fixture);
  const bounceDir = path.join(included.sourceRoot, 'bounces');
  const snippetBytes = Buffer.from([0, 255, 1, 2, 128]);
  fs.mkdirSync(bounceDir);
  fs.writeFileSync(path.join(bounceDir, 'take.wav'), snippetBytes);
  const includedResult = subject.archiveCapturedProject(subject.captureSource(1, {
    ...included.source, device: true, label: 'fixture OP-Z',
  }), {
    libraryRoot: included.libraryRoot,
    name: 'Included snippet',
    deep: true,
    metadata: { name: 'スニペット 🎵', tags: 'α', notes: '安全', kit: {} },
    recording: { root: 'device', path: 'bounces/take.wav' },
  });
  const includedBundle = path.join(included.libraryRoot, includedResult.file);
  const includedInfo = JSON.parse(fs.readFileSync(path.join(includedBundle, 'info.json'), 'utf8'));
  assert.equal(includedInfo.snippet.status, 'included');
  assert.equal(includedInfo.snippet.path, 'snippet/recording.wav');
  assert.equal(includedInfo.snippet.bytes, snippetBytes.length);
  assert.equal(includedInfo.snippet.sha256, crypto.createHash('sha256').update(snippetBytes).digest('hex'));
  assert.ok(fs.readFileSync(path.join(includedBundle, includedInfo.snippet.path)).equals(snippetBytes));
  assert.equal(subject.scanLibrary({ songs: {} }, included.libraryRoot, null)[0].complete, true);

  const statuses = [
    ['unlinked', null],
    ['missing', { root: 'device', path: 'bounces/missing.wav' }],
    ['unavailable', { root: 'device', path: '../outside.wav' }],
  ];
  for (const [status, recording] of statuses) {
    const roots = tempRoots(t, fixture);
    const result = subject.archiveCapturedProject(subject.captureSource(1, {
      ...roots.source, device: true, label: 'fixture OP-Z',
    }), {
      libraryRoot: roots.libraryRoot,
      name: status,
      deep: true,
      metadata: { name: status, tags: '', notes: '', kit: {} },
      recording,
    });
    const info = JSON.parse(fs.readFileSync(path.join(roots.libraryRoot, result.file, 'info.json'), 'utf8'));
    assert.deepEqual(info.snippet, { status });
    assert.equal(subject.scanLibrary({ songs: {} }, roots.libraryRoot, null)[0].complete, status === 'unlinked');
  }

  const escaped = tempRoots(t, fixture);
  const outside = path.join(path.dirname(escaped.sourceRoot), 'outside.wav');
  fs.writeFileSync(outside, 'outside');
  fs.mkdirSync(path.join(escaped.sourceRoot, 'bounces'));
  fs.symlinkSync(outside, path.join(escaped.sourceRoot, 'bounces', 'escape.wav'));
  const escapedResult = subject.archiveCapturedProject(subject.captureSource(1, {
    ...escaped.source, device: true, label: 'fixture OP-Z',
  }), {
    libraryRoot: escaped.libraryRoot,
    name: 'symlink', deep: true,
    metadata: { name: 'symlink', tags: '', notes: '', kit: {} },
    recording: { root: 'device', path: 'bounces/escape.wav' },
  });
  const escapedInfo = JSON.parse(fs.readFileSync(path.join(escaped.libraryRoot, escapedResult.file, 'info.json'), 'utf8'));
  assert.deepEqual(escapedInfo.snippet, { status: 'unavailable' });
});

test('whole-grid stored evidence and manifest publication preserve the source on success and failure', t => {
  const fixture = fs.readFileSync(FIXTURE);
  const create = () => {
    const roots = tempRoots(t, fixture);
    const pack = path.join(roots.sourceRoot, 'samplepacks', '1-kick', '01');
    fs.mkdirSync(pack, { recursive: true });
    fs.writeFileSync(path.join(pack, 'kick.aif'), Buffer.from('pack bytes'));
    return roots;
  };
  const sourceHash = crypto.createHash('sha256').update(fixture).digest('hex');
  const success = create();
  let hiddenBeforePublish = false;
  const result = subject.archiveCapturedProject(subject.captureSource(1, success.source), {
    libraryRoot: success.libraryRoot,
    name: 'Complete evidence',
    deep: true,
    metadata: { name: '夜の歌', tags: '深夜', notes: '完全', kit: { kick: 1 } },
    recording: null,
    beforePublish(_storedPath, draft) {
      hiddenBeforePublish = visibleBundles(success.libraryRoot).length === 0 && path.basename(draft).startsWith('.partial-');
    },
  });
  assert.equal(hiddenBeforePublish, true);
  const bundle = path.join(success.libraryRoot, result.file);
  const info = JSON.parse(fs.readFileSync(path.join(bundle, 'info.json'), 'utf8'));
  assert.equal(info.schemaVersion, 1);
  assert.deepEqual(info.metadata, { name: '夜の歌', tags: '深夜', notes: '完全', kit: { kick: 1 } });
  assert.deepEqual(info.source, { device: false, label: 'temporary fixture', slot: 1 });
  assert.equal(info.project.path, 'song.opz');
  assert.deepEqual(info.samplepacks.files.map(item => item.path), ['1-kick/01/kick.aif']);
  assert.equal(result.complete, true);
  assert.ok(!JSON.stringify(info).includes(success.sourceRoot));
  assert.ok(!JSON.stringify(info).includes('rootInode'));
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(success.sourceRoot, 'projects', 'project01.opz'))).digest('hex'), sourceHash);

  for (const target of ['manifest', 'pack', 'snippet', 'source-pack']) {
    const roots = create();
    const recording = target === 'snippet' ? { root: 'device', path: 'bounces/tamper.wav' } : null;
    if (recording) {
      fs.mkdirSync(path.join(roots.sourceRoot, 'bounces'));
      fs.writeFileSync(path.join(roots.sourceRoot, recording.path), 'snippet bytes');
    }
    const source = recording ? { ...roots.source, device: true, label: 'fixture OP-Z' } : roots.source;
    assert.throws(() => subject.archiveCapturedProject(subject.captureSource(1, source), {
      libraryRoot: roots.libraryRoot,
      name: `Tampered ${target}`,
      deep: true,
      metadata: { name: target, tags: '', notes: '', kit: {} },
      recording,
      beforePublish(_storedPath, draft) {
        if (target === 'manifest') fs.writeFileSync(path.join(draft, 'info.json'), '{');
        else if (target === 'pack') fs.writeFileSync(path.join(draft, 'samplepacks', '1-kick', '01', 'kick.aif'), 'tampered');
        else if (target === 'snippet') fs.writeFileSync(path.join(draft, 'snippet', 'recording.wav'), 'tampered');
        else fs.writeFileSync(path.join(roots.sourceRoot, 'samplepacks', '1-kick', '01', 'kick.aif'), 'tampered');
      },
    }), error => error.code === 'ARCHIVE_MANIFEST_MISMATCH');
    assert.deepEqual(visibleBundles(roots.libraryRoot), []);
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(roots.sourceRoot, 'projects', 'project01.opz'))).digest('hex'), sourceHash);
  }
});

test('HTTP manifest publication snapshots bounded annotations and original snippet selection', async t => {
  const roots = tempRoots(t);
  const fixture = fs.readFileSync(FIXTURE);
  const hash = crypto.createHash('md5').update(fixture).digest('hex').slice(0, 16);
  const bounceDir = path.join(roots.sourceRoot, 'bounces');
  fs.mkdirSync(bounceDir);
  fs.writeFileSync(path.join(bounceDir, 'http.wav'), Buffer.from('http snippet'));
  const metaFile = path.join(path.dirname(roots.libraryRoot), 'meta.json');
  fs.writeFileSync(metaFile, JSON.stringify({ songs: { [hash]: {
    name: '原曲', tags: 'タグ', notes: 'ノート', kit: { bass: 2 },
    wavRoot: 'device', wav: 'bounces/http.wav', updated: 'private', wavMatch: 'manual',
  } } }));
  subject.testHooks.sourceResolver = () => ({ ...roots.source, device: true, label: 'fixture OP-Z' });
  subject.testHooks.libraryRoot = roots.libraryRoot;
  subject.testHooks.metaFile = metaFile;
  t.after(() => {
    for (const key of Object.keys(subject.testHooks)) delete subject.testHooks[key];
    if (subject.server.listening) subject.server.close();
  });
  await new Promise((resolve, reject) => subject.server.listen(0, '127.0.0.1', resolve).once('error', reject));

  const response = await requestJson(subject.server, '/api/backup', { slot: 1, name: '', deep: true });
  assert.equal(response.status, 200);
  assert.equal(response.body.complete, true);
  const info = JSON.parse(fs.readFileSync(path.join(roots.libraryRoot, response.body.file, 'info.json'), 'utf8'));
  assert.deepEqual(info.metadata, { name: '原曲', tags: 'タグ', notes: 'ノート', kit: { bass: 2 } });
  assert.equal(info.snippet.status, 'included');
  assert.equal(Object.hasOwn(info.metadata, 'wav'), false);
  assert.equal(Object.hasOwn(info.metadata, 'updated'), false);
});

test('deep archive verifies every stored sample-pack byte', t => {
  const roots = tempRoots(t);
  const packDir = path.join(roots.sourceRoot, 'samplepacks', '1-kick', '01');
  fs.mkdirSync(packDir, { recursive: true });
  fs.writeFileSync(path.join(packDir, 'kick.aif'), Buffer.from('sample bytes'));
  const result = subject.archiveCapturedProject(subject.captureSource(1, roots.source), {
    libraryRoot: roots.libraryRoot,
    name: 'Deep fixture',
    deep: true,
  });
  const bundle = path.join(roots.libraryRoot, result.file);
  const info = JSON.parse(fs.readFileSync(path.join(bundle, 'info.json'), 'utf8'));
  assert.deepEqual(info.samplepacks.files.map(item => item.path), ['1-kick/01/kick.aif']);
  assert.equal(subject.scanLibrary({ songs: {} }, roots.libraryRoot, null)[0].verified, true);

  fs.writeFileSync(path.join(bundle, 'samplepacks', '1-kick', '01', 'kick.aif'), Buffer.from('corrupt'));
  assert.equal(subject.scanLibrary({ songs: {} }, roots.libraryRoot, null)[0].verified, false);
  assert.throws(() => subject.findBundle(result.file, false, roots.libraryRoot, null), error => error.code === 'BUNDLE_UNVERIFIED');

  const changed = tempRoots(t);
  const changedPack = path.join(changed.sourceRoot, 'samplepacks', '1-kick', '01');
  fs.mkdirSync(changedPack, { recursive: true });
  const changedFile = path.join(changedPack, 'kick.aif');
  fs.writeFileSync(changedFile, Buffer.from('before'));
  assert.throws(() => subject.archiveCapturedProject(subject.captureSource(1, changed.source), {
    libraryRoot: changed.libraryRoot,
    name: 'Changing source',
    deep: true,
    beforeVerify() { fs.writeFileSync(changedFile, Buffer.from('after')); },
  }), error => error.code === 'ARCHIVE_MANIFEST_MISMATCH');
  assert.deepEqual(visibleBundles(changed.libraryRoot), []);
  assert.equal(subject.scanDrafts(changed.libraryRoot)[0].errorCode, 'ARCHIVE_MANIFEST_MISMATCH');

  const missing = tempRoots(t);
  fs.rmdirSync(path.join(missing.sourceRoot, 'samplepacks'));
  assert.throws(() => subject.archiveCapturedProject(subject.captureSource(1, missing.source), {
    libraryRoot: missing.libraryRoot,
    name: 'Missing packs',
    deep: true,
  }), error => error.code === 'SOURCE_UNAVAILABLE');
  assert.deepEqual(visibleBundles(missing.libraryRoot), []);

  const empty = tempRoots(t);
  const emptyResult = subject.archiveCapturedProject(subject.captureSource(1, empty.source), {
    libraryRoot: empty.libraryRoot,
    name: 'Empty packs',
    deep: true,
  });
  const emptyBundle = path.join(empty.libraryRoot, emptyResult.file);
  fs.rmdirSync(path.join(emptyBundle, 'samplepacks'));
  assert.equal(subject.scanLibrary({ songs: {} }, empty.libraryRoot, null)[0].verified, false);
});

test('binary bytes and undersized input never publish an invalid archive', t => {
  const fixture = fs.readFileSync(FIXTURE);
  assert.ok(fixture.includes(0));
  assert.ok(fixture.some(byte => byte > 127));

  const valid = tempRoots(t, fixture);
  const result = subject.archiveCapturedProject(subject.captureSource(1, valid.source), {
    libraryRoot: valid.libraryRoot,
    name: 'Binary fixture',
    deep: false,
  });
  assert.ok(fs.readFileSync(path.join(valid.libraryRoot, result.file, 'song.opz')).equals(fixture));

  const invalid = tempRoots(t, Buffer.from([0, 255, 128]));
  assert.throws(() => subject.archiveCapturedProject(subject.captureSource(1, invalid.source), {
    libraryRoot: invalid.libraryRoot,
    name: 'Too small',
    deep: false,
  }), /unexpected \.opz size/);
  assert.deepEqual(visibleBundles(invalid.libraryRoot), []);
});

test('archive UI sends mutation header and confirms source intent', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
  assert.match(html, /X-OPZ-Mutation/);
  assert.match(html, /Archive slot/);
  assert.match(html, /complete sample-pack grid/);
  assert.match(html, /Device data/);
  assert.match(html, /STATE\.source/);
});

test('source status UI identifies source and active operation accessibly', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
  assert.match(html, /id="source"[^>]+role="status"[^>]+aria-live="polite"/);
  assert.match(html, /mounted OP-Z/);
  assert.match(html, /local fixture/);
  assert.match(html, /no source/);
  assert.match(html, /STATE\.mutation/);
  assert.match(html, /mutationBusy \|\| STATE\.mutation/);
  assert.match(html, /currentMutation\.operation/);
  assert.match(html, /active[^<]+slot/i);
});

test('mutation controls share one operation-aware busy wrapper', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
  assert.match(html, /async function runMutation\(operation, callback\)/);
  assert.match(html, /try \{ return await callback\(\); \}[\s\S]+finally/);
  assert.match(html, /querySelectorAll\('\[data-mutation\]'\)/);
  for (const action of ['backup', 'doSwap', 'removePack', 'importPack', 'snapshotInstruments', 'downloadPack']) {
    assert.match(html, new RegExp('data-mutation="[^"]+"[^>]+onclick="' + action + '\\('), action);
  }
  assert.doesNotMatch(html, /data-mutation="[^"]+"[^>]+onclick="restore\(/);
  assert.match(html, /runMutation\('archive slot ' \+ slot/);
});

test('mutation busy state resets after success and failure', async () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
  const source = html.match(/async function runMutation\([\s\S]*?\n}\n(?=function esc)/)[0];
  const states = [];
  const context = vm.createContext({
    STATE: { source: { device: true, label: 'OP-Z' } },
    mutationBusy: null,
    render() { states.push(Boolean(context.mutationBusy)); },
  });
  vm.runInContext(source, context);

  assert.equal(await context.runMutation('archive slot 1', async () => 'ok'), 'ok');
  assert.deepEqual(states, [true, false]);
  assert.equal(context.mutationBusy, null);

  states.length = 0;
  await assert.rejects(context.runMutation('archive slot 1', async () => { throw new Error('fail'); }), /fail/);
  assert.deepEqual(states, [true, false]);
  assert.equal(context.mutationBusy, null);
});

test('result guidance remains source-specific and visible', t => {
  const local = tempRoots(t);
  const localResult = subject.archiveCapturedProject(subject.captureSource(1, local.source), {
    libraryRoot: local.libraryRoot,
    name: 'Local guidance',
    deep: false,
  });
  assert.match(localResult.guidance, /No OP-Z (?:data )?changed/);
  assert.match(localResult.guidance, /refresh/i);

  const mounted = tempRoots(t);
  const mountedResult = subject.archiveCapturedProject(subject.captureSource(1, {
    ...mounted.source,
    device: true,
    label: 'OP-Z',
  }), {
    libraryRoot: mounted.libraryRoot,
    name: 'Mounted guidance',
    deep: false,
  });
  assert.match(mountedResult.guidance, /eject/i);
  assert.match(mountedResult.guidance, /reconnect/i);
  assert.match(mountedResult.guidance, /refresh/i);

  const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
  assert.match(html, /j\.guidance/);
});

test('request boundary rejects forged and malformed mutation requests', async t => {
  await new Promise((resolve, reject) => subject.server.listen(0, '127.0.0.1', resolve).once('error', reject));
  t.after(() => { if (subject.server.listening) subject.server.close(); });
  const host = `127.0.0.1:${subject.server.address().port}`;
  const valid = JSON.stringify({ slot: 0, name: '', deep: false });
  const cases = [
    [{ body: valid, headers: { 'Content-Type': 'text/plain', 'X-OPZ-Mutation': '1' } }, 415, 'JSON_REQUIRED'],
    [{ body: valid, headers: { 'Content-Type': 'application/json' } }, 403, 'MUTATION_HEADER_REQUIRED'],
    [{ body: valid, headers: { 'Content-Type': 'application/json', 'X-OPZ-Mutation': '1', 'Sec-Fetch-Site': 'cross-site' } }, 403, 'CROSS_SITE_REQUEST'],
    [{ body: valid, headers: { 'Content-Type': 'application/json', 'X-OPZ-Mutation': '1', Origin: 'http://example.test' } }, 403, 'ORIGIN_MISMATCH'],
    [{ body: valid, headers: { Host: 'attacker.example', Origin: 'http://attacker.example', 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json', 'X-OPZ-Mutation': '1' } }, 403, 'HOST_MISMATCH'],
    [{ body: valid, headers: { 'Content-Type': 'application/json; charset=iso-8859-1', 'X-OPZ-Mutation': '1' } }, 415, 'UNSUPPORTED_ENCODING'],
    [{ body: '{', headers: { 'Content-Type': 'application/json', 'X-OPZ-Mutation': '1' } }, 400, 'INVALID_JSON'],
  ];
  for (const [options, status, code] of cases) {
    const result = await request(subject.server, '/api/backup', options);
    assert.equal(result.status, status);
    assert.equal(result.body.code, code);
    assert.ok(!JSON.stringify(result.body).includes(process.cwd()));
  }
  const accepted = await request(subject.server, '/api/backup', {
    body: valid,
    headers: { Host: host, Origin: `http://${host}`, 'Content-Type': 'application/json; charset=utf-8', 'X-OPZ-Mutation': '1' },
  });
  assert.equal(accepted.status, 400);
  assert.equal(accepted.body.code, 'INVALID_SLOT');
});

test('input validation rejects invalid types before filesystem access', () => {
  for (const slot of [0, 11, '1.0', 1.5, undefined]) {
    assert.throws(() => subject.validateSlot(slot), error => error.code === 'INVALID_SLOT');
  }
  assert.equal(subject.validateSlot(1), 1);
  assert.equal(subject.validateSlot(10), 10);
  for (const value of [0, 1, 'false', null, undefined]) {
    assert.throws(() => subject.validateBoolean(value, 'deep'), error => error.code === 'INVALID_BOOLEAN');
  }
  assert.equal(subject.validateBoolean(false, 'deep'), false);
  assert.equal(subject.validatePackType('1-kick'), '1-kick');
  assert.throws(() => subject.validatePackType('9-path'), error => error.code === 'INVALID_PACK_TYPE');
  assert.throws(() => subject.validateString('x'.repeat(121), 'name', 120), error => error.code === 'INVALID_STRING');
});

test('metadata boundary rejects unsupported shapes and normalizes invalid persistence', async t => {
  for (const fields of [
    { unknown: 'value' },
    { name: { unsafe: true } },
    { kit: { kick: 0 } },
    { kit: { unknown: 1 } },
  ]) assert.throws(() => subject.validateMetadataFields(fields), error => error.code === 'INVALID_METADATA');
  const validFields = subject.validateMetadataFields({
    name: 'Song', tags: '', notes: '', wav: '', wavRoot: 'device', wavMatch: 'manual', kit: { kick: 1, chord: 10 },
  });
  assert.equal(validFields.wavRoot, 'device');
  assert.deepEqual(validFields.kit, { kick: 1, chord: 10 });
  assert.throws(() => subject.validateMetadataFields({ wavRoot: 'other' }), error => error.code === 'INVALID_METADATA');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opz-meta-'));
  const file = path.join(dir, 'meta.json');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(file, JSON.stringify({ songs: [] }));
  assert.deepEqual(subject.loadMeta(file), { songs: {} });

  await new Promise((resolve, reject) => subject.server.listen(0, '127.0.0.1', resolve).once('error', reject));
  t.after(() => { if (subject.server.listening) subject.server.close(); });
  for (const body of [null, [], 'invalid', 1]) {
    const invalid = await requestJson(subject.server, '/api/meta', body);
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.code, 'INVALID_METADATA');
  }
  const result = await requestJson(subject.server, '/api/meta', { hash: 'a'.repeat(16), fields: { name: 42 } });
  assert.equal(result.status, 400);
  assert.equal(result.body.code, 'INVALID_METADATA');
});

test('audio rejects invalid ranges without crashing the server', async t => {
  const roots = tempRoots(t);
  const audioFile = path.join(roots.sourceRoot, 'bounces', 'range.wav');
  fs.mkdirSync(path.dirname(audioFile));
  fs.writeFileSync(audioFile, Buffer.alloc(100));
  useFixtureSource(t, roots.sourceRoot);
  await new Promise((resolve, reject) => subject.server.listen(0, '127.0.0.1', resolve).once('error', reject));
  t.after(() => { if (subject.server.listening) subject.server.close(); });
  const audioPath = '/audio?root=device&path=' + encodeURIComponent('bounces/range.wav');
  const invalid = await request(subject.server, audioPath, { raw: true, headers: { Range: 'bytes=999999999999-' } });
  assert.equal(invalid.status, 416);
  assert.match(invalid.headers['content-range'], /^bytes \*\/\d+$/);
  assert.deepEqual(subject.parseByteRange('bytes=-10', 100), { start: 90, end: 99 });
  assert.equal(subject.parseByteRange('bytes=20-10', 100), null);

  const state = await requestJson(subject.server, '/api/state');
  assert.equal(state.status, 200);
});

test('GET routes and audio stay inside loopback recording roots', async t => {
  const roots = tempRoots(t);
  const outside = path.join(path.dirname(roots.sourceRoot), 'outside.wav');
  const bounces = path.join(roots.sourceRoot, 'bounces');
  fs.mkdirSync(bounces);
  fs.writeFileSync(outside, Buffer.from('outside'));
  fs.symlinkSync(outside, path.join(bounces, 'escape.wav'));
  useFixtureSource(t, roots.sourceRoot);
  await new Promise((resolve, reject) => subject.server.listen(0, '127.0.0.1', resolve).once('error', reject));
  t.after(() => {
    delete subject.testHooks.sourceResolver;
    if (subject.server.listening) subject.server.close();
  });

  const hostile = await request(subject.server, '/api/state', { headers: { Host: 'attacker.example' } });
  assert.equal(hostile.status, 403);
  assert.equal(hostile.body.code, 'HOST_MISMATCH');
  const settings = await request(subject.server, '/audio?path=' + encodeURIComponent('opzgui/data/settings.json'), { raw: true });
  assert.equal(settings.status, 403);
  const escaped = await request(subject.server, '/audio?root=device&path=' + encodeURIComponent('bounces/escape.wav'), { raw: true });
  assert.equal(escaped.status, 403);

  subject.testHooks.sourceResolver = () => null;
  const disconnected = await request(subject.server, '/audio?root=device&path=' + encodeURIComponent('bounces/escape.wav'), { raw: true });
  assert.equal(disconnected.status, 404);
});

test('mounted recordings preserve device identity and play from the device root', async t => {
  const roots = tempRoots(t);
  const bounce = path.join(roots.sourceRoot, 'bounces', 'device-only.wav');
  fs.mkdirSync(path.dirname(bounce));
  fs.writeFileSync(bounce, Buffer.from('device audio'));
  useFixtureSource(t, roots.sourceRoot);
  await new Promise((resolve, reject) => subject.server.listen(0, '127.0.0.1', resolve).once('error', reject));
  t.after(() => { if (subject.server.listening) subject.server.close(); });

  const state = await requestJson(subject.server, '/api/state');
  const recording = state.body.recordings.find(item => item.name === 'device-only.wav');
  assert.equal(recording.root, 'device');
  const played = await request(subject.server, '/audio?root=device&path=' + encodeURIComponent(recording.path), { raw: true });
  assert.equal(played.status, 200);
  assert.equal(played.body, 'device audio');

  const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
  const audioUrlSource = /function audioUrl\(path, root\) \{[^\n]+\}/.exec(html)[0];
  const audioUrl = Function(`${audioUrlSource}; return audioUrl;`)();
  assert.equal(audioUrl(recording.path, recording.root), '/audio?path=bounces%2Fdevice-only.wav&root=device');
  assert.match(html, /wav === r\.path && wavRoot === r\.root/);
});

test('malformed request target returns 400 without crashing the server', async t => {
  await new Promise((resolve, reject) => subject.server.listen(0, '127.0.0.1', resolve).once('error', reject));
  t.after(() => { if (subject.server.listening) subject.server.close(); });
  const response = await rawRequest(subject.server, 'GET http://[ HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n');
  assert.match(response, /^HTTP\/1\.1 400 /);
  assert.match(response, /"code":"INVALID_URL"/);
  assert.equal((await requestJson(subject.server, '/api/state')).status, 200);
});

test('settings response never exposes the stored token', async t => {
  await new Promise((resolve, reject) => subject.server.listen(0, '127.0.0.1', resolve).once('error', reject));
  t.after(() => { if (subject.server.listening) subject.server.close(); });
  const response = await request(subject.server, '/api/settings', { raw: true });
  const result = { status: response.status, body: JSON.parse(response.body) };
  assert.equal(result.status, 200);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(Object.hasOwn(result.body, 'op1funToken'), false);
  assert.equal(typeof result.body.hasOp1funToken, 'boolean');

  const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
  assert.match(html, /type="password" id="op1token"/);
  assert.doesNotMatch(html, /SETTINGS\.op1funToken/);
});

test('settings writes replace atomically with user-only permissions', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opz-settings-'));
  const file = path.join(dir, 'settings.json');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(file, '{}', { mode: 0o644 });

  subject.saveSettings({ op1funEmail: 'fixture@example.test', op1funToken: 'fixture-token' }, file);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).op1funToken, 'fixture-token');
  assert.deepEqual(fs.readdirSync(dir), ['settings.json']);
});

test('JSON updates fail closed and atomic write failure preserves prior data', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opz-json-'));
  const metaFile = path.join(dir, 'meta.json');
  const settingsFile = path.join(dir, 'settings.json');
  const corruptMeta = '{broken metadata';
  const corruptSettings = '{broken settings';
  fs.writeFileSync(metaFile, corruptMeta);
  fs.writeFileSync(settingsFile, corruptSettings);
  subject.testHooks.metaFile = metaFile;
  subject.testHooks.settingsFile = settingsFile;
  t.after(() => {
    for (const key of ['metaFile', 'settingsFile', 'beforeJsonRename']) delete subject.testHooks[key];
    if (subject.server.listening) subject.server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  await new Promise((resolve, reject) => subject.server.listen(0, '127.0.0.1', resolve).once('error', reject));

  const metaResult = await requestJson(subject.server, '/api/meta', { hash: 'a'.repeat(16), fields: { name: 'Keep me' } });
  assert.equal(metaResult.status, 409);
  assert.equal(metaResult.body.code, 'METADATA_UNREADABLE');
  assert.equal(fs.readFileSync(metaFile, 'utf8'), corruptMeta);
  const settingsResult = await requestJson(subject.server, '/api/settings', { op1funEmail: 'new@example.test' });
  assert.equal(settingsResult.status, 409);
  assert.equal(settingsResult.body.code, 'SETTINGS_UNREADABLE');
  assert.equal(fs.readFileSync(settingsFile, 'utf8'), corruptSettings);

  const prior = { songs: { existing: { name: 'Existing' } } };
  fs.writeFileSync(metaFile, JSON.stringify(prior));
  subject.testHooks.beforeJsonRename = () => { throw new Error('injected write failure'); };
  assert.throws(() => subject.saveMeta({ songs: { replacement: {} } }, metaFile), /injected write failure/);
  assert.deepEqual(JSON.parse(fs.readFileSync(metaFile, 'utf8')), prior);
  assert.deepEqual(fs.readdirSync(dir).sort(), ['meta.json', 'settings.json']);
});

test('bundle containment rejects path escapes and unverified items', t => {
  const { libraryRoot } = tempRoots(t);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'opz-outside-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  const fixture = fs.readFileSync(FIXTURE);
  const writeBundle = (name, evidence = true) => {
    const dir = path.join(libraryRoot, name);
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'song.opz'), fixture);
    if (evidence) fs.writeFileSync(path.join(dir, 'info.json'), JSON.stringify(schemaInfo(fixture)));
    return dir;
  };
  writeBundle('verified');
  writeBundle('legacy', false);
  writeBundle('mismatch');
  const mismatch = JSON.parse(fs.readFileSync(path.join(libraryRoot, 'mismatch', 'info.json')));
  mismatch.project.sha256 = '0'.repeat(64);
  fs.writeFileSync(path.join(libraryRoot, 'mismatch', 'info.json'), JSON.stringify(mismatch));
  fs.writeFileSync(path.join(outside, 'song.opz'), fixture);
  fs.symlinkSync(outside, path.join(libraryRoot, 'escaped'));

  assert.equal(subject.findBundle('verified', false, libraryRoot, null).dir, fs.realpathSync(path.join(libraryRoot, 'verified')));
  for (const id of ['', '.', '..', '/tmp/x', '../x', 'x/y', 'x\\y']) {
    assert.throws(() => subject.validateBundleId(id), error => error.code === 'INVALID_BUNDLE_ID');
  }
  assert.throws(() => subject.resolveChild(libraryRoot, 'escaped'), error => error.code === 'PATH_OUTSIDE_ROOT');
  assert.throws(() => subject.findBundle('legacy', false, libraryRoot, null), error => error.code === 'BUNDLE_UNVERIFIED');
  assert.throws(() => subject.findBundle('mismatch', false, libraryRoot, null), error => error.code === 'BUNDLE_UNVERIFIED');
  assert.throws(() => subject.findBundle('.failed', false, libraryRoot, null), error => error.code === 'INVALID_BUNDLE_ID');
});

test('source substitution stops the pinned transaction without resolving a fallback', async t => {
  const fixture = fs.readFileSync(FIXTURE);
  const roots = tempRoots(t, fixture);
  let resolverCalls = 0;
  const originalRoot = roots.sourceRoot + '-captured';

  await assert.rejects(subject.withMutation('source substitution', async () => {
    resolverCalls++;
    const captured = subject.captureSource(1, roots.source);
    fs.renameSync(roots.sourceRoot, originalRoot);
    fs.mkdirSync(path.join(roots.sourceRoot, 'projects'), { recursive: true });
    fs.writeFileSync(path.join(roots.sourceRoot, 'projects', 'project01.opz'), fixture);
    subject.assertCapturedSource(captured);
  }), error => error.code === 'SOURCE_REPLACED');

  assert.equal(resolverCalls, 1);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(originalRoot, 'projects', 'project01.opz'))).digest('hex'),
    crypto.createHash('sha256').update(fixture).digest('hex'));
  assert.equal(await subject.withMutation('after source failure', async () => 'released'), 'released');
});

test('failed draft retains sanitized evidence and never becomes verified', t => {
  const fixture = fs.readFileSync(FIXTURE);
  const corrupt = tempRoots(t, fixture);
  const sourceHash = crypto.createHash('sha256').update(fixture).digest('hex');
  const captured = subject.captureSource(1, corrupt.source);

  assert.throws(() => subject.archiveCapturedProject(captured, {
    libraryRoot: corrupt.libraryRoot,
    name: 'Corrupt stored bytes',
    deep: false,
    beforeVerify(storedPath) {
      const stored = fs.readFileSync(storedPath);
      stored[0] ^= 0xff;
      fs.writeFileSync(storedPath, stored);
    },
  }), error => error.code === 'ARCHIVE_BYTES_MISMATCH');

  assert.deepEqual(visibleBundles(corrupt.libraryRoot), []);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(corrupt.sourceRoot, 'projects', 'project01.opz'))).digest('hex'), sourceHash);
  const drafts = subject.scanDrafts(corrupt.libraryRoot);
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].verified, false);
  assert.equal(drafts[0].errorCode, 'ARCHIVE_BYTES_MISMATCH');
  assert.equal(drafts[0].source.label, 'temporary fixture');
  assert.ok(!JSON.stringify(drafts).includes(corrupt.sourceRoot));
  assert.deepEqual(subject.scanLibrary({ songs: {} }, corrupt.libraryRoot, null), []);

  const invalid = tempRoots(t, Buffer.from([0, 255, 128]));
  assert.throws(() => subject.archiveCapturedProject(subject.captureSource(1, invalid.source), {
    libraryRoot: invalid.libraryRoot,
    name: 'Parser rejection',
    deep: false,
  }), error => error.code === 'ARCHIVE_PARSE_FAILED');
  assert.equal(subject.scanDrafts(invalid.libraryRoot)[0].errorCode, 'ARCHIVE_PARSE_FAILED');
  assert.deepEqual(visibleBundles(invalid.libraryRoot), []);
});

test('incomplete published bundle remains visible as an unverified diagnostic', t => {
  const { libraryRoot } = tempRoots(t);
  const bundle = path.join(libraryRoot, 'corrupt-published');
  fs.mkdirSync(bundle);
  fs.writeFileSync(path.join(bundle, 'song.opz'), Buffer.from('not a project'));

  const items = subject.scanLibrary({ songs: {} }, libraryRoot, null);
  assert.equal(items.length, 1);
  assert.deepEqual(items[0], {
    file: 'corrupt-published', bundle: true, auto: false, modified: fs.statSync(bundle).mtime,
    verified: false, complete: false, restoreEligible: false, manualFreeEligible: false,
    diagnostic: 'partial', errorCode: 'ARCHIVE_PARTIAL', meta: null,
  });
  assert.ok(!JSON.stringify(items).includes(libraryRoot));
});

test('corrupt legacy archive remains visible as an unverified diagnostic', t => {
  const { libraryRoot } = tempRoots(t);
  const legacy = path.join(libraryRoot, 'broken.opz');
  fs.writeFileSync(legacy, Buffer.from('not a project'));

  assert.deepEqual(subject.scanLibrary({ songs: {} }, libraryRoot, null), [{
    file: 'broken.opz', bundle: false, auto: false, modified: fs.statSync(legacy).mtime,
    verified: false, complete: false, restoreEligible: false, manualFreeEligible: false,
    diagnostic: 'corrupt', errorCode: 'ARCHIVE_PARSE_FAILED',
  }]);
});

test('attribute values and archive slots reject stored markup injection', t => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
  const attrSource = /function attr\(s\) \{[^\n]+\}/.exec(html)[0];
  const attr = Function(`${attrSource}; return attr;`)();
  const hostile = '" onfocus="alert(1)" autofocus="\'><img src=x onerror=alert(2)>';
  const markup = '<input value="' + attr(hostile) + '">';
  assert.equal((markup.match(/<input/g) || []).length, 1);
  assert.equal((markup.match(/ value=/g) || []).length, 1);
  assert.doesNotMatch(attr(hostile), /[<>"']/);
  assert.match(html, /data-preview="' \+ attr\(pk\.preview\)/);
  assert.doesNotMatch(html, /onclick="previewPack\(this,\\'/);

  const { libraryRoot } = tempRoots(t);
  const bundle = path.join(libraryRoot, 'hostile-slot');
  const fixture = fs.readFileSync(FIXTURE);
  fs.mkdirSync(bundle);
  fs.writeFileSync(path.join(bundle, 'song.opz'), fixture);
  fs.writeFileSync(path.join(bundle, 'info.json'), JSON.stringify({ fromSlot: hostile }));
  const diagnostic = subject.scanLibrary({ songs: {} }, libraryRoot, null)[0];
  assert.equal(diagnostic.fromSlot, undefined);
  assert.equal(diagnostic.errorCode, 'ARCHIVE_LEGACY');
});

test('mutation conflict rejects before resolver work and releases after success or failure', async () => {
  let release;
  let started;
  const barrier = new Promise(resolve => { release = resolve; });
  const entered = new Promise(resolve => { started = resolve; });
  let resolverCalls = 0;
  let captureCalls = 0;

  const first = subject.withMutation('held mutation', async () => {
    resolverCalls++;
    captureCalls++;
    started();
    await barrier;
    return 'done';
  });
  await entered;
  await assert.rejects(subject.withMutation('competing mutation', async () => {
    resolverCalls++;
    captureCalls++;
  }), error => error.code === 'MUTATION_CONFLICT');
  assert.equal(resolverCalls, 1);
  assert.equal(captureCalls, 1);
  release();
  assert.equal(await first, 'done');

  await assert.rejects(subject.withMutation('failing mutation', async () => { throw new Error('expected'); }), /expected/);
  assert.equal(await subject.withMutation('after failure', async () => 'released'), 'released');
});

test('project restore requires an explicit fresh target and retains a verified recovery archive', async t => {
  const roots = tempRoots(t);
  useFixtureSource(t, roots.sourceRoot);
  const original = fs.readFileSync(path.join(roots.source.path, 'project01.opz'));
  const incoming = Buffer.from(original);
  incoming[0x10] ^= 1;
  // The fixture header remains a valid project after this harmless pattern-byte change.
  const archive = writeSchemaBundle(roots.libraryRoot, 'restore-project', schemaInfo(incoming, {
    metadata: { name: 'Restored song', tags: '', notes: '', kit: {} },
  }), incoming);
  assert.equal(subject.classifyArchive(archive).verified, true);
  subject.testHooks.sourceResolver = () => roots.source;
  subject.testHooks.libraryRoot = roots.libraryRoot;
  subject.testHooks.autoRoot = path.join(roots.libraryRoot, 'auto-backups');
  fs.mkdirSync(subject.testHooks.autoRoot, { recursive: true });
  t.after(() => {
    for (const key of Object.keys(subject.testHooks)) delete subject.testHooks[key];
    if (subject.server.listening) subject.server.close();
  });
  await new Promise((resolve, reject) => subject.server.listen(0, '127.0.0.1', resolve).once('error', reject));
  const state = await requestJson(subject.server, '/api/state');
  const shelf = state.body.archiveShelf.verified.find(item => item.id === 'restore-project');
  const target = state.body.slots.find(item => item.slot === 1);
  assert.equal(shelf.restoreEligible, true);
  assert.match(shelf.archiveRevision, /^[a-f0-9]{64}$/);
  assert.match(target.sourceToken, /^[a-f0-9]{64}$/);
  const missing = await requestJson(subject.server, '/api/restore', { file: 'restore-project', auto: false });
  assert.equal(missing.status, 400);
  const result = await requestJson(subject.server, '/api/restore', {
    file: 'restore-project', auto: false, archiveRevision: shelf.archiveRevision, slot: 1,
    targetFingerprint: { sha256: target.sha256, bytes: target.bytes }, sourceToken: target.sourceToken,
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.recovery.auto, true);
  assert.equal(result.body.recovery.state, 'retained');
  assert.ok(fs.readFileSync(path.join(roots.source.path, 'project01.opz')).equals(incoming));
  assert.ok(subject.classifyArchive(path.join(subject.testHooks.autoRoot, result.body.recovery.id)).verified);
});

test('project restore writes a reviewed empty slot without inventing a recovery archive', async t => {
  const roots = tempRoots(t);
  useFixtureSource(t, roots.sourceRoot);
  const incoming = fs.readFileSync(path.join(roots.source.path, 'project01.opz'));
  writeSchemaBundle(roots.libraryRoot, 'restore-empty', schemaInfo(incoming), incoming);
  subject.testHooks.sourceResolver = () => roots.source;
  subject.testHooks.libraryRoot = roots.libraryRoot;
  subject.testHooks.autoRoot = path.join(roots.libraryRoot, 'auto-backups');
  fs.mkdirSync(subject.testHooks.autoRoot, { recursive: true });
  t.after(() => { for (const key of Object.keys(subject.testHooks)) delete subject.testHooks[key]; if (subject.server.listening) subject.server.close(); });
  await new Promise((resolve, reject) => subject.server.listen(0, '127.0.0.1', resolve).once('error', reject));
  const state = await requestJson(subject.server, '/api/state');
  const target = state.body.slots.find(item => item.slot === 2);
  const shelf = state.body.archiveShelf.verified.find(item => item.id === 'restore-empty');
  assert.equal(target.empty, true);
  assert.match(target.sourceToken, /^[a-f0-9]{64}$/);
  fs.writeFileSync(path.join(roots.source.path, 'project02.opz'), incoming);
  const stale = await requestJson(subject.server, '/api/restore', {
    file: 'restore-empty', auto: false, archiveRevision: shelf.archiveRevision, slot: 2,
    targetFingerprint: null, sourceToken: target.sourceToken,
  });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.code, 'RESTORE_TARGET_STALE');
  fs.unlinkSync(path.join(roots.source.path, 'project02.opz'));
  const result = await requestJson(subject.server, '/api/restore', {
    file: 'restore-empty', auto: false, archiveRevision: shelf.archiveRevision, slot: 2,
    targetFingerprint: null, sourceToken: target.sourceToken,
  });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.recovery, null);
  assert.match(result.body.guidance, /no overwrite backup was needed/);
  assert.ok(fs.readFileSync(path.join(roots.source.path, 'project02.opz')).equals(incoming));
  assert.deepEqual(fs.readdirSync(subject.testHooks.autoRoot), []);
});

test('verified project writes remove FAT AppleDouble sidecars', t => {
  const roots = tempRoots(t);
  const captured = subject.captureSource(1, roots.source);
  const renameSync = fs.renameSync;
  fs.renameSync = function (from, to) {
    const result = renameSync.call(this, from, to);
    fs.writeFileSync(path.join(path.dirname(to), `._${path.basename(to)}`), 'simulated AppleDouble');
    return result;
  };
  try { subject.writeVerifiedProject(captured, captured.buffer); }
  finally { fs.renameSync = renameSync; }
  assert.equal(fs.existsSync(path.join(roots.source.path, '._project01.opz')), false);
});

test('project restore failure returns a sanitized retained recovery receipt', async t => {
  const roots = tempRoots(t);
  useFixtureSource(t, roots.sourceRoot);
  const original = fs.readFileSync(path.join(roots.source.path, 'project01.opz'));
  const archive = writeSchemaBundle(roots.libraryRoot, 'restore-failure', schemaInfo(original), original);
  subject.testHooks.sourceResolver = () => roots.source;
  subject.testHooks.libraryRoot = roots.libraryRoot;
  subject.testHooks.autoRoot = path.join(roots.libraryRoot, 'auto-backups');
  fs.mkdirSync(subject.testHooks.autoRoot, { recursive: true });
  t.after(() => {
    for (const key of Object.keys(subject.testHooks)) delete subject.testHooks[key];
    if (subject.server.listening) subject.server.close();
  });
  await new Promise((resolve, reject) => subject.server.listen(0, '127.0.0.1', resolve).once('error', reject));
  const state = await requestJson(subject.server, '/api/state');
  const shelf = state.body.archiveShelf.verified.find(item => item.id === 'restore-failure');
  const target = state.body.slots.find(item => item.slot === 1);
  subject.testHooks.afterRestoreRename = () => { fs.renameSync(roots.sourceRoot, roots.sourceRoot + '-lost'); };
  const result = await requestJson(subject.server, '/api/restore', {
    file: 'restore-failure', auto: false, archiveRevision: shelf.archiveRevision, slot: 1,
    targetFingerprint: { sha256: target.sha256, bytes: target.bytes }, sourceToken: target.sourceToken,
  });
  assert.equal(result.status, 500);
  assert.equal(result.body.recovery.auto, true);
  assert.equal(result.body.recovery.state, 'recovery_required');
  assert.doesNotMatch(JSON.stringify(result.body), new RegExp(roots.sourceRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('project restore metadata failure stays non-success with verified output retained', async t => {
  const roots = tempRoots(t);
  useFixtureSource(t, roots.sourceRoot);
  const original = fs.readFileSync(path.join(roots.source.path, 'project01.opz'));
  const archive = writeSchemaBundle(roots.libraryRoot, 'restore-metadata', schemaInfo(original), original);
  const metaFile = path.join(path.dirname(roots.libraryRoot), 'meta.json');
  fs.writeFileSync(metaFile, JSON.stringify({ songs: {} }));
  subject.testHooks.sourceResolver = () => roots.source;
  subject.testHooks.libraryRoot = roots.libraryRoot;
  subject.testHooks.autoRoot = path.join(roots.libraryRoot, 'auto-backups');
  subject.testHooks.metaFile = metaFile;
  subject.testHooks.beforeJsonRename = () => { throw new Error('metadata fail'); };
  fs.mkdirSync(subject.testHooks.autoRoot, { recursive: true });
  t.after(() => {
    for (const key of Object.keys(subject.testHooks)) delete subject.testHooks[key];
    if (subject.server.listening) subject.server.close();
  });
  await new Promise((resolve, reject) => subject.server.listen(0, '127.0.0.1', resolve).once('error', reject));
  const state = await requestJson(subject.server, '/api/state');
  const shelf = state.body.archiveShelf.verified.find(item => item.id === 'restore-metadata');
  const target = state.body.slots.find(item => item.slot === 1);
  const result = await requestJson(subject.server, '/api/restore', {
    file: 'restore-metadata', auto: false, archiveRevision: shelf.archiveRevision, slot: 1,
    targetFingerprint: { sha256: target.sha256, bytes: target.bytes }, sourceToken: target.sourceToken,
  });
  assert.equal(result.status, 500);
  assert.equal(result.body.code, 'RESTORE_METADATA_FAILED');
  assert.equal(result.body.recovery.state, 'retained');
  assert.ok(fs.readFileSync(path.join(roots.source.path, 'project01.opz')).equals(original));
});

test('project restore rollback reports verified original bytes after post-write failure', async t => {
  const roots = tempRoots(t);
  useFixtureSource(t, roots.sourceRoot);
  const original = fs.readFileSync(path.join(roots.source.path, 'project01.opz'));
  const archive = writeSchemaBundle(roots.libraryRoot, 'restore-rollback', schemaInfo(original), original);
  subject.testHooks.sourceResolver = () => roots.source;
  subject.testHooks.libraryRoot = roots.libraryRoot;
  subject.testHooks.autoRoot = path.join(roots.libraryRoot, 'auto-backups');
  subject.testHooks.afterRestoreRename = () => { throw new Error('readback fail'); };
  fs.mkdirSync(subject.testHooks.autoRoot, { recursive: true });
  t.after(() => {
    for (const key of Object.keys(subject.testHooks)) delete subject.testHooks[key];
    if (subject.server.listening) subject.server.close();
  });
  await new Promise((resolve, reject) => subject.server.listen(0, '127.0.0.1', resolve).once('error', reject));
  const state = await requestJson(subject.server, '/api/state');
  const shelf = state.body.archiveShelf.verified.find(item => item.id === 'restore-rollback');
  const target = state.body.slots.find(item => item.slot === 1);
  const result = await requestJson(subject.server, '/api/restore', {
    file: 'restore-rollback', auto: false, archiveRevision: shelf.archiveRevision, slot: 1,
    targetFingerprint: { sha256: target.sha256, bytes: target.bytes }, sourceToken: target.sourceToken,
  });
  assert.equal(result.status, 500);
  assert.equal(result.body.recovery.state, 'rolled_back');
  assert.ok(fs.readFileSync(path.join(roots.source.path, 'project01.opz')).equals(original));
});

test('guard before capture rejects an HTTP competitor with zero source work', async t => {
  const roots = tempRoots(t);
  useFixtureSource(t, roots.sourceRoot);
  let release;
  let entered;
  const barrier = new Promise(resolve => { release = resolve; });
  const accepted = new Promise(resolve => { entered = resolve; });
  let resolverCalls = 0;
  let captureCalls = 0;
  subject.testHooks.sourceResolver = () => { resolverCalls++; return roots.source; };
  subject.testHooks.captureSource = (slot, source) => { captureCalls++; return subject.captureSource(slot, source); };
  subject.testHooks.libraryRoot = roots.libraryRoot;
  subject.testHooks.beforeBackupCapture = async () => { entered(); await barrier; };
  t.after(() => { for (const key of Object.keys(subject.testHooks)) delete subject.testHooks[key]; });

  await new Promise((resolve, reject) => subject.server.listen(0, '127.0.0.1', resolve).once('error', reject));
  t.after(() => { if (subject.server.listening) subject.server.close(); });
  const first = requestJson(subject.server, '/api/backup', { slot: 1, name: '', deep: false });
  await accepted;

  const conflict = await requestJson(subject.server, '/api/backup', { slot: 1, name: '', deep: false });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.code, 'MUTATION_CONFLICT');
  assert.equal(conflict.body.active.operation, 'archive slot 1');
  assert.equal(resolverCalls, 0);
  assert.equal(captureCalls, 0);

  const state = await requestJson(subject.server, '/api/state');
  assert.equal(state.status, 200);
  assert.equal(state.body.mutation.operation, 'archive slot 1');
  release();
  assert.equal((await first).status, 200);
  assert.equal(resolverCalls, 1);
  assert.equal(captureCalls, 1);
});

test('published archive stays successful when its name annotation cannot be saved', async t => {
  const roots = tempRoots(t);
  const metaFile = path.join(path.dirname(roots.libraryRoot), 'meta.json');
  const priorMeta = { songs: {} };
  fs.writeFileSync(metaFile, JSON.stringify(priorMeta));
  subject.testHooks.sourceResolver = () => roots.source;
  subject.testHooks.libraryRoot = roots.libraryRoot;
  subject.testHooks.metaFile = metaFile;
  subject.testHooks.beforeJsonRename = () => { throw new Error('injected metadata failure'); };
  t.after(() => {
    for (const key of Object.keys(subject.testHooks)) delete subject.testHooks[key];
    if (subject.server.listening) subject.server.close();
  });
  await new Promise((resolve, reject) => subject.server.listen(0, '127.0.0.1', resolve).once('error', reject));

  const response = await requestJson(subject.server, '/api/backup', { slot: 1, name: 'Published once', deep: false });
  assert.equal(response.status, 200);
  assert.equal(response.body.verified, true);
  assert.equal(response.body.metadataSaved, false);
  assert.match(response.body.guidance, /name annotation was not saved/);
  assert.deepEqual(visibleBundles(roots.libraryRoot), [response.body.file]);
  assert.deepEqual(JSON.parse(fs.readFileSync(metaFile, 'utf8')), priorMeta);
});

test('swap publishes two recoveries before it changes either slot', async t => {
  const roots = tempRoots(t);
  useFixtureSource(t, roots.sourceRoot);
  const a = fs.readFileSync(path.join(roots.source.path, 'project01.opz'));
  const b = Buffer.from(a); b[0x10] ^= 1;
  fs.writeFileSync(path.join(roots.source.path, 'project02.opz'), b);
  subject.testHooks.sourceResolver = () => roots.source;
  subject.testHooks.libraryRoot = roots.libraryRoot;
  subject.testHooks.autoRoot = path.join(roots.libraryRoot, 'auto-backups');
  fs.mkdirSync(subject.testHooks.autoRoot, { recursive: true });
  t.after(() => { for (const key of Object.keys(subject.testHooks)) delete subject.testHooks[key]; if (subject.server.listening) subject.server.close(); });
  await new Promise((resolve, reject) => subject.server.listen(0, '127.0.0.1', resolve).once('error', reject));
  const state = await requestJson(subject.server, '/api/state');
  const one = state.body.slots.find(slot => slot.slot === 1);
  const two = state.body.slots.find(slot => slot.slot === 2);
  const result = await requestJson(subject.server, '/api/swap', {
    a: 1, b: 2,
    expectedA: { sha256: one.sha256, bytes: one.bytes },
    expectedB: { sha256: two.sha256, bytes: two.bytes }, sourceToken: one.sourceToken,
  });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.recovery.length, 2);
  assert.ok(fs.readFileSync(path.join(roots.source.path, 'project01.opz')).equals(b));
  assert.ok(fs.readFileSync(path.join(roots.source.path, 'project02.opz')).equals(a));
  for (const receipt of result.body.recovery) assert.equal(subject.classifyArchive(path.join(subject.testHooks.autoRoot, receipt.id)).verified, true);
});

test('later-phase routes unavailable before filesystem mutation', async t => {
  const unavailable = [
    '/api/op1fun/download',
  ];
  assert.deepEqual(subject.mutationRouteInventory, { enabled: ['/api/backup', '/api/restore', '/api/swap', '/api/clear-slot', '/api/instruments/restore-grid', '/api/instruments/move', '/api/instruments/remove', '/api/instruments/import', '/api/instruments/snapshot'], unavailable: ['/api/op1fun/download'] });
  await new Promise((resolve, reject) => subject.server.listen(0, '127.0.0.1', resolve).once('error', reject));
  t.after(() => { if (subject.server.listening) subject.server.close(); });
  for (const route of unavailable) {
    const result = await requestJson(subject.server, route, {});
    assert.equal(result.status, 409, route);
    assert.equal(result.body.code, 'PHASE_UNAVAILABLE', route);
    assert.match(result.body.guidance, /Phase [236]/, route);
  }

  const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
  assert.match(html, /onclick="restoreProject\(/);
  assert.match(html, /onclick="doSwap\(\)"/);
  assert.match(html, /onclick="removePack\(\)"/);
  assert.match(html, /onclick="importPack\(\)"/);
  assert.match(html, /onclick="snapshotInstruments\(\)"/);
  assert.match(html, /restore whole instrument grid/);
  assert.match(html, /\/api\/instruments\/restore-grid/);
});

test('automatic clear stays pending until same-device reconnect confirms the empty slot', async t => {
  const roots = tempRoots(t);
  const source = { ...roots.source, device: true, label: 'fixture OP-Z' };
  fs.mkdirSync(path.join(roots.sourceRoot, 'samplepacks', '1-kick', '01'), { recursive: true });
  fs.writeFileSync(path.join(roots.sourceRoot, 'samplepacks', '1-kick', '01', 'fixture.engine'), 'fixture');
  const acceptanceFile = path.join(path.dirname(roots.libraryRoot), 'clear-acceptance.json');
  let sourceAvailable = true;
  subject.testHooks.sourceResolver = () => sourceAvailable ? source : null;
  subject.testHooks.libraryRoot = roots.libraryRoot;
  subject.testHooks.metaFile = path.join(path.dirname(roots.libraryRoot), 'clear-meta.json');
  subject.testHooks.autoRoot = path.join(roots.libraryRoot, 'auto-backups');
  subject.testHooks.clearAcceptanceFile = acceptanceFile;
  subject.testHooks.clearPendingFile = path.join(path.dirname(roots.libraryRoot), 'clear-pending.json');
  fs.mkdirSync(subject.testHooks.autoRoot, { recursive: true });
  t.after(() => { for (const key of Object.keys(subject.testHooks)) delete subject.testHooks[key]; if (subject.server.listening) subject.server.close(); });
  await new Promise((resolve, reject) => subject.server.listen(0, '127.0.0.1', resolve).once('error', reject));
  const archive = await requestJson(subject.server, '/api/backup', { slot: 1, name: 'clear fixture', deep: true });
  assert.equal(archive.status, 200, JSON.stringify(archive.body));
  const state = await requestJson(subject.server, '/api/state');
  assert.equal(state.body.clearEnabled, false);
  const slot = state.body.slots.find(item => item.slot === 1);
  const blocked = await requestJson(subject.server, '/api/clear-slot', {
    file: archive.body.file, auto: false, archiveRevision: state.body.archiveShelf.verified.find(item => item.id === archive.body.file).archiveRevision,
    slot: 1, targetFingerprint: { sha256: slot.sha256, bytes: slot.bytes }, sourceToken: slot.sourceToken,
  });
  assert.equal(blocked.status, 409); assert.equal(blocked.body.code, 'CLEAR_UNAVAILABLE');
  assert.equal(fs.existsSync(path.join(roots.source.path, 'project01.opz')), true);
  fs.writeFileSync(acceptanceFile, JSON.stringify({ version: 1, method: 'delete-project-file', fixture: true,
    device: { label: source.label, projectSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(roots.source.path, 'project01.opz'))).digest('hex') },
    outcomes: { eject: true, reconnect: true, rejection: true, playback: true, recovery: true, emptySlot: true }, recorded: '2026-08-25T12:00:00.000Z' }));
  const pending = await requestJson(subject.server, '/api/clear-slot', {
    file: archive.body.file, auto: false, archiveRevision: state.body.archiveShelf.verified.find(item => item.id === archive.body.file).archiveRevision,
    slot: 1, targetFingerprint: { sha256: slot.sha256, bytes: slot.bytes }, sourceToken: slot.sourceToken,
  });
  // complete deep archive is required before the delete boundary
  assert.equal(archive.body.complete, true, JSON.stringify({ result: archive.body, info: JSON.parse(fs.readFileSync(path.join(roots.libraryRoot, archive.body.file, 'info.json'), 'utf8')) }));
  assert.equal(pending.status, 202);
  assert.equal(pending.body.pending, true);
  assert.equal(pending.body.cleared, false);
  assert.equal(fs.existsSync(subject.testHooks.clearPendingFile), true);
  assert.equal(fs.existsSync(path.join(roots.source.path, 'project01.opz')), false);
  assert.ok(pending.body.recovery && pending.body.recovery.id);
  assert.equal(subject.classifyArchive(path.join(subject.testHooks.autoRoot, pending.body.recovery.id)).verified, true);
  const sameMount = await requestJson(subject.server, '/api/state');
  assert.equal(sameMount.body.clearStatus.state, 'awaiting_disconnect');
  sourceAvailable = false;
  const absent = await requestJson(subject.server, '/api/state');
  assert.equal(absent.body.clearStatus.state, 'awaiting_reconnect');
  sourceAvailable = true;
  const reconnected = await requestJson(subject.server, '/api/state');
  assert.equal(reconnected.body.clearStatus.state, 'confirmed');
  assert.equal(reconnected.body.clearStatus.cleared, true);
  assert.equal(reconnected.body.slots.find(item => item.slot === 1).empty, true);
  assert.equal(fs.existsSync(subject.testHooks.clearPendingFile), false);
});

test('clear acceptance reader gates the proven method, not one sacrificial project', t => {
  const source = { device: true, label: 'fixture OP-Z' };
  assert.equal(subject.clearAcceptanceValid(null, source), false);
  const base = { version: 1, method: 'delete-project-file', fixture: true,
    device: { label: source.label, projectSha256: 'a'.repeat(64) },
    outcomes: { eject: true, reconnect: true, rejection: true, playback: true, recovery: true, emptySlot: true }, recorded: '2026-08-25T12:00:00.000Z' };
  assert.equal(subject.clearAcceptanceValid({ ...base, method: 'other' }, source), false);
  assert.equal(subject.clearAcceptanceValid(base, { ...source, device: false }), false);
  assert.equal(subject.clearAcceptanceValid(base, source), true);
});

test('automatic clear sacrificial-device UAT', {
  skip: !process.env.OPZ_HARDWARE_UAT || !process.env.OPZ_ROOT
    || !fs.existsSync(path.join(process.env.OPZ_ROOT, 'projects'))
}, () => {
  const root = fs.realpathSync(process.env.OPZ_ROOT);
  assert.match(root, /^\/Volumes\//, 'hardware UAT requires a mounted volume');
  const source = { device: true, label: path.basename(root) };
  const acceptance = subject.loadClearAcceptance();
  assert.equal(subject.clearAcceptanceValid(acceptance, source), true);
  const acceptedProject = fs.readdirSync(path.join(root, 'projects')).some(name => {
    if (!/^project\d\d\.opz$/.test(name)) return false;
    const bytes = fs.readFileSync(path.join(root, 'projects', name));
    try { parseProject(bytes); } catch { return false; }
    return crypto.createHash('sha256').update(bytes).digest('hex') === acceptance.device.projectSha256;
  });
  assert.equal(acceptedProject, true, 'the sacrificial project must remain recovered on the mounted OP-Z');
  assert.deepEqual(fs.readdirSync(path.join(root, 'rejected')).sort(), []);
});

test('whole-grid restore replaces stale files and retains a verified recovery', async t => {
  const roots = tempRoots(t);
  useFixtureSource(t, roots.sourceRoot);
  const live = path.join(roots.sourceRoot, 'samplepacks', '1-kick', '01');
  fs.mkdirSync(live, { recursive: true });
  fs.writeFileSync(path.join(live, 'kick.aif'), 'archived');
  subject.testHooks.sourceResolver = () => roots.source;
  subject.testHooks.libraryRoot = roots.libraryRoot;
  subject.testHooks.autoRoot = path.join(roots.libraryRoot, 'auto-backups');
  fs.mkdirSync(subject.testHooks.autoRoot, { recursive: true });
  t.after(() => { for (const key of Object.keys(subject.testHooks)) delete subject.testHooks[key]; if (subject.server.listening) subject.server.close(); });
  await new Promise((resolve, reject) => subject.server.listen(0, '127.0.0.1', resolve).once('error', reject));
  const archived = await requestJson(subject.server, '/api/backup', { slot: 1, name: 'Grid archive', deep: true });
  assert.equal(archived.status, 200, JSON.stringify(archived.body));
  const state = await requestJson(subject.server, '/api/state');
  const slot = state.body.slots.find(item => item.sourceToken);
  const shelfItem = state.body.archiveShelf.verified.find(item => item.id === archived.body.file);
  assert.ok(shelfItem && shelfItem.archiveRevision);
  fs.writeFileSync(path.join(live, 'stale.engine'), 'remove me');
  const result = await requestJson(subject.server, '/api/instruments/restore-grid', {
    file: archived.body.file, auto: false, archiveRevision: shelfItem.archiveRevision,
    sourceToken: slot.sourceToken,
  });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.verified, true);
  assert.equal(subject.classifyArchive(path.join(subject.testHooks.autoRoot, result.body.recovery.id)).verified, true);
  assert.equal(fs.existsSync(path.join(live, 'stale.engine')), false);
  assert.equal(fs.readFileSync(path.join(live, 'kick.aif'), 'utf8'), 'archived');
  assert.match(result.body.guidance, /fixture/);
});

test('whole-grid restore does not require space for a second grid on the source', async t => {
  const roots = tempRoots(t);
  useFixtureSource(t, roots.sourceRoot);
  const live = path.join(roots.sourceRoot, 'samplepacks', '1-kick', '01');
  fs.mkdirSync(live, { recursive: true });
  fs.writeFileSync(path.join(live, 'kick.aif'), 'archived');
  subject.testHooks.sourceResolver = () => roots.source;
  subject.testHooks.libraryRoot = roots.libraryRoot;
  subject.testHooks.autoRoot = path.join(roots.libraryRoot, 'auto-backups');
  fs.mkdirSync(subject.testHooks.autoRoot, { recursive: true });
  t.after(() => { for (const key of Object.keys(subject.testHooks)) delete subject.testHooks[key]; if (subject.server.listening) subject.server.close(); });
  await new Promise((resolve, reject) => subject.server.listen(0, '127.0.0.1', resolve).once('error', reject));
  const archived = await requestJson(subject.server, '/api/backup', { slot: 1, name: 'Constrained grid archive', deep: true });
  assert.equal(archived.status, 200, JSON.stringify(archived.body));
  const state = await requestJson(subject.server, '/api/state');
  const slot = state.body.slots.find(item => item.sourceToken);
  const shelfItem = state.body.archiveShelf.verified.find(item => item.id === archived.body.file);
  fs.writeFileSync(path.join(live, 'stale.engine'), 'remove me');

  const writeFileSync = fs.writeFileSync;
  fs.writeFileSync = function (file, ...args) {
    const relative = path.relative(roots.sourceRoot, path.resolve(file));
    if (relative && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative)
        && !relative.startsWith('samplepacks' + path.sep)) {
      throw Object.assign(new Error('simulated full source'), { code: 'ENOSPC' });
    }
    const result = writeFileSync.call(this, file, ...args);
    if (relative.startsWith('samplepacks' + path.sep) && !path.basename(file).startsWith('._')) {
      writeFileSync.call(this, path.join(path.dirname(file), `._${path.basename(file)}`), 'simulated AppleDouble');
    }
    return result;
  };
  let result;
  try {
    result = await requestJson(subject.server, '/api/instruments/restore-grid', {
      file: archived.body.file, auto: false, archiveRevision: shelfItem.archiveRevision,
      sourceToken: slot.sourceToken,
    });
  } finally { fs.writeFileSync = writeFileSync; }

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(fs.existsSync(path.join(live, 'stale.engine')), false);
  assert.equal(fs.existsSync(path.join(live, '._kick.aif')), false);
  assert.equal(fs.readFileSync(path.join(live, 'kick.aif'), 'utf8'), 'archived');
  assert.equal(subject.classifyArchive(path.join(subject.testHooks.autoRoot, result.body.recovery.id)).verified, true);
});

test('instrument move and snapshot retain a verified complete grid recovery', async t => {
  const roots = tempRoots(t);
  useFixtureSource(t, roots.sourceRoot);
  const from = path.join(roots.sourceRoot, 'samplepacks', '1-kick', '01');
  const to = path.join(roots.sourceRoot, 'samplepacks', '1-kick', '02');
  fs.mkdirSync(from, { recursive: true }); fs.writeFileSync(path.join(from, 'kit.engine'), 'engine');
  subject.testHooks.sourceResolver = () => roots.source;
  subject.testHooks.libraryRoot = roots.libraryRoot;
  subject.testHooks.autoRoot = path.join(roots.libraryRoot, 'auto-backups');
  fs.mkdirSync(subject.testHooks.autoRoot, { recursive: true });
  t.after(() => { for (const key of Object.keys(subject.testHooks)) delete subject.testHooks[key]; if (subject.server.listening) subject.server.close(); });
  await new Promise((resolve, reject) => subject.server.listen(0, '127.0.0.1', resolve).once('error', reject));
  const result = await requestJson(subject.server, '/api/instruments/move', { type: '1-kick', from: 1, to: 2 });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(fs.existsSync(path.join(to, 'kit.engine')), true);
  assert.equal(fs.existsSync(path.join(from, 'kit.engine')), false);
  assert.equal(subject.classifyArchive(path.join(subject.testHooks.autoRoot, result.body.recovery.id)).verified, true);
  const snapshot = await requestJson(subject.server, '/api/instruments/snapshot', {});
  assert.equal(snapshot.status, 200, JSON.stringify(snapshot.body));
  assert.equal(subject.classifyArchive(path.join(subject.testHooks.autoRoot, snapshot.body.recovery.id)).verified, true);
});

test('state reports sanitized active mutation and separate drafts', async t => {
  const roots = tempRoots(t);
  useFixtureSource(t, roots.sourceRoot);
  let release;
  let started;
  const barrier = new Promise(resolve => { release = resolve; });
  const entered = new Promise(resolve => { started = resolve; });
  const active = subject.withMutation('archive slot 1', async mutation => {
    mutation.source = { device: false, label: 'temporary fixture', slot: 1 };
    started();
    await barrier;
  });
  await entered;

  await new Promise((resolve, reject) => subject.server.listen(0, '127.0.0.1', resolve).once('error', reject));
  t.after(() => { if (subject.server.listening) subject.server.close(); });
  const result = await requestJson(subject.server, '/api/state');
  assert.equal(result.status, 200);
  assert.equal(result.body.mutation.operation, 'archive slot 1');
  assert.deepEqual(result.body.mutation.source, { device: false, label: 'temporary fixture', slot: 1 });
  assert.ok(Array.isArray(result.body.drafts));
  assert.ok(!JSON.stringify(result.body).includes(process.cwd()));
  assert.ok(!JSON.stringify(result.body).includes('/Volumes/'));
  const conflict = await requestJson(subject.server, '/api/backup', { slot: 1, name: '', deep: false });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.code, 'MUTATION_CONFLICT');

  release();
  await active;
});

test('archive shelf is the only archive renderer and songs show counts only', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
  assert.equal((html.match(/function renderArchives\(/g) || []).length, 1);
  const library = /function renderLibrary\(\) \{([\s\S]*?)\n\}/.exec(html)[1];
  assert.match(library, /verifiedCount/);
  assert.match(library, /diagnosticCount/);
  assert.match(library, /open archive shelf/);
  assert.doesNotMatch(library, /<details|matrixSvg|restore\(/);
});

test('tab semantics provide archive shelf roving focus', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
  assert.match(html, /<nav class="tabs" role="tablist"/);
  assert.match(html, /nav\.tabs \.tab, \.archiveShelf \.btn \{ min-height: 44px; font-weight: 600; \}/);
  for (const [id, controls, label] of [
    ['tab-songs', 'view-songs', 'songs'],
    ['tab-archives', 'view-archives', 'archive shelf'],
    ['tab-inst', 'view-inst', 'instruments'],
  ]) {
    assert.match(html, new RegExp(`id="${id}"[^>]*role="tab"[^>]*aria-controls="${controls}"[^>]*>${label}<`));
  }
  assert.match(html, /ArrowLeft/);
  assert.match(html, /ArrowRight/);
  assert.match(html, /Home/);
  assert.match(html, /End/);
  assert.match(html, /event\.key === 'Enter' \|\| event\.key === ' '/);
});

test('shelf states cover loading error empty and zero one many counts', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
  assert.match(html, /id="view-archives"/);
  assert.match(html, /aria-busy="true"/);
  assert.ok((html.match(/class="skel"/g) || []).length >= 3);
  assert.match(html, /No verified archives yet/);
  assert.match(html, /Open a song, then choose “archive complete song”\./);
  assert.match(html, /No archive diagnostics\./);
  assert.match(html, /Archive Shelf couldn’t be refreshed\. Refresh to try again\. Existing archives remain on this Mac\./);
  assert.match(html, /countLabel\([^,]+, 'verified archive'/);
  assert.match(html, /countLabel\([^,]+, 'archive diagnostic'/);
});

test('archive shelf populated and partial rows expose matrix and four evidence groups', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
  const body = /function renderArchives\(\) \{([\s\S]*?)\n\}\n/.exec(html)[1];
  assert.match(body, /<details/);
  assert.match(body, /<summary/);
  assert.match(body, /matrixSvg\(item/);
  assert.match(body, /project only/);
  assert.match(body, /Project verification/);
  assert.match(body, /Song snapshot/);
  assert.match(body, /Portability/);
  assert.match(body, /Provenance and action/);
  assert.match(body, /sample-pack file evidence/);
  assert.match(body, /Not recorded/);
});

test('archive escaping overflow and reduced motion contracts are explicit', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
  assert.match(html, /Step activity matrix for/);
  assert.match(html, /overflow-wrap: anywhere/);
  assert.match(html, /\.evidenceScroll[^}]*overflow-x: auto/);
  assert.match(html, /@media \(max-width: 900px\)/);
  assert.match(html, /@media \(max-width: 720px\)/);
  assert.match(html, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(html, /html \{ scroll-behavior: auto/);
  const body = /function renderArchives\(\) \{([\s\S]*?)\n\}\n/.exec(html)[1];
  assert.match(body, /const nameMarkup = esc\(songName\)/);
  assert.match(body, /attr\(item\.created/);
  assert.match(body, /esc\(file\.path/);
  assert.match(body, /esc\(file\.sha256/);
  assert.match(html, /--dim: #6e6b64/);
  assert.match(html, /--accent-text: #c93400/);
  assert.match(html, /\.badge\.verified \{ color: var\(--accent-text\); border-color: var\(--accent\)/);
  assert.match(html, /\.manualPrepare \{ background: var\(--accent\)/);
  assert.match(html, /\.manualWarning \{ border-left: 4px solid var\(--ink\)/);
  assert.match(html, /\.archiveIntro h2 \{ font: 600 15px\/1\.3/);
  assert.match(html, /\.archiveName \{ font: 600 15px\/1\.3/);
  assert.match(html, /nav\.tabs \.tab, \.archiveShelf \.btn \{ min-height: 44px; font-weight: 600/);
  assert.match(html, /\.manualFree b \{ font-weight: 600/);
  assert.match(html, /\.archiveShelf summary:focus-visible[^}]+outline-color: var\(--accent-text\)/);
  assert.match(html, /class="archiveError" role="status" aria-live="polite"/);
  assert.match(html, /archiving slot ['"] \+ archiveMatch\[1\]\.padStart\(2, '0'\) \+ '…'/);
  assert.match(html, /Manual freeing stopped\. The archive or mounted source no longer matches/);
  assert.match(html, /Manual freeing is unavailable until the project, whole sample-pack grid, metadata, and snippet status are portable and verified/);
  assert.match(html, /Reconnect the original OP–Z, refresh, and try again/);
  assert.match(html, /Connect the original OP–Z in content mode, then refresh\. The mounted slot must still match this archive/);
});

test('diagnostic actions stay absent from archive shelf diagnostics', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
  const body = /const diagnosticMarkup = ([\s\S]*?);\n\s*root\.innerHTML/.exec(html)[1];
  assert.match(body, /needs attention/);
  assert.doesNotMatch(body, /<button|<select|restore|manual.free|target.slot/i);
});

test('archive success always captures complete grid then opens and focuses shelf', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
  const body = /async function backup\(slot\) \{([\s\S]*?)\n\}\nfunction renderLibrary/.exec(html)[1];
  assert.match(html, />archive complete song<\/button>/);
  assert.match(body, /Device data will not change\./);
  assert.match(body, /complete sample-pack grid/);
  assert.match(body, /api\('\/api\/backup', \{ slot, name, deep: true \}\)/);
  assert.match(body, /verified archive created · open Archive Shelf/);
  assert.match(body, /setTab\('archives'\)/);
  assert.match(body, /dataset\.archiveId === r\.file/);
  assert.match(body, /\.focus\(\)/);
});

test('manual free is device-only, request-local, exact-match, and fail-closed', async t => {
  const roots = tempRoots(t);
  useFixtureSource(t, roots.sourceRoot);
  const source = { ...roots.source, device: true, label: 'fixture OP-Z' };
  const archived = subject.archiveCapturedProject(subject.captureSource(1, source), {
    libraryRoot: roots.libraryRoot,
    name: 'Exact song',
    deep: true,
    metadata: { name: 'Exact song' },
  });
  let fallbackCalls = 0;
  let finalChecks = 0;
  subject.testHooks.libraryRoot = roots.libraryRoot;
  subject.testHooks.autoRoot = null;
  subject.testHooks.deviceRootResolver = () => ({ root: roots.sourceRoot, device: true, label: source.label });
  subject.testHooks.sourceResolver = () => { fallbackCalls++; return roots.source; };
  subject.testHooks.manualAssertCapturedSource = captured => {
    finalChecks++;
    return subject.assertCapturedSource(captured);
  };
  t.after(() => {
    for (const key of Object.keys(subject.testHooks)) delete subject.testHooks[key];
    if (subject.server.listening) subject.server.close();
  });
  await new Promise((resolve, reject) => subject.server.listen(0, '127.0.0.1', resolve).once('error', reject));

  const archiveBefore = fs.readFileSync(path.join(roots.libraryRoot, archived.file, 'song.opz'));
  const sourceBefore = fs.readFileSync(path.join(roots.source.path, 'project01.opz'));
  const exact = await request(subject.server, '/api/manual-free?file=' + encodeURIComponent(archived.file));
  assert.equal(exact.status, 200);
  assert.deepEqual(exact.body, {
    eligible: true,
    relation: 'archived_song_present',
    archive: { id: archived.file, name: 'Exact song', slot: 1, source: 'fixture OP-Z' },
    guidance: 'Archive and mounted slot match. Confirm the exact identity before following the on-device checklist.',
  });
  assert.equal(fallbackCalls, 0);
  assert.equal(finalChecks, 1);
  const state = await request(subject.server, '/api/state');
  assert.equal(state.body.archiveShelf.verified.find(item => item.id === archived.file).manualFreeEligible, true);
  assert.ok(fs.readFileSync(path.join(roots.libraryRoot, archived.file, 'song.opz')).equals(archiveBefore));
  assert.ok(fs.readFileSync(path.join(roots.source.path, 'project01.opz')).equals(sourceBefore));

  const changed = Buffer.from(sourceBefore);
  changed[0] ^= 1;
  fs.writeFileSync(path.join(roots.source.path, 'project01.opz'), changed);
  const mismatch = await request(subject.server, '/api/manual-free?file=' + encodeURIComponent(archived.file));
  assert.equal(mismatch.status, 200);
  assert.equal(mismatch.body.eligible, false);
  assert.equal(mismatch.body.relation, 'unexpected_non_empty_replacement');

  fs.unlinkSync(path.join(roots.source.path, 'project01.opz'));
  const absent = await request(subject.server, '/api/manual-free?file=' + encodeURIComponent(archived.file));
  assert.equal(absent.status, 200);
  assert.equal(absent.body.eligible, false);
  assert.equal(absent.body.relation, 'unclassified');
  assert.doesNotMatch(JSON.stringify(absent.body), /empty|confirmed/i);

  subject.testHooks.deviceRootResolver = () => null;
  const unavailable = await request(subject.server, '/api/manual-free?file=' + encodeURIComponent(archived.file));
  assert.equal(unavailable.status, 200);
  assert.equal(unavailable.body.relation, 'mount_unavailable');
  assert.equal(fallbackCalls, 0);
  assert.doesNotMatch(subject.manualFreeInspection.toString(), /getSource|withMutation|writeFile|rename|unlink|rmSync/);
});

test('manual free rejects hostile and incomplete archive selectors without an action', async t => {
  const roots = tempRoots(t);
  const fixture = fs.readFileSync(FIXTURE);
  writeSchemaBundle(roots.libraryRoot, 'project-only', schemaInfo(fixture, {
    source: { device: true, label: 'fixture OP-Z', slot: 1 },
  }), fixture);
  subject.testHooks.libraryRoot = roots.libraryRoot;
  subject.testHooks.autoRoot = null;
  subject.testHooks.deviceRootResolver = () => ({ root: roots.sourceRoot, device: true, label: 'fixture OP-Z' });
  t.after(() => {
    for (const key of Object.keys(subject.testHooks)) delete subject.testHooks[key];
    if (subject.server.listening) subject.server.close();
  });
  await new Promise((resolve, reject) => subject.server.listen(0, '127.0.0.1', resolve).once('error', reject));

  const hostile = await request(subject.server, '/api/manual-free?file=..%2Fsettings.json');
  assert.equal(hostile.status, 400);
  assert.equal(hostile.body.code, 'INVALID_BUNDLE_ID');
  const incomplete = await request(subject.server, '/api/manual-free?file=project-only');
  assert.equal(incomplete.status, 200);
  assert.equal(incomplete.body.eligible, false);
  assert.equal(incomplete.body.relation, 'archive_incomplete');
});

test('manual checklist is exact-identity gated, local-only, and never clears the device', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
  const shelf = /function renderArchives\(\) \{([\s\S]*?)\n\}\n/.exec(html)[1];
  assert.match(shelf, /prepare manual freeing/);
  assert.match(html, /async function prepareManualFree\(/);
  assert.match(html, /\/api\/manual-free\?file=/);
  assert.match(html, /checking…/);
  assert.match(html, /aria-busy/);
  assert.match(html, /Safely eject/);
  assert.match(html, /Eject the OP-Z disk in Finder, or press play while it is in content\/boot mode/);
  assert.match(html, /hold project and press value key/);
  assert.match(html, /project \+ stop \+ shift/);
  assert.match(html, /Hold track while turning it on/);
  assert.match(html, /slot === 10 \? 0 : slot/);
  assert.match(html, /refresh and verify slot/);
  assert.match(html, /type="checkbox"/);
  assert.doesNotMatch(html.match(/async function prepareManualFree\([\s\S]*?\n\}/)[0], /clear-slot|POST|runMutation/);
  assert.doesNotMatch(html.match(/async function refreshManualFree\([\s\S]*?\n\}/)[0], /clear-slot|POST|runMutation/);
});

test('archive refresh removes a cached manual-free checklist when current eligibility changes', async () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
  const item = {
    id: 'archive-one', schemaVersion: 1, created: '2026-08-25T12:00:00.000Z', complete: true,
    metadata: { name: 'Song <live>', tags: '', notes: '' },
    source: { device: true, label: 'OP-Z', slot: 10 },
    project: { path: 'song.opz', sha256: 'a'.repeat(64), bytes: 1, checked: '2026-08-25T12:00:00.000Z' },
    snippet: { status: 'unlinked' }, patterns: [], chains: [], usedPatterns: [],
    samplepacks: {
      captured: true, files: [],
      summary: {
        fileCount: 0, totalBytes: 0,
        perTrack: Object.fromEntries(['1-kick','2-snare','3-perc','4-fx','5-bass','6-lead','7-arpeggio','8-chord']
          .map(type => [type, { files: 0, bytes: 0 }])),
      },
    },
    manualFreeEligible: true, manualFreeReason: '',
  };
  const refreshed = { archiveShelf: { verified: [{ ...item, manualFreeEligible: false }], diagnostics: [], verifiedCount: 1, diagnosticCount: 0 } };
  const root = { innerHTML: '', setAttribute() {} };
  const manualFreeState = new Map([['archive-one', { eligible: true, stage: 'checklist' }]]);
  const context = vm.createContext({
    STATE: { source: { device: false, label: 'fixture' }, slots: [], archiveShelf: { verified: [item], diagnostics: [], verifiedCount: 1, diagnosticCount: 0 } },
    SETTINGS: {}, shelfLoading: false, shelfError: '', manualFreeState,
    restoreState: new Map(),
    TYPES: ['1-kick','2-snare','3-perc','4-fx','5-bass','6-lead','7-arpeggio','8-chord'],
    TYPE_LABELS: { '1-kick':'kick','2-snare':'snare','3-perc':'perc','4-fx':'fx','5-bass':'bass','6-lead':'lead','7-arpeggio':'arp','8-chord':'chord' },
    document: {
      getElementById: id => id === 'archives' ? root : null,
      createElement: () => ({
        innerHTML: '',
        set textContent(value) { this.innerHTML = String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); },
      }),
    },
    matrixSvg: () => '',
    countLabel: (count, singular) => count + ' ' + singular + (count === 1 ? '' : 's'),
    api: async pathname => pathname === '/api/state' ? refreshed : {},
  });
  vm.runInContext(html.match(/function esc\([\s\S]*?\n(?=function audioUrl)/)[0], context);
  vm.runInContext(html.match(/function renderArchives\([\s\S]*?\n\}\n(?=async function prepareManualFree)/)[0], context);
  vm.runInContext(html.match(/async function load\([\s\S]*?\n\}\n(?=function setTab)/)[0], context);
  context.render = () => context.renderArchives();

  context.renderArchives();
  assert.match(root.innerHTML, /Manual freeing checklist/);
  assert.match(root.innerHTML, /You are about to clear slot 10 on the OP–Z itself/);
  assert.match(root.innerHTML, /I confirmed slot 10 is “Song &lt;live&gt;” on this OP–Z/);
  assert.match(root.innerHTML, /value key 0 to select slot 10/);
  assert.match(root.innerHTML, /project \+ stop \+ shift/);
  for (const [relation, copy] of [
    ['archived_song_present', /Slot 10 still contains “Song &lt;live&gt;”/],
    ['unexpected_non_empty_replacement', /Slot 10 for “Song &lt;live&gt;” changed but is not empty/],
    ['mount_unavailable', /confirmation of slot 10 \(“Song &lt;live&gt;”\)/],
    ['unclassified', /Slot 10 could not be classified for “Song &lt;live&gt;”/],
  ]) {
    manualFreeState.set('archive-one', { eligible: relation === 'archived_song_present', relation, stage: 'result', guidance: 'generic' });
    context.renderArchives();
    assert.match(root.innerHTML, copy);
    assert.doesNotMatch(root.innerHTML, /<live>/);
  }
  await context.load();
  assert.equal(manualFreeState.size, 0);
  assert.doesNotMatch(root.innerHTML, /Manual freeing checklist|project \+ stop \+ shift|data-manual-control/);
});

test('final manual-free verification focuses its result instead of the checklist heading', async () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
  const heading = { dataset: { manualFocus: 'archive-one' }, focused: false, focus() { this.focused = true; } };
  const result = { dataset: { manualResult: 'archive-one' }, focused: false, focus() { this.focused = true; } };
  let selector = '';
  const context = vm.createContext({
    manualFreeState: new Map(),
    api: async () => ({ eligible: true, relation: 'archived_song_present' }),
    renderArchives() {}, toast() {},
    document: { querySelectorAll(value) { selector = value; return value.includes('manualResult') ? [result] : [heading]; } },
  });
  vm.runInContext(html.match(/async function refreshManualFree\([\s\S]*?\n\}/)[0], context);

  await context.refreshManualFree('archive-one');
  assert.equal(selector, '.manualResult[data-manual-result]');
  assert.equal(result.focused, true);
  assert.equal(heading.focused, false);
});

test('mounted API archive UAT', { skip: process.env.OPZ_HARDWARE_UAT !== '1' }, async t => {
  const mountedRoot = '/Volumes/OP-Z';
  const sourcePath = path.join(mountedRoot, 'projects', 'project01.opz');
  assert.ok(fs.existsSync(sourcePath), 'mounted slot 1 must exist');
  const before = fs.readFileSync(sourcePath);
  const beforeSha256 = crypto.createHash('sha256').update(before).digest('hex');
  const previousRoot = process.env.OPZ_ROOT;
  process.env.OPZ_ROOT = mountedRoot;
  t.after(() => {
    if (previousRoot === undefined) delete process.env.OPZ_ROOT;
    else process.env.OPZ_ROOT = previousRoot;
    if (subject.server.listening) subject.server.close();
  });

  await new Promise((resolve, reject) => subject.server.listen(0, '127.0.0.1', resolve).once('error', reject));
  const state = await requestJson(subject.server, '/api/state');
  assert.equal(state.status, 200);
  assert.equal(state.body.source.device, true);

  const archived = await requestJson(subject.server, '/api/backup', {
    slot: 1,
    name: 'Phase 1 mounted archive UAT',
    deep: false,
  });
  assert.equal(archived.status, 200);
  assert.equal(archived.body.verified, true);
  assert.equal(archived.body.source.device, true);
  const bundleName = subject.validateBundleId(archived.body.file);
  const libraryRoot = path.join(__dirname, '..', 'library');
  const bundle = subject.resolveChild(libraryRoot, bundleName);
  const stored = fs.readFileSync(path.join(bundle, 'song.opz'));
  const info = JSON.parse(fs.readFileSync(path.join(bundle, 'info.json'), 'utf8'));
  parseProject(stored);
  assert.ok(stored.equals(before));
  assert.equal(info.schemaVersion, 1);
  assert.equal(info.project.sha256, beforeSha256);
  assert.equal(info.project.bytes, before.length);
  assert.equal(archived.body.evidence.sha256, beforeSha256);
  assert.equal(archived.body.evidence.bytes, before.length);

  const after = fs.readFileSync(sourcePath);
  assert.equal(after.length, before.length);
  assert.equal(crypto.createHash('sha256').update(after).digest('hex'), beforeSha256);
});

test('mounted restore and mounted grid UAT preserve same-byte Content Mode state', {
  skip: process.env.OPZ_HARDWARE_UAT !== '1',
}, async t => {
  const mountedRoot = fs.readdirSync('/Volumes').map(name => path.join('/Volumes', name)).find(root =>
    fs.existsSync(path.join(root, 'projects', 'project01.opz')) && fs.existsSync(path.join(root, 'samplepacks')));
  assert.ok(mountedRoot, 'a real OP-Z Content Mode source with project and samplepacks is required');
  const projectPath = path.join(mountedRoot, 'projects', 'project01.opz');
  const initialTree = snapshotRegularFiles(mountedRoot);
  const initialProject = fs.readFileSync(projectPath);
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'opz-mounted-uat-'));
  const libraryRoot = path.join(base, 'library'), autoRoot = path.join(base, 'auto');
  fs.mkdirSync(libraryRoot, { recursive: true }); fs.mkdirSync(autoRoot, { recursive: true });
  const previousRoot = process.env.OPZ_ROOT;
  process.env.OPZ_ROOT = mountedRoot;
  subject.testHooks.sourceResolver = () => ({ root: mountedRoot, path: path.join(mountedRoot, 'projects'), device: true, label: path.basename(mountedRoot) });
  subject.testHooks.libraryRoot = libraryRoot; subject.testHooks.autoRoot = autoRoot;
  t.after(() => {
    if (previousRoot === undefined) delete process.env.OPZ_ROOT; else process.env.OPZ_ROOT = previousRoot;
    fs.rmSync(base, { recursive: true, force: true });
    for (const key of Object.keys(subject.testHooks)) delete subject.testHooks[key];
    if (subject.server.listening) subject.server.close();
  });
  await new Promise((resolve, reject) => subject.server.listen(0, '127.0.0.1', resolve).once('error', reject));
  try {
    const archived = await requestJson(subject.server, '/api/backup', { slot: 1, name: 'mounted same-byte UAT', deep: true });
    assert.equal(archived.status, 200, JSON.stringify(archived.body));
    const state = await requestJson(subject.server, '/api/state');
    const slot = state.body.slots.find(item => item.slot === 1), shelf = state.body.archiveShelf.verified.find(item => item.id === archived.body.file);
    assert.ok(slot && shelf && shelf.archiveRevision && slot.sourceToken);
    const restored = await requestJson(subject.server, '/api/restore', { file: archived.body.file, auto: false, archiveRevision: shelf.archiveRevision, slot: 1, targetFingerprint: { sha256: slot.sha256, bytes: slot.bytes }, sourceToken: slot.sourceToken });
    assert.equal(restored.status, 200, JSON.stringify(restored.body)); assert.equal(restored.body.source.device, true); assert.ok(restored.body.recovery.id);
    const grid = await requestJson(subject.server, '/api/instruments/restore-grid', { file: archived.body.file, auto: false, archiveRevision: shelf.archiveRevision, sourceToken: slot.sourceToken });
    assert.equal(grid.status, 200, JSON.stringify(grid.body)); assert.equal(grid.body.source.device, true); assert.ok(grid.body.recovery.id);
    assert.deepEqual(snapshotRegularFiles(mountedRoot).map(item => [item.path, item.sha256, item.bytes, item.mode]), initialTree.map(item => [item.path, item.sha256, item.bytes, item.mode]));
    assert.ok(fs.readFileSync(projectPath).equals(initialProject));
    process.stdout.write('mounted UAT evidence digest ' + crypto.createHash('sha256').update(JSON.stringify(snapshotRegularFiles(mountedRoot))).digest('hex') + '\n');
  } finally {
    if (!fs.readFileSync(projectPath).equals(initialProject)) fs.writeFileSync(projectPath, initialProject, { flush: true });
  }
});

test('manual free mounted UAT preserves every regular file beneath the OP-Z root', {
  skip: process.env.OPZ_HARDWARE_UAT !== '1',
}, async t => {
  const mountedRoot = '/Volumes/OP-Z';
  const slot = Array.from({ length: 10 }, (_, index) => index + 1).find(number => {
    const file = path.join(mountedRoot, 'projects', `project${String(number).padStart(2, '0')}.opz`);
    try { return fs.lstatSync(file).isFile() && fs.statSync(file).size > 0 && parseProject(fs.readFileSync(file)); }
    catch { return false; }
  });
  assert.ok(slot, 'at least one readable non-empty mounted slot is required');
  const before = snapshotRegularFiles(mountedRoot);
  assert.ok(before.length > 0, 'mounted root must contain regular files');

  const roots = tempRoots(t);
  const metaFile = path.join(path.dirname(roots.libraryRoot), 'meta.json');
  fs.writeFileSync(metaFile, JSON.stringify({ songs: {} }));
  const previousRoot = process.env.OPZ_ROOT;
  process.env.OPZ_ROOT = mountedRoot;
  subject.testHooks.libraryRoot = roots.libraryRoot;
  subject.testHooks.autoRoot = null;
  subject.testHooks.metaFile = metaFile;
  t.after(() => {
    for (const key of Object.keys(subject.testHooks)) delete subject.testHooks[key];
    if (previousRoot === undefined) delete process.env.OPZ_ROOT;
    else process.env.OPZ_ROOT = previousRoot;
    if (subject.server.listening) subject.server.close();
  });

  let retainedBundle;
  try {
    await new Promise((resolve, reject) => subject.server.listen(0, '127.0.0.1', resolve).once('error', reject));
    const archived = await requestJson(subject.server, '/api/backup', {
      slot,
      name: 'Phase 2 mounted read-only UAT',
      deep: true,
    });
    assert.equal(archived.status, 200);
    assert.equal(archived.body.verified, true);
    assert.equal(archived.body.complete, true);
    retainedBundle = subject.resolveChild(roots.libraryRoot, subject.validateBundleId(archived.body.file));
    const classification = subject.classifyArchive(retainedBundle);
    assert.equal(classification.verified, true);
    assert.equal(classification.complete, true);

    const preflight = await request(subject.server, '/api/manual-free?file=' + encodeURIComponent(archived.body.file));
    assert.equal(preflight.status, 200);
    assert.equal(preflight.body.eligible, true);
    assert.equal(preflight.body.relation, 'archived_song_present');
    assert.equal(preflight.body.archive.slot, slot);
    assert.equal(preflight.body.archive.source, 'OP-Z');

    subject.testHooks.manualCaptureSource = (currentSlot, source) => ({
      ...subject.captureSource(currentSlot, source),
      sha256: '0'.repeat(64),
    });
    const mismatch = await request(subject.server, '/api/manual-free?file=' + encodeURIComponent(archived.body.file));
    assert.equal(mismatch.status, 200);
    assert.equal(mismatch.body.eligible, false);
    assert.equal(mismatch.body.relation, 'unexpected_non_empty_replacement');
    delete subject.testHooks.manualCaptureSource;
    assert.ok(fs.existsSync(retainedBundle));
  } finally {
    const after = snapshotRegularFiles(mountedRoot);
    assert.deepEqual(after, before);
    const evidence = crypto.createHash('sha256').update(JSON.stringify(before)).digest('hex');
    t.diagnostic(`mounted OP-Z unchanged: ${before.length} regular files, evidence ${evidence}`);
  }
  assert.equal(subject.classifyArchive(retainedBundle).complete, true);
});

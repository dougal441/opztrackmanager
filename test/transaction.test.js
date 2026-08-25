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
  assert.equal(info.verification.sha256, crypto.createHash('sha256').update(stored).digest('hex'));
  assert.equal(info.verification.bytes, stored.length);
  assert.equal(info.verification.verified, true);
  assert.equal(subject.scanLibrary({ songs: {} }, libraryRoot, null)[0].verified, true);

  info.verification.sha256 = '0'.repeat(64);
  fs.writeFileSync(path.join(bundle, 'info.json'), JSON.stringify(info));
  assert.equal(subject.scanLibrary({ songs: {} }, libraryRoot, null)[0].verified, false);
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
  assert.deepEqual(info.manifest.map(item => item.path), ['1-kick/01/kick.aif']);
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
  for (const action of ['backup', 'doSwap', 'restore', 'removePack', 'importPack', 'snapshotInstruments', 'downloadPack']) {
    assert.match(html, new RegExp('data-mutation="[^"]+"[^>]+onclick="' + action + '\\('), action);
  }
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
    if (evidence) fs.writeFileSync(path.join(dir, 'info.json'), JSON.stringify({ verification: {
      verified: true,
      sha256: crypto.createHash('sha256').update(fixture).digest('hex'),
      bytes: fixture.length,
    } }));
    return dir;
  };
  writeBundle('verified');
  writeBundle('legacy', false);
  writeBundle('mismatch');
  const mismatch = JSON.parse(fs.readFileSync(path.join(libraryRoot, 'mismatch', 'info.json')));
  mismatch.verification.sha256 = '0'.repeat(64);
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

test('corrupt published bundle remains visible as an unverified diagnostic', t => {
  const { libraryRoot } = tempRoots(t);
  const bundle = path.join(libraryRoot, 'corrupt-published');
  fs.mkdirSync(bundle);
  fs.writeFileSync(path.join(bundle, 'song.opz'), Buffer.from('not a project'));

  const items = subject.scanLibrary({ songs: {} }, libraryRoot, null);
  assert.deepEqual(items, [{
    file: 'corrupt-published',
    bundle: true,
    auto: false,
    modified: fs.statSync(bundle).mtime,
    verified: false,
    errorCode: 'ARCHIVE_PARSE_FAILED',
  }]);
  assert.ok(!JSON.stringify(items).includes(libraryRoot));
});

test('corrupt legacy archive remains visible as an unverified diagnostic', t => {
  const { libraryRoot } = tempRoots(t);
  const legacy = path.join(libraryRoot, 'broken.opz');
  fs.writeFileSync(legacy, Buffer.from('not a project'));

  assert.deepEqual(subject.scanLibrary({ songs: {} }, libraryRoot, null), [{
    file: 'broken.opz',
    bundle: false,
    auto: false,
    modified: fs.statSync(legacy).mtime,
    verified: false,
    errorCode: 'ARCHIVE_PARSE_FAILED',
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
  assert.equal(subject.scanLibrary({ songs: {} }, libraryRoot, null)[0].fromSlot, null);
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

test('later-phase routes unavailable before filesystem mutation', async t => {
  const unavailable = [
    '/api/restore',
    '/api/swap',
    '/api/clear-slot',
    '/api/instruments/move',
    '/api/instruments/remove',
    '/api/instruments/import',
    '/api/instruments/snapshot',
    '/api/op1fun/download',
  ];
  assert.deepEqual(subject.mutationRouteInventory, { enabled: ['/api/backup'], unavailable });
  await new Promise((resolve, reject) => subject.server.listen(0, '127.0.0.1', resolve).once('error', reject));
  t.after(() => { if (subject.server.listening) subject.server.close(); });
  for (const route of unavailable) {
    const result = await requestJson(subject.server, route, {});
    assert.equal(result.status, 409, route);
    assert.equal(result.body.code, 'PHASE_UNAVAILABLE', route);
    assert.match(result.body.guidance, /Phase [236]/, route);
  }

  const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
  assert.match(html, /disabled[^>]+Phase 3[^>]+>load</);
  assert.match(html, /disabled[^>]+Phase 3[^>]+>swap</);
  assert.match(html, /disabled[^>]+Phase 3[^>]+>remove/);
  assert.match(html, /disabled[^>]+Phase 3[^>]+>import/);
  assert.match(html, /disabled[^>]+Phase 3[^>]+>snapshot/);
  assert.match(html, /disabled[^>]+Phase 3[^>]+>→/);
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

test('library UI segregates verified archives from unverified diagnostics', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
  const body = /function renderLibrary\(\) \{([\s\S]*?)\n\}\nasync function restore/.exec(html)[1];
  assert.match(body, /STATE\.library\.filter\(i => i\.verified === true\)/);
  assert.match(body, /STATE\.library\.filter\(i => i\.verified !== true\)/);
  assert.match(body, /STATE\.drafts/);
  assert.match(body, /id="verifiedArchives"/);
  assert.match(body, /id="unverifiedDrafts"/);
  assert.match(body, /verified:false/);

  const unverified = /for \(const it of unverified\)([\s\S]*?)for \(const draft/.exec(body)[1];
  assert.doesNotMatch(unverified, /onclick="restore|<select/);
  const drafts = /for \(const draft of STATE\.drafts\)([\s\S]*)/.exec(body)[1];
  assert.doesNotMatch(drafts, /onclick="restore|<select/);
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
  assert.equal(info.verification.verified, true);
  assert.equal(info.verification.sha256, beforeSha256);
  assert.equal(info.verification.bytes, before.length);
  assert.equal(archived.body.evidence.sha256, beforeSha256);
  assert.equal(archived.body.evidence.bytes, before.length);

  const after = fs.readFileSync(sourcePath);
  assert.equal(after.length, before.length);
  assert.equal(crypto.createHash('sha256').update(after).digest('hex'), beforeSha256);
});

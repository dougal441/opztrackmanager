'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

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

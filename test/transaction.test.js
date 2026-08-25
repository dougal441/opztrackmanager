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

function requestJson(server, pathname, payload) {
  const address = server.address();
  return new Promise((resolve, reject) => {
    const body = payload && JSON.stringify(payload);
    const req = http.request({
      host: '127.0.0.1',
      port: address.port,
      path: pathname,
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json', 'X-OPZ-Mutation': '1' } : {},
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch (error) { reject(error); }
      });
    });
    req.on('error', reject);
    req.end(body);
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

test('state reports sanitized active mutation and separate drafts', async t => {
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

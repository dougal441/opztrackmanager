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

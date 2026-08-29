// OP-1/OP-Z .aif sample pack reader: AIFF (big-endian PCM) + AIFC 'sowt' (little-endian),
// op-1 APPL JSON (drum slices / sampler base_freq), and WAV encoding for browsers
// (Chrome can't decode AIFF natively).

'use strict';

const DRUM_SPAN = 0x7FFFFFFE; // slice positions span this range over 12s @ 44.1kHz
const DRUM_FRAMES = 44100 * 12;

function parseAif(buf) {
  if (buf.toString('ascii', 0, 4) !== 'FORM') throw new Error('not an AIFF file');
  const kind = buf.toString('ascii', 8, 12); // AIFF | AIFC
  let off = 12;
  const out = { kind, channels: 1, frames: 0, bits: 16, sampleRate: 44100, compression: 'NONE', op1: null, pcm: null };
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const sz = buf.readUInt32BE(off + 4);
    const body = off + 8;
    if (id === 'COMM') {
      out.channels = buf.readInt16BE(body);
      out.frames = buf.readUInt32BE(body + 2);
      out.bits = buf.readInt16BE(body + 6);
      // 80-bit extended sample rate — read exponent+mantissa roughly
      const exp = buf.readUInt16BE(body + 8) & 0x7fff;
      const mant = buf.readUInt32BE(body + 10);
      out.sampleRate = Math.round(mant * Math.pow(2, exp - 16383 - 31)) || 44100;
      if (kind === 'AIFC' && sz > 18) out.compression = buf.toString('ascii', body + 18, body + 22);
    } else if (id === 'APPL') {
      const marker = buf.toString('ascii', body, body + 4);
      if (marker === 'op-1') {
        try { out.op1 = JSON.parse(buf.toString('utf8', body + 4, body + sz).replace(/\0+$/, '')); } catch {}
      }
    } else if (id === 'SSND') {
      const dataOff = buf.readUInt32BE(body); // offset field
      out.pcm = buf.subarray(body + 8 + dataOff, body + sz);
    }
    off = body + sz + (sz & 1);
  }
  if (!out.pcm) throw new Error('no SSND chunk');
  return out;
}

// -> 16-bit little-endian PCM WAV buffer
function aifToWav(buf) {
  const a = parseAif(buf);
  if (a.bits !== 16) throw new Error('unsupported bit depth ' + a.bits);
  const n = Math.floor(a.pcm.length / 2) * 2;
  const data = Buffer.alloc(n);
  if (a.kind === 'AIFC' && a.compression === 'sowt') {
    a.pcm.copy(data, 0, 0, n); // already little-endian
  } else {
    for (let i = 0; i < n; i += 2) { data[i] = a.pcm[i + 1]; data[i + 1] = a.pcm[i]; } // byte-swap BE->LE
  }
  const hdr = Buffer.alloc(44);
  const byteRate = a.sampleRate * a.channels * 2;
  hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + n, 4); hdr.write('WAVE', 8);
  hdr.write('fmt ', 12); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20);
  hdr.writeUInt16LE(a.channels, 22); hdr.writeUInt32LE(a.sampleRate, 24);
  hdr.writeUInt32LE(byteRate, 28); hdr.writeUInt16LE(a.channels * 2, 32); hdr.writeUInt16LE(16, 34);
  hdr.write('data', 36); hdr.writeUInt32LE(n, 40);
  return Buffer.concat([hdr, data]);
}

// pack metadata for the browser
function packInfo(buf) {
  const a = parseAif(buf);
  const info = { kind: 'sample', frames: a.frames, sampleRate: a.sampleRate, name: a.op1 && a.op1.name || null };
  if (a.op1 && a.op1.type === 'drum') {
    info.kind = 'drum';
    const toFrame = v => Math.max(0, Math.min(a.frames, Math.round(v * DRUM_FRAMES / DRUM_SPAN)));
    info.slices = [];
    for (let i = 0; i < 24; i++) {
      const s = toFrame(a.op1.start[i]), e = toFrame(a.op1.end[i]);
      if (e > s + 16) info.slices.push({ i, start: s, end: e });
    }
  } else if (a.op1 && (a.op1.type === 'sampler' || a.op1.base_freq)) {
    info.kind = 'sampler';
    info.baseFreq = a.op1.base_freq || 440;
  }
  return info;
}

module.exports = { parseAif, aifToWav, packInfo };

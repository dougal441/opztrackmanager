// OP-Z project file (.opz) parser
// Format per z-po-project wiki (firmware 1.1.x/1.2.x), verified against real files.
// File: 4B id (0x49) | 16x32B pattern chains | mixer/tempo header | 16 patterns @ 21392B from offset 572

'use strict';

const PATTERN_BASE = 572;
const PATTERN_SIZE = 21392;
const NUM_PATTERNS = 16;
const NOTES_OFFSET = 192;      // within pattern
const NOTES_PER_STEP = 55;
const NUM_STEPS = 16;
const NOTE_SIZE = 8;

// track index -> [name, note slots per step]
const TRACKS = [
  ['kick', 2], ['snare', 2], ['hihat', 2], ['sample', 2],
  ['bass', 4], ['lead', 4], ['arp', 8], ['chord', 4],
  ['fx1', 1], ['fx2', 1], ['tape', 1], ['master', 4],
  ['perform', 6], ['module', 6], ['lights', 4], ['motion', 4],
];

// note-slot index within a step -> track index
const SLOT_TO_TRACK = (() => {
  const map = [];
  TRACKS.forEach(([name, count], ti) => { for (let i = 0; i < count; i++) map.push(ti); });
  return map; // length 55
})();

const MUSICAL_TRACKS = [0, 1, 2, 3, 4, 5, 6, 7]; // kick..chord

function parseChains(buf) {
  const chains = [];
  for (let c = 0; c < 16; c++) {
    const base = 4 + c * 32;
    if (buf[base] === 0xff) continue; // empty chain
    const pats = [];
    for (let i = 0; i < 32; i++) {
      const v = buf[base + i];
      if (v === 0xff) break;
      if (v <= 15) pats.push(v);
    }
    if (pats.length) chains.push({ index: c, patterns: pats });
  }
  return chains;
}

function parseNotes(buf, patternIndex) {
  const pb = PATTERN_BASE + patternIndex * PATTERN_SIZE;
  const notes = [];
  for (let i = 0; i < NOTES_PER_STEP * NUM_STEPS; i++) {
    const off = pb + NOTES_OFFSET + i * NOTE_SIZE;
    const dur = buf.readInt32LE(off);
    if (dur === -1 || dur === 0) continue;
    const note = buf[off + 4];
    const vel = buf[off + 5];
    if (vel === 0 || note > 127) continue;
    const step = Math.floor(i / NOTES_PER_STEP);
    const slot = i % NOTES_PER_STEP;
    notes.push({
      step, track: SLOT_TO_TRACK[slot],
      note, vel, dur,
      micro: buf.readInt8(off + 6),
    });
  }
  return notes;
}

function parseTrackChunks(buf, patternIndex) {
  const pb = PATTERN_BASE + patternIndex * PATTERN_SIZE;
  const tracks = [];
  for (let t = 0; t < 16; t++) {
    const off = pb + t * 12;
    tracks.push({
      track: t, name: TRACKS[t][0],
      plugId: buf.readUInt32LE(off) >>> 0,
      stepCount: buf[off + 4],
      stepLength: buf[off + 6],
      quantize: buf[off + 7],
      noteStyle: buf[off + 8],
      noteLength: buf[off + 9],
    });
  }
  return tracks;
}

function parseProject(buf) {
  if (buf.length < PATTERN_BASE + NUM_PATTERNS * PATTERN_SIZE) {
    throw new Error(`unexpected .opz size ${buf.length}`);
  }
  const patterns = [];
  for (let p = 0; p < NUM_PATTERNS; p++) {
    const notes = parseNotes(buf, p);
    const perTrack = {};
    const stepGrid = MUSICAL_TRACKS.map(() => new Array(NUM_STEPS).fill(0)); // 8 tracks x 16 steps note counts
    for (const n of notes) {
      const name = TRACKS[n.track][0];
      perTrack[name] = (perTrack[name] || 0) + 1;
      if (n.track < 8) stepGrid[n.track][n.step]++;
    }
    const musicalCount = notes.filter(n => MUSICAL_TRACKS.includes(n.track)).length;
    patterns.push({
      index: p,
      noteCount: musicalCount,
      totalNotes: notes.length,
      trackNotes: perTrack,
      activeTracks: Object.keys(perTrack),
      stepGrid,
    });
  }
  return {
    tempo: buf[520],
    mixer: { drums: buf[516], synth: buf[517], punch: buf[518], master: buf[519] },
    swing: buf[565],
    chains: parseChains(buf),
    patterns,
    usedPatterns: patterns.filter(p => p.noteCount > 0).map(p => p.index),
  };
}

module.exports = { parseProject, parseNotes, parseTrackChunks, TRACKS, PATTERN_BASE, PATTERN_SIZE };

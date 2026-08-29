# OP-Z Manager

Track manager for OP-Z project slots. See all 10 slots, name songs, hear sketches, archive the whole device, move pattern-selected songs to an unlimited library, and restore or swap slots safely.

## Start

Double-click `Start OP-Z Manager.command` (or `node server.js`). Opens http://localhost:8765

First time: if macOS blocks it, right-click → Open. Needs Node (`brew install node`).

## Sources

- **OP-Z plugged in + disk mode** (hold track button while powering on): auto-detected under /Volumes. All changes write directly to device. Eject before disconnecting.
- **No device**: falls back to local copy in `opzgui/opzdisk/projects` (read/write on copy only).

## What it shows per slot

- Tempo, used patterns, arrangement chains, per-track note counts
- Your name/tags/notes — stored in `data/meta.json`, keyed to project content hash, so they follow a song when it moves slots or comes back from library
- ▶ sketch: WebAudio renders actual note data (generic sounds, right notes/rhythm/tempo)
- Link a recording (from `OP-Z songs` / FlowStudio) for real audio

## Library workflow (solves 12-songs-in-10-slots)

1. Expand a device slot and choose the Pattern numbers that belong to a song.
2. Archive the selection, or move it to the archive shelf. A move publishes the verified song and a recovery copy before the slot changes; unselected patterns stay at their original numbers.
3. Restore any archived song into any slot later. An occupied target automatically gets a verified recovery first.
4. To preserve the complete device at once, choose **archive all occupied slots**. This creates one dated snapshot containing every occupied project and one shared copy of the complete sample-pack grid.

Whole-slot archives and automatic clearing remain available. The proven clear workflow waits for a disconnect/reconnect confirmation before reporting an empty slot.

## Sketch playback with real sounds

Sketches now use the actual sample packs on the device: drum tracks slice the real kit .aifs (OP-Z drum keys map from F3, one slice per semitone), pitched tracks repitch sampler packs to the sequenced notes via base_freq. The OP-Z doesn't record which pack a song uses (plug IDs are an unmapped hash), so each song has a "sketch instruments" selector; drums default to the first real pack per column. Factory `~` packs are 0-byte firmware references — no audio available, synth stand-in used.

## Pack browser (op1.fun)

Search/browse community packs in the instruments tab, preview mp3s freely. To download into an empty slot: create a free op1.fun account, copy your API token from account settings into the app's account panel.

## Instrument manager (INSTRUMENTS tab)

8 track types × 10 slots, like the OP-Z app. Click a pack, then another slot in the same column → move/swap. Remove → `library/instrument-trash/` (recoverable). Import .aif into empty slots from anywhere in Music folder. Snapshot button archives the whole instrument setup. Needs device in disk mode; eject before disconnecting so the OP-Z picks up changes.

## Modes

- **Disk mode** (hold track key + power on, USB): everything here — slots, library, instruments
- **Live mode** (normal power on): device plays; manager can't see files. Future: MIDI features.

## Files

- `parser.js` — .opz binary format parser (format: z-po-project wiki)
- `server.js` — no-dependency Node server + API
- `app/index.html` — GUI
- `library/` — your song backups
- `library/device-snapshots/` — dated all-slot archives with one shared instrument grid
- `data/meta.json` — names/tags/notes

## License

MIT — see `LICENSE`.

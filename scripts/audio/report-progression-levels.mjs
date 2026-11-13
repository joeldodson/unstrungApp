// How loud a progression is on the audio track player against chord practice's player.
//
// Chord practice plays the mf recordings at a gain of 0.55. The track player plays the recording
// layer a note's dynamic asks for at 0.4 (AUDIO_TRACK_NOTE_GAIN). A saved progression writes no
// dynamic, and alphaTab reads an alphaTex note with none as f, not mf (docs/one-player.md, under
// decision 10), so on the track player a progression plays the f recordings.
//
// This measures every guitar note recorded at both mf and f: the RMS of each recording's first
// second, averaged over its round robins, in decibels. Then it adds the difference in gain. A
// report, not a check: it prints the numbers and fails only if it cannot read the recordings.
//
//   node scripts/audio/report-progression-levels.mjs

import fs from 'node:fs';
import path from 'node:path';

const root = path.join(import.meta.dirname, '..', '..');
const folder = path.join(root, 'src', 'assets', 'samples', 'green-gretsch', 'Samples');

const CHORD_PRACTICE_GAIN = 0.55;
const TRACK_GAIN = 0.4;
const WINDOW_SECONDS = 1;

/** The RMS of a WAV file's first second, all channels, from 16, 24 or 32 bit PCM or 32 bit float. */
function wavRms(file) {
    const bytes = fs.readFileSync(file);
    let offset = 12;
    let format = null;
    while (offset + 8 <= bytes.length) {
        const id = bytes.toString('ascii', offset, offset + 4);
        const size = bytes.readUInt32LE(offset + 4);
        const body = offset + 8;
        if (id === 'fmt ') {
            format = {
                code: bytes.readUInt16LE(body), channels: bytes.readUInt16LE(body + 2),
                rate: bytes.readUInt32LE(body + 4), bits: bytes.readUInt16LE(body + 14)
            };
        } else if (id === 'data' && format) {
            const width = format.bits / 8;
            const frames = Math.min(Math.floor(size / (width * format.channels)), Math.round(format.rate * WINDOW_SECONDS));
            let sum = 0;
            for (let i = 0; i < frames * format.channels; i++) {
                const at = body + i * width;
                let value;
                if (format.code === 3) value = bytes.readFloatLE(at);
                else if (width === 2) value = bytes.readInt16LE(at) / 32768;
                else if (width === 3) value = bytes.readIntLE(at, 3) / 8388608;
                else value = bytes.readInt32LE(at) / 2147483648;
                sum += value * value;
            }
            return Math.sqrt(sum / (frames * format.channels));
        }
        offset = body + size + (size % 2);
    }
    throw new Error(`no audio found in ${file}`);
}

const db = ratio => 20 * Math.log10(ratio);
const files = fs.readdirSync(folder, { recursive: true }).filter(name => name.endsWith('.wav'));
const byNote = new Map();
for (const name of files) {
    const match = path.basename(name).match(/^(.*)_(p|mf|f)_rr\d+\.wav$/);
    if (!match) continue;
    const [, note, layer] = match;
    if (!byNote.has(note)) byNote.set(note, { p: [], mf: [], f: [] });
    byNote.get(note)[layer].push(wavRms(path.join(folder, name)));
}

const mean = values => values.reduce((a, b) => a + b, 0) / values.length;
const differences = [];
for (const [note, layers] of byNote) {
    if (layers.mf.length === 0 || layers.f.length === 0) continue;
    differences.push({ note, db: db(mean(layers.f) / mean(layers.mf)) });
}
differences.sort((a, b) => a.db - b.db);

const average = mean(differences.map(d => d.db));
const gain = db(TRACK_GAIN / CHORD_PRACTICE_GAIN);
console.log(`Notes recorded at both mf and f: ${differences.length}`);
console.log(`f against mf, first second's RMS: average ${average.toFixed(1)} dB, from ${differences[0].db.toFixed(1)} (${differences[0].note}) to ${differences.at(-1).db.toFixed(1)} (${differences.at(-1).note})`);
console.log(`Gain, ${TRACK_GAIN} against ${CHORD_PRACTICE_GAIN}: ${gain.toFixed(1)} dB`);
console.log(`A progression on the track player, f at ${TRACK_GAIN}, against chord practice, mf at ${CHORD_PRACTICE_GAIN}: ${(average + gain).toFixed(1)} dB`);
console.log(`Were it to write mf, as decision 15 assumed: ${gain.toFixed(1)} dB`);

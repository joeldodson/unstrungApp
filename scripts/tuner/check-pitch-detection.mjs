// Checks src/shared/pitchDetection.mjs, the tuner's pitch detector, without listening.
//
// 1. Synthetic plucked strings at known detuning, with a strong second harmonic and noise, at
//    both window sizes the tuner uses: each must read within a cent.
// 2. Silence, noise and a tone above the tuner's range must read as nothing, and the tuner's own
//    high feedback tone under a string must not change the string's reading by much.
// 3. Every recording in the guitar and bass sample packs from C2 up, read at several points, must
//    name the note its .sfz map gives it, and the readings across nearly every recording must agree.
// 4. The note, string and wording helpers.
//
//   node scripts/tuner/check-pitch-detection.mjs

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
    detectPitch, nearestNote, nearestString, describeReading, describeCents, tunerNoteName,
    midiToFrequency, frequencyToMidi, createPitchSmoother, foldOctave, TUNER_MIN_HZ, TUNER_MIN_CLARITY
} from '../../src/shared/pitchDetection.mjs';
import { TUNINGS } from '../../src/shared/musicTheory.mjs';
import { parseSfzRegions, buildSampleMap } from '../../src/shared/sampleMap.mjs';
import { decodeWav } from './wav.mjs';

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};

// A small seeded generator, so noise is the same on every run.
let seed = 12345;
const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
};

/** A plucked string: harmonics with a strong second, each decaying faster than the one below. */
function pluck(frequency, sampleRate, length, { start = 0.2, noise = 0.01, extra = null } = {}) {
    const harmonics = [1, 1.4, 0.8, 0.5, 0.35, 0.2, 0.1];
    const samples = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        const t = start + i / sampleRate;
        let v = 0;
        harmonics.forEach((amp, h) => {
            v += amp * Math.exp(-t * (1 + h)) * Math.sin(2 * Math.PI * frequency * (h + 1) * t + h);
        });
        v *= 0.2;
        v += noise * (random() * 2 - 1);
        if (extra) v += extra.level * Math.sin(2 * Math.PI * extra.frequency * t);
        samples[i] = v;
    }
    return samples;
}

console.log('=== Synthetic strings ===');
const rate = 48000;
for (const size of [2048, 4096]) {
    let worst = 0;
    let wrong = 0;
    let tested = 0;
    for (const midi of [36, 38, 40, 45, 50, 55, 59, 64, 69, 76, 81]) {
        for (let cents = -45; cents <= 45; cents += 15) {
            const frequency = midiToFrequency(midi + cents / 100);
            const reading = detectPitch(pluck(frequency, rate, size), rate);
            tested++;
            if (!reading) {
                wrong++;
                continue;
            }
            const error = Math.abs(1200 * Math.log2(reading.frequency / frequency));
            if (error > 50) wrong++;
            else worst = Math.max(worst, error);
        }
    }
    check(`window of ${size}: every string read, none an octave or note out`, wrong === 0, `${wrong} of ${tested}`);
    check(`window of ${size}: within a cent`, worst < 1, `worst ${worst.toFixed(3)} cents`);
}
{
    const reading = detectPitch(pluck(midiToFrequency(40), rate, 2048), rate);
    check('a held string is clear', reading && reading.clarity > 0.9, reading ? `clarity ${reading.clarity.toFixed(3)}` : 'nothing');
}

console.log('=== Nothing to read ===');
check('silence reads as nothing', detectPitch(new Float32Array(2048), rate) === null);
{
    const noise = new Float32Array(2048).map(() => 0.1 * (random() * 2 - 1));
    const reading = detectPitch(noise, rate);
    check('noise reads as nothing or unclear', !reading || reading.clarity < 0.6,
        reading ? `clarity ${reading.clarity.toFixed(3)}` : 'nothing');
}
{
    const tone = new Float32Array(2048).map((_, i) => 0.2 * Math.sin(2 * Math.PI * 2000 * i / rate));
    check('a 2,000 Hz tone, above the range, reads as nothing', detectPitch(tone, rate) === null);
}
{
    const quiet = pluck(midiToFrequency(45), rate, 2048, { noise: 0 }).map(v => v * 0.001);
    check('a string below the level asked for reads as nothing', detectPitch(quiet, rate, { minRms: 0.001 }) === null);
}
{
    // The feedback tone, about 2,000 Hz, at a tenth of the string's level. Unfiltered it moves
    // the reading by several cents; the tuner's two-stage 1,000 Hz low-pass takes about 24 dB off
    // it, which is what this checks.
    const frequency = midiToFrequency(45 - 0.2);
    const errorWith = level => {
        const reading = detectPitch(pluck(frequency, rate, 2048, { extra: { frequency: 2000, level } }), rate);
        return reading ? Math.abs(1200 * Math.log2(reading.frequency / frequency)) : Infinity;
    };
    const filtered = errorWith(0.02 / 16);
    check('a high tone under the string, filtered, barely moves its reading', filtered < 1,
        `${filtered.toFixed(2)} cents; unfiltered ${errorWith(0.02).toFixed(2)}`);
}

console.log('=== The sample packs ===');

const root = path.join(import.meta.dirname, '..', '..');
const packs = [
    path.join(root, 'src', 'assets', 'samples', 'green-gretsch', 'Programs'),
    path.join(root, 'src', 'assets', 'samples', 'black-and-blue-bass', 'Programs')
];
const maps = ['modules/maps_green/ord.sfz', 'modules/maps_black/reg.sfz'];
const sources = [];
for (let i = 0; i < packs.length; i++) {
    sources.push({ regions: parseSfzRegions(await readFile(path.join(packs[i], maps[i]), 'utf8')), base: packs[i] });
}
const files = new Map();
for (const [key, byVelocity] of buildSampleMap(sources)) {
    // From C2 to A5: the tuner's range, less the top, where the recordings die away quickly.
    if (midiToFrequency(key) < TUNER_MIN_HZ + 5 || key > 81) continue;
    for (const candidates of Object.values(byVelocity)) {
        for (const region of candidates) files.set(path.resolve(region.base, region.sample), key);
    }
}

let read = 0;
let wrongNote = 0;
let unsteady = 0;
const offsets = [];
const problems = [];
for (const [file, key] of files) {
    const { samples, sampleRate } = decodeWav(await readFile(file));
    const readings = [];
    for (const seconds of [0.2, 0.4, 0.6, 0.8]) {
        const from = Math.floor(seconds * sampleRate);
        const window = samples.subarray(from, from + 4096);
        if (window.length < 4096) continue;
        const reading = detectPitch(window, sampleRate);
        // Late in a recording the octave above can outlast the fundamental, which only changes the
        // octave named. Folded back the way the tuner's smoother folds it.
        if (reading && reading.clarity >= TUNER_MIN_CLARITY) readings.push(foldOctave(frequencyToMidi(reading.frequency), key));
    }
    read++;
    if (readings.length === 0) {
        wrongNote++;
        problems.push(`${path.basename(file)} (${tunerNoteName(key)}): nothing read`);
        continue;
    }
    const sorted = [...readings].sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1];
    const cents = (median - key) * 100;
    if (Math.abs(cents) > 50) {
        wrongNote++;
        problems.push(`${path.basename(file)} (${tunerNoteName(key)}): read ${cents.toFixed(0)} cents off`);
        continue;
    }
    offsets.push(Math.abs(cents));
    // A string's pitch falls a little as it dies away, and a few recordings waver.
    if ((sorted.at(-1) - sorted[0]) * 100 > 20) {
        unsteady++;
        problems.push(`${path.basename(file)}: readings spread ${((sorted.at(-1) - sorted[0]) * 100).toFixed(1)} cents`);
    }
}
offsets.sort((a, b) => a - b);
for (const problem of problems.slice(0, 15)) console.log(`        ${problem}`);
check(`every recording read as its own note`, wrongNote === 0, `${read - wrongNote} of ${read}`);
// The soft F5 takes rise by about 40 cents as they die, with clear readings throughout: the
// recordings do it, not the detector, which reads the firmer F5 takes steady to a hundredth.
check('readings across a recording agree within 20 cents, bar a few odd recordings', unsteady <= 3,
    `${unsteady} spread wider`);
console.log(`        recordings off their note by a median of ${offsets[offsets.length >> 1]?.toFixed(1)} cents,` +
    ` at most ${offsets.at(-1)?.toFixed(1)}: the recordings' own tuning, not the detector's error`);

console.log('=== Notes, strings and words ===');
check('E2 is MIDI 40', nearestNote(82.41).midi === 40);
check('C sharp is spelled for speech', tunerNoteName(61) === 'C sharp 4', tunerNoteName(61));
check('E2 reads as E2', tunerNoteName(40) === 'E2');
const standard = TUNINGS.find(t => t.id === 'standard').midi;
{
    // A low E slack by more than a semitone: chromatic says D sharp, string mode says string 6.
    const slack = midiToFrequency(40 - 1.3);
    check('chromatic names the slack low E as the note below', nearestNote(slack).midi === 39);
    const target = nearestString(slack, standard);
    check('string mode names it string 6', target.string === 6 && Math.round(target.cents) === -130,
        describeReading(target));
}
check('reading wording', describeReading({ midi: 40, cents: -8.4 }) === 'E2, 8 cents flat',
    describeReading({ midi: 40, cents: -8.4 }));
check('string wording', describeReading({ string: 1, midi: 64, cents: 1.2 }) === 'string 1, E4, in tune',
    describeReading({ string: 1, midi: 64, cents: 1.2 }));
check('in tune within 3 cents in words, or as asked',
    describeCents(3.2) === '3 cents sharp' && describeCents(-2.9) === 'in tune' && describeCents(2.5, 2) === '3 cents sharp');
{
    const smoother = createPitchSmoother(5);
    [40, 40.1, 47, 40.05, 39.95].forEach(v => smoother.add(v));
    check('the smoother ignores one wild reading', Math.abs(smoother.add(40) - 40.025) < 0.03);
    smoother.clear();
    [40, 40, 52.1, 52.1].forEach(v => smoother.add(v));
    check('the smoother folds readings an octave up', Math.abs(smoother.add(52.1) - 40.1) < 0.001);
    check('folding leaves a different note alone', foldOctave(47, 40) === 47 && Math.abs(foldOctave(64.1, 40) - 40.1) < 1e-9);
}

console.log(failures ? `${failures} FAILED` : 'All passed');
process.exit(failures ? 1 : 0);

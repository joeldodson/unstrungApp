// Checks src/shared/tunerSpeech.mjs: what the tuner says as a string is tuned, and when, and how
// it tells a new pluck. Readings are fed in by hand with their times; nothing is listened to.
//
// 1. Once it settles: a hard pluck that starts sharp and slides flat is said once, where it
//    settled, no sooner than a second in, and nothing more while it drifts or the peg is turned.
//    Joel's case: in tune for half a second, then 5 cents flat, is said as 5 cents flat.
// 2. A reading still moving at two seconds is said then.
// 3. In tune within 3 cents.
// 4. A silence or a new pluck starts over, the same words again included; another note that
//    settles is named in full; one reading of another note says nothing.
// 5. String mode names the string.
// 6. The pluck detector: a jump up is a pluck, a dying string is not, nor noise under the floor,
//    and one pluck is counted once.
// 7. The pluck detector on every recording in the guitar and bass sample packs from C2 to A5,
//    read every 15 ms as the tuner reads: each is one pluck, and the same recording started again
//    a second in, while the first still rings, is a second one.
// 8. Every open-string recording from the guitar pack, from low E to high E, read the way the
//    tuner reads, with its steady response: one thing said for nearly every one, and never more.
//    A few soft twangs on the B and high E strings die out in under a second and say nothing.
//
//   node scripts/tuner/check-tuner-speech.mjs

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createTunerSpeech, createPluckDetector } from '../../src/shared/tunerSpeech.mjs';
import {
    detectPitch, frequencyToMidi, midiToFrequency, nearestNote, createPitchSmoother, TUNER_MIN_CLARITY
} from '../../src/shared/pitchDetection.mjs';
import { parseSfzRegions, buildSampleMap } from '../../src/shared/sampleMap.mjs';
import { decodeWav } from './wav.mjs';

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};

const E2 = 40;
const A2 = 45;

/**
 * Feeds readings every 15 ms and returns what was said, with times. `cents` is a function of
 * the time from the start, `midi` the note heard, both over `ms`.
 */
function run(speech, { from = 0, ms, midi = E2, string, cents }) {
    const said = [];
    for (let t = from; t <= from + ms; t += 15) {
        const words = speech.heard({ midi, string, cents: cents(t - from) }, t);
        if (words) said.push({ t, words });
    }
    return said;
}
const words = said => said.map(s => s.words);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Every recording in the guitar and bass packs for keys from `low` to `high`, as { file, key }. */
async function packRecordings(low, high) {
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
    const found = new Map();
    for (const [key, byVelocity] of buildSampleMap(sources)) {
        if (key < low || key > high) continue;
        for (const candidates of Object.values(byVelocity)) {
            for (const region of candidates) found.set(path.resolve(region.base, region.sample), key);
        }
    }
    return [...found].map(([file, key]) => ({ file, key }));
}

console.log('Once it settles');
{
    // A hard pluck on a low E: 12 sharp, falling to 4.5 flat over 0.3 s, then wobbling by
    // 2 cents and drifting 3 cents flatter over the next 2.5 seconds.
    const pluck = t => (t < 300 ? 12 - 16.5 * t / 300 : -4.5 - 3 * (t - 300) / 2500 + 1 * Math.sin(t / 40));
    const speech = createTunerSpeech();
    const said = run(speech, { ms: 2800, cents: pluck });
    check('a pluck that settles is said once, from the middle of the readings',
        said.length === 1 && /^E2, [45] cents flat$/.test(said[0].words), words(said).join(' | '));
    check('and not before a second', said[0]?.t >= 1000, `${said[0]?.t} ms`);

    // Then the peg is turned while it rings, from 7 flat into tune, and held: nothing more.
    const turned = run(speech, { from: 2815, ms: 2500, cents: t => (t < 1000 ? -7 + 6 * t / 1000 : -1) });
    check('nothing more for that pluck, however it moves', turned.length === 0, words(turned).join(' | '));

    // Joel's case: through in tune for half a second, then sliding to 5 flat and sitting there.
    const joel = createTunerSpeech();
    const joelSaid = run(joel, { ms: 2500, cents: t => (t < 500 ? 0.5 : t < 800 ? 0.5 - 5.5 * (t - 500) / 300 : -5) });
    check('in tune for half a second, then 5 flat, is 5 flat', same(words(joelSaid), ['E2, 5 cents flat']),
        words(joelSaid).join(' | '));
}

console.log('Still moving');
{
    // Sliding steadily from 20 flat at 6 cents a second: never steady, so said at two seconds.
    const speech = createTunerSpeech();
    const said = run(speech, { ms: 3000, cents: t => -20 + 6 * t / 1000 });
    check('said once, at two seconds', said.length === 1 && said[0].t >= 2000 && said[0].t < 2030,
        `${words(said).join(' | ')} at ${said[0]?.t} ms`);
}

console.log('In tune within 3 cents');
{
    const at = cents => words(run(createTunerSpeech(), { ms: 1500, cents: () => cents }));
    check('2.9 flat is in tune', same(at(-2.9), ['E2, in tune']), at(-2.9).join(' | '));
    check('3.2 sharp is 3 cents sharp', same(at(3.2), ['E2, 3 cents sharp']), at(3.2).join(' | '));
}

console.log('Starting over');
{
    // The same string, plucked again unchanged: restart, then the same words again.
    const again = createTunerSpeech();
    const first = run(again, { ms: 1500, cents: () => -6 });
    again.restart();
    const replucked = run(again, { from: 1600, ms: 1500, cents: () => -6 });
    check('after a restart the same words are said again',
        same(words(first), ['E2, 6 cents flat']) && same(words(replucked), ['E2, 6 cents flat']),
        [...words(first), ...words(replucked)].join(' | '));

    // Turned past E2 until F2 is nearer, and held there: F2 is named once it settles.
    const speech = createTunerSpeech();
    run(speech, { ms: 1500, cents: () => -30 });
    const second = run(speech, { from: 1515, ms: 1500, midi: 41, cents: () => -45 });
    check('another note that settles is named in full', same(words(second), ['F2, 45 cents flat']),
        words(second).join(' | '));
    check('a second after it begins', second[0]?.t - 1515 >= 1000, `${second[0]?.t - 1515} ms`);

    // A flicker to the next note for one reading names nothing and does not repeat the first.
    const flicker = createTunerSpeech();
    const flickerSaid = run(flicker, { ms: 2000, midi: A2, cents: () => -20 });
    flicker.heard({ midi: A2 + 1, cents: -48 }, 2015);
    const after = run(flicker, { from: 2030, ms: 2000, midi: A2, cents: () => -20 });
    check('one reading of another note says nothing', same(words(flickerSaid), ['A2, 20 cents flat']) && after.length === 0,
        [...words(flickerSaid), ...words(after)].join(' | '));
}

console.log('String mode');
{
    const said = run(createTunerSpeech(), { ms: 1800, midi: A2, string: 5, cents: () => -12 });
    check('names the string', same(words(said), ['string 5, A2, 12 cents flat']), words(said).join(' | '));
}

console.log('Plucks');
{
    const floor = 0.0018;
    const pluckCount = levels => {
        const detector = createPluckDetector({ floor });
        return levels.filter(level => detector.add(level)).length;
    };
    // A pluck from silence, rising over three readings, then dying away by 3% a reading.
    const decay = n => Array.from({ length: n }, (_, i) => 0.2 * 0.97 ** i);
    const silence = n => Array(n).fill(0.0005);
    check('a pluck from silence is one pluck', pluckCount([...silence(10), 0.05, 0.15, 0.2, ...decay(100)]) === 1);
    check('a string dying away is not a pluck', pluckCount(decay(200)) === 0);
    // Plucked again while still ringing at a quarter of its first level.
    const ringing = decay(46);
    check('plucked again while ringing is a second pluck',
        pluckCount([...silence(5), ...ringing, 0.18, 0.2, ...decay(50)]) === 2, `${ringing.at(-1).toFixed(3)} before`);
    check('noise under the floor is never a pluck', pluckCount(Array.from({ length: 200 }, (_, i) => (i % 3 ? 0.0002 : 0.0015))) === 0);
    check('a slight rise is not a pluck', pluckCount([...decay(30), ...decay(30).map(l => l * 0.5)]) === 0);
}

console.log('Plucks in the sample packs');
{
    const files = (await packRecordings(36, 81)).map(r => r.file);

    const rms = (samples, from, to) => {
        let sum = 0;
        for (let i = from; i < to; i++) sum += samples[i] * samples[i];
        return Math.sqrt(sum / (to - from));
    };
    // As the tuner does: the last 1,024 samples every 15 ms, with its floor of about -55 dBFS.
    const plucksIn = (samples, rate) => {
        const detector = createPluckDetector({ floor: 0.0018 });
        const hop = Math.round(rate * 0.015);
        let count = 0;
        for (let end = 1024; end <= samples.length; end += hop) if (detector.add(rms(samples, end - 1024, end))) count++;
        return count;
    };

    let notOne = 0;
    let missed = 0;
    const odd = [];
    for (const file of new Set(files)) {
        const { samples, sampleRate } = decodeWav(await readFile(file));
        // A little quiet before it, as from a microphone, then up to four seconds of the recording.
        const lead = Math.round(0.3 * sampleRate);
        const length = Math.min(samples.length, 4 * sampleRate);
        const once = new Float32Array(lead + length);
        for (let i = 0; i < lead; i++) once[i] = 0.0005 * Math.sin(i);
        once.set(samples.subarray(0, length), lead);
        const count = plucksIn(once, sampleRate);
        if (count !== 1) {
            notOne++;
            odd.push(`${path.basename(file)}: ${count}`);
        }
        const cut = lead + sampleRate;
        if (count === 1 && once.length > cut) {
            const twice = new Float32Array(cut + length);
            twice.set(once.subarray(0, cut));
            twice.set(samples.subarray(0, length), cut);
            if (plucksIn(twice, sampleRate) !== 2) missed++;
        }
    }
    const total = new Set(files).size;
    // A few of the softest high recordings never reach the floor, and are not read at all.
    check(`one pluck in nearly every recording (${total - notOne} of ${total})`, notOne <= 5, odd.slice(0, 5).join(', '));
    check(`plucked again a second in is a second pluck (missed ${missed})`, missed <= 5);
}

console.log('Open strings from the guitar pack, read as the tuner reads them');
{
    // The steady response: nine readings smoothed over a 4,096-sample window, the sound easing 30%
    // of the way to each reading. As tunerTick in src/renderer/renderer.js does it.
    const speakRecording = (samples, rate) => {
        const speech = createTunerSpeech();
        const smoother = createPitchSmoother(9);
        const hop = Math.round(rate * 0.015);
        const said = [];
        let target = null;
        let cents = 0;
        let heardAt = -Infinity;
        for (let end = 4096; end <= Math.min(samples.length, 3 * rate); end += hop) {
            const now = 1000 * end / rate;
            const reading = detectPitch(samples.subarray(end - 4096, end), rate, { minRms: 0.0018 });
            if (!reading || reading.clarity < TUNER_MIN_CLARITY) {
                if (target && now - heardAt > 200) {
                    smoother.clear();
                    speech.restart();
                    target = null;
                }
                continue;
            }
            heardAt = now;
            const note = nearestNote(midiToFrequency(smoother.add(frequencyToMidi(reading.frequency))));
            cents = target?.midi === note.midi ? cents + 0.3 * (note.cents - cents) : note.cents;
            target = { ...note, cents };
            const text = speech.heard(target, now);
            if (text) said.push(text);
        }
        return said;
    };

    const recordings = (await packRecordings(40, 64)).filter(r => [40, 45, 50, 55, 59, 64].includes(r.key));
    let once = 0;
    const silent = [];
    const more = [];
    for (const { file, key } of recordings) {
        const { samples, sampleRate } = decodeWav(await readFile(file));
        const said = speakRecording(samples, sampleRate);
        if (said.length === 1) once++;
        else if (said.length === 0) silent.push(`${path.basename(file)} (${key})`);
        else more.push(`${path.basename(file)} (${key}): ${said.join(' | ')}`);
    }
    check(`one thing said for nearly every open string (${once} of ${recordings.length})`, silent.length <= 4,
        `nothing for ${silent.join(', ')}`);
    check('never more than one', more.length === 0, more.slice(0, 3).join('; '));
}

console.log(failures ? `${failures} FAILED` : 'All passed');
process.exit(failures ? 1 : 0);

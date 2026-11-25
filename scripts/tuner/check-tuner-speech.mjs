// Checks src/shared/tunerSpeech.mjs: what the tuner says as a string is tuned, and when, and how
// it tells a new pluck. Readings are fed in by hand with their times; nothing is listened to.
//
// 1. Joel's example: E2 10 cents flat named in full, then 7, 4, 2 as numbers, in tune, then
//    3 cents sharp once it goes past.
// 2. Nothing said faster than the gap, nothing said before a note has held, a reading between
//    two whole cents does not alternate, and in tune is not said again while it stays in tune.
// 3. A different note, a silence and a new pluck all start over with the full reading.
// 4. String mode names the string.
// 5. The pluck detector: a jump up is a pluck, a dying string is not, nor noise under the floor,
//    and one pluck is counted once.
// 6. The pluck detector on every recording in the guitar and bass sample packs from C2 to A5,
//    read every 15 ms as the tuner reads: each is one pluck, and the same recording started again
//    a second in, while the first still rings, is a second one.
// 7. The settled style: nothing during a pluck's sharp start, then the middle of the readings
//    once, then nothing for wobble and drift under 4 cents, and a real change said once it has
//    held. And in tune within 3 cents as well as 2.
// 8. Every open-string recording from the guitar pack, from low E to high E, read the way the
//    tuner reads, with the medium response: in the settled style no more than two things said in
//    three seconds, and in all less than half what the every style says. Many low E recordings
//    keep sliding flat for two seconds, by 5 to 7 cents, and get a second reading for it.
//
//   node scripts/tuner/check-tuner-speech.mjs

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createTunerSpeech, createPluckDetector, tuneSide } from '../../src/shared/tunerSpeech.mjs';
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

console.log('Joel\'s example');
{
    const speech = createTunerSpeech({ speakAfterMs: 200, gapMs: 700 });
    // Held at each value long enough to be said: 10 flat, 7, 4, 2 (in tune), 3 sharp.
    const steps = [-10, -7, -4, -1.6, 3];
    const said = run(speech, { ms: 5 * 800 - 15, cents: t => steps[Math.floor(t / 800)] });
    const expected = ['E2, 10 cents flat', '7', '4', 'in tune', '3 cents sharp'];
    check('E2, 10 cents flat; 7; 4; in tune; 3 cents sharp', same(words(said), expected), words(said).join(' | '));
    check('the first words wait for the note to hold 200 ms', said[0]?.t >= 200 && said[0]?.t < 230, `${said[0]?.t} ms`);
}

console.log('Pace');
{
    const speech = createTunerSpeech({ speakAfterMs: 200, gapMs: 700 });
    // Sweeping from 20 flat to 5 flat over 3 seconds: a number at most every 700 ms.
    const said = run(speech, { ms: 3000, cents: t => -20 + 15 * t / 3000 });
    const gaps = said.slice(1).map((s, i) => s.t - said[i].t);
    check('nothing said within 700 ms of the last', gaps.every(g => g >= 700), gaps.join(', '));
    check('the sweep is said as numbers after the first', said.length >= 4 && said.slice(1).every(s => /^\d+$/.test(s.words)),
        words(said).join(' | '));
    check('the last number said is near where it ended', Number(said.at(-1).words) <= 8, said.at(-1).words);

    const quick = createTunerSpeech({ speakAfterMs: 200, gapMs: 400 });
    const quickSaid = run(quick, { ms: 3000, cents: t => -20 + 15 * t / 3000 });
    check('a shorter gap says more', quickSaid.length > said.length, `${quickSaid.length} against ${said.length}`);
}

console.log('Steadiness');
{
    const speech = createTunerSpeech({ speakAfterMs: 200, gapMs: 400 });
    // Wavering between 4.4 and 4.6 flat: 4 then never 5, since it is never 0.75 from 4.
    const said = run(speech, { ms: 4000, cents: t => (Math.floor(t / 100) % 2 ? -4.6 : -4.4) });
    check('a reading between two cents is said once', same(words(said), ['E2, 4 cents flat']), words(said).join(' | '));

    const steady = createTunerSpeech({ speakAfterMs: 200, gapMs: 400 });
    const steadySaid = run(steady, { ms: 3000, cents: () => -12 });
    check('a steady reading is said once', same(words(steadySaid), ['E2, 12 cents flat']), words(steadySaid).join(' | '));

    // In tune, wandering inside 2.75 cents: in tune once, not again, and nothing else.
    const tuned = createTunerSpeech({ speakAfterMs: 200, gapMs: 400 });
    const tunedSaid = run(tuned, { ms: 4000, cents: t => 2.6 * Math.sin(t / 300) });
    check('in tune is said once while it stays within 2.75 cents', same(words(tunedSaid), ['E2, in tune']),
        words(tunedSaid).join(' | '));

    check('out of tune past 2 cents, back out of tune only past 2.75',
        tuneSide(2.5) === 1 && tuneSide(2.5, 0) === 0 && tuneSide(-2.8, 0) === -1 && tuneSide(-2, -1) === 0);
}

console.log('Starting over');
{
    const speech = createTunerSpeech({ speakAfterMs: 200, gapMs: 700 });
    const first = run(speech, { ms: 1000, cents: () => -30 });
    // Gone past E2 to F2, 45 cents flat of it... read as F2.
    const second = run(speech, { from: 1015, ms: 1000, midi: 41, cents: () => -45 });
    check('a different note is named in full', same(words(second), ['F2, 45 cents flat']), words(second).join(' | '));
    check('and only after it has held 200 ms', second[0]?.t - 1015 >= 200, `${second[0]?.t - 1015} ms`);
    check('before it, E2 was named once', same(words(first), ['E2, 30 cents flat']), words(first).join(' | '));

    // A flicker to the next note for one reading does not name it.
    const flicker = createTunerSpeech({ speakAfterMs: 200, gapMs: 400 });
    const flickerSaid = run(flicker, { ms: 2000, midi: A2, cents: () => -20 });
    flicker.heard({ midi: A2 + 1, cents: -48 }, 2015);
    const after = run(flicker, { from: 2030, ms: 1000, midi: A2, cents: () => -20 });
    check('one reading of another note says nothing', same(words(flickerSaid), ['A2, 20 cents flat']) && after.length === 0,
        [...words(flickerSaid), ...words(after)].join(' | '));

    // The same string, plucked again after a silence or while still ringing: restart, then full.
    const again = createTunerSpeech({ speakAfterMs: 200, gapMs: 700 });
    run(again, { ms: 1500, cents: () => -6 });
    again.restart();
    const replucked = run(again, { from: 1600, ms: 500, cents: () => -6 });
    check('after a restart the same note is named in full', same(words(replucked), ['E2, 6 cents flat']),
        words(replucked).join(' | '));
    check('and without waiting out the gap', replucked[0]?.t - 1600 < 230, `${replucked[0]?.t - 1600} ms`);
}

console.log('String mode');
{
    const speech = createTunerSpeech({ speakAfterMs: 200, gapMs: 700 });
    const said = run(speech, { ms: 1800, midi: A2, string: 5, cents: t => (t < 900 ? -12 : -8) });
    check('names the string, then the number', same(words(said), ['string 5, A2, 12 cents flat', '8']), words(said).join(' | '));
}

console.log('Settled');
{
    const settled = (options = {}) => createTunerSpeech({ style: 'settled', gapMs: 700, ...options });
    // A hard pluck on a low E: 12 sharp, falling to 4.5 flat over 0.3 s, then wobbling by
    // 2 cents and drifting 3 cents flatter over the next 2.5 seconds.
    const pluck = t => (t < 300 ? 12 - 16.5 * t / 300 : -4.5 - 3 * (t - 300) / 2500 + 1 * Math.sin(t / 40));
    const speech = settled();
    const said = run(speech, { ms: 2800, cents: pluck });
    check('a pluck that settles is said once, from the middle of the readings',
        said.length === 1 && /^E2, [45] cents flat$/.test(said[0].words),
        words(said).join(' | '));
    check('and not before half a second', said[0]?.t >= 500, `${said[0]?.t} ms`);

    // Then the peg is turned, from 7 flat up to 1 flat over a second, and held.
    const turned = run(speech, { from: 2815, ms: 2500, cents: t => (t < 1000 ? -7 + 6 * t / 1000 : -1) });
    check('turning the peg into tune says in tune, once', same(words(turned), ['in tune']), words(turned).join(' | '));

    // Turned the other way, to 9 flat: past 4 cents from 5 flat, said as a number.
    const further = settled();
    run(further, { ms: 1000, cents: () => -5 });
    const flatter = run(further, { from: 1015, ms: 1500, cents: t => (t < 300 ? -5 - 4 * t / 300 : -9.5) });
    check('moving more than 4 cents on the same side says the number', /^(9|10)$/.test(flatter[0]?.words) && flatter.length === 1,
        words(flatter).join(' | '));
    check('once it has held 0.3 seconds', flatter[0]?.t - 1015 >= 300 + 300 * 1 / 4, `${flatter[0]?.t - 1015} ms`);

    // A brief swing of 6 cents, under 0.3 seconds, says nothing.
    const swing = settled();
    run(swing, { ms: 1000, cents: () => -5 });
    const swung = run(swing, { from: 1015, ms: 1500, cents: t => (t > 200 && t < 400 ? -11 : -5) });
    check('a swing shorter than the hold says nothing', swung.length === 0, words(swung).join(' | '));

    // In tune within 3 cents.
    const three = run(settled({ inTuneCents: 3 }), { ms: 1000, cents: () => -2.6 });
    const two = run(settled({ inTuneCents: 2 }), { ms: 1000, cents: () => -2.6 });
    check('2.6 flat is in tune within 3 cents', same(words(three), ['E2, in tune']), words(three).join(' | '));
    check('and 3 cents flat within 2', same(words(two), ['E2, 3 cents flat']), words(two).join(' | '));
    const everyThree = run(createTunerSpeech({ inTuneCents: 3 }), { ms: 1000, cents: () => 2.9 });
    check('the every style takes the range too', same(words(everyThree), ['E2, in tune']), words(everyThree).join(' | '));
    check('leaving in tune within 3 needs more than 3.75',
        tuneSide(3.7, 0, 3) === 0 && tuneSide(3.8, 0, 3) === 1 && tuneSide(3.1, null, 3) === 1);
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
    // The medium response: five readings smoothed over a 2,048-sample window, the sound easing
    // half way to each reading. As tunerTick in src/renderer/renderer.js does it.
    const speakRecording = (samples, rate, style) => {
        const speech = createTunerSpeech({ style, gapMs: 700 });
        const smoother = createPitchSmoother(5);
        const hop = Math.round(rate * 0.015);
        const said = [];
        let target = null;
        let cents = 0;
        let heardAt = -Infinity;
        for (let end = 2048; end <= Math.min(samples.length, 3 * rate); end += hop) {
            const now = 1000 * end / rate;
            const reading = detectPitch(samples.subarray(end - 2048, end), rate, { minRms: 0.0018 });
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
            cents = target?.midi === note.midi ? cents + 0.5 * (note.cents - cents) : note.cents;
            target = { ...note, cents };
            const text = speech.heard(target, now);
            if (text) said.push(text);
        }
        return said;
    };

    const recordings = (await packRecordings(40, 64)).filter(r => [40, 45, 50, 55, 59, 64].includes(r.key));
    let settledOnce = 0;
    let settledMore = 0;
    let everyTotal = 0;
    let settledTotal = 0;
    const talkative = [];
    for (const { file, key } of recordings) {
        const { samples, sampleRate } = decodeWav(await readFile(file));
        const settledSaid = speakRecording(samples, sampleRate, 'settled');
        const everySaid = speakRecording(samples, sampleRate, 'every');
        settledTotal += settledSaid.length;
        everyTotal += everySaid.length;
        if (settledSaid.length === 1) settledOnce++;
        if (settledSaid.length > 2 || settledSaid.length === 0) {
            settledMore++;
            talkative.push(`${path.basename(file)} (${key}): ${settledSaid.join(' | ')}`);
        }
    }
    check(`settled: one or two things said for nearly every open string (${settledOnce} once)`,
        settledMore <= 3, talkative.slice(0, 3).join('; '));
    check(`settled says less than half what every says (${settledTotal} against ${everyTotal})`,
        settledTotal * 2 < everyTotal);
}

console.log(failures ? `${failures} FAILED` : 'All passed');
process.exit(failures ? 1 : 0);

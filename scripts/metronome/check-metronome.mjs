// Checks src/shared/metronome.mjs: which slots of each built-in strumming pattern click, with which
// sound and how strongly, the clicks in words, tempo and volume bounds, and the timing arithmetic
// for changing tempo or pattern while the metronome plays. Plain Node, no app.
//
//   node scripts/metronome/check-metronome.mjs

import {
    metronomeClicks, metronomeClickGain, formatMetronomeClicks, describeMetronomeClicks, clampMetronomeTempo,
    clampMetronomeVolume, metronomeVolumeGain, metronomeSlotTime, firstMetronomeSlotAfter, retimeMetronome,
    regridMetronome, metronomeSlotInMeasure, metronomeSlotSeconds, metronomeSwingDelay, metronomeFeelDelay,
    METRONOME_VOLUME_GAINS, METRONOME_MIN_TEMPO, METRONOME_MAX_TEMPO, METRONOME_DEFAULT_TEMPO
} from '../../src/shared/metronome.mjs';
import { DEFAULT_TEMPO, scoreTempo } from '../../src/shared/tempo.mjs';
import { patternsFor, BUILT_IN_PATTERNS, FEELS, feelNote } from '../../src/shared/strummingPatterns.mjs';

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};
const near = (a, b) => Math.abs(a - b) < 1e-9;

const clicksOf = (signature, name) => {
    const [beats, unit] = signature.split('/').map(Number);
    const pattern = patternsFor(beats, unit).find(p => p.name === name);
    return { clicks: metronomeClicks(pattern), pattern };
};

console.log('Clicks from the built-in patterns: the sound follows the stroke');
const expected = [
    ['4/4', 'Down Only', 'high-strong-down down down down'],
    ['4/4', 'Eighth-Note Downs', 'high-strong-down down down down down down down down'],
    ['4/4', 'All Down-Up', 'high-strong-down up down up down up down up'],
    ['4/4', 'Old Faithful', 'high-strong-down - down up - up down up'],
    ['4/4', 'Three-Three-Two', 'high-strong-down down down strong-down down down strong-down down'],
    ['4/4', 'Backbeat Chuck', 'high-strong-down - mute up - up mute up'],
    ['4/4', 'Reggae Offbeat', '- high-strong-up - up - up - up'],
    ['3/4', 'Oom-Pah-Pah', 'high-strong-down down down'],
    ['6/8', 'Down Only', 'high-strong-down down down down down down'],
    ['6/8', 'Accented Downs', 'high-strong-down down down strong-down down down'],
    ['12/8', 'On the Pulse', 'high-strong-down - - down - - down - - down - -']
];
for (const [signature, name, words] of expected) {
    const got = formatMetronomeClicks(clicksOf(signature, name).clicks);
    check(`${signature} ${name}: ${words}`, got === words, got);
}
let allFit = true;
for (const entry of BUILT_IN_PATTERNS) {
    const { pattern, clicks } = clicksOf(entry.timeSignature, entry.name);
    if (clicks.length !== pattern.slots.length) allFit = false;
}
check('every built-in pattern has one click or none per slot', allFit);
check('a 4/4 pattern of the player\'s own clicks too',
    formatMetronomeClicks(metronomeClicks(
        patternsFor(4, 4, [{ name: 'Mine', timeSignature: '4/4', text: 'D - D U D U D U' }]).find(p => p.own)))
        === 'high-strong-down - down up down up down up');

const offbeatAccent = formatMetronomeClicks(metronomeClicks({ slots: [
    { stroke: 'down', accent: false }, { stroke: 'down', accent: true }, { stroke: 'down', accent: false }, { stroke: 'down', accent: false }
] }));
check('beat 1 is still high when the accents fall elsewhere, though not strong', offbeatAccent === 'high-down strong-down down down',
    offbeatAccent);

console.log('The default tempo');
check('is 60', DEFAULT_TEMPO === 60 && METRONOME_DEFAULT_TEMPO === 60);
check('a score with a tempo marking on its first measure keeps it',
    scoreTempo({ masterBars: [{ tempoAutomations: [{ value: 96 }] }] }) === 96);
check('a score without one plays at 60, whatever alphaTab\'s own getter says',
    scoreTempo(Object.create({ get tempo() { return 120; } }, { masterBars: { value: [{ tempoAutomations: [] }] } })) === 60);
check('a score built by hand with a tempo field keeps it', scoreTempo({ tempo: 120, masterBars: [{}] }) === 120);

console.log('How loud each click is');
const gain = (sound, strong) => metronomeClickGain({ sound, strong });
check('a strong down is the loudest', gain('down', true) === 1);
check('a plain down is at least 7 decibels under a strong one', 20 * Math.log10(gain('down', false)) <= -7,
    `${(20 * Math.log10(gain('down', false))).toFixed(1)} dB`);
check('a strong up is louder than a plain up', gain('up', true) > gain('up', false));
check('an up is quieter than a down, strong or plain',
    gain('up', true) < gain('down', true) && gain('up', false) < gain('down', false));
check('a plain up is at least 10 decibels under a strong down', 20 * Math.log10(gain('up', false)) <= -10,
    `${(20 * Math.log10(gain('up', false))).toFixed(1)} dB`);

console.log('The clicks in words');
const oldFaithful = clicksOf('4/4', 'Old Faithful');
const words = describeMetronomeClicks(oldFaithful.clicks, 2);
check('Old Faithful', words === 'Clicks on 1 high strong down, 2 down, 2 and up, 3 and up, 4 down, 4 and up.', words);
const sixteenths = describeMetronomeClicks(metronomeClicks({ slots: [
    { stroke: 'down', accent: false }, { stroke: 'up', accent: false }, { stroke: 'mute', accent: false },
    { stroke: 'miss', accent: false }, { stroke: 'down', accent: false }
] }), 4);
check('sixteenths name e, and, a', sixteenths === 'Clicks on 1 high strong down, 1 e up, 1 and mute, 2 down.', sixteenths);

console.log('Tempo and volume bounds');
check(`tempo below ${METRONOME_MIN_TEMPO} comes up to it`, clampMetronomeTempo(5) === METRONOME_MIN_TEMPO);
check(`tempo above ${METRONOME_MAX_TEMPO} comes down to it`, clampMetronomeTempo(999) === METRONOME_MAX_TEMPO);
check('tempo is rounded', clampMetronomeTempo('92.6') === 93);
check('an empty or nonsense tempo is no tempo', clampMetronomeTempo('') === null && clampMetronomeTempo('fast') === null);
check('volume is 1 to 5', clampMetronomeVolume(0) === 1 && clampMetronomeVolume(9) === 5 && clampMetronomeVolume('3') === 3);
check('an empty volume is no volume', clampMetronomeVolume('') === null);
check('five volume gains, each louder than the last',
    METRONOME_VOLUME_GAINS.length === 5 && METRONOME_VOLUME_GAINS.every((g, i) => i === 0 || g > METRONOME_VOLUME_GAINS[i - 1]));
check('the loudest stays well under clipping', metronomeVolumeGain(5) <= 0.6, String(metronomeVolumeGain(5)));

console.log('Timing');
check('80 BPM in eighths is 0.375 seconds a slot', near(metronomeSlotSeconds(80, 2), 0.375));
const anchor = { time: 10, slot: 0, slotSeconds: 0.5 };
check('slot 3 is at 11.5', near(metronomeSlotTime(anchor, 3), 11.5));
check('the first slot after 11.2 is 3', firstMetronomeSlotAfter(anchor, 11.2) === 3);
check('a slot exactly at the time is not after it', firstMetronomeSlotAfter(anchor, 11) === 3);
const faster = retimeMetronome(anchor, 11.2, 0.25);
check('a new tempo starts on the next slot, keeping its place on the clock',
    faster.slot === 3 && near(faster.time, 11.5) && near(metronomeSlotTime(faster, 4), 11.75), JSON.stringify(faster));

const eighths = { slotsPerBeat: 2, slotsPerMeasure: 8 };
const sixteenthGrid = { slotsPerBeat: 4, slotsPerMeasure: 16 };
const playing = { time: 10, slot: 0, slotSeconds: 0.25 };
const same = regridMetronome(playing, 10.6, eighths, sixteenthGrid, 0.125, { sameSignature: true });
check('a new pattern starts on the next beat, in the same place in the measure',
    near(same.time, 11) && metronomeSlotInMeasure(same.slot, 16) === 8, JSON.stringify(same));
const other = regridMetronome(playing, 10.6, eighths, { slotsPerBeat: 1, slotsPerMeasure: 3 }, 0.5, { sameSignature: false });
check('a new time signature starts a new measure on the next beat', near(other.time, 11) && other.slot === 0, JSON.stringify(other));
const late = regridMetronome({ time: 10, slot: 0, slotSeconds: 0.25 }, 11.9, eighths, eighths, 0.25, { sameSignature: true });
check('the place in the measure wraps round', near(late.time, 12) && metronomeSlotInMeasure(late.slot, 8) === 0, JSON.stringify(late));

// The Feel list, in place of Swing since 2026-11-12 (docs/one-player.md, decision 18). A slot is
// 0.5 s on an eighth grid at 60 BPM in 4/4, and 0.25 s on a sixteenth grid.
console.log('\nFeels');
const feelEighths = { slotsPerBeat: 2, beatUnit: 4 };
const feelSixteenths = { slotsPerBeat: 4, beatUnit: 4 };
const feelSixEight = { slotsPerBeat: 2, beatUnit: 8 };
const feelDelaysAt = (grid, feel, slotSeconds) => [0, 1, 2, 3].map(slot => Math.round(metronomeFeelDelay(slot, grid, slotSeconds, feel) * 1000) / 1000);
check('straight moves nothing', feelDelaysAt(feelEighths, null, 0.5).every(d => d === 0));
check('triplet eighths moves each and as Swing did, a third of a slot late',
    [0, 1, 2, 3].every(slot => near(metronomeFeelDelay(slot, feelEighths, 0.5, 'triplet8th'), metronomeSwingDelay(slot, 2, 0.5))));
const feelDelays8 = { triplet8th: 0.167, dotted8th: 0.25, scottish8th: -0.25 };
for (const [feel, delay] of Object.entries(feelDelays8)) {
    check(`${feel} moves each and ${delay} s at 60 BPM, and no beat`, feelDelaysAt(feelEighths, feel, 0.5).join() === `0,${delay},0,${delay}`,
        feelDelaysAt(feelEighths, feel, 0.5).join());
}
const feelDelays16 = { triplet16th: 0.083, dotted16th: 0.125, scottish16th: -0.125 };
for (const [feel, delay] of Object.entries(feelDelays16)) {
    check(`${feel} moves every second sixteenth ${delay} s`, feelDelaysAt(feelSixteenths, feel, 0.25).join() === `0,${delay},0,${delay}`,
        feelDelaysAt(feelSixteenths, feel, 0.25).join());
    check(`${feel} does the same in 6/8 sixteenths`, feelDelaysAt(feelSixEight, feel, 0.25).join() === `0,${delay},0,${delay}`,
        feelDelaysAt(feelSixEight, feel, 0.25).join());
}
check('an eighth feel over sixteenths moves nothing', FEELS.filter(f => f.pairs === 8).every(f => feelDelaysAt(feelSixteenths, f.id, 0.25).every(d => d === 0)));
check('nor in 6/8', FEELS.filter(f => f.pairs === 8).every(f => feelDelaysAt({ slotsPerBeat: 1, beatUnit: 8 }, f.id, 0.5).every(d => d === 0)));
check('a sixteenth feel over eighths moves nothing', FEELS.filter(f => f.pairs === 16).every(f => feelDelaysAt(feelEighths, f.id, 0.5).every(d => d === 0)));
check('the note says when a feel has no effect', feelNote('dotted8th', 6, 8, 1) === 'This feel has no effect in 6/8.' &&
    feelNote('triplet8th', 4, 4, 4) === 'This feel has no effect on a pattern in sixteenths.' &&
    feelNote('scottish16th', 4, 4, 2) === 'This feel has no effect on a pattern with no sixteenths.' &&
    feelNote('triplet8th', 4, 4, 2) === '' && feelNote(null, 6, 8, 1) === '');

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exitCode = failures === 0 ? 0 : 1;

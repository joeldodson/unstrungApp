// Checks src/shared/metronome.mjs: which slots of each built-in strumming pattern click and how
// loud, the clicks in words, tempo and volume bounds, and the timing arithmetic for changing tempo
// or pattern while the metronome plays. Plain Node, no app.
//
//   node scripts/metronome/check-metronome.mjs

import {
    metronomeLevels, formatMetronomeLevels, describeMetronomeClicks, clampMetronomeTempo, clampMetronomeVolume,
    metronomeVolumeGain, metronomeSlotTime, firstMetronomeSlotAfter, retimeMetronome, regridMetronome,
    metronomeSlotInMeasure, metronomeSlotSeconds, isCompoundTime,
    METRONOME_VOLUME_GAINS, METRONOME_MIN_TEMPO, METRONOME_MAX_TEMPO
} from '../../src/shared/metronome.mjs';
import { patternsFor, BUILT_IN_PATTERNS } from '../../src/shared/strummingPatterns.mjs';

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};
const near = (a, b) => Math.abs(a - b) < 1e-9;

const levelsOf = (signature, name) => {
    const [beats, unit] = signature.split('/').map(Number);
    const pattern = patternsFor(beats, unit).find(p => p.name === name);
    return { levels: formatMetronomeLevels(metronomeLevels(pattern, beats, unit)), pattern };
};

console.log('Click levels from the built-in patterns');
const expected = [
    ['4/4', 'Down Only', '3 2 2 2'],
    ['4/4', 'All Down-Up', '3 1 2 1 2 1 2 1'],
    ['4/4', 'Old Faithful', '3 0 2 1 0 1 2 1'],
    ['4/4', 'Three-Three-Two', '3 1 1 3 1 1 3 1'],
    ['4/4', 'Backbeat Chuck', '3 0 2 1 0 1 2 1'],
    ['4/4', 'Reggae Offbeat', '0 1 0 1 0 1 0 1'],
    ['3/4', 'Down Only', '3 2 2'],
    ['3/4', 'Oom-Pah-Pah', '3 1 1'],
    ['6/8', 'Down Only', '3 1 1 2 1 1'],
    ['6/8', 'Accented Downs', '3 1 1 3 1 1'],
    ['6/8', 'On the Pulse', '3 0 0 2 0 0'],
    ['12/8', 'On the Pulse', '3 0 0 2 0 0 2 0 0 2 0 0'],
    ['2/4', 'Down, Down-Up', '3 0 2 1']
];
for (const [signature, name, levels] of expected) {
    const got = levelsOf(signature, name).levels;
    check(`${signature} ${name}: ${levels}`, got === levels, got);
}
let allFit = true;
for (const entry of BUILT_IN_PATTERNS) {
    const { pattern, levels } = levelsOf(entry.timeSignature, entry.name);
    if (levels.split(' ').length !== pattern.slots.length) allFit = false;
}
check('every built-in pattern has one level per slot', allFit);
check('a 4/4 pattern of the player\'s own clicks too',
    formatMetronomeLevels(metronomeLevels(
        patternsFor(4, 4, [{ name: 'Mine', timeSignature: '4/4', text: 'D - D U D U D U' }]).find(p => p.own), 4, 4))
        === '3 0 2 1 2 1 2 1');
check('6/8 and 12/8 are compound, 3/4 and 3/8 are not',
    isCompoundTime(6, 8) && isCompoundTime(12, 8) && !isCompoundTime(3, 4) && !isCompoundTime(3, 8));

console.log('The clicks in words');
const oldFaithful = levelsOf('4/4', 'Old Faithful');
const words = describeMetronomeClicks(metronomeLevels(oldFaithful.pattern, 4, 4), 2);
check('Old Faithful', words === 'Clicks on 1 strong, 2, 2 and soft, 3 and soft, 4, 4 and soft.', words);
const sixteenths = describeMetronomeClicks([3, 1, 1, 1, 2, 0, 0, 0], 4);
check('sixteenths name e, and, a', sixteenths === 'Clicks on 1 strong, 1 e soft, 1 and soft, 1 a soft, 2.', sixteenths);

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

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exitCode = failures === 0 ? 0 : 1;

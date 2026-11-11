// Checks the metronome's beats and the count-in for a measure shorter than its time signature,
// above all a pickup. See `buildBarMap` and `countInClicks` in src/shared/audioTrack.mjs.
//
// Until 2026-11-11 every bar clicked its whole time signature, so a two-beat pickup in 4/4 clicked
// four times and its last two clicks landed on the next measure's first two; the count-in clicked
// four times in two beats' space and ran into the music. Finding 4 of the November review.
//
// The first part builds scores by hand and needs no song files. Given folders, it then reads every
// Guitar Pro file under them and checks that no click falls outside its own bar.
//
//   node scripts/songs/check-pickup-clicks.mjs [folder ...]

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildAudioTrack, countInClicks } from '../../src/shared/audioTrack.mjs';

const root = path.join(import.meta.dirname, '..', '..');

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${condition ? '' : `  -- ${detail}`}`);
};
const round = seconds => Math.round(seconds * 1000) / 1000;
const list = values => values.map(round).join(' ');

// --- Scores built by hand, at 60 beats a minute so a beat is a second ------------------------------

/** A 4/4 score whose first bar lasts `firstTicks`, marked as a pickup or not, then two full bars. */
function scoreWith(firstTicks, { pickup = true } = {}) {
    const lengths = [firstTicks, 3840, 3840];
    let start = 0;
    const masterBars = lengths.map((ticks, index) => {
        const bar = {
            index, start, timeSignatureNumerator: 4, timeSignatureDenominator: 4,
            isAnacrusis: index === 0 && pickup, calculateDuration: () => ticks
        };
        start += ticks;
        return bar;
    });
    const note = { string: 1, fret: 0, realValue: 40, isStringed: true, isDead: false, isTieDestination: false, dynamics: 4 };
    const bars = masterBars.map(masterBar => ({
        index: masterBar.index, masterBar,
        voices: [{ beats: [{ isRest: false, notes: [note], playbackStart: 0, playbackDuration: 960, brushType: 0, pickStroke: 0 }] }]
    }));
    return { tempo: 60, masterBars, tracks: [{ name: 'Guitar', staves: [{ tuning: [64, 59, 55, 50, 45, 40], bars }] }] };
}

console.log('A two-beat pickup in 4/4');
{
    const { bars } = buildAudioTrack(scoreWith(1920), 0);
    check('it clicks twice, on its own two beats', list(bars[0].beats) === '0 1', list(bars[0].beats));
    check('they are beats 3 and 4, so neither is accented', bars[0].firstBeat === 2, String(bars[0].firstBeat));
    check('the next measure starts at 2 seconds with its own four', list(bars[1].beats) === '2 3 4 5', list(bars[1].beats));

    const countIn = countInClicks(bars[0]);
    check('the count-in is 1 2 3 4 1 2: six clicks over six seconds', countIn.clicks.length === 6 && round(countIn.seconds) === 6,
        `${countIn.clicks.length} clicks, ${countIn.seconds} seconds`);
    check('a second apart, from the start', list(countIn.clicks.map(c => c.offset)) === '0 1 2 3 4 5',
        list(countIn.clicks.map(c => c.offset)));
    check('accented on each 1', countIn.clicks.map(c => (c.accent ? 'A' : '-')).join('') === 'A---A-',
        countIn.clicks.map(c => (c.accent ? 'A' : '-')).join(''));
    const shortened = countInClicks(bars[0], 2);
    check('shortened to two, it is the 1 2 just before the pickup', shortened.clicks.length === 2 && round(shortened.seconds) === 2
        && shortened.clicks[0].accent, JSON.stringify(shortened));
}

console.log('\nA pickup of a beat and a half');
{
    const { bars } = buildAudioTrack(scoreWith(1440), 0);
    check('it clicks once, on beat 4, half a beat in', list(bars[0].beats) === '0.5' && bars[0].firstBeat === 3,
        `${list(bars[0].beats)} from beat ${bars[0].firstBeat}`);
    check('the next measure starts at 1.5 seconds', round(bars[1].beats[0]) === 1.5, list(bars[1].beats));

    const countIn = countInClicks(bars[0]);
    check('the count-in is 1 2 3 4 1 2 3, the music on the and of 3', countIn.clicks.length === 7 && round(countIn.seconds) === 6.5,
        `${countIn.clicks.length} clicks, ${countIn.seconds} seconds`);
}

console.log('\nA short bar that is not a pickup');
{
    const { bars } = buildAudioTrack(scoreWith(1920, { pickup: false }), 0);
    check('it is counted from its start: beats 1 and 2', list(bars[0].beats) === '0 1' && bars[0].firstBeat === 0,
        `${list(bars[0].beats)} from beat ${bars[0].firstBeat}`);
    const countIn = countInClicks(bars[0]);
    check('its count-in is one whole measure', countIn.clicks.length === 4 && round(countIn.seconds) === 4,
        `${countIn.clicks.length} clicks, ${countIn.seconds} seconds`);
}

console.log('\nA full measure');
{
    const { bars } = buildAudioTrack(scoreWith(1920), 0);
    const countIn = countInClicks(bars[1]);
    check('is counted in with one measure of four', list(countIn.clicks.map(c => c.offset)) === '0 1 2 3' && round(countIn.seconds) === 4,
        `${list(countIn.clicks.map(c => c.offset))} over ${countIn.seconds}`);
    const last = countInClicks(bars[1], 1);
    check('shortened to one, a single click a beat before', last.clicks.length === 1 && round(last.seconds) === 1 && !last.clicks[0].accent,
        JSON.stringify(last));
}

// --- Song files ----------------------------------------------------------------------------------

const folders = process.argv.slice(2);
if (folders.length > 0) {
    const alphaTab = await import(pathToFileURL(path.join(root, 'node_modules', '@coderline', 'alphatab', 'dist', 'alphaTab.mjs')).href);
    const walk = (dir, out = []) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full, out);
            else if (/\.(gp|gp3|gp4|gp5|gpx)$/i.test(entry.name)) out.push(full);
        }
        return out;
    };
    const files = folders.flatMap(folder => walk(folder));
    console.log(`\nSong files: ${files.length}`);

    let pickups = 0, outside = 0;
    for (const file of files) {
        const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(fs.readFileSync(file)));
        const { bars } = buildAudioTrack(score, 0);
        pickups += bars.filter(bar => bar.pickup).length;
        for (const bar of bars) {
            outside += bar.beats.filter(at => at < bar.startSeconds - 1e-6 || at >= bar.endSeconds - 1e-6).length;
        }
    }
    console.log(`  pickups: ${pickups}`);
    check('every click falls inside its own bar', outside === 0, `${outside} do not`);
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exitCode = failures === 0 ? 0 : 1;

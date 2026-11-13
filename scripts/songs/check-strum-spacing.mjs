// Checks that the audio track spaces a strum's strings by the strum spacing setting, and that a
// file's own brush speed still wins over it.
//
// One setting since 2026-11-12, "Time between strings in a strum, in milliseconds", 0 to 50 with a
// default of 20 (docs/one-player.md, decision 14). buildAudioTrack in src/shared/audioTrack.mjs
// takes it as strumSpacingSeconds. scripts/settings/verify-strum-spacing.mjs checks the field and
// the other strums in the running app.
//
//   node scripts/songs/check-strum-spacing.mjs

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
    buildAudioTrack, clampStrumSpacingMs, DEFAULT_STRUM_SPACING_MS, DEFAULT_STRUM_SPACING_SECONDS
} from '../../src/shared/audioTrack.mjs';

const root = path.join(import.meta.dirname, '..', '..');
const alphaTab = await import(pathToFileURL(path.join(root, 'node_modules', '@coderline', 'alphatab', 'dist', 'alphaTab.mjs')).href);

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${condition ? '' : `  -- ${detail}`}`);
};

function scoreFromTex(text) {
    const importer = new alphaTab.importer.AlphaTexImporter();
    importer.initFromString(text, new alphaTab.Settings());
    return importer.readScore();
}

// A G chord on beat 1, an upstroke on beat 2, and on beat 3 the same G with a brush the file times.
const score = scoreFromTex([
    '\\tempo 60',
    '(3.6 2.5 0.4 0.3 0.2 3.1).4 (3.6 2.5 0.4 0.3 0.2 3.1).4 {su} (3.6 2.5 0.4 0.3 0.2 3.1).4 r.4 |'
].join('\n'));
const brushed = score.tracks[0].staves[0].bars[0].voices[0].beats[2];
// alphaTex has no way to write a brush's duration, which Guitar Pro 8 files carry, so it is set here
// as the Guitar Pro importer would: a brush down across the whole sweep, 120 ticks.
brushed.brushType = 2;
brushed.brushDuration = 120;

/** The gaps between each string of a beat and the next, in milliseconds, in the order they sound. */
function gaps(track, beatStart) {
    const notes = track.notes.filter(n => Math.abs(n.startSeconds - beatStart) < 0.3)
        .sort((a, b) => a.startSeconds - b.startSeconds);
    return notes.slice(1).map((note, index) => Math.round((note.startSeconds - notes[index].startSeconds) * 10000) / 10);
}
const all = (list, value) => list.length > 0 && list.every(gap => gap === value);

console.log('The default');
const byDefault = buildAudioTrack(score, 0);
check('the default is 20 ms', DEFAULT_STRUM_SPACING_MS === 20 && DEFAULT_STRUM_SPACING_SECONDS === 0.02);
check('a downstroke is spaced 20 ms a string', all(gaps(byDefault, 0), 20), gaps(byDefault, 0).join(', '));
check('so is an upstroke', all(gaps(byDefault, 1), 20), gaps(byDefault, 1).join(', '));

console.log('\nThe setting');
for (const ms of [0, 1, 35, 50]) {
    const track = buildAudioTrack(score, 0, { strumSpacingSeconds: ms / 1000 });
    check(`${ms} ms spaces a downstroke ${ms} ms a string`, all(gaps(track, 0), ms), gaps(track, 0).join(', '));
    check(`and an upstroke`, all(gaps(track, 1), ms), gaps(track, 1).join(', '));
}
const slow = buildAudioTrack(score, 0, { strumSpacingSeconds: 0.035 });
check('the beats themselves do not move', slow.notes.filter(n => n.indexInBeat === 0)
    .map(n => n.startSeconds).join() === byDefault.notes.filter(n => n.indexInBeat === 0).map(n => n.startSeconds).join());

console.log('\nA brush the file times');
// 120 ticks over five gaps is 24 ticks a gap, at 60 BPM 25 ms.
for (const ms of [0, 20, 50]) {
    const track = buildAudioTrack(score, 0, { strumSpacingSeconds: ms / 1000 });
    check(`keeps its own speed with the setting at ${ms} ms`, all(gaps(track, 2), 25), gaps(track, 2).join(', '));
}

console.log('\nWhat is stored');
check('a whole number in range is kept', clampStrumSpacingMs(35) === 35 && clampStrumSpacingMs('7') === 7);
check('the ends are kept', clampStrumSpacingMs(0) === 0 && clampStrumSpacingMs(50) === 50);
check('beyond them is held to them', clampStrumSpacingMs(80) === 50 && clampStrumSpacingMs(-3) === 0);
check('a fraction is rounded', clampStrumSpacingMs(12.6) === 13);
check('anything else is the default', [undefined, null, '', ' ', 'fast', NaN].every(v => clampStrumSpacingMs(v) === 20));

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exitCode = failures === 0 ? 0 : 1;

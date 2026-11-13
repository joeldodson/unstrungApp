// Checks that a dead note damps its string in the audio track: it sounds nothing, but whatever that
// string was ringing stops where the dead note falls in the sweep, and strings it does not touch
// ring on. Until 2026-11-12 dead notes were skipped outright, so a muted strum let the chord before
// it ring straight through. docs/one-player.md, decision 13; rule 4 in src/shared/audioTrack.mjs.
//
// Builds its scores from alphaTex, so it needs no song files.
//
//   node scripts/songs/check-dead-notes.mjs

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildAudioTrack, resolveRingLengths, ringLengthsInRange } from '../../src/shared/audioTrack.mjs';

const root = path.join(import.meta.dirname, '..', '..');
const alphaTab = await import(pathToFileURL(path.join(root, 'node_modules', '@coderline', 'alphatab', 'dist', 'alphaTab.mjs')).href);

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${condition ? '' : `  -- ${detail}`}`);
};

/** One guitar track from alphaTex, at 60 beats a minute so a quarter note is a second. */
function trackOf(bars) {
    const importer = new alphaTab.importer.AlphaTexImporter();
    importer.initFromString(`\\tempo 60\n${bars.join(' |\n')} |`, new alphaTab.Settings());
    const track = buildAudioTrack(importer.readScore(), 0);
    resolveRingLengths(track.notes, track.stops);
    return track;
}
const G = '(3.6 2.5 0.4 0.3 0.2 3.1)';
const CHUCK = '(x.6 x.5 x.4 x.3 x.2 x.1)';
const ms = seconds => seconds === null ? 'null' : `${Math.round(seconds * 1000)}`;
const rings = notes => notes.map(n => `${n.string}:${ms(n.ringSeconds ?? n.ringFinal)}`).join(' ');

console.log('A chuck after a strum');
let track = trackOf([`${G}.4 ${CHUCK}.4 r.2`]);
check('sounds only the strum', track.notes.length === 6, `${track.notes.length} notes`);
check('counts the dead notes', track.skipped.deadNotes === 6 && track.stops.length === 6,
    `${track.skipped.deadNotes} counted, ${track.stops.length} stops`);
// Both are downstrokes, swept 20 ms a string from string 6, so each string is damped a second
// after it was struck.
check('damps every string a second after it was struck', track.notes.every(n => Math.abs(n.ringSeconds - 1) < 1e-6),
    rings(track.notes));
check('each stop falls at its string\'s place in the sweep', track.stops.every(stop =>
    Math.abs(stop.startSeconds - (1 + (6 - stop.string) * 0.02)) < 1e-6),
    track.stops.map(s => `${s.string}@${ms(s.startSeconds)}`).join(' '));

console.log('\nAn upstroke chuck');
track = trackOf([`${G}.4 ${CHUCK}.4 {su} r.2`]);
check('damps the highest string first', track.stops[0].string === 1 && Math.abs(track.stops[0].startSeconds - 1) < 1e-6,
    track.stops.map(s => `${s.string}@${ms(s.startSeconds)}`).join(' '));
const string6 = track.notes.find(n => n.string === 6);
check('and string 6 last, 100 ms into the sweep', Math.abs(string6.ringSeconds - 1.1) < 1e-6, ms(string6.ringSeconds));

console.log('\nDamping some strings');
track = trackOf([`${G}.4 (x.2 x.1).4 r.2`]);
const damped = track.notes.filter(n => n.string <= 2);
const untouched = track.notes.filter(n => n.string >= 3);
check('stops the strings it damps', damped.every(n => n.ringSeconds !== null && n.ringSeconds > 0.9 && n.ringSeconds < 1.1),
    rings(damped));
check('leaves the others ringing', untouched.every(n => n.ringSeconds === null), rings(untouched));

console.log('\nA strike after a dead note');
track = trackOf([`${G}.4 ${CHUCK}.4 ${G}.4 r.4`]);
const second = track.notes.filter(n => n.startSeconds >= 2);
check('strikes again as usual', second.length === 6 && second.every(n => n.ringSeconds === null), rings(second));
check('and the first strum still stops at the chuck', track.notes.filter(n => n.startSeconds < 1)
    .every(n => Math.abs(n.ringSeconds - 1) < 1e-6), rings(track.notes.filter(n => n.startSeconds < 1)));

console.log('\nWithout dead notes');
track = trackOf([`${G}.4 ${G}.4 r.2`]);
check('a strum still rings until the next', track.notes.filter(n => n.startSeconds < 1)
    .every(n => Math.abs(n.ringSeconds - 1) < 1e-6) && track.stops.length === 0,
    rings(track.notes.filter(n => n.startSeconds < 1)));

console.log('\nA selection played on its own or repeated');
// Measure 1 opens with a chuck and strums on beat 2; measure 2 strums on beat 1 and is damped on 3.
track = trackOf([`${CHUCK}.4 ${G}.4 r.2`, `${G}.4 r.4 ${CHUCK}.4 r.4`]);
const measure1 = { startSeconds: 0, endSeconds: 4 };
let notes = ringLengthsInRange(track, measure1);
check('rings out on the last time through, nothing damping it after', notes.every(n => n.ringFinal === null),
    notes.map(n => ms(n.ringFinal)).join(' '));
// Repeating, each string is damped by the chuck at the top of the next time through, at its own
// place in the sweep: three seconds after it was struck.
check('is damped by the chuck at the top when it repeats', notes.every(n => Math.abs(n.ringLoop - 3) < 1e-6),
    notes.map(n => ms(n.ringLoop)).join(' '));

const measure2 = { startSeconds: 4, endSeconds: 8 };
notes = ringLengthsInRange(track, measure2);
check('is damped within the selection either way', notes.every(n => Math.abs(n.ringFinal - 2) < 1e-6 &&
    Math.abs(n.ringLoop - 2) < 1e-6), notes.map(n => `${ms(n.ringFinal)}/${ms(n.ringLoop)}`).join(' '));

const both = ringLengthsInRange(track, { startSeconds: 0, endSeconds: 8 });
const firstStrum = both.filter(n => n.startSeconds < 4);
check('across both, the first strum rings until the second', firstStrum.every(n => Math.abs(n.ringFinal - 3) < 1e-6),
    firstStrum.map(n => ms(n.ringFinal)).join(' '));

notes = ringLengthsInRange(track, { startSeconds: 4, endSeconds: 6 });
check('a dead note outside the selection damps nothing in it', notes.every(n => n.ringFinal === null),
    notes.map(n => ms(n.ringFinal)).join(' '));

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exitCode = failures === 0 ? 0 : 1;

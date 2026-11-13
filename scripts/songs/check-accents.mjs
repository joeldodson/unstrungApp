// Checks that the audio track plays accents: an accented note at ACCENT_LEVEL, 1.5 times the level
// of an unaccented one, a heavy accent at HEAVY_ACCENT_LEVEL, and nothing else softened or raised.
// Until 2026-11-12 accents were ignored. docs/one-player.md, decision 10; rule 7 in
// src/shared/audioTrack.mjs. scripts/songs/verify-accents.mjs checks the levels the app plays.
//
// Builds its scores from alphaTex, so it needs no song files.
//
//   node scripts/songs/check-accents.mjs

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildAudioTrack, ACCENT_LEVEL, HEAVY_ACCENT_LEVEL } from '../../src/shared/audioTrack.mjs';
import { songFromProgression, songToAlphaTex } from '../../src/shared/songScore.mjs';
import { parseStrummingPattern } from '../../src/shared/strummingPatterns.mjs';

const root = path.join(import.meta.dirname, '..', '..');
const alphaTab = await import(pathToFileURL(path.join(root, 'node_modules', '@coderline', 'alphatab', 'dist', 'alphaTab.mjs')).href);

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${condition ? '' : `  -- ${detail}`}`);
};

function trackFromTex(text) {
    const importer = new alphaTab.importer.AlphaTexImporter();
    importer.initFromString(text, new alphaTab.Settings());
    return buildAudioTrack(importer.readScore(), 0);
}
/** The levels of the notes struck on each beat, at 60 beats a minute, as "1 1.5 ..." per beat. */
const levelsByBeat = track => {
    const beats = new Map();
    for (const note of track.notes) {
        const beat = Math.round(note.startSeconds);
        if (!beats.has(beat)) beats.set(beat, new Set());
        beats.get(beat).add(note.level);
    }
    return [...beats.values()].map(set => [...set].join('/'));
};

console.log('The levels');
check('an accent is 1.5 times, a heavy accent louder again', ACCENT_LEVEL === 1.5 && HEAVY_ACCENT_LEVEL > ACCENT_LEVEL,
    `${ACCENT_LEVEL}, ${HEAVY_ACCENT_LEVEL}`);

console.log('\nA measure of plain, accented and heavily accented strums');
const G = fx => `(3.6${fx} 2.5${fx} 0.4${fx} 0.3${fx} 0.2${fx} 3.1${fx})`;
let track = trackFromTex(`\\tempo 60\n${G('')}.4 ${G('{ac}')}.4 ${G('{hac}')}.4 ${G('')}.4 |`);
let levels = levelsByBeat(track);
check('plays them at 1, 1.5, the heavy level and 1', levels.join(' ') === `1 1.5 ${HEAVY_ACCENT_LEVEL} 1`, levels.join(' '));
// alphaTab reads an alphaTex note with no dynamic as f, so all of these are in the f layer, accented or not.
check('keeps every note in the same recording layer', new Set(track.notes.map(n => n.velocity)).size === 1,
    [...new Set(track.notes.map(n => n.velocity))].join(' '));

console.log('\nAn accent with a dynamic');
track = trackFromTex(`\\tempo 60\n${G('{dy ff}')}.4 ${G('{ac dy ff}')}.4 r.2 |`);
levels = levelsByBeat(track);
check('takes its layer from the dynamic and its level from the accent',
    levels.join(' ') === '1 1.5' && track.notes.every(n => n.velocity === 'f'),
    `${levels.join(' ')}, ${[...new Set(track.notes.map(n => n.velocity))].join(' ')}`);

console.log('\nOne accented string');
track = trackFromTex(`\\tempo 60\n(3.6{ac} 2.5 0.4 0.3 0.2 3.1).4 r.2. |`);
const accented = track.notes.filter(n => n.level === ACCENT_LEVEL).map(n => n.string);
check('raises that string alone', accented.join() === '6', accented.join());

console.log('\nA saved progression');
// The writer marks a pattern's accented strokes with {ac} on each note; > in a pattern is an accent.
const pattern = { slotsPerBeat: 2, slots: parseStrummingPattern('>D - D U - U D U').slots };
const song = songFromProgression({
    beatsPerBar: 4, beatUnit: 4, key: 'G', mode: 'major',
    chords: [{ root: 'G', suffix: 'major' }]
}, { library: null, tempo: 60, pattern });
const written = songToAlphaTex(song);
if (written.error) {
    check('writes', false, written.error);
} else {
    track = trackFromTex(written.text);
    levels = levelsByBeat(track);
    const struckOnOne = track.notes.filter(n => n.startSeconds < 0.5);
    const others = track.notes.filter(n => n.startSeconds >= 0.5);
    check('plays its accented stroke at 1.5', struckOnOne.length > 0 && struckOnOne.every(n => n.level === ACCENT_LEVEL),
        [...new Set(struckOnOne.map(n => n.level))].join(' '));
    check('and every other stroke evenly, none softened', others.length > 0 && others.every(n => n.level === 1),
        [...new Set(others.map(n => n.level))].join(' '));
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exitCode = failures === 0 ? 0 : 1;

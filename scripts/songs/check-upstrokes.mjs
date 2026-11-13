// Checks four-string upstrokes in src/shared/songScore.mjs. Since 2026-11-12 the writer writes an
// upstroke on the four highest strings the chord plays, all of them for a chord of four strings or
// fewer, and the audio track plays what is written, the strings below ringing on. The reader takes
// an upstroke on the top strings of the chord sounding as continuing it, and still reads a file
// saved before then, which wrote every string on an upstroke. docs/one-player.md, decision 11.
//
//   node scripts/songs/check-upstrokes.mjs

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseStrummingPattern, fitPattern, formatStrummingPattern } from '../../src/shared/strummingPatterns.mjs';
import {
    songFromProgression, songToAlphaTex, readSongFromScore, progressionFromSong, libraryFrets, upstrokeFrets
} from '../../src/shared/songScore.mjs';
import { buildAudioTrack, resolveRingLengths } from '../../src/shared/audioTrack.mjs';

const root = path.join(import.meta.dirname, '..', '..');
const alphaTab = await import(pathToFileURL(path.join(root, 'node_modules', '@coderline', 'alphatab', 'dist', 'alphaTab.mjs')).href);
const library = JSON.parse(fs.readFileSync(path.join(root, 'src', 'assets', 'chords', 'chord-library.json'), 'utf8'));

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${condition ? '' : `  -- ${detail}`}`);
};

function importAlphaTex(text) {
    const importer = new alphaTab.importer.AlphaTexImporter();
    importer.initFromString(text, new alphaTab.Settings());
    return importer.readScore();
}
function pattern(text) {
    const { slots } = parseStrummingPattern(text);
    return { slotsPerBeat: fitPattern(slots, 4).slotsPerBeat, slots };
}
const named = name => ({ G: { root: 'G', suffix: 'major' }, C: { root: 'C', suffix: 'major' },
    D: { root: 'D', suffix: 'major' }, Am: { root: 'A', suffix: 'minor' } })[name];
/** A progression of one chord a measure, or [name, { name, beat }] for a later chord. */
function progression(measures) {
    return {
        key: 'G', mode: 'major', beatsPerBar: 4, beatUnit: 4,
        chords: measures.map(m => Array.isArray(m)
            ? { ...named(m[0]), laterChords: m.slice(1).map(c => ({ ...named(c.name), beat: c.beat })) }
            : named(m))
    };
}
const write = (measures, patternText, swing = false) => songToAlphaTex(songFromProgression(progression(measures),
    { library, tempo: 60, pattern: pattern(patternText), swing }));
/** The beats of measure `index` as written, each its strings and how it is struck. */
const beatsOf = (text, index = 0) => importAlphaTex(text).tracks[0].staves[0].bars[index].voices[0].beats
    .map(beat => ({
        up: beat.pickStroke === 1,
        strings: beat.notes.map(n => 7 - n.string).sort((a, b) => a - b),
        tied: beat.notes.length > 0 && beat.notes.every(n => n.isTieDestination),
        dead: beat.notes.length > 0 && beat.notes.every(n => n.isDead)
    }));
const strings = beat => beat.strings.join('');
const reading = text => readSongFromScore(importAlphaTex(text), { library });
const chordStrings = name => libraryFrets(library, named(name)).map(f => f.string).sort((a, b) => a - b).join('');

console.log('Which strings an upstroke takes');
check('the four highest of a six-string chord', upstrokeFrets([1, 2, 3, 4, 5, 6].map(string => ({ string, fret: 0 })))
    .map(f => f.string).join('') === '1234');
check('every string of a chord of four or fewer', upstrokeFrets([{ string: 3, fret: 2 }, { string: 1, fret: 2 },
    { string: 2, fret: 3 }]).map(f => f.string).join('') === '123');
check('the top four a five-string chord plays, skipping any it does not', upstrokeFrets([2, 3, 4, 5, 6].map(string => ({ string, fret: 1 })))
    .map(f => f.string).join('') === '2345');

console.log('\nWriting');
console.log(`  (G plays strings ${chordStrings('G')}, C ${chordStrings('C')}, D ${chordStrings('D')})`);
let text = write(['G'], 'D U D U D U D U').text;
let beats = beatsOf(text);
check('a downstroke of G writes every string it plays', beats.filter(b => !b.up).every(b => strings(b) === chordStrings('G')),
    beats.filter(b => !b.up).map(strings).join(' '));
check('an upstroke of G writes its top four', beats.filter(b => b.up).every(b => strings(b) === '1234'),
    beats.filter(b => b.up).map(strings).join(' '));
text = write(['D'], 'D U D U D U D U').text;
beats = beatsOf(text);
check('an upstroke of D, a four-string chord, writes all four', beats.filter(b => b.up).every(b => strings(b) === chordStrings('D')),
    beats.filter(b => b.up).map(strings).join(' '));
text = write(['C'], 'D U D U D U D U').text;
beats = beatsOf(text);
check('an upstroke of C writes the top four of its five', beats.filter(b => b.up).every(b => strings(b) === '1234'),
    beats.filter(b => b.up).map(strings).join(' '));

text = write(['G'], 'D x D x').text;
beats = beatsOf(text);
check('a mute still damps every string the chord plays', beats.filter(b => b.dead).every(b => strings(b) === chordStrings('G')),
    beats.filter(b => b.dead).map(strings).join(' '));

// D - D U - U D U swung: the up on the and of 2 rings through beat 3, which a swung song cuts at
// the beat and writes as a tie (swungPiece).
text = write(['G'], 'D - D U - U D U', true).text;
beats = beatsOf(text);
const tieAfterUp = beats.find((b, i) => b.tied && beats[i - 1]?.up);
check('a tie after an upstroke ties the four strings it struck', tieAfterUp && strings(tieAfterUp) === '1234',
    beats.map(b => `${b.up ? 'U' : b.tied ? '-' : 'D'}${strings(b)}`).join(' '));
// Four measures, so the last up of one measure rings into a miss at the start of the next.
text = write(['G', 'G'], '- U D U D U D U').text;
const nextStart = beatsOf(text, 1)[0];
check('and so does the tie that carries it over the bar line', nextStart.tied && strings(nextStart) === '1234', strings(nextStart));

console.log('\nPlaying');
const track = buildAudioTrack(importAlphaTex(write(['G'], 'D U D U D U D U').text), 0);
resolveRingLengths(track.notes, track.stops);
const struckAt = seconds => track.notes.filter(n => Math.abs(n.startSeconds - seconds) < 0.2).map(n => n.string).sort().join('');
check('an upstroke sounds four strings', struckAt(0.5) === '1234', struckAt(0.5));
const lowString = track.notes.find(n => n.string === 6 && n.startSeconds < 0.2);
check('and the low strings ring on through it, to the next downstroke', Math.abs(lowString.ringSeconds - 1) < 1e-6,
    `${lowString.ringSeconds}`);

console.log('\nReading back');
for (const [label, measures, patternText] of [
    ['G, C and D with D U throughout', ['G', 'C', 'D', 'G'], 'D U D U D U D U'],
    ['Old Faithful, ups ringing over misses', ['G', 'C', 'Am', 'D'], 'D - D U - U D U'],
    ['a chord whose first strike is an upstroke, C on the and of 2', [['G', { name: 'C', beat: 2.5 }], 'D'], 'D - D U - U D U'],
    ['a chord on a miss first struck by an upstroke, C on 3', [['G', { name: 'C', beat: 3 }], 'G'], 'D - D U - U D U']
]) {
    const written = write(measures, patternText);
    const song = reading(written.text);
    const result = progressionFromSong(song, { library });
    const forms = song.measures.map(m => m.form).join(' ');
    const chords = result.progression?.chords.map(c => [c, ...(c.laterChords ?? [])]
        .map(x => `${x.root}${x.suffix === 'minor' ? 'm' : ''}${x.beat ? `@${x.beat}` : ''}`).join(' ')).join(' | ');
    const expected = measures.map(m => Array.isArray(m) ? [m[0], ...m.slice(1).map(c => `${c.name}@${c.beat}`)].join(' ') : m).join(' | ');
    check(`${label} reads back as written`, !result.error && chords === expected &&
        formatStrummingPattern(result.progression.pattern.slots) === formatStrummingPattern(pattern(patternText).slots),
        result.error ?? `${chords}; ${result.progression && formatStrummingPattern(result.progression.pattern.slots)}; forms ${forms}`);
    // The chord keeps its whole shape, though its first strike wrote only four strings.
    const fullShapes = song.measures.flatMap(m => m.chords ?? []).every(c =>
        c.frets.map(f => f.string).sort().join('') === chordStrings(c.suffix === 'minor' ? `${c.root}m` : c.root));
    check('with each chord\'s whole shape', fullShapes,
        song.measures.flatMap(m => m.chords ?? []).map(c => `${c.root} ${c.frets.map(f => f.string).sort().join('')}`).join(', '));
}

console.log('\nA file saved before four-string upstrokes');
// As the writer wrote it until 2026-11-12: every string of G on an upstroke.
const G6 = '(3.6 2.5 0.4 0.3 0.2 3.1)';
const old = ['\\tempo 60', '\\chord ("G" 3 0 0 0 2 3)', '\\ts (4 4)', '\\ks g',
    `${G6}.8 {sd ch "G"} ${G6}.8 {su} ${G6}.8 {sd} ${G6}.8 {su} ${G6}.8 {sd} ${G6}.8 {su} ${G6}.8 {sd} ${G6}.8 {su} |`].join('\n');
let song = reading(old);
let result = progressionFromSong(song, { library });
check('still opens as G with D U throughout', !result.error && result.progression.chords.map(c => c.root).join() === 'G' &&
    formatStrummingPattern(result.progression.pattern.slots) === "D U D U D U D U", result.error ?? `${song.measures.map(m => m.form)}`);

console.log('\nA song that upstrokes the top four strings, naming no chords');
const G4 = '(0.4 0.3 0.2 3.1)';
song = reading(['\\tempo 60', '\\ks g',
    `${G6}.8 {sd} ${G4}.8 {su} ${G6}.8 {sd} ${G4}.8 {su} ${G6}.8 {sd} ${G4}.8 {su} ${G6}.8 {sd} ${G4}.8 {su} |`].join('\n'));
result = progressionFromSong(song, { library });
check('opens as G with D U throughout', !result.error && result.progression.chords.map(c => c.root).join() === 'G' &&
    formatStrummingPattern(result.progression.pattern.slots) === "D U D U D U D U", result.error ?? `${song.measures.map(m => `${m.form} ${m.reason ?? ''}`)}`);

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exitCode = failures === 0 ? 0 : 1;

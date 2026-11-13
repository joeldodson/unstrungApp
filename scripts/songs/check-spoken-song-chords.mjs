// Checks what a song's player will say before each measure, from the chords the file prints: the
// harmony each measure carries (extractScoreMetadata's `harmony`), the phrase said for each printed
// name (songSpokenChords), and when (spokenMeasureTimes), for measures of any length.
//
// Decided 2026-11-12 (docs/one-player.md, decision 5): songs get chord practice's spoken next
// measure, from printed chords only and never from the notes. A printed chord carries forward as
// measure headings say ("continues C"), so a measure whose harmony is the one before's is "repeat";
// measures before the first printed chord, and after a section that prints none, say nothing. The
// app's scheduling of it comes in the next step.
//
//   node scripts/songs/check-spoken-song-chords.mjs

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { extractScoreMetadata } from '../../src/shared/scoreMetadata.mjs';
import { buildAudioTrack } from '../../src/shared/audioTrack.mjs';
import { songSpokenChords, spokenMeasureTimes, SPOKEN_REPEAT, SPOKEN_WORD_GAP_SECONDS } from '../../src/shared/measureChords.mjs';
import { chordIndex, songFromProgression, songToAlphaTex } from '../../src/shared/songScore.mjs';

const root = path.join(import.meta.dirname, '..', '..');
const alphaTab = await import(pathToFileURL(path.join(root, 'node_modules', '@coderline', 'alphatab', 'dist', 'alphaTab.mjs')).href);
const library = JSON.parse(fs.readFileSync(path.join(root, 'src', 'assets', 'chords', 'chord-library.json'), 'utf8'));
const index = chordIndex(library);
const chordByName = name => index.byName.get(name) ?? null;
const names = [...index.byName.keys()];

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${condition ? '' : `  -- ${detail}`}`);
};

function scoreOf(text) {
    const importer = new alphaTab.importer.AlphaTexImporter();
    importer.initFromString(text, new alphaTab.Settings());
    return importer.readScore();
}
const harmonies = score => extractScoreMetadata(score).tracks[0].measures.map(m => m.harmony);
const show = harmony => harmony.map(c => `${c.name}@${c.beat}`).join(' ') || '-';
const G = '(3.6 2.5 0.4 0.3 0.2 3.1)';

console.log('The harmony each measure carries');
let score = scoreOf(['\\tempo 60',
    `${G}.4 {ch "G"} ${G}.4 ${G}.2 |`,
    `${G}.1 |`,
    `${G}.2 ${G}.2 {ch "C"} |`,
    `${G}.1 |`,
    `\\section "Bridge" ${G}.1 |`,
    `${G}.4 ${G}.8 ${G}.8 {ch "D"} ${G}.2 |`,
    `${G}.1 |`].join('\n'));
let h = harmonies(score);
check('a printed chord is in its measure at beat 1', show(h[0]) === 'G@1', show(h[0]));
check('a measure printing none carries it', show(h[1]) === 'G@1', show(h[1]));
check('one printed partway keeps the carried chord before it', show(h[2]) === 'G@1 C@3', show(h[2]));
check('and carries on into the next', show(h[3]) === 'C@1', show(h[3]));
check('a section printing no chord has none, as its heading names none', h[4].length === 0, show(h[4]));
check('a chord on the and of 2 is at 2.5, with nothing carried before it', show(h[5]) === 'D@2.5', show(h[5]));
check('and is carried on', show(h[6]) === 'D@1', show(h[6]));

score = scoreOf(['\\tempo 60', `${G}.1 |`, `${G}.2 ${G}.2 {ch "Am"} |`, `${G}.1 |`].join('\n'));
h = harmonies(score);
check('a measure before the first printed chord has none', h[0].length === 0, show(h[0]));
check('the first printed chord starts where it is printed', show(h[1]) === 'Am@3', show(h[1]));

score = scoreOf(['\\tempo 60', `\\ts (6 8) ${G}.4 {ch "G"} ${G}.4 {ch "C"} ${G}.4 |`].join('\n'));
check('beats are the time signature\'s: a quarter into 6/8 is beat 3', show(harmonies(score)[0]) === 'G@1 C@3',
    show(harmonies(score)[0]));

console.log('\nWhat is said for each printed name');
let spoken = songSpokenChords([{ name: 'G', beat: 1 }, { name: 'Am', beat: 3 }, { name: 'C7', beat: 4 }], { chordByName, names });
check('known names become their phrases, keeping the printed name', spoken.map(c => `${c.name}|${c.key}`).join(', ') ===
    'G|G, A minor|Am, C 7|C7', spoken.map(c => `${c.name}|${c.key}`).join(', '));
spoken = songSpokenChords([{ name: 'Gzz', beat: 1 }], { chordByName, names });
check('an unknown name has no phrase', spoken[0].name === null && spoken[0].key === 'Gzz', JSON.stringify(spoken[0]));
spoken = songSpokenChords([{ name: 'D/F♯', beat: 1 }, { name: '(F)', beat: 3 }], { chordByName, names });
check('a printed sharp sign, and parentheses, are read as typed', spoken.map(c => `${c.name}|${c.key}`).join(', ') ===
    'D slash F sharp|D/F♯, F|(F)', spoken.map(c => `${c.name}|${c.key}`).join(', '));
// Joel chose on 2026-11-12 to say a chord the library spells another way as the library spells it.
spoken = songSpokenChords([{ name: 'G#m', beat: 1 }, { name: 'A#7', beat: 2 }, { name: 'Db', beat: 3 }], { chordByName, names });
check('a root the library spells another way is said its way: G#m as A flat minor',
    spoken.map(c => `${c.name}|${c.key}`).join(', ') === 'A flat minor|G#m, B flat 7|A#7, C sharp|Db',
    spoken.map(c => `${c.name}|${c.key}`).join(', '));
// Joel suggested the same day ignoring case when nothing matches: a file printing AM and EM beside
// Am and Em means A minor and E minor. A capital M with a number is major, as in CM7.
spoken = songSpokenChords([{ name: 'AM', beat: 1 }, { name: 'em', beat: 2 }, { name: 'CM7', beat: 3 }, { name: 'G', beat: 4 }],
    { chordByName, names });
check('a name matching only in another case is said: AM and em as A minor and E minor, CM7 as C major 7',
    spoken.map(c => `${c.name}|${c.key}`).join(', ') === 'A minor|AM, E minor|em, C major 7|CM7, G|G',
    spoken.map(c => `${c.name}|${c.key}`).join(', '));
spoken = songSpokenChords([{ name: 'G', beat: 1 + 1 / 3 }], { chordByName, names });
check('a chord between quarters of a beat is said at the quarter it falls in', spoken[0].beat === 1.25, `${spoken[0].beat}`);

// Every phrase a third of a second long, except one with no recording.
const recorded = new Set(['G', 'C', 'D', 'A minor', SPOKEN_REPEAT, 'at 3', 'at 2.5']);
const speechSeconds = word => (recorded.has(word) ? 0.3 : undefined);
const timed = (measures, list) => spokenMeasureTimes(measures.map((chords, i) => ({ chords, ...list[i] })), { speechSeconds });
const words = plan => plan.map(p => (p ? p.words.join(' + ') : '-')).join(' | ');

console.log('\nA progression saved and opened as a song');
// The writer prints a name only where the chord changes: G G G C prints G and C. Carried forward,
// measures 2 and 3 are G again, so they are "repeat".
const written = songToAlphaTex(songFromProgression({
    key: 'G', mode: 'major', beatsPerBar: 4, beatUnit: 4,
    chords: ['G', 'G', 'G', 'C'].map(root => ({ root, suffix: 'major' }))
}, { library, tempo: 60 })).text;
score = scoreOf(written);
const track = buildAudioTrack(score, 0);
const measures = harmonies(score).map(harmony => songSpokenChords(harmony, { chordByName, names }));
let plan = spokenMeasureTimes(measures.map((chords, i) => ({
    chords, seconds: track.bars[i].endSeconds - track.bars[i].startSeconds, beatSeconds: track.bars[i].beatSeconds
})), { speechSeconds });
check('says G, repeat, repeat, C', words(plan) === `G | ${SPOKEN_REPEAT} | ${SPOKEN_REPEAT} | C`, words(plan));
check('each one beat ahead', plan.every(p => Math.abs(p.offsetSeconds + 1) < 1e-9), plan.map(p => p.offsetSeconds).join(', '));

console.log('\nMeasures of different lengths');
const four60 = { seconds: 4, beatSeconds: 1 };
const three60 = { seconds: 3, beatSeconds: 1 };
const four120 = { seconds: 2, beatSeconds: 0.5 };
plan = timed([[{ name: 'G', beat: 1 }], [{ name: 'C', beat: 1 }], [{ name: 'D', beat: 1 }]], [four60, four120, four60]);
check('a chord is said a beat of the measure before ahead, as it is heard there',
    plan.map(p => p.offsetSeconds).join() === '-1,-1,-0.5', plan.map(p => p.offsetSeconds).join());
// Three names and two positions take 1.5 s with their gaps, plus 0.1 s to finish before the beat.
const many = [{ name: 'G', beat: 1 }, { name: 'C', beat: 2.5 }, { name: 'D', beat: 3 }];
plan = timed([[{ name: 'G', beat: 1 }], many], [three60, three60]);
check('several said together finish just before the measure', words(plan.slice(1)) === 'G + C + at 2.5 + D' &&
    Math.abs(plan[1].offsetSeconds + (4 * 0.3 + 3 * SPOKEN_WORD_GAP_SECONDS + 0.1)) < 1e-9,
    `${words(plan.slice(1))} at ${plan[1].offsetSeconds}`);
// A measure of 3/4 at 120 lasts 1.5 s, too short for the 1.54 s the list takes.
const three120 = { seconds: 1.5, beatSeconds: 0.5 };
plan = timed([[{ name: 'G', beat: 1 }], many], [three120, four60]);
check('a short measure before leaves room for the first only, a beat of it ahead', words(plan.slice(1)) === 'G' &&
    Math.abs(plan[1].offsetSeconds + 0.5) < 1e-9, `${words(plan.slice(1))} at ${plan[1].offsetSeconds}`);
plan = timed([many], [four120]);
check('the first measure is given its own length before it', plan[0].offsetSeconds >= -2 - 1e-9, `${plan[0].offsetSeconds}`);

console.log('\nWhat is left unsaid');
plan = timed([[], [{ name: 'G', beat: 1 }], []], [four60, four60, four60]);
check('a measure with no chords says nothing, and is not "repeat" of another', words(plan) === '- | G | -', words(plan));
const unknown = name => ({ name: null, key: name, beat: 1 });
plan = timed([[unknown('Gzz')], [unknown('Gzz')], [unknown('Hzz')]], [four60, four60, four60]);
check('an unknown chord is not said, but carried on it is still "repeat"', words(plan) === `- | ${SPOKEN_REPEAT} | -`, words(plan));
plan = timed([[{ name: 'G', beat: 1 }, { ...unknown('Hzz'), beat: 3 }]], [four60]);
check('nor is its position said without it', words(plan) === 'G', words(plan));

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exitCode = failures === 0 ? 0 : 1;

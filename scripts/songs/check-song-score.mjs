// Checks src/shared/songScore.mjs and src/shared/strummingPatterns.mjs: songs written as alphaTex,
// read by alphaTab, and read back into measures of chords and patterns; and the same after a
// round trip through alphaTab's own alphaTex exporter, which is what saving an edited score would
// use.
//
//   node scripts/songs/check-song-score.mjs

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
    parseStrummingPattern, formatStrummingPattern, fitPattern, coarsestPattern, patternsFor, namedPatternLike,
    checkOwnPattern, formatPatternFile, mergeImportedPatterns, describeStrummingPattern,
    BUILT_IN_PATTERNS
} from '../../src/shared/strummingPatterns.mjs';
import { songFromProgression, songToAlphaTex, readSongFromScore, describeMeasure, libraryFrets } from '../../src/shared/songScore.mjs';
import { generateProgression } from '../../src/shared/chordProgressions.mjs';
import { buildAudioTrack } from '../../src/shared/audioTrack.mjs';

const root = path.join(import.meta.dirname, '..', '..');
const alphaTab = await import(pathToFileURL(path.join(root, 'node_modules', '@coderline', 'alphatab', 'dist', 'alphaTab.mjs')).href);
const library = JSON.parse(fs.readFileSync(path.join(root, 'src', 'assets', 'chords', 'chord-library.json'), 'utf8'));
const model = JSON.parse(fs.readFileSync(path.join(root, 'src', 'assets', 'progressions', 'progression-model.json'), 'utf8'));

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
const exportAlphaTex = score => new alphaTab.exporter.AlphaTexExporter().exportToString(score, new alphaTab.Settings());

function pattern(text, beatsPerBar = 4) {
    const { slots, error } = parseStrummingPattern(text);
    if (error) throw new Error(error);
    const fit = fitPattern(slots, beatsPerBar);
    if (fit.error) throw new Error(fit.error);
    return { slotsPerBeat: fit.slotsPerBeat, slots };
}
const chord = (name, beat = 1) => {
    const [root, suffix] = name.endsWith('m') && !name.endsWith('dim') ? [name.slice(0, -1), 'minor']
        : /7$/.test(name) ? [name.slice(0, -1), '7'] : [name, 'major'];
    return { root, suffix, beat, frets: libraryFrets(library, { root, suffix }) };
};

/** Writes, reads, exports, reads again; returns both readings. */
function roundTrip(song) {
    const written = songToAlphaTex(song);
    if (written.error) throw new Error(`measure ${written.measure}: ${written.error}`);
    const first = readSongFromScore(importAlphaTex(written.text), { library });
    const exported = exportAlphaTex(importAlphaTex(written.text));
    const second = readSongFromScore(importAlphaTex(exported), { library });
    return { text: written.text, first, second, exported };
}
const descriptions = song => song.measures.map((m, i) => describeMeasure(m, i + 1));

console.log('\n=== Pattern text ===');
{
    const read = parseStrummingPattern('>d - D u - U d U');
    check('reads, letter case ignored', !read.error && formatStrummingPattern(read.slots) === '>D - D U - U D U', JSON.stringify(read));
    check('a dash cannot be accented', !!parseStrummingPattern('D >- D U').error);
    check('an unknown letter is refused', /Slot 2/.test(parseStrummingPattern('D Q D U').error ?? ''));
    check('eight slots in 4/4 are eighths', fitPattern(read.slots, 4).slotsPerBeat === 2);
    check('six slots do not fit 4/4', !!fitPattern(read.slots.slice(0, 6), 4).error);
}

console.log('\n=== Built-in patterns ===');
{
    const signatures = [...new Set(BUILT_IN_PATTERNS.map(p => p.timeSignature))];
    for (const signature of signatures) {
        const [beatsPerBar, beatUnit] = signature.split('/').map(Number);
        const listed = BUILT_IN_PATTERNS.filter(p => p.timeSignature === signature);
        const problems = [];
        for (const entry of listed) {
            const read = parseStrummingPattern(entry.text);
            if (read.error) { problems.push(`${entry.name}: ${read.error}`); continue; }
            const fit = fitPattern(read.slots, beatsPerBar);
            if (fit.error) { problems.push(`${entry.name}: ${fit.error}`); continue; }
            // Written coarsest, so one read back from a score compares equal.
            const coarse = coarsestPattern(read.slots, fit.slotsPerBeat);
            if (formatStrummingPattern(coarse.slots) !== entry.text) problems.push(`${entry.name} is not written on its coarsest grid`);
        }
        const names = listed.map(p => p.name);
        if (new Set(names).size !== names.length) problems.push('two patterns share a name');
        const texts = listed.map(p => p.text);
        if (new Set(texts).size !== texts.length) problems.push('two patterns are the same strokes');
        check(`${signature}: ${listed.length} patterns, Down Only and All Down-Up first, all valid`,
            problems.length === 0 && names[0] === 'Down Only' && names[1] === 'All Down-Up', problems.join('; '));
    }
    const fiveFour = patternsFor(5, 4).map(p => `${p.name}: ${p.text}`);
    check('a time signature with none listed gets Down Only and All Down-Up',
        fiveFour.join(' | ') === 'Down Only: D D D D D | All Down-Up: D U D U D U D U D U', fiveFour.join(' | '));
    const nineEight = patternsFor(9, 8).map(p => p.text);
    check('in compound time, All Down-Up alternates on the eighths', nineEight[1] === 'D U D U D U D U D', nineEight[1]);
    const read = parseStrummingPattern('D - D - D - D -');
    check('the same strokes on a finer grid are recognised as a built-in',
        namedPatternLike({ slotsPerBeat: 2, slots: read.slots }, 4, 4)?.name === 'Down Only');
}

console.log('\n=== Your own patterns ===');
{
    const busy = checkOwnPattern({ name: '  Busy   Folk ', beatsPerBar: 4, beatUnit: 4, text: 'd - d u d u d u' });
    check('a pattern is tidied as it is kept', busy.pattern?.name === 'Busy Folk' && busy.pattern?.text === 'D - D U D U D U' &&
        busy.pattern?.timeSignature === '4/4', JSON.stringify(busy));
    const own = [busy.pattern];
    check('a built-in name is refused', /built-in/.test(checkOwnPattern({ name: 'old faithful', beatsPerBar: 4, beatUnit: 4, text: 'D D D D' }).error ?? ''));
    check('a name already yours is refused', /already have/.test(checkOwnPattern({ name: 'busy folk', beatsPerBar: 4, beatUnit: 4, text: 'D D D D' }, { own }).error ?? ''));
    check('the same name in another time signature is fine', !!checkOwnPattern({ name: 'Busy Folk', beatsPerBar: 3, beatUnit: 4, text: 'D U D - D U' }, { own }).pattern);
    check('editing keeps its own name', !!checkOwnPattern({ name: 'Busy Folk', beatsPerBar: 4, beatUnit: 4, text: 'D - - - D - - -' }, { own, replacing: own[0] }).pattern);
    const twin = checkOwnPattern({ name: 'Calypso', beatsPerBar: 4, beatUnit: 4, text: 'D - D U - U D U' }, { own });
    check('strokes that are already a pattern are refused, naming it', twin.field === 'strokes' &&
        twin.error === 'Those strokes are already Old Faithful in 4/4.', twin.error);
    check('including on a finer grid', /already Down Only/.test(checkOwnPattern({ name: 'Slow', beatsPerBar: 4, beatUnit: 4, text: 'D - D - D - D -' }).error ?? ''));
    check('and your own', /already Busy Folk/.test(checkOwnPattern({ name: 'Again', beatsPerBar: 4, beatUnit: 4, text: 'D - D U D U D U' }, { own }).error ?? ''));
    const wrongCount = checkOwnPattern({ name: 'Short', beatsPerBar: 4, beatUnit: 4, text: 'D U D' });
    check('strokes that do not fill the measure point at the strokes', wrongCount.field === 'strokes', JSON.stringify(wrongCount));
    check('no name points at the name', checkOwnPattern({ name: ' ', beatsPerBar: 4, beatUnit: 4, text: 'D D D D' }).field === 'name');

    const file = formatPatternFile([...own, { name: 'Lilt', timeSignature: '3/4', text: '>D - D U D U' }]);
    check('the file is a note, then a line a pattern',
        file.split('\n')[1] === '4/4, Busy Folk: D - D U D U D U' && file.split('\n')[2] === '3/4, Lilt: >D - D U D U' && file.startsWith('#'), file);

    const merged = mergeImportedPatterns(own, [
        file,
        '4/4, Old Faithful: D - D U - U D U',
        '4/4, Busy Folk: D - - - D U D U',
        '4/4, Old Faithful: D - D U - - D U',
        '4/4: D D D D',
        '4/4, Too few: D U',
        '',
        '# a note'
    ].join('\n'));
    console.log(`  added ${merged.added}, skipped ${merged.skipped}, renamed ${merged.renamed.map(r => `${r.from} -> ${r.to}`).join('; ')}`);
    for (const problem of merged.problems) console.log(`  line ${problem.line}: ${problem.reason}`);
    check('an exported file imported over itself adds only what is new', merged.added === 3 && merged.skipped === 2,
        `${merged.added} added, ${merged.skipped} skipped`);
    check('a name reused with other strokes is kept as (imported)',
        merged.renamed.map(r => r.to).join('|') === 'Busy Folk (imported)|Old Faithful (imported)', merged.renamed.map(r => r.to).join('|'));
    check('lines that cannot be read are listed with their line numbers',
        // The file ends with a newline, so its patterns take lines 1 to 4 and these follow from 5.
        merged.problems.map(p => p.line).join(',') === '8,9' && merged.problems.every(p => /^[a-z]/.test(p.reason)),
        merged.problems.map(p => `${p.line}: ${p.reason}`).join('; '));
    check('own patterns join the lists after the built-in ones',
        patternsFor(4, 4, merged.own).slice(-3).map(p => `${p.own ? 'own' : 'built-in'} ${p.name}`).join('|') ===
        'own Busy Folk|own Busy Folk (imported)|own Old Faithful (imported)', patternsFor(4, 4, merged.own).map(p => p.name).join('|'));
    check('the read-back says each slot in words',
        describeStrummingPattern(parseStrummingPattern('>D - D U').slots, 2) === '1 accented down, and miss, 2 down, and up');
    check('and in sixteenths', describeStrummingPattern(parseStrummingPattern('D U D U').slots, 4) === '1 down, e up, and down, a up');
}

console.log('\n=== A generated progression, as chord practice plays it today ===');
{
    const progression = { ...generateProgression(model, { key: 'A', mode: 'minor', levelId: 'intermediate', chordCount: 16, seed: 7, library }), beatsPerBar: 4, beatUnit: 4 };
    const song = songFromProgression(progression, { library, tempo: 80 });
    const { first, second } = roundTrip(song);
    for (const [label, read] of [['read', first], ['after export', second]]) {
        check(`${label}: every measure plain`, read.measures.every(m => m.form === 'plain'), descriptions(read).join('; '));
        check(`${label}: the same chords`, read.measures.map(m => `${m.chords[0].root}${m.chords[0].suffix}`).join() ===
            progression.chords.map(c => `${c.root}${c.suffix}`).join(), descriptions(read).join('; '));
        check(`${label}: key and mode`, read.key === 'A' && read.mode === 'minor', `${read.key} ${read.mode}`);
        check(`${label}: tempo and time signature`, read.tempo === 80 && read.beatsPerBar === 4 && read.beatUnit === 4, `${read.tempo} ${read.beatsPerBar}/${read.beatUnit}`);
        check(`${label}: the pattern is a downstroke on every beat`, read.pattern?.text === 'D D D D', read.pattern?.text);
    }
}

console.log('\n=== Joel\'s three-three-two example: D, Am, Am, Em ===');
{
    const p = pattern('>D D D >D D D >D D');
    const song = {
        title: 'Three-three-two', key: 'D', mode: 'major', beatsPerBar: 4, beatUnit: 4, tempo: 100,
        measures: ['D', 'Am', 'Am', 'Em'].map(name => ({ section: null, chords: [chord(name)], pattern: p }))
    };
    const { first, second, text } = roundTrip(song);
    for (const [label, read] of [['read', first], ['after export', second]]) {
        check(`${label}: all plain, pattern kept with its accents`, read.measures.every(m => m.form === 'plain')
            && read.pattern?.text === '>D D D >D D D >D D', `${read.pattern?.text}; ${descriptions(read).join('; ')}`);
    }
    console.log('\n  The alphaTex for its first measure:');
    console.log('  ' + text.split('\n').find(line => line.includes('|')));
}

console.log('\n=== A simplified song: sections, two patterns, a split measure, a mute, a leading miss ===');
{
    const verse = pattern('D - D U - U D U');
    const chorus = pattern('D x D U x U D x');
    const push = pattern('- U D U D U D U');
    const song = {
        title: 'Sketch', key: 'G', mode: 'major', beatsPerBar: 4, beatUnit: 4, tempo: 96,
        measures: [
            { section: 'Verse', chords: [chord('G')], pattern: verse },
            { section: null, chords: [chord('G'), chord('C', 3)], pattern: verse },
            { section: null, chords: [chord('D')], pattern: push },
            { section: null, chords: [chord('Em')], pattern: verse },
            { section: 'Chorus', chords: [chord('C')], pattern: chorus },
            { section: null, chords: [chord('G'), chord('D', 2.5)], pattern: chorus }
        ]
    };
    const { first, second } = roundTrip(song);
    for (const [label, read] of [['read', first], ['after export', second]]) {
        const d = descriptions(read);
        check(`${label}: measure 1 plain`, d[0] === 'Measure 1, G', d[0]);
        check(`${label}: measure 2 split at beat 3`, d[1] === 'Measure 2, G C at 3, D - D U - U D U', d[1]);
        check(`${label}: measure 3 ties over its start`, d[2] === 'Measure 3, D, - U D U D U D U', d[2]);
        check(`${label}: chorus pattern with mutes`, d[4] === 'Measure 5, C, D x D U x U D x', d[4]);
        check(`${label}: split on an and`, d[5] === 'Measure 6, G D at 2.5, D x D U x U D x', d[5]);
        check(`${label}: sections kept`, read.measures[0].section === 'Verse' && read.measures[4].section === 'Chorus'
            && read.measures[1].section === null, read.measures.map(m => m.section).join());
        check(`${label}: patterns listed, most common first`, read.patterns.map(p => `${p.text} (${p.measures.join(',')})`).join('; ')
            === 'D - D U - U D U (1,2,4); D x D U x U D x (5,6); - U D U D U D U (3)', read.patterns.map(p => `${p.text} (${p.measures.join(',')})`).join('; '));
    }
}

console.log('\n=== Refused while writing ===');
{
    const song = { key: 'G', mode: 'major', beatsPerBar: 4, beatUnit: 4, tempo: 90,
        measures: [{ section: null, chords: [chord('G'), chord('C', 2.25)], pattern: pattern('D - D U - U D U') }] };
    const written = songToAlphaTex(song);
    check('a chord starting off the pattern\'s grid', /not on the pattern's grid/.test(written.error ?? ''), JSON.stringify(written));
}

console.log('\n=== Measures that are written out ===');
{
    const cases = [
        ['single notes', '\\tempo 90 . \\ts 4 4 3.6.4 2.5.4 0.4.4 0.3.4 |', /spell no chord/],
        ['a bend', '\\tempo 90 . \\ts 4 4 (3.6 2.5 0.4 0.3 0.2 3.1{b (0 4)}).1 |', /bend/],
        ['a triplet', '\\tempo 90 . \\ts 4 4 (3.6 2.5 0.4 0.3 0.2 3.1).8 {tu 3} (3.6 2.5 0.4 0.3 0.2 3.1).8 {tu 3} (3.6 2.5 0.4 0.3 0.2 3.1).8 {tu 3} (3.6 2.5 0.4 0.3 0.2 3.1).4 (3.6 2.5 0.4 0.3 0.2 3.1).2 |', /tuplet/],
        ['a rest in the middle', '\\tempo 90 . \\ts 4 4 (3.6 2.5 0.4 0.3 0.2 3.1).4 r.4 (3.6 2.5 0.4 0.3 0.2 3.1).2 |', /do not say everything/]
    ];
    for (const [label, text, reason] of cases) {
        const read = readSongFromScore(importAlphaTex(text), { library });
        const m = read.measures[0];
        check(`${label}`, m?.form === 'written' && reason.test(m.reason), describeMeasure(m, 1));
    }
    const mixed = readSongFromScore(importAlphaTex('\\tempo 90 . \\ts 4 4 r.1 | (3.6 2.5 0.4 0.3 0.2 3.1).2 (3.6 2.5 0.4 0.3 0.2 3.1).2 | \\ts 2 4 (3.6 2.5 0.4 0.3 0.2 3.1).2 | \\ts 4 4 (5.6 7.5).4 {sd} (5.6 7.5).4 {su} (5.6 7.5).2 {sd} |'), { library });
    const d = descriptions(mixed);
    check('a bar of rests at the start is silent', d[0] === 'Measure 1, silent', d[0]);
    check('a bar of 2/4 in a song of 4/4 reads in its own time', mixed.measures[2].beatsPerBar === 2 && mixed.measures[2].form !== 'written', d[2]);
    check('a power chord is named from its notes', /^Measure 4, A5, D U D -$/.test(d[3]), d[3]);
    const strummed = readSongFromScore(importAlphaTex('\\tempo 90 . \\ts 4 4 (3.6 2.5 0.4 0.3 0.2 3.1).4 (3.6 2.5 0.4 0.3 0.2 3.1).4 (3.6 2.5 0.4 0.3 0.2 3.1).2 |'), { library });
    check('an unmarked strum with no chord name is named from its shape', describeMeasure(strummed.measures[0], 1) === 'Measure 1, G',
        describeMeasure(strummed.measures[0], 1));
}

console.log('\n=== The audio track player plays a written song unchanged ===');
{
    const p = pattern('D - D U - U D U');
    const song = { key: 'G', mode: 'major', beatsPerBar: 4, beatUnit: 4, tempo: 60,
        measures: [{ section: null, chords: [chord('G'), chord('C', 3)], pattern: p }] };
    const track = buildAudioTrack(importAlphaTex(songToAlphaTex(song).text), 0);
    // Group the timeline's notes into strums by when they begin, to the nearest eighth.
    const strums = new Map();
    for (const note of track.notes) {
        const at = Math.round(note.startSeconds * 2) / 2;
        if (!strums.has(at)) strums.set(at, []);
        strums.get(at).push(note);
    }
    const summary = [...strums.entries()].map(([at, notes]) =>
        `${at}s ${notes[0].string > notes[notes.length - 1].string ? 'down' : 'up'} ${notes.map(n => `${n.string}:${n.fret}`).join(' ')}`);
    check('six strums: beats 1 and 2, the ands of 2 and 3, beat 4 and its and', summary.length === 6, summary.join('; '));
    check('strums fall on 0, 1, 1.5, 2.5, 3, 3.5 seconds', [...strums.keys()].join() === '0,1,1.5,2.5,3,3.5', [...strums.keys()].join());
    check('downs sweep from string 6, ups from string 1', summary.map(s => s.split(' ')[1]).join() === 'down,down,up,up,down,up', summary.join('; '));
    check('the and of 3 already plays C', /^2\.5s up 1:0 2:1 3:0 4:2 5:3$/.test(summary[3]), summary[3]);
    // Beat 3 is a miss where C takes over: a beat tying G's six strings carries the name, and the
    // player sustains it rather than striking it.
    check('the tie carrying C\'s name on beat 3 is not struck', track.skipped.tiedContinuations === 6, JSON.stringify(track.skipped));
}

console.log(failures ? `\n${failures} failed.` : '\nAll passed.');
process.exitCode = failures ? 1 : 0;

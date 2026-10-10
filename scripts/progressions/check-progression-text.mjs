// Checks src/shared/progressionText.mjs, which reads pasted progression text in the editor's Edit
// Progression Text section: exact text from Copy to Clipboard, text mangled on its way through an
// email, chords written as names, and text too broken to read.
//
//   node scripts/progressions/check-progression-text.mjs

import fs from 'node:fs';
import path from 'node:path';
import { readProgressionText } from '../../src/shared/progressionText.mjs';
import { serializeProgression } from '../../src/shared/savedProgressions.mjs';

const root = path.join(import.meta.dirname, '..', '..');
const model = JSON.parse(fs.readFileSync(path.join(root, 'src', 'assets', 'progressions', 'progression-model.json'), 'utf8'));
const library = JSON.parse(fs.readFileSync(path.join(root, 'src', 'assets', 'chords', 'chord-library.json'), 'utf8'));

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${condition ? '' : `  -- ${detail}`}`);
};
const read = text => readProgressionText(text, { model, library });
const names = progression => progression.chords.map(chord => (chord ? `${chord.root}${chord.suffix === 'major' ? '' : chord.suffix === 'minor' ? 'm' : chord.suffix}` : '-')).join(' ');
const show = result => JSON.stringify(result, null, 1);

console.log('\n=== Exactly as Copy to Clipboard writes it ===');
{
    const original = {
        key: 'A', mode: 'minor', beatsPerBar: 3, beatUnit: 4,
        chords: [{ root: 'A', suffix: 'minor' }, { root: 'F', suffix: 'major' }, { root: 'E', suffix: '7' }],
        origin: { made: 'generated', levelId: 'intermediate', borrowingId: 'occasional' }
    };
    const result = read(serializeProgression(original));
    check('read without fixes', result.progression && result.fixes.length === 0, show(result));
    check('the same progression comes back', JSON.stringify(result.progression) === JSON.stringify(original), show(result.progression));
}

console.log('\n=== Mangled by an email ===');
{
    const text = [
        'Here is the one we played on Tuesday:',
        '{',
        '  “format”: 1,',
        '  key: “G”,',
        '  "mode": "major"',
        '  "timeSignature": { "beatsPerBar": "4", "beatUnit": 4, },',
        '  "chords": [ {"root": "G", "suffix": "major"} {"root": "E", "suffix": "minor"}, ],',
        '}',
        '',
        'Thanks, Pat'
    ].join('\n');
    const result = read(text);
    check('read', result.progression, show(result));
    check('G major, 4/4, G Em', result.progression && result.progression.key === 'G' && result.progression.mode === 'major' &&
        result.progression.beatsPerBar === 4 && names(result.progression) === 'G Em', show(result.progression));
    const fixes = result.fixes ?? [];
    for (const [label, pattern] of [
        ['curly quotes', /^Line 3: curly quotation marks/],
        ['text before', /^Line 2: the text before/],
        ['unquoted name', /^Line 4: the name key had no quotation marks/],
        ['missing comma after a member', /^Line 6: a missing comma/],
        ['trailing comma in an object', /^Line 6: a comma before the closing brace/],
        ['missing comma between chords', /^Line 7: a missing comma/],
        ['trailing comma in an array', /^Line 7: a comma before the closing bracket/],
        ['trailing comma before the last brace', /^Line 7: a comma before the closing brace/],
        ['text after', /^Line 10: the text after/]
    ]) {
        check(`says it fixed: ${label}`, fixes.some(fix => pattern.test(fix)), fixes.join('\n      '));
    }
    console.log(`      fixes:\n      ${fixes.join('\n      ')}`);
}

console.log('\n=== Chords as names, key with its mode, time signature as text ===');
{
    const text = '{ "key": "Am", "timeSignature": "6/8", "chords": ["Am", "f", "CM7", "A#m", "Bbmaj7", "G7", "H7", "", "C/E", "EM9"] }';
    const result = read(text);
    const p = result.progression;
    check('read', p, show(result));
    check('A minor in 6/8', p && p.key === 'A' && p.mode === 'minor' && p.beatsPerBar === 6 && p.beatUnit === 8, show(p));
    check('chords spelled as the library spells them, unknown ones left empty',
        p && names(p) === 'Am F Cmaj7 Bbm Bbmaj7 G7 - - C/E Emaj9', p && names(p));
    console.log(`      fixes:\n      ${result.fixes.join('\n      ')}`);
}

console.log('\n=== Key spelled another way, chords as one line of text ===');
{
    const result = read('{"key": "Db", "mode": "Major", "chords": "C# F# | G#7, C#"}');
    const p = result.progression;
    check('C# major', p && p.key === 'C#' && p.mode === 'major', show(p));
    check('4/4 when no time signature is given', p && p.beatsPerBar === 4 && p.beatUnit === 4, show(p));
    check('chords read from the text', p && names(p) === 'C# F# Ab7 C#', p && names(p));
    check('says the key was respelled', result.fixes.some(fix => /key "Db" was read as C#/.test(fix)), result.fixes.join(' | '));
}

console.log('\n=== Cut off before the end ===');
{
    const result = read('{"key": "C", "mode": "major", "chords": [{"root": "C", "suffix": "major"}, {"root": "G", "suffix": "7"');
    check('read, with the closing brackets added', result.progression && names(result.progression) === 'C G7', show(result));
    check('says so', result.fixes.some(fix => /ended early/.test(fix)), (result.fixes ?? []).join(' | '));
}

console.log('\n=== Too broken to read ===');
{
    const none = read('Am F C G, four times through');
    check('no brace at all: refused, at the start', none.error && none.line === 1 && none.column === 1, show(none));

    const noChords = read('{"key": "C", "mode": "major"}');
    check('no chords: refused, with no place given', noChords.error && /no list of chords/.test(noChords.error) && noChords.line === null,
        show(noChords));

    const unclosed = read('{\n  "key": "C,\n  "chords": []\n}');
    check('a string never closed: refused at its line', unclosed.error && unclosed.line === 2, show(unclosed));

    const stray = read('{\n  "key": "C",\n  "chords": [ "C" ; "G" ]\n}');
    check('a stray semicolon: refused at its line and column', stray.error && stray.line === 3 && stray.column === 19, show(stray));
    console.log(`      ${stray.error} (line ${stray.line}, column ${stray.column})`);
}

console.log(failures ? `\n${failures} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);

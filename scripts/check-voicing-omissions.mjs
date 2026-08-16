// Checks the line that says which notes a shape leaves out, against every shape in the library.
//
// This exists because the omission is not an error and must not read like one. The open C7 is
// x32310 -- C, E and Bb, with no fifth anywhere in it -- and that is the shape every teacher
// gives. What has to be right is the naming: the missing note has to be called by the degree the
// chord makes it, so a ninth is not reported as a second, and a shape that is complete has to say
// nothing at all.
//
// Run with: node scripts/check-voicing-omissions.mjs

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
    PITCH_CLASSES, describeVoicingOmissions, voicingOmissions
} from '../src/shared/musicTheory.mjs';

const LIBRARY = path.join(import.meta.dirname, '..', 'src', 'assets', 'chords', 'chord-library.json');
const library = JSON.parse(fs.readFileSync(LIBRARY, 'utf8'));

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};

console.log('=== Every shape in the library ===');
let total = 0;
let incomplete = 0;
const degreeCounts = new Map();
const wrongNote = [];
const falsePositives = [];
const unnamedDegree = [];

for (const chord of library.chords) {
    for (const voicing of chord.voicings ?? []) {
        total++;
        const missing = voicingOmissions(chord.root, chord.suffix, voicing);
        const sounded = new Set((voicing.notes ?? []).map(name => PITCH_CLASSES[name]));

        // A note reported missing must genuinely not be in the shape.
        for (const item of missing) {
            if (sounded.has(PITCH_CLASSES[item.note])) {
                falsePositives.push(`${chord.name}: says it leaves out ${item.note}, which it sounds`);
            }
            if (item.degree === 'note') unnamedDegree.push(`${chord.name}: ${item.note}`);
            degreeCounts.set(item.degree, (degreeCounts.get(item.degree) ?? 0) + 1);
        }

        // And every note the chord wants but the shape does not sound must be reported.
        const expected = voicing.theory?.expected ?? [];
        const unreported = expected.filter(name =>
            !sounded.has(PITCH_CLASSES[name]) && !missing.some(item => item.note === name));
        if (unreported.length > 0) {
            wrongNote.push(`${chord.name}: silent on missing ${unreported.join(', ')}`);
        }

        const sentence = describeVoicingOmissions(chord.root, chord.suffix, voicing);
        if (missing.length === 0) {
            if (sentence !== null) {
                wrongNote.push(`${chord.name}: complete shape still says "${sentence}"`);
            }
        } else {
            incomplete++;
            if (!/^Leaves out the .*\.$/.test(sentence)) {
                wrongNote.push(`${chord.name}: badly formed line "${sentence}"`);
            }
        }
    }
}

console.log(`  ${incomplete} of ${total} shapes leave a note out`);
console.log(`  by degree: ${[...degreeCounts].sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `${name} ${count}`).join(', ')}`);
check('a complete shape says nothing and an incomplete one says one sentence',
    wrongNote.length === 0, wrongNote.slice(0, 5).join(' | '));
check('nothing is reported missing that the shape actually sounds',
    falsePositives.length === 0, falsePositives.slice(0, 5).join(' | '));
check('every missing note is named by its degree',
    unnamedDegree.length === 0, unnamedDegree.slice(0, 5).join(' | '));
// The fifth carries none of a chord's identity, so it is the one that gets dropped. If some other
// degree ever led this table, the degree naming would be the first thing to suspect.
check('the fifth is the note most often left out',
    [...degreeCounts].sort((a, b) => b[1] - a[1])[0]?.[0] === 'fifth',
    [...degreeCounts].sort((a, b) => b[1] - a[1])[0]?.join(' '));

console.log('\n=== The cases worth reading ===');
const sample = (root, suffix, index = 0) => {
    const chord = library.chords.find(c => c.root === root && c.suffix === suffix);
    const voicing = chord?.voicings?.[index];
    if (!voicing) return null;
    return {
        notes: voicing.notes.join(', '),
        line: describeVoicingOmissions(chord.root, chord.suffix, voicing)
    };
};

const c7 = sample('C', '7');
console.log(`  C7 open:   Notes: ${c7.notes}  /  ${c7.line}`);
check('the open C7 says the fifth is missing, and names it G',
    c7.line === 'Leaves out the fifth (G).', c7.line);

const c7barre = sample('C', '7', 1);
console.log(`  C7 barre:  Notes: ${c7barre.notes}  /  ${c7barre.line ?? '(nothing to say)'}`);
check('a complete C7 shape says nothing', c7barre.line === null, c7barre.line);

// An extended chord counts its degrees past the seventh: the D in C13 is a ninth, not a second.
for (const [root, suffix] of [['C', '13'], ['C', '11'], ['C', '9']]) {
    const chord = library.chords.find(c => c.root === root && c.suffix === suffix);
    for (const voicing of chord?.voicings ?? []) {
        const line = describeVoicingOmissions(root, suffix, voicing);
        if (!line) continue;
        console.log(`  ${chord.name} ${voicing.shape ?? 'fret ' + voicing.lowestFret}: ` +
            `Notes: ${voicing.notes.join(', ')}  /  ${line}`);
        check(`${chord.name} counts past the seventh`,
            !/\b(second|fourth|sixth)\b/.test(line), line);
        // Counted up through the chord, so the extensions follow the fifth rather than sorting
        // under it as their folded pitches would.
        const order = [...line.matchAll(/the (\w+) \(/g)].map(m => m[1]);
        const rank = { root: 1, third: 3, fifth: 5, seventh: 7, ninth: 9, eleventh: 11, thirteenth: 13 };
        check(`${chord.name} reads in the order the chord is built`,
            order.every((name, i) => i === 0 || rank[order[i - 1]] < rank[name]), order.join(' then '));
        break;
    }
}

// A sixth chord stops at the sixth, so the same note is named differently there.
const c6 = library.chords.find(c => c.root === 'C' && c.suffix === '6');
for (const voicing of c6?.voicings ?? []) {
    const line = describeVoicingOmissions('C', '6', voicing);
    if (!line) continue;
    console.log(`  C6 ${voicing.shape ?? 'fret ' + voicing.lowestFret}: ` +
        `Notes: ${voicing.notes.join(', ')}  /  ${line}`);
    check('a 6 chord is not read as a thirteenth', !/thirteenth/.test(line), line);
    break;
}

// More than one missing note has to read as a sentence, not a comma-separated dump.
const many = library.chords.flatMap(chord =>
    (chord.voicings ?? []).map(voicing => ({
        chord, voicing, missing: voicingOmissions(chord.root, chord.suffix, voicing)
    }))).filter(entry => entry.missing.length >= 3)[0];
if (many) {
    const line = describeVoicingOmissions(many.chord.root, many.chord.suffix, many.voicing);
    console.log(`  ${many.chord.name}: Notes: ${many.voicing.notes.join(', ')}  /  ${line}`);
    check('three missing notes are joined with commas and a final "and"',
        / and the /.test(line) && (line.match(/the /g) ?? []).length === 3, line);
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);

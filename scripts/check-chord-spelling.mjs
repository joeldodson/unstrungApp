// Checks that chord tones are named the way their chord requires.
//
// C sharp minor is C#, E, G# -- never C#, E, Ab. Both sound identical, so nothing that compares
// pitches can catch the difference, and the library named every note from one fixed table for a
// long time without anything noticing. These names are read aloud to work a shape out, so the
// spelling is the whole value of them.

import { readFile } from 'node:fs/promises';
import {
    CHORD_FORMULAS, IDENTIFY_SUFFIXES, PITCH_CLASSES, PITCH_CLASS_NAMES,
    parseSuffix, spellChordNotes, spellChordTone
} from '../src/shared/musicTheory.mjs';

const APP_DIR = `${import.meta.dirname}/..`.replace(/\\/g, '/');
const library = JSON.parse(await readFile(`${APP_DIR}/src/assets/chords/chord-library.json`, 'utf8'));

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};

console.log('=== Chords that used to be spelled wrong ===');
for (const [root, suffix, expected] of [
    ['C#', 'minor', 'C#, E, G#'],
    ['C#', 'major', 'C#, E#, G#'],
    ['F#', 'minor', 'F#, A, C#'],
    ['C', 'aug', 'C, E, G#'],
    ['C', '7b5', 'C, E, Gb, Bb'],
    ['Eb', 'minor', 'Eb, Gb, Bb'],
    ['B', 'major', 'B, D#, F#'],
    ['Ab', 'major', 'Ab, C, Eb']
]) {
    const spelled = spellChordNotes(root, suffix).join(', ');
    console.log(`      ${(root + suffix).padEnd(10)} ${spelled}`);
    check(`${root} ${suffix} spells ${expected}`, spelled === expected, spelled);
}

console.log('\n=== Every chord in the library keeps its letters in order ===');
// A triad's root, third and fifth take three different letters, two apart each time. Anything
// else means a note has been given the wrong letter, whatever its pitch.
const LETTERS = 'CDEFGAB';
const LETTER_SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** How many accidentals the strictly correct spelling of this chord tone would need. */
const accidentalsNeeded = (root, semitones, degree) => {
    const letter = LETTERS[(LETTERS.indexOf(root[0]) + degree - 1) % 7];
    const target = (PITCH_CLASSES[root] + semitones) % 12;
    let offset = (((target - LETTER_SEMITONES[letter]) % 12) + 12) % 12;
    if (offset > 6) offset -= 12;
    return Math.abs(offset);
};

const wrong = [];
let checked = 0, exempt = 0;
for (const root of PITCH_CLASS_NAMES) {
    for (const suffix of IDENTIFY_SUFFIXES) {
        const { base } = parseSuffix(suffix);
        const formula = CHORD_FORMULAS[base];
        if (!formula || !formula.includes(3) && !formula.includes(4)) continue;
        if (!formula.includes(7) && !formula.includes(6) && !formula.includes(8)) continue;

        const notes = spellChordNotes(root, suffix);
        if (notes.length === 0) continue;
        checked++;

        const rootIndex = LETTERS.indexOf(root[0]);
        const third = formula.includes(3) ? 3 : 4;
        const fifth = formula.includes(7) ? 7 : formula.includes(6) ? 6 : 8;

        // A chord whose correct spelling needs a double accidental is deliberately given the
        // plain enharmonic instead, which breaks the letter sequence on purpose.
        if (accidentalsNeeded(root, third, 3) > 1 || accidentalsNeeded(root, fifth, 5) > 1) {
            exempt++;
            continue;
        }

        const wantThird = LETTERS[(rootIndex + 2) % 7];
        const wantFifth = LETTERS[(rootIndex + 4) % 7];
        const letters = notes.map(n => n[0]);
        if (!letters.includes(wantThird) || !letters.includes(wantFifth)) {
            wrong.push(`${root}${suffix} [${notes.join(', ')}] wants ${wantThird} and ${wantFifth}`);
        }
    }
}
check(`all ${checked - exempt} triad-and-fifth chords use the right letters`, wrong.length === 0,
    wrong.slice(0, 6).join(' | '));
console.log(`  ${exempt} exempt, where the strict spelling would need a double accidental`);

console.log('\n=== Spelling never changes the pitch ===');
let pitchChecked = 0;
const mismatched = [];
for (const root of PITCH_CLASS_NAMES) {
    for (const suffix of IDENTIFY_SUFFIXES) {
        const { base } = parseSuffix(suffix);
        const formula = CHORD_FORMULAS[base];
        if (!formula) continue;
        const notes = spellChordNotes(root, suffix);
        for (const [index, interval] of formula.entries()) {
            const expectedPc = (PITCH_CLASSES[root] + interval) % 12;
            const actualPc = PITCH_CLASSES[notes[index]];
            pitchChecked++;
            if (actualPc !== expectedPc) {
                mismatched.push(`${root}${suffix}: ${notes[index]} should sound as ` +
                    `${PITCH_CLASS_NAMES[expectedPc]}`);
            }
        }
    }
}
check(`all ${pitchChecked} spelled notes sound the pitch they should`, mismatched.length === 0,
    mismatched.slice(0, 5).join(' | '));

console.log('\n=== The library on disk matches ===');
const libraryWrong = [];
for (const chord of library.chords) {
    if (chord.suffix.includes('/')) continue;
    const expected = new Set(spellChordNotes(chord.root, chord.suffix));
    if (expected.size === 0) continue;
    for (const voicing of chord.voicings) {
        for (const note of voicing.notes) {
            // A voicing may omit a chord tone, but must never introduce a spelling of its own.
            if (!expected.has(note)) libraryWrong.push(`${chord.name}: ${note} of [${voicing.notes.join(', ')}]`);
        }
    }
}
check('no voicing names a note its chord does not spell', libraryWrong.length === 0,
    libraryWrong.slice(0, 6).join(' | '));

console.log('\n=== Double accidentals fall back rather than being read out ===');
// B double flat is the correct seventh of C diminished 7 and is also not what a learner wants
// read to them. The pitch is the same either way.
const dim7 = spellChordNotes('C', 'dim7');
console.log(`      Cdim7 ${dim7.join(', ')}`);
check('no note carries a double accidental',
    library.chords.every(c => (c.notes ?? []).every(n => n.length <= 2)) &&
    dim7.every(n => n.length <= 2), dim7.join(', '));
check('the fallback still sounds right',
    PITCH_CLASSES[spellChordTone('C', 9, 7)] === 9, spellChordTone('C', 9, 7));

console.log('\n=== Notes are listed root first, then up through the chord ===');
for (const name of ['F#m', 'Bm', 'Bbm', 'Gmaj7', 'Am']) {
    const chord = library.chords.find(c => c.name === name);
    const notes = chord.voicings[0] ? chord.voicings[0].notes : chord.notes;
    console.log(`      ${name.padEnd(7)} ${notes.join(', ')}`);
    check(`${name} starts on its root`, notes[0] === chord.root, notes.join(', '));
}

let outOfOrder = 0;
for (const chord of library.chords) {
    if (chord.suffix.includes('/')) continue;
    const rootPc = PITCH_CLASSES[chord.root];
    for (const voicing of chord.voicings) {
        const intervals = voicing.notes.map(n => (((PITCH_CLASSES[n] - rootPc) % 12) + 12) % 12);
        if (intervals.some((v, i) => i > 0 && v < intervals[i - 1])) outOfOrder++;
    }
}
check('every voicing lists its notes in ascending order from the root', outOfOrder === 0,
    `${outOfOrder} out of order`);

console.log('\n=== Voicings whose bass is not the root are identifiable ===');
// Not an error: an A shape barred across all six strings genuinely sounds an inversion. But it
// has to be visible, or the chord name is quietly wrong.
let inverted = 0, total = 0;
for (const chord of library.chords) {
    if (chord.suffix.includes('/')) continue;
    const rootPc = PITCH_CLASSES[chord.root];
    for (const voicing of chord.voicings) {
        if (!voicing.midi?.length) continue;
        total++;
        if (((Math.min(...voicing.midi) % 12) + 12) % 12 !== rootPc) inverted++;
    }
}
console.log(`  ${inverted} of ${total} voicings sound something other than the root lowest`);
const bm = library.chords.find(c => c.name === 'Bm').voicings[0];
console.log(`  Bm first voicing: lowest MIDI ${Math.min(...bm.midi)}, notes [${bm.notes.join(', ')}]`);
check('the Bm A-shape barre is one of them',
    ((Math.min(...bm.midi) % 12) + 12) % 12 !== PITCH_CLASSES.B);
check('a fifth of voicings being inverted is worth reporting rather than hiding',
    inverted > 0 && inverted < total);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);

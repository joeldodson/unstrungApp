// Checks src/shared/measureChords.mjs: reading what is typed into the progression editor's chord
// field, writing it back, and when chord practice speaks each measure.
//
//   node scripts/progressions/check-measure-chords.mjs

import fs from 'node:fs';
import path from 'node:path';
import {
    parseMeasureChords, formatMeasureChords, chordsStruckLate, spokenMeasurePlan, spokenBeatVocabulary, SPOKEN_REPEAT,
    formatHarmony
} from '../../src/shared/measureChords.mjs';
import { chordDisplayName } from '../../src/shared/chordProgressions.mjs';
import { parseStrummingPattern, fitPattern } from '../../src/shared/strummingPatterns.mjs';

const root = path.join(import.meta.dirname, '..', '..');
const library = JSON.parse(fs.readFileSync(path.join(root, 'src', 'assets', 'chords', 'chord-library.json'), 'utf8'));
const byName = new Map(library.chords.map(entry => [chordDisplayName(entry), entry]));
// Case is forgiven, as the editor forgives it.
const folded = new Map([...byName].map(([name, entry]) => [name.toLowerCase(), entry]));
const chordByName = name => byName.get(name) ?? folded.get(name.toLowerCase()) ?? null;

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${condition ? '' : `  -- ${detail}`}`);
};

const read = (text, beatsPerBar = 4) => parseMeasureChords(text, { beatsPerBar, chordByName });
const placed = result => result.error ?? result.chords.map(c => `${chordDisplayName(c)}@${c.beat}`).join(' ');

console.log('\n=== Every chord name in the library is one word with no @ ===');
{
    const bad = [...byName.keys()].filter(name => /[\s@]/.test(name));
    check('so a list of them can be split on spaces', bad.length === 0, bad.join(', '));
}

console.log('\n=== Where chords start ===');
{
    const cases = [
        ['G', 4, 'G@1'],
        ['G D C Am', 4, 'G@1 D@2 C@3 Am@4'],
        ['G D C', 4, 'G@1 D@2 C@3'],
        ['G D C@4', 4, 'G@1 D@2 C@4'],
        ['G C@3', 4, 'G@1 C@3'],
        ['G C@2', 4, 'G@1 C@2'],
        ['C C G G', 4, 'C@1 G@3'],
        ['G@1 C@3', 4, 'G@1 C@3'],
        ['G C@2.5', 4, 'G@1 C@2.5'],
        // The next whole beat after an off-beat chord.
        ['G C@2.5 D', 4, 'G@1 C@2.5 D@3'],
        ['G C@2.25 D', 4, 'G@1 C@2.25 D@3'],
        ['G C@4.75', 4, 'G@1 C@4.75'],
        ['g am', 4, 'G@1 Am@2'],
        ['  G   C@3  ', 4, 'G@1 C@3'],
        ['G D C', 3, 'G@1 D@2 C@3'],
        ['G C@4', 6, 'G@1 C@4']
    ];
    for (const [text, beats, expected] of cases) {
        const got = placed(read(text, beats));
        check(`"${text}" in ${beats} beats is ${expected}`, got === expected, got);
    }
}

console.log('\n=== What is refused, and the reason given ===');
{
    const cases = [
        ['', /No chord/],
        ['G D C Am E', /no beat left in the measure for E/],
        ['G C@4.5 D', /no beat left in the measure for D/],
        ['G Xyz', /no chord named Xyz/],
        ['G @3', /no chord before the @/],
        ['G C@', /needs a beat after the @/],
        ['G C@three', /needs a beat after the @/],
        ['G C@2.3', /between sixteenths/],
        ['G C@5', /outside the measure, which has beats 1 to 4/],
        ['G C@0.5', /outside the measure/],
        ['G@2 C', /first chord starts on beat 1/],
        ['G C@3 D@2', /D@2 does not start after the chord before it, which starts on 3/],
        ['G C@3 D@3', /does not start after/]
    ];
    for (const [text, reason] of cases) {
        const result = read(text);
        check(`"${text}" is refused`, reason.test(result.error ?? ''), result.error ?? placed(result));
    }
}

console.log('\n=== Written back the shortest way ===');
{
    for (const [text, expected] of [
        ['G', 'G'], ['G D C Am', 'G D C Am'], ['G C@3', 'G C@3'], ['G D C@4', 'G D C@4'],
        ['C C G G', 'C G@3'], ['G@1 D@2', 'G D'], ['G C@2.5 D@3', 'G C@2.5 D'], ['G C@2.5 D@3.5', 'G C@2.5 D@3.5']
    ]) {
        const written = formatMeasureChords(read(text).chords);
        check(`"${text}" is written "${expected}"`, written === expected, written);
        check(`and "${expected}" reads the same`, placed(read(written)) === placed(read(text)), placed(read(written)));
    }
}

console.log('\n=== Chords the pattern does not strike where they start ===');
{
    const pattern = text => {
        const { slots } = parseStrummingPattern(text);
        return { slots, slotsPerBeat: fitPattern(slots, 4).slotsPerBeat };
    };
    const late = (text, strokes) => chordsStruckLate(read(text).chords, pattern(strokes), 4)
        .map(({ chord, heardAt }) => `${chordDisplayName(chord)} ${heardAt ?? 'never'}`).join(', ');
    check('C@2.5 with Down Only is first heard on 3', late('G C@2.5', 'D D D D') === 'C 3', late('G C@2.5', 'D D D D'));
    check('C@2.5 with All Down-Up is struck where it starts', late('G C@2.5', 'D U D U D U D U') === '', late('G C@2.5', 'D U D U D U D U'));
    check('C@3 with Old Faithful, a miss on 3, is first heard on the and of 3',
        late('G C@3', 'D - D U - U D U') === 'C 3.5', late('G C@3', 'D - D U - U D U'));
    check('C@2.5 then D@3 with Down Only: C is never heard', late('G C@2.5 D', 'D D D D') === 'C never', late('G C@2.5 D', 'D D D D'));
}

console.log('\n=== When each measure is spoken ===');
{
    // Round numbers standing in for the recordings: a chord name 0.4 s, "repeat" 0.35 s.
    const speechSeconds = word => (word === SPOKEN_REPEAT ? 0.35 : word === 'missing' ? undefined : 0.4);
    const measures = texts => texts.map(text => read(text).chords.map(c => ({ name: chordDisplayName(c), beat: c.beat })));
    const plan = (texts, tempo) => spokenMeasurePlan(measures(texts), {
        secondsPerBeat: 60 / tempo, beatsPerBar: 4, speechSeconds
    });
    const say = entry => (entry ? `${entry.words.join(' ')} from ${entry.offsetSeconds.toFixed(2)}` : 'nothing');

    const slow = plan(['G', 'C', 'C', 'G D C Am', 'G D C Am', 'G C', 'G C@3', 'G D C@4'], 60);
    check('one chord: one beat before the measure', say(slow[0]) === 'G from -1.00', say(slow[0]));
    check('a different chord: the same', say(slow[1]) === 'C from -1.00', say(slow[1]));
    check('the same as the measure before: "repeat"', say(slow[2]) === 'repeat from -1.00', say(slow[2]));
    // 4 x 0.4 + 3 x 0.08 = 1.84, finishing 0.1 before the downbeat.
    check('four chords: all of them, finishing just before the measure', say(slow[3]) === 'G D C Am from -1.94', say(slow[3]));
    check('the same four again: "repeat"', say(slow[4]) === 'repeat from -1.00', say(slow[4]));
    // 0.4 + 0.08 + 0.4 = 0.88, which fits in the beat before.
    check('two chords that fit in a beat: one beat before', say(slow[5]) === 'G C from -1.00', say(slow[5]));
    // 3 x 0.4 + 2 x 0.08 + 0.1 = 1.46.
    check('a chord written with an @ is followed by where it starts', say(slow[6]) === 'G C at 3 from -1.46', say(slow[6]));
    check('only the chord with an @ gets its beat', say(slow[7]) === 'G D C at 4 from -1.94', say(slow[7]));
    const noBeat = spokenMeasurePlan(measures(['G C@3']), {
        secondsPerBeat: 1, beatsPerBar: 4, speechSeconds: word => (word.startsWith('at ') ? undefined : 0.4)
    });
    check('without a recording of the beat, the names are said', say(noBeat[0]) === 'G C from -1.00', say(noBeat[0]));
    const beats = spokenBeatVocabulary(16);
    check('a recording is made for every quarter beat from 1.25 to 16.75',
        beats.length === 63 && beats[0] === 'at 1.25' && beats.includes('at 2.5') && beats.includes('at 3') &&
        beats[62] === 'at 16.75', `${beats.length}: ${beats[0]} .. ${beats[62]}`);

    // At 180 a measure is 1.33 s, too short for four names.
    const fast = plan(['G', 'G D C Am', 'C'], 180);
    check('too many names for the measure: only the first', say(fast[1]) === 'G from -0.33', say(fast[1]));
    // At 140 a measure is 1.71 s; four names need 1.94 s.
    const medium = plan(['G D C Am', 'C'], 140);
    check('a first measure has a whole measure before it, and no more', say(medium[0]) === 'G from -0.43', say(medium[0]));

    const repeatFirst = plan(['G', 'G'], 60);
    check('the first measure is never "repeat"', say(repeatFirst[0]) === 'G from -1.00', say(repeatFirst[0]));
    const noRecording = spokenMeasurePlan([[{ name: 'missing', beat: 1 }], [{ name: 'G', beat: 1 }]],
        { secondsPerBeat: 1, beatsPerBar: 4, speechSeconds });
    check('a chord with no recording is not spoken', say(noRecording[0]) === 'nothing' && say(noRecording[1]) === 'G from -1.00',
        noRecording.map(say).join('; '));
    const noRepeat = spokenMeasurePlan(measures(['G', 'G']), {
        secondsPerBeat: 1, beatsPerBar: 4, speechSeconds: word => (word === SPOKEN_REPEAT ? undefined : 0.4)
    });
    check('without a recording of "repeat", the names are said', say(noRepeat[1]) === 'G from -1.00', say(noRepeat[1]));
}

// Where Am I says a measure's harmony, printed and carried forward, as the editor writes chords.
console.log('\n=== A printed harmony written as the editor writes it ===');
check('one chord is its name', formatHarmony([{ name: 'G', beat: 1 }]) === 'G');
check('the next whole beat needs no @', formatHarmony([{ name: 'G', beat: 1 }, { name: 'D', beat: 2 }]) === 'G D');
check('a later one says its beat', formatHarmony([{ name: 'G', beat: 1 }, { name: 'C', beat: 3 }]) === 'G C@3');
check('one between beats too', formatHarmony([{ name: 'Am', beat: 1 }, { name: 'F#m', beat: 2.5 }]) === 'Am F#m@2.5');
check('a measure whose first chord comes late says so', formatHarmony([{ name: 'C', beat: 3 }]) === 'C@3');
check('none is nothing', formatHarmony([]) === '');

console.log(failures ? `\n${failures} failed.` : '\nAll passed.');
process.exitCode = failures ? 1 : 0;

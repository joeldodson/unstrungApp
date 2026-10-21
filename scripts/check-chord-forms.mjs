// Checks the chord form rules of docs/chord-forms-in-scores.md on tracks written out by hand.
//
// Each case is a few measures of standard-tuned guitar and the heading each measure should get.
// The shapes are generic open chords, not taken from any song file.
//
// Notes are written "s6:3", string and fret in tab numbering. "s4:0>" starts a hammer-on or
// pull-off and "<s4:2" ends one. Events are [beat, length, notes] in beats of the time signature.
//
// Run with: node scripts/check-chord-forms.mjs [--return next|string]

import * as fs from 'node:fs';
import * as path from 'node:path';
import { findChordForms } from '../src/shared/chordForms.mjs';

const root = path.join(import.meta.dirname, '..');
const library = JSON.parse(fs.readFileSync(path.join(root, 'src', 'assets', 'chords', 'chord-library.json'), 'utf8'));

const OPEN = { 6: 40, 5: 45, 4: 50, 3: 55, 2: 59, 1: 64 };
const note = text => {
    const match = /^(<)?s(\d):(\d+)(>)?$/.exec(text);
    const [string, fret] = [Number(match[2]), Number(match[3])];
    return { string, fret, midi: OPEN[string] + fret, slurIn: !!match[1], slurOut: !!match[4] };
};
const measure = (events, symbols = []) => ({
    beatsPerBar: 4,
    events: events.map(([beat, length, notes]) => ({ beat, length, notes: notes.split(' ').map(note) })),
    symbols: symbols.map(([name, beat]) => ({ name, beat }))
});

// Eighth notes picked through a shape, one string at a time, from beat 1.
const picked = strings => strings.map((s, i) => [1 + i / 2, 0.5, s]);
// A shape strummed on each beat.
const strummed = (shape, beats = [1, 2, 3, 4]) => beats.map(beat => [beat, 1, shape]);

const G = 's6:3 s5:2 s4:0 s3:0 s2:0 s1:3';
const C = 's5:3 s4:2 s3:0 s2:1 s1:0';
const Abm = 's6:4 s5:6 s4:6 s3:4 s2:4 s1:4';
// G with strings 2 and 1 at fret 3, and G with string 5 left out.
const G2 = 's6:3 s5:2 s4:0 s3:0 s2:3 s1:3';
const Gx = 's6:3 s4:0 s3:0 s2:0 s1:3';

const cases = [
    {
        name: 'a G picked through, with one note off it, carried into the next measure',
        measures: [
            measure(picked(['s6:3', 's4:0', 's3:0', 's5:2', 's4:0', 's5:3', 's4:0', 's3:0'])),
            measure(picked(['s6:3', 's4:0', 's3:0', 's2:0', 's1:3', 's2:0', 's3:0', 's4:0']))
        ],
        headings: ['holds G, one exception', 'continues G'],
        chords: [['G', '320003']]
    },
    {
        name: 'a change of form partway through a measure',
        measures: [measure([...strummed(G, [1, 2]), ...strummed(C, [3, 4])]), measure(strummed(C))],
        headings: ['holds G for 2 beats, holds C at beat 3', 'continues C']
    },
    {
        name: 'two open strings after a G are part of the G, not a G5',
        measures: [measure(strummed(G)), measure(strummed('s4:0 s3:0'))],
        headings: ['holds G', 'continues G'],
        noChord: 'G5'
    },
    {
        name: 'a form ending with notes after it that hold nothing',
        measures: [measure([...strummed(G, [1, 2]), [3, 0.5, 's1:1'], [3.5, 0.5, 's1:4'], [4, 0.5, 's1:6'], [4.5, 0.5, 's1:8']])],
        headings: ['holds G for 2 beats']
    },
    {
        name: 'string 4 at two frets in a C, decided by the C the track holds elsewhere',
        measures: [
            measure(strummed(C)), measure(strummed(G)),
            measure([[1, 1, 's5:3'], [2, 1, 's3:0 s2:1 s1:0'], [3, 0.5, 's4:0'], [3.5, 0.5, 's4:2'], [4, 0.5, 's3:0'], [4.5, 0.5, 's4:0']]),
            measure(strummed(G))
        ],
        headings: ['holds C', 'holds G', 'holds C, two exceptions', 'holds G'],
        decidedBy: 'held elsewhere in the track'
    },
    {
        name: 'the same measure with no C elsewhere, decided by fewest exceptions',
        measures: [
            measure(strummed(G)),
            measure([[1, 1, 's5:3'], [2, 1, 's3:0 s2:1 s1:0'], [3, 0.5, 's4:0'], [3.5, 0.5, 's4:2'], [4, 0.5, 's3:0'], [4.5, 0.5, 's4:0']]),
            measure(strummed(G))
        ],
        headings: ['holds G', 'holds Cadd9, one exception', 'holds G'],
        decidedBy: 'fewest exceptions'
    },
    {
        name: 'the fret strummed with the shape is the form, ahead of a form held elsewhere',
        measures: [
            measure(strummed('s6:3 s5:0 s4:0 s3:0 s2:3 s1:3')),
            measure(strummed(C)),
            // String 5 is struck at fret 2 with the low strings once, then picked open and back to 2.
            measure([[1, 1, 's6:3 s5:2 s4:0'], [2, 0.5, 's5:0'], [2.5, 0.5, 's5:2'], [3, 1, 's3:0 s2:3 s1:3'], [4, 1, 's4:0 s3:0']]),
            measure([[1, 1, 's3:0 s2:3 s1:3'], [2, 1, 's4:0 s3:0'], [3, 1, 's3:0 s2:3 s1:3'], [4, 1, 's4:0']])
        ],
        headings: ['holds Gsus2', 'holds C', 'holds G, one exception', 'continues G'],
        decidedBy: 'strummed with the shape'
    },
    {
        name: 'a lone note heard once in a measure is a passing note, not part of the form',
        measures: [measure([[1, 1, Gx], [2, 1, Gx], [3, 1, 's5:0'], [4, 1, Gx]])],
        headings: ['holds G, one exception'],
        chords: [['G', '3x0003']],
        noChord: 'Gadd9'
    },
    {
        name: 'a lone bass note heard once that makes a seventh is a passing note too',
        measures: [measure([[1, 1, 's4:0 s3:2 s2:3 s1:2'], [2, 1, 's3:2 s2:3'], [3, 1, 's5:4'], [4, 1, 's4:0 s3:2 s2:3 s1:2']])],
        headings: ['holds D, one exception'],
        noChord: 'Dmaj7'
    },
    {
        name: 'a passing note still counts towards the printed chord',
        // Dm picked under a printed F, with a C heard once on string 5: Dm alone is a different
        // chord from F, Dm with the C holds all of it.
        measures: [measure([[1, 1, 's4:0 s3:2 s2:3 s1:1'], [2, 1, 's4:0'], [3, 1, 's5:3'], [4, 1, 's4:0 s3:2 s2:3 s1:1']], [['F', 1]])],
        headings: ['holds F, one exception'],
        kinds: ['agree'],
        anomalies: 0
    },
    {
        name: 'a printed chord holds until the next, so a note in the measure after counts',
        // Printed F over a measure of D, F and A; the C comes in the next measure, before the G.
        measures: [
            measure([[1, 1, 's4:0 s2:6 s1:5'], [2, 1, 's4:0'], [3, 1, 's2:6'], [4, 1, 's1:5']], [['F', 1]]),
            measure([[1, 1, 's4:0 s2:6 s1:5'], [2, 1, 's3:5'], [3, 1, 's2:6'], [4, 1, 's4:0 s2:6 s1:5']]),
            measure(strummed(G), [['G', 1]])
        ],
        headings: ['holds F', 'continues F, one exception', 'holds G'],
        kinds: ['agree', 'agree'],
        anomalies: 0
    },
    {
        name: 'a lone note repeated through the pattern is part of the form',
        measures: [measure([[1, 1, Gx], [2, 1, 's5:0'], [3, 1, Gx], [4, 1, 's5:0']])],
        headings: ['holds Gadd9']
    },
    {
        name: 'a hammer-on and pull-off off the form count as one exception',
        measures: [measure([[1, 1, G], [2, 0.5, 's3:2>'], [2.5, 0.5, '<s3:4'], [3, 1, 's3:0'], [4, 1, G]])],
        headings: ['holds G, one exception']
    },
    {
        name: 'the same notes picked, not slurred, leave the form',
        measures: [measure([[1, 1, G], [2, 0.5, 's3:2'], [2.5, 0.5, 's3:4'], [3, 1, 's3:0'], [4, 1, G]])],
        notHeading: 'holds G, one exception'
    },
    {
        name: 'a change written at beat 1 found at beat 1, though its first note fits both forms',
        measures: [measure(strummed(G)), measure([[1, 1, 's3:0'], ...strummed(C, [2, 3, 4])])],
        headings: ['holds G', 'holds C']
    },
    {
        name: 'a printed symbol that agrees gives its own spelling',
        measures: [measure(strummed(Abm), [['G#m', 1]])],
        headings: ['holds G#m'],
        kinds: ['agree']
    },
    {
        name: 'part of the printed chord agrees with it: a D picked without its third',
        measures: [
            measure(picked(['s4:0', 's3:2', 's2:3', 's3:2', 's4:0', 's3:2', 's2:3', 's3:2']), [['D', 1]]),
            measure(picked(['s4:0', 's3:2', 's2:3', 's3:2', 's4:0', 's3:2', 's2:3', 's3:2']))
        ],
        headings: ['holds D', 'continues D'],
        kinds: ['agree'],
        chords: [['D', 'xx023x']],
        noChord: 'D5'
    },
    {
        name: 'the printed chord with notes added agrees with it: a Cadd9 shape under a C',
        measures: [measure(strummed('s5:3 s4:2 s3:0 s2:3 s1:3'), [['C', 1]])],
        headings: ['holds C'],
        kinds: ['agree'],
        anomalies: 0
    },
    {
        name: 'a printed symbol the held form contradicts is an anomaly',
        measures: [measure(strummed(G), [['C', 1]])],
        headings: ['C (anomaly)'],
        kinds: ['differ'],
        anomalies: 1
    },
    {
        name: 'a melody that fits the printed chord is harmony',
        measures: [measure([[1, 1, 's1:3'], [2, 1, 's1:7'], [3, 1, 's1:10'], [4, 1, 's1:5']], [['G', 1]])],
        headings: ['G (harmony)'],
        kinds: ['harmony']
    },
    {
        name: 'a melody that clashes with the printed chord is an anomaly',
        measures: [measure([[1, 1, 's1:1'], [2, 1, 's1:4'], [3, 1, 's1:6'], [4, 1, 's1:3']], [['G', 1]])],
        headings: ['G (anomaly)'],
        kinds: ['clash'],
        anomalies: 1
    }
];

let failed = 0;
for (const testCase of cases) {
    const returnRule = process.argv[process.argv.indexOf('--return') + 1];
    const result = findChordForms(testCase.measures, { library, ...(process.argv.includes('--return') ? { returnRule } : {}) });
    const headings = result.measures.map(m => m.heading);
    const problems = [];
    if (testCase.headings && JSON.stringify(headings) !== JSON.stringify(testCase.headings)) {
        problems.push(`headings ${JSON.stringify(headings)}, expected ${JSON.stringify(testCase.headings)}`);
    }
    if (testCase.notHeading && headings.includes(testCase.notHeading)) problems.push(`heading ${JSON.stringify(testCase.notHeading)} should not appear`);
    if (testCase.decidedBy && !result.spans.some(span => span.decidedBy === testCase.decidedBy)) {
        problems.push(`no span decided by "${testCase.decidedBy}"; got ${JSON.stringify(result.spans.map(span => span.decidedBy))}`);
    }
    if (testCase.kinds) {
        const kinds = result.measures.flatMap(m => m.symbols.map(s => s.kind));
        if (JSON.stringify(kinds) !== JSON.stringify(testCase.kinds)) problems.push(`symbol kinds ${JSON.stringify(kinds)}, expected ${JSON.stringify(testCase.kinds)}`);
    }
    if (testCase.anomalies !== undefined && result.anomalies.length !== testCase.anomalies) {
        problems.push(`${result.anomalies.length} anomalies, expected ${testCase.anomalies}`);
    }
    for (const [name, fingering] of testCase.chords ?? []) {
        const chord = result.chords.find(c => c.name === name);
        if (!chord || chord.fingering !== fingering) problems.push(`${name} fingering ${chord?.fingering}, expected ${fingering}`);
    }
    if (testCase.noChord && result.chords.some(c => c.name === testCase.noChord)) problems.push(`Chords Used lists ${testCase.noChord}`);

    if (problems.length > 0) {
        failed++;
        console.log(`FAIL ${testCase.name}`);
        for (const problem of problems) console.log(`  ${problem}`);
    } else {
        console.log(`ok   ${testCase.name}`);
    }
}
console.log(`\n${cases.length - failed} of ${cases.length} cases pass.`);
process.exitCode = failed > 0 ? 1 : 0;

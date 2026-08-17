// Checks on scoreMetadata for things no file in this repository contains.
//
// Sections and percussion tracks are both absent from musicfiles/ -- Ripple has neither -- and the
// files that do carry them are licensed to one person and cannot be committed. scoreMetadata.mjs
// takes plain objects and imports no alphaTab, which was done so it could run standalone; this is
// that. The shapes below mirror what alphaTab hands it, drawn from real files.
//
// Run: node scripts/gp-experiment/verify-synthetic-score.mjs

import { extractScoreMetadata } from '../../src/shared/scoreMetadata.mjs';

let failures = 0;
const check = (label, actual, expected) => {
    const ok = actual === expected;
    if (!ok) failures++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}`);
    if (!ok) console.log(`          expected: ${expected}\n          actual:   ${actual}`);
};

const masterBar = (extra = {}) => ({
    timeSignatureNumerator: 4, timeSignatureDenominator: 4, keySignature: 0, section: null, ...extra
});
const beat = (notes, extra = {}) => ({
    isRest: false, notes, duration: 4, dots: 0, hasChord: false, chord: null,
    playbackStart: 0, brushType: 0, pickStroke: 0, vibrato: 0, ...extra
});
const bar = beats => ({ voices: [{ beats }] });

// alphaTab numbers strings from the lowest pitch, so string 1 is the low E and prints as tab
// string 6. Fret 3 of it is G2, MIDI 43.

console.log('=== A percussion track is named by drum, not by pitch ===');
{
    // Articulation lists come straight off the track, indexed by note.percussionArticulation.
    // These entries are the ones a real Songsterr kit uses; note that Guitar Pro's own name
    // collapses three hi-hats into "Charley" and two different sounds into "Snare".
    const articulations = [
        { elementType: 'Snare', outputMidiNumber: 38 },
        { elementType: 'Kick Drum', outputMidiNumber: 36 },
        { elementType: 'Charley', outputMidiNumber: 42 },
        { elementType: 'Charley', outputMidiNumber: 46 },
        { elementType: 'Snare', outputMidiNumber: 37 },
        { elementType: 'Crash High', outputMidiNumber: 49 },
        { elementType: 'Nonexistent Gadget', outputMidiNumber: 999 }
    ];
    const hit = index => ({ isStringed: false, percussionArticulation: index, realValue: 22 });

    const score = {
        title: 'Synthetic', tempo: 120, masterBars: [masterBar(), masterBar()],
        tracks: [{
            name: 'Drums', isPercussion: true, playbackInfo: { program: 0 },
            percussionArticulations: articulations,
            staves: [{
                isStringed: false, tuning: [], capo: 0, tuningName: '',
                bars: [
                    bar([beat([hit(1), hit(2)]), beat([hit(0)]), beat([hit(3)]), beat([hit(5), hit(1)])]),
                    bar([beat([hit(4)]), beat([hit(6)])])
                ]
            }]
        }]
    };

    const track = extractScoreMetadata(score).tracks[0];
    check('kick and closed hi-hat together', track.measures[0].beats[0], 'quarter note, bass drum; closed hi-hat');
    check('snare', track.measures[0].beats[1], 'quarter note, acoustic snare');
    check('open hi-hat is not confused with the closed one', track.measures[0].beats[2], 'quarter note, open hi-hat');
    check('crash with kick', track.measures[0].beats[3], 'quarter note, crash cymbal 1; bass drum');
    check('side stick is not just called a snare', track.measures[1].beats[0], 'quarter note, side stick');
    check('an articulation outside the map falls back to the file\'s own name',
        track.measures[1].beats[1], 'quarter note, nonexistent gadget');
    check('a drum track lists no chords', track.chords.length, 0);
    check('and is not reported as stringed', track.isStringed, false);
}

console.log('\n=== A section name reaches the measure it starts on ===');
{
    const note = { isStringed: true, string: 1, fret: 3, realValue: 43, isDead: false };
    const score = {
        title: 'Synthetic', tempo: 120,
        masterBars: [
            masterBar({ section: { text: 'Intro', marker: '' } }),
            masterBar(),
            masterBar({ section: { text: '', marker: 'B' } }),
            masterBar({ section: { text: '   ', marker: '' } })
        ],
        tracks: [{
            name: 'Guitar', isPercussion: false, playbackInfo: { program: 25 },
            staves: [{
                isStringed: true, tuning: [64, 59, 55, 50, 45, 40], capo: 0, tuningName: '',
                bars: [bar([beat([note])]), bar([beat([note])]), bar([beat([note])]), bar([beat([note])])]
            }]
        }]
    };

    const measures = extractScoreMetadata(score).tracks[0].measures;
    check('the section is on the measure it begins', measures[0].section, 'Intro');
    check('and on no other', measures[1].section, null);
    check('a marker stands in when there is no text', measures[2].section, 'B');
    check('whitespace is not a section name', measures[3].section, null);
}

console.log('\n=== Lyrics reach every track, labelled per singer ===');
{
    // Invented words, so no real lyric is reproduced in this repository. "sil-" and "ver" are a
    // hyphenated pair, which is how Guitar Pro says one word spans two notes.
    const note = { isStringed: true, string: 1, fret: 3, realValue: 43, isDead: false };
    const sung = (realValue, syllable) => ({ isStringed: true, string: 2, fret: 3, realValue, isDead: false });

    const vocalTrack = (name, wordsPerBar) => ({
        name, isPercussion: false, playbackInfo: { program: 85 },
        staves: [{
            isStringed: true, tuning: [64, 59, 55, 50, 45, 40], capo: 0, tuningName: '',
            bars: wordsPerBar.map(words => bar(words.map(syllable =>
                beat([sung(62, syllable)], { lyrics: [syllable] }))))
        }]
    });

    const guitar = {
        name: 'Guitar', isPercussion: false, playbackInfo: { program: 25 },
        staves: [{
            isStringed: true, tuning: [64, 59, 55, 50, 45, 40], capo: 0, tuningName: '',
            bars: [bar([beat([note])]), bar([beat([note])])]
        }]
    };

    // One singer: no label needed, and the hyphen joins the word back together.
    const solo = extractScoreMetadata({
        title: 'Synthetic', tempo: 120, masterBars: [masterBar(), masterBar()],
        tracks: [guitar, vocalTrack('Some Singer | Vocals', [['sil-', 'ver', 'rain'], []])]
    });
    check('one singer needs no label', solo.tracks[0].measures[0].lyrics[0], 'Words: silver rain');
    check('a measure with no words gets none', solo.tracks[0].measures[1].lyrics.length, 0);
    check('the guitar track gets the words too', solo.tracks[0].measures[0].lyrics.length, 1);
    check('and so does the singer', solo.tracks[1].measures[0].lyrics[0], 'Words: silver rain');

    // Two singers, differing in the first part of the name.
    const duet = extractScoreMetadata({
        title: 'Synthetic', tempo: 120, masterBars: [masterBar(), masterBar()],
        tracks: [
            guitar,
            vocalTrack('Ada Lovelace | Lead Vocals', [['one', 'two'], []]),
            vocalTrack('Alan Turing | Lead Vocals', [['three'], ['four']])
        ]
    });
    check('two singers get one line each, in track order',
        duet.tracks[0].measures[0].lyrics.join(' / '),
        'Words, Ada Lovelace: one two / Words, Alan Turing: three');
    check('and a measure only one of them sings gets only that one',
        duet.tracks[0].measures[1].lyrics.join(' / '), 'Words, Alan Turing: four');

    // Two parts sung by the same person: the differing part is the role, not the name.
    const roles = extractScoreMetadata({
        title: 'Synthetic', tempo: 120, masterBars: [masterBar()],
        tracks: [
            guitar,
            vocalTrack('Ada Lovelace | Lead Vocals', [['high']]),
            vocalTrack('Ada Lovelace | Backing Vocals', [['low']])
        ]
    });
    check('the label is whichever part of the name differs',
        roles.tracks[0].measures[0].lyrics.join(' / '),
        'Words, Lead Vocals: high / Words, Backing Vocals: low');
}

console.log('\n=== A sung note is a pitch, and carries its syllable ===');
{
    const sungNote = { isStringed: true, string: 2, fret: 3, realValue: 62, isDead: false };
    const score = {
        title: 'Synthetic', tempo: 120, masterBars: [masterBar()],
        tracks: [{
            name: 'Vocals', isPercussion: false, playbackInfo: { program: 85 },
            staves: [{
                isStringed: true, tuning: [64, 59, 55, 50, 45, 40], capo: 0, tuningName: '',
                bars: [bar([
                    beat([sungNote], { lyrics: ['sil-'] }),
                    beat([sungNote], { lyrics: ['ver'] }),
                    beat([sungNote])
                ])]
            }]
        }]
    };
    const beats = extractScoreMetadata(score).tracks[0].measures[0].beats;
    check('a sung note is given as a pitch, not a fret', beats[0], 'quarter note, D4, "sil-"');
    check('the next syllable lands on the next note', beats[1], 'quarter note, D4, "ver"');
    check('a sung note with no syllable is still a pitch', beats[2], 'quarter note, D4');
}

console.log('\n=== Tuplets change the duration, so they are named ===');
{
    const note = { isStringed: true, string: 1, fret: 3, realValue: 43, isDead: false };
    const tuplet = (numerator, denominator, duration = 16) =>
        beat([note], { duration, hasTuplet: true, tupletNumerator: numerator, tupletDenominator: denominator });
    const score = {
        title: 'Synthetic', tempo: 120, masterBars: [masterBar()],
        tracks: [{
            name: 'Guitar', isPercussion: false, playbackInfo: { program: 25 },
            staves: [{
                isStringed: true, tuning: [64, 59, 55, 50, 45, 40], capo: 0, tuningName: '',
                bars: [bar([tuplet(3, 2), tuplet(5, 4, 8), tuplet(7, 3), beat([note])])]
            }]
        }]
    };
    const beats = extractScoreMetadata(score).tracks[0].measures[0].beats;
    check('a 3:2 is a triplet', beats[0], 'sixteenth note triplet, string 6, fret 3');
    check('a 5:4 is a quintuplet', beats[1], 'eighth note quintuplet, string 6, fret 3');
    check('an unconventional ratio is spelled out',
        beats[2], 'sixteenth note, 7 in the time of 3, string 6, fret 3');
    check('a plain note is unchanged', beats[3], 'quarter note, string 6, fret 3');
}

console.log('\n=== Let ring is marked at the ends of its run, not on every beat ===');
{
    const ringing = { isStringed: true, string: 1, fret: 3, realValue: 43, isDead: false, isLetRing: true };
    const plain = { isStringed: true, string: 1, fret: 3, realValue: 43, isDead: false };
    const score = {
        title: 'Synthetic', tempo: 120, masterBars: [masterBar(), masterBar()],
        tracks: [{
            name: 'Guitar', isPercussion: false, playbackInfo: { program: 25 },
            staves: [{
                isStringed: true, tuning: [64, 59, 55, 50, 45, 40], capo: 0, tuningName: '',
                bars: [
                    // A run that carries on over the bar line, then a single ringing note.
                    bar([beat([plain]), beat([ringing]), beat([ringing])]),
                    bar([beat([ringing]), beat([plain]), beat([ringing])])
                ]
            }]
        }]
    };
    const measures = extractScoreMetadata(score).tracks[0].measures;
    check('nothing before the run', measures[0].beats[0], 'quarter note, string 6, fret 3');
    check('the run begins', measures[0].beats[1], 'quarter note, string 6, fret 3, let ring begins');
    check('and says nothing in the middle', measures[0].beats[2], 'quarter note, string 6, fret 3');
    check('the run ends across the bar line', measures[1].beats[0], 'quarter note, string 6, fret 3, let ring ends');
    check('a single ringing note is just marked', measures[1].beats[2], 'quarter note, string 6, fret 3, let ring');
}

console.log('\n=== Repeats, beat text, feel and tempo changes ===');
{
    const note = { isStringed: true, string: 1, fret: 3, realValue: 43, isDead: false };
    const score = {
        title: 'Synthetic', tempo: 120,
        masterBars: [
            masterBar({ tripletFeel: 2, tempoAutomations: [{ value: 120 }] }),
            masterBar({ tripletFeel: 2, isRepeatStart: true }),
            masterBar({ tripletFeel: 2, alternateEndings: 0b1, repeatCount: 2 }),
            masterBar({ tripletFeel: 2, alternateEndings: 0b110, tempoAutomations: [{ value: 80 }] })
        ],
        tracks: [{
            name: 'Guitar', isPercussion: false, playbackInfo: { program: 25 },
            staves: [{
                isStringed: true, tuning: [64, 59, 55, 50, 45, 40], capo: 0, tuningName: '',
                bars: [
                    bar([beat([note], { text: 'tune to Open G' })]),
                    bar([beat([note])]), bar([beat([note])]), bar([beat([note])])
                ]
            }]
        }]
    };
    const meta = extractScoreMetadata(score);
    const measures = meta.tracks[0].measures;
    check('a repeat start is reported', measures[1].repeat, 'repeat starts here');
    check('an ending and a repeat end together', measures[2].repeat, '1st ending, repeat ends here, played 2 times');
    check('a bar used for two endings names both', measures[3].repeat, '2nd and 3rd ending');
    check('a bar with no repeat marks says nothing', measures[0].repeat, null);
    check('beat text is given verbatim', measures[0].beats[0],
        'quarter note, string 6, fret 3, text "tune to Open G"');
    check('a swung song says so', meta.feel, 'triplet eighths (swung)');
    check('and a tempo change is flagged', meta.tempoVaries, true);
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);

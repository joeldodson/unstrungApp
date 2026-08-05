// Music theory fundamentals shared by the chord-library build script (Node) and the
// renderer (bundled by esbuild). Keep this dependency-free so both can import it.

// Standard guitar tuning. String 1 is the highest-pitched string (high E), matching
// MusicXML's own convention for <string> in chord diagrams and tablature.
export const STANDARD_TUNING_MIDI = { 6: 40, 5: 45, 4: 50, 3: 55, 2: 59, 1: 64 };
export const STANDARD_TUNING_NAMES = { 6: 'E2', 5: 'A2', 4: 'D3', 3: 'G3', 2: 'B3', 1: 'E4' };
export const STRING_NUMBERS = [6, 5, 4, 3, 2, 1];

// Flat spellings: a single name per pitch class is enough for verification, which only
// ever compares pitch classes, never enharmonic spelling.
export const PITCH_CLASS_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export const PITCH_CLASSES = {
    C: 0, 'B#': 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4,
    F: 5, 'E#': 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11
};

// Intervals in semitones above the root.
export const CHORD_FORMULAS = {
    major: [0, 4, 7], minor: [0, 3, 7], m: [0, 3, 7],
    dim: [0, 3, 6], dim7: [0, 3, 6, 9], aug: [0, 4, 8],
    sus: [0, 5, 7], sus4: [0, 5, 7], sus2: [0, 2, 7], sus2sus4: [0, 2, 5, 7],
    5: [0, 7], 6: [0, 4, 7, 9], 69: [0, 4, 7, 9, 2],
    7: [0, 4, 7, 10], '7b5': [0, 4, 6, 10], '7#9': [0, 4, 7, 10, 3],
    '7b9': [0, 4, 7, 10, 1], '7sus4': [0, 5, 7, 10],
    9: [0, 4, 7, 10, 2], '9b5': [0, 4, 6, 10, 2], '9#11': [0, 4, 7, 10, 2, 6],
    11: [0, 4, 7, 10, 2, 5], 13: [0, 4, 7, 10, 2, 5, 9],
    add9: [0, 4, 7, 2], add11: [0, 4, 7, 5],
    aug7: [0, 4, 8, 10], aug9: [0, 4, 8, 10, 2],
    m6: [0, 3, 7, 9], m69: [0, 3, 7, 9, 2], m7: [0, 3, 7, 10], 'm7b5': [0, 3, 6, 10],
    m9: [0, 3, 7, 10, 2], m11: [0, 3, 7, 10, 2, 5], madd9: [0, 3, 7, 2],
    maj7: [0, 4, 7, 11], 'maj7#5': [0, 4, 8, 11], 'maj7b5': [0, 4, 6, 11],
    maj7sus2: [0, 2, 7, 11], maj9: [0, 4, 7, 11, 2], maj11: [0, 4, 7, 11, 2, 5],
    maj13: [0, 4, 7, 11, 2, 5, 9],
    mmaj7: [0, 3, 7, 11], 'mmaj7b5': [0, 3, 6, 11],
    mmaj9: [0, 3, 7, 11, 2], mmaj11: [0, 3, 7, 11, 2, 5]
};

// Human-readable chord-quality names, for the structured text description a screen
// reader reads out. Falls back to the raw suffix when we have no friendlier wording.
export const QUALITY_LABELS = {
    major: 'major', minor: 'minor', m: 'minor', dim: 'diminished', dim7: 'diminished 7th',
    aug: 'augmented', sus: 'suspended 4th', sus4: 'suspended 4th', sus2: 'suspended 2nd',
    5: 'power chord (root and fifth)', 6: 'major 6th', m6: 'minor 6th',
    7: 'dominant 7th', maj7: 'major 7th', m7: 'minor 7th', 'm7b5': 'half-diminished',
    9: 'dominant 9th', maj9: 'major 9th', m9: 'minor 9th',
    add9: 'added 9th', madd9: 'minor added 9th', mmaj7: 'minor major 7th',
    add11: 'added 11th', maj7sus2: 'major 7th, suspended 2nd',
    sus2sus4: 'suspended 2nd and 4th',
    // Every remaining suffix the identifier can produce. Without an entry the raw suffix is shown
    // instead, which reads as "C#11 - 11" and tells a learner nothing.
    '7sus4': 'dominant 7th, suspended 4th',
    '7b5': 'dominant 7th, flat 5th', '7b9': 'dominant 7th, flat 9th',
    '7#9': 'dominant 7th, sharp 9th',
    aug7: 'augmented 7th', aug9: 'augmented 9th',
    '9b5': 'dominant 9th, flat 5th', '9#11': 'dominant 9th, sharp 11th',
    11: 'dominant 11th', m11: 'minor 11th', maj11: 'major 11th',
    13: 'dominant 13th', maj13: 'major 13th',
    69: '6th with added 9th', m69: 'minor 6th with added 9th',
    'maj7b5': 'major 7th, flat 5th', 'maj7#5': 'major 7th, sharp 5th',
    mmaj9: 'minor major 9th', mmaj11: 'minor major 11th',
    'mmaj7b5': 'minor major 7th, flat 5th'
};

/** Splits "m9/Ab" into { base: "m9", bass: "Ab" }. A bare "/G" means a major chord. */
export function parseSuffix(suffix) {
    const match = suffix.match(/^(.*?)\/([A-G][#b]?)$/);
    if (match) return { base: match[1] === '' ? 'major' : match[1], bass: match[2] };
    return { base: suffix, bass: null };
}

/**
 * MIDI note number a given string sounds at a given fret (0 = open).
 *
 * Defaults to standard tuning, which is what the chord library is built in. Anything working
 * from a song file should not need this at all: alphaTab's `realValue` already accounts for
 * both tuning and capo.
 */
export function fretToMidi(stringNumber, fret, tuning = STANDARD_TUNING_MIDI) {
    return tuning[stringNumber] + fret;
}

export function midiToPitchClassName(midi) {
    return PITCH_CLASS_NAMES[((midi % 12) + 12) % 12];
}

/** Spoken names for fingers, as numbered in tablature fingering data. */
export const FINGER_NAMES = { 1: 'index finger', 2: 'middle finger', 3: 'ring finger', 4: 'little finger' };

/** Pitch class with octave, e.g. 40 -> "E2". Octaves follow the convention where middle C is C4. */
export function midiToPitchName(midi) {
    return `${midiToPitchClassName(midi)}${Math.floor(midi / 12) - 1}`;
}

/**
 * Named six-string tunings, as the MIDI pitch of each open string.
 *
 * Only tunings a learner is likely to meet by name. Anything else a song uses still works
 * everywhere it matters, since song handling reads pitches from the file rather than from
 * this table; the table exists so the reverse-lookup tool can be told what the strings are
 * when there is no file to ask.
 */
export const TUNINGS = [
    { id: 'standard', name: 'Standard (E A D G B E)', midi: { 6: 40, 5: 45, 4: 50, 3: 55, 2: 59, 1: 64 } },
    { id: 'drop-d', name: 'Drop D (D A D G B E)', midi: { 6: 38, 5: 45, 4: 50, 3: 55, 2: 59, 1: 64 } },
    { id: 'dadgad', name: 'DADGAD (D A D G A D)', midi: { 6: 38, 5: 45, 4: 50, 3: 55, 2: 57, 1: 62 } },
    { id: 'open-g', name: 'Open G (D G D G B D)', midi: { 6: 38, 5: 43, 4: 50, 3: 55, 2: 59, 1: 62 } },
    { id: 'open-d', name: 'Open D (D A D F# A D)', midi: { 6: 38, 5: 45, 4: 50, 3: 54, 2: 57, 1: 62 } },
    { id: 'open-e', name: 'Open E (E B E G# B E)', midi: { 6: 40, 5: 47, 4: 52, 3: 56, 2: 59, 1: 64 } },
    { id: 'half-step-down', name: 'Half step down (Eb Ab Db Gb Bb Eb)', midi: { 6: 39, 5: 44, 4: 49, 3: 54, 2: 58, 1: 63 } },
    { id: 'drop-c', name: 'Drop C (C G C F A D)', midi: { 6: 36, 5: 43, 4: 48, 3: 53, 2: 57, 1: 62 } }
];

/** Sounded strings of a voicing, lowest-pitched first, as { string, fret, midi }. */
export function voicingSoundedNotes(voicing) {
    return voicing.strings
        .filter(s => s.play !== 'muted')
        .map(s => ({ string: s.string, fret: s.fret, midi: fretToMidi(s.string, s.fret) }))
        .sort((a, b) => a.midi - b.midi);
}

/**
 * Checks a voicing against the interval formula implied by its chord name.
 *
 * "pass" means every sounded note belongs to the chord and the notes that define its
 * identity are present. The fifth is allowed to be missing, which is idiomatic on guitar.
 * Missing root or third is reported rather than treated as a hard failure: rootless and
 * thirdless voicings are deliberate in jazz, so the caller decides how to grade them.
 */
export function verifyVoicing(voicing, rootName, suffix) {
    const { base, bass } = parseSuffix(suffix);
    const formula = CHORD_FORMULAS[base];
    const rootPc = PITCH_CLASSES[rootName];

    if (formula === undefined || rootPc === undefined) {
        return { status: 'unknown', reason: `no interval formula for suffix "${suffix}"` };
    }

    const allowed = new Set(formula.map(i => (rootPc + i) % 12));
    if (bass && PITCH_CLASSES[bass] !== undefined) allowed.add(PITCH_CLASSES[bass]);

    const notes = voicingSoundedNotes(voicing);
    const sounded = new Set(notes.map(n => n.midi % 12));

    const foreign = [...sounded].filter(pc => !allowed.has(pc)).map(pc => PITCH_CLASS_NAMES[pc]);
    const hasRoot = sounded.has(rootPc);

    const thirdInterval = formula.includes(3) ? 3 : formula.includes(4) ? 4 : null;
    const hasThird = thirdInterval === null ? true : sounded.has((rootPc + thirdInterval) % 12);

    const seventhInterval = formula.includes(10) ? 10 : formula.includes(11) ? 11 : null;
    const hasSeventh = seventhInterval === null ? true : sounded.has((rootPc + seventhInterval) % 12);

    return {
        status: foreign.length === 0 && hasSeventh ? 'pass' : 'fail',
        foreign,
        hasRoot,
        hasThird,
        hasSeventh,
        notes: [...sounded].sort((a, b) => a - b).map(pc => PITCH_CLASS_NAMES[pc]),
        expected: [...allowed].sort((a, b) => a - b).map(pc => PITCH_CLASS_NAMES[pc])
    };
}

// Suffixes to try when working backwards from notes to a chord name, simplest first and with
// no aliases, so identification returns one name per distinct sound rather than duplicates
// like "minor" and "m".
export const IDENTIFY_SUFFIXES = [
    'major', 'minor', '5', 'sus2', 'sus4', 'dim', 'aug',
    '7', 'maj7', 'm7', 'm7b5', 'dim7', 'mmaj7', '6', 'm6', 'add9', 'madd9',
    '7sus4', '7b5', 'aug7', '9', 'maj9', 'm9', '69', 'm69', '7b9', '7#9', '9b5', 'aug9',
    '11', 'm11', 'maj11', 'mmaj9', 'mmaj11', 'maj7b5', 'maj7#5', 'maj7sus2',
    '13', 'maj13', '9#11', 'sus2sus4', 'add11', 'mmaj7b5'
];

/**
 * Works backwards from sounded notes to the chord names that fit them exactly.
 *
 * Only reports names whose full interval set matches the notes played, so it never guesses at
 * a chord the shape does not actually spell. Results are ranked so the most likely reading
 * comes first: a root in the bass beats an inversion, and simpler chords beat more elaborate
 * ones that happen to contain the same notes.
 */
export function identifyChordFromNotes(midiNotes) {
    if (midiNotes.length === 0) return [];

    const sounded = new Set(midiNotes.map(n => ((n % 12) + 12) % 12));
    const bassPc = ((Math.min(...midiNotes) % 12) + 12) % 12;
    const candidates = [];

    for (let root = 0; root < 12; root++) {
        for (const suffix of IDENTIFY_SUFFIXES) {
            const formula = CHORD_FORMULAS[suffix];
            const expected = new Set(formula.map(i => (root + i) % 12));
            if (expected.size !== sounded.size) continue;
            if ([...expected].some(pc => !sounded.has(pc))) continue;

            const rootName = PITCH_CLASS_NAMES[root];
            const displaySuffix = suffix === 'major' ? '' : suffix === 'minor' ? 'm' : suffix;
            candidates.push({
                root: rootName,
                suffix,
                name: `${rootName}${displaySuffix}`,
                rootInBass: root === bassPc,
                bass: PITCH_CLASS_NAMES[bassPc],
                complexity: formula.length,
                suffixRank: IDENTIFY_SUFFIXES.indexOf(suffix)
            });
        }
    }

    candidates.sort((a, b) =>
        Number(b.rootInBass) - Number(a.rootInBass) ||
        a.complexity - b.complexity ||
        a.suffixRank - b.suffixRank);
    return candidates;
}

/** Widest fret span the left hand must cover; 0 for fully open/muted shapes. */
export function fretSpan(voicing) {
    const frets = voicing.strings.filter(s => s.play !== 'muted' && s.fret > 0).map(s => s.fret);
    return frets.length === 0 ? 0 : Math.max(...frets) - Math.min(...frets);
}

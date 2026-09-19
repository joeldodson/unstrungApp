// Saved chord progressions: the file format, and which chords belong to a key.
//
// A saved progression is its list of chords, written out. It used to be a seed, which rebuilt the
// progression by running the generator again -- and so stopped working the moment the generator
// changed. A list of chords means the same thing to every version of Unstrung.
//
// Kept free of the DOM and of Node, like chordProgressions.mjs, so the checks can run it directly.

import { KEY_ROOTS, transpose, chordDisplayName } from './chordProgressions.mjs';

export const SAVED_PROGRESSION_FORMAT = 1;
export const MAX_MEASURES = 256;
export const MAX_BEATS = 16;

/**
 * How a progression came to be, which the tab reports and the file keeps.
 *
 * "generated" is straight from the generator; "edited" is generated and then changed by hand;
 * "hand" is built from nothing in the editor. The level and borrowing are kept for the first two,
 * since they are still a fair description of where the chords came from.
 */
export const ORIGINS = ['generated', 'edited', 'hand'];

/**
 * The file's text for a progression.
 *
 * Only what a player chose is written. Tempo, the metronome and the repeat count are left out on
 * purpose: they are how you practise it today, not what the progression is.
 */
export function serializeProgression({ key, mode, beatsPerBar, beatUnit, chords, origin }) {
    const made = ORIGINS.includes(origin?.made) ? origin.made : 'hand';
    const savedOrigin = { made };
    if (made !== 'hand') {
        if (origin.levelId) savedOrigin.levelId = origin.levelId;
        if (origin.borrowingId) savedOrigin.borrowingId = origin.borrowingId;
    }
    return JSON.stringify({
        format: SAVED_PROGRESSION_FORMAT,
        key,
        mode,
        timeSignature: { beatsPerBar, beatUnit },
        chords: chords.map(chord => ({ root: chord.root, suffix: chord.suffix })),
        origin: savedOrigin
    }, null, 2) + '\n';
}

function isWholeNumberIn(value, low, high) {
    return Number.isInteger(value) && value >= low && value <= high;
}

/**
 * Reads a saved progression, or says in plain words why it cannot.
 *
 * Returns `{ progression }` or `{ error }`. The error is written to be read out as it stands: the
 * open dialog lists the files it skipped and why, so "chord H7 is not in the chord library" is
 * more use than "invalid".
 *
 * Every chord has to be one the library carries. That is what gives it a fingering and a spoken
 * name, and a chord the app cannot play or describe would fail later and less clearly.
 */
export function parseSavedProgression(text, { model, library }) {
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        return { error: 'not valid JSON' };
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return { error: 'not a saved progression' };
    }
    if (typeof data.format === 'number' && data.format > SAVED_PROGRESSION_FORMAT) {
        return { error: 'saved by a newer version of Unstrung' };
    }
    if (data.format !== SAVED_PROGRESSION_FORMAT || !Array.isArray(data.chords)) {
        return { error: 'not a saved progression' };
    }
    if (!KEY_ROOTS.includes(data.key)) return { error: `the key "${data.key}" is not one Unstrung knows` };
    if (!model.modes[data.mode]) return { error: `the mode "${data.mode}" is not one Unstrung knows` };

    const beatsPerBar = data.timeSignature?.beatsPerBar;
    const beatUnit = data.timeSignature?.beatUnit;
    if (!isWholeNumberIn(beatsPerBar, 1, MAX_BEATS) || !isWholeNumberIn(beatUnit, 1, MAX_BEATS)) {
        return { error: 'the time signature is missing or out of range' };
    }

    if (data.chords.length === 0) return { error: 'it has no chords' };
    if (data.chords.length > MAX_MEASURES) return { error: `it has more than ${MAX_MEASURES} measures` };

    const known = new Set((library?.chords ?? []).map(entry => `${entry.root}|${entry.suffix}`));
    const chords = [];
    for (const [index, chord] of data.chords.entries()) {
        if (typeof chord?.root !== 'string' || typeof chord?.suffix !== 'string') {
            return { error: `measure ${index + 1} has no chord` };
        }
        if (!known.has(`${chord.root}|${chord.suffix}`)) {
            return { error: `the chord ${chordDisplayName(chord)} in measure ${index + 1} is not in the chord library` };
        }
        chords.push({ root: chord.root, suffix: chord.suffix });
    }

    const made = ORIGINS.includes(data.origin?.made) ? data.origin.made : 'hand';
    const origin = { made };
    if (made !== 'hand') {
        if (model.levels.some(level => level.id === data.origin.levelId)) origin.levelId = data.origin.levelId;
        if ((model.borrowing?.tiers ?? []).some(tier => tier.id === data.origin.borrowingId)) {
            origin.borrowingId = data.origin.borrowingId;
        }
    }

    return { progression: { key: data.key, mode: data.mode, beatsPerBar, beatUnit, chords, origin } };
}

// --- Which chords belong to a key -------------------------------------------------------------

const LETTER_PITCH_CLASSES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "Bb" -> 10, "F#" -> 6, "Cb" -> 11. Null for anything that is not a note name. */
export function notePitchClass(name) {
    const match = /^([A-G])([#b]*)$/.exec(String(name ?? '').trim());
    if (!match) return null;
    let pitchClass = LETTER_PITCH_CLASSES[match[1]];
    for (const accidental of match[2]) pitchClass += accidental === '#' ? 1 : -1;
    return ((pitchClass % 12) + 12) % 12;
}

// The three notes of each triad quality a degree can have, in semitones above its root.
const TRIAD_INTERVALS = { major: [0, 4, 7], minor: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8] };

/**
 * The pitch classes of a key: every note of every chord its mode is built from.
 *
 * Taken from the model's own degrees rather than from a scale formula, so the answer agrees with
 * what the generator treats as belonging. The minor mode lists both a minor and a major v, which
 * is how a minor key is actually played, so its raised seventh counts as in the key here too.
 */
export function keyPitchClasses(model, mode, key) {
    const pitchClasses = new Set();
    const keyClass = KEY_ROOTS.indexOf(key);
    for (const degree of Object.values(model.modes[mode]?.degrees ?? {})) {
        for (const interval of TRIAD_INTERVALS[degree.suffix] ?? []) {
            pitchClasses.add((keyClass + degree.semitones + interval) % 12);
        }
    }
    return pitchClasses;
}

/** The notes of a library chord as pitch classes, from its first fingering or its stated notes. */
export function chordEntryPitchClasses(entry) {
    const names = entry?.voicings?.[0]?.notes ?? entry?.notes ?? [];
    return names.map(notePitchClass).filter(value => value !== null);
}

/**
 * Whether every note of a chord is in the key.
 *
 * By notes rather than by name, so G7 counts as belonging to C major -- every one of its notes is
 * in the key -- where a list of the seven triads would call it foreign.
 */
export function isChordInKey(entry, keyClasses) {
    const classes = chordEntryPitchClasses(entry);
    return classes.length > 0 && classes.every(value => keyClasses.has(value));
}

/**
 * The chords a key is built from, in scale order, each with its degree: "ii" and Dm.
 *
 * What the editor offers before anything is typed, since these are what most progressions use.
 */
export function degreeChords(model, mode, key) {
    return Object.entries(model.modes[mode]?.degrees ?? {})
        .sort((a, b) => a[1].semitones - b[1].semitones)
        .map(([degree, spec]) => ({ degree, root: transpose(key, spec.semitones), suffix: spec.suffix }));
}

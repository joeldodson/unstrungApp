// Which chords belong to a key, and the limits on a progression's size.
//
// Kept free of the DOM and of Node, like chordProgressions.mjs, so the checks can run it directly.

import { KEY_ROOTS, transpose } from './chordProgressions.mjs';

export const MAX_MEASURES = 256;
export const MAX_BEATS = 16;

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

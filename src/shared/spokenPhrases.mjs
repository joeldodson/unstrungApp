// Working with spoken phrases that have been rendered to audio.
//
// Kept dependency-free and free of Web Audio types so it can be tested in Node, like
// musicTheory.mjs. The main process renders the WAVs (see the `speech:render` handler); this is
// what a caller needs once the samples are in hand.
//
// Nothing uses this yet. It is here for spoken chord names in practice mode, and exists because
// each number in it was measured rather than chosen. The measurements are on the speakTheNotes
// branch, in SPEAK_THE_NOTES.md and scripts/speak-notes/.

// Anything quieter than this counts as silence. About -46 dBFS: low enough to keep a soft
// consonant, high enough to sit above the encoder's noise floor.
export const SILENCE_FLOOR = 0.005;

// Kept either side of the speech, so a quiet attack or release is not clipped off.
const TRIM_PAD_SECONDS = 0.01;

/**
 * Where the speech actually starts and stops inside a rendered phrase.
 *
 * This matters more than it sounds. A third to a half of every utterance the Windows engine
 * produces is silence after the last word -- over half for a short phrase. Anything that waits for
 * the whole file to play throws that away, and when the phrase has to fit in the gap before a beat,
 * throwing it away costs roughly a third of the tempo.
 *
 * Reading it off the samples is exact. The alternative, when only the browser's speech engine is
 * available and there are no samples, is to infer it from word boundary events plus a fixed
 * allowance for the last word -- which works, but is an estimate standing in for a measurement.
 *
 * `samples` is a Float32Array of one channel.
 */
export function trimSilence(samples, sampleRate) {
    let first = 0;
    let last = samples.length - 1;
    while (first < samples.length && Math.abs(samples[first]) < SILENCE_FLOOR) first++;
    while (last > first && Math.abs(samples[last]) < SILENCE_FLOOR) last--;

    // All silence, or near enough: hand back the whole thing rather than nothing.
    if (first >= last) return { startSeconds: 0, speechSeconds: samples.length / sampleRate };

    const pad = Math.round(TRIM_PAD_SECONDS * sampleRate);
    const start = Math.max(0, first - pad);
    const end = Math.min(samples.length - 1, last + pad);
    return {
        startSeconds: start / sampleRate,
        speechSeconds: (end - start) / sampleRate
    };
}

// Where the octave fold wraps. Six semitones each way keeps every shift under half an octave,
// which is about as far as a concatenative voice stays intelligible.
export const FOLD_WRAP_SEMITONES = 6;

/**
 * How far to shift a phrase so it carries a note's pitch.
 *
 * A guitar spans about four octaves and a speaking voice spans nowhere near that, so pitches fold
 * into one octave: the pitch class survives and the octave does not, which is why the octave
 * belongs in the words if it is wanted at all. C is taken as the voice's own pitch and everything
 * else is placed within half an octave of it, wrapping at the tritone.
 *
 * Absolute pitch is not attempted and does not need to be: since the fold discards the octave
 * anyway, only the spacing between pitch classes is meaningful, and that needs no knowledge of
 * what pitch the voice actually speaks at.
 */
export function foldedSemitones(midi) {
    const pitchClass = ((midi % 12) + 12) % 12;
    return pitchClass > FOLD_WRAP_SEMITONES - 1 ? pitchClass - 12 : pitchClass;
}

/**
 * Playback rate that shifts a phrase by a number of semitones.
 *
 * Playing a buffer faster raises everything in it by the same factor, so pitch needs no signal
 * processing at all -- but it shortens the phrase by that factor too, and lengthens it when
 * shifting down. The tempo cost of pitching therefore falls entirely on the downward shifts: a G
 * folds to -5 semitones and runs a third longer, while an F folds to +5 and gets shorter.
 */
export function playbackRateForSemitones(semitones) {
    return Math.pow(2, semitones / 12);
}

/** How long a phrase takes once shifted, in seconds. */
export function shiftedSpeechSeconds(speechSeconds, semitones) {
    return speechSeconds / playbackRateForSemitones(semitones);
}

/**
 * A root note as a speech engine needs it said: "C#" becomes "C sharp", "Bb" becomes "B flat".
 *
 * Left unspelled, a sharp is silently dropped and a flat is read as part of the letter. The flat
 * rule is anchored to the start so it cannot corrupt a suffix that legitimately contains a "b".
 */
export function spokenRootName(root) {
    return root.replace('#', ' sharp').replace(/(?<=^[A-G])b/, ' flat');
}

/**
 * Chord qualities as they should be said, which is not how they should be read.
 *
 * QUALITY_LABELS in musicTheory.mjs exists to be read at leisure in the chord library, where
 * "power chord (root and fifth)" is helpful. Said aloud in the moment before a chord change it is
 * a disaster: it measured 889 ms, longer than any other phrase in a real song, and on its own
 * dragged that song's workable tempo down by a fifth. These are the same qualities named to be
 * spoken quickly, and are the reason this table exists separately rather than being a duplicate.
 *
 * Keyed by the suffixes musicTheory.mjs uses, so a chord from the library or the identifier can be
 * looked up directly.
 */
export const SPOKEN_QUALITY_LABELS = {
    major: '', minor: 'minor', m: 'minor', 5: 'power chord',
    sus: 'sus 4', sus2: 'sus 2', sus4: 'sus 4', sus2sus4: 'sus 2 4', dim: 'dim', aug: 'aug',
    7: '7', maj7: 'major 7', m7: 'minor 7', 'm7b5': 'minor 7 flat 5', dim7: 'dim 7',
    mmaj7: 'minor major 7', 6: '6', m6: 'minor 6', add9: 'add 9', madd9: 'minor add 9',
    '7sus4': '7 sus 4', '7b5': '7 flat 5', aug7: 'aug 7',
    9: '9', maj9: 'major 9', m9: 'minor 9', 69: '6 9', m69: 'minor 6 9',
    '7b9': '7 flat 9', '7#9': '7 sharp 9', '9b5': '9 flat 5', aug9: 'aug 9',
    11: '11', m11: 'minor 11', maj11: 'major 11', add11: 'add 11',
    mmaj9: 'minor major 9', mmaj11: 'minor major 11',
    'maj7b5': 'major 7 flat 5', 'maj7#5': 'major 7 sharp 5', maj7sus2: 'major 7 sus 2',
    13: '13', maj13: 'major 13', '9#11': '9 sharp 11', 'mmaj7b5': 'minor major 7 flat 5'
};

/**
 * A full chord name as it should be spoken, from a root and a suffix.
 *
 * Takes the two apart rather than a written name like "F#m7", because a written name cannot be
 * turned into speech reliably: "F sharpm7" is what naive substitution produces, and the suffixes
 * do not tokenize cleanly. Every source of chords here -- the library, the identifier, a generated
 * progression -- already has the two separately.
 *
 * A plain major says only its root: "C", not "C major". It is the common case, and every syllable
 * spent on it is one the player does not have before the change.
 */
export function spokenChordName(root, suffix = 'major') {
    const quality = SPOKEN_QUALITY_LABELS[suffix] ?? suffix;
    return quality ? `${spokenRootName(root)} ${quality}` : spokenRootName(root);
}

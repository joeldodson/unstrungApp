// A measure's chords as the progression editor writes them, "G D C@4", and when chord practice
// speaks them.
//
// Each chord starts at its @ position, or, without one, on the next whole beat after the chord
// before it; the first chord is on beat 1. A chord lasts until the next one starts or the measure
// ends. So in 4/4, "G D C Am" is a chord a beat, "G D C" leaves C beats 3 and 4, and "G C@3" is two
// beats each. A chord written again straight after itself carries on rather than starting again:
// "C C G G" is the same measure as "C G@3".
//
// Positions are beats counted from 1, as players count them, with a half or a quarter of a beat
// after the point: 2.5 is the and of 2, 2.25 and 2.75 the sixteenths either side of it.
//
// Progressions are kept to chords and where they start, deliberately: notes, rests and ties are
// song editing, which is a different thing. See docs/chords-within-a-measure.md.
//
// Kept dependency-free apart from chord names, like chordProgressions.mjs, so it runs in Node for
// the checks and in the renderer for real.

import { chordDisplayName } from './chordProgressions.mjs';
import { spokenChordName } from './spokenPhrases.mjs';
import { PITCH_CLASS_NAMES, PITCH_CLASSES } from './musicTheory.mjs';

// A chord may start a quarter of a beat into one, and no finer: sixteenths in 4/4, the finest grid
// a strumming pattern has.
export const BEAT_DIVISIONS = 4;

const sameChordName = (a, b) => !!a && !!b && a.root === b.root && a.suffix === b.suffix;

/** The next whole beat after a position: 3 after 2, and 3 after 2.5. */
const nextWholeBeat = position => Math.floor(position) + 1;

/**
 * Whether a chord starts where the rule would put it without an @: on beat 1 if it is the first,
 * otherwise on the next whole beat after the chord before it.
 */
const startsWhereExpected = (chords, index) =>
    chords[index].beat === (index === 0 ? 1 : nextWholeBeat(chords[index - 1].beat));

/**
 * A progression's measure as its chords in order, each with the beat it starts on.
 *
 * A measure is kept as its first chord, one entry of a progression's `chords` as it always was, so
 * the generator and everything reading one chord a measure carry on unchanged; any chords after
 * it are its `laterChords`, [{ root, suffix, beat }].
 */
export function chordsInMeasure(measure) {
    return [{ ...measure, beat: 1 }, ...(measure.laterChords ?? [])];
}

/** A position as it is typed: "3", "2.5", "2.25". */
export function formatBeat(beat) {
    return String(beat);
}

/**
 * Reads what was typed into the chord field.
 *
 * `chordByName` turns a written name into a chord library entry, or null. Returns
 * { chords: [{ root, suffix, beat }] } or { error }, the error a sentence to say to the player.
 */
export function parseMeasureChords(text, { beatsPerBar, chordByName }) {
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return { error: 'No chord was given.' };

    const chords = [];
    // Where the last chord written starts, merged or not, since the next chord counts on from it.
    let position = null;
    for (const word of words) {
        const at = word.indexOf('@');
        const name = at < 0 ? word : word.slice(0, at);
        if (name === '') return { error: `${word} has no chord before the @.` };
        const entry = chordByName(name);
        if (!entry) return { error: `There is no chord named ${name} in the chord library.` };

        let beat;
        if (at < 0) {
            beat = position === null ? 1 : nextWholeBeat(position);
            if (beat > beatsPerBar) {
                return { error: `There is no beat left in the measure for ${name}.` };
            }
        } else {
            const beatText = word.slice(at + 1);
            beat = Number(beatText);
            if (beatText === '' || !Number.isFinite(beat)) {
                return { error: `${word} needs a beat after the @, such as ${name}@3.` };
            }
            if (!Number.isInteger(beat * BEAT_DIVISIONS)) {
                return { error: `${word} starts between sixteenths. A chord can start on a beat, ` +
                    'or a half or a quarter of the way through one, such as 2.5 or 2.25.' };
            }
            if (beat < 1 || beat >= beatsPerBar + 1) {
                return { error: `${word} is outside the measure, which has beats 1 to ${beatsPerBar}.` };
            }
            if (position === null && beat !== 1) {
                return { error: `The first chord starts on beat 1, so ${word} cannot.` };
            }
            if (position !== null && beat <= position) {
                return { error: `${word} does not start after the chord before it, ` +
                    `which starts on ${formatBeat(position)}.` };
            }
        }
        position = beat;
        if (sameChordName(chords[chords.length - 1], entry)) continue;
        chords.push({ root: entry.root, suffix: entry.suffix, beat });
    }
    return { chords };
}

/**
 * A measure's chords written the shortest way that reads back the same: an @ only where the rule
 * would not put the chord there anyway. [G at 1, C at 3] is "G C@3"; [G, D, C at 4] is "G D C@4".
 */
export function formatMeasureChords(chords) {
    return chords.map((chord, index) => (startsWhereExpected(chords, index)
        ? chordDisplayName(chord)
        : `${chordDisplayName(chord)}@${formatBeat(chord.beat)}`)).join(' ');
}

/**
 * A measure's harmony, [{ name, beat }] as extractScoreMetadata gives it, written as the editor
 * writes a measure: "G C@3". The names are as the file prints them. Where Am I says it, for songs
 * and progressions alike (docs/one-player.md, decision 8).
 */
export function formatHarmony(harmony) {
    return harmony.map((chord, index) => (startsWhereExpected(harmony, index)
        ? chord.name : `${chord.name}@${formatBeat(chord.beat)}`)).join(' ');
}

/**
 * Chords a strumming pattern does not strike where they start, with the beat each is first heard.
 *
 * `C@2.5` with Down Only starts C on the and of 2, where the hand does nothing, so C is first
 * heard on 3. That is right, as a chord change on a miss is, but worth saying. A chord the
 * pattern never strikes before the next one starts has `heardAt` null.
 *
 * `pattern` is { slotsPerBeat, slots }. Returns [{ chord, heardAt }].
 */
export function chordsStruckLate(chords, pattern, beatsPerBar) {
    const strikes = pattern.slots
        .map((slot, index) => ({ slot, beat: 1 + index / pattern.slotsPerBeat }))
        .filter(({ slot }) => slot.stroke === 'down' || slot.stroke === 'up')
        .map(({ beat }) => beat);
    const late = [];
    for (const [index, chord] of chords.entries()) {
        const until = chords[index + 1]?.beat ?? beatsPerBar + 1;
        if (strikes.includes(chord.beat)) continue;
        const first = strikes.find(beat => beat > chord.beat && beat < until);
        late.push({ chord, heardAt: first ?? null });
    }
    return late;
}

// --- Speaking the next measure -----------------------------------------------------------------

/** What is said before a measure that is the same as the one before it. */
export const SPOKEN_REPEAT = 'repeat';

/** What is said after a chord written with an @: "at 3", "at 2.5". */
export const spokenBeat = beat => `at ${formatBeat(beat)}`;

/**
 * Every position spokenBeat can be asked for in measures of up to `maxBeats` beats, for the
 * recordings: every quarter of a beat from 1.25 on. Beat 1 itself is never written with an @.
 */
export function spokenBeatVocabulary(maxBeats) {
    const phrases = [];
    for (let step = 1; step < maxBeats * BEAT_DIVISIONS; step++) {
        phrases.push(spokenBeat(1 + step / BEAT_DIVISIONS));
    }
    return phrases;
}

/**
 * The phrases said for a measure, as the editor writes it: each chord's name, and after a chord
 * written with an @, where it starts. "G D C@4" is said "G", "D", "C", "at 4".
 */
export function spokenMeasureWords(chords) {
    return chords.flatMap((chord, index) => (startsWhereExpected(chords, index)
        ? [chord.name] : [chord.name, spokenBeat(chord.beat)]));
}

// Between one chord name and the next when a measure's chords are said together.
export const SPOKEN_WORD_GAP_SECONDS = 0.08;
// How long before the downbeat a list of names finishes, so the last name is not on the beat.
const FINISH_BEFORE_SECONDS = 0.1;

// Two measures are the same harmony when their chords are, by `key` where one is given (a song's
// printed name, which may have no recording) and otherwise by the spoken name.
const sameMeasure = (a, b) => a.length > 0 && a.length === b.length &&
    a.every((chord, index) => (chord.key ?? chord.name) === (b[index].key ?? b[index].name) && chord.beat === b[index].beat);

/**
 * spokenMeasureWords, keeping only phrases with a recording, and leaving out a chord's "at 3" along
 * with its name when the name has none, so a position is never said on its own.
 */
function recordedWords(chords, speechSeconds) {
    return chords.flatMap((chord, index) => {
        if (speechSeconds(chord.name) === undefined) return [];
        const own = startsWhereExpected(chords, index) ? [chord.name] : [chord.name, spokenBeat(chord.beat)];
        return own.filter(word => speechSeconds(word) !== undefined);
    });
}

/**
 * When to speak each measure's chords, and what to say, for measures all of one length: chord
 * practice's progressions. `measures` holds each measure's chords; see spokenMeasureTimes.
 */
export function spokenMeasurePlan(measures, { secondsPerBeat, beatsPerBar, speechSeconds }) {
    return spokenMeasureTimes(
        measures.map(chords => ({ chords, seconds: secondsPerBeat * beatsPerBar, beatSeconds: secondsPerBeat })),
        { speechSeconds });
}

/**
 * When to speak each measure's chords, and what to say.
 *
 * `measures` holds each measure as { chords, seconds, beatSeconds }: its chords as
 * [{ name, beat, key }], `name` being the spoken phrase and `key`, optional, what makes two chords
 * the same; how long the measure lasts; and how long one of its beats is. Measures may differ in
 * both, as a song's do across time signatures, pickups and tempo changes. `speechSeconds(phrase)`
 * is how long its recording lasts, or undefined where there is none.
 *
 * - A measure the same as the one before it is announced as "repeat".
 * - One chord is said one beat before the measure, as chord names always were: a beat of the
 *   measure before, being heard there.
 * - Several are said together, one after the other, as the editor writes them: a chord written
 *   with an @ is followed by where it starts, "at 3". They finish just before the measure starts:
 *   one beat ahead, or earlier if the list needs longer.
 * - Never before the measure before has begun, nor over the names said before it. Where the
 *   whole list does not fit, only the first chord is said, so the downbeat is still announced.
 *   The first measure is given a measure of its own length before it, which a count-in fills.
 * - A phrase with no recording is left out, and a measure with no chords says nothing.
 *
 * Returns, for each measure, null or { words, offsetSeconds }, the offset from the measure's
 * start, negative: when the first word begins. Generalised on 2026-11-12 from a plan for measures
 * of one length, for songs (docs/one-player.md, decision 5); for those it gives the same answers.
 */
export function spokenMeasureTimes(measures, { speechSeconds }) {
    const lengthOf = words => words.reduce((sum, word) => sum + speechSeconds(word), 0) +
        SPOKEN_WORD_GAP_SECONDS * (words.length - 1);

    const plan = [];
    // Where the words before the previous measure finished, relative to the measure being planned.
    let previousEnd = -Infinity;
    for (const [index, measure] of measures.entries()) {
        const { chords } = measure;
        const previous = measures[index - 1];
        // The time before this measure that the words fall in: the measure before, if any.
        const before = previous ?? measure;
        let words = previous && sameMeasure(previous.chords, chords) && speechSeconds(SPOKEN_REPEAT) !== undefined
            ? [SPOKEN_REPEAT]
            : recordedWords(chords, speechSeconds);
        if (words.length === 0) {
            plan.push(null);
            previousEnd = -Infinity;
            continue;
        }

        const earliest = Math.max(-before.seconds, previousEnd + SPOKEN_WORD_GAP_SECONDS);
        let offset = Math.min(-before.beatSeconds, -(lengthOf(words) + FINISH_BEFORE_SECONDS));
        if (words.length > 1 && offset < earliest) {
            words = [words[0]];
            offset = -before.beatSeconds;
        }
        offset = Math.max(offset, earliest);

        plan.push({ words, offsetSeconds: offset });
        previousEnd = offset + lengthOf(words) - measure.seconds;
    }
    return plan;
}

/**
 * A song's measures as spokenMeasureTimes takes their chords: each measure's printed harmony
 * ([{ name, beat }], from extractScoreMetadata's `harmony`) with each name turned into the phrase
 * said for it, and the printed name kept as `key`.
 *
 * `chordByName(name)` gives a printed name's { root, suffix }, or null for one unstrung does not
 * know; that chord is then not said, though it still counts in deciding "repeat". `names` lists
 * every name it knows, for looking one up whatever its case. A chord printed
 * between the quarters of a beat is said at the quarter it falls in, the finest the recordings go.
 *
 * A name is looked up as it would be typed: the sharp and flat signs some files print (♯, ♭) as #
 * and b, and a name in parentheses, which marks a chord as optional, without them. One the library
 * spells another way is looked up as the library spells its root and any bass note after a slash,
 * and said that way: a printed G#m is said "A flat minor", the recordings having no G sharp. Joel
 * chose that on 2026-11-12 over leaving it unsaid until it has a recording of its own.
 *
 * Failing that, the case of the name is ignored, as Joel suggested the same day: a file printing
 * AM and EM beside Am and Em means A minor and E minor, and one of them, AM, has a diagram of A and
 * C. No two names in the library differ only in case. A capital M followed by a number is the
 * usual way of writing major, CM7 being C major 7, so it is read as maj first and not as minor.
 */
export function songSpokenChords(harmony, { chordByName, names = [] }) {
    names = [...names];
    const typed = name => name.trim().replace(/♯/g, '#').replace(/♭/g, 'b').replace(/^\((.+)\)$/, '$1');
    const respelled = name => name
        .replace(/^([A-G][#b]?)/, root => PITCH_CLASS_NAMES[PITCH_CLASSES[root]] ?? root)
        .replace(/\/([A-G][#b]?)$/, (_, bass) => `/${PITCH_CLASS_NAMES[PITCH_CLASSES[bass]] ?? bass}`)
        .replace(/^([A-G][#b]?)M(?=\d)/, '$1maj');
    const lookUp = name => chordByName(name) ?? chordByName(respelled(name)) ?? chordByNameIgnoringCase(respelled(name));
    // Built on first use, from `names`, every name chordByName knows.
    let lower = null;
    const chordByNameIgnoringCase = name => {
        lower ??= new Map(names.map(known => [known.toLowerCase(), known]));
        const known = lower.get(name.toLowerCase());
        return known ? chordByName(known) : null;
    };
    return harmony.map(chord => {
        const known = lookUp(typed(chord.name));
        const beat = Math.floor((chord.beat - 1) * BEAT_DIVISIONS) / BEAT_DIVISIONS + 1;
        return {
            name: known ? spokenChordName(known.root, known.suffix) : null,
            key: chord.name,
            beat
        };
    });
}

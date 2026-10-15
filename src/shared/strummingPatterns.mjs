// Strumming patterns: what the strumming hand does in each slot of a measure.
//
// A measure is divided into equal slots: the time signature gives the beats, and `slotsPerBeat`
// splits each one -- 1 for the beat itself, 2 for eighths ("1 and 2 and" in 4/4), 4 for
// sixteenths ("1 e and a"). Each slot is one of:
//
//   D  a downstroke
//   U  an upstroke
//   -  a miss: the hand passes the strings without touching them, and the chord rings on
//   x  a mute: the strings are struck deadened, the percussive "chuck"
//
// with `>` before D, U or x for an accent. Slots are separated by spaces: `>D - D U - U D U`.
// Letter case means nothing, since a screen reader's "cap" announcement depends on its settings.
//
// See docs/strumming-patterns-and-metronome.md.

export const SLOTS_PER_BEAT_CHOICES = [1, 2, 4];

const STROKE_BY_LETTER = { d: 'down', u: 'up', '-': 'miss', x: 'mute' };
const LETTER_BY_STROKE = { down: 'D', up: 'U', miss: '-', mute: 'x' };

/** How many slots one measure of a pattern has. */
export function slotsPerMeasure(beatsPerBar, slotsPerBeat) {
    return beatsPerBar * slotsPerBeat;
}

/**
 * Reads pattern text into slots, or says plainly why it cannot.
 *
 * Returns { slots } or { error }. The slot count is not checked here; `fitPattern` does that
 * against a time signature, so a pattern can be read before its measure is known.
 */
export function parseStrummingPattern(text) {
    const tokens = String(text ?? '').trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return { error: 'The pattern is empty.' };

    const slots = [];
    for (const [index, token] of tokens.entries()) {
        const accent = token.startsWith('>');
        const letter = (accent ? token.slice(1) : token).toLowerCase();
        const stroke = STROKE_BY_LETTER[letter];
        if (!stroke) {
            return { error: `Slot ${index + 1}, "${token}", is not D, U, x or a dash.` };
        }
        if (accent && stroke === 'miss') {
            return { error: `Slot ${index + 1} accents a miss, which strikes nothing.` };
        }
        slots.push({ stroke, accent });
    }
    return { slots };
}

/** The text form of a pattern's slots, the inverse of parseStrummingPattern. */
export function formatStrummingPattern(slots) {
    return slots.map(slot => `${slot.accent ? '>' : ''}${LETTER_BY_STROKE[slot.stroke]}`).join(' ');
}

/**
 * Whether a pattern's slot count fits one measure, and at which subdivision.
 *
 * Returns { slotsPerBeat } or { error }. Eight slots in 4/4 are eighths; sixteen are sixteenths.
 */
export function fitPattern(slots, beatsPerBar) {
    for (const slotsPerBeat of SLOTS_PER_BEAT_CHOICES) {
        if (slots.length === slotsPerMeasure(beatsPerBar, slotsPerBeat)) return { slotsPerBeat };
    }
    const counts = SLOTS_PER_BEAT_CHOICES.map(n => slotsPerMeasure(beatsPerBar, n)).join(', ');
    return { error: `The pattern has ${slots.length} slots; a measure of ${beatsPerBar} beats needs ${counts}.` };
}

/** Today's chord practice: a downstroke on every beat. */
export function everyBeatDown(beatsPerBar) {
    return { name: 'Every beat, down', slotsPerBeat: 1, slots: Array.from({ length: beatsPerBar }, () => ({ stroke: 'down', accent: false })) };
}

/**
 * The same sound on the coarsest grid that holds it.
 *
 * `D - D - D - D -` in eighths is `D D D D` on the beat. Reading a score back always gives the
 * coarsest form, so two ways of writing the same pattern compare equal.
 */
export function coarsestPattern(slots, slotsPerBeat) {
    for (const coarser of SLOTS_PER_BEAT_CHOICES) {
        if (coarser >= slotsPerBeat || slotsPerBeat % coarser !== 0) continue;
        const step = slotsPerBeat / coarser;
        const fits = slots.every((slot, index) => index % step === 0 || slot.stroke === 'miss');
        if (fits) return { slotsPerBeat: coarser, slots: slots.filter((_, index) => index % step === 0) };
    }
    return { slotsPerBeat, slots };
}

/** Patterns that ship with unstrung, for 4/4. */
export const BUILT_IN_PATTERNS = [
    { name: 'Every beat, down', beatsPerBar: 4, text: 'D D D D' },
    { name: 'Down-up eighths', beatsPerBar: 4, text: 'D U D U D U D U' },
    { name: 'Old faithful', beatsPerBar: 4, text: 'D - D U - U D U' },
    { name: 'Three-three-two', beatsPerBar: 4, text: '>D D D >D D D >D D' }
];

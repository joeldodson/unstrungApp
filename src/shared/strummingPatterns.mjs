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

/** Down Only: a downstroke on every beat, which is what chord practice played before patterns. */
export function everyBeatDown(beatsPerBar) {
    return { name: 'Down Only', slotsPerBeat: 1, slots: Array.from({ length: beatsPerBar }, () => ({ stroke: 'down', accent: false })) };
}

/**
 * All Down-Up: down on every beat and up between. In compound time, where the beat is already an
 * eighth (6/8, 9/8, 12/8), the hand alternates on the eighths themselves.
 */
export function everyBeatDownUp(beatsPerBar, beatUnit) {
    const compound = beatUnit >= 8;
    const slotsPerBeat = compound ? 1 : 2;
    const count = beatsPerBar * slotsPerBeat;
    return {
        name: 'All Down-Up', slotsPerBeat,
        slots: Array.from({ length: count }, (_, index) => ({ stroke: index % 2 === 0 ? 'down' : 'up', accent: false }))
    };
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

// --- Patterns that ship with unstrung ----------------------------------------------------------
//
// The ones guitar teachers start with, by time signature, in the notation they use: D and U on the
// eighth-note grid, down on the beat and up on the "and", a dash where the hand passes the strings,
// x for a muted chuck, > for an accent. Each is written on the coarsest grid that holds it, so a
// pattern read back from a score, which always comes back coarsest, compares equal to its entry.
// Down Only and All Down-Up come first in every time signature, and are made for any time
// signature not listed (everyBeatDown, everyBeatDownUp). See
// docs/strumming-patterns-and-metronome.md for where these came from.

export const BUILT_IN_PATTERNS = [
    // 4/4
    { name: 'Down Only', timeSignature: '4/4', text: 'D D D D', about: 'A downstroke on each beat.' },
    { name: 'All Down-Up', timeSignature: '4/4', text: 'D U D U D U D U', about: 'Down on each beat, up on each and.' },
    { name: 'Old Faithful', timeSignature: '4/4', text: 'D - D U - U D U',
        about: 'D DU UDU, the most common strum of all. Also called the Island Strum.' },
    { name: 'Boom-Chicka', timeSignature: '4/4', text: 'D - D U D - D U', about: 'D DUD DU, country and folk.' },
    { name: 'Eighth-Note Downs', timeSignature: '4/4', text: 'D D D D D D D D', about: 'Down on every beat and every and. Driving rock and punk.' },
    { name: 'Three-Three-Two', timeSignature: '4/4', text: '>D D D >D D D >D D',
        about: 'Eighth-note downs grouped three, three, two, accented on beat 1, the and of 2, and beat 4.' },
    { name: 'Backbeat Chuck', timeSignature: '4/4', text: 'D - x U - U x U', about: 'Old Faithful with muted chucks on beats 2 and 4, where a snare drum would be.' },
    { name: 'Reggae Offbeat', timeSignature: '4/4', text: '- U - U - U - U', about: 'Upstrokes on the ands only.' },

    // 3/4
    { name: 'Down Only', timeSignature: '3/4', text: 'D D D', about: 'A downstroke on each beat.' },
    { name: 'All Down-Up', timeSignature: '3/4', text: 'D U D U D U', about: 'Down on each beat, up on each and.' },
    { name: 'Waltz Strum', timeSignature: '3/4', text: 'D - D U D U', about: 'Down, down-up, down-up: the usual first pattern in three.' },
    { name: 'Oom-Pah-Pah', timeSignature: '3/4', text: '>D D D', about: 'Three downs, the first one strong.' },
    { name: 'Down Down Down-Up', timeSignature: '3/4', text: 'D - D - D U', about: 'Down, down, down-up.' },

    // 6/8: six eighth-note beats, felt in two, on 1 and 4.
    { name: 'Down Only', timeSignature: '6/8', text: 'D D D D D D', about: 'A downstroke on each of the six eighths.' },
    { name: 'All Down-Up', timeSignature: '6/8', text: 'D U D U D U', about: 'Down and up in turn on the eighths.' },
    { name: 'On the Pulse', timeSignature: '6/8', text: 'D - - D - -', about: 'Two downs, on 1 and 4, where the pulse is felt.' },
    { name: 'Accented Downs', timeSignature: '6/8', text: '>D D D >D D D', about: 'Six downs, strong on 1 and 4.' },
    { name: 'Rolling Six', timeSignature: '6/8', text: 'D U D D U D', about: 'DUD DUD, which puts the weight on 1 and 4 by itself.' },
    { name: 'Ballad Six', timeSignature: '6/8', text: 'D - U D - U', about: 'Strums on 1, 3, 4 and 6: down-up, down-up.' },

    // 2/4
    { name: 'Down Only', timeSignature: '2/4', text: 'D D', about: 'A downstroke on each beat.' },
    { name: 'All Down-Up', timeSignature: '2/4', text: 'D U D U', about: 'Down on each beat, up on each and.' },
    { name: 'Down, Down-Up', timeSignature: '2/4', text: 'D - D U', about: 'Down, then down-up. Polkas and marches.' },

    // 12/8: four beats of three eighths, slow blues and ballads.
    { name: 'Down Only', timeSignature: '12/8', text: 'D D D D D D D D D D D D', about: 'A downstroke on each of the twelve eighths.' },
    { name: 'All Down-Up', timeSignature: '12/8', text: 'D U D U D U D U D U D U', about: 'Down and up in turn on the eighths.' },
    { name: 'On the Pulse', timeSignature: '12/8', text: 'D - - D - - D - - D - -', about: 'Four downs, one on each felt beat.' },
    { name: 'Slow Blues', timeSignature: '12/8', text: '>D D D >D D D >D D D >D D D', about: 'Every eighth down, strong on each felt beat.' }
];

/**
 * The patterns offered for a time signature, each ready to play:
 * { name, about, text, slotsPerBeat, slots }.
 *
 * The built-in ones where the time signature has them, else Down Only and All Down-Up made for it.
 */
export function patternsFor(beatsPerBar, beatUnit) {
    const signature = `${beatsPerBar}/${beatUnit}`;
    const listed = BUILT_IN_PATTERNS.filter(p => p.timeSignature === signature);
    if (listed.length === 0) {
        return [everyBeatDown(beatsPerBar), everyBeatDownUp(beatsPerBar, beatUnit)].map(pattern => ({
            ...pattern,
            about: pattern.name === 'Down Only' ? 'A downstroke on each beat.' : 'Down and up in turn.',
            text: formatStrummingPattern(pattern.slots)
        }));
    }
    return listed.map(entry => {
        const { slots } = parseStrummingPattern(entry.text);
        const { slotsPerBeat } = fitPattern(slots, beatsPerBar);
        return { name: entry.name, about: entry.about, text: entry.text, slotsPerBeat, slots };
    });
}

/** The built-in pattern a pattern sounds the same as, in its time signature, or null. */
export function builtInPatternLike(pattern, beatsPerBar, beatUnit) {
    const wanted = formatStrummingPattern(coarsestPattern(pattern.slots, pattern.slotsPerBeat).slots);
    return patternsFor(beatsPerBar, beatUnit).find(candidate =>
        formatStrummingPattern(coarsestPattern(candidate.slots, candidate.slotsPerBeat).slots) === wanted) ?? null;
}

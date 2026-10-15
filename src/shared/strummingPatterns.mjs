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

/** The built-in patterns for a time signature, as { name, about, text }. */
function builtInEntriesFor(beatsPerBar, beatUnit) {
    const signature = `${beatsPerBar}/${beatUnit}`;
    const listed = BUILT_IN_PATTERNS.filter(p => p.timeSignature === signature);
    if (listed.length > 0) return listed;
    return [everyBeatDown(beatsPerBar), everyBeatDownUp(beatsPerBar, beatUnit)].map(pattern => ({
        name: pattern.name,
        about: pattern.name === 'Down Only' ? 'A downstroke on each beat.' : 'Down and up in turn.',
        text: formatStrummingPattern(pattern.slots)
    }));
}

/**
 * The patterns offered for a time signature, each ready to play:
 * { name, about, text, slotsPerBeat, slots, own }.
 *
 * The built-in ones where the time signature has them, else Down Only and All Down-Up made for it;
 * then the player's own for that time signature, from `own` (see checkOwnPattern), marked own.
 */
export function patternsFor(beatsPerBar, beatUnit, own = []) {
    const signature = `${beatsPerBar}/${beatUnit}`;
    const entries = [
        ...builtInEntriesFor(beatsPerBar, beatUnit).map(entry => ({ ...entry, own: false })),
        ...own.filter(p => p.timeSignature === signature).map(p => ({ name: p.name, about: '', text: p.text, own: true }))
    ];
    return entries.map(entry => {
        const { slots } = parseStrummingPattern(entry.text);
        const { slotsPerBeat } = fitPattern(slots, beatsPerBar);
        return { ...entry, slotsPerBeat, slots };
    });
}

/** The named pattern, built-in or the player's own, that a pattern sounds the same as, or null. */
export function namedPatternLike(pattern, beatsPerBar, beatUnit, own = []) {
    const wanted = formatStrummingPattern(coarsestPattern(pattern.slots, pattern.slotsPerBeat).slots);
    return patternsFor(beatsPerBar, beatUnit, own).find(candidate =>
        formatStrummingPattern(coarsestPattern(candidate.slots, candidate.slotsPerBeat).slots) === wanted) ?? null;
}

// --- A player's own patterns ---------------------------------------------------------------------
//
// Kept in settings as { name, timeSignature, text }: "Busy Folk", "4/4", "D - D U D U D U".
// Exported and imported as plain text, one per line, as the lists read them:
//
//   4/4, Busy Folk: D - D U D U D U
//
// Lines starting with # are notes and are passed over. See
// docs/strumming-patterns-and-metronome.md, Making your own patterns.

export const MAX_PATTERN_NAME_LENGTH = 60;
const MAX_TIME_SIGNATURE_NUMBER = 16;

const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Checks a pattern of the player's own before it is kept, and puts it in its stored form.
 *
 * Returns { pattern } or { error, field }, field being 'name', 'timeSignature' or 'strokes', so
 * the dialog can put focus where the problem is. The name must be new within its time signature,
 * among the built-in patterns and the player's own (`own`), except the one being edited
 * (`replacing`). The strokes are stored in their tidy form: capital letters, single spaces.
 */
export function checkOwnPattern({ name, beatsPerBar, beatUnit, text }, { own = [], replacing = null } = {}) {
    const cleanName = String(name ?? '').replace(/\s+/g, ' ').trim();
    if (!cleanName) return { error: 'The pattern needs a name.', field: 'name' };
    if (cleanName.length > MAX_PATTERN_NAME_LENGTH) {
        return { error: `The name is longer than ${MAX_PATTERN_NAME_LENGTH} characters.`, field: 'name' };
    }
    if (cleanName.includes(':')) return { error: 'The name cannot contain a colon.', field: 'name' };
    for (const [value, label] of [[beatsPerBar, 'beats per measure'], [beatUnit, 'note value that gets one beat']]) {
        if (!Number.isInteger(value) || value < 1 || value > MAX_TIME_SIGNATURE_NUMBER) {
            return { error: `The ${label} must be a whole number from 1 to ${MAX_TIME_SIGNATURE_NUMBER}.`, field: 'timeSignature' };
        }
    }
    const read = parseStrummingPattern(text);
    if (read.error) return { error: read.error, field: 'strokes' };
    const fit = fitPattern(read.slots, beatsPerBar);
    if (fit.error) return { error: fit.error, field: 'strokes' };

    const timeSignature = `${beatsPerBar}/${beatUnit}`;
    if (builtInEntriesFor(beatsPerBar, beatUnit).some(p => sameName(p.name, cleanName))) {
        return { error: `${cleanName} is already the name of a built-in pattern in ${timeSignature}.`, field: 'name' };
    }
    if (own.some(p => p !== replacing && p.timeSignature === timeSignature && sameName(p.name, cleanName))) {
        return { error: `You already have a pattern called ${cleanName} in ${timeSignature}.`, field: 'name' };
    }
    // One set of strokes, one name: otherwise which name a progression's pattern is given would
    // depend on the order the lists happen to be in.
    const others = own.filter(p => p !== replacing);
    const twin = namedPatternLike({ slotsPerBeat: fit.slotsPerBeat, slots: read.slots }, beatsPerBar, beatUnit, others);
    if (twin) return { error: `Those strokes are already ${twin.name} in ${timeSignature}.`, field: 'strokes' };
    return { pattern: { name: cleanName, timeSignature, text: formatStrummingPattern(read.slots) } };
}

/** A pattern as one line of an exported file. */
export function formatPatternLine(pattern) {
    return `${pattern.timeSignature}, ${pattern.name}: ${pattern.text}`;
}

/** The whole exported file: a note saying what it is, then one pattern per line. */
export function formatPatternFile(patterns) {
    return [
        '# unstrung strumming patterns, one per line: time signature, name, colon, strokes.',
        ...patterns.map(formatPatternLine)
    ].join('\n') + '\n';
}

/**
 * Reads an exported file, or text written the same way by hand.
 *
 * Returns { lines: [{ line, beatsPerBar, beatUnit, name, text }], problems: [{ line, reason }] },
 * line numbers counting from 1. Only the shape of each line is checked here; mergeImportedPatterns
 * checks each pattern itself.
 */
export function parsePatternFile(text) {
    const lines = [];
    const problems = [];
    for (const [index, raw] of String(text ?? '').split(/\r?\n/).entries()) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        // The time signature, a comma, the name up to the last colon, then the strokes, which
        // never contain a colon themselves.
        const match = /^(\d+)\s*\/\s*(\d+)\s*,\s*(.+):\s*(.*)$/.exec(line);
        if (!match) {
            problems.push({ line: index + 1, reason: 'it is not written as time signature, name, colon, strokes' });
            continue;
        }
        lines.push({
            line: index + 1, beatsPerBar: Number(match[1]), beatUnit: Number(match[2]),
            name: match[3].trim(), text: match[4].trim()
        });
    }
    return { lines, problems };
}

/**
 * Adds imported patterns to the player's own.
 *
 * A pattern with the same strokes as one already kept under the same name, or as a built-in, is
 * skipped as already there. One reusing a name with other strokes is added with "(imported)" after
 * the name, numbered if that is taken too. A line whose pattern does not check out is a problem,
 * with its line number. Returns { own, added, skipped, renamed, problems }.
 */
export function mergeImportedPatterns(own, text) {
    const { lines, problems } = parsePatternFile(text);
    const result = [...own];
    let added = 0;
    let skipped = 0;
    const renamed = [];
    for (const entry of lines) {
        const read = parseStrummingPattern(entry.text);
        const timeSignature = `${entry.beatsPerBar}/${entry.beatUnit}`;
        if (!read.error) {
            const strokes = formatStrummingPattern(read.slots);
            const sameAsBuiltIn = builtInEntriesFor(entry.beatsPerBar, entry.beatUnit)
                .some(p => sameName(p.name, entry.name) && p.text === strokes);
            const sameAsOwn = result.some(p => p.timeSignature === timeSignature &&
                sameName(p.name, entry.name) && p.text === strokes);
            if (sameAsBuiltIn || sameAsOwn) { skipped++; continue; }
        }

        let checked = checkOwnPattern(entry, { own: result });
        if (checked.error && checked.field === 'name' && /already/.test(checked.error)) {
            for (let n = 1; n < 100 && checked.error; n++) {
                const name = `${entry.name} (imported${n === 1 ? '' : ` ${n}`})`;
                checked = checkOwnPattern({ ...entry, name }, { own: result });
            }
            if (checked.pattern) renamed.push({ line: entry.line, from: entry.name, to: checked.pattern.name });
        }
        if (checked.error) {
            // Worded to follow "line 9:", like the reasons parsePatternFile gives.
            const reason = checked.error.replace(/\.$/, '');
            problems.push({ line: entry.line, reason: reason[0].toLowerCase() + reason.slice(1) });
            continue;
        }
        result.push(checked.pattern);
        added++;
    }
    problems.sort((a, b) => a.line - b.line);
    return { own: result, added, skipped, renamed, problems };
}

/**
 * The pattern read back slot by slot, as words: "1 down, and miss, 2 down, and up".
 *
 * Beats are numbered; between them come "and", or "e, and, a" in sixteenths. Accented strokes say
 * so. Used under the strokes field, where a screen reader reading the text itself may pass over
 * the dashes and the greater-than signs.
 */
export function describeStrummingPattern(slots, slotsPerBeat) {
    const between = { 1: [], 2: ['and'], 4: ['e', 'and', 'a'] }[slotsPerBeat] ?? [];
    const word = { down: 'down', up: 'up', miss: 'miss', mute: 'mute' };
    return slots.map((slot, index) => {
        const position = index % slotsPerBeat === 0
            ? String(index / slotsPerBeat + 1)
            : between[(index % slotsPerBeat) - 1];
        return `${position} ${slot.accent ? 'accented ' : ''}${word[slot.stroke]}`;
    }).join(', ');
}

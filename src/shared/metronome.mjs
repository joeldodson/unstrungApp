// The metronome: clicks laid out on the slot grid of a strumming pattern.
//
// A strumming pattern divides a measure into slots and says what the hand does in each (see
// strummingPatterns.mjs). The metronome clicks wherever the hand strikes the strings, and is silent
// on a miss. The sound follows the stroke, not where it falls: a down stroke is a down click, an up
// stroke an up click, a mute a click of its own. So eight downs in a measure are eight of the same
// click, and only a pattern that goes up as well sounds two.
//
// Each click is strong or plain. A pattern with accents of its own makes its accents strong, so
// Three-Three-Two is heard in its threes and twos. One without makes its first stroke strong, so
// the measure can be heard to start: beat 1 in most patterns, the and of 1 in Reggae Offbeat. A
// strong click is louder, and the renderer gives it its own sound as well: a hard attack on a down,
// a higher tick on an up, so the two kinds of strong click differ from each other too.
//
// Also the arithmetic for changing tempo or pattern while it plays: the clicks are timed from an
// anchor, { time, slot, slotSeconds }, the audio clock time of one slot. Changing either sets a new
// anchor on a slot still to come, so the clicks carry on from where they were rather than starting
// the measure again.
//
// No DOM and no Web Audio here: the renderer schedules the sounds. See
// docs/strumming-patterns-and-metronome.md.

export const METRONOME_MIN_TEMPO = 30;
export const METRONOME_MAX_TEMPO = 240;
export const METRONOME_DEFAULT_TEMPO = 80;
// One press of Faster or Slower, the same step as chord practice and audio tracks.
export const METRONOME_TEMPO_STEP = 5;

export const METRONOME_MIN_VOLUME = 1;
export const METRONOME_MAX_VOLUME = 5;
export const METRONOME_DEFAULT_VOLUME = 3;

// The gain of a strong down click at each volume, 1 to 5. Each step is about 1.6 times the last,
// some 4 decibels, so the steps sound even. Level 1 is a little under the beat clicks that play
// along with chord practice; level 5 is as loud as a click can be made without the risk of
// clipping once other sound is playing as well. Chosen for first testing, to be adjusted by ear.
export const METRONOME_VOLUME_GAINS = [0.08, 0.13, 0.21, 0.34, 0.55];

// How loud each sound is beside a down click. An up click is quieter as well as higher, as an
// upstroke is lighter than a downstroke, so the two differ in loudness as well as pitch.
export const METRONOME_SOUND_GAINS = { down: 1, up: 0.45, mute: 0.7 };
// How loud a plain click is beside a strong one: some 8 decibels down. It was 0.55, about 5
// decibels, the ratio the chord practice clicks use, and Joel found beat 1 hard to pick out.
export const METRONOME_PLAIN_GAIN = 0.4;

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/** A tempo in range, as a whole number, or null when `value` is not a positive number. */
export function clampMetronomeTempo(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return null;
    return clamp(Math.round(number), METRONOME_MIN_TEMPO, METRONOME_MAX_TEMPO);
}

/** A volume level in range, as a whole number, or null when `value` is not a number. */
export function clampMetronomeVolume(value) {
    const number = Number(value);
    if (value === '' || value === null || !Number.isFinite(number)) return null;
    return clamp(Math.round(number), METRONOME_MIN_VOLUME, METRONOME_MAX_VOLUME);
}

/** The gain of an accented click at a volume level. */
export function metronomeVolumeGain(volume) {
    return METRONOME_VOLUME_GAINS[clampMetronomeVolume(volume) - 1];
}

/**
 * The click of each slot of a pattern, from its strokes ({ slots } as patternsFor gives them):
 * null on a miss, otherwise { sound: 'down' | 'up' | 'mute', strong }.
 */
export function metronomeClicks(pattern) {
    const { slots } = pattern;
    const accented = slots.some(slot => slot.accent && slot.stroke !== 'miss');
    const firstStroke = slots.findIndex(slot => slot.stroke !== 'miss');
    return slots.map((slot, index) => {
        if (slot.stroke === 'miss') return null;
        return { sound: slot.stroke, strong: accented ? slot.accent : index === firstStroke };
    });
}

/** How loud a click is beside a strong down click. */
export function metronomeClickGain(click) {
    return METRONOME_SOUND_GAINS[click.sound] * (click.strong ? 1 : METRONOME_PLAIN_GAIN);
}

/**
 * The clicks written out, one word a slot, for checks: `strong-down - down up - up down up`,
 * a dash for no click.
 */
export function formatMetronomeClicks(clicks) {
    return clicks.map(click => (click ? `${click.strong ? 'strong-' : ''}${click.sound}` : '-')).join(' ');
}

/**
 * The clicks in words, for reading beside the pattern list: "Clicks on 1 strong down, 2 down,
 * 2 and up, 3 and up, 4 down, 4 and up." A position between beats is named with its beat, since a
 * bare "and" cannot say which beat it follows when the beat itself has no click.
 */
export function describeMetronomeClicks(clicks, slotsPerBeat) {
    const between = { 1: [], 2: ['and'], 4: ['e', 'and', 'a'] }[slotsPerBeat] ?? [];
    const words = clicks.flatMap((click, index) => {
        if (!click) return [];
        const beat = Math.floor(index / slotsPerBeat) + 1;
        const within = index % slotsPerBeat;
        const position = within === 0 ? String(beat) : `${beat} ${between[within - 1] ?? ''}`.trim();
        return [`${position} ${click.strong ? 'strong ' : ''}${click.sound}`];
    });
    return words.length ? `Clicks on ${words.join(', ')}.` : 'No clicks: the pattern strikes nothing.';
}

/** How long one slot lasts, in seconds. The tempo counts beats, the lower number of the signature. */
export function metronomeSlotSeconds(tempo, slotsPerBeat) {
    return 60 / tempo / slotsPerBeat;
}

/** When slot `n` sounds, by the anchor. */
export function metronomeSlotTime(anchor, n) {
    return anchor.time + (n - anchor.slot) * anchor.slotSeconds;
}

/** The first slot that sounds after `time`. */
export function firstMetronomeSlotAfter(anchor, time) {
    const n = Math.floor((time - anchor.time) / anchor.slotSeconds) + anchor.slot + 1;
    // Rounding can put n on a slot at `time` itself or one too far; settle it exactly.
    if (metronomeSlotTime(anchor, n - 1) > time) return n - 1;
    if (metronomeSlotTime(anchor, n) <= time) return n + 1;
    return n;
}

/**
 * A new tempo from the first slot after `time`: the slot keeps its place on the clock, and the
 * slots after it come at the new spacing.
 */
export function retimeMetronome(anchor, time, slotSeconds) {
    const n = firstMetronomeSlotAfter(anchor, time);
    return { time: metronomeSlotTime(anchor, n), slot: n, slotSeconds };
}

/**
 * A new pattern from the first beat after `time`. The beat keeps its place on the clock. With the
 * same time signature, it keeps its place in the measure too: a change on beat 3 carries on from
 * beat 3 of the new pattern. With another, a new measure starts there.
 *
 * `from` and `to` are { slotsPerBeat, slotsPerMeasure }.
 */
export function regridMetronome(anchor, time, from, to, slotSeconds, { sameSignature }) {
    let n = firstMetronomeSlotAfter(anchor, time);
    while (((n % from.slotsPerBeat) + from.slotsPerBeat) % from.slotsPerBeat !== 0) n++;
    const beat = n / from.slotsPerBeat;
    const beatsPerMeasure = from.slotsPerMeasure / from.slotsPerBeat;
    const beatInMeasure = ((beat % beatsPerMeasure) + beatsPerMeasure) % beatsPerMeasure;
    return {
        time: metronomeSlotTime(anchor, n),
        slot: sameSignature ? beatInMeasure * to.slotsPerBeat : 0,
        slotSeconds
    };
}

/** Which slot of the measure slot `n` is. */
export function metronomeSlotInMeasure(n, slotsPerMeasure) {
    return ((n % slotsPerMeasure) + slotsPerMeasure) % slotsPerMeasure;
}

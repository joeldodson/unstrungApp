// The metronome: clicks laid out on the slot grid of a strumming pattern.
//
// A strumming pattern divides a measure into slots and says what the hand does in each (see
// strummingPatterns.mjs). The metronome clicks wherever the hand strikes the strings, a down, an
// up or a mute, and is silent on a miss. Each click has a level, as the design gives them:
//
//   0  silent
//   1  soft: a stroke between the pulses, such as an and
//   2  normal: a stroke on a pulse
//   3  accent: beat 1, or a stroke the pattern accents with >
//
// A pattern with accents of its own decides the accents itself: those strokes are 3 and every
// other stroke is 1, so Three-Three-Two is heard in its threes and twos rather than in fours. One
// without accents is accented on beat 1. The pulses are the beats, except in compound time (6/8,
// 9/8, 12/8), where every third eighth is a pulse, so 6/8 is heard on 1 and 4.
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

// The gain of an accented click at each volume, 1 to 5. Each step is about 1.6 times the last,
// some 4 decibels, so the steps sound even. Level 1 is a little under the beat clicks that play
// along with chord practice; level 5 is as loud as a click can be made without the risk of
// clipping once other sound is playing as well. Chosen for first testing, to be adjusted by ear.
export const METRONOME_VOLUME_GAINS = [0.08, 0.13, 0.21, 0.34, 0.55];

// How loud each click level is beside an accent at the same volume. Normal is the ratio the
// chord practice clicks already use between the downbeat and the other beats.
export const METRONOME_LEVEL_GAINS = [0, 0.35, 0.55, 1];

export const CLICK_SILENT = 0;
export const CLICK_SOFT = 1;
export const CLICK_NORMAL = 2;
export const CLICK_ACCENT = 3;

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
 * Whether a time signature is compound: a multiple of three eighths, more than three of them. Its
 * pulse is every third eighth.
 */
export function isCompoundTime(beatsPerBar, beatUnit) {
    return beatUnit === 8 && beatsPerBar > 3 && beatsPerBar % 3 === 0;
}

/**
 * The click level of each slot of a pattern, from its strokes: { slots, slotsPerBeat } as
 * patternsFor gives them.
 */
export function metronomeLevels(pattern, beatsPerBar, beatUnit) {
    const { slots, slotsPerBeat } = pattern;
    const accented = slots.some(slot => slot.accent && slot.stroke !== 'miss');
    const beatsPerPulse = isCompoundTime(beatsPerBar, beatUnit) ? 3 : 1;
    return slots.map((slot, index) => {
        if (slot.stroke === 'miss') return CLICK_SILENT;
        if (accented) return slot.accent ? CLICK_ACCENT : CLICK_SOFT;
        if (index === 0) return CLICK_ACCENT;
        const onPulse = index % (slotsPerBeat * beatsPerPulse) === 0;
        return onPulse ? CLICK_NORMAL : CLICK_SOFT;
    });
}

/** Levels as the design writes them: digits separated by spaces, `3 0 2 1 2 0 2 1`. */
export function formatMetronomeLevels(levels) {
    return levels.join(' ');
}

/**
 * The clicks in words, for reading beside the pattern list: "Clicks on 1 strong, 2, 2 and soft,
 * 3 and soft, 4, 4 and soft." A position between beats is named with its beat, since a bare "and"
 * cannot say which beat it follows when the beat itself has no click.
 */
export function describeMetronomeClicks(levels, slotsPerBeat) {
    const between = { 1: [], 2: ['and'], 4: ['e', 'and', 'a'] }[slotsPerBeat] ?? [];
    const loudness = { [CLICK_SOFT]: ' soft', [CLICK_NORMAL]: '', [CLICK_ACCENT]: ' strong' };
    const clicks = levels.flatMap((level, index) => {
        if (level === CLICK_SILENT) return [];
        const beat = Math.floor(index / slotsPerBeat) + 1;
        const within = index % slotsPerBeat;
        const position = within === 0 ? String(beat) : `${beat} ${between[within - 1] ?? ''}`.trim();
        return [`${position}${loudness[level]}`];
    });
    return clicks.length ? `Clicks on ${clicks.join(', ')}.` : 'No clicks: the pattern strikes nothing.';
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

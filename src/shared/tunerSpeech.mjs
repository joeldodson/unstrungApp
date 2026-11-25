// What the tuner says as a string is tuned, and when.
//
// Joel's rules, 2026-11-24 (docs/guitar-tuner.md, Spoken Readings):
//   - A new sound is named in full: "E2, 10 cents flat".
//   - While it carries on, only the number is said as it changes: "7", "4".
//   - When it crosses to the other side of the note, or into tune, the direction is said again:
//     "3 cents sharp", "in tune".
//   - Closer to another note, that note is named in full.
//   - After a silence, or when the string is plucked again, it starts over with the full reading.
//
// Two styles, both following those rules (docs/guitar-tuner.md, Speaking once it settles):
//   - every: every change of about a cent, from a fifth of a second after the pluck.
//   - settled: added 2026-11-24 when "every" proved too talkative on a low E, whose pitch really
//     moves by several cents after a pluck. A plucked string starts sharp and slides flat, fast at
//     first, for a second or two. This waits until the reading moves less than 4 cents a second,
//     at least half a second and at most two, says the middle of the readings, then speaks again
//     only on a real change: past 4 cents from what was said, or to the other side of the note,
//     held for 0.3 seconds.
//
// Kept free of the DOM and of timers, so it can be checked in Node: the tuner hands it each reading
// and the time, and it returns the words to say, or null.

import { IN_TUNE_CENTS, describeCents, tunerNoteName } from './pitchDetection.mjs';

// Out of tune again only this far past the in-tune range, so a string sitting at the edge does
// not flip back and forth. Past it the reading rounds up, so from in tune within 2 cents to
// "3 cents sharp" is said.
const LEAVE_TUNE_MARGIN = 0.75;

// For the chime, which keeps the 2 cent range whatever speech uses.
export const LEAVE_TUNE_CENTS = IN_TUNE_CENTS + LEAVE_TUNE_MARGIN;

// A new number is said only once the reading is this far from the last one said, so a reading
// sitting between two whole cents does not alternate.
const NUMBER_HYSTERESIS_CENTS = 0.75;

// The settled style's timings and sizes.
export const SETTLE_MS = 500;
export const SETTLE_MAX_MS = 2000;
const SETTLE_WINDOW_MS = 300;
const SETTLED_CENTS_PER_SECOND = 4;
const CHANGE_CENTS = 4;
const CHANGE_HOLD_MS = 300;

/**
 * Which side of the note: -1 flat, 0 in tune, 1 sharp. `previous` is the side last said, and
 * `inTuneCents` how close counts as in tune.
 */
export function tuneSide(cents, previous = null, inTuneCents = IN_TUNE_CENTS) {
    const limit = previous === 0 ? inTuneCents + LEAVE_TUNE_MARGIN : inTuneCents;
    if (Math.abs(cents) <= limit) return 0;
    return cents < 0 ? -1 : 1;
}

function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = sorted.length >> 1;
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * The spoken readings for one tuner.
 *
 * `style`: 'every' or 'settled', as described at the top.
 * `inTuneCents`: how close is said as in tune, 2 or 3.
 * `speakAfterMs`: in the every style, how long a note must hold before it is named, so a pluck's
 * first instant, which can read as a neighbouring note, is not. The settled style waits SETTLE_MS.
 * `gapMs`: the least time between two things said. A screen reader says a live region's text after
 * what it is already saying, so anything faster than it can speak piles up and falls behind.
 *
 * heard(target, now): target is { midi, cents, string? }, as nearestNote or nearestString gives,
 * with the cents smoothed. Returns the words to say now, or null.
 * restart(): forget what has been said, so the next reading is named in full. For a silence or a
 * new pluck.
 */
export function createTunerSpeech({ style = 'every', inTuneCents = IN_TUNE_CENTS, speakAfterMs = 200, gapMs = 700 } = {}) {
    let candidate = null;
    let candidateSince = 0;
    let recent = [];
    let spokenKey = null;
    let spokenCents = 0;
    let spokenSide = null;
    let spokeAt = -Infinity;
    let changeSince = null;

    const say = (text, key, cents, side, now) => {
        spokenKey = key;
        spokenCents = style === 'settled' ? cents : Math.round(cents);
        spokenSide = side;
        spokeAt = now;
        changeSince = null;
        return text;
    };

    const full = (target, key, cents, now) => {
        const where = target.string ? `string ${target.string}, ` : '';
        const text = `${where}${tunerNoteName(target.midi)}, ${describeCents(cents, inTuneCents)}`;
        return say(text, key, cents, tuneSide(cents, null, inTuneCents), now);
    };

    // The same side named again with its direction, or just the number.
    const change = (key, cents, side, now) => {
        if (side !== spokenSide) {
            return say(side === 0 ? 'in tune' : describeCents(cents, inTuneCents), key, cents, side, now);
        }
        if (side === 0) {
            // Still in tune, only moved within it: nothing to say.
            spokenCents = cents;
            changeSince = null;
            return null;
        }
        return say(String(Math.abs(Math.round(cents))), key, cents, side, now);
    };

    function every(target, key, now) {
        if (now - candidateSince < speakAfterMs || now - spokeAt < gapMs) return null;
        const { cents } = target;
        if (key !== spokenKey) return full(target, key, cents, now);
        const side = tuneSide(cents, spokenSide, inTuneCents);
        if (side !== spokenSide) return change(key, cents, side, now);
        if (side === 0) return null;
        const rounded = Math.round(cents);
        if (rounded === spokenCents || Math.abs(cents - spokenCents) < NUMBER_HYSTERESIS_CENTS) return null;
        return change(key, cents, side, now);
    }

    // Whether the reading has slowed down: the middle of its last third against the middle of its
    // first third, over the last 0.3 seconds.
    function steady(now) {
        const span = now - recent[0].at;
        if (span < SETTLE_WINDOW_MS * 0.8) return false;
        const third = span / 3;
        const early = median(recent.filter(r => r.at <= recent[0].at + third).map(r => r.cents));
        const late = median(recent.filter(r => r.at >= now - third).map(r => r.cents));
        return Math.abs(late - early) / ((span - third) / 1000) <= SETTLED_CENTS_PER_SECOND;
    }

    function settled(target, key, now) {
        const elapsed = now - candidateSince;
        if (elapsed < SETTLE_MS) return null;
        const middle = median(recent.map(r => r.cents));
        if (key !== spokenKey) {
            if (now - spokeAt < gapMs || (elapsed < SETTLE_MAX_MS && !steady(now))) return null;
            return full(target, key, middle, now);
        }
        const side = tuneSide(middle, spokenSide, inTuneCents);
        const moved = side !== spokenSide || Math.abs(middle - spokenCents) > CHANGE_CENTS;
        if (!moved) {
            changeSince = null;
            return null;
        }
        changeSince ??= now;
        if (now - changeSince < CHANGE_HOLD_MS || now - spokeAt < gapMs) return null;
        return change(key, middle, side, now);
    }

    return {
        heard(target, now) {
            const key = `${target.string ?? ''}:${target.midi}`;
            if (key !== candidate) {
                candidate = key;
                candidateSince = now;
                recent = [];
                changeSince = null;
            }
            recent.push({ at: now, cents: target.cents });
            while (now - recent[0].at > SETTLE_WINDOW_MS) recent.shift();
            if (now === candidateSince) return null;
            return style === 'settled' ? settled(target, key, now) : every(target, key, now);
        },

        restart() {
            candidate = null;
            recent = [];
            spokenKey = null;
            spokenSide = null;
            spokeAt = -Infinity;
            changeSince = null;
        }
    };
}

/**
 * Tells a new pluck from a string ringing on: a string only gets quieter once plucked, so a level
 * that jumps up is a new pluck. `add(level)` takes one RMS level per reading, of a short stretch of
 * the input, and returns true on the reading where a pluck starts.
 *
 * `ratio`: how many times louder than the quietest of the last `lookback` levels. Twice is 6 dB.
 * `floor`: levels below this are not a pluck, so noise rising and falling is not one.
 * After a pluck, nothing more is a pluck while the level is still rising, and for `lookback`
 * readings after it peaks, so the quiet before the pluck is out of the comparison. Some recorded
 * strings take over 60 ms to reach their loudest, and without this were counted twice.
 */
export function createPluckDetector({ ratio = 2, lookback = 4, floor = 0 } = {}) {
    const levels = [];
    let rising = false;
    let quiet = 0;
    return {
        add(level) {
            const quietest = levels.length ? Math.min(...levels) : Infinity;
            const last = levels.at(-1);
            levels.push(level);
            if (levels.length > lookback) levels.shift();
            if (rising) {
                if (level < last) {
                    rising = false;
                    quiet = lookback;
                }
                return false;
            }
            if (quiet > 0) {
                quiet--;
                return false;
            }
            if (level >= floor && level > ratio * quietest) {
                rising = true;
                return true;
            }
            return false;
        },
        clear() {
            levels.length = 0;
            rising = false;
            quiet = 0;
        }
    };
}

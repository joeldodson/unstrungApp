// What the tuner says as a string is tuned, and when.
//
// Once per sound: it waits until the string has settled, says where it settled in full, "E2,
// 5 cents flat", and says nothing more until the string is plucked again, falls silent, or moves
// closer to another note, which is named in full the same way. Decided by Joel on 2026-11-24
// after trying his guitar through the logs (docs/guitar-tuner.md, Speaking once it settles):
//
//   - A plucked string starts sharp and slides flat for a second or two, a low E by 4 or 5 cents
//     on his guitar, and holds near its first pitch for about half a second before it slides.
//     What the string settles at is its tuning, not the pitch it passed through.
//   - Speaking every change, and later speaking again on a change of more than 4 cents, both
//     reported that slide as "in tune", then "4 cents flat", which was confusing.
//
// Settled means at least a second after the pluck, and the reading moving less than 3 cents a
// second over the last half second, or two seconds whatever it is doing. What is said is the
// middle, the median, of that last half second.
//
// Kept free of the DOM and of timers, so it can be checked in Node: the tuner hands it each reading
// and the time, and it returns the words to say, or null.

import { SAID_IN_TUNE_CENTS, describeCents, tunerNoteName } from './pitchDetection.mjs';

// How long to wait and what counts as settled. createTunerSpeech takes others in `settle`, so a
// check can try other timings.
export const SETTLE = Object.freeze({
    // Nothing is said sooner than this after a pluck, however steady the reading looks. Joel's low
    // E holds still for about half a second, then slides 4 or 5 cents flat by 1.25 seconds.
    minMs: 1000,
    // Said by this time even if the reading is still moving.
    maxMs: 2000,
    // Steady means the reading moved at most centsPerSecond over the last windowMs.
    windowMs: 500,
    centsPerSecond: 3
});

function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = sorted.length >> 1;
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * The spoken readings for one tuner.
 *
 * `inTuneCents`: how close is said as in tune.
 * `settle`: other values for SETTLE.
 *
 * heard(target, now): target is { midi, cents, string? }, as nearestNote or nearestString gives,
 * with the cents smoothed. Returns the words to say now, or null.
 * restart(): forget what has been said, so the next reading is named again. For a silence or a
 * new pluck.
 */
export function createTunerSpeech({ inTuneCents = SAID_IN_TUNE_CENTS, settle = {} } = {}) {
    const { minMs, maxMs, windowMs, centsPerSecond } = { ...SETTLE, ...settle };
    let candidate = null;
    let candidateSince = 0;
    let recent = [];
    let spokenKey = null;

    // Whether the reading has slowed down: the middle of its last third against the middle of its
    // first third, over the last windowMs.
    function steady(now) {
        const span = now - recent[0].at;
        if (span < windowMs * 0.8) return false;
        const third = span / 3;
        const early = median(recent.filter(r => r.at <= recent[0].at + third).map(r => r.cents));
        const late = median(recent.filter(r => r.at >= now - third).map(r => r.cents));
        return Math.abs(late - early) / ((span - third) / 1000) <= centsPerSecond;
    }

    return {
        heard(target, now) {
            const key = `${target.string ?? ''}:${target.midi}`;
            if (key !== candidate) {
                candidate = key;
                candidateSince = now;
                recent = [];
            }
            recent.push({ at: now, cents: target.cents });
            while (now - recent[0].at > windowMs) recent.shift();
            if (key === spokenKey) return null;
            const elapsed = now - candidateSince;
            if (elapsed < minMs || (elapsed < maxMs && !steady(now))) return null;
            spokenKey = key;
            const where = target.string ? `string ${target.string}, ` : '';
            return `${where}${tunerNoteName(target.midi)}, ${describeCents(median(recent.map(r => r.cents)), inTuneCents)}`;
        },

        restart() {
            candidate = null;
            recent = [];
            spokenKey = null;
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

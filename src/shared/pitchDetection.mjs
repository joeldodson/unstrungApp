// Pitch detection for the tuner, and the arithmetic of notes, cents and strings around it.
//
// Pure functions over plain arrays: no DOM, no Web Audio, so the checks run them under Node. The
// Tuner item in src/renderer/renderer.js feeds detectPitch from an AnalyserNode. See
// docs/guitar-tuner.md.

/** Concert A, the reference every note is measured from. */
export const A4_HZ = 440;

/** Within this many cents a string is said to be in tune. */
export const IN_TUNE_CENTS = 2;

/** The lowest and highest pitches the tuner reads. Drop C's low C is 65 Hz. */
export const TUNER_MIN_HZ = 60;
export const TUNER_MAX_HZ = 1100;

/**
 * Readings less clear than this are not used. A string dying away into noise drifts by tens of
 * cents below about 0.9 in the sample recordings, while a held string is above 0.95.
 */
export const TUNER_MIN_CLARITY = 0.9;

// The tuner names notes with sharps, as tuners do, written as words so a screen reader says them.
const NOTE_WORDS = ['C', 'C sharp', 'D', 'D sharp', 'E', 'F', 'F sharp', 'G', 'G sharp', 'A', 'A sharp', 'B'];

// --- FFT --------------------------------------------------------------------------------------

const fftTables = new Map();

/** Bit-reversal order and twiddle factors for a power-of-two size, made once per size. */
function fftTable(size) {
    let table = fftTables.get(size);
    if (table) return table;
    const bits = Math.log2(size);
    const reverse = new Uint32Array(size);
    for (let i = 0; i < size; i++) {
        let r = 0;
        for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
        reverse[i] = r;
    }
    const cos = new Float64Array(size / 2);
    const sin = new Float64Array(size / 2);
    for (let i = 0; i < size / 2; i++) {
        cos[i] = Math.cos((2 * Math.PI * i) / size);
        sin[i] = Math.sin((2 * Math.PI * i) / size);
    }
    table = { reverse, cos, sin };
    fftTables.set(size, table);
    return table;
}

/** In-place radix-2 FFT of a complex signal. `inverse` leaves the 1/N scaling to the caller. */
function fft(re, im, inverse) {
    const size = re.length;
    const { reverse, cos, sin } = fftTable(size);
    for (let i = 0; i < size; i++) {
        const j = reverse[i];
        if (j > i) {
            let t = re[i]; re[i] = re[j]; re[j] = t;
            t = im[i]; im[i] = im[j]; im[j] = t;
        }
    }
    const sign = inverse ? 1 : -1;
    for (let half = 1; half < size; half *= 2) {
        const step = size / (half * 2);
        for (let start = 0; start < size; start += half * 2) {
            for (let k = 0; k < half; k++) {
                const wr = cos[k * step];
                const wi = sign * sin[k * step];
                const a = start + k;
                const b = a + half;
                const tr = re[b] * wr - im[b] * wi;
                const ti = re[b] * wi + im[b] * wr;
                re[b] = re[a] - tr;
                im[b] = im[a] - ti;
                re[a] += tr;
                im[a] += ti;
            }
        }
    }
}

// --- The McLeod pitch method ------------------------------------------------------------------

/**
 * The pitch of a window of samples, by the McLeod pitch method: the normalised square difference
 * function, its first peak within `threshold` of the highest, refined by a parabola.
 *
 * Returns { frequency, clarity, rms }, or null when there is no periodic sound in range. Clarity
 * runs from 0 to 1 and says how periodic the window is: a held string is above 0.9, noise far
 * below. A pitch above `maxHz` is null rather than read an octave or more down, which keeps the
 * tuner's own high feedback tone from being taken for a note.
 */
export function detectPitch(samples, sampleRate, {
    minHz = TUNER_MIN_HZ, maxHz = TUNER_MAX_HZ, threshold = 0.9, minRms = 0
} = {}) {
    const length = samples.length;
    let mean = 0;
    for (let i = 0; i < length; i++) mean += samples[i];
    mean /= length;
    let energy = 0;
    for (let i = 0; i < length; i++) {
        const v = samples[i] - mean;
        energy += v * v;
    }
    const rms = Math.sqrt(energy / length);
    if (rms === 0 || rms < minRms) return null;

    const maxLag = Math.min(length - 2, Math.ceil(sampleRate / minHz));

    // Autocorrelation by FFT: zero-padded to twice the window so it does not wrap.
    let size = 1;
    while (size < length * 2) size *= 2;
    const re = new Float64Array(size);
    const im = new Float64Array(size);
    for (let i = 0; i < length; i++) re[i] = samples[i] - mean;
    fft(re, im, false);
    for (let i = 0; i < size; i++) {
        re[i] = re[i] * re[i] + im[i] * im[i];
        im[i] = 0;
    }
    fft(re, im, true);

    // The normalised square difference function, with its normaliser kept as a running sum.
    const nsdf = new Float64Array(maxLag + 2);
    let m = 2 * energy;
    const at = i => samples[i] - mean;
    for (let lag = 0; lag <= maxLag + 1; lag++) {
        if (lag > 0) {
            const a = at(lag - 1);
            const b = at(length - lag);
            m -= a * a + b * b;
        }
        nsdf[lag] = m > 0 ? (2 * (re[lag] / size)) / m : 0;
    }

    // Key maxima: the highest point of each positive lobe after the first fall below zero.
    const peaks = [];
    let lag = 1;
    while (lag <= maxLag && nsdf[lag] > 0) lag++;
    let best = -1;
    let bestLag = -1;
    for (; lag <= maxLag; lag++) {
        if (nsdf[lag] > 0) {
            if (nsdf[lag] > best) {
                best = nsdf[lag];
                bestLag = lag;
            }
        } else if (bestLag >= 0) {
            peaks.push(bestLag);
            best = -1;
            bestLag = -1;
        }
    }
    // A lobe still rising at the end of the range has not shown its peak.
    if (bestLag >= 0 && bestLag < maxLag) peaks.push(bestLag);
    if (peaks.length === 0) return null;

    let highest = 0;
    for (const p of peaks) highest = Math.max(highest, nsdf[p]);
    const chosen = peaks.find(p => nsdf[p] >= threshold * highest);

    const a = nsdf[chosen - 1];
    const b = nsdf[chosen];
    const c = nsdf[chosen + 1];
    const denominator = a - 2 * b + c;
    const shift = denominator === 0 ? 0 : (a - c) / (2 * denominator);
    const period = chosen + shift;
    const clarity = Math.min(1, b - ((a - c) * shift) / 4);
    const frequency = sampleRate / period;
    if (frequency > maxHz || frequency < minHz) return null;
    return { frequency, clarity, rms };
}

// --- Notes, cents and strings -----------------------------------------------------------------

/** A frequency as a MIDI note number with a fraction: 440 Hz is 69, 445 Hz about 69.2. */
export function frequencyToMidi(frequency, a4 = A4_HZ) {
    return 69 + 12 * Math.log2(frequency / a4);
}

export function midiToFrequency(midi, a4 = A4_HZ) {
    return a4 * 2 ** ((midi - 69) / 12);
}

/** A note's name for reading and speaking: "E2", "C sharp 3". Middle C is C4. */
export function tunerNoteName(midi) {
    const word = NOTE_WORDS[((midi % 12) + 12) % 12];
    const octave = Math.floor(midi / 12) - 1;
    return word.includes(' ') ? `${word} ${octave}` : `${word}${octave}`;
}

/** The nearest note to a frequency, and how far from it in cents: negative is flat. */
export function nearestNote(frequency, a4 = A4_HZ) {
    const exact = frequencyToMidi(frequency, a4);
    const midi = Math.round(exact);
    return { midi, cents: (exact - midi) * 100 };
}

/**
 * The string of a tuning nearest to a frequency, and how far from it in cents. `tuning` maps
 * string numbers to MIDI notes, as TUNINGS in musicTheory.mjs does. However far off, the answer is
 * a string, which is what lets a slack string be brought up to its note rather than the one below.
 */
export function nearestString(frequency, tuning, a4 = A4_HZ) {
    const exact = frequencyToMidi(frequency, a4);
    let found = null;
    for (const [string, midi] of Object.entries(tuning)) {
        const cents = (exact - midi) * 100;
        if (!found || Math.abs(cents) < Math.abs(found.cents)) found = { string: Number(string), midi, cents };
    }
    return found;
}

/** "8 cents flat", "1 cent sharp", or "in tune" when within `inTuneCents`. */
export function describeCents(cents, inTuneCents = IN_TUNE_CENTS) {
    const rounded = Math.round(cents);
    if (Math.abs(cents) <= inTuneCents) return 'in tune';
    const size = Math.abs(rounded);
    return `${size} ${size === 1 ? 'cent' : 'cents'} ${rounded < 0 ? 'flat' : 'sharp'}`;
}

/**
 * A reading in words: "E2, 8 cents flat", or with a string, "string 6, E2, in tune".
 * `target` is what nearestNote or nearestString returned.
 */
export function describeReading(target) {
    const where = target.string ? `string ${target.string}, ` : '';
    return `${where}${tunerNoteName(target.midi)}, ${describeCents(target.cents)}`;
}

/** A level in dBFS, from an RMS of samples running from -1 to 1. */
export function rmsToDecibels(rms) {
    return rms > 0 ? 20 * Math.log10(rms) : -Infinity;
}

// --- Smoothing ---------------------------------------------------------------------------------

/**
 * A reading moved by whole octaves to sit by `reference`, when it is within a quarter tone of an
 * octave of it; anything else is returned as it is. As a string dies away the octave above can
 * outlast the fundamental, and the detector then reads an octave high. The cents are the same, so
 * folding keeps the note named from jumping without hiding anything.
 */
export function foldOctave(midi, reference) {
    const octaves = Math.round((midi - reference) / 12);
    if (octaves === 0) return midi;
    const folded = midi - 12 * octaves;
    return Math.abs(folded - reference) < 0.5 ? folded : midi;
}

/**
 * The median of the last few readings, in MIDI numbers so that a fraction is the same size at
 * every pitch. A median rather than an average, so one wild reading at the pluck or as the string
 * dies changes nothing. A reading an octave from the current median is folded down to it first.
 */
export function createPitchSmoother(count) {
    const recent = [];
    let current = null;
    return {
        add(reading) {
            const midi = current === null ? reading : foldOctave(reading, current);
            recent.push(midi);
            if (recent.length > count) recent.shift();
            const sorted = [...recent].sort((x, y) => x - y);
            const middle = sorted.length >> 1;
            current = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
            return current;
        },
        clear() {
            recent.length = 0;
            current = null;
        },
        get size() {
            return recent.length;
        }
    };
}

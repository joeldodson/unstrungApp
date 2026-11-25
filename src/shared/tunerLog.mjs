// The tuner's log, for tuning the tuner on Joel's own guitar: the input as a WAV, a text log of
// the settings, what happened and everything said, and every reading as a CSV. Asked for on
// 2026-11-24; docs/guitar-tuner.md, The log.
//
// Free of the DOM, so the files can be checked in Node. The page gathers the pieces; these turn
// them into bytes and text.

// Five minutes of two channels at 48 kHz in 16 bits is about 58 MB, which is kept in memory until
// saved. Longer than any one tuning session needs.
export const TUNER_LOG_MAX_SECONDS = 300;

/** Samples from -1 to 1 as 16-bit integers, clipped. */
export function floatToInt16(samples) {
    const out = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
        const v = Math.max(-1, Math.min(1, samples[i]));
        out[i] = Math.round(v < 0 ? v * 32768 : v * 32767);
    }
    return out;
}

/**
 * A 16-bit PCM WAV from chunks of channels: `chunks` is a list of arrays of Int16Array, one per
 * channel, all the same length within a chunk. Returns a Uint8Array.
 */
export function encodeWav16(chunks, sampleRate) {
    const channels = chunks[0]?.length ?? 1;
    const frames = chunks.reduce((sum, chunk) => sum + chunk[0].length, 0);
    const dataBytes = frames * channels * 2;
    const bytes = new Uint8Array(44 + dataBytes);
    const view = new DataView(bytes.buffer);
    const text = (at, value) => { for (let i = 0; i < value.length; i++) bytes[at + i] = value.charCodeAt(i); };
    text(0, 'RIFF');
    view.setUint32(4, 36 + dataBytes, true);
    text(8, 'WAVE');
    text(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * channels * 2, true);
    view.setUint16(32, channels * 2, true);
    view.setUint16(34, 16, true);
    text(36, 'data');
    view.setUint32(40, dataBytes, true);
    let at = 44;
    for (const chunk of chunks) {
        for (let frame = 0; frame < chunk[0].length; frame++) {
            for (let channel = 0; channel < channels; channel++) {
                view.setInt16(at, chunk[channel][frame], true);
                at += 2;
            }
        }
    }
    return bytes;
}

/** Seconds as the log writes them: three decimals. */
export function logSeconds(seconds) {
    return seconds.toFixed(3);
}

/**
 * The text log. `header` is { version, begun (a Date), sampleRate, channels }; `events` is
 * [{ seconds, text }] in order. The files are named in the save dialog, after this is written, so
 * it names them only as beside it.
 */
export function tunerLogText({ version, begun, sampleRate, channels }, events) {
    const pad = n => String(n).padStart(2, '0');
    const when = `${begun.getFullYear()}-${pad(begun.getMonth() + 1)}-${pad(begun.getDate())}` +
        ` ${pad(begun.getHours())}:${pad(begun.getMinutes())}:${pad(begun.getSeconds())}`;
    const lines = [
        'unstrung tuner log',
        `Version ${version}. Begun ${when}.`,
        `Audio: the WAV file of the same name, ${sampleRate} Hz, ${channels} channels, 16-bit.`,
        'Times are seconds into the audio. They can be off from it by about a tenth of a second.',
        'Readings: the CSV file of the same name, one line about every 15 milliseconds while listening.',
        ''
    ];
    for (const event of events) lines.push(`${logSeconds(event.seconds)} ${event.text}`);
    return `${lines.join('\n')}\n`;
}

// The CSV's columns, in order. See docs/guitar-tuner.md, The log.
export const TUNER_READING_COLUMNS = [
    'seconds', 'channel', 'level', 'hz', 'clarity', 'note', 'cents', 'pluck'
];

/**
 * The readings as CSV. Each row is { seconds, channel, level, hz, clarity, note, cents, pluck },
 * with hz, clarity, note and cents null when nothing clear was heard.
 */
export function tunerReadingsCsv(rows) {
    const lines = [TUNER_READING_COLUMNS.join(',')];
    const number = (value, digits) => (value === null || value === undefined ? '' : value.toFixed(digits));
    for (const row of rows) {
        lines.push([
            logSeconds(row.seconds),
            row.channel,
            number(row.level, 5),
            number(row.hz, 3),
            number(row.clarity, 3),
            row.note ?? '',
            number(row.cents, 2),
            row.pluck ? 1 : 0
        ].join(','));
    }
    return `${lines.join('\n')}\n`;
}

/** A file name for a log begun at `date`: tuner-2026-11-24-1530. */
export function tunerLogBaseName(date) {
    const pad = n => String(n).padStart(2, '0');
    return `tuner-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
        `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

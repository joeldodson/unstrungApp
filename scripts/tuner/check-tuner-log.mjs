// Checks src/shared/tunerLog.mjs, the files the tuner's log is saved as.
//
// 1. The WAV: 16-bit, two channels interleaved, the length and rate given, read back by the
//    same reader the other tuner checks use, and samples past full scale clipped.
// 2. The text log: its header and one line per event, times to the millisecond.
// 3. The CSV: its columns, and empty cells where nothing clear was heard.
// 4. The suggested file name.
//
//   node scripts/tuner/check-tuner-log.mjs

import {
    floatToInt16, encodeWav16, tunerLogText, tunerReadingsCsv, tunerLogBaseName, TUNER_READING_COLUMNS
} from '../../src/shared/tunerLog.mjs';
import { decodeWav } from './wav.mjs';

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};

console.log('WAV');
{
    const rate = 48000;
    const sine = (n, offset) => Float32Array.from({ length: n }, (_, i) => 0.5 * Math.sin(2 * Math.PI * 110 * (i + offset) / rate));
    // Two chunks of different lengths, the second channel half the first.
    const chunks = [[sine(4096, 0), sine(4096, 0).map(v => v / 2)], [sine(1000, 4096), sine(1000, 4096).map(v => v / 2)]]
        .map(chunk => chunk.map(floatToInt16));
    const bytes = encodeWav16(chunks, rate);
    const buffer = Buffer.from(bytes);
    check('RIFF WAVE with a 44-byte header', buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE'
        && bytes.length === 44 + 5096 * 4, `${bytes.length} bytes`);
    check('two channels, 16-bit, 48 kHz', buffer.readUInt16LE(22) === 2 && buffer.readUInt16LE(34) === 16 && buffer.readUInt32LE(24) === rate);
    const { samples, sampleRate } = decodeWav(buffer);
    const expected = sine(5096, 0);
    const worst = samples.reduce((most, v, i) => Math.max(most, Math.abs(v - expected[i])), 0);
    check('the first channel reads back as written', samples.length === 5096 && sampleRate === rate && worst < 1e-4, `worst ${worst}`);
    check('the second channel is interleaved after it', Math.abs(buffer.readInt16LE(44 + 2 * 2 * 100 + 2) / 32768 - expected[100] / 2) < 1e-4);
    const clipped = floatToInt16(Float32Array.from([1.5, -1.5, 1, -1, 0]));
    check('past full scale is clipped', same([...clipped], [32767, -32768, 32767, -32768, 0]), [...clipped].join(', '));
}

function same(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

console.log('Text log');
{
    const begun = new Date(2026, 10, 24, 15, 30, 5);
    const text = tunerLogText({ version: '0.10.7', begun, sampleRate: 48000, channels: 2 }, [
        { seconds: 0, text: 'Settings: mode Chromatic: the nearest note; volume 5.' },
        { seconds: 1.2345, text: 'Said: E2, 4 cents flat' }
    ]);
    const lines = text.trimEnd().split('\n');
    check('the header names the version and the time begun', lines[0] === 'unstrung tuner log' && lines[1] === 'Version 0.10.7. Begun 2026-11-24 15:30:05.', lines[1]);
    check('it says what the audio is', lines[2] === 'Audio: the WAV file of the same name, 48000 Hz, 2 channels, 16-bit.', lines[2]);
    check('one line per event, times to the millisecond',
        lines.at(-2) === '0.000 Settings: mode Chromatic: the nearest note; volume 5.' && lines.at(-1) === '1.234 Said: E2, 4 cents flat'
        || lines.at(-1) === '1.235 Said: E2, 4 cents flat', lines.slice(-2).join(' / '));
}

console.log('CSV');
{
    const csv = tunerReadingsCsv([
        { seconds: 0.015, channel: 1, level: 0.0123456, hz: 82.12345, clarity: 0.97654, note: 'E2', cents: -4.567, pluck: true },
        { seconds: 0.03, channel: 2, level: 0.0004, hz: null, clarity: null, note: null, cents: null, pluck: false }
    ]);
    const lines = csv.trimEnd().split('\n');
    check('the columns', lines[0] === TUNER_READING_COLUMNS.join(',') && lines[0] === 'seconds,channel,level,hz,clarity,note,cents,pluck', lines[0]);
    check('a reading', lines[1] === '0.015,1,0.01235,82.123,0.977,E2,-4.57,1', lines[1]);
    check('nothing heard leaves its cells empty', lines[2] === '0.030,2,0.00040,,,,,0', lines[2]);
}

console.log('Name');
{
    const name = tunerLogBaseName(new Date(2026, 10, 24, 9, 5, 7));
    check('tuner, the date and the time', name === 'tuner-2026-11-24-090507', name);
}

console.log(failures ? `${failures} FAILED` : 'All passed');
process.exit(failures ? 1 : 0);

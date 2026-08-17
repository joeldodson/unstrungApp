// Checks the bundled samples as the app actually loads them.
//
// Two packs are pooled by pitch: the bass below the guitar's low E, the guitar from there up. The
// thing most worth guarding is the octave. The bass pack's own .sfz maps sit an octave above where
// its recordings sound, because they are written for bass notation, and the guitar pack's do not.
// Getting that wrong would play every bass note an octave high and nothing would throw, so the
// recordings themselves are measured here rather than trusted.
//
// Run: node scripts/progressions/verify-sample-range.mjs

const APP_DIR = `${import.meta.dirname}/../..`.split('\\').join('/');
const { _electron } = await import(`file:///${APP_DIR}/node_modules/playwright-core/index.mjs`);
const { readFile } = await import('node:fs/promises');

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteName = midi => `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;

/** The fundamental of a mono 24-bit WAV, by autocorrelation over its steady portion. */
function fundamentalOf(buffer) {
    // Walk the RIFF chunks rather than assuming a 44-byte header.
    let offset = 12, rate = 0, bits = 0, channels = 1, dataAt = -1, dataSize = 0;
    while (offset + 8 <= buffer.length) {
        const id = buffer.toString('ascii', offset, offset + 4);
        const size = buffer.readUInt32LE(offset + 4);
        if (id === 'fmt ') {
            channels = buffer.readUInt16LE(offset + 10);
            rate = buffer.readUInt32LE(offset + 12);
            bits = buffer.readUInt16LE(offset + 22);
        } else if (id === 'data') {
            dataAt = offset + 8;
            dataSize = size;
            break;
        }
        offset += 8 + size + (size % 2);
    }
    if (dataAt < 0 || bits !== 24) throw new Error(`unexpected WAV: ${bits}-bit, data at ${dataAt}`);

    const step = 3 * channels;
    const frames = Math.min(Math.floor(dataSize / step), Math.floor(rate * 1.2));
    const samples = new Float64Array(frames);
    for (let i = 0; i < frames; i++) {
        const at = dataAt + i * step;
        let v = buffer[at] | (buffer[at + 1] << 8) | (buffer[at + 2] << 16);
        if (v & 0x800000) v -= 0x1000000;
        samples[i] = v / 8388608;
    }

    const from = Math.floor(rate * 0.15);
    const seg = samples.subarray(from, from + Math.floor(rate * 0.6));
    const loLag = Math.floor(rate / 700), hiLag = Math.floor(rate / 20);
    let bestLag = 0, best = 0;
    for (let lag = loLag; lag < Math.min(hiLag, seg.length - 1); lag++) {
        let sum = 0;
        for (let i = 0; i + lag < seg.length; i += 4) sum += seg[i] * seg[i + lag];
        if (sum > best) { best = sum; bestLag = lag; }
    }
    return bestLag ? rate / bestLag : 0;
}

const app = await _electron.launch({ args: ['.'], cwd: APP_DIR });
const page = await app.firstWindow();
await page.waitForLoadState('domcontentloaded');

console.log('=== The pooled range the app reports ===');
const notes = await page.evaluate(() => window.unstrung.getGuitarSampleNotes());
const keys = notes.map(n => n.key).sort((a, b) => a - b);
console.log(`  ${keys.length} notes, ${noteName(keys[0])} (${keys[0]}) to ${noteName(keys.at(-1))} (${keys.at(-1)})`);
check('reaches the low B of a 5-string bass', keys[0] === 23, `lowest is ${noteName(keys[0])}`);
check('still reaches the top of the guitar', keys.at(-1) === 86, `highest is ${noteName(keys.at(-1))}`);
check('every semitone in between is covered',
    keys.every((k, i) => i === 0 || k === keys[i - 1] + 1),
    keys.length === keys.at(-1) - keys[0] + 1 ? 'no gaps' : 'gap found');
check('a 4-string bass low E is there', keys.includes(28));
check('drop tunings are covered down to drop A', keys.includes(33) && keys.includes(35) && keys.includes(38));

console.log('\n=== The audio each key returns actually sounds at that pitch ===');
// Two from the bass, one either side of the seam, one from the guitar.
for (const key of [23, 28, 35, 39, 40, 52]) {
    const bytes = await page.evaluate(async k =>
        [...await window.unstrung.getGuitarSampleAudio(k, 'mf', 3)], key);
    const freq = fundamentalOf(Buffer.from(bytes));
    const measured = 69 + 12 * Math.log2(freq / 440);
    const off = measured - key;
    check(`key ${key} (${noteName(key)}) sounds ${freq.toFixed(2)} Hz`,
        Math.abs(off) < 0.35, `${off >= 0 ? '+' : ''}${off.toFixed(2)} semitones from ${noteName(key)}`);
}

console.log('\n=== Every velocity is present across the seam ===');
for (const key of [28, 39, 40]) {
    for (const velocity of ['p', 'mf', 'f']) {
        const ok = await page.evaluate(async ({ k, v }) => {
            try {
                const audio = await window.unstrung.getGuitarSampleAudio(k, v, 1);
                return audio.length > 1000;
            } catch { return false; }
        }, { k: key, v: velocity });
        check(`key ${key} has a "${velocity}" sample`, ok);
    }
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
await app.close();
process.exit(failures === 0 ? 0 : 1);

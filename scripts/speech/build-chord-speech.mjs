// Renders every chord name to audio, into src/assets/speech, to be committed.
//
// These are committed rather than built during a release, deliberately. What gets tested is then
// exactly what ships, and `npm run dist` does not depend on which voices happen to be installed on
// the machine doing the packaging. They are assets like the guitar samples: generated once,
// reviewed, and thereafter just files.
//
// Having them at all is what removes PowerShell from the installed app -- the reason spoken chord
// names could not work inside an app store sandbox, and could not work on macOS or Linux at all.
//
// The vocabulary is finite: twelve roots by the suffixes the chord identifier knows.
//
// Volume is NOT baked in. Playback runs each phrase through a gain node, so the volume control
// stays dynamic; only the voice and the speaking rate are fixed here.
//
//   node scripts/speech/build-chord-speech.mjs            write the assets
//   node scripts/speech/build-chord-speech.mjs --measure  report sizes, write nothing

import { execFile } from 'node:child_process';
import { readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { IDENTIFY_SUFFIXES, PITCH_CLASS_NAMES } from '../../src/shared/musicTheory.mjs';
import { spokenChordName, trimSilence } from '../../src/shared/spokenPhrases.mjs';

const execFileAsync = promisify(execFile);
const HERE = `${import.meta.dirname}`.replace(/\\/g, '/');
const SCRIPT = `${HERE}/render-phrases.ps1`;
const ASSETS = `${HERE}/../../src/assets/speech`;

// Speech carries almost nothing above 5 kHz. Half the bytes of the 22050 default, and no audible
// difference on a chord name.
const SAMPLE_RATE = 11025;
const RATE = 4;

// System.Speech only sees the SAPI5 "Desktop" voices. Mark exists on this machine as a OneCore
// voice, which a different API would be needed to reach.
const VOICES = [
    { id: 'david', name: 'Microsoft David Desktop', label: 'David, SAPI5', engine: 'sapi' },
    { id: 'zira', name: 'Microsoft Zira Desktop', label: 'Zira, SAPI5', engine: 'sapi' },
    // OneCore: newer recordings, and the only place Mark exists. Rendered at 16 kHz whatever we
    // ask, so these are resampled down to match the SAPI ones.
    { id: 'david-onecore', name: 'Microsoft David', label: 'David, OneCore', engine: 'onecore' },
    { id: 'zira-onecore', name: 'Microsoft Zira', label: 'Zira, OneCore', engine: 'onecore' },
    { id: 'mark-onecore', name: 'Microsoft Mark', label: 'Mark, OneCore', engine: 'onecore' },
    // The same OneCore voices one step slower, to be compared against the ones above. A slower
    // voice takes longer to say the same thing, so these are proportionally larger -- and they
    // eat into the tempo ceiling, since an announcement still has to finish before its beat.
    { id: 'david-onecore-slow', name: 'Microsoft David', label: 'David, OneCore, slower',
        engine: 'onecore', rate: 3 },
    { id: 'zira-onecore-slow', name: 'Microsoft Zira', label: 'Zira, OneCore, slower',
        engine: 'onecore', rate: 3 },
    { id: 'mark-onecore-slow', name: 'Microsoft Mark', label: 'Mark, OneCore, slower',
        engine: 'onecore', rate: 3 }
];

const ONECORE_SCRIPT = `${HERE}/render-phrases-onecore.ps1`;

/**
 * Linear resampling, which is plenty for speech at these rates.
 *
 * WinRT picks its own output format and gives 16 kHz regardless of what is asked for, so OneCore
 * voices have to be brought down to match rather than simply requested at the right rate.
 */
function resample(samples, fromRate, toRate) {
    if (fromRate === toRate) return samples;
    const ratio = fromRate / toRate;
    const out = new Int16Array(Math.floor(samples.length / ratio));
    for (let i = 0; i < out.length; i++) {
        const at = i * ratio;
        const low = Math.floor(at);
        const high = Math.min(samples.length - 1, low + 1);
        const t = at - low;
        out[i] = Math.round(samples[low] * (1 - t) + samples[high] * t);
    }
    return out;
}

const measureOnly = process.argv.includes('--measure');

/** Every chord name the app can speak, once each. */
export function chordSpeechVocabulary() {
    const phrases = new Set();
    for (const root of PITCH_CLASS_NAMES) {
        for (const suffix of IDENTIFY_SUFFIXES) phrases.add(spokenChordName(root, suffix));
    }
    return [...phrases].sort();
}

function readWav(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 12, format = null, dataStart = null, dataLength = 0;
    while (offset + 8 <= bytes.length) {
        const id = String.fromCharCode(...bytes.slice(offset, offset + 4));
        const size = view.getUint32(offset + 4, true);
        if (id === 'fmt ') {
            format = {
                channels: view.getUint16(offset + 10, true),
                sampleRate: view.getUint32(offset + 12, true),
                bits: view.getUint16(offset + 22, true)
            };
        } else if (id === 'data') { dataStart = offset + 8; dataLength = size; }
        offset += 8 + size + (size % 2);
    }
    const count = Math.floor(dataLength / 2 / format.channels);
    const samples = new Int16Array(count);
    const floats = new Float32Array(count);
    for (let i = 0; i < count; i++) {
        samples[i] = view.getInt16(dataStart + i * 2 * format.channels, true);
        floats[i] = samples[i] / 32768;
    }
    return { ...format, samples, floats };
}

/** A 16-bit mono WAV around a run of samples. */
function writeWav(samples, sampleRate) {
    const out = new Uint8Array(44 + samples.length * 2);
    const view = new DataView(out.buffer);
    const ascii = (offset, text) => {
        for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
    };
    ascii(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    ascii(8, 'WAVEfmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);           // PCM
    view.setUint16(22, 1, true);           // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    ascii(36, 'data');
    view.setUint32(40, samples.length * 2, true);
    for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, samples[i], true);
    return out;
}

const phrases = chordSpeechVocabulary();
console.log(`${phrases.length} distinct chord names, ${SAMPLE_RATE} Hz, rate ${RATE}`);
console.log(measureOnly ? 'measuring only, nothing will be written\n' : `writing into ${ASSETS}\n`);

const totals = [];
for (const voice of VOICES) {
    const workDir = `${tmpdir()}/unstrung-speech-${voice.id}-${Date.now()}`;
    await mkdir(workDir, { recursive: true });
    await writeFile(`${workDir}/phrases.json`, JSON.stringify(phrases), 'utf8');

    const startedAt = Date.now();
    const args = voice.engine === 'onecore'
        ? ['-File', ONECORE_SCRIPT, '-OutDir', workDir, '-PhrasesJson', `${workDir}/phrases.json`,
            '-Rate', String(voice.rate ?? RATE), '-Voice', voice.name]
        : ['-File', SCRIPT, '-OutDir', workDir, '-PhrasesJson', `${workDir}/phrases.json`,
            '-Rate', String(voice.rate ?? RATE), '-Voice', voice.name, '-SampleRate', String(SAMPLE_RATE)];
    await execFileAsync('powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', ...args],
        { maxBuffer: 16 * 1024 * 1024 });

    const outDir = `${ASSETS}/${voice.id}`;
    if (!measureOnly) {
        await rm(outDir, { recursive: true, force: true }).catch(() => {});
        await mkdir(outDir, { recursive: true });
    }

    // The manifest maps a phrase to its file, so nothing has to guess a name from the text.
    const manifest = { voice: voice.id, name: voice.name, label: voice.label,
        sampleRate: null, rate: voice.rate ?? RATE, phrases: {} };
    let raw = 0, kept = 0;

    const files = (await readdir(workDir)).filter(name => name.endsWith('.wav'))
        .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));

    for (const [index, name] of files.entries()) {
        const bytes = new Uint8Array(await readFile(`${workDir}/${name}`));
        raw += bytes.length;
        const wav = readWav(bytes);
        manifest.sampleRate = wav.sampleRate;
        const { startSeconds, speechSeconds } = trimSilence(wav.floats, wav.sampleRate);
        const from = Math.floor(startSeconds * wav.sampleRate);
        const to = Math.min(wav.samples.length, from + Math.ceil(speechSeconds * wav.sampleRate));
        // Kept at whatever rate the engine produced. Downsampling here was a mistake: linear
        // interpolation with no lowpass folds everything above the new Nyquist back into the
        // audible band, which is heard as harshness. decodeAudioData resamples to the output
        // rate at playback and does it properly, so there is nothing to gain by doing it badly
        // first. System.Speech is asked for 11025 and gives it; WinRT gives 16000 regardless.
        const trimmed = writeWav(wav.samples.subarray(from, to), wav.sampleRate);
        kept += trimmed.length;

        const fileName = `${index}.wav`;
        manifest.phrases[phrases[index]] = fileName;
        if (!measureOnly) await writeFile(`${outDir}/${fileName}`, trimmed);
    }

    if (!measureOnly) {
        await writeFile(`${outDir}/manifest.json`, JSON.stringify(manifest, null, 2), 'utf8');
    }
    await rm(workDir, { recursive: true, force: true }).catch(() => {});

    totals.push({ voice, raw, kept, seconds: (Date.now() - startedAt) / 1000 });
    const mb = bytes => `${(bytes / 1048576).toFixed(1)} MB`;
    console.log(`${voice.label.padEnd(16)} ${mb(kept).padStart(8)}   ` +
        `(${mb(raw)} before trimming, ${Math.round(kept / files.length)} bytes each, ` +
        `${totals[totals.length - 1].seconds.toFixed(1)} s to render)`);
}

const grand = totals.reduce((sum, t) => sum + t.kept, 0);
console.log(`\nall voices ${(grand / 1048576).toFixed(1)} MB`);

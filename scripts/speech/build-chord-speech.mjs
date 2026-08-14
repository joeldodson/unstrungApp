// Renders every chord name the app can produce, so spoken chord names need no platform code at
// run time.
//
// The vocabulary is finite and small: twelve roots by the suffixes the chord identifier knows.
// Rendering them once here and shipping the audio removes PowerShell from the installed app
// entirely, which is what makes the feature work inside an app store sandbox -- and on macOS and
// Linux, where the runtime path does not exist at all.
//
// Volume is not baked in. Playback runs each phrase through a gain node, so the volume control
// stays fully dynamic; only the voice and the rate are fixed at build time.
//
// Run with --measure to report sizes without writing anything into the tree.

import { execFile } from 'node:child_process';
import { readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { IDENTIFY_SUFFIXES, PITCH_CLASS_NAMES } from '../../src/shared/musicTheory.mjs';
import { spokenChordName, trimSilence } from '../../src/shared/spokenPhrases.mjs';

const execFileAsync = promisify(execFile);
const HERE = `${import.meta.dirname}`.replace(/\\/g, '/');
const SCRIPT = `${HERE}/render-phrases.ps1`;

const VOICE = process.env.UNSTRUNG_VOICE ?? 'Microsoft Zira Desktop';
const RATE = Number(process.env.UNSTRUNG_RATE ?? 4);

/** Every chord name the app can speak, once each. */
export function chordSpeechVocabulary() {
    const phrases = new Set();
    for (const root of PITCH_CLASS_NAMES) {
        for (const suffix of IDENTIFY_SUFFIXES) phrases.add(spokenChordName(root, suffix));
    }
    return [...phrases].sort();
}

/** Minimal PCM WAV reader, enough for what System.Speech writes. */
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
    const samples = new Float32Array(count);
    for (let i = 0; i < count; i++) {
        samples[i] = view.getInt16(dataStart + i * 2 * format.channels, true) / 32768;
    }
    return { ...format, samples, seconds: count / format.sampleRate, bytes: bytes.length };
}

const phrases = chordSpeechVocabulary();
console.log(`voice ${VOICE}, rate ${RATE}`);
console.log(`${phrases.length} distinct chord names\n`);

const workDir = `${tmpdir()}/unstrung-chord-speech-${Date.now()}`;
await mkdir(workDir, { recursive: true });
const phrasesPath = `${workDir}/phrases.json`;
await writeFile(phrasesPath, JSON.stringify(phrases), 'utf8');

const startedAt = Date.now();
await execFileAsync('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT,
    '-OutDir', workDir, '-PhrasesJson', phrasesPath, '-Rate', String(RATE), '-Voice', VOICE
], { maxBuffer: 16 * 1024 * 1024 });
console.log(`rendered in ${((Date.now() - startedAt) / 1000).toFixed(1)} s\n`);

let rawBytes = 0, trimmedBytes = 0, totalSpeech = 0, longest = { seconds: 0, text: '' };
const files = (await readdir(workDir)).filter(name => name.endsWith('.wav'));
for (const [index, name] of files.entries()) {
    const wav = readWav(new Uint8Array(await readFile(`${workDir}/${name}`)));
    const { speechSeconds } = trimSilence(wav.samples, wav.sampleRate);
    rawBytes += wav.bytes;
    // 16-bit mono: two bytes a sample, plus a 44 byte header.
    trimmedBytes += Math.round(speechSeconds * wav.sampleRate) * 2 + 44;
    totalSpeech += speechSeconds;
    if (speechSeconds > longest.seconds) longest = { seconds: speechSeconds, text: phrases[index] };
}

const mb = bytes => `${(bytes / 1048576).toFixed(1)} MB`;
console.log(`as rendered          ${mb(rawBytes)}   (${Math.round(rawBytes / files.length)} bytes each)`);
console.log(`with silence trimmed ${mb(trimmedBytes)}   (${Math.round(trimmedBytes / files.length)} bytes each)`);
console.log(`saving               ${mb(rawBytes - trimmedBytes)}, ` +
    `${Math.round((1 - trimmedBytes / rawBytes) * 100)}%`);
console.log(`\ntotal speech ${totalSpeech.toFixed(1)} s, average ${(totalSpeech / files.length * 1000).toFixed(0)} ms`);
console.log(`longest "${longest.text}" at ${(longest.seconds * 1000).toFixed(0)} ms`);

await rm(workDir, { recursive: true, force: true }).catch(() => {});

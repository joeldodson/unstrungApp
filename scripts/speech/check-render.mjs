// Checks that spoken chord names can be rendered to audio and measured.
//
// Deliberately does not involve Electron or any UI: it drives the PowerShell script directly,
// parses the WAVs itself, and asserts on durations. That keeps the platform specific piece
// verifiable on its own, whatever ends up using it.

import { execFile } from 'node:child_process';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import {
    trimSilence, foldedSemitones, shiftedSpeechSeconds, spokenRootName, spokenChordName
} from '../../src/shared/spokenPhrases.mjs';

const execFileAsync = promisify(execFile);
const SCRIPT = `${import.meta.dirname}/render-phrases.ps1`;

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};

/** Minimal PCM WAV reader: enough for what System.Speech writes, and nothing more. */
function readWav(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (String.fromCharCode(...bytes.slice(0, 4)) !== 'RIFF') throw new Error('not a RIFF file');
    if (String.fromCharCode(...bytes.slice(8, 12)) !== 'WAVE') throw new Error('not a WAVE file');

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
        } else if (id === 'data') {
            dataStart = offset + 8;
            dataLength = size;
        }
        offset += 8 + size + (size % 2); // chunks are word aligned
    }
    if (!format || dataStart === null) throw new Error('missing fmt or data chunk');
    if (format.bits !== 16) throw new Error(`expected 16-bit samples, got ${format.bits}`);

    const count = Math.floor(dataLength / 2 / format.channels);
    const samples = new Float32Array(count);
    for (let i = 0; i < count; i++) {
        // First channel only; System.Speech writes mono anyway.
        samples[i] = view.getInt16(dataStart + i * 2 * format.channels, true) / 32768;
    }
    return { ...format, samples, seconds: count / format.sampleRate };
}

async function render(phrases, rate) {
    const workDir = `${tmpdir()}/unstrung-speech-check-${Date.now()}`;
    await mkdir(workDir, { recursive: true });
    const phrasesPath = `${workDir}/phrases.json`;
    try {
        await writeFile(phrasesPath, JSON.stringify(phrases), 'utf8');
        const startedAt = performance.now();
        const { stdout } = await execFileAsync('powershell.exe', [
            '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT,
            '-OutDir', workDir, '-PhrasesJson', phrasesPath, '-Rate', String(rate)
        ], { maxBuffer: 4 * 1024 * 1024 });
        const elapsedMs = performance.now() - startedAt;

        const out = [];
        for (const line of stdout.split(/\r?\n/)) {
            const [, fileName, text] = line.split('\t');
            if (!fileName) continue;
            out.push({ text, wav: readWav(new Uint8Array(await readFile(`${workDir}/${fileName}`))) });
        }
        return { rendered: out, elapsedMs };
    } finally {
        await rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
}

if (process.platform !== 'win32') {
    console.log('Rendering speech is Windows only for now; nothing to check here.');
    process.exit(0);
}

console.log('=== Voices ===');
const { stdout: voiceList } = await execFileAsync('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT, '-ListVoices'
]);
const voices = voiceList.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
for (const voice of voices) console.log(`      ${voice}`);
check('at least one voice is installed', voices.length > 0);

console.log('\n=== Rendering chord names ===');
const CHORDS = ['C', 'G', 'A minor', 'F', 'D minor', 'E minor', 'B flat', 'F sharp minor 7',
    'G 7', 'C major 7', 'D sus 4', 'A 7'];
const RATE = 5;
const { rendered, elapsedMs } = await render(CHORDS, RATE);

check('every phrase came back', rendered.length === CHORDS.length,
    `${rendered.length} of ${CHORDS.length}`);
check('the batch renders quickly', elapsedMs < 5000, `${elapsedMs.toFixed(0)} ms for ${CHORDS.length}`);
console.log(`  batch of ${CHORDS.length} rendered in ${elapsedMs.toFixed(0)} ms ` +
    `(${(elapsedMs / CHORDS.length).toFixed(0)} ms each)`);

console.log('\n=== Trimming the silence off each phrase ===');
let anyTrimmed = false;
for (const { text, wav } of rendered) {
    const { startSeconds, speechSeconds } = trimSilence(wav.samples, wav.sampleRate);
    const deadMs = (wav.seconds - speechSeconds - startSeconds) * 1000;
    if (deadMs > 50) anyTrimmed = true;
    console.log(`  "${text}"`.padEnd(24) +
        `file ${(wav.seconds * 1000).toFixed(0).padStart(5)} ms   ` +
        `speech ${(speechSeconds * 1000).toFixed(0).padStart(5)} ms   ` +
        `trailing silence ${deadMs.toFixed(0).padStart(4)} ms`);
    if (speechSeconds <= 0 || speechSeconds > wav.seconds) {
        check(`"${text}" trims to a sane length`, false, `${speechSeconds}s of ${wav.seconds}s`);
    }
}
check('all phrases are 16-bit mono', rendered.every(r => r.wav.bits === 16 && r.wav.channels === 1));
check('trimming actually removes silence', anyTrimmed);

console.log('\n=== Pitch fold ===');
for (const [name, midi] of [['C', 48], ['D', 50], ['E', 52], ['F', 53], ['F#', 54], ['G', 55], ['A', 57], ['B', 59]]) {
    const semitones = foldedSemitones(midi);
    const base = trimSilence(rendered[0].wav.samples, rendered[0].wav.sampleRate).speechSeconds;
    console.log(`      ${name.padEnd(3)} ${String(semitones).padStart(3)} semitones   ` +
        `"C" would run ${(shiftedSpeechSeconds(base, semitones) * 1000).toFixed(0)} ms ` +
        `instead of ${(base * 1000).toFixed(0)} ms`);
}
check('C is unshifted', foldedSemitones(48) === 0);
check('nothing shifts more than six semitones',
    [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59].every(m => Math.abs(foldedSemitones(m)) <= 6));
check('downward shifts lengthen, upward shorten',
    shiftedSpeechSeconds(1, foldedSemitones(55)) > 1 && shiftedSpeechSeconds(1, foldedSemitones(53)) < 1);

console.log('\n=== Chord names are spelled for speech ===');
for (const [root, suffix] of [['C', 'major'], ['F#', 'm7'], ['Bb', 'maj7'], ['A', 'minor'],
    ['C', 'm7b5'], ['G', '7'], ['D', 'sus4'], ['E', '5']]) {
    console.log(`      ${(root + (suffix === 'major' ? '' : suffix)).padEnd(8)} -> ` +
        `"${spokenChordName(root, suffix)}"`);
}
check('sharps are spelled out', spokenRootName('C#') === 'C sharp');
check('flats are spelled out', spokenRootName('Bb') === 'B flat');
check('a plain major says only its root', spokenChordName('C', 'major') === 'C');
check('a suffix is spoken rather than spelled', spokenChordName('F#', 'm7') === 'F sharp minor 7');
check('a flat inside a suffix survives the root rule',
    spokenChordName('C', 'm7b5') === 'C minor 7 flat 5');
check('the chord library\'s verbose labels are not used',
    spokenChordName('E', '5') === 'E power chord');

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);

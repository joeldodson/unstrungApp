// Encodes the guitar samples and the spoken chord names as Opus, for the web version.
//
//   npm run build:web-audio
//
// Writes dist-web/audio, which is generated and not committed:
//   samples/...            every recording the sample maps use, as .opus, in the same folders as
//                          under src/assets/samples
//   sample-map.json        which file plays for each MIDI key and velocity tier, in round-robin
//                          order, read from the .sfz maps by src/shared/sampleMap.mjs, the same
//                          code the desktop app uses
//   speech/<voice>/...     every spoken chord name, as .opus, and each voice's manifest.json with
//                          its file names changed to .opus
//
// Why Opus: the WAVs are 415 MB, far too much to send to a browser. Opus is decoded by Chrome's
// decodeAudioData, so playback code is unchanged; it switches to short frames on transients, which
// keeps the pick attack. 96 kbps mono for the instruments, 32 kbps for speech.
//
// Only a file whose WAV is newer than its Opus copy is encoded again, so a second run is quick.
// The encoder is ffmpeg, from the ffmpeg-static package: a build tool only, never shipped.

import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import ffmpegPath from 'ffmpeg-static';
import { parseSfzRegions, buildSampleMap } from '../src/shared/sampleMap.mjs';

const run = promisify(execFile);
const root = path.join(import.meta.dirname, '..');
const assetsRoot = path.join(root, 'src', 'assets');
const outRoot = path.join(root, 'dist-web', 'audio');

const SAMPLE_BITRATE = '96k';
const SPEECH_BITRATE = '32k';

// The same two packs, in the same order, as SAMPLE_SOURCES in src/main/main.js.
const SAMPLE_MAPS = [
    { programsDir: 'samples/green-gretsch/Programs', map: 'modules/maps_green/ord.sfz' },
    { programsDir: 'samples/black-and-blue-bass/Programs', map: 'modules/maps_black/reg.sfz' }
];

/** A path under src/assets, written with forward slashes, as it is in the JSON and on the web. */
const assetPath = absolute => path.relative(assetsRoot, absolute).split(path.sep).join('/');
const opusName = relative => relative.replace(/\.wav$/i, '.opus');

async function isUpToDate(source, target) {
    try {
        const [s, t] = await Promise.all([fs.stat(source), fs.stat(target)]);
        return t.mtimeMs >= s.mtimeMs;
    } catch {
        return false;
    }
}

async function encode({ source, target, bitrate }) {
    if (await isUpToDate(source, target)) return 'skipped';
    await fs.mkdir(path.dirname(target), { recursive: true });
    await run(ffmpegPath, [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-i', source,
        '-ac', '1',
        '-c:a', 'libopus', '-b:a', bitrate, '-vbr', 'on', '-application', 'audio',
        // No metadata: the files are named by the map, and it would only add bytes.
        '-map_metadata', '-1',
        target
    ]);
    return 'encoded';
}

/** Runs the jobs a few at a time, one per processor. */
async function encodeAll(jobs) {
    const counts = { encoded: 0, skipped: 0 };
    let next = 0;
    const worker = async () => {
        while (next < jobs.length) {
            const job = jobs[next++];
            counts[await encode(job)]++;
        }
    };
    await Promise.all(Array.from({ length: Math.max(1, os.cpus().length) }, worker));
    return counts;
}

// --- Samples -------------------------------------------------------------------------------

const sources = [];
for (const { programsDir, map } of SAMPLE_MAPS) {
    const base = path.join(assetsRoot, programsDir);
    sources.push({ regions: parseSfzRegions(await fs.readFile(path.join(base, map), 'utf8')), base });
}
const byKey = buildSampleMap(sources);

const sampleMap = { format: 1, velocities: ['p', 'mf', 'f'], notes: {} };
const sampleFiles = new Set();
for (const key of [...byKey.keys()].sort((a, b) => a - b)) {
    const entry = {};
    for (const [velocity, regions] of Object.entries(byKey.get(key))) {
        entry[velocity] = regions.map(region => {
            const wav = path.resolve(region.base, region.sample.replace(/\\/g, '/'));
            sampleFiles.add(wav);
            return opusName(assetPath(wav));
        });
    }
    sampleMap.notes[key] = entry;
}

const sampleJobs = [...sampleFiles].map(source => ({
    source, target: path.join(outRoot, opusName(assetPath(source))), bitrate: SAMPLE_BITRATE
}));

// --- Speech --------------------------------------------------------------------------------

const speechRoot = path.join(assetsRoot, 'speech');
const speechJobs = [];
const manifests = [];
for (const voice of await fs.readdir(speechRoot)) {
    let manifest;
    try {
        manifest = JSON.parse(await fs.readFile(path.join(speechRoot, voice, 'manifest.json'), 'utf8'));
    } catch {
        continue; // not a voice directory
    }
    const phrases = {};
    for (const [text, file] of Object.entries(manifest.phrases)) {
        phrases[text] = opusName(file);
        speechJobs.push({
            source: path.join(speechRoot, voice, file),
            target: path.join(outRoot, 'speech', voice, opusName(file)),
            bitrate: SPEECH_BITRATE
        });
    }
    manifests.push({ voice, manifest: { ...manifest, phrases } });
}

// --- Write ---------------------------------------------------------------------------------

const started = Date.now();
const sampleCounts = await encodeAll(sampleJobs);
const speechCounts = await encodeAll(speechJobs);

await fs.mkdir(outRoot, { recursive: true });
await fs.writeFile(path.join(outRoot, 'sample-map.json'), JSON.stringify(sampleMap));
for (const { voice, manifest } of manifests) {
    await fs.writeFile(path.join(outRoot, 'speech', voice, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

async function totalBytes(files) {
    let sum = 0;
    for (const file of files) sum += (await fs.stat(file)).size;
    return sum;
}
const mb = bytes => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

console.log('=== web audio build ===');
console.log(`samples: ${sampleJobs.length} files (${sampleCounts.encoded} encoded, ${sampleCounts.skipped} up to date), ` +
    `${mb(await totalBytes(sampleJobs.map(j => j.source)))} WAV -> ${mb(await totalBytes(sampleJobs.map(j => j.target)))} Opus`);
console.log(`speech:  ${speechJobs.length} files (${speechCounts.encoded} encoded, ${speechCounts.skipped} up to date), ` +
    `${mb(await totalBytes(speechJobs.map(j => j.source)))} WAV -> ${mb(await totalBytes(speechJobs.map(j => j.target)))} Opus`);
console.log(`keys:    ${Object.keys(sampleMap.notes).length}, voices: ${manifests.map(m => m.voice).join(', ')}`);
console.log(`output:  ${path.relative(root, outRoot)}, in ${((Date.now() - started) / 1000).toFixed(0)} s`);

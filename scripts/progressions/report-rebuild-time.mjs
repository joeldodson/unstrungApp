// How long a progression's Score takes to rebuild when its pattern or swing is changed while it
// plays (docs/one-player.md, decision 6). On the audio track player the change writes the
// progression as alphaTex again, has alphaTab read it, and builds the track's notes and ring
// lengths, which is what rebuildProgressionScore in the renderer does; chord practice's own player
// only worked out one measure's strokes again. A report, not a check: it prints the times.
//
// 256 measures, the most the Chord Practice dialog generates, with two chords in every other
// measure, at the Old Faithful and All Down-Up patterns, each timed five times after a first run.
//
//   node scripts/progressions/report-rebuild-time.mjs

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildAudioTrack, resolveRingLengths } from '../../src/shared/audioTrack.mjs';
import { songFromProgression, songToAlphaTex, progressionQuarterTempo } from '../../src/shared/songScore.mjs';
import { patternsFor } from '../../src/shared/strummingPatterns.mjs';

const root = path.join(import.meta.dirname, '..', '..');
const alphaTab = await import(pathToFileURL(path.join(root, 'node_modules', '@coderline', 'alphatab', 'dist', 'alphaTab.mjs')).href);
const library = JSON.parse(fs.readFileSync(path.join(root, 'src', 'assets', 'chords', 'chord-library.json'), 'utf8'));

const names = ['G', 'C', 'D', 'E', 'A', 'F'];
const chords = Array.from({ length: 256 }, (_, i) => ({
    root: names[i % names.length], suffix: i % 3 === 0 ? 'minor' : 'major',
    ...(i % 2 ? { laterChords: [{ root: names[(i + 2) % names.length], suffix: 'major', beat: 3 }] } : {})
}));
const progression = { key: 'G', mode: 'major', beatsPerBar: 4, beatUnit: 4, chords };

function rebuild(pattern, swing) {
    const song = songFromProgression(progression, { library, tempo: 90, pattern, swing });
    const importer = new alphaTab.importer.AlphaTexImporter();
    importer.initFromString(songToAlphaTex(song).text, new alphaTab.Settings());
    const track = buildAudioTrack(importer.readScore(), 0, { targetTempo: progressionQuarterTempo(90, 4) });
    resolveRingLengths(track.notes, track.stops);
    return track;
}

for (const name of ['Old Faithful', 'All Down-Up']) {
    const pattern = patternsFor(4, 4).find(p => p.name === name);
    for (const swing of [false, true]) {
        rebuild(pattern, swing);
        const times = [];
        let notes = 0;
        for (let i = 0; i < 5; i++) {
            const started = performance.now();
            notes = rebuild(pattern, swing).notes.length;
            times.push(performance.now() - started);
        }
        times.sort((a, b) => a - b);
        console.log(`${name}${swing ? ', swung' : ''}: ${notes} notes, median ${times[2].toFixed(0)} ms, slowest ${times[4].toFixed(0)} ms`);
    }
}

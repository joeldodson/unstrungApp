// Does a strum now sweep from the lowest-pitched string, regardless of file format?
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as alphaTab from '@coderline/alphatab';
import { buildAudioTrack } from '../../src/shared/audioTrack.mjs';

for (const file of ['Ripple Chord Solo.gp5', 'Ripple Chord Solo.gpx', 'Grateful Dead-Ripple-12-20-2025.gp']) {
    const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(
        new Uint8Array(fs.readFileSync(path.join('musicfiles', file))));
    const track = buildAudioTrack(score, 0);

    // Group notes that start within one strum's spread of each other.
    const byBeat = new Map();
    for (const note of track.notes) {
        if (!note.strumSize || note.strumSize < 2 || note.string == null) continue;
        const key = Math.round((note.startSeconds - note.indexInBeat * 0.020) * 1000);
        if (!byBeat.has(key)) byBeat.set(key, []);
        byBeat.get(key).push(note);
    }

    let lowFirst = 0, highFirst = 0, other = 0;
    for (const group of byBeat.values()) {
        if (group.length < 2) continue;
        const ordered = [...group].sort((a, b) => a.startSeconds - b.startSeconds);
        const strings = ordered.map(n => n.string);           // tab numbering, 6 = low E
        if (strings.every((s, i) => i === 0 || s < strings[i - 1])) lowFirst++;
        else if (strings.every((s, i) => i === 0 || s > strings[i - 1])) highFirst++;
        else other++;
    }
    console.log(`${file}\n  strums sweeping low-pitch first (downstroke): ${lowFirst}` +
        `\n  high-pitch first (upstroke): ${highFirst}\n  neither: ${other}`);
}

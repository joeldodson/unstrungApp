// What Unstrung currently reads out, for the beats in question.
// Run: node scripts/gp-experiment/what-unstrung-says.mjs
import * as fs from 'node:fs';
import * as alphaTab from '@coderline/alphatab';
import { extractScoreMetadata } from '../../src/shared/scoreMetadata.mjs';

function show(file, trackName, bars) {
    const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(
        new Uint8Array(fs.readFileSync(file)));
    const meta = extractScoreMetadata(score, { terseBeats: true });
    const track = meta.tracks.find(t => t.name === trackName);
    console.log(`\n=== ${file} / ${trackName}`);
    for (const barNumber of bars) {
        console.log(`  bar ${barNumber}:`);
        for (const beat of track.measures[barNumber - 1].beats) console.log(`    ${beat}`);
    }
}

show('musicfiles/Grateful Dead-Ripple-12-20-2025.gp', 'Acoustic Capo VII', [2, 3, 4]);
show('musicfiles/Ripple Chord Solo.gp5', 'Acoustic Guitar', [4, 18, 20]);
show('musicfiles/Ripple Chord Solo.gpx', 'Acoustic Guitar', [4, 18, 20]);

// What lands in a measure heading versus what lands inside a beat description.
// Run: node scripts/gp-experiment/heading-vs-beat.mjs "musicfiles/<file>.gp" "<track>"
import * as fs from 'node:fs';
import * as alphaTab from '@coderline/alphatab';
import { extractScoreMetadata } from '../../src/shared/scoreMetadata.mjs';

const file = process.argv[2];
const wanted = process.argv[3];
const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(
    new Uint8Array(fs.readFileSync(file)));
const meta = extractScoreMetadata(score, { terseBeats: true });

for (const track of meta.tracks) {
    if (wanted && track.name !== wanted) continue;
    console.log(`\n=== ${track.name}`);
    track.measures.forEach((m, i) => {
        const heading = [];
        if (m.section) heading.push(`section=${JSON.stringify(m.section)}`);
        if (m.repeat) heading.push(`repeat=${JSON.stringify(m.repeat)}`);
        if (m.chordSymbols) heading.push(`chords=${JSON.stringify(m.chordSymbols)}`);
        if (m.lyrics && m.lyrics.length) heading.push(`lyrics=${JSON.stringify(m.lyrics.join(' '))}`);
        const texts = m.beats.map((b, bi) => [bi + 1, b]).filter(([, b]) => b.includes('text "'));
        if (heading.length === 0 && texts.length === 0) return;
        console.log(`  bar ${i + 1}`);
        if (heading.length) console.log(`    heading: ${heading.join(' | ')}`);
        for (const [bi, b] of texts) console.log(`    beat ${bi}: ${b}`);
    });
}

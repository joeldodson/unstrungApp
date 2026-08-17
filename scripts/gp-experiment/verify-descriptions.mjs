// Sanity pass over every beat of every file, terse and full.
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as alphaTab from '@coderline/alphatab';
import { extractScoreMetadata } from '../../src/shared/scoreMetadata.mjs';

const dir = 'musicfiles';
let total = 0;
const withStroke = [];
for (const file of fs.readdirSync(dir).filter(f => /\.(gp|gp5|gpx)$/i.test(f)).sort()) {
    const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(
        new Uint8Array(fs.readFileSync(path.join(dir, file))));
    for (const terseBeats of [false, true]) {
        const meta = extractScoreMetadata(score, { terseBeats });
        for (const track of meta.tracks)
            for (const [i, measure] of track.measures.entries())
                for (const beat of measure.beats) {
                    total++;
                    if (typeof beat !== 'string' || beat.includes('undefined') || beat.includes('NaN'))
                        throw new Error(`bad beat text in ${file}: ${beat}`);
                    if (/stroke|arpeggi/.test(beat))
                        withStroke.push(`${file} ${terseBeats ? 'terse' : 'full '} ${track.name} bar ${i + 1}: ${beat}`);
                }
    }
}
console.log(`${total} beat descriptions produced, no undefined/NaN`);
console.log(`\nbeats that report a stroke direction (${withStroke.length / 2} distinct, each listed full + terse):`);
for (const line of withStroke) console.log('  ' + line);

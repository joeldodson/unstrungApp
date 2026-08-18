// Every beat text in a corpus, with the verdict the promotion rule reaches on it.
// Run: node scripts/gp-experiment/check-section-promotion.mjs <dir>
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as alphaTab from '@coderline/alphatab';
import { extractScoreMetadata } from '../../src/shared/scoreMetadata.mjs';

function* files(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) yield* files(full);
        else if (/\.gp\d?x?$/i.test(entry.name)) yield full;
    }
}

let promotedTotal = 0;
let keptTotal = 0;

for (const file of files(process.argv[2])) {
    const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(
        new Uint8Array(fs.readFileSync(file)));
    const meta = extractScoreMetadata(score, { terseBeats: true });

    // A promoted label shows up as a section on a bar whose masterBar has no marker.
    const marked = new Set();
    score.masterBars.forEach((mb, i) => {
        if (mb.section && (mb.section.text || mb.section.marker || '').trim()) marked.add(i);
    });

    const promoted = [];
    const track0 = meta.tracks[0];
    track0.measures.forEach((m, i) => {
        if (m.section && !marked.has(i)) promoted.push(`bar ${i + 1}: ${m.section}`);
    });

    const kept = [];
    for (const track of meta.tracks) {
        track.measures.forEach((m, i) => {
            for (const beat of m.beats) {
                const match = beat.match(/text "([^"]*)"/);
                if (match) kept.push(`${track.name} bar ${i + 1}: ${JSON.stringify(match[1])}`);
            }
        });
    }

    promotedTotal += promoted.length;
    keptTotal += kept.length;
    console.log(`\n=== ${path.basename(file)}`);
    console.log(`  promoted to headings (${promoted.length}):`);
    for (const p of promoted) console.log(`    ${p}`);
    console.log(`  left on their beat (${kept.length}):`);
    for (const k of kept.slice(0, 8)) console.log(`    ${k}`);
    if (kept.length > 8) console.log(`    ... ${kept.length - 8} more`);
}

console.log(`\ntotal promoted ${promotedTotal}, total left in place ${keptTotal}`);

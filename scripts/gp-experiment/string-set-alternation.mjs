// Guitarists often voice a downstroke fuller than the upstroke that follows it -- the down takes
// the bass strings, the up catches only the treble. If our files did that, the string sets alone
// would hint at direction without inventing anything. Do they?
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as alphaTab from '@coderline/alphatab';

for (const file of fs.readdirSync('musicfiles').filter(f => /\.(gp|gp5|gpx)$/i.test(f)).sort()) {
    const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(
        new Uint8Array(fs.readFileSync(path.join('musicfiles', file))));
    console.log(`\n=== ${file}`);
    for (const track of score.tracks) {
        const staff = track.staves[0];
        if (!staff.isStringed) continue;
        const count = staff.tuning.length;

        // Consecutive multi-note beats, and whether the string set changes between them.
        let pairs = 0, sameSet = 0, differentSet = 0;
        let previous = null;
        for (const bar of staff.bars)
            for (const beat of bar.voices[0].beats) {
                if (beat.isRest) { previous = null; continue; }
                const set = beat.notes.filter(n => n.isStringed)
                    .map(n => count - n.string + 1).sort((a, b) => a - b).join(',');
                if (beat.notes.length < 2) { previous = null; continue; }
                if (previous !== null) {
                    pairs++;
                    if (set === previous) sameSet++; else differentSet++;
                }
                previous = set;
            }
        if (pairs === 0) continue;
        console.log(`  ${track.name}: ${pairs} consecutive multi-note pairs`);
        console.log(`    identical string set: ${sameSet} (${(100 * sameSet / pairs).toFixed(0)}%)`);
        console.log(`    different string set: ${differentSet}`);
    }
}

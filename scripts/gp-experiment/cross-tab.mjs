// How often does a chord name and a multi-string beat actually coincide?
// Every sounding beat has notes. The chord name is an extra label on a few of them.
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as alphaTab from '@coderline/alphatab';

const dir = 'musicfiles';
for (const file of fs.readdirSync(dir).filter(f => /\.(gp|gp5|gpx)$/i.test(f)).sort()) {
    const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(
        new Uint8Array(fs.readFileSync(path.join(dir, file))));
    console.log(`\n=== ${file}`);
    for (const track of score.tracks) {
        const staff = track.staves[0];
        if (!staff.isStringed) continue;
        let single = 0, singleNamed = 0, multi = 0, multiNamed = 0, noteless = 0;
        for (const bar of staff.bars)
            for (const beat of bar.voices[0].beats) {
                if (beat.isRest) continue;
                if (beat.notes.length === 0) { noteless++; continue; }
                if (beat.notes.length === 1) { single++; if (beat.chord) singleNamed++; }
                else { multi++; if (beat.chord) multiNamed++; }
            }
        console.log(`  ${track.name}`);
        console.log(`    single-note beats: ${single}  (carry a chord name: ${singleNamed})`);
        console.log(`    multi-note beats:  ${multi}  (carry a chord name: ${multiNamed})`);
        console.log(`    sounding beats with no notes at all: ${noteless}`);
    }
}

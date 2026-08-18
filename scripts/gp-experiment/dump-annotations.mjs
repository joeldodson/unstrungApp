// Every place a .gp file can put free text, dumped side by side, so it is
// visible which channel a given word arrived on.
// Run: node scripts/gp-experiment/dump-annotations.mjs "musicfiles/<file>.gp"
import * as fs from 'node:fs';
import * as alphaTab from '@coderline/alphatab';

const file = process.argv[2];
const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(
    new Uint8Array(fs.readFileSync(file)));

console.log(`=== ${file}`);
console.log(`title=${score.title} tracks=${score.tracks.length} bars=${score.masterBars.length}`);

console.log('\n--- masterBar.section ---');
score.masterBars.forEach((mb, i) => {
    if (mb.section) console.log(`  bar ${i + 1}: text=${JSON.stringify(mb.section.text)} marker=${JSON.stringify(mb.section.marker)}`);
});

console.log('\n--- beat.text ---');
for (const track of score.tracks) {
    for (const staff of track.staves) {
        staff.bars.forEach((bar, bi) => {
            bar.voices.forEach((voice, vi) => {
                voice.beats.forEach((beat, i) => {
                    if (beat.text) {
                        console.log(`  ${track.name} / bar ${bi + 1} / voice ${vi} / beat ${i + 1} of ${voice.beats.length}: ${JSON.stringify(beat.text)}`);
                    }
                });
            });
        });
    }
}

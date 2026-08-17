// Does the .gpx note order look like a strum pattern, or like storage order?
// Prints every multi-note beat in bar order with its listing direction.
import * as fs from 'node:fs';
import * as alphaTab from '@coderline/alphatab';

const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(
    new Uint8Array(fs.readFileSync('musicfiles/Ripple Chord Solo.gpx')));
const staff = score.tracks[0].staves[0];
const count = staff.tuning.length;

for (let b = 0; b < staff.bars.length; b++) {
    const line = [];
    for (const beat of staff.bars[b].voices[0].beats) {
        if (beat.isRest) continue;
        const s = beat.notes.filter(n => n.isStringed).map(n => count - n.string + 1);
        if (s.length < 2) { line.push('.'); continue; }
        const asc = s.every((x, i) => i === 0 || x > s[i - 1]);
        const desc = s.every((x, i) => i === 0 || x < s[i - 1]);
        line.push(asc ? 'UP' : desc ? 'DN' : `MIX(${s.join('-')})`);
    }
    if (line.length) console.log(`bar ${String(b + 1).padStart(2)}: ${line.join(' ')}`);
}

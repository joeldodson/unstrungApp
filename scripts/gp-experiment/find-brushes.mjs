// The only explicit stroke markings in the whole corpus.
import * as fs from 'node:fs';
import * as alphaTab from '@coderline/alphatab';
const BRUSH = ['None', 'BrushUp', 'BrushDown', 'ArpeggioUp', 'ArpeggioDown'];

const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(
    new Uint8Array(fs.readFileSync('musicfiles/Grateful Dead-Ripple-12-20-2025.gp')));
for (const track of score.tracks) {
    const staff = track.staves[0];
    for (let b = 0; b < staff.bars.length; b++)
        for (const beat of staff.bars[b].voices[0].beats)
            if (beat.brushType) {
                const s = beat.notes.map(n => `s${staff.tuning.length - n.string + 1}:${n.fret}`).join(' ');
                console.log(`${track.name} bar ${b + 1}: ${BRUSH[beat.brushType]} duration=${beat.brushDuration} notes: ${s}`);
            }
}

import * as fs from 'node:fs';
import * as alphaTab from '@coderline/alphatab';
import { identifyChordFromNotes } from '../../src/shared/musicTheory.mjs';

const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(
    new Uint8Array(fs.readFileSync('musicfiles/Grateful Dead-Ripple-12-20-2025.gp')));
for (const track of score.tracks) {
    const staff = track.staves[0];
    if (!staff.isStringed) continue;
    console.log(`${track.name}: capo=${staff.capo} tuning=${staff.tuning.join(',')}`);
}
const staff = score.tracks[1].staves[0];
const beat = staff.bars[1].voices[0].beats[0];
console.log(`\nbar 2 beat 1: file chord label = "${beat.chord.name}"`);
console.log(`  notes: ${beat.notes.map(n => `s${staff.tuning.length - n.string + 1}:${n.fret} realValue=${n.realValue}`).join('  ')}`);
console.log(`  identifyChordFromNotes -> ${identifyChordFromNotes(beat.notes.map(n => n.realValue)).slice(0,3).map(c => c.name).join(', ')}`);

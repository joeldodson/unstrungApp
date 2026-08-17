// The two beats the file marks a brush on: does playback now follow the stated direction and
// the stated duration, rather than our own default spacing?
import * as fs from 'node:fs';
import * as alphaTab from '@coderline/alphatab';
import { buildAudioTrack, STRUM_STRING_DELAY_SECONDS } from '../../src/shared/audioTrack.mjs';

const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(
    new Uint8Array(fs.readFileSync('musicfiles/Grateful Dead-Ripple-12-20-2025.gp')));
const track = buildAudioTrack(score, 0);

// A new beat starts wherever indexInBeat stops climbing.
const beats = [];
for (const note of [...track.notes].sort((a, b) => a.startSeconds - b.startSeconds || a.indexInBeat - b.indexInBeat)) {
    const current = beats.at(-1);
    if (!current || note.indexInBeat <= current.at(-1).indexInBeat) beats.push([note]);
    else current.push(note);
}

const report = (label, group) => {
    const span = group.at(-1).startSeconds - group[0].startSeconds;
    console.log(`${label}: strings ${group.map(n => n.string).join(' -> ')}`);
    console.log(`  spread ${(span * 1000).toFixed(1)} ms over ${group.length} notes` +
        `  (our default spacing would give ${((group.length - 1) * STRUM_STRING_DELAY_SECONDS * 1000).toFixed(0)} ms)`);
};

for (const barNumber of [11, 14]) {
    for (const group of beats.filter(g => g.length > 1 && g[0].bar === barNumber - 1)) {
        report(`bar ${barNumber} (file marks Brush Down, duration 30 ticks)`, group);
    }
}

const unmarked = beats.find(g => g.length > 2 && g[0].bar > 14);
if (unmarked) report(`\nbar ${unmarked[0].bar + 1}, no brush marked`, unmarked);

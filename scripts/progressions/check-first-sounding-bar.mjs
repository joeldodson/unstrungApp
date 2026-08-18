// Which measure each track of a song first sounds on.
//
// Checked against the measure list rather than against the audio timeline, so the two have to
// agree by different routes: one walks the built audio track's note times, the other looks for
// the first measure of the parsed score whose beats are not all rests.
//
// Run: node scripts/progressions/check-first-sounding-bar.mjs <file.gp> [more files...]
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as alphaTab from '@coderline/alphatab';
import { buildAudioTrack } from '../../src/shared/audioTrack.mjs';

// The same rule the renderer uses.
function firstSoundingBar(audioTrack) {
    const first = audioTrack.notes[0];
    if (!first) return null;
    const bar = audioTrack.bars.find(candidate => first.startSeconds + 1e-6 < candidate.endSeconds);
    return bar ? bar.index + 1 : null;
}

// Independently: the first bar of the score carrying a note rather than a rest.
function firstBarWithANote(track) {
    const staff = track.staves && track.staves.length > 0 ? track.staves[0] : null;
    if (!staff) return null;
    for (const [index, bar] of (staff.bars || []).entries()) {
        for (const voice of bar.voices || []) {
            for (const beat of voice.beats || []) {
                if (!beat.isRest && (beat.notes || []).length > 0) return index + 1;
            }
        }
    }
    return null;
}

let mismatches = 0;

for (const file of process.argv.slice(2)) {
    const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(
        new Uint8Array(fs.readFileSync(file)));
    console.log(`\n=== ${path.basename(file)}  bars=${score.masterBars.length}`);
    for (const [index, track] of score.tracks.entries()) {
        const audioTrack = buildAudioTrack(score, index, {});
        if (!audioTrack) {
            console.log(`  ${track.name}: no audio track could be built`);
            continue;
        }
        const fromAudio = firstSoundingBar(audioTrack);
        const fromScore = firstBarWithANote(track);
        const agree = fromAudio === fromScore;
        if (!agree) mismatches++;
        const row = `Notes - ${audioTrack.notes.length}` +
            (fromAudio > 1 ? `, starting at measure ${fromAudio}` : '');
        console.log(`  ${agree ? 'ok  ' : 'FAIL'}  ${track.name}`);
        console.log(`          reads: "${row}"`);
        if (!agree) console.log(`          score says first note is in bar ${fromScore}`);
    }
}

console.log(`\n${mismatches === 0 ? 'audio and score agree on every track' : `${mismatches} MISMATCHES`}`);
process.exit(mismatches === 0 ? 0 : 1);

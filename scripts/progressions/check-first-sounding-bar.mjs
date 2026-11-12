// Which measure each track of a song first sounds on.
//
// Checked against the measure list rather than against the audio timeline, so the two have to
// agree by different routes: one walks the built audio track's note times, the other looks for
// the first measure of the parsed score whose beats are not all rests.
//
// Run: node scripts/progressions/check-first-sounding-bar.mjs <file.gp or folder> [more...]
// A folder is read for every Guitar Pro file under it. With nothing given there is nothing to
// check, so npm test skips it and npm run test:songs -- <folder> runs it.
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

function songFiles(target, out = []) {
    if (!fs.statSync(target).isDirectory()) {
        out.push(target);
        return out;
    }
    for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
        const full = path.join(target, entry.name);
        if (entry.isDirectory()) songFiles(full, out);
        else if (/\.(gp|gp3|gp4|gp5|gpx)$/i.test(entry.name)) out.push(full);
    }
    return out;
}

const targets = process.argv.slice(2);
if (targets.length === 0) {
    console.error('Give one or more song files or folders of them.');
    process.exit(1);
}

let mismatches = 0;

for (const file of targets.flatMap(target => songFiles(target))) {
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

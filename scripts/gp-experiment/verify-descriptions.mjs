// Sanity pass over every beat of every file, terse and full.
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as alphaTab from '@coderline/alphatab';
import { extractScoreMetadata } from '../../src/shared/scoreMetadata.mjs';

const dir = 'musicfiles';
let total = 0;
const withStroke = [];
for (const file of fs.readdirSync(dir).filter(f => /\.(gp|gp5|gpx)$/i.test(f)).sort()) {
    const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(
        new Uint8Array(fs.readFileSync(path.join(dir, file))));
    for (const terseBeats of [false, true]) {
        const meta = extractScoreMetadata(score, { terseBeats });
        for (const track of meta.tracks)
            for (const [i, measure] of track.measures.entries())
                for (const beat of measure.beats) {
                    total++;
                    if (typeof beat !== 'string' || beat.includes('undefined') || beat.includes('NaN'))
                        throw new Error(`bad beat text in ${file}: ${beat}`);
                    if (/stroke|arpeggi/.test(beat))
                        withStroke.push(`${file} ${terseBeats ? 'terse' : 'full '} ${track.name} bar ${i + 1}: ${beat}`);
                }
    }
}
console.log(`${total} beat descriptions produced, no undefined/NaN`);

// No file we have puts two chord symbols in one measure, but nothing in these formats stops one,
// and a measure heading is where that would show. So one is made: the Ripple capo track's bar 2
// already carries a C on its first beat, and a G is attached to the beat three quarters in.
{
    const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(
        new Uint8Array(fs.readFileSync(path.join(dir, 'Grateful Dead-Ripple-12-20-2025.gp'))));
    const staff = score.tracks[1].staves[0];
    const beats = staff.bars[1].voices[0].beats;
    const target = beats.find(beat => beat.playbackStart === 960 * 2);
    if (!target) throw new Error('no beat two quarter notes into bar 2 to hang a second symbol on');
    // Beat.chord is derived from chordId against the staff's chord map, so the chord goes in there.
    staff.addChord('synthetic-second-symbol', { name: 'G', strings: [] });
    target.chordId = 'synthetic-second-symbol';

    const heading = extractScoreMetadata(score, { terseBeats: true }).tracks[1].measures[1].chordSymbols;
    console.log(`\nsynthetic measure carrying two symbols:\n  Measure 2 - ${heading}`);
    if (heading !== 'chord symbols C at beat 1, G at beat 3') {
        throw new Error(`unexpected heading for two symbols: ${heading}`);
    }
    console.log('  both are named, each with the beat it starts on');
}
console.log(`\nbeats that report a stroke direction (${withStroke.length / 2} distinct, each listed full + terse):`);
for (const line of withStroke) console.log('  ' + line);

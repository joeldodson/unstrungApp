// Experiment: what do our .gp files actually say about strum direction?
//
// Dumps, for every beat in every track of every file in musicfiles/, the raw
// signals that bear on stroke direction:
//   - beat.brushType / brushDuration  (the file's own "brush up/down" marking)
//   - beat.pickStroke                 (the file's own "pick stroke up/down" marking)
//   - beat.hasChord / chord.name      (a chord diagram attached to the beat)
//   - the notes in the order alphaTab put them in beat.notes, with the tab
//     string number Unstrung would report (1 = high E)
//
// Run: node scripts/gp-experiment/dump-strokes.mjs [--beats]

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as alphaTab from '@coderline/alphatab';

const BRUSH = ['None', 'BrushUp', 'BrushDown', 'ArpeggioUp', 'ArpeggioDown'];
const PICK = ['None', 'Up', 'Down'];

const showBeats = process.argv.includes('--beats');
const dir = 'musicfiles';
const files = fs.readdirSync(dir).filter(f => /\.(gp|gp3|gp4|gp5|gpx)$/i.test(f)).sort();

for (const file of files) {
    const bytes = new Uint8Array(fs.readFileSync(path.join(dir, file)));
    let score;
    try {
        score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes);
    } catch (e) {
        console.log(`\n=== ${file} === FAILED: ${e.message}`);
        continue;
    }

    console.log(`\n=== ${file} ===`);
    console.log(`title: ${score.title || '(untitled)'}  tracks: ${score.tracks.length}  bars: ${score.masterBars.length}`);

    for (const track of score.tracks) {
        const staff = track.staves[0];
        const stringCount = staff && staff.tuning ? staff.tuning.length : 0;
        const tabString = note => stringCount - note.string + 1;

        const stats = {
            beats: 0, rests: 0, chordBeats: 0, multiNote: 0,
            brush: new Map(), pick: new Map(),
            order: new Map(),          // ascending / descending / mixed, for multi-note beats
            chordWithNotes: 0, chordWithoutNotes: 0
        };
        const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);
        const rows = [];

        for (let b = 0; b < staff.bars.length; b++) {
            const bar = staff.bars[b];
            for (let v = 0; v < bar.voices.length; v++) {
                for (const beat of bar.voices[v].beats) {
                    stats.beats++;
                    if (beat.isRest) { stats.rests++; continue; }

                    const brush = BRUSH[beat.brushType] ?? `?${beat.brushType}`;
                    const pick = PICK[beat.pickStroke] ?? `?${beat.pickStroke}`;
                    bump(stats.brush, brush);
                    bump(stats.pick, pick);

                    const strings = beat.notes.map(n => (n.isStringed ? tabString(n) : null));
                    const stringed = strings.filter(s => s !== null);
                    let order = 'single';
                    if (stringed.length > 1) {
                        stats.multiNote++;
                        const asc = stringed.every((s, i) => i === 0 || s > stringed[i - 1]);
                        const desc = stringed.every((s, i) => i === 0 || s < stringed[i - 1]);
                        order = asc ? 'ascending' : desc ? 'descending' : 'mixed';
                        bump(stats.order, order);
                    }

                    if (beat.chord) {
                        stats.chordBeats++;
                        if (beat.notes.length > 0) stats.chordWithNotes++; else stats.chordWithoutNotes++;
                    }

                    if (showBeats) {
                        const noteText = beat.notes.map(n =>
                            n.isStringed
                                ? `s${tabString(n)}${n.isDead ? 'x' : ':' + n.fret}`
                                : `midi${n.realValue}`
                        ).join(' ');
                        rows.push(
                            `  bar ${String(b + 1).padStart(3)} v${v} | ` +
                            `chord=${beat.chord ? beat.chord.name : '-'} | ` +
                            `brush=${brush}${beat.brushDuration ? '/' + beat.brushDuration : ''} pick=${pick} | ` +
                            `${order.padEnd(10)} | ${noteText}`
                        );
                    }
                }
            }
        }

        const fmt = m => [...m.entries()].map(([k, n]) => `${k}=${n}`).join(' ') || '(none)';
        console.log(`\n-- track "${track.name}" (${stringCount} strings, ${staff.bars.length} bars)`);
        console.log(`   beats: ${stats.beats} (rests ${stats.rests}, multi-note ${stats.multiNote})`);
        console.log(`   brushType:   ${fmt(stats.brush)}`);
        console.log(`   pickStroke:  ${fmt(stats.pick)}`);
        console.log(`   note order:  ${fmt(stats.order)}`);
        console.log(`   chord diagrams on beats: ${stats.chordBeats} (with notes ${stats.chordWithNotes}, without ${stats.chordWithoutNotes})`);
        if (showBeats) console.log(rows.join('\n'));
    }
}

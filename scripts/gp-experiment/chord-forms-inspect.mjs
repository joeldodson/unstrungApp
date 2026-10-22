// Looks inside a stretch of one track, for working out why a measure's chord form came out as it
// did. See docs/chord-forms-workflow.md.
//
// Run: node scripts/gp-experiment/chord-forms-inspect.mjs <song file> <track number> <first measure> [last measure]
//
// The track number is its place in the file, counting from 1, as alphaTab has it, which is not
// always its number in the app's list: the app leaves out tracks that are not guitar or bass.
//
// Prints, for each measure: its heading as the app gives it; every beat's strings and frets, as
// string:fret with x for a muted string, its start in beats, and any chord the file prints on it;
// and then every span the form finder made over the stretch, with its form, what decided it, and
// which beats are exceptions. The output reproduces the file's tab, so it is for reading here and
// is not to be committed.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as alphaTab from '@coderline/alphatab';
import { trackEvents, findChordForms, fretsKey } from '../../src/shared/chordForms.mjs';
import { extractScoreMetadata } from '../../src/shared/scoreMetadata.mjs';

const [file, trackArg, firstArg, lastArg] = process.argv.slice(2);
if (!file || !trackArg || !firstArg) {
    console.log('Usage: node scripts/gp-experiment/chord-forms-inspect.mjs <song file> <track number> <first measure> [last measure]');
    process.exit(1);
}
const [first, last] = [Number(firstArg), Number(lastArg ?? firstArg)];
const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(fs.readFileSync(file)));
const trackIndex = Number(trackArg) - 1;
const track = score.tracks[trackIndex];
const staff = track.staves[0];
const strings = staff.tuning.length;
const meta = extractScoreMetadata(score).tracks.find(t => t.index === trackIndex);

console.log(`${path.basename(file)}, track ${trackArg} of the file, ${track.name} (program ${track.playbackInfo.program}), capo ${staff.capo}`);
if (!meta) console.log('  The app does not list this track: it is not a guitar or bass.');

for (let m = first; m <= last && m <= staff.bars.length; m++) {
    const measure = meta?.measures[m - 1];
    const heading = measure ? [`Measure ${m}`, measure.section, measure.repeat, measure.forms, measure.chordSymbols].filter(Boolean).join(' - ') : `Measure ${m}`;
    console.log(`\n${heading}`);
    const ticksPerBeat = 960 * 4 / (score.masterBars[m - 1].timeSignatureDenominator || 4);
    for (const beat of staff.bars[m - 1].voices[0].beats) {
        const at = beat.playbackStart / ticksPerBeat + 1;
        const notes = beat.isRest ? 'rest' : beat.notes.map(note =>
            `${strings - note.string + 1}:${note.isDead ? 'x' : note.fret}${note.isTieDestination ? ' tied' : ''}${note.isHammerPullOrigin ? ' >' : ''}${note.isHammerPullDestination ? ' <' : ''}`).join(' + ');
        const printed = beat.hasChord && beat.chord ? `   [printed ${beat.chord.name}]` : '';
        console.log(`  ${String(at).padEnd(6)} ${notes}${printed}`);
    }
}

const { spans, events } = findChordForms(trackEvents(staff, score.masterBars));
const where = e => `m${e.measure + 1} beat ${e.beat}`;
console.log('\nSpans over these measures:');
for (const span of spans) {
    const a = events[span.members[0]];
    const b = events[span.members[span.members.length - 1]];
    if (b.measure + 1 < first || a.measure + 1 > last) continue;
    const off = new Set(span.form ? span.form.exceptions.flat() : []);
    const form = span.form
        ? `${span.form.chord.name} [${fretsKey(span.form.frets)}]${span.whole ? ', a measure held whole' : ''}`
        : `no form (${span.candidates?.[0]?.reason ?? 'unknown'})`;
    console.log(`  ${where(a)} to ${where(b)}: ${form}${span.decidedBy ? `, decided by ${span.decidedBy}` : ''}`);
    const shown = span.members.filter(member => events[member].measure + 1 >= first && events[member].measure + 1 <= last && off.has(member));
    if (shown.length > 0) console.log(`      exceptions at ${shown.map(member => where(events[member])).join(', ')}`);
}

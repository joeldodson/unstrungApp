// Does alphaTab's own MIDI generation put any spread across a strummed beat?
//
// For every beat that sounds more than one note, this finds that beat's note-on events in the
// MIDI alphaTab generates and measures how many distinct ticks they land on. One tick means the
// notes sound together; more than one means alphaTab spread them.
// Run: node scripts/gp-experiment/alphatab-midi-spread.mjs

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as alphaTab from '@coderline/alphatab';

for (const file of fs.readdirSync('musicfiles').filter(f => /\.(gp|gp5|gpx)$/i.test(f)).sort()) {
    const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(
        new Uint8Array(fs.readFileSync(path.join('musicfiles', file))));

    const midiFile = new alphaTab.midi.MidiFile();
    const generator = new alphaTab.midi.MidiFileGenerator(
        score, null, new alphaTab.midi.AlphaSynthMidiFileHandler(midiFile));
    generator.generate();

    // Note-ons per channel, so one track's chord cannot be mistaken for another's.
    const onsByChannel = new Map();
    for (const event of midiFile.events) {
        if (!/NoteOn/.test(event.constructor.name) || (event.velocity ?? 1) <= 0) continue;
        if (!onsByChannel.has(event.channel)) onsByChannel.set(event.channel, []);
        onsByChannel.get(event.channel).push(event.tick);
    }

    console.log(`\n=== ${file}`);
    for (const track of score.tracks) {
        const channel = track.playbackInfo ? track.playbackInfo.primaryChannel : null;
        const ons = onsByChannel.get(channel) || [];
        if (ons.length === 0) continue;
        const tickSet = [...new Set(ons)].sort((a, b) => a - b);

        let together = 0, spread = 0;
        const spreadExamples = [];
        for (const staff of track.staves)
            for (const bar of staff.bars)
                for (const voice of bar.voices)
                    for (const beat of voice.beats) {
                        if (beat.isRest || beat.notes.length < 2) continue;
                        const start = (bar.masterBar ? bar.masterBar.start : 0) + beat.playbackStart;
                        // Ticks belonging to this beat: at or after its start, before the next
                        // tick that is a whole 32nd note away (a brush is far shorter than that).
                        const mine = tickSet.filter(t => t >= start && t < start + 120);
                        if (mine.length === 0) continue;
                        if (mine.length === 1) together++;
                        else {
                            spread++;
                            if (spreadExamples.length < 3) spreadExamples.push(
                                `bar ${bar.index + 1}: ticks ${mine.map(t => t - start).join(', ')} ` +
                                `after the beat, brushType=${beat.brushType}, brushDuration=${beat.brushDuration}`);
                        }
                    }

        console.log(`  ${track.name}`);
        console.log(`    multi-note beats sounding all at one tick: ${together}`);
        console.log(`    multi-note beats with any spread:          ${spread}`);
        for (const example of spreadExamples) console.log(`      ${example}`);
    }
}

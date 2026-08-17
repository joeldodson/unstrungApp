// What does a chord name attached to a beat mark?
//
// Unstrung currently reports such a beat as "chord C" and drops the strings.
// The user's inference is that a chord name means a down stroke. This looks at
// where the names actually fall and what notes sit under them.
// Run: node scripts/gp-experiment/chord-diagrams.mjs

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as alphaTab from '@coderline/alphatab';

const dir = 'musicfiles';
const files = fs.readdirSync(dir).filter(f => /\.(gp|gp5|gpx)$/i.test(f)).sort();

for (const file of files) {
    const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(
        new Uint8Array(fs.readFileSync(path.join(dir, file))));

    for (const track of score.tracks) {
        const staff = track.staves[0];
        if (!staff.isStringed) continue;
        const count = staff.tuning.length;

        const beats = [];
        for (let b = 0; b < staff.bars.length; b++)
            for (const beat of staff.bars[b].voices[0].beats)
                beats.push({ bar: b + 1, beat });

        const named = beats.filter(x => x.beat.chord);
        if (named.length === 0) continue;

        console.log(`\n=== ${file} / ${track.name} — ${named.length} beats carry a chord name`);

        // Is the named beat the first of a run of identical note sets?
        let firstOfRun = 0, repeatsAfter = [];
        for (const { bar, beat } of named) {
            const key = beat.notes.filter(n => n.isStringed)
                .map(n => `${count - n.string + 1}:${n.isDead ? 'x' : n.fret}`).sort().join(' ');
            const idx = beats.findIndex(x => x.beat === beat);
            let repeats = 0;
            for (let j = idx + 1; j < beats.length; j++) {
                const nb = beats[j].beat;
                if (nb.isRest) continue;
                const nkey = nb.notes.filter(n => n.isStringed)
                    .map(n => `${count - n.string + 1}:${n.isDead ? 'x' : n.fret}`).sort().join(' ');
                if (nkey !== key || nb.chord) break;
                repeats++;
            }
            const prev = beats[idx - 1];
            const prevKey = prev && !prev.beat.isRest ? prev.beat.notes.filter(n => n.isStringed)
                .map(n => `${count - n.string + 1}:${n.isDead ? 'x' : n.fret}`).sort().join(' ') : null;
            if (prevKey !== key) firstOfRun++;
            repeatsAfter.push(repeats);
            console.log(`  bar ${String(bar).padStart(3)}  "${beat.chord.name}"  ` +
                `notes: ${beat.notes.filter(n => n.isStringed).map(n => `s${count - n.string + 1}:${n.isDead ? 'x' : n.fret}`).join(' ') || '(none)'}  ` +
                `| identical un-named beats following: ${repeats}`);
        }
        const same = repeatsAfter.filter(r => r > 0).length;
        console.log(`  -> named beat starts a new note set: ${firstOfRun}/${named.length}`);
        console.log(`  -> named beat is followed by identical, un-named beats: ${same}/${named.length}`);
    }
}

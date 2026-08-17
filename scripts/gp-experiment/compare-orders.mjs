// Same music, two file formats: does beat.notes order agree?
//
// "Ripple Chord Solo" exists as both .gp5 and .gpx. If note order carried the
// player's strum direction, the two exports of the same song would agree on it.
// Run: node scripts/gp-experiment/compare-orders.mjs

import * as fs from 'node:fs';
import * as alphaTab from '@coderline/alphatab';

function load(file) {
    return alphaTab.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(fs.readFileSync(file)));
}

function beatsOf(score, trackIndex = 0) {
    const staff = score.tracks[trackIndex].staves[0];
    const count = staff.tuning.length;
    const out = [];
    for (let b = 0; b < staff.bars.length; b++) {
        for (const beat of staff.bars[b].voices[0].beats) {
            if (beat.isRest) continue;
            const strings = beat.notes.filter(n => n.isStringed).map(n => count - n.string + 1);
            out.push({
                bar: b + 1,
                chord: beat.chord ? beat.chord.name : null,
                strings,
                frets: beat.notes.filter(n => n.isStringed).map(n => (n.isDead ? 'x' : n.fret)),
                dir: strings.length < 2 ? 'single'
                    : strings.every((s, i) => i === 0 || s > strings[i - 1]) ? 'ascending'
                    : strings.every((s, i) => i === 0 || s < strings[i - 1]) ? 'descending' : 'mixed'
            });
        }
    }
    return out;
}

const a = beatsOf(load('musicfiles/Ripple Chord Solo.gp5'));
const b = beatsOf(load('musicfiles/Ripple Chord Solo.gpx'));

console.log(`gp5 sounding beats: ${a.length}   gpx sounding beats: ${b.length}`);

const n = Math.min(a.length, b.length);
let sameNotes = 0, sameOrder = 0, disagree = [];
for (let i = 0; i < n; i++) {
    const setA = [...a[i].strings].sort((x, y) => x - y).join(',');
    const setB = [...b[i].strings].sort((x, y) => x - y).join(',');
    if (setA !== setB) continue;              // not the same beat; skip
    sameNotes++;
    if (a[i].strings.join(',') === b[i].strings.join(',')) sameOrder++;
    else if (a[i].strings.length > 1) disagree.push({ i, a: a[i], b: b[i] });
}

console.log(`beats where both files list the same strings: ${sameNotes}`);
console.log(`  of those, same listing order: ${sameOrder}`);
console.log(`  different order (same music, opposite "stroke"): ${disagree.length}`);
console.log('\nfirst 15 disagreements — what Unstrung would say from each file:');
for (const d of disagree.slice(0, 15)) {
    const say = x => `${x.chord ? 'chord ' + x.chord : x.strings.map((s, j) => `s${s}:${x.frets[j]}`).join(' ')} [${x.dir}]`;
    console.log(`  bar ${d.a.bar}: gp5 -> ${say(d.a)}`);
    console.log(`  bar ${d.b.bar}: gpx -> ${say(d.b)}`);
}

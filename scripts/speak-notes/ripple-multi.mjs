// The unnamed multi-note beats are the majority, so "unknown" would swallow the song.
// How many of them can the chord identifier already name from their notes?

import { readFile } from 'node:fs/promises';
// Repo root, from this file's own location, so the script runs from anywhere.
const APP_DIR = `${import.meta.dirname}/../..`.replace(/\\/g, '/');
const alphaTab = await import(`file:///${APP_DIR}/node_modules/@coderline/alphatab/dist/alphaTab.mjs`);
const { identifyChordFromNotes, midiToPitchName, QUALITY_LABELS } =
    await import(`file:///${APP_DIR}/src/shared/musicTheory.mjs`);

const bytes = new Uint8Array(await readFile(`${APP_DIR}/musicfiles/Grateful Dead-Ripple-12-20-2025.gp`));
const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes);

console.log('=== chord names the file itself carries, first 10 measures ===');
for (const [ti, track] of score.tracks.entries()) {
    const names = new Set();
    for (const staff of track.staves) {
        for (const bar of staff.bars.slice(0, 10)) {
            for (const voice of bar.voices) {
                for (const beat of voice.beats) {
                    if (beat.hasChord && beat.chord && beat.chord.name) names.add(beat.chord.name);
                }
            }
        }
    }
    console.log(`  track ${ti} ${track.name.padEnd(22)} ${names.size ? [...names].join(', ') : '(none)'}`);
}

for (const [ti, track] of score.tracks.entries()) {
    let sounding = 0, single = 0, named = 0, identified = 0, pair = 0, unknown = 0;
    const examples = [];
    for (const staff of track.staves) {
        for (const bar of staff.bars.slice(0, 10)) {
            for (const voice of bar.voices) {
                for (const beat of voice.beats) {
                    if (beat.isRest) continue;
                    const sounded = beat.notes.filter(n => !n.isTieDestination && !n.isDead);
                    if (sounded.length === 0) continue;
                    sounding++;
                    if (beat.hasChord && beat.chord && beat.chord.name) { named++; continue; }
                    if (sounded.length === 1) { single++; continue; }

                    const midis = sounded.map(n => n.realValue);
                    const hit = identifyChordFromNotes(midis)[0];
                    if (hit) {
                        identified++;
                        if (examples.length < 6) examples.push(
                            `${midis.map(midiToPitchName).join(' ')}  ->  ${hit.root} ${QUALITY_LABELS[hit.suffix] ?? hit.suffix}`);
                    } else if (sounded.length === 2) {
                        pair++;
                        if (examples.length < 6) examples.push(
                            `${midis.map(midiToPitchName).join(' ')}  ->  spoken as two notes`);
                    } else {
                        unknown++;
                        if (examples.length < 6) examples.push(
                            `${midis.map(midiToPitchName).join(' ')}  ->  unknown`);
                    }
                }
            }
        }
    }
    if (sounding === 0) continue;
    const pct = n => `${((n / sounding) * 100).toFixed(0)}%`;
    console.log(`\n=== track ${ti}: ${track.name} -- ${sounding} sounding beats in 10 measures ===`);
    console.log(`  named by the file      ${String(named).padStart(3)}  ${pct(named)}`);
    console.log(`  single note            ${String(single).padStart(3)}  ${pct(single)}`);
    console.log(`  identified from notes  ${String(identified).padStart(3)}  ${pct(identified)}`);
    console.log(`  two notes, spoken out  ${String(pair).padStart(3)}  ${pct(pair)}`);
    console.log(`  UNKNOWN                ${String(unknown).padStart(3)}  ${pct(unknown)}`);
    for (const example of examples) console.log(`    e.g. ${example}`);
}

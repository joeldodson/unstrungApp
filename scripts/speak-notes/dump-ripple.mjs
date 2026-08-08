// What is actually in the first 10 measures of Ripple, beat by beat?
//
// Needed to build a real passage for the Speak the Notes bench, and to see how often a beat is
// neither a single note nor a named chord -- the case that has to announce something honest
// rather than trying to say six string-and-fret pairs.

import { readFile } from 'node:fs/promises';

// Repo root, from this file's own location, so the script runs from anywhere.
const APP_DIR = `${import.meta.dirname}/../..`.replace(/\\/g, '/');
const alphaTab = await import(`file:///${APP_DIR}/node_modules/@coderline/alphatab/dist/alphaTab.mjs`);

const file = process.argv[2] ?? `${APP_DIR}/musicfiles/Grateful Dead-Ripple-12-20-2025.gp`;
const bytes = new Uint8Array(await readFile(file));
const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes);

console.log(`title    : ${score.title}`);
console.log(`artist   : ${score.artist}`);
console.log(`tempo    : ${score.tempo}`);
console.log(`bars     : ${score.masterBars.length}`);
console.log(`tracks   : ${score.tracks.map((t, i) => `${i}: ${t.name}`).join(' | ')}`);

const DURATION_NAMES = {
    1: 'whole', 2: 'half', 4: 'quarter', 8: 'eighth',
    16: 'sixteenth', 32: 'thirty-second', 64: 'sixty-fourth'
};

for (const [trackIndex, track] of score.tracks.entries()) {
    console.log(`\n================ track ${trackIndex}: ${track.name} ================`);
    for (const staff of track.staves) {
        const stringCount = staff.tuning ? staff.tuning.length : 0;
        console.log(`  strings: ${stringCount}  tuning: ${(staff.tuning ?? []).join(', ')}`);

        for (const bar of staff.bars.slice(0, 10)) {
            const master = score.masterBars[bar.index];
            console.log(`\n  --- measure ${bar.index + 1} ` +
                `(${master.timeSignatureNumerator}/${master.timeSignatureDenominator}) ---`);

            for (const voice of bar.voices) {
                for (const beat of voice.beats) {
                    const parts = [];
                    parts.push(`t=${String(beat.playbackStart).padStart(5)}`);
                    parts.push(`${DURATION_NAMES[beat.duration] ?? beat.duration}${'.'.repeat(beat.dots ?? 0)}`);

                    if (beat.isRest) { parts.push('REST'); console.log(`    ${parts.join('  ')}`); continue; }

                    const chordName = beat.hasChord && beat.chord ? beat.chord.name : null;
                    if (chordName) parts.push(`chord="${chordName}"`);

                    const notes = beat.notes.map(n => ({
                        string: stringCount ? stringCount - n.string + 1 : null,
                        fret: n.fret,
                        midi: n.realValue,
                        tied: n.isTieDestination,
                        dead: n.isDead
                    }));
                    parts.push(`${notes.length} note(s)`);
                    parts.push(notes.map(n =>
                        `s${n.string}f${n.fret}${n.tied ? '~' : ''}${n.dead ? 'X' : ''}`).join(' '));

                    // The classification the announcement has to make.
                    const sounded = notes.filter(n => !n.tied && !n.dead);
                    const kind = chordName ? 'CHORD-NAME'
                        : sounded.length === 0 ? 'nothing-struck'
                            : sounded.length === 1 ? 'SINGLE'
                                : 'MULTI-NO-NAME';
                    parts.push(`=> ${kind}`);

                    console.log(`    ${parts.join('  ')}`);
                }
            }
        }
    }
}

// How common is each case across the whole song, and across the first 10 bars?
for (const limit of [10, Number.MAX_SAFE_INTEGER]) {
    const tally = { 'CHORD-NAME': 0, SINGLE: 0, 'MULTI-NO-NAME': 0, 'nothing-struck': 0, rest: 0 };
    for (const track of score.tracks) {
        for (const staff of track.staves) {
            const stringCount = staff.tuning ? staff.tuning.length : 0;
            for (const bar of staff.bars.slice(0, limit)) {
                for (const voice of bar.voices) {
                    for (const beat of voice.beats) {
                        if (beat.isRest) { tally.rest++; continue; }
                        const sounded = beat.notes.filter(n => !n.isTieDestination && !n.isDead);
                        if (beat.hasChord && beat.chord && beat.chord.name) tally['CHORD-NAME']++;
                        else if (sounded.length === 0) tally['nothing-struck']++;
                        else if (sounded.length === 1) tally.SINGLE++;
                        else tally['MULTI-NO-NAME']++;
                        void stringCount;
                    }
                }
            }
        }
    }
    console.log(`\n=== beat kinds, ${limit === 10 ? 'first 10 measures' : 'whole song'} ===`);
    for (const [kind, count] of Object.entries(tally)) console.log(`  ${kind.padEnd(16)} ${count}`);
}

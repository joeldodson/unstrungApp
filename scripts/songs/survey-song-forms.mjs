// Reads every Guitar Pro file under a folder with src/shared/songScore.mjs and counts how many
// measures of each guitar track come out plain, patterned or written out, and why.
//
//   node scripts/songs/survey-song-forms.mjs <folder>
//
// The folder is an argument because the files worth surveying are licensed to one subscriber and
// are kept outside the repository. Only counts and reasons are printed, never the music.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readSongFromScore } from '../../src/shared/songScore.mjs';

const folder = process.argv[2];
if (!folder) {
    console.error('Usage: node scripts/songs/survey-song-forms.mjs <folder>');
    process.exit(2);
}

const root = path.join(import.meta.dirname, '..', '..');
const alphaTab = await import(pathToFileURL(path.join(root, 'node_modules', '@coderline', 'alphatab', 'dist', 'alphaTab.mjs')).href);
const library = JSON.parse(fs.readFileSync(path.join(root, 'src', 'assets', 'chords', 'chord-library.json'), 'utf8'));

const files = fs.readdirSync(folder, { recursive: true })
    .filter(name => /\.(gp|gpx|gp[345])$/i.test(name))
    .map(name => path.join(folder, name));

const totals = { plain: 0, patterned: 0, silent: 0, written: 0 };
const reasons = new Map();
const generalise = reason => reason.replace(/\(.*\)$/, '(shape)').replace(/does not know, .*/, 'does not know');

for (const file of files) {
    let score;
    try {
        score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(fs.readFileSync(file)), new alphaTab.Settings());
    } catch (error) {
        console.log(`${path.basename(file)}: could not be read (${error.message})`);
        continue;
    }
    for (const [trackIndex, track] of score.tracks.entries()) {
        const tuning = track.staves?.[0]?.tuning ?? [];
        if (tuning.length !== 6 || track.staves[0].isPercussion) continue;
        const song = readSongFromScore(score, { library, trackIndex });
        const counts = { plain: 0, patterned: 0, silent: 0, written: 0 };
        for (const measure of song.measures) {
            counts[measure.form]++;
            totals[measure.form]++;
            if (measure.form === 'written') {
                const reason = generalise(measure.reason);
                reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
            }
        }
        const top = song.patterns.slice(0, 2).map(p => `${p.text} x${p.measures.length}`).join('; ');
        console.log(`${path.basename(file)}, track ${trackIndex + 1}: ${song.measures.length} measures -- ` +
            `${counts.plain} plain, ${counts.patterned} patterned, ${counts.silent} silent, ${counts.written} written out` +
            (top ? `. Most common patterns: ${top}` : ''));
    }
}

console.log(`\nAll tracks: ${totals.plain} plain, ${totals.patterned} patterned, ${totals.silent} silent, ${totals.written} written out.`);
console.log('Why measures were written out:');
for (const [reason, count] of [...reasons.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count}  ${reason}`);
}

// Records what the app says about every song in a folder, and compares against that record, so a
// change to the chord form rules can be checked against every song already looked at. See
// docs/chord-forms-workflow.md.
//
// Run: node scripts/gp-experiment/chord-forms-snapshot.mjs <dir> --write <snapshot file>
//      node scripts/gp-experiment/chord-forms-snapshot.mjs <dir> --compare <snapshot file> [--all]
//
// The record is, for every listed track of every Guitar Pro file under <dir> and its subfolders:
// each measure's heading as the app gives it, the Chords Used list with beat counts, and the
// anomalies. Copies of a file, byte for byte, are recorded once.
//
// --compare prints every measure whose heading differs, old then new, each track's Chords Used
// where it differs, and the anomalies gained and lost, then a summary. Songs missing from the
// record are listed as new; give --all to print their headings in full too. It exits with 1 where
// anything differs, so it can gate a commit.
//
// The record names songs and says what each measure holds, so it lives beside the songs, outside
// the repository, as the songs themselves do.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import * as alphaTab from '@coderline/alphatab';
import { extractScoreMetadata } from '../../src/shared/scoreMetadata.mjs';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const dir = args[0];
const writeTo = option('--write');
const compareTo = option('--compare');
if (!dir || (!writeTo && !compareTo)) {
    console.log('Usage: node scripts/gp-experiment/chord-forms-snapshot.mjs <dir> --write <file> | --compare <file> [--all]');
    process.exit(1);
}

function* files(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const full = path.join(folder, entry.name);
        if (entry.isDirectory()) yield* files(full);
        else if (/\.gp\d?x?$/i.test(entry.name)) yield full;
    }
}

const heading = (m, i) => [`Measure ${i + 1}`, m.section, m.repeat, m.forms, m.chordSymbols].filter(Boolean).join(' - ');

const current = {};
const seen = new Map();
for (const file of files(dir)) {
    const bytes = fs.readFileSync(file);
    const hash = crypto.createHash('sha1').update(bytes).digest('hex');
    const relative = path.relative(dir, file).split(path.sep).join('/');
    if (seen.has(hash)) continue;
    seen.set(hash, relative);
    let meta;
    try { meta = extractScoreMetadata(alphaTab.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(bytes))); }
    catch (error) { console.log(`could not read ${relative}: ${error.message}`); continue; }
    current[relative] = {};
    for (const track of meta.tracks) {
        current[relative][`${track.index + 1} ${track.name}`] = {
            headings: track.measures.map(heading),
            chords: track.chords.map(c => `${c.name} ${c.beats}`),
            anomalies: track.anomalies.map(a => `measure ${a.measure}: prints ${a.symbol}, holds ${a.held ?? 'a clashing melody'}`)
        };
    }
}

if (writeTo) {
    fs.writeFileSync(writeTo, JSON.stringify({ written: new Date().toISOString(), songs: current }, null, 1));
    const tracks = Object.values(current).reduce((n, song) => n + Object.keys(song).length, 0);
    console.log(`Recorded ${Object.keys(current).length} songs, ${tracks} tracks, in ${writeTo}`);
    process.exit(0);
}

const record = JSON.parse(fs.readFileSync(compareTo, 'utf8'));
console.log(`Comparing against the record of ${record.written}`);
let measures = 0, changed = 0, tracksChanged = 0;
const added = [], gone = [];
for (const [song, tracks] of Object.entries(current)) {
    const before = record.songs[song];
    if (!before) {
        added.push(song);
        if (args.includes('--all')) {
            console.log(`\n=== ${song} (new)`);
            for (const [name, track] of Object.entries(tracks)) {
                console.log(`  ${name}`);
                for (const h of track.headings) console.log(`    ${h}`);
            }
        }
        continue;
    }
    for (const [name, track] of Object.entries(tracks)) {
        const old = before[name];
        measures += track.headings.length;
        if (!old) { console.log(`\n=== ${song}, ${name}: not in the record`); continue; }
        const lines = [];
        track.headings.forEach((h, i) => {
            if (h === old.headings[i]) return;
            changed++;
            lines.push(`    was: ${old.headings[i] ?? '(none)'}\n    now: ${h}`);
        });
        if (JSON.stringify(track.chords) !== JSON.stringify(old.chords)) {
            lines.push(`    Chords Used was: ${old.chords.join(', ')}\n    Chords Used now: ${track.chords.join(', ')}`);
        }
        const lost = old.anomalies.filter(a => !track.anomalies.includes(a));
        const gained = track.anomalies.filter(a => !old.anomalies.includes(a));
        for (const a of lost) lines.push(`    anomaly gone: ${a}`);
        for (const a of gained) lines.push(`    anomaly new: ${a}`);
        if (lines.length > 0) {
            tracksChanged++;
            console.log(`\n=== ${song}, track ${name}`);
            for (const line of lines) console.log(line);
        }
    }
}
for (const song of Object.keys(record.songs)) if (!current[song]) gone.push(song);

console.log(`\n${changed} of ${measures} measure headings changed, in ${tracksChanged} tracks.`);
if (added.length) console.log(`New songs, not in the record: ${added.join('; ')}`);
if (gone.length) console.log(`In the record but not found now: ${gone.join('; ')}`);
process.exit(changed > 0 || tracksChanged > 0 ? 1 : 0);

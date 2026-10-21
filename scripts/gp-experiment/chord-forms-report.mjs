// What the chord form rules of docs/chord-forms-in-scores.md make of real files, before the app
// says any of it. Reads every Guitar Pro file under a folder and its subfolders.
//
// Run: node scripts/gp-experiment/chord-forms-report.mjs <dir> [--reach N] [--share X]
//          [--return next|string|fretted|compare] [--guitars]
//      node scripts/gp-experiment/chord-forms-report.mjs <dir> --preview <part of a file name> --track N [--bars A-B]
//
// The first form gives counts per track: how much of it is held, why spans are not, how two
// possible forms were decided, how printed symbols compare, and Chords Used before and after.
// The second prints the heading each measure would get. The files are licensed to one person, so
// the output is for reading here and is not to be committed.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import * as alphaTab from '@coderline/alphatab';
import { trackEvents, findChordForms } from '../../src/shared/chordForms.mjs';
import { extractScoreMetadata } from '../../src/shared/scoreMetadata.mjs';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const dir = args[0];
const settings = {};
if (option('--reach')) settings.reach = Number(option('--reach'));
if (option('--share')) settings.maxExceptionShare = Number(option('--share'));
if (option('--return')) settings.returnRule = option('--return');
const preview = option('--preview');

const root = path.join(import.meta.dirname, '..', '..');
const library = JSON.parse(fs.readFileSync(path.join(root, 'src', 'assets', 'chords', 'chord-library.json'), 'utf8'));

function* files(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
        const full = path.join(folder, entry.name);
        if (entry.isDirectory()) yield* files(full);
        else if (/\.gp\d?x?$/i.test(entry.name)) yield full;
    }
}

const tally = (map, key, by = 1) => map.set(key, (map.get(key) ?? 0) + by);
const show = map => [...map].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || 'none';

function trackForms(score, trackIndex) {
    const track = score.tracks[trackIndex];
    const staff = track.staves[0];
    if (!staff || !staff.isStringed || track.isPercussion || !staff.tuning?.length) return null;
    // General MIDI 24 to 31 are the guitars; everything else on a string staff (voice, piano,
    // organ, bass) is left out when only guitars are asked for.
    const program = track.playbackInfo?.program;
    if (args.includes('--guitars') && !(program >= 24 && program <= 31)) return null;
    const measures = trackEvents(staff, score.masterBars);
    if (!measures.some(m => m.events.length > 0)) return null;
    return { track, measures, result: findChordForms(measures, { library, ...settings }) };
}

if (preview) {
    const file = [...files(dir)].find(f => path.basename(f).toLowerCase().includes(preview.toLowerCase()));
    if (!file) throw new Error(`no file matching ${preview}`);
    const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(fs.readFileSync(file)));
    const forms = trackForms(score, Number(option('--track') ?? 1) - 1);
    const [first, last] = (option('--bars') ?? `1-${forms.measures.length}`).split('-').map(Number);
    console.log(`${path.basename(file)}, track ${forms.track.name}`);
    for (const measure of forms.result.measures.slice(first - 1, last)) {
        const unheld = measure.runs.filter(run => run.span === null)
            .map(run => `no form ${run.start}-${run.end}`).join('; ');
        const symbols = measure.symbols.map(s => `${s.name}@${s.beat}:${s.kind}`).join(' ');
        console.log(`Measure ${measure.number}, ${measure.heading || '(nothing held)'}` +
            (unheld ? `   [${unheld}]` : '') + (symbols ? `   {${symbols}}` : ''));
    }
    process.exit(0);
}

const totals = { tracks: 0, measures: 0, sounding: 0, held: 0, fully: 0, carried: 0, exceptions: 0, slurGroups: 0, aligned: 0 };
const totalReasons = new Map(), totalDecided = new Map(), totalKinds = new Map(), totalReach = new Map();
const seen = new Map();

for (const file of files(dir)) {
    const bytes = fs.readFileSync(file);
    const hash = crypto.createHash('sha1').update(bytes).digest('hex').slice(0, 10);
    const relative = path.relative(dir, file);
    console.log(`\n=== ${relative}`);
    if (seen.has(hash)) { console.log(`  identical to ${seen.get(hash)}; skipped`); continue; }
    seen.set(hash, relative);

    let score;
    try { score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(bytes)); }
    catch (error) { console.log(`  could not read: ${error.message}`); continue; }
    const metadata = extractScoreMetadata(score);

    score.tracks.forEach((track, index) => {
        const forms = trackForms(score, index);
        if (!forms) return;
        const { result, measures } = forms;
        totals.tracks++;

        const sounding = result.measures.filter((_, m) => measures[m].events.length > 0);
        const held = sounding.filter(m => m.runs.some(run => run.span !== null));
        const fully = sounding.filter(m => m.runs.every(run => run.span !== null));
        const carried = sounding.filter(m => m.runs[0]?.carried);
        const reasons = new Map(), decided = new Map(), kinds = new Map(), reach = new Map();
        let exceptions = 0, slurGroups = 0, fragments = 0;
        for (const span of result.spans) {
            if (!span.form) { tally(reasons, span.candidates[0].reason); continue; }
            tally(reasons, 'held');
            if (span.decidedBy) tally(decided, span.decidedBy);
            exceptions += span.form.exceptions.length;
            slurGroups += span.form.exceptions.filter(group => group.length > 1).length;
            tally(reach, span.form.reach);
            if (span.members.length === 1 && span.form.chord.suffix === '5') fragments++;
        }
        for (const measure of result.measures) {
            for (const symbol of measure.symbols) {
                tally(kinds, symbol.relations ? `${symbol.kind} (${symbol.relations.join('+')})` : symbol.kind);
            }
        }

        const halfBeats = sounding.filter(m => /\d\.\d| during /.test(m.heading)).length;
        const gaps = sounding.filter(m => m.runs.some(run => run.span === null) && m.runs.some(run => run.span !== null)).length;
        totals.halfBeats = (totals.halfBeats ?? 0) + halfBeats;
        totals.gaps = (totals.gaps ?? 0) + gaps;
        console.log(`  track ${index + 1}, ${track.name} (program ${track.playbackInfo?.program}): ${measures.length} measures, ${sounding.length} sounding`);
        console.log(`    headings with a position or length between beats: ${halfBeats}; measures part held, part not: ${gaps}`);
        console.log(`    held in ${held.length} (${fully.length} throughout), carried into ${carried.length}; ${sounding.length - held.length} hold nothing`);
        console.log(`    spans: ${show(reasons)}; single power-chord fragments held: ${fragments}`);
        console.log(`    exceptions ${exceptions} (${slurGroups} slurred runs); aligned to the bar line ${result.aligned}`);
        console.log(`    two possible forms, decided by: ${show(decided)}`);
        console.log(`    reach of held forms: ${show(reach)}`);
        if (kinds.size > 0) console.log(`    printed symbols: ${show(kinds)}`);
        for (const anomaly of result.anomalies.slice(0, 8)) {
            console.log(`      anomaly at measure ${anomaly.measure}: prints ${anomaly.symbol}, ` +
                (anomaly.held ? `holds ${anomaly.held}` : 'melody clashes'));
        }
        if (result.anomalies.length > 8) console.log(`      ... ${result.anomalies.length - 8} more anomalies`);

        const before = (metadata.tracks[index]?.chords ?? []).slice(0, 8).map(c => `${c.name} ${c.beats}`).join(', ');
        const after = result.chords.slice(0, 8).map(c => `${c.name} ${c.beats}${c.fingering ? ` [${c.fingering}]` : ' (unheld)'}`).join(', ');
        console.log(`    Chords Used now:   ${before || 'none'}`);
        console.log(`    Chords Used forms: ${after || 'none'}`);

        Object.assign(totals, {
            measures: totals.measures + measures.length, sounding: totals.sounding + sounding.length,
            held: totals.held + held.length, fully: totals.fully + fully.length, carried: totals.carried + carried.length,
            exceptions: totals.exceptions + exceptions, slurGroups: totals.slurGroups + slurGroups, aligned: totals.aligned + result.aligned
        });
        for (const [from, to] of [[reasons, totalReasons], [decided, totalDecided], [kinds, totalKinds], [reach, totalReach]]) {
            for (const [k, v] of from) tally(to, k, v);
        }
    });
}

console.log('\n=== All files');
console.log(`  settings: ${JSON.stringify(settings)} (defaults otherwise)`);
console.log(`  ${totals.tracks} tracks, ${totals.sounding} sounding measures: held in ${totals.held} (${totals.fully} throughout), carried into ${totals.carried}`);
console.log(`  headings with a position or length between beats: ${totals.halfBeats ?? 0}; measures part held, part not: ${totals.gaps ?? 0}`);
console.log(`  spans: ${show(totalReasons)}`);
console.log(`  exceptions ${totals.exceptions} (${totals.slurGroups} slurred runs); aligned ${totals.aligned}`);
console.log(`  two possible forms, decided by: ${show(totalDecided)}`);
console.log(`  reach of held forms: ${show(totalReach)}`);
console.log(`  printed symbols: ${show(totalKinds)}`);

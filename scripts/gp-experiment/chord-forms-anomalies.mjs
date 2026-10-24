// Every anomaly on the guitar tracks of every Guitar Pro file under a folder, with what is under
// it: the printed chord's stretch up to the next printed chord, each beat's strings, frets and
// notes, the forms the app found there, and how much of the stretch's sounding time is in the
// printed chord's tones. For deciding whether the file or the form finder is wrong. See
// docs/chord-forms-workflow.md.
//
// Run: node scripts/gp-experiment/chord-forms-anomalies.mjs <dir> [--file <part of a file name>] [--off]
//      node scripts/gp-experiment/chord-forms-anomalies.mjs <dir> --diff [--file <part of a file name>]
//
// --off lists the anomalies with `trustPrinted` off, as before 2026-10-24. --diff lists every
// guitar measure whose heading it changes, off then on, and the anomalies it ends and makes.
//
// The output describes the songs beat by beat, so it is for reading here and is not committed.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import * as alphaTab from '@coderline/alphatab';
import { trackEvents, findChordForms, fretsKey, parseChordSymbol } from '../../src/shared/chordForms.mjs';
import { PITCH_CLASSES } from '../../src/shared/musicTheory.mjs';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const dir = args[0];
const only = option('--file')?.toLowerCase();
const trust = !args.includes('--off') && !args.includes('--diff');
const diff = args.includes('--diff');

function* files(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const full = path.join(folder, entry.name);
        if (entry.isDirectory()) yield* files(full);
        else if (/\.gp\d?x?$/i.test(entry.name)) yield full;
    }
}

const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const pc = midi => ((midi % 12) + 12) % 12;
const seen = new Set();
let total = 0, changed = 0, gone = 0, made = 0, tracks = 0;

for (const file of files(dir)) {
    if (only && !path.basename(file).toLowerCase().includes(only)) continue;
    const bytes = fs.readFileSync(file);
    const hash = crypto.createHash('sha1').update(bytes).digest('hex');
    if (seen.has(hash)) continue;
    seen.add(hash);
    const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(bytes));
    score.tracks.forEach((track, t) => {
        const staff = track.staves[0];
        const program = track.playbackInfo?.program ?? -1;
        if (!staff || !staff.isStringed || track.isPercussion || !(program >= 24 && program <= 31)) return;
        const measures = trackEvents(staff, score.masterBars);
        const result = findChordForms(measures, { trustPrinted: trust });
        if (diff) {
            const on = findChordForms(measures, { trustPrinted: true });
            const lines = [];
            result.measures.forEach((measure, m) => {
                if (measure.heading === on.measures[m].heading) return;
                lines.push(`  Measure ${m + 1}: ${measure.heading || '(none)'}  ->  ${on.measures[m].heading || '(none)'}`);
                changed++;
            });
            const key = a => `${a.measure}@${a.beat} ${a.symbol}`;
            const before = new Set(result.anomalies.map(key)), after = new Set(on.anomalies.map(key));
            for (const a of before) if (!after.has(a)) { lines.push(`  anomaly gone: ${a}`); gone++; }
            for (const a of after) if (!before.has(a)) { lines.push(`  anomaly new: ${a}`); made++; }
            if (lines.length > 0) { console.log(`\n=== ${path.relative(dir, file)}, track ${t + 1} ${track.name}`); for (const line of lines) console.log(line); tracks++; }
            return;
        }
        if (result.anomalies.length === 0) return;

        const printed = measures.flatMap((measure, m) => measure.symbols.map(symbol => ({ ...symbol, m })));
        const owner = new Map();
        result.spans.forEach(span => { for (const member of span.members) owner.set(member, span); });
        const indexOf = new Map(result.events.map((event, index) => [event, index]));

        for (const anomaly of result.anomalies) {
            total++;
            const m = anomaly.measure - 1;
            const i = printed.findIndex(symbol => symbol.m === m && Math.abs(symbol.beat - anomaly.beat) < 1e-6);
            const next = printed[i + 1];
            const chord = parseChordSymbol(anomaly.symbol);
            const inStretch = event => (event.measure > m || (event.measure === m && event.beat >= anomaly.beat - 1e-6))
                && (!next || event.measure < next.m || (event.measure === next.m && event.beat < next.beat - 1e-6));
            const stretch = result.events.filter(inStretch);
            let time = 0, inChord = 0;
            const heard = new Map();
            for (const event of stretch) {
                for (const note of event.notes) {
                    time += event.length;
                    if (chord?.pcs.has(pc(note.midi))) inChord += event.length;
                    heard.set(pc(note.midi), (heard.get(pc(note.midi)) ?? 0) + event.length);
                }
            }
            const heading = result.measures[m].heading;
            console.log(`\n=== ${path.relative(dir, file)}, track ${t + 1} ${track.name}`);
            console.log(`Measure ${anomaly.measure}${anomaly.beat > 1 ? ` beat ${anomaly.beat}` : ''}: prints ${anomaly.symbol}, ` +
                (anomaly.held ? `holds ${anomaly.held}` : 'clashes') + `. Heading: ${heading || '(none)'}`);
            console.log(`  stretch to ${next ? `measure ${next.m + 1} beat ${next.beat} (${next.name})` : 'the end'}; ` +
                `${chord ? `${Math.round(100 * inChord / (time || 1))}% of note time in ${anomaly.symbol}'s tones` : 'symbol not read'}`);
            console.log(`  heard: ${[...heard].sort((a, b) => b[1] - a[1]).map(([p, d]) => `${NAMES[p]}${chord?.pcs.has(p) ? '' : '*'} ${Number(d.toFixed(2))}`).join(', ')}`);
            const spans = [...new Set(stretch.map(event => owner.get(indexOf.get(event))).filter(Boolean))];
            for (const span of spans) {
                const first = result.events[span.members[0]], last = result.events[span.members[span.members.length - 1]];
                console.log(`  span m${first.measure + 1} b${first.beat} to m${last.measure + 1} b${last.beat}: ` +
                    (span.form ? `${span.form.chord.name} [${fretsKey(span.form.frets)}], ${span.form.exceptions.length} exceptions` : 'no form') +
                    (span.whole ? ', held whole' : '') + (span.decidedBy ? `, decided by ${span.decidedBy}` : ''));
            }
            let shown = 0;
            for (const event of stretch) {
                if (shown++ >= 24) { console.log('  ...'); break; }
                console.log(`    m${event.measure + 1} ${String(Number(event.beat.toFixed(3))).padEnd(6)} ${event.notes.map(n => `${n.string}:${n.fret} ${NAMES[pc(n.midi)]}`).join(' + ')}`);
            }
        }
    });
}
if (diff) console.log(`\n${changed} headings changed in ${tracks} tracks; ${gone} anomalies ended, ${made} made.`);
else console.log(`\n${total} anomalies.`);

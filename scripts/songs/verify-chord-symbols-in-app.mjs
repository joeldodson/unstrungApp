// Checks printed chords as the app shows them. See docs/chord-forms-in-scores.md.
//
// For any song: every measure heading and every Chord Symbols region the app shows matches the
// metadata built here from the same file, no Anomalies region is left, and no beat is named as a
// power chord.
//
// For musicfiles/Grateful Dead-Ripple-12-20-2025.gp, the default, also the case chord forms
// started with: measure 2 of the lead track used to call open strings 3 and 4 "G5/D". Its beats,
// headings and Chord Symbols are checked too.
//
// Run: node scripts/songs/verify-chord-symbols-in-app.mjs [song file]

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { launchApp, openSongFile, APP_DIR, VISIBLE_PANEL } from '../lib/app-ui.mjs';
import { extractScoreMetadata } from '../../src/shared/scoreMetadata.mjs';

const ripple = path.join(APP_DIR, 'musicfiles', 'Grateful Dead-Ripple-12-20-2025.gp');
const song = process.argv[2] ?? ripple;
const bytes = new Uint8Array(await readFile(song));
const require = createRequire(path.join(APP_DIR, 'package.json'));
const alphaTab = require('@coderline/alphatab');
const meta = extractScoreMetadata(alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes));

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};

const { app, page, close } = await launchApp();
await openSongFile(app, path.basename(song), bytes);
await page.waitForSelector(`${VISIBLE_PANEL} h3`, { timeout: 15000 });

// Each track's regions, in order, with their contents once opened.
const tracks = await page.evaluate(async panelSelector => {
    const panel = document.querySelector(panelSelector);
    const result = [];
    let current = null;
    for (const node of panel.querySelectorAll('h3, details:not(details details)')) {
        if (node.tagName === 'H3') { current = { name: node.textContent, regions: [] }; result.push(current); continue; }
        const summary = node.querySelector(':scope > summary').textContent;
        node.open = true;
        for (let i = 0; i < 50 && node.children.length < 2; i++) await new Promise(r => setTimeout(r, 100));
        await new Promise(r => setTimeout(r, 200));
        current.regions.push({
            summary,
            text: node.querySelector(':scope > p')?.textContent ?? null,
            headings: [...node.querySelectorAll('h4')].map(h => ({
                text: h.textContent,
                beats: [...(h.nextElementSibling?.querySelectorAll('li') ?? [])].map(li => li.textContent)
            })),
            rows: [...node.querySelectorAll(':scope > ul > li')].map(li => ({
                summary: li.querySelector('summary')?.textContent ?? li.textContent,
                facts: [...li.querySelectorAll('details > ul > li')].map(x => x.textContent)
            }))
        });
    }
    return result;
}, VISIBLE_PANEL);

const region = (track, pattern) => track.regions.find(r => pattern.test(r.summary));

console.log(`=== ${path.basename(song)}: every track as the metadata says ===`);
meta.tracks.forEach((expected, t) => {
    const shown = tracks[t];
    const measures = region(shown, /^Measures/).headings;
    const headings = measures.map(h => h.text);
    const wanted = expected.measures.map((m, i) =>
        [`Measure ${i + 1}`, m.section, m.repeat, m.chords].filter(Boolean).join(' - '));
    const mismatch = wanted.findIndex((w, i) => w !== headings[i]);
    console.log(`  ${shown.name}: ${headings.length} measures, ${expected.measures.filter(m => m.chords).length} with a chord, ${expected.chords.length} chord symbols`);
    check('  every heading matches', mismatch === -1 && headings.length === wanted.length,
        mismatch === -1 ? '' : `measure ${mismatch + 1}: "${headings[mismatch]}", expected "${wanted[mismatch]}"`);
    check('  no heading says "holds"', !headings.some(h => /\bholds\b/.test(h)));
    check('  no Anomalies region', !region(shown, /^Anomalies/));
    const symbols = region(shown, /^Chord Symbols/);
    check('  Chord Symbols comes first of the regions', shown.regions[0]?.summary === `Chord Symbols - ${expected.chords.length}`, shown.regions[0]?.summary);
    check('  it lists the printed chords in order', symbols.rows.map(r => r.summary).join(' ') === expected.chords.map(c => c.name).join(' '),
        symbols.rows.map(r => r.summary).join(' '));
    if (expected.chords.length === 0) check('  an empty list says the file prints none', /prints no chord symbols/.test(symbols.text ?? ''), symbols.text);
    // A chord with a diagram in the file shows that fingering and not the library's shape.
    expected.chords.forEach((chord, i) => {
        if (chord.fingerings.length === 0) return;
        const facts = symbols.rows[i]?.facts ?? [];
        console.log(`    ${chord.name}: ${facts.join(' | ')}`);
        check(`  ${chord.name} gives the file's fingering, not the library's`,
            facts.filter(f => f.startsWith('Fingering in the file')).length === chord.fingerings.length
            && !facts.some(f => /^String \d: /.test(f)));
    });
    const power = measures.flatMap(m => m.beats).filter(b => /^[^,]+, [A-G][#b]?5(\/|,)/.test(b));
    check('  no beat is named as a power chord', power.length === 0, power[0]);
});

if (song !== ripple) {
    console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
    await close();
    process.exit(failures === 0 ? 0 : 1);
}

const lead = tracks.find(t => /Acoustic Lead/.test(t.name));
const capo = tracks.find(t => /Capo/.test(t.name));

console.log('\n=== Headings ===');
const leadMeasures = region(lead, /^Measures/).headings;
const capoMeasures = region(capo, /^Measures/).headings;
for (const m of capoMeasures.slice(0, 4)) console.log(`  ${m.text}`);
check('the lead prints no chord over its first measure, so names none', leadMeasures[0].text === 'Measure 1 - Intro', leadMeasures[0].text);
check('a printed chord at beat 1 is "chord C"', capoMeasures[1].text === 'Measure 2 - chord C', capoMeasures[1].text);
check('a measure printing none continues it', capoMeasures[2].text === 'Measure 3 - continues C', capoMeasures[2].text);

console.log('\n=== Beats ===');
const second = leadMeasures[1].beats;
for (const beat of second) console.log(`  ${beat}`);
check('open strings 3 and 4 are listed, not called G5/D', second.includes('eighth note, string 3, open; string 4, open'), second[2]);
check('the full chord still names itself', second.includes('quarter note, G/B, strings 1 through 5'), second[1]);

console.log('\n=== Chord Symbols ===');
const capoChords = region(capo, /^Chord Symbols/).rows;
console.log(`  ${capoChords.map(r => r.summary).join(' | ')}`);
check('the capo track lists what it prints, in order', capoChords.map(r => r.summary).join(' ') === 'C F G Dm G7');
console.log(`  C: ${capoChords[0]?.facts.join(' | ')}`);
check('each says how often it is printed', capoChords[0]?.facts.at(-1) === 'Printed 15 times in this track', capoChords[0]?.facts.at(-1));

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
await close();
process.exit(failures === 0 ? 0 : 1);

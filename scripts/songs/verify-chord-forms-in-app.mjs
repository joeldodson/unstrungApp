// Checks chord forms as the app shows them. See docs/chord-forms-in-scores.md.
//
// For any song: every measure heading and every Anomalies region the app shows matches the
// metadata built here from the same file, the Anomalies region sits between Chords Used and the
// measures where a track has one and is absent where it has none, a measure naming a form gives
// no chord symbol phrase as well, and bass tracks name no forms.
//
// For musicfiles/Grateful Dead-Ripple-12-20-2025.gp, the default, also the case this started
// with: the lead track's first measures pick through a G with one note off it, and measure 2 used
// to call open strings 3 and 4 "G5/D". Its beats and Chords Used are checked too.
//
// Run: node scripts/songs/verify-chord-forms-in-app.mjs [song file]

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
    const headings = region(shown, /^Measures/).headings.map(h => h.text);
    const wanted = expected.measures.map((m, i) =>
        [`Measure ${i + 1}`, m.section, m.repeat, m.forms, m.chordSymbols].filter(Boolean).join(' - '));
    const mismatch = wanted.findIndex((w, i) => w !== headings[i]);
    const named = expected.measures.filter(m => m.forms).length;
    console.log(`  ${shown.name}: ${headings.length} measures, ${named} naming a form, ${expected.anomalies.length} anomalies`);
    check(`  every heading matches`, mismatch === -1 && headings.length === wanted.length,
        mismatch === -1 ? '' : `measure ${mismatch + 1}: "${headings[mismatch]}", expected "${wanted[mismatch]}"`);
    check(`  no heading names a form and a chord symbol both`, !headings.some(h => /(holds|continues) /.test(h) && /chord symbol/.test(h)));
    const anomalies = region(shown, /^Anomalies/);
    if (expected.anomalies.length === 0) {
        check('  no Anomalies region, having none', !anomalies);
    } else {
        check('  the Anomalies region comes between Chords Used and Measures',
            shown.regions.map(r => r.summary.split(' - ')[0]).join(',').startsWith('Chords Used,Anomalies,Measures'),
            shown.regions.map(r => r.summary).join(' | '));
        check('  it lists each one', anomalies?.summary === `Anomalies - ${expected.anomalies.length}`
            && anomalies.rows.every((row, i) => row.summary.startsWith(`Measure ${expected.anomalies[i].measure}: the file prints ${expected.anomalies[i].symbol}, `)),
            anomalies?.rows.slice(0, 2).map(r => r.summary).join(' | '));
    }
    if (/Bass/i.test(expected.instrument)) check('  a bass names no forms', named === 0);
});

if (song !== ripple) {
    console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
    await close();
    process.exit(failures === 0 ? 0 : 1);
}

const lead = tracks.find(t => /Acoustic Lead/.test(t.name));

console.log('\n=== The lead track\'s measure headings ===');
const leadMeasures = region(lead, /^Measures/).headings;
for (const m of leadMeasures.slice(0, 4)) console.log(`  ${m.text}`);
check('measure 1 holds G with one exception', leadMeasures[0].text === 'Measure 1 - Intro - holds G at beat 2, one exception', leadMeasures[0].text);
check('measure 2 continues it', leadMeasures[1].text === 'Measure 2 - continues G', leadMeasures[1].text);
const last = leadMeasures[leadMeasures.length - 1];
check('the last measure gives the printed G once, not as a chord symbol too', last.text === `Measure ${leadMeasures.length} - holds G`, last.text);

console.log('\n=== Beats inside a named form ===');
const second = leadMeasures[1].beats;
for (const beat of second) console.log(`  ${beat}`);
check('open strings 3 and 4 are listed, not called G5/D', second.includes('eighth note, string 3, open; string 4, open'), second[2]);
check('no beat of the measure is called G5', !second.some(b => /G5/.test(b)));
check('the full chord still names itself', second.includes('quarter note, G/B, strings 1 through 5'), second[1]);

console.log('\n=== Chords Used ===');
const leadChords = region(lead, /^Chords Used/).rows;
console.log(`  ${leadChords.map(r => r.summary).join(' | ')}`);
check('no G5 or C5 among the lead\'s chords', !leadChords.some(r => /^(G5|C5)$/.test(r.summary)));
const g = leadChords.find(r => r.summary === 'G');
console.log(`  G: ${g?.facts.slice(0, 3).join(' | ')}`);
check('G comes first', leadChords[0]?.summary === 'G', leadChords[0]?.summary);
check('the fingering the track plays comes second, after the name and quality',
    /^Played in this track: string 6, fret 3; /.test(g?.facts[1] ?? ''), g?.facts[1]);

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
await close();
process.exit(failures === 0 ? 0 : 1);

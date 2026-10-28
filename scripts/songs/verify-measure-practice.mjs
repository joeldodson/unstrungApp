// Checks a track's Measures and Playback region and practising measure by measure, as the app
// shows them. See docs/measure-practice.md.
//
// Drives the Electron app with musicfiles/Grateful Dead-Ripple-12-20-2025.gp, or the song given:
// the song's headings, Chord Symbols in the track's details, the region's headings and buttons, the
// settings, the measure buttons, the n, a, l and ? keys, the Section dropdown, and the Playback Keys dialog's
// link to Features. Judged from the DOM, ARIA state and the announcement lines, never pixels.
//
// Run: node scripts/songs/verify-measure-practice.mjs [song file]

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { launchApp, openSongFile, currentItemName, APP_DIR, VISIBLE_PANEL } from '../lib/app-ui.mjs';
import { extractScoreMetadata } from '../../src/shared/scoreMetadata.mjs';

const song = process.argv[2] ?? path.join(APP_DIR, 'musicfiles', 'Grateful Dead-Ripple-12-20-2025.gp');
const bytes = new Uint8Array(await readFile(song));
const require = createRequire(path.join(APP_DIR, 'package.json'));
const alphaTab = require('@coderline/alphatab');
const meta = extractScoreMetadata(alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes));

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

const { app, page, close } = await launchApp();
await openSongFile(app, path.basename(song), bytes);
await page.waitForSelector(`${VISIBLE_PANEL} h2`, { timeout: 15000 });
await pause(500); // the chord library arrives after the panel

console.log(`=== ${path.basename(song)}: track details ===`);
const songHeadings = await page.evaluate(panelSelector =>
    [...document.querySelector(panelSelector).querySelectorAll('h1, h2, h3, h4, h5, h6')]
        .map(h => `${h.tagName} ${h.textContent}`), VISIBLE_PANEL);
check('Song Summary, then each track, all h2; no Tracks heading',
    JSON.stringify(songHeadings) === JSON.stringify(['H2 Song Summary', ...meta.tracks.map((t, i) => `H2 Track ${i + 1} - ${t.name}`)]),
    songHeadings.join(' | '));

const trackShapes = await page.evaluate(panelSelector => {
    const panel = document.querySelector(panelSelector);
    const rowText = li => li.querySelector(':scope > details > summary')?.textContent ?? li.textContent;
    return [...panel.querySelectorAll('h2')].filter(h => h.textContent.startsWith('Track ')).map(h2 => {
        const list = h2.nextElementSibling;
        const rows = [...list.querySelectorAll(':scope > li')];
        const chordRow = rows.find(li => rowText(li).startsWith('Chord Symbols'));
        const chordRegion = chordRow?.querySelector(':scope > details');
        const region = list.nextElementSibling;
        return {
            name: h2.textContent,
            rows: rows.map(rowText),
            chordRegion: chordRegion ? { open: chordRegion.open, onlyChild: chordRow.childNodes.length === 1 } : null,
            chords: [...(chordRegion?.querySelectorAll(':scope > ul > li summary') ?? [])].map(s => s.textContent),
            regionSummary: region?.tagName === 'DETAILS' ? region.querySelector(':scope > summary').textContent : null,
            otherRegions: [...panel.querySelectorAll('details:not(details details)')]
                .filter(d => !d.closest('li'))
                .map(d => d.querySelector(':scope > summary').textContent)
                .filter(text => /^(Chord Symbols|Measures -|Audio Track)/.test(text))
        };
    });
}, VISIBLE_PANEL);

meta.tracks.forEach((expected, t) => {
    const shown = trackShapes[t];
    console.log(`  ${shown.name}`);
    const wantedRow = expected.chords.length === 0
        ? 'Chord Symbols - none; the file prints no chord symbols over this part'
        : `Chord Symbols - ${expected.chords.length}`;
    check('  Chord Symbols is the last row of the details', shown.rows.at(-1) === wantedRow, shown.rows.at(-1));
    if (expected.chords.length > 0) {
        check('  Chord Symbols is a region of its own, collapsed', shown.chordRegion?.onlyChild && shown.chordRegion.open === false,
            JSON.stringify(shown.chordRegion));
    }
    check('  it lists the printed chords in order',
        shown.chords.join(' ') === expected.chords.map(c => c.name).join(' '), shown.chords.join(' '));
    const n = expected.measures.length;
    check('  then one region, Measures and Playback',
        shown.regionSummary === `Measures and Playback - ${n} measure${n === 1 ? '' : 's'}`, shown.regionSummary);
});
check('no Chord Symbols, Measures or Audio Track disclosures are left', trackShapes[0].otherRegions.length === 0,
    trackShapes[0].otherRegions.join(', '));

// The first track with notes and sections is the one practised on.
const trackIndex = meta.tracks.findIndex(track => track.measures.some(m => m.section)) >= 0
    ? meta.tracks.findIndex(track => track.measures.some(m => m.section)) : 0;
const track = meta.tracks[trackIndex];
const barCount = track.measures.length;
console.log(`\n=== The region of ${track.name}, ${barCount} measures ===`);

// Everything below acts on this region, through the page.
await page.evaluate(({ panelSelector, trackIndex }) => {
    const regions = document.querySelectorAll(`${panelSelector} details.track-region`);
    window.__region = regions[trackIndex];
    window.__region.open = true;
}, { panelSelector: VISIBLE_PANEL, trackIndex });
await pause(300);

const region = () => page.evaluate(() => {
    const r = window.__region;
    const text = selector => r.querySelector(selector)?.textContent ?? null;
    const byLabel = start => [...r.querySelectorAll('label')].find(l => l.textContent.startsWith(start));
    const control = start => document.getElementById(byLabel(start)?.htmlFor);
    const section = control('Section');
    return {
        headings: [...r.querySelectorAll('h1, h2, h3, h4, h5, h6')].map(h => `${h.tagName} ${h.textContent}`),
        keysNote: [...r.querySelectorAll('h3')].find(h => h.textContent === 'Playback Controls')?.nextElementSibling?.textContent ?? null,
        firstButtons: [...(r.querySelector('h4')?.nextElementSibling?.querySelectorAll('button') ?? [])].map(b => b.textContent),
        measureButtonCount: r.querySelectorAll('button[data-measure]').length,
        play: { text: r.querySelector('.audio-track button[aria-pressed]').textContent,
            pressed: r.querySelector('.audio-track button[aria-pressed]').getAttribute('aria-pressed') },
        summary: text('.audio-track details > summary'),
        first: control('First measure').value,
        last: control('Last measure').value,
        tempo: control('Tempo').value,
        repeat: control('Repeat').checked,
        countIn: control('Count in,').checked,
        eachPassHidden: control('Count in before every repeat').closest('p').hidden,
        section: section ? { value: section.value, text: section.selectedOptions[0].textContent,
            options: [...section.options].map(o => o.textContent) } : null,
        announce: r.querySelector('p[aria-live="polite"]:not([role])').textContent,
        status: r.querySelector('p[role="status"]').textContent,
        error: r.querySelector('p[role="alert"]').textContent,
        controls: [...r.querySelectorAll('.audio-track .button-row button')].map(b => b.textContent),
        controlRows: [...r.querySelectorAll('.audio-track .button-row')]
            .map(row => [...row.querySelectorAll('button')].map(b => b.textContent).join(', ')),
        tempoRowAfterTempo: r.querySelector('.audio-track p:has(input[type="number"]) + .button-row') !== null
    };
});
const clickInRegion = name => page.evaluate(name => {
    const button = [...window.__region.querySelectorAll('button')].find(b => b.textContent === name);
    if (!button) throw new Error(`No button "${name}".`);
    button.focus();
    button.click();
}, name);
const press = async key => { await page.keyboard.press(key); await pause(150); };
const waitPlaying = async () => {
    for (let i = 0; i < 100; i++) {
        if ((await region()).play.pressed === 'true') return true;
        await pause(100);
    }
    return false;
};

let r = await region();
const h4s = r.headings.filter(h => h.startsWith('H4'));
check('headings: Playback Settings, Playback Controls, Measures, all h3, then the measures, h4',
    r.headings[0] === 'H3 Playback Settings' && r.headings[1] === 'H3 Playback Controls' &&
    r.headings[2] === `H3 Measures - ${barCount}` && h4s.length === barCount && r.headings.length === barCount + 3,
    r.headings.slice(0, 4).join(' | '));
check('measure headings are h4 and read as before', h4s[0].startsWith('H4 Measure 1'), h4s[0]);
check('Playback Controls starts by saying how to reach the keys', r.keysNote === 'Type ? for keyboard commands.', r.keysNote);
check('each measure has Play and Add buttons naming it', r.measureButtonCount === barCount * 2 &&
    r.firstButtons.join(' | ') === 'Play measure 1 | Add measure 1 to selection', r.firstButtons.join(' | '));
check('Playback Controls: Play and Where Am I; the tempo; then the moves',
    r.controlRows.join(' / ') === 'Play, Where Am I / Slower, Faster, Default Tempo / ' +
    'Restart Selection, Previous Measure, Next Measure, Start of Measure', r.controlRows.join(' / '));
check('no tempo buttons after the Tempo field', !r.tempoRowAfterTempo);
check('no Create Track button, no printed key list', !r.controls.includes('Create Track') &&
    !r.headings.some(h => /Keyboard Control/.test(h)));
check('starts: whole song, count in on, repeat off', r.summary === 'Measures to Play - Entire Song' &&
    r.countIn && !r.repeat && r.eachPassHidden, `${r.summary}, count in ${r.countIn}, repeat ${r.repeat}`);
if (r.section) {
    console.log(`  sections: ${r.section.options.join(' | ')}`);
    check('Section dropdown starts at Entire Song', r.section.text === 'Entire Song');
}

console.log('\n=== Repeat ===');
await clickInRegion('Play'); // focus somewhere in the region first, for the keys
await waitPlaying();
await press('l');
r = await region();
check('l turns repeat on, shows Count in before every repeat, says so',
    r.repeat && !r.eachPassHidden && r.announce === 'Repeat on', `${r.repeat} ${r.eachPassHidden} "${r.announce}"`);

console.log('\n=== Practising ===');
await clickInRegion('Play measure 3');
check('Play measure 3 selects it alone', (await waitPlaying()) && (r = await region()).summary === 'Measures to Play - 3' &&
    r.first === '3' && r.last === '3', `${r.summary}, fields ${r.first}-${r.last}`);
if (r.section) check('the dropdown shows the measure itself', r.section.text === 'Measures 3', r.section.text);
await press('n');
r = await region();
check('n tries measure 4 alone, leaving the selection', r.summary === 'Measures to Play - 3; trying measure 4 on its own' &&
    r.announce === 'Measure 4 on its own' && r.first === '3' && r.last === '3', `${r.summary} "${r.announce}"`);
await press('n');
r = await region();
check('n again tries measure 5', r.summary.endsWith('trying measure 5 on its own'), r.summary);
await press('ArrowUp');
r = await region();
check('upArrow goes back to the selection without adding', r.summary === 'Measures to Play - 3', r.summary);
await press('n');
await press('a');
r = await region();
check('n then a adds measure 4: 3 to 4', r.summary === 'Measures to Play - 3 to 4' && r.announce === 'Measures 3 to 4' &&
    r.last === '4', `${r.summary} "${r.announce}"`);
await press('a');
r = await region();
check('a with nothing tried adds the measure after: 3 to 5', r.summary === 'Measures to Play - 3 to 5', r.summary);
await clickInRegion('Add measure 8 to selection');
r = await region();
check('Add measure 8 stretches it: 3 to 8', r.summary === 'Measures to Play - 3 to 8' && r.play.pressed === 'true', r.summary);
await clickInRegion('Add measure 1 to selection');
r = await region();
check('Add measure 1 stretches it back: 1 to 8', r.summary === 'Measures to Play - 1 to 8', r.summary);
await press('b');
r = await region();
check('b says where it is against the selection', /^Measure \d+ of measures 1 through 8, play \d+$/.test(r.announce), r.announce);

console.log('\n=== Tempo ===');
const songTempo = Number(r.tempo);
await press('s');
r = await region();
check('s is 5 slower and says so', Number(r.tempo) === songTempo - 5 && r.announce === `${songTempo - 5} BPM`, `${r.tempo} "${r.announce}"`);
await clickInRegion('Faster');
await clickInRegion('Faster');
r = await region();
check('Faster twice is 5 above the song', Number(r.tempo) === songTempo + 5, r.tempo);
await clickInRegion('Default Tempo');
r = await region();
check('Default Tempo goes back', Number(r.tempo) === songTempo && r.announce === `Default tempo, ${songTempo} BPM`, r.announce);
check('still playing through the tempo changes', r.play.pressed === 'true');

console.log('\n=== Fields and sections ===');
await page.evaluate(() => {
    const control = start => document.getElementById([...window.__region.querySelectorAll('label')]
        .find(l => l.textContent.startsWith(start)).htmlFor);
    control('First measure').value = '2';
    control('First measure').dispatchEvent(new Event('change'));
});
r = await region();
check('a field change stops and reports', r.summary === 'Measures to Play - 2 to 8' && r.play.pressed === 'false' &&
    r.status === 'Measures 2 to 8. Press Play.', `${r.summary} / ${r.status}`);
if (r.section) {
    const sections = track.measures.map((m, i) => ({ name: m.section, first: i + 1 })).filter(s => s.name);
    const pick = sections[0];
    const pickEnd = sections[1] ? sections[1].first - 1 : barCount;
    await page.evaluate(() => {
        const select = document.getElementById([...window.__region.querySelectorAll('label')]
            .find(l => l.textContent === 'Section').htmlFor);
        select.value = 'section-0';
        select.dispatchEvent(new Event('change'));
    });
    r = await region();
    const span = pick.first === pickEnd ? `${pick.first}` : `${pick.first} to ${pickEnd}`;
    check(`choosing ${pick.name} fills the fields`, r.first === String(pick.first) && r.last === String(pickEnd) &&
        r.summary === `Measures to Play - ${span}, ${pick.name}` && !r.section.options.some(o => o.startsWith('Measures ')),
        `${r.first}-${r.last} ${r.summary}`);
    await page.evaluate(() => {
        const select = document.getElementById([...window.__region.querySelectorAll('label')]
            .find(l => l.textContent === 'Section').htmlFor);
        select.value = 'all';
        select.dispatchEvent(new Event('change'));
    });
    r = await region();
    check('Entire Song selects everything', r.first === '1' && r.last === String(barCount) && r.summary === 'Measures to Play - Entire Song');
}

console.log('\n=== From the whole song ===');
await press('a');
r = await region();
check('a with nothing selected selects measure 1', r.summary === 'Measures to Play - 1' && r.announce === 'Measure 1', `${r.summary} "${r.announce}"`);
await press('n');
r = await region();
check('n tries measure 2', r.summary.endsWith('trying measure 2 on its own'), r.summary);
await clickInRegion('Restart Selection');
r = await region();
check('Restart Selection goes back to measure 1', r.summary === 'Measures to Play - 1', r.summary);

console.log('\n=== Shorter beat descriptions rebuild the song ===');
// The song's panel is built again, and the region is carried across with its measures redone, so a
// track being played keeps playing.
await clickInRegion('Play measure 4');
await waitPlaying();
const beforeBeats = await page.evaluate(() => [...window.__region.querySelectorAll('h4 + .button-row + ul')].map(ul => ul.textContent).join('|').length);
await page.evaluate(() => {
    const box = document.getElementById('settings-terse-beats-checkbox');
    box.checked = !box.checked;
    box.dispatchEvent(new Event('change'));
});
await pause(800);
const rebuilt = await page.evaluate(() => ({
    same: document.contains(window.__region),
    open: window.__region.open,
    measures: window.__region.querySelectorAll('h4').length,
    buttons: window.__region.querySelectorAll('button[data-measure]').length,
    lastBeat: [...window.__region.querySelectorAll('h4 + .button-row + ul')].map(ul => ul.textContent).join('|').length
}));
r = await region();
check('the region is the same one, still open and playing', rebuilt.same && rebuilt.open && r.play.pressed === 'true',
    `${rebuilt.same} ${rebuilt.open} ${r.play.pressed}`);
check('its measures were redone, buttons and all', rebuilt.measures === barCount && rebuilt.buttons === barCount * 2 &&
    rebuilt.lastBeat !== beforeBeats, `"${beforeBeats}" -> "${rebuilt.lastBeat}"`);
await clickInRegion('Play measure 2');
check('the new measure buttons work', (await region()).summary === 'Measures to Play - 2');
await page.evaluate(() => {
    const box = document.getElementById('settings-terse-beats-checkbox');
    box.checked = !box.checked;
    box.dispatchEvent(new Event('change'));
});
await pause(500);

console.log('\n=== Playback Keys dialog ===');
await clickInRegion('Play measure 2');
await press('Shift+Slash');
const dialog = await page.evaluate(() => {
    const d = document.getElementById('playback-keys-dialog');
    return { open: d.open, items: d.querySelectorAll('li').length, first: d.querySelector('li')?.textContent,
        link: d.querySelector('a')?.textContent, title: document.title };
});
check('? opens it, listing the keys', dialog.open && dialog.items === 14 && dialog.first === 'spaceBar: play and pause.',
    `${dialog.open} ${dialog.items} "${dialog.first}"`);
check('the window title names it', dialog.title.endsWith('Playback Keys dialog'), dialog.title);
await page.keyboard.press('Escape');
await pause(150);
check('escape closes it and focus goes back', await page.evaluate(() =>
    !document.getElementById('playback-keys-dialog').open && document.activeElement?.textContent === 'Play measure 2'));
await press('Shift+Slash');
await page.evaluate(() => document.querySelector('#playback-keys-dialog a').click());
await pause(500);
check('the Features link closes it and opens Features', await page.evaluate(() =>
    !document.getElementById('playback-keys-dialog').open) && /Features$/.test(await currentItemName(page)),
    await currentItemName(page));

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
await close();
process.exit(failures === 0 ? 0 : 1);

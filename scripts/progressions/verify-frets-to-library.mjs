// Verifies that Frets to Chord says where the chord library files a shape, and that View in Chord
// Library opens that entry with the shape's voicing showing, whatever the Difficulty filter was.
//
// The case that prompted it: 332010 sounds C with G in the bass and is filed as C/G voicing
// option 3, a common alternative. It used to say "This is a standard shape" beside "Difficulty:
// common alternative", and View opened C, with standard shapes only still hiding the voicing.
//
//   node scripts/progressions/verify-frets-to-library.mjs

import { launchApp, runMenuCommand } from '../lib/app-ui.mjs';

let failures = 0;
const check = (label, ok, detail = '') => {
    if (!ok) failures++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};

const { page, close } = await launchApp();

async function setLibraryLevel(level) {
    await runMenuCommand(page, 'chord-library');
    await page.waitForTimeout(1500);
    // The list is inside the collapsed Filtering Options section, so it is set as a change would.
    await page.evaluate(value => {
        const select = document.getElementById('chords-level-select');
        select.value = value;
        select.dispatchEvent(new Event('change'));
    }, level);
    await page.waitForTimeout(300);
}

async function enterFrets(frets) {
    await runMenuCommand(page, 'frets-to-chord');
    await page.waitForTimeout(500);
    for (const [index, fret] of frets.entries()) {
        await page.selectOption(`#frets-string-${6 - index}`, String(fret));
    }
    await page.waitForTimeout(300);
    return page.evaluate(() => [...document.querySelectorAll('#frets-result-list li')].map(li => li.textContent));
}

async function viewInLibrary() {
    await page.click('#frets-view-button');
    await page.waitForTimeout(1000);
    return page.evaluate(() => {
        const list = document.getElementById('chords-results-list');
        const name = box => box.labels?.[0]?.textContent.trim() ?? '';
        const rows = [...list.children].map(li => [...li.querySelectorAll('input[type="checkbox"]')]
            .map(box => `${box.checked ? '[x] ' : '[ ] '}${name(box)}`));
        return {
            search: document.getElementById('chords-search-input').value,
            level: document.getElementById('chords-level-select').value,
            status: document.getElementById('status').textContent,
            focused: (() => {
                const el = document.activeElement;
                return { id: el?.id ?? '', tag: el?.tagName ?? '', text: el?.labels?.[0]?.textContent.trim() ?? el?.textContent.trim() ?? '',
                    checked: el?.checked ?? null, inOpenDetails: !!el?.closest('details[open]') };
            })(),
            playback: [...document.querySelectorAll('#chords-playback-list > li')].map(li => li.textContent),
            rows
        };
    });
}

console.log('=== 332010 with standard shapes only ===');
await setLibraryLevel('canonical');
let rows = await enterFrets([3, 3, 2, 0, 1, 0]);

// Tab from string 1: the Identified Chord heading, then View in Chord Library.
await page.focus('#frets-string-1');
await page.keyboard.press('Tab');
const afterString1 = await page.evaluate(() => ({ id: document.activeElement.id, text: document.activeElement.textContent }));
await page.keyboard.press('Tab');
const afterHeading = await page.evaluate(() => document.activeElement.id);
check('tab from string 1 reaches the Identified Chord heading', afterString1.id === 'frets-result-heading',
    `${afterString1.id}: ${afterString1.text}`);
check('the heading reads the chord', afterString1.text === 'Identified Chord: C', afterString1.text);
check('the next tab reaches View in Chord Library', afterHeading === 'frets-view-button', afterHeading);
console.log(`  ${rows.slice(0, 4).join(' | ')}`);
check('it says where the library files the shape',
    rows.includes('This shape is in the chord library: C/G, voicing option 3.'));
check('it no longer calls a common alternative a standard shape',
    !rows.some(row => row.includes('This is a standard shape')));
check('the difficulty is still given', rows.includes('Difficulty: common alternative'));

let library = await viewInLibrary();
const cg = library.rows.find(row => row[0]?.includes('C/G')) ?? [];
console.log(`  search "${library.search}", difficulty ${library.level}`);
console.log(`  ${cg.join(' | ')}`);
console.log(`  status: ${library.status}`);
console.log(`  playback: ${library.playback.join(' | ')}`);
check('View opens C/G, where the shape is filed', library.search === 'C/G', library.search);
check('the filter widens to common alternatives, no further', library.level === 'common', library.level);
check('voicing option 3 is showing',
    cg.some(label => label.includes('Voicing option 3:')), `${cg.length - 1} voicings`);
check('C/G is checked', cg[0]?.startsWith('[x]'), cg[0]);
check('voicing option 3, the shape entered, is the one voicing checked',
    cg.filter(label => label.startsWith('[x] Voicing')).length === 1 &&
    cg.some(label => label.startsWith('[x] Voicing option 3:')));
check('the Playback list has that voicing alone',
    library.playback.length === 1 && /voicing option 3$/.test(library.playback[0]), library.playback.join(' | '));
check('the status line states the search', library.status === 'Chord Library: 1 chord matching "C/G".', library.status);
console.log(`  focus: ${library.focused.tag} "${library.focused.text}" checked=${library.focused.checked}`);
check('focus lands on voicing option 3, checked',
    library.focused.text.startsWith('Voicing option 3:') && library.focused.checked === true, library.focused.text);
check('its voicing options are expanded', library.focused.inOpenDetails);

// Moving on from there must not swap in the default voicing.
await page.keyboard.press('Tab');
await page.waitForTimeout(300);
library = await page.evaluate(() => [...document.querySelectorAll('#chords-playback-list > li')].map(li => li.textContent));
check('moving on keeps voicing option 3', library.length === 1 && /voicing option 3$/.test(library[0]),
    library.join(' | '));

console.log('\n=== x32010 with standard shapes only ===');
await setLibraryLevel('canonical');
rows = await enterFrets([-1, 3, 2, 0, 1, 0]);
check('a standard shape is placed the same way',
    rows.includes('This shape is in the chord library: C, voicing option 1.'), rows.slice(0, 4).join(' | '));
library = await viewInLibrary();
check('View opens C', library.search === 'C', library.search);
check('the filter is left as it was when the shape already shows', library.level === 'canonical', library.level);
check('focus lands on voicing option 1, checked',
    library.focused.text.startsWith('Voicing option 1:') && library.focused.checked === true, library.focused.text);

console.log('\n=== A shape the library does not have ===');
// 3x2010, C over G. Was 3x2013 until 2026-11-02, when that shape joined the library as C/G.
rows = await enterFrets([3, -1, 2, 0, 1, 0]);
console.log(`  ${rows.slice(0, 4).join(' | ')}`);
library = await viewInLibrary();
console.log(`  focus: ${library.focused.tag} "${library.focused.text}"; status: ${library.status}`);
check('focus lands on the Search Results heading', library.focused.id === 'chords-results-heading', library.focused.id);
check('a default voicing is queued, as leaving the search field would', library.playback.length === 1,
    library.playback.join(' | '));

await close();
console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);

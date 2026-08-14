// The Chord Library's Playback section.
//
// Searching "C" gives dozens of results, and the play button sat past all of them with the queue
// recited into a live region at the very end of the document. A heading gives one jump to the
// button, and the queue is a plain list ahead of it that can be read at leisure.

const APP_DIR = `${import.meta.dirname}/../..`.replace(/\\/g, '/');
const { _electron } = await import(`file:///${APP_DIR}/node_modules/playwright-core/index.mjs`);

let failures = 0;
const check = (label, ok, detail = '') => {
    if (!ok) failures++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};

const app = await _electron.launch({ args: ['.'], cwd: APP_DIR });
const page = await app.firstWindow();
await page.waitForLoadState('domcontentloaded');
await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.send('chords:open'));
await page.waitForTimeout(3000);

const read = () => page.evaluate(() => {
    const panel = [...document.querySelectorAll('[role="tabpanel"]')].find(p => !p.hidden);
    const list = panel.querySelector('#chords-playback-list');
    return {
        headings: [...panel.querySelectorAll('h2, h3')].map(h => h.textContent),
        items: [...list.querySelectorAll('li')].map(li => li.textContent),
        bullets: getComputedStyle(list).listStyleType,
        results: panel.querySelectorAll('#chords-results-list > li').length,
        status: panel.querySelector('#chords-status').textContent,
        // Document order: the list must come before the button, and the button after the heading.
        listBeforeButton: Boolean(list.compareDocumentPosition(
            panel.querySelector('#chords-play-button')) & Node.DOCUMENT_POSITION_FOLLOWING),
        headingBeforeList: Boolean(panel.querySelector('#chords-playback-heading')
            .compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING)
    };
});

console.log('=== The Playback section exists and is in the right place ===');
let state = await read();
console.log(`  headings: ${state.headings.join(' | ')}`);
check('a Playback heading follows the search results',
    state.headings.includes('Playback'), state.headings.join(' | '));
check('the heading comes before the list', state.headingBeforeList);
check('the list comes before the play button', state.listBeforeButton);
check('the list carries no bullets', state.bullets === 'none', state.bullets);

console.log('\n=== With a search that returns many results ===');
await page.evaluate(() => {
    const input = document.getElementById('chords-search-input');
    input.focus();
    input.value = 'C';
    input.dispatchEvent(new Event('input'));
});
await page.waitForTimeout(500);
await page.evaluate(() => {
    document.getElementById('chords-search-input').blur();
    document.getElementById('chords-level-select').focus();
});
await page.waitForTimeout(700);

state = await read();
console.log(`  ${state.results} results, playback list: ${state.items.join(' | ')}`);
// Twenty at the default difficulty filter, and 122 with it widened. Either way it is a long way
// to travel to reach a button.
check('there really are many results to jump past', state.results >= 15, `${state.results}`);
check('the queued chord is listed', state.items.length >= 1 && /^1\. C/.test(state.items[0]),
    state.items.join(' | '));

console.log('\n=== Ticking more chords adds them, in play order ===');
const added = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll('#chords-results-list > li > input[type="checkbox"]')];
    // Two more, from further down the results.
    for (const box of boxes.slice(3, 5)) {
        box.checked = true;
        box.dispatchEvent(new Event('change'));
    }
    return boxes.length;
});
await page.waitForTimeout(400);
state = await read();
console.log(`  ${added} tickable rows, list now: ${state.items.join(' | ')}`);
check('all three are listed', state.items.length === 3, state.items.join(' | '));
check('they are numbered in play order',
    state.items.every((text, i) => text.startsWith(`${i + 1}. `)), state.items.join(' | '));
check('each names its voicing option',
    state.items.every(text => /voicing option \d+$/.test(text)), state.items.join(' | '));

console.log('\n=== Pressing Play no longer recites the queue ===');
await page.evaluate(() => document.getElementById('chords-play-button').click());
await page.waitForTimeout(800);
state = await read();
console.log(`  status: "${state.status}"`);
check('the live region says what is happening, not the whole list',
    /^Playing 3 selections in turn\.$/.test(state.status), state.status);

console.log('\n=== Clearing empties the list rather than leaving it stale ===');
await page.evaluate(() => document.getElementById('chords-clear-button').click());
await page.waitForTimeout(500);
state = await read();
console.log(`  list now: ${state.items.join(' | ')}`);
check('the list says nothing is selected',
    state.items.length === 1 && /Nothing selected/.test(state.items[0]), state.items.join(' | '));

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
await app.close();
process.exit(failures === 0 ? 0 : 1);

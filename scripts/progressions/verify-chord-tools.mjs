// Verifies the two chord tools behave when returned to.
//
//   1. Frets to Chord opens on a clean fretboard, whatever was entered last time.
//   2. The Chord Library status line follows the search rather than whatever opened the library.
//
// Both are about a second visit, so both are driven by actually leaving and coming back.

const APP_DIR = `${import.meta.dirname}/../..`.replace(/\\/g, '/');
const { _electron } = await import(`file:///${APP_DIR}/node_modules/playwright-core/index.mjs`);

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};

const app = await _electron.launch({ args: ['.'], cwd: APP_DIR });
const page = await app.firstWindow();
await page.waitForLoadState('domcontentloaded');

const openFrets = async () => {
    await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].webContents.send('frets:open'));
    await page.waitForTimeout(1500);
};
const frets = () => page.evaluate(() =>
    [6, 5, 4, 3, 2, 1].map(n => document.getElementById(`frets-string-${n}`).value));
const statusLine = () => page.evaluate(() => document.getElementById('status').textContent);

console.log('=== Frets to Chord starts open every time ===');
await openFrets();
check('opens with every string open', (await frets()).every(v => v === '0'), (await frets()).join(','));

// Enter Gsus2: 3 x 0 0 3 3 on strings 6..1, which is what the report described being left behind.
await page.selectOption('#frets-string-6', '3');
await page.selectOption('#frets-string-5', '-1');
await page.selectOption('#frets-string-2', '3');
await page.selectOption('#frets-string-1', '3');
await page.waitForTimeout(600);
const entered = await frets();
const identified = await page.evaluate(() =>
    document.getElementById('frets-result-heading').textContent);
console.log(`  entered ${entered.join(',')} -> ${identified}`);
check('the entered shape is identified', /Identified Chord: \S/.test(identified), identified);

await page.evaluate(() => document.getElementById('frets-dialog').close());
await page.waitForTimeout(400);
await openFrets();
const reopened = await frets();
console.log(`  after closing and reopening: ${reopened.join(',')}`);
check('reopening clears the frets back to open', reopened.every(v => v === '0'), reopened.join(','));

console.log('\n=== Reopening after View in Library also clears ===');
await page.selectOption('#frets-string-6', '3');
await page.selectOption('#frets-string-5', '2');
await page.waitForTimeout(600);
const viewEnabled = await page.evaluate(() => {
    const button = document.getElementById('frets-view-button');
    return { disabled: button.disabled, text: document.getElementById('frets-result-heading').textContent };
});
console.log(`  ${viewEnabled.text}`);
if (!viewEnabled.disabled) {
    await page.click('#frets-view-button');
    await page.waitForTimeout(2000);
} else {
    await page.evaluate(() => document.getElementById('frets-dialog').close());
    await page.waitForTimeout(400);
}
await openFrets();
const afterView = await frets();
console.log(`  frets on next open: ${afterView.join(',')}`);
check('still clean after going through to the library', afterView.every(v => v === '0'),
    afterView.join(','));
await page.evaluate(() => document.getElementById('frets-dialog').close());
await page.waitForTimeout(400);

console.log('\n=== The library status line follows the search ===');
const openedFrom = await statusLine();
console.log(`  on arrival: "${openedFrom}"`);

const searchAndLeave = async term => {
    await page.evaluate(t => {
        const input = document.getElementById('chords-search-input');
        input.focus();
        input.value = t;
        input.dispatchEvent(new Event('input'));
    }, term);
    await page.waitForTimeout(400);
    // The status updates on leaving the field, not on every keystroke.
    await page.evaluate(() => {
        document.getElementById('chords-search-input').blur();
        document.getElementById('chords-level-select').focus();
    });
    await page.waitForTimeout(600);
    return statusLine();
};

const afterC = await searchAndLeave('C');
console.log(`  after searching "C": "${afterC}"`);
check('the status no longer names whatever opened the library',
    !/Gsus2|Showing .* in the Chord Library/.test(afterC), afterC);
check('the status names the current search', afterC.includes('"C"'), afterC);
check('the status gives a count', /\d+ chords?/.test(afterC), afterC);

const afterAm = await searchAndLeave('Am');
console.log(`  after searching "Am": "${afterAm}"`);
check('the status changes again with the search', afterAm.includes('"Am"') && afterAm !== afterC,
    afterAm);

const afterEmpty = await searchAndLeave('');
console.log(`  after clearing the search: "${afterEmpty}"`);
check('an empty search still reports a count',
    /Chord Library: \d+ chords?\.$/.test(afterEmpty), afterEmpty);

const afterNonsense = await searchAndLeave('zzzz');
console.log(`  after a search matching nothing: "${afterNonsense}"`);
check('no matches is stated plainly, without saying "matching" twice',
    afterNonsense === 'Chord Library: no chords match "zzzz".', afterNonsense);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
await app.close();
process.exit(failures === 0 ? 0 : 1);

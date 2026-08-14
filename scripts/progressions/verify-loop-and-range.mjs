// Three behaviours that only show up on a second look, and that unit-style checks cannot see.
//
//   1. Chord practice offers a count-in before every repeat, as the audio track does.
//   2. Up arrow returns to the first measure without losing count of which time round it is.
//   3. The audio track reports position against a selected range, not the whole song.
//
// The second is the one worth keeping: the play count and the position are both worked out from
// elapsed time, while the scheduler deliberately runs ahead of the sound. Reading either from the
// scheduler looks right in a short test and is wrong the moment a repeat has been scheduled but
// not yet heard.

const APP_DIR = `${import.meta.dirname}/../..`.replace(/\\/g, '/');
const { _electron } = await import(`file:///${APP_DIR}/node_modules/playwright-core/index.mjs`);
const { readFile } = await import('node:fs/promises');

let failures = 0;
const check = (label, ok, detail = '') => {
    if (!ok) failures++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};

const app = await _electron.launch({ args: ['.'], cwd: APP_DIR });
const page = await app.firstWindow();
await page.waitForLoadState('domcontentloaded');

// --- 1 and 2: chord practice ---------------------------------------------------------
await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.send('chord-practice:open'));
await page.waitForTimeout(2500);
await page.selectOption('#chord-practice-key-select', 'C|major');
await page.fill('#chord-practice-count-input', '4');
await page.fill('#chord-practice-tempo-input', '240');
await page.uncheck('#chord-practice-speak-checkbox').catch(() => {});
await page.click('#chord-practice-generate-button');
await page.waitForTimeout(1500);

const panel = () => page.evaluate(() => {
    const p = [...document.querySelectorAll('[role="tabpanel"]')].find(x => !x.hidden);
    return {
        announcement: p.querySelector('[aria-live]').textContent,
        boxes: [...p.querySelectorAll('input[type="checkbox"]')].map(b => ({
            label: p.querySelector(`label[for="${b.id}"]`)?.textContent ?? '', checked: b.checked
        }))
    };
});

console.log('=== Count-in for every repeat ===');
const boxes = (await panel()).boxes;
for (const b of boxes) console.log(`      "${b.label}"`);
check('a count-in-each-repeat checkbox exists, worded as the audio track words it',
    boxes.some(b => b.label.startsWith('Count in before every repeat')),
    boxes.map(b => b.label).join(' | '));

console.log('\n=== Up arrow keeps the play count ===');
await page.evaluate(() =>
    [...document.querySelectorAll('[role="tabpanel"]')].find(p => !p.hidden).focus());
await page.keyboard.press(' ');
// 4 measures of 4 beats at 240 bpm is 4 s a pass; wait for a few passes.
await page.waitForTimeout(11000);
await page.keyboard.press('b');
await page.waitForTimeout(600);
const before = (await panel()).announcement;
console.log(`  before Up: ${before}`);

await page.keyboard.press('ArrowUp');
await page.waitForTimeout(700);
await page.keyboard.press('b');
await page.waitForTimeout(600);
const after = (await panel()).announcement;
console.log(`  after Up : ${after}`);

const passOf = text => Number(text.match(/play (\d+)/)?.[1] ?? 0);
check('Up went back to the first measure', /^Measure 1 /.test(after), after);
check('Up kept the play count', passOf(after) === passOf(before) && passOf(before) > 1,
    `${passOf(before)} -> ${passOf(after)}`);
await page.keyboard.press(' ');

// --- 3: audio track with a measure subset --------------------------------------------
console.log('\n=== Audio track B with a measure range selected ===');
const songBytes = [...new Uint8Array(await readFile(
    `${APP_DIR}/musicfiles/Grateful Dead-Ripple-12-20-2025.gp`))];
await app.evaluate(({ BrowserWindow }, bytes) =>
    BrowserWindow.getAllWindows()[0].webContents.send('tabs:open-file', {
        fileName: 'Ripple.gp', data: new Uint8Array(bytes)
    }), songBytes);
await page.waitForTimeout(5000);
await page.evaluate(() => [...document.querySelectorAll('button')]
    .find(b => /Create Audio Track/i.test(b.textContent))?.click());
await page.waitForTimeout(3000);

await page.evaluate(() => {
    document.getElementById('audio-track-first-measure-input').value = '7';
    document.getElementById('audio-track-first-measure-input').dispatchEvent(new Event('change'));
    document.getElementById('audio-track-last-measure-input').value = '21';
    document.getElementById('audio-track-last-measure-input').dispatchEvent(new Event('change'));
});
await page.waitForTimeout(600);
await page.evaluate(() => [...document.querySelectorAll('[role="tabpanel"]')]
    .find(p => !p.hidden).querySelectorAll('button').forEach(b => {
        if (/^Create Track$/.test(b.textContent)) b.click();
    }));
for (let i = 0; i < 40; i++) {
    const ready = await page.evaluate(() => {
        const p = [...document.querySelectorAll('[role="tabpanel"]')].find(x => !x.hidden);
        return ![...p.querySelectorAll('button')].find(b => /^Play Track$/.test(b.textContent))?.disabled;
    });
    if (ready) break;
    await page.waitForTimeout(1000);
}
await page.evaluate(() =>
    [...document.querySelectorAll('[role="tabpanel"]')].find(p => !p.hidden).focus());
await page.keyboard.press('b');
await page.waitForTimeout(700);
const said = await page.evaluate(() => {
    const p = [...document.querySelectorAll('[role="tabpanel"]')].find(x => !x.hidden);
    return [...p.querySelectorAll('[aria-live]')][0].textContent;
});
console.log(`  B with 7 through 21 selected: ${said}`);
check('B reports against the selection, not the whole song',
    /of measures 7 through 21/.test(said), said);
check('B does not say "of 102"', !/of 102/.test(said), said);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
await app.close();
process.exit(failures === 0 ? 0 : 1);

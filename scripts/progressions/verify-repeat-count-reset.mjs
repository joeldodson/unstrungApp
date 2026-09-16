// Changing the number of times to play restarts the play count, in both places that loop.
//
// The sequence that broke: set 0 to play until stopped, go round several times, then ask for a
// fixed number. The old tally was already past the new number, so the run ended almost at once.
// Each panel is played with 0 repeats until it is past play 1, the field is changed, and B must
// then report play 1 of the new count.

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

const focusPanel = () => page.evaluate(() =>
    [...document.querySelectorAll('[role="tabpanel"]')].find(p => !p.hidden).focus());
const announcement = () => page.evaluate(() => {
    const p = [...document.querySelectorAll('[role="tabpanel"]')].find(x => !x.hidden);
    return p.querySelector('[aria-live]').textContent;
});
const setField = (prefix, value) => page.evaluate(({ prefix, value }) => {
    const p = [...document.querySelectorAll('[role="tabpanel"]')].find(x => !x.hidden);
    const input = p.querySelector(`[id^="${prefix}"]`);
    input.value = value;
    input.dispatchEvent(new Event('change'));
}, { prefix, value });
const isPlaying = () => page.evaluate(() => {
    const p = [...document.querySelectorAll('[role="tabpanel"]')].find(x => !x.hidden);
    return [...p.querySelectorAll('button')].some(b => /^Pause/.test(b.textContent));
});
const pressB = async () => {
    await page.keyboard.press('b');
    await page.waitForTimeout(600);
    return announcement();
};
const passOf = text => Number(text.match(/play (\d+)/)?.[1] ?? 0);

// --- Chord practice ------------------------------------------------------------------
console.log('=== Chord practice ===');
await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.send('chord-practice:open'));
await page.waitForTimeout(2500);
await page.selectOption('#chord-practice-key-select', 'C|major');
await page.fill('#chord-practice-count-input', '4');
await page.fill('#chord-practice-tempo-input', '240');
await page.fill('#chord-practice-repeat-input', '0');
await page.uncheck('#chord-practice-speak-checkbox').catch(() => {});
await page.click('#chord-practice-generate-button');
await page.waitForTimeout(1500);

await focusPanel();
await page.keyboard.press(' ');
// 4 measures of 4 beats at 240 bpm is 4 s a pass.
await page.waitForTimeout(11000);
const cpBefore = await pressB();
console.log(`  before change: ${cpBefore}`);
check('went past the first play with repeats set to 0', passOf(cpBefore) > 1, cpBefore);

await setField('chord-practice-tab-repeat', '3');
await page.waitForTimeout(500);
await focusPanel();
const cpAfter = await pressB();
console.log(`  after change : ${cpAfter}`);
check('play count restarted at 1 of the new count', /play 1 of 3/.test(cpAfter), cpAfter);
check('still playing after the change', await isPlaying());

// Three plays from here is at most 12 s; it must end, not carry on or stop straight away.
await page.waitForTimeout(3000);
check('did not stop straight away', await isPlaying());
await page.waitForTimeout(11000);
check('stopped after the three plays', !(await isPlaying()), await announcement());

// --- Audio track ---------------------------------------------------------------------
console.log('\n=== Audio track ===');
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

await setField('audio-track-first-measure-input', '1');
await setField('audio-track-last-measure-input', '2');
await setField('audio-track-repeat-input', '0');
await setField('audio-track-tempo-input', '240');
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

await focusPanel();
await page.keyboard.press(' ');
await page.waitForTimeout(12000);
const atBefore = await pressB();
console.log(`  before change: ${atBefore}`);
check('went past the first play with repeats set to 0', passOf(atBefore) > 1, atBefore);

await setField('audio-track-repeat-input', '10');
await page.waitForTimeout(500);
await focusPanel();
const atAfter = await pressB();
console.log(`  after change : ${atAfter}`);
check('play count restarted at 1 of the new count', /play 1 of 10/.test(atAfter), atAfter);

await page.keyboard.press(' ');
await page.waitForTimeout(6000);
const atPlaying = await pressB();
console.log(`  playing again: ${atPlaying}`);
check('counting from 1 again once playing', passOf(atPlaying) >= 1 && passOf(atPlaying) < passOf(atBefore),
    atPlaying);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
await app.close();
process.exit(failures === 0 ? 0 : 1);

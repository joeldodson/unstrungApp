// Changing the number of times to play restarts the play count, in chord practice.
//
// The sequence that broke: set 0 to play until stopped, go round several times, then ask for a
// fixed number. The old tally was already past the new number, so the run ended almost at once.
// The progression is played with 0 repeats until it is past play 1, the field is changed, and B
// must then report play 1 of the new count.
//
// An audio track had the same count until 2026-10-27, when it became a Repeat checkbox (see
// docs/measure-practice.md). Its half now checks what turning Repeat off while repeating does:
// the play-through under way finishes, and playback stops.

const APP_DIR = `${import.meta.dirname}/../..`.replace(/\\/g, '/');
import { launchApp, runMenuCommand } from '../lib/app-ui.mjs';
const { readFile } = await import('node:fs/promises');

let failures = 0;
const check = (label, ok, detail = '') => {
    if (!ok) failures++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};

// On a scratch profile, so nothing here reaches the real settings or recent files.
const { app, page, close } = await launchApp();

const focusPanel = () => page.evaluate(() =>
    document.querySelector('#item-panels > section:not([hidden])').focus());
const announcement = () => page.evaluate(() => {
    const p = document.querySelector('#item-panels > section:not([hidden])');
    return p.querySelector('[aria-live]').textContent;
});
const setField = (prefix, value) => page.evaluate(({ prefix, value }) => {
    const p = document.querySelector('#item-panels > section:not([hidden])');
    const input = p.querySelector(`[id^="${prefix}"]`);
    input.value = value;
    input.dispatchEvent(new Event('change'));
}, { prefix, value });
const isPlaying = () => page.evaluate(() => {
    const p = document.querySelector('#item-panels > section:not([hidden])');
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
await runMenuCommand(page, 'chord-practice');
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
    BrowserWindow.getAllWindows()[0].webContents.send('files:opened', {
        fileName: 'Ripple.gp', data: new Uint8Array(bytes)
    }), songBytes);
await page.waitForTimeout(5000);
// Each track ends with an Audio Track disclosure; expanding it builds that track's controls.
await page.evaluate(() => { document.querySelector('#item-panels > section:not([hidden]) details.track-region').open = true; });
await page.waitForTimeout(3000);

await setField('audio-track-first-measure-input', '1');
await setField('audio-track-last-measure-input', '2');
await setField('audio-track-tempo-input', '240');
const repeatBox = () => page.evaluate(() => {
    const p = document.querySelector('#item-panels > section:not([hidden]) details.track-region[open]');
    return p.querySelector('[id^="audio-track-repeat-checkbox"]').checked;
});
const playLabel = () => page.evaluate(() => {
    const p = document.querySelector('#item-panels > section:not([hidden]) details.track-region[open]');
    return [...p.querySelectorAll('button')].find(b => /^(Play|Pause)$/.test(b.textContent)).textContent;
});
await page.waitForTimeout(600);

await focusPanel();
await page.keyboard.press('l');
check('l turns Repeat on', await repeatBox());
// The first play loads the samples, then counts in and plays.
await page.keyboard.press(' ');
for (let i = 0; i < 40 && await playLabel() !== 'Pause'; i++) await page.waitForTimeout(500);
await page.waitForTimeout(8000);
const atBefore = await pressB();
console.log(`  repeating: ${atBefore}`);
check('went past the first play with Repeat on', passOf(atBefore) > 1, atBefore);

await page.keyboard.press('l');
await page.waitForTimeout(300);
check('l turns Repeat off', !await repeatBox());
check('and it keeps playing the play-through under way', await playLabel() === 'Pause');
// Two measures at 240 is two seconds, and the last notes are given two more to ring out.
await page.waitForTimeout(5500);
check('then stops at the end of it', await playLabel() === 'Play', await playLabel());

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
await close();
process.exit(failures === 0 ? 0 : 1);

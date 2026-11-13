// Checks what showing another open item does to a progression that is playing (docs/one-player.md,
// decision 7, stage 3 step 8): with "Collapse expanded sections and pause playback when switching
// to another open item" on, the default, it pauses, keeping its place; with it off, it keeps
// playing. The setting's label says it pauses playback.
//
// Drives the Electron app on a scratch profile, judged from the DOM and the announcement line.
//
//   npm run build:renderer
//   node scripts/progressions/verify-progression-switching.mjs

import { launchApp, runMenuCommand } from '../lib/app-ui.mjs';

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const { page, close } = await launchApp();
const errors = [];
page.on('pageerror', error => errors.push(error.message));

// The progression's Play button and announcement, wherever its item is.
const progression = () => page.evaluate(() => {
    const section = [...document.querySelectorAll('#item-panels > section')]
        .find(s => s.querySelector('h2')?.textContent.startsWith('Chord Practice'));
    return {
        playing: section.querySelector('.audio-track button[aria-pressed]').getAttribute('aria-pressed') === 'true',
        announce: section.querySelector('.audio-track p[aria-live="polite"]:not([role])').textContent
    };
});
const showProgression = () => page.evaluate(() =>
    [...document.querySelectorAll('#open-items-list h1 > button')].find(b => b.textContent.startsWith('Practice')).click());
const pressInPanel = name => page.evaluate(name => {
    const panel = document.querySelector('#item-panels > section:not([hidden])');
    const button = [...panel.querySelectorAll('.audio-track button')].find(b => b.textContent === name);
    button.focus();
    button.click();
}, name);
const setSetting = async on => {
    await runMenuCommand(page, 'settings');
    await wait(800);
    await page.evaluate(on => {
        const box = document.getElementById('settings-auto-collapse-checkbox');
        if (box.checked !== on) box.click();
    }, on);
    await page.click('#settings-ok-button');
    await wait(500);
};

try {
    await runMenuCommand(page, 'settings');
    await wait(800);
    const label = await page.evaluate(() => document.querySelector('label[for="settings-auto-collapse-checkbox"]').textContent);
    const on = await page.evaluate(() => document.getElementById('settings-auto-collapse-checkbox').checked);
    check('the setting says it pauses playback, and is on', on &&
        label === 'Collapse expanded sections and pause playback when switching to another open item', label);
    await page.click('#settings-ok-button');
    await wait(400);

    // Eight measures at 240: a second a measure.
    await runMenuCommand(page, 'chord-practice');
    await wait(1200);
    await page.fill('#chord-practice-tempo-input', '240');
    await page.check('#chord-practice-loop-checkbox');
    await page.uncheck('#chord-practice-speak-checkbox');
    await page.click('#chord-practice-generate-button');
    await wait(1500);

    console.log('With the setting on');
    await pressInPanel('Play');
    await page.waitForFunction(() => document.querySelector('#item-panels > section:not([hidden]) .audio-track button[aria-pressed="true"]'),
        null, { timeout: 30000 });
    await wait(3500);
    await runMenuCommand(page, 'chord-library');
    await wait(1500);
    check('showing the Chord Library pauses the progression', !(await progression()).playing);
    await showProgression();
    await wait(500);
    await pressInPanel('Where Am I');
    await wait(300);
    const said = (await progression()).announce;
    check('which kept its place, past measure 1', /^Measure [2-8] of 8/.test(said), said);

    console.log('\nWith the setting off');
    await setSetting(false);
    await showProgression();
    await wait(300);
    await pressInPanel('Play');
    await wait(1500);
    await runMenuCommand(page, 'chord-library');
    await wait(1500);
    check('showing the Chord Library leaves it playing', (await progression()).playing);
    await showProgression();
    await wait(300);
    await pressInPanel('Pause');
    await setSetting(true);
    check('no errors in the page', errors.length === 0, errors.join(' | '));
} finally {
    await close();
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exitCode = failures === 0 ? 0 : 1;

// Checks that the playback keys of a track and of a progression act only while focus is in that
// item, so the Menu button and the list of open items keep their own keys. See
// `keyIsForCurrentItem` in src/renderer/renderer.js. Finding 6 of the November review.
//
// Until 2026-11-11, with a track's Measures and Playback region open or a progression in front,
// spaceBar on the Menu button played instead of opening the menu, spaceBar on a Close button played
// instead of closing, and upArrow or downArrow on the Menu button opened the menu and also moved
// playback.
//
// Drives the Electron app with a short song written in alphaTex here, so it needs no song file,
// and a generated progression. Judged from the DOM and ARIA state, never pixels.
//
//   npm run build:renderer
//   node scripts/songs/verify-keys-stay-in-item.mjs

import { launchApp, openSongFile, openItemCount, runMenuCommand, MENU, VISIBLE_PANEL } from '../lib/app-ui.mjs';

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${condition || !detail ? '' : `  -- ${detail}`}`);
};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

// Eight measures of quarter notes on the open low E, at a slow tempo so nothing ends mid-check.
const SONG = `\\title "Key Scope"\n\\tempo 40\n.\n${Array(8).fill('0.6.4 0.6.4 0.6.4 0.6.4').join(' | ')}\n`;

const { app, page, close } = await launchApp();
try {
    await openSongFile(app, 'key-scope.atex', new TextEncoder().encode(SONG));
    await page.waitForSelector(`${VISIBLE_PANEL} h2`, { timeout: 15000 });
    await page.evaluate(panel => {
        const summary = [...document.querySelector(panel).querySelectorAll('summary')]
            .find(s => s.textContent.startsWith('Measures and Playback'));
        summary.click();
    }, VISIBLE_PANEL);
    await pause(500);

    const playButton = () => `${VISIBLE_PANEL} .audio-track button[aria-pressed]`;
    const playing = () => page.evaluate(selector => document.querySelector(selector).getAttribute('aria-pressed') === 'true', playButton());
    const menuOpen = () => page.evaluate(() => document.getElementById('app-menu-button').getAttribute('aria-expanded') === 'true');
    const announce = () => page.evaluate(panel =>
        document.querySelector(`${panel} .audio-track p[aria-live="polite"]:not([role])`).textContent, VISIBLE_PANEL);
    const focusButton = name => page.evaluate(({ panel, name }) => {
        const button = [...document.querySelector(panel).querySelectorAll('button')].find(b => b.textContent === name);
        if (!button) throw new Error(`No button "${name}".`);
        button.focus();
    }, { panel: VISIBLE_PANEL, name });
    const focusMenuButton = () => page.evaluate(() => document.getElementById('app-menu-button').focus());
    const press = async key => { await page.keyboard.press(key); await pause(200); };
    const waitFor = async condition => {
        for (let i = 0; i < 100; i++) { if (await condition()) return true; await pause(100); }
        return false;
    };

    console.log('A track');
    // Inside the item, spaceBar on a button is still the play key, as chosen on 2026-08-01.
    await focusButton('Slower');
    await press(' ');
    check('spaceBar on a button in the track plays it', await waitFor(playing));
    await press(' ');
    check('and pauses it', !(await playing()));

    // Paused at measure 3, so a move would show.
    await focusButton('Restart Selection');
    await press('ArrowRight');
    await press('ArrowRight');
    await press('b');
    check('the track is at measure 3', (await announce()).startsWith('Measure 3 of 8'), await announce());

    await focusMenuButton();
    await press(' ');
    check('spaceBar on the Menu button opens the menu', await menuOpen());
    check('and does not play the track', !(await playing()));
    await press('Escape');
    check('escape closes it, back on the Menu button', !(await menuOpen()) &&
        await page.evaluate(() => document.activeElement?.id === 'app-menu-button'));

    await press('ArrowUp');
    check('upArrow on the Menu button opens the menu', await menuOpen());
    await press('Escape');
    await press('ArrowDown');
    check('downArrow on the Menu button opens the menu', await menuOpen());
    await press('Escape');
    await focusButton('Where Am I');
    await press('b');
    check('neither moved the track: still measure 3', (await announce()).startsWith('Measure 3 of 8'), await announce());

    // On the item's own button in the list of open items, the play key is not taken either.
    await page.evaluate(() => document.querySelector('#open-items-list button[aria-current="true"]').focus());
    const wasPlaying = await playing();
    await press(' ');
    check('spaceBar on the item\'s button in the list of open items neither plays nor pauses', await playing() === wasPlaying);

    console.log('\nA progression');
    await runMenuCommand(page, MENU.chordPractice);
    await page.waitForSelector('#chord-practice-dialog[open]', { timeout: 5000 });
    await page.click('#chord-practice-generate-button');
    await page.waitForFunction(() => document.querySelectorAll('#open-items-list h1 > button').length === 2, null, { timeout: 15000 });
    await pause(500);
    const progressionPlaying = () => page.evaluate(panel =>
        [...document.querySelector(panel).querySelectorAll('button[aria-pressed]')].some(b => b.getAttribute('aria-pressed') === 'true'), VISIBLE_PANEL);

    await focusMenuButton();
    await press(' ');
    check('spaceBar on the Menu button opens the menu', await menuOpen());
    check('and does not play the progression', !(await progressionPlaying()));
    await press('Escape');

    await focusButton('Where Am I');
    await press(' ');
    check('spaceBar on a button in the progression plays it', await waitFor(progressionPlaying));
    await press(' ');
    check('and pauses it', !(await progressionPlaying()));

    // Last, since it closes the progression.
    const before = await openItemCount(page);
    await page.evaluate(() => document.querySelector('#open-items-list button[aria-current="true"]').closest('li').querySelector('button.close-item').focus());
    await press(' ');
    await pause(300);
    check('spaceBar on the Close button closes the item', await openItemCount(page) === before - 1,
        `${before} items before, ${await openItemCount(page)} after`);
    check('and no dialog asked about it', !(await page.evaluate(() => document.querySelector('dialog[open]'))));
} finally {
    await close();
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exitCode = failures === 0 ? 0 : 1;

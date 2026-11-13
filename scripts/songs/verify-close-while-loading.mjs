// Checks that a player closed while its samples are loading does not start afterwards.
//
// The first Play loads the samples and starts when they are in (playAudioTrackWhenReady). Until
// 2026-11-13, closing the item during that load left the start waiting, so the load finished and
// played with the item, its Play button and its keys gone: nothing could stop it short of closing
// unstrung, and a progression loops by default. A closed player now refuses to start
// (dropAudioTransport, startAudioTrackPlayback).
//
// Play and Close are clicked in the same task, so the close always lands before the load finishes.
// The Play button is kept after it leaves the page: setAudioTrackPlayingState still writes to it,
// so it reading Pause is the player having started. The progression goes first, while no sample
// has been loaded for anything.
//
// Drives the Electron app on a scratch profile, judged from the DOM.
//
//   npm run build:renderer
//   node scripts/songs/verify-close-while-loading.mjs

import { launchApp, openSongFile, openItemCount, runMenuCommand, MENU, VISIBLE_PANEL } from '../lib/app-ui.mjs';

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

const G = '(3.6 2.5 0.4 0.3 0.2 3.1)';
const SONG = ['\\title "Ghost"', '\\tempo 60', '\\track "One"', `${G}.4 ${G}.4 ${G}.4 ${G}.4 |`].join('\n');

/** Clicks the shown item's Play button and then its Close button, keeping the Play button. */
const playThenClose = page => page.evaluate(async selector => {
    const play = [...document.querySelectorAll(`${selector} button[aria-pressed]`)]
        .find(button => button.textContent.trim() === 'Play');
    if (!play) return { found: false };
    window.__play = play;
    play.click();
    document.querySelector('#open-items-list button[aria-current="true"]')
        .closest('li').querySelector('button.close-item').click();
    // A progression's Close asks about unsaved changes first, so it closes a moment later. Read
    // both once that has had its turn: not yet playing, and gone from the page.
    await new Promise(resolve => setTimeout(resolve, 50));
    return { found: true, connected: play.isConnected, playingAtClose: play.getAttribute('aria-pressed') === 'true' };
}, VISIBLE_PANEL);

/** Whether the kept Play button reads as playing at any moment in the next few seconds. */
const startedAfterwards = async page => {
    for (let i = 0; i < 40; i++) {
        await pause(100);
        if (await page.evaluate(() => window.__play.getAttribute('aria-pressed') === 'true')) return true;
    }
    return false;
};

const { app, page, close } = await launchApp();
try {
    console.log('A progression');
    await runMenuCommand(page, MENU.chordPractice);
    await page.waitForSelector('#chord-practice-dialog[open]', { timeout: 5000 });
    await page.click('#chord-practice-generate-button');
    await page.waitForFunction(() => document.querySelectorAll('#open-items-list h1 > button').length === 1,
        null, { timeout: 15000 });
    await pause(500);
    let pressed = await playThenClose(page);
    check('Play was pressed and the item closed before it started',pressed.found && pressed.connected === false && !pressed.playingAtClose && await openItemCount(page) === 0,
        JSON.stringify(pressed));
    if (pressed.found) check('it does not start once its samples have loaded', !(await startedAfterwards(page)));

    console.log('\nA song\'s track');
    await openSongFile(app, 'Ghost.atex', Buffer.from(SONG, 'utf8'));
    await page.waitForFunction(selector => document.querySelectorAll(`${selector} details.track-region`).length === 1,
        VISIBLE_PANEL, { timeout: 30000 });
    await page.evaluate(selector => {
        document.querySelector(`${selector} details.track-region`).open = true;
    }, VISIBLE_PANEL);
    await pause(300);
    pressed = await playThenClose(page);
    check('Play was pressed and the item closed before it started',pressed.found && pressed.connected === false && !pressed.playingAtClose && await openItemCount(page) === 0,
        JSON.stringify(pressed));
    if (pressed.found) check('it does not start once its samples have loaded', !(await startedAfterwards(page)));

    // The fix must not stop an open player starting after its load.
    console.log('\nA song left open');
    await openSongFile(app, 'Ghost.atex', Buffer.from(SONG, 'utf8'));
    await page.waitForFunction(selector => document.querySelectorAll(`${selector} details.track-region`).length === 1,
        VISIBLE_PANEL, { timeout: 30000 });
    await page.evaluate(selector => {
        document.querySelector(`${selector} details.track-region`).open = true;
    }, VISIBLE_PANEL);
    await pause(300);
    await page.evaluate(selector => {
        window.__play = [...document.querySelectorAll(`${selector} button[aria-pressed]`)]
            .find(button => button.textContent.trim() === 'Play');
        window.__play.click();
    }, VISIBLE_PANEL);
    check('Play starts it', await startedAfterwards(page));
} finally {
    await close();
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exitCode = failures === 0 ? 0 : 1;

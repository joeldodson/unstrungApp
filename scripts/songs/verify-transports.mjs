// Checks that each player keeps its own playback (docs/one-player.md, stage 3, step 2).
//
// The audio track player's master gain, scheduled sources, timers and token were single variables
// until 2026-11-12, so starting a track silenced whatever track was playing but left its Play button
// reading Pause. Each player now has its own, and players in the same group, a song's tracks, still
// play one at a time: starting one pauses the other, which says so on its button.
//
// Drives the Electron app on a scratch profile, judged from the DOM. The song is alphaTex written
// here: two tracks of one measure each, played in turn.
//
//   npm run build:renderer
//   node scripts/songs/verify-transports.mjs

import { launchApp, openSongFile, VISIBLE_PANEL } from '../lib/app-ui.mjs';

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

const G = '(3.6 2.5 0.4 0.3 0.2 3.1)';
const SONG = ['\\title "Two Tracks"', '\\tempo 60',
    '\\track "One"', `${G}.4 ${G}.4 ${G}.4 ${G}.4 |`,
    '\\track "Two"', `${G}.4 ${G}.4 ${G}.4 ${G}.4 |`].join('\n');

const { app, page, close } = await launchApp();
try {
    await openSongFile(app, 'Two Tracks.atex', Buffer.from(SONG, 'utf8'));
    await page.waitForFunction(selector => document.querySelectorAll(`${selector} details.track-region`).length === 2,
        VISIBLE_PANEL, { timeout: 30000 });
    await page.evaluate(selector => {
        window.__regions = [...document.querySelectorAll(`${selector} details.track-region`)];
        for (const region of window.__regions) region.open = true;
    }, VISIBLE_PANEL);
    await pause(300);

    const playing = () => page.evaluate(() => window.__regions.map(region =>
        region.querySelector('.audio-track button[aria-pressed]').getAttribute('aria-pressed') === 'true'));
    const press = index => page.evaluate(index => {
        const button = window.__regions[index].querySelector('.audio-track button[aria-pressed]');
        button.focus();
        button.click();
    }, index);
    const waitFor = async (test, seconds) => {
        for (let i = 0; i < seconds * 10; i++) {
            if (test(await playing())) return true;
            await pause(100);
        }
        return false;
    };

    console.log('Two tracks of one song');
    await press(0);
    check('the first plays', await waitFor(([a]) => a, 30));
    await press(1);
    check('starting the second plays it', await waitFor(([, b]) => b, 30));
    const both = await playing();
    check('and pauses the first, whose button says Play again', both[0] === false, JSON.stringify(both));
    await press(1);
    check('pausing the second leaves both paused', await waitFor(([a, b]) => !a && !b, 5));
} finally {
    await close();
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exitCode = failures === 0 ? 0 : 1;

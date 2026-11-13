// Checks Where Am I on a song's track (docs/one-player.md, decision 8, stage 3 step 7): the
// measure against the selection, the chords as the editor writes them, from those the file prints,
// carried forward, then the beat by the measure's own time signature, then which time through.
// A track the file prints no chords over leaves them out. Pausing says where it stopped.
//
// Drives the Electron app on a scratch profile, judged from the announcement line. The song is
// alphaTex written here: two tracks of two measures of 3/4, the first printing G and C@3 over its
// first measure and nothing over its second, the second printing nothing.
//
//   npm run build:renderer
//   node scripts/songs/verify-where-am-i.mjs

import { launchApp, openSongFile, VISIBLE_PANEL } from '../lib/app-ui.mjs';

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const G = '(3.6 2.5 0.4 0.3 0.2 3.1)';
const C = '(3.5 2.4 0.3 1.2 0.1)';
const SONG = ['\\title "Where"', '\\tempo 60', '\\ts (3 4)',
    '\\track "Chords"', `${G}.4 {ch "G"} ${G}.4 ${C}.4 {ch "C"} | ${C}.4 ${C}.4 ${C}.4 |`,
    '\\track "Plain"', `${G}.4 ${G}.4 ${C}.4 | ${C}.4 ${C}.4 ${C}.4 |`].join('\n');

const { app, page, close } = await launchApp();
try {
    await openSongFile(app, 'Where.atex', Buffer.from(SONG, 'utf8'));
    await page.waitForFunction(selector => document.querySelectorAll(`${selector} details.track-region`).length === 2,
        VISIBLE_PANEL, { timeout: 30000 });
    await page.evaluate(selector => {
        window.__regions = [...document.querySelectorAll(`${selector} details.track-region`)];
        for (const region of window.__regions) region.open = true;
    }, VISIBLE_PANEL);
    await wait(300);

    const click = (index, name) => page.evaluate(({ index, name }) => {
        const button = [...window.__regions[index].querySelectorAll('.audio-track button')].find(b => b.textContent === name);
        button.focus();
        button.click();
    }, { index, name });
    const whereAmI = async index => {
        await click(index, 'Where Am I');
        await wait(250);
        return page.evaluate(index => window.__regions[index].querySelector('.audio-track p[aria-live="polite"]:not([role])').textContent, index);
    };

    console.log('A track the file prints chords over');
    let said = await whereAmI(0);
    check('measure 1 names both its chords and beat 1', said === 'Measure 1 of 2, G C@3, beat 1', said);
    await click(0, 'Next Measure');
    said = await whereAmI(0);
    check('measure 2 prints none, so C carries on', said === 'Measure 2 of 2, C, beat 1', said);

    console.log('\nA track the file prints none over');
    said = await whereAmI(1);
    check('the chords are left out', said === 'Measure 1 of 2, beat 1', said);

    console.log('\nWhile playing');
    await click(1, 'Previous Measure');
    await page.evaluate(() => {
        const region = window.__regions[1];
        const box = document.getElementById([...region.querySelectorAll('label')].find(l => l.textContent.startsWith('Count in, one measure')).htmlFor);
        if (box.checked) box.click();
    });
    await click(1, 'Play');
    await page.waitForFunction(() => window.__regions[1].querySelector('.audio-track button[aria-pressed="true"]'), null, { timeout: 30000 });
    // A beat a second: two and a half seconds in is beat 3 of measure 1.
    await wait(2500);
    said = await whereAmI(1);
    check('the beat follows the music', /^Measure 1 of 2, beat 3$/.test(said), said);
    await click(1, 'Pause');
    await wait(250);
    said = await page.evaluate(() => window.__regions[1].querySelector('.audio-track p[aria-live="polite"]:not([role])').textContent);
    // As a progression's does, since Joel chose it at the end of stage 3.
    check('pausing says where it stopped', said === 'Paused at measure 1.', said);
} finally {
    await close();
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exitCode = failures === 0 ? 0 : 1;

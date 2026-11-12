// Checks that the window can be closed when the page has stopped responding with an unsaved
// progression open, and that a responding page is still asked every time. See QUIT_ANSWER_MS in
// src/main/main.js. Finding 19 of the November review.
//
// Drives the Electron app on a scratch profile. An unsaved progression is made in the editor; the
// page is then hung with a busy loop, and the window is closed through the main process, as alt+f4
// does. Judged from the window and the DOM, never pixels.
//
//   npm run build:renderer
//   node scripts/progressions/verify-hung-page-quit.mjs

import { launchApp, runMenuCommand, MENU } from '../lib/app-ui.mjs';

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${condition || !detail ? '' : `  -- ${detail}`}`);
};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

/** The app with an unsaved progression open, made in the editor. */
async function withUnsavedProgression() {
    const session = await launchApp();
    const { app, page } = session;
    let closed = false;
    page.on('close', () => { closed = true; });
    await pause(800);
    await runMenuCommand(page, MENU.newProgression);
    await page.waitForSelector('#progression-editor-dialog[open]');
    await page.focus('#progression-editor-chord-input');
    await page.keyboard.type('G');
    await page.keyboard.press('Enter');
    await pause(200);
    await page.click('#progression-editor-apply-button');
    await page.waitForFunction(() => document.querySelectorAll('#open-items-list h1 > button').length === 1);
    await pause(300);
    return {
        ...session,
        closed: () => closed,
        closeWindow: () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close()).catch(() => {})
    };
}

console.log('A page that has stopped responding');
{
    const s = await withUnsavedProgression();
    try {
        // Busy for 20 seconds; not awaited, since nothing on the page answers until it ends.
        s.page.evaluate(() => { const end = Date.now() + 20000; while (Date.now() < end) { /* hung */ } }).catch(() => {});
        await pause(500);
        await s.closeWindow();
        await pause(1000);
        check('the first close waits for the page', !s.closed());
        await pause(5000);
        await s.closeWindow();
        await pause(1500);
        check('a close after five seconds without an answer goes through', s.closed());
    } finally {
        await s.close();
    }
}

console.log('\nA page that answers');
{
    const s = await withUnsavedProgression();
    try {
        await s.closeWindow();
        await pause(800);
        const asked = await s.page.evaluate(() => document.getElementById('unsaved-dialog').open);
        check('closing asks about the unsaved progression', asked);
        await s.page.click('#unsaved-dialog-cancel-button');
        await pause(5500);
        await s.closeWindow();
        await pause(800);
        check('Cancel, then closing again after five seconds, asks again and does not close',
            !s.closed() && await s.page.evaluate(() => document.getElementById('unsaved-dialog').open));
    } finally {
        await s.close();
    }
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exitCode = failures === 0 ? 0 : 1;

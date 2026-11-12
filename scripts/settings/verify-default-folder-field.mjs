// Checks that the Default folder for Open File field in Settings reports a mistyped folder once,
// when it is changed, rather than every time focus leaves it. See the field's 'change' listener in
// src/renderer/renderer.js. Finding 15 of the November review.
//
// Drives the Electron app on a scratch profile. Judged from the DOM, focus and the stored setting.
//
//   npm run build:renderer
//   node scripts/settings/verify-default-folder-field.mjs

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { launchApp, runMenuCommand, MENU } from '../lib/app-ui.mjs';

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${condition || !detail ? '' : `  -- ${detail}`}`);
};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const realFolder = await mkdtemp(path.join(tmpdir(), 'unstrung-default-folder-'));

const { page, close } = await launchApp();
try {
    await pause(800);
    await runMenuCommand(page, MENU.settings);
    await page.waitForSelector('#settings-dialog[open]');
    await page.click('#settings-tab-files');
    await pause(300);

    const errorOpen = () => page.evaluate(() => document.getElementById('directory-error-dialog').open);
    const focusedId = () => page.evaluate(() => document.activeElement?.id);
    const tabAway = async () => { await page.keyboard.press('Tab'); await pause(500); };

    console.log('A folder that does not exist');
    await page.focus('#settings-default-directory-input');
    await page.keyboard.type('C:\\No Such Folder Here');
    await tabAway();
    check('leaving the field after typing it says so', await errorOpen());
    await page.click('#directory-error-ok-button');
    await pause(300);
    check('OK puts focus back in the field', await focusedId() === 'settings-default-directory-input', await focusedId());

    await tabAway();
    check('leaving it again without a change says nothing more', !(await errorOpen()));

    await page.focus('#settings-default-directory-input');
    await page.evaluate(() => document.getElementById('settings-default-directory-input').blur());
    await pause(500);
    check('nor does losing focus some other way, as switching windows does', !(await errorOpen()));

    console.log('\nA folder that exists');
    await page.fill('#settings-default-directory-input', realFolder);
    await page.focus('#settings-default-directory-input');
    await tabAway();
    const stored = await page.evaluate(async () => (await window.unstrung.getSettings()).defaultOpenDirectory);
    check('is saved without a word', !(await errorOpen()) && path.resolve(stored) === path.resolve(realFolder), stored);
} finally {
    await close();
    await rm(realFolder, { recursive: true, force: true });
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exitCode = failures === 0 ? 0 : 1;

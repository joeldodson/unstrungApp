// Checks Open Saved Progression on a progressions folder that holds far more than progressions, as
// Documents would: it lists what it read and says the folder was listed only in part. See
// MAX_PROGRESSION_FOLDER_ENTRIES in src/main/main.js. Finding 13 of the November review.
//
// Drives the Electron app on a scratch profile, whose progressions folder is the default one inside
// the profile. Judged from the DOM and ARIA attributes, never pixels.
//
//   npm run build:renderer
//   node scripts/progressions/verify-big-progressions-folder.mjs

import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { launchApp, runMenuCommand, MENU } from '../lib/app-ui.mjs';

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${condition || !detail ? '' : `  -- ${detail}`}`);
};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

const { page, profile, close } = await launchApp();
const folder = path.join(profile, 'Documents', 'Unstrung', 'Progressions');
const G = '(3.6 2.5 0.4 0.3 0.2 3.1)';
const progression = `\\tempo 90\n\\ts (4 4) \\ks gmajor ${G}.4 {sd ch "G"} ${G}.4 {sd} ${G}.4 {sd} ${G}.4 {sd} |\n`;

async function openDialog() {
    await runMenuCommand(page, MENU.openProgression);
    await page.waitForSelector('#progression-open-dialog[open]', { timeout: 30000 });
    await pause(300);
    const state = await page.evaluate(() => ({
        folderLine: document.getElementById('progression-open-folder').textContent,
        describedBy: document.getElementById('progression-open-dialog').getAttribute('aria-describedby'),
        progressions: [...document.querySelectorAll('#progression-open-tree [role="treeitem"]')]
            .filter(item => item.dataset.kind !== 'folder').map(item => item.textContent)
    }));
    await page.evaluate(() => document.getElementById('progression-open-dialog').close());
    return state;
}

try {
    await mkdir(path.join(folder, 'Zillions of other files'), { recursive: true });
    // Named to come first, so they are read before the clutter.
    await writeFile(path.join(folder, 'A Waltz in G.atex'), progression, 'utf8');
    await writeFile(path.join(folder, 'Blues in G.atex'), progression, 'utf8');
    for (let i = 0; i < 2100; i++) {
        await writeFile(path.join(folder, 'Zillions of other files', `note ${i}.txt`), '', 'utf8');
    }
    await pause(800);

    console.log('A folder holding 2,100 other files besides two progressions');
    const big = await openDialog();
    check('the two progressions are listed', big.progressions.length === 2, big.progressions.join(' | '));
    check('the folder line says it was listed only in part, and what to do',
        big.folderLine.endsWith('It holds too much to read in full, so only part of it is listed. Choose a folder just for saved progressions in Settings.'),
        big.folderLine);
    check('and the dialog is described by that line, so it is heard on opening', big.describedBy === 'progression-open-folder', String(big.describedBy));

    await rm(path.join(folder, 'Zillions of other files'), { recursive: true, force: true });
    console.log('\nThe same folder with the clutter gone');
    const small = await openDialog();
    check('it says nothing about being listed in part', !/only part/.test(small.folderLine), small.folderLine);
    check('and the dialog has no description', small.describedBy === null, String(small.describedBy));
} finally {
    await close();
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exitCode = failures === 0 ? 0 : 1;

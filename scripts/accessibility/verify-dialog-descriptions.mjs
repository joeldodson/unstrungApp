// Checks that the dialogs which take focus on themselves carry a one-line description, so a screen
// reader reads that on opening rather than every line of the dialog. Finding 14 of the November
// review; the reasoning is in docs/chords-within-a-measure.md.
//
// Opens each dialog in the Electron app and reads the dialog's name and description from Chromium's
// accessibility tree, which is what NVDA is given. What NVDA then says is for Joel to confirm.
//
//   npm run build:renderer
//   node scripts/accessibility/verify-dialog-descriptions.mjs

import { launchApp, runMenuCommand, MENU } from '../lib/app-ui.mjs';

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${condition || !detail ? '' : `  -- ${detail}`}`);
};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

const DIALOGS = [
    ['guitarSamples', 'guitar-samples-dialog', 'Guitar Samples Dialog Box',
        'Plays the recorded notes from low to high. Velocity layer, round robins and time between notes, then Play.'],
    ['chordPractice', 'chord-practice-dialog', 'Chord Practice Dialog Box',
        'Level, key, time signature, strumming pattern, tempo and length, then Generate Progression.'],
    ['fretsToChord', 'frets-dialog', 'Frets to Chord Dialog Box',
        'Tuning, then what each string plays. The chord is named under Identified Chord.']
];

const { page, close } = await launchApp();
try {
    const cdp = await page.context().newCDPSession(page);
    await pause(800);
    for (const [command, id, name, description] of DIALOGS) {
        console.log(name);
        await runMenuCommand(page, MENU[command]);
        await page.waitForSelector(`#${id}[open]`, { timeout: 15000 });
        await pause(400);
        const { nodes } = await cdp.send('Accessibility.getFullAXTree');
        const dialog = nodes.find(node => node.role?.value === 'dialog' && !node.ignored && node.name?.value?.startsWith(name.replace(' Dialog Box', '')));
        const describedBy = dialog?.description?.value ?? null;
        const focused = await page.evaluate(() => document.activeElement?.id);
        check(`focus is on the dialog`, focused === id, focused);
        check(`its description is the one line`, describedBy === description, String(describedBy));
        check('the description is not shown on the page', await page.evaluate(dialogId =>
            document.getElementById(`${dialogId}-description`).hidden, id));
        await page.keyboard.press('Escape');
        await pause(300);
    }
} finally {
    await close();
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exitCode = failures === 0 ? 0 : 1;

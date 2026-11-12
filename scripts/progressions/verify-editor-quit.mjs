// Checks that closing the window while the progression editor holds changes asks first. See
// `editorHasChanges` and `confirmDiscardEditor` in src/renderer/renderer.js.
//
// Until 2026-11-11 the window asked only about a progression tab with unsaved changes, and the
// editor's changes counted only once applied, so alt+f4 with chords typed into the editor closed
// the window without a word. Finding 9 of the November review.
//
// Each case starts the app on a scratch profile, opens the editor from the menu, and closes the
// window through the main process, as alt+f4 or the close button does. Judged from the DOM, the
// window and the file written, never pixels.
//
//   npm run build:renderer
//   node scripts/progressions/verify-editor-quit.mjs

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { launchApp, runMenuCommand, MENU } from '../lib/app-ui.mjs';

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${condition || !detail ? '' : `  -- ${detail}`}`);
};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const scratch = await mkdtemp(path.join(tmpdir(), 'unstrung-editor-quit-'));

/** Starts the app with the editor open on a new progression. */
async function withEditor() {
    const session = await launchApp();
    const { app, page } = session;
    let closed = false;
    page.on('close', () => { closed = true; });
    await pause(800);
    await runMenuCommand(page, MENU.newProgression);
    await page.waitForSelector('#progression-editor-dialog[open]', { timeout: 10000 });
    await pause(300);

    return {
        ...session,
        windowClosed: async () => { await pause(1500); return closed; },
        // As alt+f4 or the close button: a close the page can be asked about.
        closeWindow: () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close()),
        question: () => page.evaluate(() => {
            const dialog = document.getElementById('unsaved-dialog');
            return dialog.open ? document.getElementById('unsaved-dialog-message').textContent : null;
        }),
        answer: id => page.evaluate(button => document.getElementById(button).click(), id),
        type: async text => {
            await page.focus('#progression-editor-chord-input');
            await page.keyboard.type(text);
        },
        editorOpen: () => page.evaluate(() => document.getElementById('progression-editor-dialog').open)
    };
}

/**
 * Runs one case on a fresh app with the editor open. A page that is gone partway through is the
 * window having closed without asking, which is the failure this checks for, so it is reported as
 * one rather than ending the run.
 */
async function runCase(body) {
    const s = await withEditor();
    try {
        await body(s);
    } catch (error) {
        check('the window was still open when expected', false, error.message.split('\n')[0]);
    } finally {
        await s.close();
    }
}

console.log('Nothing typed');
{
    const s = await withEditor();
    await s.closeWindow();
    check('the window closes without a question', await s.windowClosed());
    await s.close();
}

console.log('\nA chord typed and not yet taken, then Cancel');
await runCase(async s => {
    await s.type('G');
    await s.closeWindow();
    await pause(500);
    const question = await s.question();
    check('Unsaved Changes asks about the editor', question === 'The progression editor has changes that are not applied. Save them before quitting?', String(question));
    await s.answer('unsaved-dialog-cancel-button');
    await pause(300);
    // Leaving the field for the question takes what was typed, as leaving it any other way does, so
    // the G is either still in the field or now measure 1's chord.
    const kept = await s.page.evaluate(() => ({
        field: document.getElementById('progression-editor-chord-input').value,
        measure: document.querySelector('#progression-editor-measures [role="option"]')?.textContent ?? ''
    }));
    check('Cancel leaves the window and the editor open, with the G kept',
        !(await s.windowClosed()) && await s.editorOpen() && (kept.field === 'G' || /\bG\b/.test(kept.measure)),
        JSON.stringify(kept));
    check('and focus back in the chord field', await s.page.evaluate(() => document.activeElement?.id) === 'progression-editor-chord-input',
        await s.page.evaluate(() => document.activeElement?.id));

    console.log('\nThen closed again, Don\'t Save');
    await s.closeWindow();
    await pause(500);
    check('it asks again', (await s.question()) !== null);
    await s.answer('unsaved-dialog-discard-button');
    check('Don\'t Save closes the window', await s.windowClosed());
});

console.log('\nA measure given a chord, then Save');
await runCase(async s => {
    const target = path.join(scratch, 'saved on quit.atex');
    await s.app.evaluate(({ dialog }, filePath) => {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath });
    }, target);
    await s.type('G D');
    await s.page.keyboard.press('Enter');
    await pause(300);
    await s.closeWindow();
    await pause(500);
    check('it asks', (await s.question()) !== null);
    await s.answer('unsaved-dialog-save-button');
    check('Save closes the window', await s.windowClosed());
    const text = existsSync(target) ? await readFile(target, 'utf8') : '';
    check('after saving the progression to the file chosen', /\\chord|\\ks/.test(text) && /"G"/.test(text) && /"D"/.test(text),
        text.slice(0, 200) || 'no file');
});

console.log('\nSave with a measure that has no chord');
await runCase(async s => {
    // A second, empty measure: Control+I adds a measure after the current one.
    await s.type('G');
    await s.page.keyboard.press('Enter');
    await pause(200);
    await s.page.keyboard.press('Control+i');
    await pause(200);
    await s.closeWindow();
    await pause(500);
    await s.answer('unsaved-dialog-save-button');
    await pause(500);
    check('the window stays open', !(await s.windowClosed()));
    check('the editor stays open and says why',
        await s.editorOpen() && /has no chord/.test(await s.page.evaluate(() => document.getElementById('progression-editor-status').textContent)),
        await s.page.evaluate(() => document.getElementById('progression-editor-status').textContent));
});

await rm(scratch, { recursive: true, force: true });
console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exitCode = failures === 0 ? 0 : 1;

// Checks that typing in the chord library's search field does not open its suggestion list.
//
// The list opening changes the field's aria-expanded, and NVDA announcing that change cut off the
// echo of the first character typed: type C and hear only "expanded". Down opens the list instead.
// See docs/screen-reader-findings.md.

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const APP_DIR = `${import.meta.dirname}/../..`.replace(/\\/g, '/');
const { _electron } = await import(`file:///${APP_DIR}/node_modules/playwright-core/index.mjs`);

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};

const profile = await mkdtemp(path.join(tmpdir(), 'unstrung-search-typing-'));
const app = await _electron.launch({
    args: ['.'], cwd: APP_DIR, env: { ...process.env, UNSTRUNG_TEST_PROFILE: profile }
});
const page = await app.firstWindow();
await page.waitForLoadState('domcontentloaded');

const field = () => page.evaluate(() => {
    const input = document.getElementById('chords-search-input');
    const list = document.getElementById('chords-search-listbox');
    return {
        value: input.value,
        expanded: input.getAttribute('aria-expanded'),
        active: input.getAttribute('aria-activedescendant'),
        listHidden: list.hidden,
        options: [...list.querySelectorAll('[role="option"]')].map(o =>
            `${o.textContent}${o.getAttribute('aria-disabled') === 'true' ? ' (disabled)' : ''}`),
        status: document.getElementById('chords-status').textContent
    };
});

try {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('chords:open'));
    await page.waitForTimeout(1500);
    await page.focus('#chords-search-input');

    await page.keyboard.type('C');
    await page.waitForTimeout(150);
    let state = await field();
    check('typing a character does not open the list or change the expanded state',
        state.value === 'C' && state.expanded === 'false' && state.listHidden, JSON.stringify(state));

    await page.keyboard.type('m');
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(150);
    state = await field();
    console.log(`  after Down: ${state.options.slice(0, 4).join(' | ')}`);
    check('Down opens the list, filtered by what was typed, first one highlighted',
        state.expanded === 'true' && state.active === 'chords-suggestion-0' &&
        state.options.length > 0 && state.options.every(o => o.startsWith('Cm')), JSON.stringify(state.options.slice(0, 3)));

    await page.keyboard.type('zz');
    await page.waitForTimeout(150);
    state = await field();
    check('with the list open, typing something that matches nothing keeps it open and says so',
        state.expanded === 'true' && state.options.join('|') === 'No chords match (disabled)', JSON.stringify(state));
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);
    state = await field();
    check('Down cannot land on the "No chords match" line', state.active === null, String(state.active));

    await page.keyboard.press('Escape');
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(150);
    state = await field();
    check('Down with nothing matching leaves the list closed and says so in the status line',
        state.expanded === 'false' && state.status === 'No chords match Cmzz.', JSON.stringify(state));

    await page.fill('#chords-search-input', 'G7');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    state = await field();
    check('Enter on a highlighted suggestion takes it and closes the list',
        state.value === 'G7' && state.expanded === 'false', JSON.stringify(state));
    check('the earlier "No chords match" message is gone', state.status === '', state.status);
} finally {
    console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
    await app.close();
    await rm(profile, { recursive: true, force: true });
}
process.exit(failures === 0 ? 0 : 1);

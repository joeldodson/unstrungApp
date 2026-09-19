// Checks that no two buttons share a line in a screen reader's browse mode.
//
// Buttons are inline, so two buttons in one paragraph are one line to NVDA, and Ctrl+Down onto
// that line reads every label. Rows of buttons use the button-row class instead: a flex container,
// whose children are blockified, so each button is its own line while the row stays one row on
// screen. The check is on computed display, which is what the browser reports to the screen reader.

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

const profile = await mkdtemp(path.join(tmpdir(), 'unstrung-button-rows-'));
const app = await _electron.launch({
    args: ['.'], cwd: APP_DIR, env: { ...process.env, UNSTRUNG_TEST_PROFILE: profile }
});
const page = await app.firstWindow();
await page.waitForLoadState('domcontentloaded');

try {
    // A chord practice tab, so the buttons built in code are in the document too.
    await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].webContents.send('chord-practice:open'));
    await page.waitForTimeout(1500);
    await page.click('#chord-practice-generate-button');
    await page.waitForTimeout(1500);

    const report = await page.evaluate(() => {
        // Anything holding two or more buttons among its direct children, excluding tab strips,
        // whose buttons are tabs reached with the arrow keys.
        const containers = [...document.querySelectorAll('*')].filter(element =>
            element.getAttribute('role') !== 'tablist' &&
            [...element.children].filter(child => child.tagName === 'BUTTON').length >= 2);
        const describe = element => `${element.tagName.toLowerCase()}` +
            (element.className ? `.${element.className}` : '') + ': ' +
            [...element.children].filter(c => c.tagName === 'BUTTON').map(b => b.textContent).join(' / ');
        return {
            rows: containers.map(describe),
            notRows: containers.filter(c => !c.classList.contains('button-row')).map(describe),
            inline: containers.flatMap(c => [...c.children]
                .filter(child => child.tagName === 'BUTTON' && getComputedStyle(child).display !== 'block')
                .map(b => `${b.textContent}: ${getComputedStyle(b).display}`)),
            practiceRows: [...[...document.querySelectorAll('[role="tabpanel"]')].find(p => !p.hidden)
                .querySelectorAll('.button-row')].map(describe),
            direction: getComputedStyle(document.querySelector('.button-row')).flexDirection
        };
    });

    console.log(`  rows of buttons found: ${report.rows.length}`);
    for (const row of report.rows) console.log(`    ${row}`);
    check('every group of buttons is a button row', report.notRows.length === 0, report.notRows.join(' ; '));
    check('every button in a row is a block, so its own line to a screen reader',
        report.inline.length === 0, report.inline.join(' ; '));
    check('the rows lay their buttons out side by side', report.direction === 'row', report.direction);
    check('the chord practice tab has its two rows',
        report.practiceRows.length === 2 &&
        report.practiceRows.some(r => r.includes('Edit Progression / Save Progression / Save Progression As')) &&
        report.practiceRows.some(r => r.includes('Previous Measure / Next Measure')),
        report.practiceRows.join(' ; '));
} finally {
    console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
    await app.close();
    await rm(profile, { recursive: true, force: true });
}
process.exit(failures === 0 ? 0 : 1);

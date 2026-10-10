// Checks that no two buttons share a line in a screen reader's browse mode.
//
// Buttons are inline, so two buttons in one paragraph are one line to NVDA, and Ctrl+Down onto
// that line reads every label. Rows of buttons use the button-row class instead: a flex container,
// whose children are blockified, so each button is its own line while the row stays one row on
// screen. The check is on computed display, which is what the browser reports to the screen reader.
//
// Everything that has buttons is opened first, so buttons built in code are checked too: a song
// with its audio track, a generated progression, the chord library, a Help document, and every
// dialog. Then each button is put on the line NVDA would give it -- its nearest block-level
// ancestor, unless it is a block itself -- and any line with two buttons is reported.
//
//   npm run build:renderer
//   node scripts/progressions/verify-button-rows.mjs

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const APP_DIR = `${import.meta.dirname}/../..`.replace(/\\/g, '/');
const SONG = path.join(APP_DIR, 'musicfiles', 'Ripple.gp5');
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
await page.waitForTimeout(1000);
const menu = id => page.evaluate(item => document.getElementById(item).click(), id);

try {
    // A song, through the Open File dialog answered with a file from musicfiles/.
    await app.evaluate(({ dialog }, file) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
    }, SONG);
    await menu('menu-open-file');
    await page.waitForTimeout(3000);
    // Its first audio track, which builds its controls when it is first expanded.
    await page.evaluate(() => {
        const summary = [...document.querySelectorAll('summary')].find(s => s.textContent.startsWith('Audio Track - '));
        summary?.click();
    });
    await page.waitForTimeout(1000);

    // A generated progression, the chord library and a Help document.
    await menu('menu-chord-practice');
    await page.waitForTimeout(1500);
    await page.click('#chord-practice-generate-button');
    await page.waitForTimeout(1500);
    await menu('menu-chord-library');
    await page.waitForTimeout(1500);
    await menu('menu-help-features');
    await page.waitForTimeout(500);

    const report = await page.evaluate(() => {
        // Show every item and open every dialog and disclosure, so nothing is left out for being
        // hidden. Computed display is what is checked, and it is the same open or closed for the
        // buttons themselves, but a hidden ancestor would hide the question.
        for (const panel of document.querySelectorAll('#item-panels > section')) panel.hidden = false;
        for (const details of document.querySelectorAll('details')) details.open = true;
        for (const dialog of document.querySelectorAll('dialog')) if (!dialog.open) dialog.show();

        const BLOCK = /^(block|flex|grid|list-item|table|table-cell|table-row|flow-root)$/;
        const lineOf = button => {
            if (BLOCK.test(getComputedStyle(button).display)) return button;
            let element = button.parentElement;
            while (element && !BLOCK.test(getComputedStyle(element).display)) element = element.parentElement;
            return element;
        };
        const where = element => {
            const owner = element.closest('dialog, #item-panels > section, nav, header');
            const name = owner?.id || owner?.tagName.toLowerCase() || 'page';
            return `${name} > ${element.tagName.toLowerCase()}${element.className ? `.${element.className}` : ''}`;
        };

        const buttons = [...document.querySelectorAll('button')]
            .filter(button => !button.closest('[role="tablist"]'));
        const lines = new Map();
        for (const button of buttons) {
            const line = lineOf(button);
            if (!lines.has(line)) lines.set(line, []);
            lines.get(line).push(button);
        }
        const label = button => button.textContent.trim() || button.getAttribute('aria-label') || '(no label)';
        const rows = [...document.querySelectorAll('.button-row')];
        return {
            buttonCount: buttons.length,
            shared: [...lines.entries()].filter(([line, group]) => line !== group[0] || group.length > 1)
                .filter(([, group]) => group.length > 1)
                .map(([line, group]) => `${where(line)}: ${group.map(label).join(' / ')}`),
            rows: rows.map(row => `${where(row)}: ${[...row.querySelectorAll('button')].map(label).join(' / ')}`),
            sideBySide: rows.every(row => getComputedStyle(row).flexDirection === 'row'),
            practiceRow: rows.map(row => [...row.querySelectorAll('button')].map(label).join(' / '))
                .find(text => text.startsWith('Edit Progression')) ?? null
        };
    });

    console.log(`  buttons checked: ${report.buttonCount}`);
    console.log(`  rows of buttons found: ${report.rows.length}`);
    for (const row of report.rows) console.log(`    ${row}`);
    check('no two buttons share a line', report.shared.length === 0, report.shared.join(' ; '));
    check('the rows lay their buttons out side by side', report.sideBySide);
    check('the progression\'s file buttons are one row',
        report.practiceRow === 'Edit Progression / Save Progression / Save Progression As / Copy to Clipboard',
        report.practiceRow);
} finally {
    console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
    await app.close().catch(() => {});
    await rm(profile, { recursive: true, force: true }).catch(() => {});
}
process.exit(failures === 0 ? 0 : 1);

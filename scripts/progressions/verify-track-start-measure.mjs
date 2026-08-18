// Checks that the Track summary on the audio track page says where the part comes in.
//
// Ripple carries both cases: the Acoustic Lead plays from the first measure, so the note count
// stands alone, and the Mandolin does not come in until measure 19, so it is named.

const APP_DIR = `${import.meta.dirname}/../..`.split('\\').join('/');
const SONG = 'Grateful Dead-Ripple-12-20-2025.gp';
const { _electron } = await import(`file:///${APP_DIR}/node_modules/playwright-core/index.mjs`);
const { readFile } = await import('node:fs/promises');

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};

const app = await _electron.launch({ args: ['.'], cwd: APP_DIR });
const page = await app.firstWindow();
await page.waitForLoadState('domcontentloaded');

const bytes = [...new Uint8Array(await readFile(`${APP_DIR}/musicfiles/${SONG}`))];
await app.evaluate(({ BrowserWindow }, payload) => {
    BrowserWindow.getAllWindows()[0].webContents.send('tabs:open-file', {
        fileName: payload.fileName, data: new Uint8Array(payload.bytes)
    });
}, { fileName: SONG, bytes });
await page.waitForTimeout(6000);

// Track 1 plays from the top; track 4 comes in late.
const cases = [
    { index: 0, name: 'Acoustic Lead', expect: /^Notes - \d+$/ },
    { index: 3, name: 'Mandolin', expect: /^Notes - \d+, starting at measure 19$/ }
];

for (const testCase of cases) {
    await page.evaluate(index => {
        const buttons = [...document.querySelectorAll('button')]
            .filter(b => /Create Audio Track/.test(b.textContent));
        buttons[index]?.click();
    }, testCase.index);
    await page.waitForTimeout(3000);

    // The summary is filled once the track itself has been built.
    await page.evaluate(() => {
        const panel = [...document.querySelectorAll('[role="tabpanel"]')].find(p => !p.hidden);
        [...panel.querySelectorAll('button')]
            .find(b => /^Create Track$/.test(b.textContent.trim()))?.click();
    });
    await page.waitForTimeout(9000);

    const notesRow = await page.evaluate(() => {
        const panel = [...document.querySelectorAll('[role="tabpanel"]')].find(p => !p.hidden);
        return [...panel.querySelectorAll('li')]
            .map(li => li.textContent.trim())
            .find(text => /^Notes - /.test(text)) ?? '(no Notes row)';
    });

    console.log(`\n=== ${testCase.name}`);
    console.log(`  ${notesRow}`);
    check(`the row reads as expected`, testCase.expect.test(notesRow), notesRow);
}

console.log(`\n${failures === 0 ? 'all checks passed' : `${failures} FAILED`}`);
await app.close();
process.exit(failures === 0 ? 0 : 1);

// Checks that the Track summary on the audio track page says where the part comes in.
//
// Ripple carries both cases: the Acoustic Lead plays from the first measure, so the note count
// stands alone, and the Acoustic Capo VII does not come in until measure 2, so it is named. The
// Mandolin, which came in at measure 19, was the late case until only guitar and bass tracks were
// listed.

const APP_DIR = `${import.meta.dirname}/../..`.split('\\').join('/');
const SONG = 'Grateful Dead-Ripple-12-20-2025.gp';
import { launchApp } from '../lib/app-ui.mjs';
const { readFile } = await import('node:fs/promises');

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};

// On a scratch profile, so nothing here reaches the real settings or recent files.
const { app, page, close } = await launchApp();

const bytes = [...new Uint8Array(await readFile(`${APP_DIR}/musicfiles/${SONG}`))];
await app.evaluate(({ BrowserWindow }, payload) => {
    BrowserWindow.getAllWindows()[0].webContents.send('files:opened', {
        fileName: payload.fileName, data: new Uint8Array(payload.bytes)
    });
}, { fileName: SONG, bytes });
await page.waitForTimeout(6000);

// Track 1 plays from the top; track 2 comes in late.
const cases = [
    { index: 0, name: 'Acoustic Lead', expect: /^Notes - \d+$/ },
    { index: 1, name: 'Acoustic Capo VII', expect: /^Notes - \d+, starting at measure 2$/ }
];

for (const testCase of cases) {
    // Each track ends with a Measures and Playback region; expanding it builds that track's controls.
    const inTrack = (index, action) => page.evaluate(({ index, action }) => {
        const panel = document.querySelector('#item-panels > section:not([hidden])');
        const disclosure = panel.querySelectorAll('details.track-region')[index];
        if (action === 'open') disclosure.open = true;
        if (action === 'create') {
            [...disclosure.querySelectorAll('button')]
                .find(b => /^Create Track$/.test(b.textContent.trim()))?.click();
        }
        if (action === 'notes') {
            return [...disclosure.querySelectorAll('li')]
                .map(li => li.textContent.trim())
                .find(text => /^Notes - /.test(text)) ?? '(no Notes row)';
        }
        return null;
    }, { index, action });

    await inTrack(testCase.index, 'open');
    await page.waitForTimeout(3000);
    // The summary is filled once the track itself has been built.
    await inTrack(testCase.index, 'create');
    await page.waitForTimeout(9000);
    const notesRow = await inTrack(testCase.index, 'notes');

    console.log(`\n=== ${testCase.name}`);
    console.log(`  ${notesRow}`);
    check(`the row reads as expected`, testCase.expect.test(notesRow), notesRow);
}

console.log(`\n${failures === 0 ? 'all checks passed' : `${failures} FAILED`}`);
await close();
process.exit(failures === 0 ? 0 : 1);

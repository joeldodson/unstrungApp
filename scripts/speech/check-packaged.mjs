// Does the PACKAGED app find speech voices? The source build always did, which is exactly why
// this went unnoticed: the only build that was ever driven was the one that could not fail.
//
// Drives release/win-unpacked/Unstrung.exe rather than the source tree.

const APP_DIR = `${import.meta.dirname}/../..`.replace(/\\/g, '/');
const { _electron } = await import(`file:///${APP_DIR}/node_modules/playwright-core/index.mjs`);

let failures = 0;
const check = (l, ok, d = '') => { if (!ok) failures++; console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${l}${d ? `  -- ${d}` : ''}`); };

const app = await _electron.launch({
    executablePath: `${APP_DIR}/release/win-unpacked/Unstrung.exe`,
    args: []
});
const page = await app.firstWindow();
await page.waitForLoadState('domcontentloaded');

const packaged = await app.evaluate(({ app: electronApp }) => ({
    isPackaged: electronApp.isPackaged,
    version: electronApp.getVersion(),
    resources: process.resourcesPath
}));
console.log(`  packaged=${packaged.isPackaged} version=${packaged.version}`);

const voices = await page.evaluate(() => window.unstrung.listSpokenVoices());
console.log(`  listSpokenVoices -> supported=${voices.supported} voices=${(voices.voices ?? []).join(', ')}${voices.error ? ' error=' + voices.error : ''}`);
check('the packaged build reports speech as supported', voices.supported === true, voices.error ?? '');
check('it finds at least one voice', (voices.voices ?? []).length > 0);

// The renderer decides the checkbox from that call, so check the dialog itself too.
await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.send('chord-practice:open'));
await page.waitForTimeout(3000);
const dialog = await page.evaluate(() => ({
    disabled: document.getElementById('chord-practice-speak-checkbox').disabled,
    note: document.getElementById('chord-practice-speech-note').textContent
}));
console.log(`  speak checkbox disabled=${dialog.disabled}`);
console.log(`  note: ${dialog.note}`);
check('the spoken chord names option is offered', dialog.disabled === false, String(dialog.disabled));

// And that rendering actually produces audio, not just that voices are listed.
const rendered = await page.evaluate(async () => {
    const out = await window.unstrung.renderSpokenPhrases(['C major', 'A minor'], 5, null);
    return out.map(r => ({ text: r.text, bytes: r.bytes.byteLength }));
});
console.log(`  rendered: ${rendered.map(r => `"${r.text}" ${r.bytes} bytes`).join(', ')}`);
check('phrases render to real audio', rendered.length === 2 && rendered.every(r => r.bytes > 1000),
    JSON.stringify(rendered));

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
await app.close();
process.exit(failures === 0 ? 0 : 1);

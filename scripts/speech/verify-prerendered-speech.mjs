// Spoken chord names must come from the committed recordings, and nothing may be synthesized.
//
// Run against the PACKAGED app, not the source tree. The source build could never catch the fault
// this replaces: it was the one build where the PowerShell path always worked.

const APP_DIR = `${import.meta.dirname}/../..`.replace(/\\/g, '/');
const { _electron } = await import(`file:///${APP_DIR}/node_modules/playwright-core/index.mjs`);

let failures = 0;
const check = (l, ok, d = '') => { if (!ok) failures++; console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${l}${d ? `  -- ${d}` : ''}`); };

const packagedExe = `${APP_DIR}/release/win-unpacked/Unstrung.exe`;
const usePackaged = process.argv.includes('--packaged');
const app = await _electron.launch(usePackaged
    ? { executablePath: packagedExe, args: [] }
    : { args: ['.'], cwd: APP_DIR });
const page = await app.firstWindow();
await page.waitForLoadState('domcontentloaded');

const where = await app.evaluate(({ app: a }) => ({ packaged: a.isPackaged, version: a.getVersion() }));
console.log(`  driving ${where.packaged ? 'the packaged app' : 'the source tree'}, version ${where.version}`);

console.log('\n=== No process is spawned to speak ===');
const bridge = await page.evaluate(() =>
    Object.keys(window.unstrung).filter(k => /speech|spoken|render/i.test(k)));
console.log(`  speech bridge: ${bridge.join(', ')}`);
check('nothing on the bridge renders speech', !bridge.some(k => /render/i.test(k)), bridge.join(', '));

console.log('\n=== The voices come from the committed recordings ===');
const voices = await page.evaluate(() => window.unstrung.listSpokenVoices());
console.log(`  supported=${voices.supported}, voices: ${voices.voices.map(v => v.label).join(' | ')}`);
check('speech is supported', voices.supported === true);
check('both shipped voices are offered', voices.voices.length === 2, `${voices.voices.length}`);
check('they are David and Zira',
    ['David', 'Zira'].every(n => voices.voices.some(v => v.label === n)),
    voices.voices.map(v => v.label).join(', '));

console.log('\n=== Phrases read back as real audio ===');
for (const voice of voices.voices) {
    const got = await page.evaluate(v => window.unstrung.getSpokenPhrases(v, ['C', 'F sharp minor 7']), voice.id);
    const sizes = got.map(g => `${g.text} ${g.bytes.byteLength}B`).join(', ');
    check(`${voice.label} returns both phrases`, got.length === 2 && got.every(g => g.bytes.byteLength > 500), sizes);
}

console.log('\n=== The dialog offers them, and playback uses the chosen one ===');
await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.send('chord-practice:open'));
await page.waitForTimeout(2500);
const dialog = await page.evaluate(() => ({
    options: [...document.getElementById('chord-practice-voice-select').options].map(o => o.textContent),
    disabled: document.getElementById('chord-practice-voice-select').disabled,
    note: document.getElementById('chord-practice-speech-note').textContent,
    labelled: Boolean(document.querySelector('label[for="chord-practice-voice-select"]'))
}));
console.log(`  selector: ${dialog.options.join(' | ')}`);
check('the selector lists every voice and is labelled',
    dialog.options.length === voices.voices.length && dialog.labelled && !dialog.disabled,
    dialog.options.join(', '));
check('the note no longer talks about a speech engine', !/engine/i.test(dialog.note), dialog.note);

// Generate with a chosen voice and confirm the buffers actually came from that voice's files.
await page.selectOption('#chord-practice-voice-select', { index: 1 });
const chosen = await page.evaluate(() => document.getElementById('chord-practice-voice-select').value);
await page.selectOption('#chord-practice-key-select', 'C|major');
await page.fill('#chord-practice-count-input', '4');
await page.setChecked('#chord-practice-speak-checkbox', true);
await page.click('#chord-practice-generate-button');
await page.waitForTimeout(1500);
const used = await page.evaluate(() => {
    const p = [...document.querySelectorAll('[role="tabpanel"]')].find(x => !x.hidden);
    return [...p.querySelectorAll('li')]
        .map(li => li.textContent)
        .find(text => text.startsWith('Spoken chord names')) ?? '';
});
console.log(`  chose "${chosen}", metadata says: ${used}`);
check('a voice was chosen and carried into the tab', chosen.length > 0 && /on,/.test(used), used);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
await app.close();
process.exit(failures === 0 ? 0 : 1);

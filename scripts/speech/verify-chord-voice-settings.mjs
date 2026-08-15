// The voice and its volume live in Settings, not in the chord practice dialog.
//
// A preference is set once and left alone; everything in the chord practice dialog describes the
// progression being made. The check that matters is that a change in Settings survives being
// written to disk and reaches the next progression generated.

const APP_DIR = `${import.meta.dirname}/../..`.replace(/\\/g, '/');
const { _electron } = await import(`file:///${APP_DIR}/node_modules/playwright-core/index.mjs`);

let failures = 0;
const check = (l, ok, d = '') => { if (!ok) failures++; console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${l}${d ? `  -- ${d}` : ''}`); };

const launch = () => _electron.launch(process.argv.includes('--packaged')
    ? { executablePath: `${APP_DIR}/release/win-unpacked/Unstrung.exe`, args: [] }
    : { args: ['.'], cwd: APP_DIR });

let app = await launch();
let page = await app.firstWindow();
await page.waitForLoadState('domcontentloaded');

const openSettings = async () => {
    await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].webContents.send('settings:open'));
    await page.waitForTimeout(1200);
};

console.log('=== The Chord voices section is in General ===');
// The factory defaults are what the markup declares. What the fields *show* is whatever was last
// saved, and both builds share one app-state.json, so a run of this against one build leaves state
// behind for the other. Read the declared defaults from the markup and the live values separately.
await openSettings();
const declared = await page.evaluate(() => ({
    voice: [...document.getElementById('settings-chord-voice-select').options]
        .find(o => o.defaultSelected)?.value,
    volume: document.getElementById('settings-chord-volume-input').getAttribute('value')
}));
console.log(`  declared defaults: ${declared.voice} at ${declared.volume}%`);
check('Zira is the declared default voice', declared.voice === 'zira', String(declared.voice));
check('75 is the declared default volume', declared.volume === '75', String(declared.volume));
const section = await page.evaluate(() => {
    const panel = document.getElementById('settings-panel-general');
    const voice = document.getElementById('settings-chord-voice-select');
    const volume = document.getElementById('settings-chord-volume-input');
    return {
        heading: [...panel.querySelectorAll('h3')].map(h => h.textContent),
        inGeneral: panel.contains(voice) && panel.contains(volume),
        voices: [...voice.options].map(o => o.textContent),
        voice: voice.value,
        volume: volume.value,
        labelled: Boolean(panel.querySelector('label[for="settings-chord-voice-select"]')) &&
            Boolean(panel.querySelector('label[for="settings-chord-volume-input"]')),
        explained: [...panel.querySelectorAll('p')].some(p => /how loud/i.test(p.textContent))
    };
});
console.log(`  headings: ${section.heading.join(', ')}`);
console.log(`  voices: ${section.voices.join(', ')}, default ${section.voice} at ${section.volume}%`);
check('a Chord voices heading is in the General tab',
    section.heading.includes('Chord voices') && section.inGeneral, section.heading.join(', '));
check('both fields are labelled', section.labelled);
check('the voices are David and Zira, plainly named',
    section.voices.join(',') === 'Zira,David', section.voices.join(','));
check('the fields show a saved voice and volume',
    ['zira', 'david'].includes(section.voice) && Number(section.volume) >= 0,
    `${section.voice} at ${section.volume}%`);
check('the percentage is explained', section.explained);

console.log('\n=== The chord practice dialog no longer carries them ===');
await page.evaluate(() => document.getElementById('settings-dialog').close());
await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.send('chord-practice:open'));
await page.waitForTimeout(1500);
const dialog = await page.evaluate(() => ({
    hasVoice: Boolean(document.getElementById('chord-practice-voice-select')),
    hasVolume: Boolean(document.getElementById('chord-practice-speech-volume-input')),
    pointsAtSettings: [...document.getElementById('chord-practice-dialog').querySelectorAll('p')]
        .some(p => /Settings, General, Chord voices/.test(p.textContent))
}));
check('the voice selector is gone from the dialog', !dialog.hasVoice);
check('the volume field is gone from the dialog', !dialog.hasVolume);
check('the dialog says where they went', dialog.pointsAtSettings);

console.log('\n=== A change survives a restart and reaches a progression ===');
await page.evaluate(() => document.getElementById('chord-practice-dialog').close());
await openSettings();
await page.selectOption('#settings-chord-voice-select', 'david');
await page.fill('#settings-chord-volume-input', '40');
await page.dispatchEvent('#settings-chord-volume-input', 'change');
await page.waitForTimeout(800);
await app.close();

app = await launch();
page = await app.firstWindow();
await page.waitForLoadState('domcontentloaded');
const reloaded = await page.evaluate(() => window.unstrung.getSettings());
console.log(`  after restart: ${reloaded.chordVoice} at ${reloaded.chordVoicePercent}%`);
check('the voice was remembered', reloaded.chordVoice === 'david', reloaded.chordVoice);
check('the volume was remembered', reloaded.chordVoicePercent === 40, String(reloaded.chordVoicePercent));

await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.send('chord-practice:open'));
await page.waitForTimeout(1500);
await page.selectOption('#chord-practice-key-select', 'C|major');
await page.fill('#chord-practice-count-input', '4');
await page.setChecked('#chord-practice-speak-checkbox', true);
await page.click('#chord-practice-generate-button');
await page.waitForTimeout(1500);
const said = await page.evaluate(() => {
    const p = [...document.querySelectorAll('[role="tabpanel"]')].find(x => !x.hidden);
    return [...p.querySelectorAll('li')].map(li => li.textContent)
        .find(t => t.startsWith('Spoken chord names')) ?? '';
});
console.log(`  ${said}`);
check('the progression used the volume from Settings', /40 percent/.test(said), said);

// Out of range must be corrected where it is stored, not left to be read back wrongly later.
await page.evaluate(() => document.getElementById('chord-practice-dialog')?.close());
await openSettings();
await page.fill('#settings-chord-volume-input', '900');
await page.dispatchEvent('#settings-chord-volume-input', 'change');
await page.waitForTimeout(600);
const clamped = await page.evaluate(async () => ({
    shown: document.getElementById('settings-chord-volume-input').value,
    stored: (await window.unstrung.getSettings()).chordVoicePercent
}));
console.log(`  typed 900 -> shown ${clamped.shown}, stored ${clamped.stored}`);
check('an out of range volume is clamped and shown clamped',
    clamped.stored === 100 && clamped.shown === '100', JSON.stringify(clamped));

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
await app.close();
process.exit(failures === 0 ? 0 : 1);

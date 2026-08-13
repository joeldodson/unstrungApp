// Exercises the audio track's transport against a real song.
//
// It has never had a driver script, which was fine while nothing touched it. The scheduler is
// about to be shared with chord practice, so this exists to prove the refactor changed nothing:
// run it before and after and compare.
//
// Ripple is used deliberately -- over a hundred measures, which is the file that forced the
// scheduler to be rewritten in the first place.

const APP_DIR = `${import.meta.dirname}/../..`.replace(/\\/g, '/');
const SONG = `${APP_DIR}/musicfiles/Grateful Dead-Ripple-12-20-2025.gp`;
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

const songBytes = [...new Uint8Array(await readFile(SONG))];
await app.evaluate(({ BrowserWindow }, { fileName, bytes }) => {
    BrowserWindow.getAllWindows()[0].webContents.send('tabs:open-file', {
        fileName, data: new Uint8Array(bytes)
    });
}, { fileName: 'Grateful Dead-Ripple-12-20-2025.gp', bytes: songBytes });
await page.waitForTimeout(5000);

console.log('=== Creating an audio track for the lead part ===');
// The Create Audio Track button lives in the song tab, one per track.
const created = await page.evaluate(async () => {
    const buttons = [...document.querySelectorAll('button')]
        .filter(b => /Create Audio Track/i.test(b.textContent));
    if (buttons.length === 0) return { found: 0 };
    buttons[0].click();
    return { found: buttons.length };
});
console.log(`  Create Audio Track buttons found: ${created.found}`);
check('the song offers audio tracks', created.found > 0);
await page.waitForTimeout(3000);

// The track panel appears in its own tab; find the Create Track button inside it and press it.
const panelState = () => page.evaluate(() => {
    const panel = [...document.querySelectorAll('[role="tabpanel"]')].find(p => !p.hidden);
    if (!panel) return null;
    const play = [...panel.querySelectorAll('button')]
        .find(b => /^(Play Track|Pause)$/.test(b.textContent));
    const live = [...panel.querySelectorAll('[aria-live]')];
    return {
        buttons: [...panel.querySelectorAll('button')].map(b => b.textContent),
        playLabel: play?.textContent ?? null,
        playDisabled: play?.disabled ?? null,
        announcement: live[0]?.textContent ?? '',
        status: live.map(el => el.textContent).join(' | '),
        // By id: the panel's first checkbox is the count-in one, inside the measures disclosure.
        metronome: document.getElementById('audio-track-metronome-checkbox')?.checked ?? null
    };
});

let state = await panelState();
console.log(`  panel buttons: ${state.buttons.join(', ')}`);
check('the track panel opened', state.buttons.some(b => /Create Track/i.test(b)),
    state.buttons.join(', '));

await page.evaluate(() => {
    const panel = [...document.querySelectorAll('[role="tabpanel"]')].find(p => !p.hidden);
    [...panel.querySelectorAll('button')].find(b => /^Create Track$/.test(b.textContent))?.click();
});
// Building the note timeline and fetching samples for a hundred-measure track takes a while.
for (let i = 0; i < 60; i++) {
    state = await panelState();
    if (state.playDisabled === false) break;
    await page.waitForTimeout(1000);
}
console.log(`  status after creating: ${state.status.slice(0, 120)}`);
check('the track was created and can be played', state.playDisabled === false,
    `play disabled: ${state.playDisabled}`);

console.log('\n=== Transport keys ===');
await page.evaluate(() =>
    [...document.querySelectorAll('[role="tabpanel"]')].find(p => !p.hidden).focus());

const press = async key => {
    await page.keyboard.press(key);
    await page.waitForTimeout(700);
    return panelState();
};

const afterB = await press('b');
console.log(`  B  -> ${afterB.announcement}`);
check('B reports the measure', /^Measure \d+ of \d+/.test(afterB.announcement), afterB.announcement);

// Moving around is silent here by design -- only the keys that exist to ask a question answer --
// so where the seek landed is confirmed with B rather than read off the seek itself.
const beforeSeek = (await panelState()).announcement;
const afterRight = await press('ArrowRight');
check('Right says nothing', afterRight.announcement === beforeSeek, afterRight.announcement);
const rightThenB = await press('b');
console.log(`  Right then B -> ${rightThenB.announcement}`);
check('Right moved forward a measure', /^Measure 2\b/.test(rightThenB.announcement),
    rightThenB.announcement);

await press('ArrowLeft');
const leftThenB = await press('b');
check('Left moved back a measure', /^Measure 1\b/.test(leftThenB.announcement),
    leftThenB.announcement);

const afterSlow = await press('s');
console.log(`  S  -> ${afterSlow.announcement}`);
check('S announces the tempo as a bare value', /^\d+ BPM$/.test(afterSlow.announcement),
    afterSlow.announcement);
await press('f');

const beforeM = await panelState();
const afterM = await press('m');
check('M toggles the metronome', afterM.metronome !== beforeM.metronome,
    `${beforeM.metronome} -> ${afterM.metronome}`);
check('M says nothing', afterM.announcement === beforeM.announcement, afterM.announcement);
await press('m');

console.log('\n=== Repeated questions are answered every time ===');
await page.evaluate(() => {
    const panel = [...document.querySelectorAll('[role="tabpanel"]')].find(p => !p.hidden);
    const region = panel.querySelector('[aria-live]');
    window.__said = [];
    new MutationObserver(() => {
        if (region.textContent) window.__said.push(region.textContent);
    }).observe(region, { childList: true, characterData: true, subtree: true });
});
await press('b');
await press('b');
await press('b');
const said = await page.evaluate(() => window.__said);
console.log(`  B three times while stopped -> ${said.length} announcements`);
check('the same answer is spoken every time', said.length === 3 && new Set(said).size === 1,
    `${said.length}: ${[...new Set(said)].join(' | ')}`);

console.log('\n=== Playing a hundred-measure track ===');
await page.keyboard.press(' ');
await page.waitForTimeout(9000);
const playing = await panelState();
console.log(`  after 9 s: button "${playing.playLabel}"`);
check('playback started and is still running', playing.playLabel === 'Pause', playing.playLabel);

// Seeking while playing must not stall it: this is the path the shared scheduler will change.
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(1500);
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(2500);
const afterSeeks = await panelState();
console.log(`  after seeking twice: "${afterSeeks.announcement}", button "${afterSeeks.playLabel}"`);
check('seeking while playing keeps it playing', afterSeeks.playLabel === 'Pause',
    afterSeeks.playLabel);

const paused = await press(' ');
console.log(`  Space -> ${paused.announcement}`);
check('Space pauses', paused.playLabel === 'Play Track', paused.playLabel);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
await app.close();
process.exit(failures === 0 ? 0 : 1);

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
import { launchApp } from '../lib/app-ui.mjs';
const { readFile } = await import('node:fs/promises');

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};

// On a scratch profile, so nothing here reaches the real settings or recent files.
const { app, page, close } = await launchApp();

const songBytes = [...new Uint8Array(await readFile(SONG))];
await app.evaluate(({ BrowserWindow }, { fileName, bytes }) => {
    BrowserWindow.getAllWindows()[0].webContents.send('files:opened', {
        fileName, data: new Uint8Array(bytes)
    });
}, { fileName: 'Grateful Dead-Ripple-12-20-2025.gp', bytes: songBytes });
await page.waitForTimeout(5000);

console.log('=== Creating an audio track for the lead part ===');
// Each track of the song ends with an Audio Track disclosure; expanding it builds the track's
// controls in place. The first is the lead part.
const TRACK = '#item-panels > section:not([hidden]) details.audio-track-disclosure[open]';
const created = await page.evaluate(() => {
    const panel = document.querySelector('#item-panels > section:not([hidden])');
    const disclosures = [...panel.querySelectorAll('details.audio-track-disclosure')];
    if (disclosures.length > 0) disclosures[0].open = true;
    return { found: disclosures.length, summary: disclosures[0]?.querySelector('summary').textContent };
});
console.log(`  Audio Track disclosures found: ${created.found}, opened ${created.summary}`);
check('the song offers audio tracks', created.found > 0);
await page.waitForTimeout(3000);

const panelState = () => page.evaluate(selector => {
    const panel = document.querySelector(selector);
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
        // Control ids carry a per-track suffix so two audio tracks cannot collide, so this
        // matches the prefix within the track rather than a fixed id.
        metronome: panel.querySelector('[id^="audio-track-metronome-checkbox"]')?.checked ?? null
    };
}, TRACK);

let state = await panelState();
console.log(`  track buttons: ${state?.buttons.join(', ')}`);
check('the track\'s controls appeared', state?.buttons.some(b => /Create Track/i.test(b)),
    state?.buttons.join(', '));

await page.evaluate(selector => {
    const track = document.querySelector(selector);
    [...track.querySelectorAll('button')].find(b => /^Create Track$/.test(b.textContent))?.click();
}, TRACK);
// Building the note timeline and fetching samples for a hundred-measure track takes a while.
for (let i = 0; i < 60; i++) {
    state = await panelState();
    if (state.playDisabled === false) break;
    await page.waitForTimeout(1000);
}
console.log(`  status after creating: ${state.status.slice(0, 120)}`);
// 0.9.0 said "NaN BPM" here, the file's tempo having become the function that reads it.
const tempoLine = await page.evaluate(selector =>
    [...document.querySelector(selector).querySelectorAll('li, p')].map(el => el.textContent).find(t => /^Tempo - /.test(t)) ?? '', TRACK);
console.log(`  ${tempoLine}`);
check('the track gives its tempo as a number', /^Tempo - \d+ BPM \(the tempo written in the file\)$/.test(tempoLine), tempoLine);
check('so does the status line', /\d+ BPM, /.test(state.status) && !/NaN/.test(state.status), state.status.slice(0, 120));
check('the track was created and can be played', state.playDisabled === false,
    `play disabled: ${state.playDisabled}`);

console.log('\n=== Transport keys ===');
await page.evaluate(() =>
    document.querySelector('#item-panels > section:not([hidden])').focus());

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
await page.evaluate(selector => {
    const region = document.querySelector(selector).querySelector('[aria-live]');
    window.__said = [];
    new MutationObserver(() => {
        if (region.textContent) window.__said.push(region.textContent);
    }).observe(region, { childList: true, characterData: true, subtree: true });
}, TRACK);
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
await close();
process.exit(failures === 0 ? 0 : 1);

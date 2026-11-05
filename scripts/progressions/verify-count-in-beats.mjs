// Checks Number of Beats to Count In, in a track's Playback Settings, the chord practice dialog and
// a chord practice tab, against the real app.
//
// The field: there only while Count In Before Every Repeat is shown and checked, running from 1 to
// the beats in a measure and starting at all of them. The sound: the count-in clicks handed to the
// audio graph, caught by wrapping AudioBufferSourceNode.start. The first count-in is a whole
// measure; every repeat's is that many clicks a beat apart, the music starting a beat after the
// last, with no accent unless it starts on beat 1. Judged from the DOM and the schedule.
//
// Run: node scripts/progressions/verify-count-in-beats.mjs [song file]

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { launchApp, openSongFile, runMenuCommand, APP_DIR, VISIBLE_PANEL } from '../lib/app-ui.mjs';

const song = process.argv[2] ?? path.join(APP_DIR, 'musicfiles', 'Grateful Dead-Ripple-12-20-2025.gp');

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

const { app, page, close } = await launchApp();

// Every buffer started from now on, with its start time and which buffer it was; clicks are the
// 60 ms buffers, and the accent and the plain beat are two different ones.
await page.evaluate(() => {
    window.__starts = [];
    const ids = new WeakMap();
    let nextId = 1;
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (when, ...rest) {
        if (this.buffer && !ids.has(this.buffer)) ids.set(this.buffer, nextId++);
        window.__starts.push({ when, duration: this.buffer?.duration ?? 0, buffer: ids.get(this.buffer) });
        return start.call(this, when, ...rest);
    };
});

// Inside `root`, the control a label starting with `start` names: its value, range and paragraph.
const controlState = (root, starts) => page.evaluate(({ root, starts }) => {
    const scope = root === 'region' ? window.__region : document.querySelector(root);
    const out = {};
    for (const start of starts) {
        const label = [...scope.querySelectorAll('label')].find(l => l.textContent.trim().startsWith(start));
        const control = label && document.getElementById(label.htmlFor);
        out[start] = control ? {
            type: control.type, checked: control.checked, value: control.value,
            min: control.min, max: control.max, hidden: control.closest('p').hidden
        } : null;
    }
    return out;
}, { root, starts });
const setControl = (root, start, value) => page.evaluate(({ root, start, value }) => {
    const scope = root === 'region' ? window.__region : document.querySelector(root);
    const label = [...scope.querySelectorAll('label')].find(l => l.textContent.trim().startsWith(start));
    const control = document.getElementById(label.htmlFor);
    if (control.type === 'checkbox') control.checked = value; else control.value = String(value);
    control.dispatchEvent(new Event('change', { bubbles: true }));
}, { root, start, value });

/**
 * The count-in clicks of a run as groups: clicks closer together than `gap` seconds are one group.
 * With the metronome off, the only clicks are count-ins.
 */
const clickGroups = async gap => {
    const clicks = (await page.evaluate(() => window.__starts))
        .filter(s => s.duration > 0 && s.duration < 0.07).sort((a, b) => a.when - b.when);
    const groups = [];
    for (const click of clicks) {
        const group = groups.at(-1);
        if (group && click.when - group.at(-1).when < gap) group.push(click); else groups.push([click]);
    }
    return groups;
};
const near = (a, b) => Math.abs(a - b) < 0.002;

/**
 * Checks a run's count-ins: a whole measure of `measureBeats` first, then `beats` clicks before
 * every repeat, a beat apart, each cycle lasting those beats plus the music.
 */
const checkRun = (groups, { beats, measureBeats, beat, passSeconds }) => {
    console.log(`  click groups: ${groups.map(g => g.length).join(', ')}`);    const [first, ...repeats] = groups;
    check('the first count-in is a whole measure', first?.length === measureBeats, `${first?.length} clicks`);
    check(`each repeat is counted in with ${beats}`, repeats.length >= 2 && repeats.every(g => g.length === beats),
        repeats.map(g => g.length).join(', '));
    check('a beat apart', repeats.every(g => g.slice(1).every((c, i) => near(c.when - g[i].when, beat))));
    const accent = first[0].buffer;
    const accented = repeats.some(g => g.some(c => c.buffer === accent));
    check(beats === measureBeats ? 'beat 1 of the count-in accented' : 'no accent, since it does not start on beat 1',
        beats === measureBeats ? repeats.every(g => g[0].buffer === accent) : !accented);
    const cycles = repeats.slice(0, -1).map((g, i) => repeats[i + 1][0].when - g[0].when);
    check('the music starts a beat after the last click',
        cycles.every(c => near(c, beats * beat + passSeconds)), cycles.map(c => c.toFixed(3)).join(', '));
};

const EACH = 'Count in before every repeat';
const BEATS = 'Number of beats to count in';

console.log('=== A track ===');
await openSongFile(app, path.basename(song), new Uint8Array(await readFile(song)));
await page.waitForSelector(`${VISIBLE_PANEL} h2`, { timeout: 15000 });
await pause(500);
await page.evaluate(panelSelector => {
    window.__region = document.querySelector(`${panelSelector} details.track-region`);
    window.__region.open = true;
}, VISIBLE_PANEL);
await pause(300);

let shown = await controlState('region', ['Repeat', EACH, BEATS]);
check('the field exists, a number from 1 to 4, at 4', shown[BEATS]?.type === 'number' &&
    shown[BEATS].min === '1' && shown[BEATS].max === '4' && shown[BEATS].value === '4', JSON.stringify(shown[BEATS]));
check('hidden while Repeat is unchecked', !shown.Repeat.checked && shown[BEATS].hidden);
await setControl('region', 'Repeat', true);
shown = await controlState('region', [EACH, BEATS]);
check('still hidden with Repeat checked but not Count In Before Every Repeat',
    !shown[EACH].hidden && !shown[EACH].checked && shown[BEATS].hidden);
await setControl('region', EACH, true);
shown = await controlState('region', [BEATS]);
check('shown once Count In Before Every Repeat is checked', !shown[BEATS].hidden);
const order = await page.evaluate(({ each, beats }) => {
    const labels = [...window.__region.querySelectorAll('label')].map(l => l.textContent);
    return labels.indexOf(beats) - labels.findIndex(t => t.startsWith(each));
}, { each: EACH, beats: BEATS });
check('straight after it', order === 1, `${order}`);
await setControl('region', EACH, false);
shown = await controlState('region', [BEATS]);
check('hidden again when that is unchecked', shown[BEATS].hidden);
await setControl('region', EACH, true);
await setControl('region', 'Repeat', false);
shown = await controlState('region', [EACH, BEATS]);
check('both hidden when Repeat is unchecked', shown[EACH].hidden && shown[BEATS].hidden);
await setControl('region', 'Repeat', true);

await setControl('region', BEATS, 9);
check('a number above the measure is held at 4', (await controlState('region', [BEATS]))[BEATS].value === '4');
await setControl('region', BEATS, 0);
check('a number below 1 is held at 1', (await controlState('region', [BEATS]))[BEATS].value === '1');

// One measure, quickly, metronome off, so the only clicks are count-ins.
await setControl('region', 'First measure', 1);
await setControl('region', 'Last measure', 1);
await setControl('region', 'Tempo', 240);
await setControl('region', 'Metronome', false);
const playTrack = () => page.evaluate(() => window.__region.querySelector('.audio-track button[aria-pressed]').click());
for (const beats of [2, 1, 3, 4]) {
    console.log(`  -- ${beats} beat${beats === 1 ? '' : 's'}`);
    await setControl('region', BEATS, beats);
    check('the field keeps it after the selection is set', (await controlState('region', [BEATS]))[BEATS].value === String(beats));
    await page.evaluate(() => { window.__starts = []; });
    await playTrack();
    await pause(4000);
    const groups = await clickGroups(0.4);
    await playTrack();
    // Back to the start while paused, so the next Play counts in from the top.
    await page.evaluate(() => [...window.__region.querySelectorAll('button')]
        .find(b => b.textContent === 'Restart Selection').click());
    checkRun(groups, { beats, measureBeats: 4, beat: 0.25, passSeconds: 1 });
}

console.log('\n=== The chord practice dialog ===');
await runMenuCommand(page, 'chord-practice');
await page.waitForTimeout(2500);
const DIALOG = '#chord-practice-dialog';
shown = await controlState(DIALOG, [EACH, BEATS]);
check('the dialog has it, 1 to 4, at 4, hidden', shown[BEATS]?.min === '1' && shown[BEATS].max === '4' &&
    shown[BEATS].value === '4' && shown[BEATS].hidden, JSON.stringify(shown[BEATS]));
check('the dialog no longer says the count-in needs the metronome', await page.evaluate(() =>
    !document.getElementById('chord-practice-dialog').textContent.includes('metronome on')));
await setControl(DIALOG, EACH, true);
check('shown once Count In Before Every Repeat is checked', !(await controlState(DIALOG, [BEATS]))[BEATS].hidden);
await setControl(DIALOG, EACH, false);
check('hidden again when that is unchecked', (await controlState(DIALOG, [BEATS]))[BEATS].hidden);
await setControl(DIALOG, EACH, true);
await setControl(DIALOG, BEATS, 2);
await setControl(DIALOG, 'Beats per measure', 3);
shown = await controlState(DIALOG, [BEATS]);
check('a new time signature makes it 1 to 3, at 3', shown[BEATS].max === '3' && shown[BEATS].value === '3',
    JSON.stringify(shown[BEATS]));
await setControl(DIALOG, BEATS, 7);
check('a number above the measure is held at 3', (await controlState(DIALOG, [BEATS]))[BEATS].value === '3');
await setControl(DIALOG, BEATS, 2);

await page.evaluate(() => {
    for (const id of ['chord-practice-metronome-checkbox', 'chord-practice-speak-checkbox']) {
        document.getElementById(id).checked = false;
    }
    document.getElementById('chord-practice-repeat-input').value = '0';
    document.getElementById('chord-practice-tempo-input').value = '240';
    document.getElementById('chord-practice-count-input').value = '2';
});
await page.click('#chord-practice-generate-button');
await page.waitForTimeout(1500);

console.log('\n=== The chord practice tab ===');
shown = await controlState(VISIBLE_PANEL, [EACH, BEATS]);
check('the tab starts at 2 of 1 to 3, from the dialog', shown[BEATS]?.max === '3' && shown[BEATS].value === '2' &&
    !shown[BEATS].hidden, JSON.stringify(shown[BEATS]));
await setControl(VISIBLE_PANEL, EACH, false);
check('hidden when Count In Before Every Repeat is unchecked', (await controlState(VISIBLE_PANEL, [BEATS]))[BEATS].hidden);
await setControl(VISIBLE_PANEL, EACH, true);
await setControl(VISIBLE_PANEL, 'Times to play', 1);
shown = await controlState(VISIBLE_PANEL, [EACH, BEATS]);
check('both hidden when the progression plays once', shown[EACH].hidden && shown[BEATS].hidden);
await setControl(VISIBLE_PANEL, 'Times to play', 0);
check('shown again when it repeats', !(await controlState(VISIBLE_PANEL, [BEATS]))[BEATS].hidden);
await setControl(VISIBLE_PANEL, BEATS, 5);
check('a number above the measure is held at 3', (await controlState(VISIBLE_PANEL, [BEATS]))[BEATS].value === '3');

const playTab = () => page.evaluate(panelSelector =>
    [...document.querySelector(panelSelector).querySelectorAll('button')]
        .find(b => b.hasAttribute('aria-pressed')).click(), VISIBLE_PANEL);
for (const beats of [2, 1]) {
    console.log(`  -- ${beats} beat${beats === 1 ? '' : 's'}`);
    await setControl(VISIBLE_PANEL, BEATS, beats);
    await page.evaluate(() => { window.__starts = []; });
    await playTab();
    await pause(6000);
    const groups = await clickGroups(0.4);
    await playTab();
    // Back to the first measure while paused, so the next Play counts in from the top.
    await page.evaluate(panelSelector => [...document.querySelector(panelSelector).querySelectorAll('button')]
        .find(b => b.textContent === 'Restart Progression').click(), VISIBLE_PANEL);
    checkRun(groups, { beats, measureBeats: 3, beat: 0.25, passSeconds: 2 * 3 * 0.25 });
}

await close();
console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);

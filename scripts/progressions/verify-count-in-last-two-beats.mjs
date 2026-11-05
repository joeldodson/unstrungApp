// Checks Count In the Repeats With the Last Two Beats Only, in a track's Playback Settings and in a
// chord practice tab, against the real app.
//
// The checkbox: there only while Count In Before Every Repeat is shown and checked. The sound: the
// count-in clicks handed to the audio graph, caught by wrapping AudioBufferSourceNode.start. With
// the box checked the first count-in is still a whole measure and every repeat's is two clicks a
// beat apart, the music starting a beat after the second. Judged from the DOM and the schedule.
//
// Run: node scripts/progressions/verify-count-in-last-two-beats.mjs [song file]

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

// Every buffer started from now on, with its start time; clicks are the 60 ms buffers.
await page.evaluate(() => {
    window.__starts = [];
    const ids = new WeakMap();
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (when, ...rest) {
        if (this.buffer && !ids.has(this.buffer)) ids.set(this.buffer, ids.size + 1);
        window.__starts.push({ when, duration: this.buffer?.duration ?? 0 });
        return start.call(this, when, ...rest);
    };
});

// Inside `root`, the control a label starting with `start` names, and its paragraph.
const controlState = (root, starts) => page.evaluate(({ root, starts }) => {
    const scope = root === 'region' ? window.__region : document.querySelector(root);
    const out = {};
    for (const start of starts) {
        const label = [...scope.querySelectorAll('label')].find(l => l.textContent.trim().startsWith(start));
        const control = label && document.getElementById(label.htmlFor);
        out[start] = control ? { checked: control.checked, hidden: control.closest('p').hidden } : null;
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
        .filter(s => s.duration > 0 && s.duration < 0.07).map(s => s.when).sort((a, b) => a - b);
    const groups = [];
    for (const when of clicks) {
        const group = groups.at(-1);
        if (group && when - group.at(-1) < gap) group.push(when); else groups.push([when]);
    }
    return groups;
};
const spacing = group => group.slice(1).map((t, i) => t - group[i]);
const near = (a, b) => Math.abs(a - b) < 0.002;

const EACH = 'Count in before every repeat';
const TWO = 'Count in the repeats with the last two beats only';

console.log('=== A track ===');
await openSongFile(app, path.basename(song), new Uint8Array(await readFile(song)));
await page.waitForSelector(`${VISIBLE_PANEL} h2`, { timeout: 15000 });
await pause(500);
await page.evaluate(panelSelector => {
    window.__region = document.querySelector(`${panelSelector} details.track-region`);
    window.__region.open = true;
}, VISIBLE_PANEL);
await pause(300);

let shown = await controlState('region', ['Repeat', EACH, TWO]);
check('the new checkbox exists, unchecked', shown[TWO] && !shown[TWO].checked, JSON.stringify(shown[TWO]));
check('hidden while Repeat is unchecked', !shown.Repeat.checked && shown[TWO].hidden);
await setControl('region', 'Repeat', true);
shown = await controlState('region', [EACH, TWO]);
check('still hidden with Repeat checked but not Count In Before Every Repeat',
    !shown[EACH].hidden && !shown[EACH].checked && shown[TWO].hidden);
await setControl('region', EACH, true);
shown = await controlState('region', [TWO]);
check('shown once Count In Before Every Repeat is checked', !shown[TWO].hidden);
const order = await page.evaluate(({ each, two }) => {
    const labels = [...window.__region.querySelectorAll('label')].map(l => l.textContent);
    return labels.indexOf(two) - labels.findIndex(t => t.startsWith(each));
}, { each: EACH, two: TWO });
check('straight after it', order === 1, `${order}`);
await setControl('region', EACH, false);
shown = await controlState('region', [TWO]);
check('hidden again when that is unchecked', shown[TWO].hidden);
await setControl('region', EACH, true);
await setControl('region', TWO, true);
await setControl('region', 'Repeat', false);
shown = await controlState('region', [EACH, TWO]);
check('both hidden when Repeat is unchecked', shown[EACH].hidden && shown[TWO].hidden);
await setControl('region', 'Repeat', true);

// One measure, quickly, metronome off, so the only clicks are count-ins.
await setControl('region', 'First measure', 1);
await setControl('region', 'Last measure', 1);
await setControl('region', 'Tempo', 240);
await setControl('region', 'Metronome', false);
await page.evaluate(() => { window.__starts = []; });
await page.evaluate(() => window.__region.querySelector('.audio-track button[aria-pressed]').click());
await pause(4000);
let groups = await clickGroups(0.4);
await page.evaluate(() => window.__region.querySelector('.audio-track button[aria-pressed]').click());
console.log(`  click groups: ${groups.map(g => g.length).join(', ')}`);
const beat = spacing(groups[0])[0];
check('the first count-in is a whole measure', groups[0]?.length >= 3, `${groups[0]?.length} clicks`);
check('each repeat is counted in with two clicks', groups.length >= 3 && groups.slice(1).every(g => g.length === 2),
    groups.map(g => g.length).join(', '));
check('a beat apart', groups.slice(1).every(g => near(spacing(g)[0], beat)),
    groups.slice(1).map(g => spacing(g)[0].toFixed(3)).join(', '));
// From one repeat's first click to the next: the two beats, then the measure.
const measure = beat * groups[0].length;
check('the music starts a beat after the second click',
    groups.slice(1, -1).every((g, i) => near(groups[i + 2][0] - g[0], 2 * beat + measure)),
    groups.slice(1, -1).map((g, i) => (groups[i + 2][0] - g[0]).toFixed(3)).join(', '));

// Unchecked again: a whole measure before every repeat, as before.
await setControl('region', TWO, false);
await page.evaluate(() => { window.__starts = []; });
await page.evaluate(() => window.__region.querySelector('.audio-track button[aria-pressed]').click());
await pause(4000);
groups = await clickGroups(0.4);
await page.evaluate(() => window.__region.querySelector('.audio-track button[aria-pressed]').click());
console.log(`  unchecked, click groups: ${groups.map(g => g.length).join(', ')}`);
check('unchecked, every repeat has a whole measure again',
    groups.length >= 2 && groups.slice(1).every(g => g.length === groups[0].length));

console.log('\n=== A chord practice tab ===');
await runMenuCommand(page, 'chord-practice');
await page.waitForTimeout(2500);

console.log('  The dialog');
shown = await controlState('#chord-practice-dialog', [EACH, TWO]);
check('the dialog has it, unchecked and hidden', shown[TWO] && !shown[TWO].checked && shown[TWO].hidden,
    JSON.stringify(shown[TWO]));
check('the dialog no longer says the count-in needs the metronome', await page.evaluate(() =>
    !document.getElementById('chord-practice-dialog').textContent.includes('metronome on')));
await setControl('#chord-practice-dialog', EACH, true);
shown = await controlState('#chord-practice-dialog', [TWO]);
check('shown once Count In Before Every Repeat is checked', !shown[TWO].hidden);
await setControl('#chord-practice-dialog', EACH, false);
shown = await controlState('#chord-practice-dialog', [TWO]);
check('hidden again when that is unchecked', shown[TWO].hidden);

await page.evaluate(() => {
    for (const id of ['chord-practice-metronome-checkbox', 'chord-practice-speak-checkbox']) {
        document.getElementById(id).checked = false;
    }
    document.getElementById('chord-practice-repeat-input').value = '0';
    document.getElementById('chord-practice-tempo-input').value = '240';
    document.getElementById('chord-practice-count-input').value = '2';
});
await setControl('#chord-practice-dialog', EACH, true);
await setControl('#chord-practice-dialog', TWO, true);
await page.click('#chord-practice-generate-button');
await page.waitForTimeout(1500);

console.log('  The tab');
shown = await controlState(VISIBLE_PANEL, [EACH, TWO]);
check('the tab starts with it checked, from the dialog', shown[TWO]?.checked && !shown[TWO].hidden,
    JSON.stringify(shown[TWO]));
await setControl(VISIBLE_PANEL, TWO, false);
shown = await controlState(VISIBLE_PANEL, [TWO]);
check('unchecking it in the tab leaves it shown', !shown[TWO].checked && !shown[TWO].hidden);
await setControl(VISIBLE_PANEL, EACH, false);
shown = await controlState(VISIBLE_PANEL, [TWO]);
check('hidden when Count In Before Every Repeat is unchecked', shown[TWO].hidden);
await setControl(VISIBLE_PANEL, EACH, true);
await setControl(VISIBLE_PANEL, 'Times to play', 1);
shown = await controlState(VISIBLE_PANEL, [EACH, TWO]);
check('both hidden when the progression plays once', shown[EACH].hidden && shown[TWO].hidden);
await setControl(VISIBLE_PANEL, 'Times to play', 0);
shown = await controlState(VISIBLE_PANEL, [TWO]);
check('shown again when it repeats', !shown[TWO].hidden);
await setControl(VISIBLE_PANEL, TWO, true);

const playTab = () => page.evaluate(panelSelector =>
    [...document.querySelector(panelSelector).querySelectorAll('button')]
        .find(b => b.hasAttribute('aria-pressed')).click(), VISIBLE_PANEL);
await page.evaluate(() => { window.__starts = []; });
await playTab();
await pause(6000);
groups = await clickGroups(0.4);
await playTab();
console.log(`  click groups: ${groups.map(g => g.length).join(', ')}`);
check('the first count-in is a whole measure', groups[0]?.length >= 3, `${groups[0]?.length} clicks`);
check('each repeat is counted in with two clicks', groups.length >= 2 && groups.slice(1).every(g => g.length === 2),
    groups.map(g => g.length).join(', '));
const tabBeat = 60 / 240;
check('a beat apart', groups.slice(1).every(g => near(spacing(g)[0], tabBeat)));
const passSeconds = 2 * groups[0].length * tabBeat;
check('the music starts a beat after the second click',
    groups.slice(1, -1).every((g, i) => near(groups[i + 2][0] - g[0], 2 * tabBeat + passSeconds)),
    groups.slice(1, -1).map((g, i) => (groups[i + 2][0] - g[0]).toFixed(3)).join(', '));

await close();
console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);

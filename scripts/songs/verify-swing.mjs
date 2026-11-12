// Verifies swing in the real app: a swung file opens with Swing checked, the strums are scheduled
// long then short, unchecking Swing plays them evenly, saving writes the feel, and the note beside
// the checkbox says when swing has nothing to move. Then the same checkbox in the Chord Practice
// dialog, the progression editor, the Strumming Patterns item and the Metronome.
//
// Strum times are read from the Web Audio calls: every start of a recorded note is noted, and the
// gaps between starts of the one note most often played are compared. Runs on a scratch profile.
// Asserts on text, structure, scheduled times and file contents, never on anything visual. What
// swing sounds like, and how NVDA reads the checkbox, is for Joel to judge.
//
//   node scripts/songs/verify-swing.mjs

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { songFromProgression, songToAlphaTex } from '../../src/shared/songScore.mjs';
import { patternsFor } from '../../src/shared/strummingPatterns.mjs';
import { APP_DIR, launchApp, runMenuCommand } from '../lib/app-ui.mjs';

const library = JSON.parse(await readFile(path.join(APP_DIR, 'src', 'assets', 'chords', 'chord-library.json'), 'utf8'));

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};

const { page, profile, close } = await launchApp();
const folder = path.join(profile, 'Documents', 'Unstrung', 'Progressions');
const consoleErrors = [];
page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('pageerror', error => consoleErrors.push(error.message));

const tab = () => page.evaluate(() => {
    const panel = document.querySelector('#item-panels > section:not([hidden])');
    const labelled = text => [...panel.querySelectorAll('label')].find(label => label.textContent.startsWith(text));
    const swing = panel.querySelector(`#${CSS.escape(labelled('Swing').htmlFor)}`);
    const note = document.getElementById(swing.getAttribute('aria-describedby'));
    const metaList = [...panel.querySelectorAll('ul:not(.chord-progression)')].find(ul => !ul.closest('details'));
    return {
        heading: panel.querySelector('h2')?.textContent,
        meta: [...(metaList?.querySelectorAll('li') ?? [])].map(li => li.textContent),
        swingLabel: labelled('Swing').textContent,
        swingType: swing.type,
        swingChecked: swing.checked,
        // The control before Swing, by its label: Swing should follow the strumming pattern.
        before: swing.closest('p').previousElementSibling?.querySelector('label')?.textContent ?? null,
        noteHidden: note?.hidden ?? null,
        note: note?.textContent ?? null
    };
});
const setCheckbox = (labelStart, checked) => page.evaluate(({ text, wanted }) => {
    const panel = document.querySelector('#item-panels > section:not([hidden])');
    const label = [...panel.querySelectorAll('label')].find(l => l.textContent.startsWith(text));
    const box = panel.querySelector(`#${CSS.escape(label.htmlFor)}`);
    if (box.checked !== wanted) box.click();
}, { text: labelStart, wanted: checked });
const clickInPanel = label => page.evaluate(text => {
    const panel = document.querySelector('#item-panels > section:not([hidden])');
    [...panel.querySelectorAll('button')].find(b => b.textContent === text).click();
}, label);

// Notes every start of a recorded sound, with a number for its recording.
await page.evaluate(() => {
    const buffers = new Map();
    window.__starts = [];
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (when, ...rest) {
        if (!buffers.has(this.buffer)) buffers.set(this.buffer, buffers.size);
        this.__entry = { buffer: buffers.get(this.buffer), when: when ?? 0 };
        window.__starts.push(this.__entry);
        return start.call(this, when, ...rest);
    };
    // A sound stopped before it was due never sounded: the metronome cancels what it had laid out
    // when a setting changes. `__sounded` leaves those out.
    const stop = AudioBufferSourceNode.prototype.stop;
    AudioBufferSourceNode.prototype.stop = function (when, ...rest) {
        if (this.__entry && (when ?? 0) <= this.__entry.when) this.__entry.cancelled = true;
        return stop.call(this, when, ...rest);
    };
    window.__sounded = () => window.__starts.filter(entry => !entry.cancelled);
});

/** Plays for a while and gives the gaps, in seconds, between starts of the note played most. */
async function strumGaps() {
    await page.evaluate(() => { window.__starts = []; });
    await clickInPanel('Play');
    await page.waitForTimeout(2500);
    await clickInPanel('Pause');
    const starts = await page.evaluate(() => window.__starts);
    const counts = new Map();
    for (const { buffer } of starts) counts.set(buffer, (counts.get(buffer) ?? 0) + 1);
    const most = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const whens = [...new Set(starts.filter(s => s.buffer === most).map(s => Math.round(s.when * 1000) / 1000))].sort((a, b) => a - b);
    return whens.slice(1).map((when, index) => Math.round((when - whens[index]) * 1000) / 1000);
}
const near = (value, wanted) => Math.abs(value - wanted) < 0.012;

try {
    // One chord throughout, so one recording is struck by every strum, down and up. Tempo 60: a
    // beat is a second, a swung pair 0.667 and 0.333, a straight pair 0.5 and 0.5.
    await mkdir(folder, { recursive: true });
    const pattern = patternsFor(4, 4).find(p => p.name === 'All Down-Up');
    const chords = Array.from({ length: 8 }, () => ({ root: 'G', suffix: 'major' }));
    const song = songFromProgression({ key: 'G', mode: 'major', beatsPerBar: 4, beatUnit: 4, chords },
        { library, tempo: 60, pattern, swing: true });
    const swungPath = path.join(folder, 'Swung.atex');
    await writeFile(swungPath, songToAlphaTex(song).text, 'utf8');

    console.log('=== Opening a swung progression ===');
    await runMenuCommand(page, 'open-progression');
    await page.waitForTimeout(1200);
    await page.evaluate(() => [...document.querySelectorAll('#progression-open-tree [role="treeitem"]')]
        .find(item => item.textContent === 'Swung').focus());
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);
    let state = await tab();
    console.log(`  meta: ${state.meta.join(' | ')}`);
    check('Swing is a checkbox labelled in words', state.swingType === 'checkbox' && state.swingLabel === 'Swing, each and played late', state.swingLabel);
    check('it follows the strumming pattern', state.before === 'Strumming pattern', String(state.before));
    check('it is checked, as the file says', state.swingChecked === true);
    check('the Metadata line says swung', state.meta.includes('Strumming - All Down-Up: D U D U D U D U, swung'), state.meta.join(' | '));
    check('no note, since the pattern can swing', state.noteHidden === true && state.note === '', String(state.note));

    console.log('\n=== Playing it ===');
    await setCheckbox('Count in, one measure', false);
    await setCheckbox('Speak the next measure', false);
    await page.waitForTimeout(800);
    const swung = await strumGaps();
    console.log(`  gaps: ${swung.join(' ')}`);
    check('strums come long then short, each pair a beat', swung.length >= 4 && swung[0] > swung[1] + 0.25 &&
        swung.every((gap, index) => near(gap, swung[index % 2])) && near(swung[0] + swung[1], 1), swung.join(' '));

    console.log('\n=== Unchecking Swing ===');
    await clickInPanel('Restart Progression');
    await setCheckbox('Swing', false);
    await page.waitForTimeout(300);
    state = await tab();
    check('the Metadata line no longer says swung', state.meta.includes('Strumming - All Down-Up: D U D U D U D U'), state.meta.join(' | '));
    check('it is not counted as an unsaved change', !/unsaved/.test(state.heading), state.heading);
    // The note measured is reached a little later in a downstroke's sweep than in an upstroke's,
    // so straight gaps are not exactly 0.5. What swing does is the difference between the two runs.
    const straight = await strumGaps();
    console.log(`  gaps: ${straight.join(' ')}`);
    check('straight, each and is near halfway', straight.length >= 4 && straight.every(gap => Math.abs(gap - 0.5) < 0.05), straight.join(' '));
    check('swung, each and came a sixth of a beat later: two thirds of the way instead of halfway',
        near(swung[0] - straight[0], 1 / 6) && near(straight[1] - swung[1], 1 / 6), `${swung[0]} against ${straight[0]}`);

    console.log('\n=== Saving ===');
    await clickInPanel('Save Progression');
    await page.waitForTimeout(800);
    check('saved straight, the file states no feel', !(await readFile(swungPath, 'utf8')).includes('\\tf'));
    await setCheckbox('Swing', true);
    await clickInPanel('Save Progression');
    await page.waitForTimeout(800);
    check('saved swung, the file states triplet eighths', (await readFile(swungPath, 'utf8')).includes('\\tf triplet8th'));

    console.log('\n=== Where swing has nothing to move ===');
    await runMenuCommand(page, 'chord-practice');
    await page.waitForTimeout(1500);
    await page.fill('#chord-practice-beats-input', '6');
    await page.fill('#chord-practice-beat-unit-input', '8');
    await page.click('#chord-practice-generate-button');
    await page.waitForTimeout(1500);
    state = await tab();
    check('a generated progression starts straight', state.swingChecked === false);
    check('in 6/8 the note says swing has no effect, as the checkbox\'s description',
        state.noteHidden === false && state.note === 'Swing has no effect in 6/8.', String(state.note));

    console.log('\n=== The Chord Practice dialog and the editor ===');
    const dialogSwing = () => page.evaluate(id => {
        const box = document.getElementById(`${id}-swing-checkbox`);
        const note = document.getElementById(box.getAttribute('aria-describedby'));
        return {
            label: document.querySelector(`label[for="${box.id}"]`)?.textContent, checked: box.checked,
            before: box.closest('p').previousElementSibling?.querySelector('label')?.textContent ?? null,
            note: note.hidden ? '' : note.textContent
        };
    }, 'chord-practice');
    await runMenuCommand(page, 'chord-practice');
    await page.waitForTimeout(1500);
    const setSignature = async (beats, unit) => {
        await page.fill('#chord-practice-beats-input', String(beats));
        await page.dispatchEvent('#chord-practice-beats-input', 'change');
        await page.fill('#chord-practice-beat-unit-input', String(unit));
        await page.dispatchEvent('#chord-practice-beat-unit-input', 'change');
    };
    await setSignature(6, 8);
    let inDialog = await dialogSwing();
    check('in 6/8 the dialog\'s Swing says it has no effect', inDialog.note === 'Swing has no effect in 6/8.', inDialog.note);
    await setSignature(4, 4);
    await page.selectOption('#chord-practice-pattern-select', { label: 'Old Faithful: D - D U - U D U' });
    inDialog = await dialogSwing();
    check('the dialog has Swing after Strumming pattern, unchecked, with no note in 4/4',
        inDialog.label === 'Swing, each and played late' && inDialog.before === 'Strumming pattern' && !inDialog.checked && inDialog.note === '',
        JSON.stringify(inDialog));
    await page.check('#chord-practice-swing-checkbox');
    await page.click('#chord-practice-generate-button');
    await page.waitForTimeout(1500);
    state = await tab();
    check('generated with Swing checked, the progression is swung', state.swingChecked === true &&
        state.meta.includes('Strumming - Old Faithful: D - D U - U D U, swung'), state.meta.join(' | '));

    await clickInPanel('Edit Progression');
    await page.waitForTimeout(600);
    const inEditor = await page.evaluate(() => {
        const box = document.getElementById('progression-editor-swing-checkbox');
        return {
            label: document.querySelector(`label[for="${box.id}"]`)?.textContent, checked: box.checked,
            before: box.closest('p').previousElementSibling?.querySelector('label')?.textContent ?? null
        };
    });
    check('the editor has Swing after Strumming pattern, checked as the progression is',
        inEditor.label === 'Swing, each and played late' && inEditor.before === 'Strumming pattern' && inEditor.checked, JSON.stringify(inEditor));
    await page.uncheck('#progression-editor-swing-checkbox');
    await page.click('#progression-editor-apply-button');
    await page.waitForTimeout(1000);
    state = await tab();
    check('unchecked there and applied, the progression is straight, with unsaved changes',
        state.swingChecked === false && state.meta.includes('Strumming - Old Faithful: D - D U - U D U') && /unsaved changes/.test(state.heading),
        `${state.heading} | ${state.meta.join(' | ')}`);

    console.log('\n=== The Strumming Patterns item ===');
    const choosePattern = (labelStart, signature, patternText) => page.evaluate(({ start, signature, text }) => {
        const panel = document.querySelector('#item-panels > section:not([hidden])');
        const byLabel = name => document.getElementById([...panel.querySelectorAll('label')].find(l => l.textContent === name).htmlFor);
        const signatures = byLabel('Time signature');
        signatures.value = signature;
        signatures.dispatchEvent(new Event('change'));
        const list = byLabel(start);
        list.value = [...list.options].find(o => o.textContent.startsWith(text)).value;
        list.dispatchEvent(new Event('change'));
    }, { start: labelStart, signature, text: patternText });
    await runMenuCommand(page, 'strumming-patterns');
    await page.waitForTimeout(1200);
    await choosePattern('Pattern', '6/8', 'All Down-Up');
    state = await tab();
    check('it has Swing, which says it has no effect in 6/8', state.swingLabel === 'Swing, each and played late' &&
        state.noteHidden === false && state.note === 'Swing has no effect in 6/8.', String(state.note));
    await choosePattern('Pattern', '4/4', 'All Down-Up');
    state = await tab();
    check('and no note in 4/4', state.noteHidden === true, String(state.note));
    // Whatever the preview's tempo, a pair of gaps is a beat, and swing moves the and a sixth of it.
    const previewStraight = await strumGaps();
    await setCheckbox('Swing', true);
    const previewSwung = await strumGaps();
    console.log(`  straight: ${previewStraight.slice(0, 4).join(' ')}; swung: ${previewSwung.slice(0, 4).join(' ')}`);
    check('Play with Swing checked plays each and a sixth of a beat later',
        previewStraight.length >= 2 && previewSwung.length >= 2 &&
        near(previewSwung[0] - previewStraight[0], (previewStraight[0] + previewStraight[1]) / 6) &&
        near(previewSwung[0] + previewSwung[1], previewStraight[0] + previewStraight[1]), `${previewSwung[0]} against ${previewStraight[0]}`);

    // The New Strumming Pattern dialog opens from the item, and its Play follows the item's Swing.
    const dialogGaps = async () => {
        await page.evaluate(() => { window.__starts = []; });
        await page.click('#pattern-play-button');
        await page.waitForTimeout(2500);
        await page.click('#pattern-play-button');
        const starts = await page.evaluate(() => window.__starts);
        const counts = new Map();
        for (const { buffer } of starts) counts.set(buffer, (counts.get(buffer) ?? 0) + 1);
        const most = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        const whens = [...new Set(starts.filter(s => s.buffer === most).map(s => Math.round(s.when * 1000) / 1000))].sort((a, b) => a - b);
        return whens.slice(1).map((when, index) => Math.round((when - whens[index]) * 1000) / 1000);
    };
    await clickInPanel('New Pattern');
    await page.waitForTimeout(300);
    await page.fill('#pattern-strokes-input', 'D U D U D U D U');
    const dialogSwung = await dialogGaps();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await setCheckbox('Swing', false);
    await clickInPanel('New Pattern');
    await page.waitForTimeout(300);
    await page.fill('#pattern-strokes-input', 'D U D U D U D U');
    const dialogStraight = await dialogGaps();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    console.log(`  dialog straight: ${dialogStraight.slice(0, 4).join(' ')}; swung: ${dialogSwung.slice(0, 4).join(' ')}`);
    check('the New Strumming Pattern dialog\'s Play is swung when the item\'s Swing is checked, and straight when not',
        dialogStraight.length >= 2 && dialogSwung.length >= 2 &&
        near(dialogSwung[0] - dialogStraight[0], (dialogStraight[0] + dialogStraight[1]) / 6) &&
        near(dialogStraight[0], previewStraight[0]), `${dialogSwung.slice(0, 2).join(' ')} against ${dialogStraight.slice(0, 2).join(' ')}`);

    console.log('\n=== The Metronome item ===');
    const clickGaps = async () => {
        await page.evaluate(() => { window.__starts = []; });
        await clickInPanel('Start');
        await page.waitForTimeout(2600);
        await clickInPanel('Stop');
        const whens = (await page.evaluate(() => window.__starts)).map(s => Math.round(s.when * 1000) / 1000).sort((a, b) => a - b);
        return whens.slice(1).map((when, index) => Math.round((when - whens[index]) * 1000) / 1000);
    };
    await runMenuCommand(page, 'metronome');
    await page.waitForTimeout(1200);
    await choosePattern('Strumming pattern', '4/4', 'All Down-Up');
    state = await tab();
    check('it has Swing after the clicks are described, unchecked', state.swingLabel === 'Swing, each and played late' && !state.swingChecked);
    // Tempo 60: clicks half a second apart straight, two thirds and one third swung.
    let clicks = await clickGaps();
    console.log(`  straight: ${clicks.join(' ')}`);
    check('straight, the clicks are even', clicks.length >= 3 && clicks.every(gap => near(gap, 0.5)), clicks.join(' '));
    await setCheckbox('Swing', true);
    clicks = await clickGaps();
    console.log(`  swung: ${clicks.join(' ')}`);
    check('swung, they come two thirds and one third of a beat apart',
        clicks.length >= 3 && clicks.every((gap, index) => near(gap, index % 2 === 0 ? 0.667 : 0.333)), clicks.join(' '));
    // Changed while it plays, it carries on: no click is lost or doubled, and each pair is still a beat.
    await page.evaluate(() => { window.__starts = []; });
    await clickInPanel('Start');
    await page.waitForTimeout(1300);
    await setCheckbox('Swing', false);
    await page.waitForTimeout(1500);
    await clickInPanel('Stop');
    const through = [...new Set((await page.evaluate(() => window.__sounded())).map(s => Math.round(s.when * 1000) / 1000))].sort((a, b) => a - b);
    const beatGaps = through.filter((_, index) => index % 2 === 0).slice(1).map((when, index) => Math.round((when - through[index * 2]) * 1000) / 1000);
    check('unchecking Swing while it plays keeps the beat', beatGaps.length >= 2 && beatGaps.every(gap => near(gap, 1)), through.join(' '));
    await choosePattern('Strumming pattern', '6/8', 'All Down-Up');
    state = await tab();
    check('in 6/8 it says Swing has no effect', state.note === 'Swing has no effect in 6/8.', String(state.note));

    check('no errors in the console', consoleErrors.length === 0, consoleErrors.join(' ; '));
} finally {
    await close();
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exitCode = failures === 0 ? 0 : 1;

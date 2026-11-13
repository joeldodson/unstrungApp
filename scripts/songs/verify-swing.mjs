// Verifies the Feel list in the real app (docs/one-player.md, decision 18), which took the place of
// the Swing checkbox: in the Metronome on 2026-11-12, and everywhere else in stage 3 of the same
// day, once progressions played on the audio track player. A swung file opens with Triplet eighths
// (swing) chosen, the strums are scheduled long then short, Straight plays them evenly, Dotted
// eighths puts each and three quarters of the way through the beat, a file stating dotted eighths
// opens with them, saving writes the feel, and the note beside the list says when the feel has
// nothing to move. Then the same list in the Chord Practice dialog, the progression editor and the
// Strumming Patterns item, and the Metronome's.
//
// Strum times are read from the Web Audio calls: every start of a recorded note is noted, and the
// gaps between starts of the one note most often played are compared. Runs on a scratch profile.
// Asserts on text, structure, scheduled times and file contents, never on anything visual. What
// a feel sounds like, and how NVDA reads the list, is for Joel to judge.
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

const FEEL_OPTIONS = 'Straight | Triplet eighths (swing) | Dotted eighths | Scottish eighths | ' +
    'Triplet sixteenths | Dotted sixteenths | Scottish sixteenths';

const tab = () => page.evaluate(() => {
    const panel = document.querySelector('#item-panels > section:not([hidden])');
    const labelled = text => [...panel.querySelectorAll('label')].find(label => label.textContent.startsWith(text));
    const feel = panel.querySelector(`#${CSS.escape(labelled('Feel').htmlFor)}`);
    const note = document.getElementById(feel.getAttribute('aria-describedby'));
    const metaList = [...panel.querySelectorAll('ul:not(.chord-progression)')].find(ul => !ul.closest('details'));
    return {
        heading: panel.querySelector('h2')?.textContent,
        meta: [...(metaList?.querySelectorAll('li') ?? [])].map(li => li.textContent),
        feelType: feel.tagName,
        feel: feel.value,
        options: [...feel.options].map(o => o.textContent).join(' | '),
        noSwing: ![...panel.querySelectorAll('label')].some(l => l.textContent.startsWith('Swing')),
        // The control before Feel, by its label: Feel should follow the strumming pattern.
        before: feel.closest('p').previousElementSibling?.querySelector('label')?.textContent ?? null,
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
const setFeel = value => page.evaluate(value => {
    const panel = document.querySelector('#item-panels > section:not([hidden])');
    const label = [...panel.querySelectorAll('label')].find(l => l.textContent === 'Feel');
    const select = panel.querySelector(`#${CSS.escape(label.htmlFor)}`);
    select.value = value;
    select.dispatchEvent(new Event('change'));
}, value);
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

async function openSaved(name) {
    await runMenuCommand(page, 'open-progression');
    await page.waitForTimeout(1200);
    await page.evaluate(name => [...document.querySelectorAll('#progression-open-tree [role="treeitem"]')]
        .find(item => item.textContent === name).focus(), name);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);
}

try {
    // One chord throughout, so one recording is struck by every strum, down and up. Tempo 60: a
    // beat is a second, a swung pair 0.667 and 0.333, a straight pair 0.5 and 0.5, a dotted pair
    // 0.75 and 0.25.
    await mkdir(folder, { recursive: true });
    const pattern = patternsFor(4, 4).find(p => p.name === 'All Down-Up');
    const chords = Array.from({ length: 8 }, () => ({ root: 'G', suffix: 'major' }));
    const write = async (name, feel) => {
        const song = songFromProgression({ key: 'G', mode: 'major', beatsPerBar: 4, beatUnit: 4, chords },
            { library, tempo: 60, pattern, feel });
        const file = path.join(folder, `${name}.atex`);
        await writeFile(file, songToAlphaTex(song).text, 'utf8');
        return file;
    };
    const swungPath = await write('Swung', 'triplet8th');
    await write('Dotted', 'dotted8th');

    console.log('=== Opening a swung progression ===');
    await openSaved('Swung');
    let state = await tab();
    console.log(`  meta: ${state.meta.join(' | ')}`);
    check('Feel is a list of Straight and the six feels, with no Swing checkbox', state.feelType === 'SELECT' &&
        state.options === FEEL_OPTIONS && state.noSwing, state.options);
    check('it follows the strumming pattern', state.before === 'Strumming pattern', String(state.before));
    check('it is on Triplet eighths (swing), as the file says', state.feel === 'triplet8th', state.feel);
    check('the Metadata line names the feel', state.meta.includes('Strumming - All Down-Up: D U D U D U D U, triplet eighths (swing)'), state.meta.join(' | '));
    check('no note, since the pattern can swing', state.noteHidden === true && state.note === '', String(state.note));

    console.log('\n=== Playing it ===');
    await setCheckbox('Count in, one measure', false);
    await setCheckbox('Speak the next measure', false);
    await page.waitForTimeout(800);
    const swung = await strumGaps();
    console.log(`  gaps: ${swung.join(' ')}`);
    check('strums come long then short, each pair a beat', swung.length >= 4 && swung[0] > swung[1] + 0.25 &&
        swung.every((gap, index) => near(gap, swung[index % 2])) && near(swung[0] + swung[1], 1), swung.join(' '));

    console.log('\n=== Straight ===');
    await clickInPanel('Restart Selection');
    await setFeel('');
    await page.waitForTimeout(300);
    state = await tab();
    check('the Metadata line no longer names a feel', state.meta.includes('Strumming - All Down-Up: D U D U D U D U'), state.meta.join(' | '));
    check('it is not counted as an unsaved change', !/unsaved/.test(state.heading), state.heading);
    // The note measured is reached a little later in a downstroke's sweep than in an upstroke's,
    // so straight gaps are not exactly 0.5. What a feel does is the difference between the runs.
    const straight = await strumGaps();
    console.log(`  gaps: ${straight.join(' ')}`);
    check('straight, each and is near halfway', straight.length >= 4 && straight.every(gap => Math.abs(gap - 0.5) < 0.05), straight.join(' '));
    check('swung, each and came a sixth of a beat later: two thirds of the way instead of halfway',
        near(swung[0] - straight[0], 1 / 6) && near(straight[1] - swung[1], 1 / 6), `${swung[0]} against ${straight[0]}`);

    console.log('\n=== Dotted eighths ===');
    await clickInPanel('Restart Selection');
    await setFeel('dotted8th');
    await page.waitForTimeout(300);
    const dotted = await strumGaps();
    console.log(`  gaps: ${dotted.join(' ')}`);
    check('each and comes a quarter of a beat late: three quarters of the way through',
        dotted.length >= 2 && near(dotted[0] - straight[0], 1 / 4) && near(straight[1] - dotted[1], 1 / 4), `${dotted[0]} against ${straight[0]}`);

    console.log('\n=== Saving ===');
    await setFeel('');
    await clickInPanel('Save Progression');
    await page.waitForTimeout(800);
    check('saved straight, the file states no feel', !(await readFile(swungPath, 'utf8')).includes('\\tf'));
    await setFeel('scottish8th');
    await clickInPanel('Save Progression');
    await page.waitForTimeout(800);
    check('saved with Scottish eighths, the file states them', (await readFile(swungPath, 'utf8')).includes('\\tf scottish8th'));

    console.log('\n=== Opening a file in dotted eighths ===');
    await openSaved('Dotted');
    state = await tab();
    check('it opens, with Dotted eighths chosen', state.feel === 'dotted8th' &&
        state.meta.includes('Strumming - All Down-Up: D U D U D U D U, dotted eighths'), `${state.feel} | ${state.meta.join(' | ')}`);

    console.log('\n=== Where a feel has nothing to move ===');
    await runMenuCommand(page, 'chord-practice');
    await page.waitForTimeout(1500);
    await page.fill('#chord-practice-beats-input', '6');
    await page.fill('#chord-practice-beat-unit-input', '8');
    await page.selectOption('#chord-practice-feel-select', 'triplet8th');
    await page.click('#chord-practice-generate-button');
    await page.waitForTimeout(1500);
    state = await tab();
    check('in 6/8 triplet eighths has no effect, which the note says as the list\'s description',
        state.feel === 'triplet8th' && state.noteHidden === false && state.note === 'This feel has no effect in 6/8.', `${state.feel} ${state.note}`);
    check('and the Metadata line names no feel', state.meta.some(m => /^Strumming - [^,]+$/.test(m)), state.meta.join(' | '));
    await setFeel('triplet16th');
    state = await tab();
    check('a sixteenth feel over a pattern with no sixteenths says so', state.note === 'This feel has no effect on a pattern with no sixteenths.', state.note);

    console.log('\n=== The Chord Practice dialog and the editor ===');
    const dialogFeel = () => page.evaluate(id => {
        const select = document.getElementById(`${id}-feel-select`);
        const note = document.getElementById(select.getAttribute('aria-describedby'));
        return {
            label: document.querySelector(`label[for="${select.id}"]`)?.textContent, value: select.value,
            options: [...select.options].map(o => o.textContent).join(' | '),
            before: select.closest('p').previousElementSibling?.querySelector('label')?.textContent ?? null,
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
    let inDialog = await dialogFeel();
    check('the dialog opens on Straight, after Strumming pattern, with the seven choices',
        inDialog.label === 'Feel' && inDialog.value === '' && inDialog.before === 'Strumming pattern' && inDialog.options === FEEL_OPTIONS,
        JSON.stringify(inDialog));
    await page.selectOption('#chord-practice-feel-select', 'triplet8th');
    await setSignature(6, 8);
    inDialog = await dialogFeel();
    check('in 6/8 the dialog\'s note says the feel has no effect', inDialog.note === 'This feel has no effect in 6/8.', inDialog.note);
    await setSignature(4, 4);
    await page.selectOption('#chord-practice-pattern-select', { label: 'Old Faithful: D - D U - U D U' });
    inDialog = await dialogFeel();
    check('and no note in 4/4', inDialog.note === '', inDialog.note);
    await page.click('#chord-practice-generate-button');
    await page.waitForTimeout(1500);
    state = await tab();
    check('generated with Triplet eighths, the progression has them', state.feel === 'triplet8th' &&
        state.meta.includes('Strumming - Old Faithful: D - D U - U D U, triplet eighths (swing)'), state.meta.join(' | '));

    await clickInPanel('Edit Progression');
    await page.waitForTimeout(600);
    const inEditor = await page.evaluate(() => {
        const select = document.getElementById('progression-editor-feel-select');
        return {
            label: document.querySelector(`label[for="${select.id}"]`)?.textContent, value: select.value,
            before: select.closest('p').previousElementSibling?.querySelector('label')?.textContent ?? null
        };
    });
    check('the editor has Feel after Strumming pattern, as the progression has it',
        inEditor.label === 'Feel' && inEditor.before === 'Strumming pattern' && inEditor.value === 'triplet8th', JSON.stringify(inEditor));
    await page.selectOption('#progression-editor-feel-select', '');
    await page.click('#progression-editor-apply-button');
    await page.waitForTimeout(1000);
    state = await tab();
    check('Straight there and applied, the progression is straight, with unsaved changes',
        state.feel === '' && state.meta.includes('Strumming - Old Faithful: D - D U - U D U') && /unsaved changes/.test(state.heading),
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
    await setFeel('triplet8th');
    await choosePattern('Pattern', '6/8', 'All Down-Up');
    state = await tab();
    check('it has the Feel list, whose note says triplet eighths have no effect in 6/8', state.options === FEEL_OPTIONS &&
        state.noteHidden === false && state.note === 'This feel has no effect in 6/8.', String(state.note));
    await choosePattern('Pattern', '4/4', 'All Down-Up');
    state = await tab();
    check('and no note in 4/4', state.noteHidden === true, String(state.note));
    // Whatever the preview's tempo, a pair of gaps is a beat, and swing moves the and a sixth of it.
    await setFeel('');
    const previewStraight = await strumGaps();
    await setFeel('triplet8th');
    const previewSwung = await strumGaps();
    console.log(`  straight: ${previewStraight.slice(0, 4).join(' ')}; swung: ${previewSwung.slice(0, 4).join(' ')}`);
    check('Play with Triplet eighths plays each and a sixth of a beat later',
        previewStraight.length >= 2 && previewSwung.length >= 2 &&
        near(previewSwung[0] - previewStraight[0], (previewStraight[0] + previewStraight[1]) / 6) &&
        near(previewSwung[0] + previewSwung[1], previewStraight[0] + previewStraight[1]), `${previewSwung[0]} against ${previewStraight[0]}`);

    // The New Strumming Pattern dialog opens from the item, and its Play follows the item's Feel.
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
    await setFeel('');
    await clickInPanel('New Pattern');
    await page.waitForTimeout(300);
    await page.fill('#pattern-strokes-input', 'D U D U D U D U');
    const dialogStraight = await dialogGaps();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    console.log(`  dialog straight: ${dialogStraight.slice(0, 4).join(' ')}; swung: ${dialogSwung.slice(0, 4).join(' ')}`);
    check('the New Strumming Pattern dialog\'s Play follows the item\'s Feel: swung, then straight',
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
    // Since 2026-11-12 the Metronome has a Feel list in place of Swing (docs/one-player.md,
    // decision 18): Straight and the six feels, each pairing eighths or sixteenths.
    const feelState = () => page.evaluate(() => {
        const panel = document.querySelector('#item-panels > section:not([hidden])');
        const label = [...panel.querySelectorAll('label')].find(l => l.textContent === 'Feel');
        const select = label && document.getElementById(label.htmlFor);
        const note = select && document.getElementById(select.getAttribute('aria-describedby'));
        return {
            type: select?.tagName, value: select?.value, chosen: select?.selectedOptions[0]?.textContent,
            options: [...(select?.options ?? [])].map(o => o.textContent),
            afterAbout: select?.closest('p').previousElementSibling?.textContent.startsWith('Clicks on'),
            noSwing: ![...panel.querySelectorAll('label')].some(l => l.textContent.startsWith('Swing')),
            note: note?.hidden ? '' : note?.textContent ?? null
        };
    });
    const chooseFeel = text => page.evaluate(wanted => {
        const panel = document.querySelector('#item-panels > section:not([hidden])');
        const select = document.getElementById([...panel.querySelectorAll('label')].find(l => l.textContent === 'Feel').htmlFor);
        select.value = [...select.options].find(o => o.textContent === wanted).value;
        select.dispatchEvent(new Event('change'));
    }, text);
    await runMenuCommand(page, 'metronome');
    await page.waitForTimeout(1200);
    await choosePattern('Strumming pattern', '4/4', 'All Down-Up');
    let feel = await feelState();
    check('it has a Feel list after the clicks are described, at Straight, and no Swing checkbox',
        feel.type === 'SELECT' && feel.afterAbout && feel.chosen === 'Straight' && feel.noSwing, JSON.stringify(feel));
    check('offering Straight and the six feels', feel.options.join('|') === 'Straight|Triplet eighths (swing)|Dotted eighths|' +
        'Scottish eighths|Triplet sixteenths|Dotted sixteenths|Scottish sixteenths', feel.options.join('|'));
    // Tempo 60: clicks half a second apart straight; each feel moves the and of each beat.
    let clicks = await clickGaps();
    console.log(`  straight: ${clicks.join(' ')}`);
    check('straight, the clicks are even', clicks.length >= 3 && clicks.every(gap => near(gap, 0.5)), clicks.join(' '));
    for (const [name, long] of [['Triplet eighths (swing)', 0.667], ['Dotted eighths', 0.75], ['Scottish eighths', 0.25]]) {
        await chooseFeel(name);
        clicks = await clickGaps();
        console.log(`  ${name}: ${clicks.join(' ')}`);
        check(`${name}: the and comes ${long} of a beat after the beat`,
            clicks.length >= 3 && clicks.every((gap, index) => near(gap, index % 2 === 0 ? long : 1 - long)), clicks.join(' '));
    }
    await chooseFeel('Triplet sixteenths');
    check('a sixteenth feel over eighths says it has no effect',
        (await feelState()).note === 'This feel has no effect on a pattern with no sixteenths.', String((await feelState()).note));
    clicks = await clickGaps();
    check('and the clicks are even', clicks.length >= 3 && clicks.every(gap => near(gap, 0.5)), clicks.join(' '));
    // Changed while it plays, it carries on: no click is lost or doubled, and each pair is still a beat.
    await chooseFeel('Triplet eighths (swing)');
    await page.evaluate(() => { window.__starts = []; });
    await clickInPanel('Start');
    await page.waitForTimeout(1300);
    await chooseFeel('Straight');
    await page.waitForTimeout(1500);
    await clickInPanel('Stop');
    const through = [...new Set((await page.evaluate(() => window.__sounded())).map(s => Math.round(s.when * 1000) / 1000))].sort((a, b) => a - b);
    const beatGaps = through.filter((_, index) => index % 2 === 0).slice(1).map((when, index) => Math.round((when - through[index * 2]) * 1000) / 1000);
    check('changing the feel while it plays keeps the beat', beatGaps.length >= 2 && beatGaps.every(gap => near(gap, 1)), through.join(' '));
    await chooseFeel('Dotted eighths');
    await choosePattern('Strumming pattern', '6/8', 'All Down-Up');
    feel = await feelState();
    check('in 6/8 an eighth feel says it has no effect', feel.note === 'This feel has no effect in 6/8.', String(feel.note));
    await chooseFeel('Straight');
    check('and Straight says nothing', (await feelState()).note === '', String((await feelState()).note));

    check('no errors in the console', consoleErrors.length === 0, consoleErrors.join(' ; '));
} finally {
    await close();
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exitCode = failures === 0 ? 0 : 1;

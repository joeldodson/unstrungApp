// Checks Play in the Strumming Patterns item since it moved to the audio track player
// (docs/one-player.md, decision 19, and stage 3 step 3):
//
// - It plays the pattern at once, with no count-in, a strum on each beat of Down Only in 2/4 at the
//   preview's tempo, and a metronome click on each beat with it.
// - It goes on past its eight measures, Loop being on.
// - It leaves a progression playing in another item alone.
// - The chord library playing stops it, and its button reads Play again.
//
// Drives the Electron app on a scratch profile, judged from the DOM and from the times sounds are
// started at, never from anything visual.
//
//   npm run build:renderer
//   node scripts/songs/verify-pattern-preview.mjs

import { launchApp, runMenuCommand } from '../lib/app-ui.mjs';

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const { page, close } = await launchApp();
const consoleErrors = [];
page.on('pageerror', error => consoleErrors.push(error.message));

// Every sound started, with its time, how long its recording is, and the context's time then.
await page.evaluate(() => {
    window.__starts = [];
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (when, ...rest) {
        window.__starts.push({ when: when ?? 0, length: this.buffer?.duration ?? 0, now: this.context.currentTime });
        return start.call(this, when, ...rest);
    };
});

// The toggle button of the item whose heading starts with `heading`, wherever it is.
const playButton = heading => page.evaluate(start => {
    const section = [...document.querySelectorAll('#item-panels > section')]
        .find(s => s.querySelector('h2')?.textContent.startsWith(start));
    const button = section?.querySelector('button[aria-pressed]');
    return button ? { label: button.textContent, pressed: button.getAttribute('aria-pressed') } : null;
}, heading);
const pressInPanel = label => page.evaluate(text => {
    const panel = document.querySelector('#item-panels > section:not([hidden])');
    [...panel.querySelectorAll('button')].find(b => b.textContent === text).click();
}, label);

try {
    // Showing another item pauses a progression unless this setting is off (docs/one-player.md,
    // decision 7), and the preview is in another item; with it off, what is checked is that the
    // preview itself leaves the progression alone.
    await runMenuCommand(page, 'settings');
    await wait(800);
    await page.evaluate(() => {
        const box = document.getElementById('settings-auto-collapse-checkbox');
        if (box.checked) box.click();
    });
    await page.click('#settings-ok-button');
    await wait(400);

    console.log('A progression playing');
    await runMenuCommand(page, 'chord-practice');
    await wait(1500);
    await page.click('#chord-practice-generate-button');
    await wait(1500);
    await pressInPanel('Play');
    await wait(3000);
    check('a generated progression plays', (await playButton('Chord Practice'))?.pressed === 'true',
        JSON.stringify(await playButton('Chord Practice')));

    console.log('\nPlay in the Strumming Patterns item');
    await runMenuCommand(page, 'strumming-patterns');
    await wait(1200);
    await page.evaluate(() => {
        const panel = document.querySelector('#item-panels > section:not([hidden])');
        const byLabel = name => document.getElementById([...panel.querySelectorAll('label')].find(l => l.textContent === name).htmlFor);
        const signatures = byLabel('Time signature');
        signatures.value = '2/4';
        signatures.dispatchEvent(new Event('change'));
        const list = byLabel('Pattern');
        list.value = [...list.options].find(o => o.textContent.startsWith('Down Only')).value;
        list.dispatchEvent(new Event('change'));
    });
    await page.evaluate(() => { window.__starts = []; });
    await pressInPanel('Play');
    await wait(5000);
    check('it plays, the button reading Pause', (await playButton('Strumming Patterns'))?.label === 'Pause');
    check('the progression is still playing', (await playButton('Chord Practice'))?.pressed === 'true',
        JSON.stringify(await playButton('Chord Practice')));

    // The preview's sounds are those laid out after Play was pressed and in the preview's own
    // schedule; the progression's are mixed in, so they are told apart by being on the preview's
    // grid: a beat a second from its first strum.
    const starts = await page.evaluate(() => window.__starts);
    const pressedAt = Math.min(...starts.map(s => s.now));
    const clicks = starts.filter(s => s.length < 0.1).map(s => s.when).sort((a, b) => a - b);
    const notes = starts.filter(s => s.length >= 0.1).map(s => s.when).sort((a, b) => a - b);
    const first = clicks.find(at => at >= pressedAt);
    const onGrid = at => Math.abs((at - first) - Math.round(at - first)) < 0.06;
    const previewClicks = clicks.filter(at => at >= first - 1e-6 && onGrid(at));
    // A note recording is started a little before its beat, by its attack, so a strum's notes fall
    // up to a few hundredths before the beat and, spread across the strings, up to a tenth after.
    const strumNear = beat => notes.some(at => at > beat - 0.06 && at < beat + 0.12);
    check('no count-in: the first click comes straight away', first - pressedAt < 0.3, `${(first - pressedAt).toFixed(3)} s`);
    const beats = previewClicks.slice(0, 16);
    check('a click on each beat, a second apart at 60', beats.length >= 12 &&
        beats.every((at, i) => i === 0 || Math.abs(at - beats[i - 1] - 1) < 0.01), beats.map(at => (at - first).toFixed(2)).join(' '));
    check('and a strum on each of them', beats.every(strumNear),
        beats.filter(beat => !strumNear(beat)).map(at => (at - first).toFixed(2)).join(' ') || '');
    // Eight measures of two beats are 16 seconds; the scheduler lays out twelve ahead.
    await wait(12000);
    const later = await page.evaluate(() => window.__starts.map(s => s.when));
    check('it goes on past its eight measures', later.some(at => at > first + 16.5),
        `latest ${(Math.max(...later) - first).toFixed(1)} s after the first click`);

    console.log('\nThe chord library playing');
    await runMenuCommand(page, 'chord-library');
    await wait(3000);
    // As verify-chord-playback-list does: searching queues the first result once focus moves on.
    await page.evaluate(() => {
        const input = document.getElementById('chords-search-input');
        input.focus();
        input.value = 'C';
        input.dispatchEvent(new Event('input'));
    });
    await wait(500);
    await page.evaluate(() => {
        document.getElementById('chords-search-input').blur();
        document.getElementById('chords-level-select').focus();
    });
    await wait(700);
    await page.evaluate(() => document.getElementById('chords-play-button').click());
    await wait(800);
    check('stops the preview, whose button reads Play', (await playButton('Strumming Patterns'))?.label === 'Play',
        JSON.stringify(await playButton('Strumming Patterns')));
    // With the collapse setting on, leaving the Strumming Patterns item stops the preview (Joel,
    // end of stage 3).
    console.log('\nLeaving the item');
    await runMenuCommand(page, 'settings');
    await wait(800);
    await page.evaluate(() => {
        const box = document.getElementById('settings-auto-collapse-checkbox');
        if (!box.checked) box.click();
    });
    await page.click('#settings-ok-button');
    await wait(400);
    await runMenuCommand(page, 'strumming-patterns');
    await wait(800);
    await pressInPanel('Play');
    await wait(2000);
    check('Play plays again', (await playButton('Strumming Patterns'))?.label === 'Pause');
    await runMenuCommand(page, 'chord-library');
    await wait(800);
    check('showing another item stops it, with the setting on', (await playButton('Strumming Patterns'))?.label === 'Play',
        JSON.stringify(await playButton('Strumming Patterns')));
    check('no errors in the page', consoleErrors.length === 0, consoleErrors.join(' | '));
} finally {
    await close();
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exitCode = failures === 0 ? 0 : 1;

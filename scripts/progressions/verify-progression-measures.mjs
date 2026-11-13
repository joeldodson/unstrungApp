// Checks Measures to Play and Add measure N to selection in a progression (docs/one-player.md,
// decisions 3 and 4, stage 3 step 6):
//
// - Playback Settings has Measures to Play, collapsed, with First and Last measure to play and no
//   Section list, summarised as Entire Progression.
// - Each item of the Progression list is its chords and one button, Add measure N to selection.
// - A measure outside the selection stretches it; one inside becomes the whole selection; each
//   says what the selection now is, and stops anything playing.
// - Only the selection plays, and Where Am I counts against it.
//
// Drives the Electron app on a scratch profile, judged from the DOM and the announcement line.
//
//   npm run build:renderer
//   node scripts/progressions/verify-progression-measures.mjs

import { launchApp, runMenuCommand } from '../lib/app-ui.mjs';

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const { page, close } = await launchApp();
const errors = [];
page.on('pageerror', error => errors.push(error.message));

const read = () => page.evaluate(() => {
    const panel = document.querySelector('#item-panels > section:not([hidden])');
    const control = start => document.getElementById([...panel.querySelectorAll('label')]
        .find(l => l.textContent.startsWith(start))?.htmlFor);
    const details = panel.querySelector('.audio-track details');
    const play = panel.querySelector('.audio-track button[aria-pressed]');
    return {
        items: [...panel.querySelectorAll('ul.progression-list > li')].map(li => ({
            chords: li.firstChild.textContent.trim(),
            buttons: [...li.querySelectorAll('button')].map(b => b.textContent)
        })),
        summary: details?.querySelector('summary')?.textContent,
        collapsed: details ? !details.open : null,
        inside: details ? [...details.querySelectorAll('label')].map(l => l.textContent) : [],
        first: control('First measure to play')?.value,
        last: control('Last measure to play')?.value,
        playing: play?.getAttribute('aria-pressed') === 'true',
        announce: panel.querySelector('.audio-track p[aria-live="polite"]:not([role])')?.textContent
    };
});
const add = measure => page.evaluate(measure => {
    const panel = document.querySelector('#item-panels > section:not([hidden])');
    const button = [...panel.querySelectorAll('ul.progression-list button')].find(b => b.textContent === `Add measure ${measure} to selection`);
    button.focus();
    button.click();
}, measure);
const press = name => page.evaluate(name => {
    const panel = document.querySelector('#item-panels > section:not([hidden])');
    const button = [...panel.querySelectorAll('.audio-track button')].find(b => b.textContent === name);
    button.focus();
    button.click();
}, name);
const setField = (labelStart, value) => page.evaluate(({ start, value }) => {
    const panel = document.querySelector('#item-panels > section:not([hidden])');
    const input = document.getElementById([...panel.querySelectorAll('label')].find(l => l.textContent.startsWith(start)).htmlFor);
    if (input.type === 'checkbox') { if (input.checked !== value) input.click(); }
    else { input.value = value; input.dispatchEvent(new Event('change')); }
}, { start: labelStart, value });
const waitFor = async (test, seconds) => {
    for (let i = 0; i < seconds * 10; i++) {
        if (test(await read())) return true;
        await wait(100);
    }
    return false;
};

try {
    // Six measures of 4/4 at 240: a second a measure.
    await runMenuCommand(page, 'chord-practice');
    await wait(1200);
    await page.fill('#chord-practice-tempo-input', '240');
    await page.fill('#chord-practice-count-input', '6');
    await page.uncheck('#chord-practice-speak-checkbox');
    // Played once, so that playing a selection ends.
    await page.uncheck('#chord-practice-loop-checkbox');
    await page.click('#chord-practice-generate-button');
    await wait(1500);

    console.log('Measures to Play');
    let r = await read();
    check('collapsed, summarised as Entire Progression', r.summary === 'Measures to Play - Entire Progression' && r.collapsed,
        `${r.summary} ${r.collapsed}`);
    check('First and Last measure to play, and no Section list', r.inside.join(' | ') === 'First measure to play | Last measure to play',
        r.inside.join(' | '));
    check('from 1 to 6', r.first === '1' && r.last === '6', `${r.first} ${r.last}`);

    console.log('\nThe Progression list');
    check('six items, each its chords and one button', r.items.length === 6 &&
        r.items.every((item, i) => /^[A-G]/.test(item.chords) && item.buttons.join() === `Add measure ${i + 1} to selection`),
        JSON.stringify(r.items.slice(0, 2)));

    console.log('\nAdding measures');
    await setField('First measure to play', '2');
    await setField('Last measure to play', '3');
    r = await read();
    check('typed 2 and 3, the summary says 2 to 3', r.summary === 'Measures to Play - 2 to 3', r.summary);
    await add(5);
    await wait(200);
    r = await read();
    check('adding measure 5 stretches it to 2 through 5, and says so', r.first === '2' && r.last === '5' &&
        r.announce === 'Selection is now measures 2 through 5.', `${r.first}-${r.last} ${r.announce}`);
    await press('Play');
    await waitFor(s => s.playing, 30);
    await add(4);
    await wait(200);
    r = await read();
    check('adding measure 4, inside it, makes it measure 4 alone, and stops playing', r.first === '4' && r.last === '4' &&
        !r.playing && r.announce === 'Selection is now measure 4.', `${r.first}-${r.last} ${r.playing} ${r.announce}`);
    await add(1);
    await add(6);
    await wait(200);
    r = await read();
    check('adding 1 then 6 is the whole progression again', r.summary === 'Measures to Play - Entire Progression', r.summary);

    console.log('\nPlaying a selection');
    await setField('First measure to play', '3');
    await setField('Last measure to play', '4');
    await setField('Count in, one measure', false);
    await press('Play');
    await waitFor(s => s.playing, 30);
    await wait(500);
    await press('Where Am I');
    await wait(300);
    r = await read();
    check('Where Am I counts against the selection', /^Measure 3 of measures 3 through 4/.test(r.announce), r.announce);
    // Two measures at a second each, and two more for the last strum to ring.
    check('only the selection plays, then it stops', await waitFor(s => !s.playing, 6));
    check('no errors in the page', errors.length === 0, errors.join(' | '));
} finally {
    await close();
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exitCode = failures === 0 ? 0 : 1;

// Changing the search must not leave a selection behind that has nowhere to appear.
import { launchApp, runMenuCommand } from '../lib/app-ui.mjs';

let failures = 0;
const check = (l, ok, d = '') => { if (!ok) failures++; console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${l}${d ? `  -- ${d}` : ''}`); };

const { page, close } = await launchApp();
await runMenuCommand(page, 'chord-library');
await page.waitForTimeout(3000);

const state = () => page.evaluate(() => {
    const p = document.querySelector('#item-panels > section:not([hidden])');
    const boxes = [...p.querySelectorAll('#chords-results-list > li > input[type="checkbox"]')];
    return {
        heading: p.querySelector('#chords-results-heading').textContent,
        ticked: boxes.filter(b => b.checked).length,
        results: boxes.length,
        playbackList: [...p.querySelectorAll('#chords-playback-list > li')].map(li => li.textContent)
    };
});

const searchFor = async term => {
    await page.evaluate(t => {
        const input = document.getElementById('chords-search-input');
        input.focus();
        input.value = t;
        input.dispatchEvent(new Event('input'));
    }, term);
    await page.waitForTimeout(400);
    await page.evaluate(() => {
        document.getElementById('chords-search-input').blur();
        document.getElementById('chords-level-select').focus();
    });
    await page.waitForTimeout(700);
    return state();
};

console.log('=== Search C, tick a few ===');
let s = await searchFor('C');
console.log(`  ${s.heading}; ${s.ticked} ticked of ${s.results}`);
check('the default was queued for C', s.ticked >= 1, `${s.ticked}`);

await page.evaluate(() => {
    const boxes = [...document.querySelectorAll('#chords-results-list > li > input[type="checkbox"]')];
    for (const b of boxes.slice(1, 3)) { b.checked = true; b.dispatchEvent(new Event('change')); }
});
await page.waitForTimeout(400);
s = await state();
console.log(`  after ticking two more: ${s.heading}; list has ${s.playbackList.length}`);
check('the heading and the playback list agree',
    Number(s.heading.match(/(\d+) selected/)?.[1] ?? 0) === s.playbackList.length,
    `${s.heading} vs ${s.playbackList.length}`);

console.log('\n=== Now search F ===');
s = await searchFor('F');
console.log(`  ${s.heading}; ${s.ticked} ticked of ${s.results}`);
console.log(`  playback list: ${s.playbackList.join(' | ')}`);
const counted = Number(s.heading.match(/(\d+) selected/)?.[1] ?? 0);
check('nothing is counted that is not on screen', counted === s.ticked, `${counted} counted, ${s.ticked} ticked`);
check('the heading still agrees with the playback list', counted === s.playbackList.length,
    `${counted} vs ${s.playbackList.length}`);
check('a default was queued for F', s.ticked === 1, `${s.ticked}`);
check('the queued chord is an F', /\bF/.test(s.playbackList[0] ?? ''), s.playbackList[0] ?? '');

console.log('\n=== Play works straight away, without clearing first ===');
const played = await page.evaluate(async () => {
    document.getElementById('chords-play-button').click();
    await new Promise(r => setTimeout(r, 500));
    return document.getElementById('chords-status').textContent;
});
console.log(`  ${played}`);
check('pressing Play plays rather than asking for a selection',
    /^Playing /.test(played), played);
await page.evaluate(() => document.getElementById('chords-play-button').click());

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
await close();
process.exit(failures === 0 ? 0 : 1);

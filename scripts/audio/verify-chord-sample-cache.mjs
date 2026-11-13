// Counts the guitar samples the Chord Library decodes for one chord, down then up, and again.
//
// Since 2026-11-13 the Chords item's Play loads its samples as the track player does
// (loadFullSample in src/renderer/renderer.js): the whole mf recording of each pitch, decoded once
// and used by every note of that pitch, in the desktop app and the web version alike. So a
// five-string chord decodes five recordings the first time and none after.
//
// Before that it had its own loading. The desktop app asked for each recording cut to the length
// the note needed, so each length was its own sample; and until 2026-11-11 the web version, which
// cannot cut a recording, kept a whole copy for each length asked (finding 10 of the November
// review).
//
// Decodes are counted by wrapping decodeAudioData in the page. Judged from those counts and the DOM.
//
//   node scripts/audio/verify-chord-sample-cache.mjs              the Electron app: reports only
//   node scripts/audio/verify-chord-sample-cache.mjs --web URL    the web build in Edge, for example
//                                                                 http://localhost:8090/unstrung/app/
//                                                                 after npm run build:web and serve:web

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { APP_DIR, launchApp, runMenuCommand } from '../lib/app-ui.mjs';

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};

const webIndex = process.argv.indexOf('--web');
const webUrl = webIndex === -1 ? null : process.argv[webIndex + 1];

let page, finish;
if (webUrl) {
    // Edge through Playwright's msedge channel, as verify-metronome.mjs does.
    const { chromium } = await import(pathToFileURL(path.join(APP_DIR, 'node_modules', 'playwright-core', 'index.mjs')).href);
    const browser = await chromium.launch({ channel: 'msedge' });
    page = await browser.newPage();
    await page.goto(webUrl);
    await page.waitForSelector('#app-menu-button');
    finish = () => browser.close();
} else {
    const launched = await launchApp();
    page = launched.page;
    finish = launched.close;
}
console.log(webUrl ? `Web build in Edge: ${webUrl}` : 'Electron app');

try {
    await page.waitForTimeout(800);
    await page.evaluate(() => {
        window.__decodes = 0;
        const real = BaseAudioContext.prototype.decodeAudioData;
        BaseAudioContext.prototype.decodeAudioData = function (...args) {
            window.__decodes++;
            return real.apply(this, args);
        };
    });
    await runMenuCommand(page, 'chord-library');
    await page.waitForSelector('#chords-search-input', { timeout: 15000 });
    await page.waitForTimeout(800);

    // C major's first two voicings, ticked by their own boxes so either can be played alone.
    await page.evaluate(() => {
        const input = document.getElementById('chords-search-input');
        input.value = 'C';
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(300);
    const setVoicings = wanted => page.evaluate(wanted => {
        const label = [...document.querySelectorAll('#chords-results-list label')].find(l => l.textContent.startsWith('C - '));
        const boxes = [...label.closest('li').querySelectorAll('details input[type="checkbox"]')];
        boxes.forEach((box, index) => {
            if (box.checked !== wanted.includes(index)) box.click();
        });
        return document.getElementById('chords-playback-list').textContent.replace(/\s+/g, ' ').trim();
    }, wanted);
    const play = async () => {
        const before = await page.evaluate(() => window.__decodes);
        await page.evaluate(() => {
            document.getElementById('chords-status').textContent = '';
            document.getElementById('chords-play-button').click();
        });
        await page.waitForFunction(() => /^Playing/.test(document.getElementById('chords-status').textContent), null, { timeout: 30000 });
        await page.waitForTimeout(300);
        return (await page.evaluate(() => window.__decodes)) - before;
    };

    // C major's first voicing plays five strings, each a different pitch, all at mf.
    const counts = [];
    for (const [voicings, label] of [[[0], 'voicing 1'], [[0], 'voicing 1 again'], [[0, 1], 'voicings 1 and 2'],
        [[1], 'voicing 2 alone'], [[0], 'voicing 1 alone once more']]) {
        const list = await setVoicings(voicings);
        const decoded = await play();
        counts.push(decoded);
        console.log(`  ${label}: ${decoded} decoded  (${list})`);
    }

    check('the first play decodes each pitch once: five', counts[0] === 5, String(counts[0]));
    check('playing it again decodes nothing', counts[1] === 0, String(counts[1]));
    check('voicing 2 alone, after both together, decodes nothing', counts[3] === 0, String(counts[3]));
    check('voicing 1 alone once more decodes nothing', counts[4] === 0, String(counts[4]));
} finally {
    await finish();
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exitCode = failures === 0 ? 0 : 1;

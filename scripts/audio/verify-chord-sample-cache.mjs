// Counts the guitar samples the Chord Library decodes for one chord, down then up, and again.
// See `chordSampleRequestSeconds` in src/renderer/renderer.js.
//
// The desktop app trims a recording to the length a note needs, so each length is its own sample.
// The web version returns the whole recording whatever is asked, and until 2026-11-11 the Chord
// Library still cached it once per length wanted: a chord down then up decoded the same few
// recordings over and over, and kept every copy. Finding 10 of the November review. On the web a
// recording is now decoded once per pitch and loudness and reused.
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

    // Each stroke plays its last two strings a little softer (buildStrokePlan), so a five-string
    // chord down then up sounds nine pitch-and-loudness pairs: each string's two, but the middle
    // string's once.
    const counts = [];
    for (const [voicings, label] of [[[0], 'voicing 1'], [[0], 'voicing 1 again'], [[0, 1], 'voicings 1 and 2'],
        [[1], 'voicing 2 alone'], [[0], 'voicing 1 alone once more']]) {
        const list = await setVoicings(voicings);
        const decoded = await play();
        counts.push(decoded);
        console.log(`  ${label}: ${decoded} decoded  (${list})`);
    }

    if (webUrl) {
        check('the first play decodes each pitch and loudness once: nine', counts[0] === 9, String(counts[0]));
        check('playing it again decodes nothing', counts[1] === 0, String(counts[1]));
        check('voicing 2 alone, after both together, decodes nothing: its notes are the same at any length',
            counts[3] === 0, String(counts[3]));
        check('voicing 1 alone once more decodes nothing', counts[4] === 0, String(counts[4]));
    } else {
        check('playing the same chord again decodes nothing new', counts[1] === 0, String(counts[1]));
    }
} finally {
    await finish();
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exitCode = failures === 0 ? 0 : 1;

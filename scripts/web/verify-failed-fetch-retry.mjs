// Checks that the web version tries a download again after it has failed once, instead of
// remembering the failure for the visit. See `fetchJsonOnce` in src/web/platform.js and
// `fillChordLibrary` in src/renderer/renderer.js. Finding 11 of the November review.
//
// Runs the web build in Edge and fails each file's first request, as a phone losing its connection
// would, then lets the next one through: the chord library, the list of voices, and the guitar
// sample map. Then it refuses every write to the browser's cache, as a full one would, and checks
// that a sample fetched is still played (finding 18). Judged from the DOM, never pixels.
//
//   npm run build:web
//   npm run serve:web
//   node scripts/web/verify-failed-fetch-retry.mjs http://localhost:8090/unstrung/app/

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { APP_DIR, runMenuCommand } from '../lib/app-ui.mjs';

const url = process.argv[2] ?? 'http://localhost:8090/unstrung/app/';

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${condition || !detail ? '' : `  -- ${detail}`}`);
};

const { chromium } = await import(pathToFileURL(path.join(APP_DIR, 'node_modules', 'playwright-core', 'index.mjs')).href);
const browser = await chromium.launch({ channel: 'msedge' });

/** A fresh page whose first request for each named file fails, and every later one goes through. */
async function pageFailingFirst(...files) {
    const page = await browser.newPage();
    const failed = new Set();
    for (const file of files) {
        await page.route(`**/${file}`, route => {
            if (failed.has(file)) return route.continue();
            failed.add(file);
            return route.abort('internetdisconnected');
        });
    }
    await page.goto(url);
    await page.waitForSelector('#app-menu-button');
    await page.waitForTimeout(500);
    return page;
}

try {
    console.log(`Web build in Edge: ${url}`);

    console.log('\nThe chord library');
    {
        const page = await pageFailingFirst('chord-library.json');
        await runMenuCommand(page, 'chord-library');
        // Before the fix it said "loading chord library…" for good, so the wait is allowed to run out.
        await page.waitForFunction(() => !/loading/.test(document.getElementById('chords-results-heading')?.textContent ?? 'loading'),
            null, { timeout: 8000 }).catch(() => {});
        const heading = await page.evaluate(() => document.getElementById('chords-results-heading')?.textContent ?? 'no Chord Library shown');
        check('the first try says it could not be loaded, and how to try again',
            heading === 'Search Results: the chord library could not be loaded. Check the connection, then choose Chord Library from the menu again.', heading);

        await runMenuCommand(page, 'chord-library');
        await page.waitForFunction(() => document.querySelectorAll('#chords-results-list li').length > 0, null, { timeout: 8000 }).catch(() => {});
        const after = await page.evaluate(() => ({
            heading: document.getElementById('chords-results-heading')?.textContent ?? 'no Chord Library shown',
            rows: document.querySelectorAll('#chords-results-list > li').length,
            focused: document.activeElement?.id
        }));
        check('choosing it again loads it, with the search field focused',
            after.rows > 0 && !/could not/.test(after.heading) && after.focused === 'chords-search-input', JSON.stringify(after));

        await runMenuCommand(page, 'frets-to-chord');
        await page.waitForSelector('#frets-dialog[open]');
        await page.waitForTimeout(300);
        const frets = await page.evaluate(() => document.getElementById('frets-dialog').textContent);
        check('Frets to Chord has the library too', !/loading chord library/.test(frets));
        await page.close();
    }

    console.log('\nThe list of voices, for spoken chord names');
    {
        const page = await pageFailingFirst('voices.json');
        const speakState = async () => {
            await runMenuCommand(page, 'chord-practice');
            await page.waitForSelector('#chord-practice-dialog[open]', { timeout: 15000 });
            await page.waitForTimeout(300);
            const disabled = await page.evaluate(() => document.getElementById('chord-practice-speak-checkbox').disabled);
            await page.evaluate(() => document.getElementById('chord-practice-dialog').close());
            return disabled;
        };
        check('the first try leaves Speak chord names unavailable', await speakState() === true);
        check('opening Chord Practice again offers it', await speakState() === false);
        await page.close();
    }

    console.log('\nThe guitar sample map');
    {
        const page = await pageFailingFirst('sample-map.json');
        await runMenuCommand(page, 'chord-library');
        await page.waitForFunction(() => document.querySelectorAll('#chords-results-list li').length > 0, null, { timeout: 15000 });
        const playC = async () => {
            await page.evaluate(() => {
                const input = document.getElementById('chords-search-input');
                input.value = 'C';
                input.dispatchEvent(new Event('input', { bubbles: true }));
                const label = [...document.querySelectorAll('#chords-results-list label')].find(l => l.textContent.startsWith('C - '));
                const box = document.getElementById(label.htmlFor);
                if (!box.checked) box.click();
                document.getElementById('chords-status').textContent = '';
                document.getElementById('chords-play-button').click();
            });
            await page.waitForTimeout(3000);
            return page.evaluate(() => document.getElementById('chords-status').textContent);
        };
        const first = await playC();
        check('the first Play does not play', !/^Playing/.test(first), first);
        const second = await playC();
        check('the second plays', /^Playing/.test(second), second);
        await page.close();
    }
    // Finding 18: a browser that refuses to keep a copy, for want of space, still plays what it
    // fetched. Every write to the cache is refused here.
    console.log('\nA full cache');
    {
        const page = await browser.newPage();
        await page.addInitScript(() => {
            Cache.prototype.put = () => Promise.reject(new DOMException('The quota has been exceeded.', 'QuotaExceededError'));
        });
        await page.goto(url);
        await page.waitForSelector('#app-menu-button');
        // A fresh context has nothing cached, so every sample is fetched and then refused a place.
        await runMenuCommand(page, 'chord-library');
        await page.waitForFunction(() => document.querySelectorAll('#chords-results-list li').length > 0, null, { timeout: 15000 });
        await page.evaluate(() => {
            const input = document.getElementById('chords-search-input');
            input.value = 'C';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            const label = [...document.querySelectorAll('#chords-results-list label')].find(l => l.textContent.startsWith('C - '));
            document.getElementById(label.htmlFor).click();
            document.getElementById('chords-play-button').click();
        });
        await page.waitForTimeout(3000);
        const status = await page.evaluate(() => document.getElementById('chords-status').textContent);
        check('a chord still plays when the cache refuses every copy', /^Playing/.test(status), status);
        await page.close();
    }
} finally {
    await browser.close();
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exitCode = failures === 0 ? 0 : 1;

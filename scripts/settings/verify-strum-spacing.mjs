// Checks the strum spacing setting in the running app: the field in Settings, and that every strum
// unstrung plays follows it. "Time between strings in a strum, in milliseconds", 0 to 50, 20 by
// default, became one setting on 2026-11-12 (docs/one-player.md, decision 14). Before then a song's
// track spaced strings 20 ms apart and chord practice 22.
//
// Drives the Electron app on a scratch profile. Judged from the DOM, the stored setting, and the
// times the page starts its note recordings: every AudioBufferSourceNode started is recorded, and
// where each note's attack sounds is worked out as scripts/audio/verify-note-timing.mjs does it.
// The strings of one strum are then the attacks that follow each other closely, and the gaps
// between them should be the setting.
//
// The song is alphaTex written here, opened as a file is, so no song file is needed.
//
//   npm run build:renderer
//   node scripts/settings/verify-strum-spacing.mjs

import { launchApp, runMenuCommand, openSongFile, MENU, VISIBLE_PANEL } from '../lib/app-ui.mjs';

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

// Eight measures of a six-string G, two strums a measure, at 60 beats a minute: long enough to
// change the setting partway through.
const SONG = [
    '\\title "Strum Spacing"',
    '\\tempo 60',
    ...Array.from({ length: 8 }, () => '(3.6 2.5 0.4 0.3 0.2 3.1).2 (3.6 2.5 0.4 0.3 0.2 3.1).2 |')
].join('\n');

const { app, page, close } = await launchApp();
try {
    await pause(800);
    await page.evaluate(() => {
        window.__starts = [];
        const original = AudioBufferSourceNode.prototype.start;
        AudioBufferSourceNode.prototype.start = function (when = 0, offset = 0, ...rest) {
            const buffer = this.buffer;
            // A click is generated, 60 ms long; speech is started with a duration. Anything else
            // is a note recording, and its attack is found as sampleAttack.mjs finds it.
            if (rest.length === 0 && buffer.duration > 0.07) {
                const data = buffer.getChannelData(0);
                const end = Math.min(data.length, Math.round(0.25 * buffer.sampleRate));
                let peak = 0;
                for (let i = 0; i < end; i++) peak = Math.max(peak, Math.abs(data[i]));
                let i = 0;
                while (i < end && Math.abs(data[i]) < peak / 2) i++;
                window.__starts.push({ attackAt: when - offset + i / buffer.sampleRate, scheduledAt: this.context.currentTime });
            }
            return original.call(this, when, offset, ...rest);
        };
    });

    /**
     * The gaps between strings, in milliseconds, of each strum started since `since` (context
     * time): attacks closer than 80 ms belong to one strum. A strum entered partway, ringing when
     * playback began or moved, is left out, being only its last strings.
     */
    const strumGaps = since => page.evaluate(from => {
        const attacks = window.__starts.filter(s => s.scheduledAt >= from).map(s => s.attackAt).sort((a, b) => a - b);
        const strums = [];
        for (const at of attacks) {
            const current = strums.at(-1);
            if (current && at - current.at(-1) < 0.08) current.push(at);
            else strums.push([at]);
        }
        return strums.filter(strum => strum.length >= 4)
            .map(strum => strum.slice(1).map((at, i) => (at - strum[i]) * 1000));
    }, since);
    const contextNow = () => page.evaluate(() => window.__starts.length ? Math.max(...window.__starts.map(s => s.scheduledAt)) : 0);
    const within = (strums, ms) => strums.length > 0 && strums.every(gaps => gaps.every(gap => Math.abs(gap - ms) < 1.5));
    const describe = strums => strums.slice(0, 3).map(gaps => gaps.map(g => g.toFixed(1)).join(' ')).join(' | ');
    const stored = () => page.evaluate(async () => (await window.unstrung.getSettings()).strumSpacingMs);

    /** Opens Settings, sets the field as typing and leaving it would, and closes it again. */
    async function setSpacing(text) {
        await runMenuCommand(page, MENU.settings);
        await page.waitForSelector('#settings-dialog[open]');
        await page.fill('#settings-strum-spacing-input', text);
        await page.focus('#settings-strum-spacing-input');
        await page.keyboard.press('Tab');
        await pause(400);
        const shown = await page.inputValue('#settings-strum-spacing-input');
        await page.click('#settings-ok-button');
        await pause(200);
        return shown;
    }

    console.log('The field');
    await runMenuCommand(page, MENU.settings);
    await page.waitForSelector('#settings-dialog[open]');
    const field = await page.evaluate(() => {
        const input = document.getElementById('settings-strum-spacing-input');
        return {
            label: input.labels[0]?.textContent,
            hint: document.getElementById(input.getAttribute('aria-describedby'))?.textContent,
            type: input.type, min: input.min, max: input.max, step: input.step, value: input.value,
            tab: input.closest('[role="tabpanel"]')?.id,
            heading: [...input.closest('[role="tabpanel"]').querySelectorAll('h2')]
                .filter(h => h.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).at(-1)?.textContent
        };
    });
    check('is labelled as decided', field.label === 'Time between strings in a strum, in milliseconds', field.label);
    check('is described with its range and default', field.hint === '0 to 50, 20 by default.', field.hint);
    check('is a number field from 0 to 50 in steps of 1', field.type === 'number' && field.min === '0' &&
        field.max === '50' && field.step === '1', `${field.type} ${field.min}-${field.max} step ${field.step}`);
    check('is under Strumming on the General tab', field.tab === 'settings-panel-general' && field.heading === 'Strumming',
        `${field.tab}, ${field.heading}`);
    check('shows 20 on a new profile', field.value === '20', field.value);
    check('20 is what is stored', await stored() === 20, String(await stored()));
    await page.click('#settings-ok-button');

    check('80 is held to 50', await setSpacing('80') === '50' && await stored() === 50, String(await stored()));
    check('an emptied field goes back to what was stored', await setSpacing('') === '50' && await stored() === 50);
    check('35 is kept', await setSpacing('35') === '35' && await stored() === 35, String(await stored()));

    console.log('\nA song');
    await openSongFile(app, 'Strum Spacing.atex', Buffer.from(SONG, 'utf8'));
    await page.waitForFunction(selector => document.querySelector(selector)?.querySelector('details.track-region'),
        VISIBLE_PANEL, { timeout: 30000 });
    await page.evaluate(selector => { document.querySelector(selector).querySelector('details.track-region').open = true; }, VISIBLE_PANEL);
    const region = `${VISIBLE_PANEL} details.track-region`;
    const songPlay = page.locator(`${region} button[aria-pressed]`).first();
    await songPlay.waitFor();
    await songPlay.click();
    await page.waitForFunction(() => window.__starts.length >= 12, null, { timeout: 60000 });
    await pause(4500);
    let strums = await strumGaps(0);
    check('strums 35 ms a string', within(strums, 35), describe(strums));

    const whereAmI = async () => {
        await page.locator(`${region} button`, { hasText: 'Where Am I' }).first().click();
        await pause(300);
        return page.evaluate(selector => document.querySelector(selector).querySelector('p[aria-live="polite"]:not([role])')?.textContent,
            region);
    };
    // Into measure 2 at least, so a return to the start would show.
    let before = await whereAmI();
    for (let tries = 0; tries < 20 && /^Measure 1 /.test(before); tries++) {
        await pause(500);
        before = await whereAmI();
    }
    const changedAt = await contextNow();
    await setSpacing('10');
    const after = await whereAmI();
    check('changing it while playing keeps playing', await songPlay.textContent() === 'Pause');
    // The measure, not the whole answer: Where Am I says the beat too since 2026-11-12, which moves
    // on between the two askings.
    const measureOf = text => /^Measure \d+ of \d+/.exec(text)?.[0];
    check('from the same place', measureOf(before) === measureOf(after) && !/^Measure 1 /.test(after), `${before} / ${after}`);
    await pause(3000);
    strums = await strumGaps(changedAt + 0.001);
    check('and strums 10 ms a string from there', within(strums, 10), describe(strums));
    await songPlay.click();

    console.log('\nChord practice');
    await runMenuCommand(page, MENU.chordPractice);
    await page.click('#chord-practice-generate-button');
    // A handle rather than a locator: the button's text changes to Pause once it is pressed.
    const practiceLocator = page.locator(`${VISIBLE_PANEL} button`, { hasText: 'Play' }).first();
    await practiceLocator.waitFor();
    const practicePlay = await practiceLocator.elementHandle();
    const practiceFrom = await contextNow();
    await practicePlay.click();
    await page.waitForFunction(from => window.__starts.filter(s => s.scheduledAt > from).length >= 12, practiceFrom, { timeout: 60000 });
    await pause(1500);
    strums = await strumGaps(practiceFrom + 0.001);
    check('strums 10 ms a string, where it used 22', within(strums, 10), describe(strums));
    await practicePlay.click();

    console.log('\nThe Chord Library');
    await setSpacing('0');
    await runMenuCommand(page, MENU.chordLibrary);
    await pause(3000);
    // As verify-chord-playback-list.mjs does it: leaving the search queues the first result.
    await page.evaluate(() => {
        const input = document.getElementById('chords-search-input');
        input.focus();
        input.value = 'G';
        input.dispatchEvent(new Event('input'));
    });
    await pause(500);
    await page.evaluate(() => {
        document.getElementById('chords-search-input').blur();
        document.getElementById('chords-level-select').focus();
    });
    await pause(700);
    const queued = await page.evaluate(() => [...document.querySelectorAll('#chords-playback-list li')].map(li => li.textContent));
    check('a G is queued to play', queued.length >= 1, queued.join(' | '));
    const libraryFrom = await contextNow();
    await page.evaluate(() => document.getElementById('chords-play-button').click());
    await page.waitForFunction(from => window.__starts.filter(s => s.scheduledAt > from).length >= 4, libraryFrom, { timeout: 30000 });
    await pause(500);
    strums = await strumGaps(libraryFrom + 0.001);
    check('Play strums every string at once with the setting at 0', within(strums, 0), describe(strums));
} finally {
    await close();
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exitCode = failures === 0 ? 0 : 1;

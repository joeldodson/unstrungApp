// Checks that chord practice's notes land on the metronome's clicks.
//
// Every recording opens with about 22 ms (guitar) or 27 ms (bass) of pick noise before the note's
// attack, so the app starts each note early by its attack (src/shared/sampleAttack.mjs). This
// plays a generated progression with the metronome on, records every AudioBufferSourceNode the
// page starts, and works out when each note's attack sounds: where it was started, less how far
// into the recording, plus where the attack is in that recording. The attack is found here the
// same way, measured on the buffer the page actually played. Every click that has a strum on it
// should have the first string's attack within a millisecond of it.
//
// The audio track of a song is checked too when one is named. Song files are kept outside the
// repository, so it is never named here.
//
// Run: node scripts/audio/verify-note-timing.mjs [--song path/to/song.gp]

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { launchApp, runMenuCommand, openSongFile, MENU, VISIBLE_PANEL } from '../lib/app-ui.mjs';

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};

const songIndex = process.argv.indexOf('--song');
const songPath = songIndex === -1 ? null : process.argv[songIndex + 1];

const { app, page, close } = await launchApp();
try {
    await page.evaluate(() => {
        window.__starts = [];
        const original = AudioBufferSourceNode.prototype.start;
        AudioBufferSourceNode.prototype.start = function (when = 0, offset = 0, ...rest) {
            const buffer = this.buffer;
            let attack = null;
            // A click is generated, 60 ms long; speech is started with a duration. Anything else
            // is a note recording, and its attack is measured as the app defines it.
            if (rest.length === 0 && buffer.duration > 0.07) {
                const data = buffer.getChannelData(0);
                const end = Math.min(data.length, Math.round(0.25 * buffer.sampleRate));
                let peak = 0;
                for (let i = 0; i < end; i++) peak = Math.max(peak, Math.abs(data[i]));
                let i = 0;
                while (i < end && Math.abs(data[i]) < peak / 2) i++;
                attack = i / buffer.sampleRate;
            }
            window.__starts.push({
                when, offset, attack, speech: rest.length > 0,
                click: rest.length === 0 && buffer.duration <= 0.07,
                now: this.context.currentTime
            });
            return original.call(this, when, offset, ...rest);
        };
    });

    /** Plays for a while with `play`, pauses, and checks every note started meanwhile. */
    async function measure(label, play) {
        await page.evaluate(() => { window.__starts = []; });
        await play.click();
        await page.waitForFunction(() => window.__starts.some(s => s.attack !== null), null, { timeout: 30000 });
        await page.waitForTimeout(1000);
        await play.click(); // pause

        const starts = await page.evaluate(() => window.__starts);
        const clicks = starts.filter(s => s.click).map(s => s.when);
        const notes = starts.filter(s => s.attack !== null).map(s => ({
            attackAt: s.when - s.offset + s.attack, lead: s.attack - s.offset, late: s.when < s.now
        }));
        console.log(`=== ${label}: ${clicks.length} clicks, ${notes.length} notes scheduled`);

        const errors = [];
        for (const click of clicks) {
            const near = notes.filter(n => Math.abs(n.attackAt - click) < 0.015);
            if (near.length === 0) continue;
            errors.push(Math.min(...near.map(n => Math.abs(n.attackAt - click))));
        }
        const worst = errors.length ? Math.max(...errors) * 1000 : NaN;
        check('there are clicks with a note on them', errors.length > 0, `${errors.length}`);
        check('the first attack on each is within 1 ms of its click', worst < 1, `worst ${worst.toFixed(3)} ms`);
        // A note entered partway, ringing when playback started, has no pick noise left to play.
        const leads = notes.map(n => n.lead * 1000).filter(lead => lead > 0);
        check('every note from the top starts early by its pick noise',
            leads.length > 0 && leads.every(lead => lead > 15 && lead < 40),
            `${Math.min(...leads).toFixed(1)} to ${Math.max(...leads).toFixed(1)} ms early`);
        check('no note was scheduled in the past', notes.every(n => !n.late));
    }

    // A handle rather than a locator: a play button's text changes to Pause once it is pressed.
    const button = async (scope, text) => {
        const locator = page.locator(`${scope} button`, { hasText: text });
        await locator.first().waitFor();
        return locator.first().elementHandle();
    };

    await runMenuCommand(page, MENU.chordPractice);
    await page.click('#chord-practice-generate-button');
    await measure('chord practice', await button(VISIBLE_PANEL, 'Play'));

    if (songPath) {
        await openSongFile(app, path.basename(songPath), await readFile(songPath));
        await page.waitForTimeout(2500);
        const details = await page.evaluateHandle(selector =>
            [...document.querySelector(selector).querySelectorAll('details')]
                .find(d => d.querySelector('summary')?.textContent.startsWith('Audio Track - ')), VISIBLE_PANEL);
        await details.evaluate(d => { d.open = true; });
        await details.evaluate(d => {
            const metronome = d.querySelector('input[type="checkbox"][id^="audio-track-metronome"]');
            if (!metronome.checked) metronome.click();
            [...d.querySelectorAll('button')].find(b => b.textContent === 'Create Track').click();
        });
        await page.waitForFunction(d => [...d.querySelectorAll('button')]
            .some(b => b.textContent === 'Play Track' && !b.disabled), details, { timeout: 60000 });
        const play = await details.evaluateHandle(d => [...d.querySelectorAll('button')].find(b => b.textContent === 'Play Track'));
        await measure(`audio track of ${path.basename(songPath)}`, play);
    }
} finally {
    await close();
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);

// Checks in the running app that a song's accents are played louder: each note's gain against an
// unaccented note's, 1.5 for an accent and HEAVY_ACCENT_LEVEL for a heavy one. docs/one-player.md,
// decision 10; scripts/songs/check-accents.mjs checks the rule itself.
//
// Drives the Electron app on a scratch profile. Every note recording the page starts is recorded
// with the first level its gain is set to, which the audio track sets straight after starting it.
// The song is alphaTex written here, so no song file is needed.
//
//   npm run build:renderer
//   node scripts/songs/verify-accents.mjs

import { launchApp, openSongFile, VISIBLE_PANEL } from '../lib/app-ui.mjs';
import { HEAVY_ACCENT_LEVEL } from '../../src/shared/audioTrack.mjs';

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

// At 60 beats a minute: plain, accented, heavily accented and plain strums of G, each measure.
const G = fx => `(3.6${fx} 2.5${fx} 0.4${fx} 0.3${fx} 0.2${fx} 3.1${fx})`;
const SONG = ['\\title "Accents"', '\\tempo 60',
    ...Array.from({ length: 3 }, () => `${G('')}.4 ${G('{ac}')}.4 ${G('{hac}')}.4 ${G('')}.4 |`)].join('\n');

const { app, page, close } = await launchApp();
try {
    await pause(800);
    await page.evaluate(() => {
        window.__notes = [];
        let latest = null;
        const start = AudioBufferSourceNode.prototype.start;
        const setValueAtTime = AudioParam.prototype.setValueAtTime;
        AudioBufferSourceNode.prototype.start = function (when = 0, offset = 0, ...rest) {
            // Clicks are 60 ms long; anything longer is a note recording.
            if (rest.length === 0 && this.buffer.duration > 0.07) {
                latest = { when: when - offset, gain: null };
                window.__notes.push(latest);
            }
            return start.call(this, when, offset, ...rest);
        };
        AudioParam.prototype.setValueAtTime = function (value, time) {
            if (latest && latest.gain === null && value > 0) latest.gain = value;
            return setValueAtTime.call(this, value, time);
        };
    });

    await openSongFile(app, 'Accents.atex', Buffer.from(SONG, 'utf8'));
    await page.waitForFunction(selector => document.querySelector(selector)?.querySelector('details.track-region'),
        VISIBLE_PANEL, { timeout: 30000 });
    await page.evaluate(selector => { document.querySelector(selector).querySelector('details.track-region').open = true; }, VISIBLE_PANEL);
    const play = page.locator(`${VISIBLE_PANEL} details.track-region button[aria-pressed]`).first();
    await play.waitFor();
    await play.click();
    await page.waitForFunction(() => window.__notes.length >= 48, null, { timeout: 60000 });
    await pause(300);
    await play.click();

    const notes = await page.evaluate(() => window.__notes);
    const first = Math.min(...notes.map(n => n.when));
    const plain = notes.find(n => Math.round(n.when - first) % 4 === 0).gain;
    const byBeat = [0, 1, 2, 3].map(beat => [...new Set(notes
        .filter(n => Math.round(n.when - first) % 4 === beat).map(n => Math.round(n.gain / plain * 1000) / 1000))]);
    console.log(`${notes.length} notes scheduled, levels by beat against beat 1: ${byBeat.map(b => b.join('/')).join(' ')}`);

    check('plain strums play at one level', byBeat[0].join() === '1' && byBeat[3].join() === '1',
        `${byBeat[0]} and ${byBeat[3]}`);
    check('an accented strum plays 1.5 times as loud', byBeat[1].join() === '1.5', byBeat[1].join('/'));
    check('a heavily accented one at its own level, louder again', byBeat[2].join() === String(HEAVY_ACCENT_LEVEL),
        byBeat[2].join('/'));
} finally {
    await close();
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exitCode = failures === 0 ? 0 : 1;

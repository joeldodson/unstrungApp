// Checks in the running app that a dead note damps its string: the strum before a chuck is
// scheduled to stop at the chuck rather than ring on to the next strum. docs/one-player.md,
// decision 13; scripts/songs/check-dead-notes.mjs checks the rule itself.
//
// Drives the Electron app on a scratch profile. Every AudioBufferSourceNode the page starts and
// stops is recorded, and each note's ring is worked out from where its attack sounds (as
// scripts/audio/verify-note-timing.mjs finds it) to the stop the page first gave it. The song is
// alphaTex written here, so no song file is needed.
//
//   npm run build:renderer
//   node scripts/songs/verify-dead-notes.mjs

import { launchApp, openSongFile, VISIBLE_PANEL } from '../lib/app-ui.mjs';

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

// At 60 beats a minute: a G on beat 1, a chuck on beat 2, a G on beat 3 that rings over the rest
// on beat 4 to the next measure's G. Before 2026-11-12 the G on beat 1 rang two seconds, to the G
// on beat 3; now the chuck stops it after one.
const G = '(3.6 2.5 0.4 0.3 0.2 3.1)';
const CHUCK = '(x.6 x.5 x.4 x.3 x.2 x.1)';
const SONG = ['\\title "Dead Notes"', '\\tempo 60',
    ...Array.from({ length: 4 }, () => `${G}.4 ${CHUCK}.4 ${G}.4 r.4 |`)].join('\n');

const { app, page, close } = await launchApp();
try {
    await pause(800);
    await page.evaluate(() => {
        window.__notes = [];
        const start = AudioBufferSourceNode.prototype.start;
        const stop = AudioScheduledSourceNode.prototype.stop;
        AudioBufferSourceNode.prototype.start = function (when = 0, offset = 0, ...rest) {
            const buffer = this.buffer;
            // Clicks are 60 ms long; anything longer is a note recording.
            if (rest.length === 0 && buffer.duration > 0.07) {
                const data = buffer.getChannelData(0);
                const end = Math.min(data.length, Math.round(0.25 * buffer.sampleRate));
                let peak = 0;
                for (let i = 0; i < end; i++) peak = Math.max(peak, Math.abs(data[i]));
                let i = 0;
                while (i < end && Math.abs(data[i]) < peak / 2) i++;
                this.__note = { attackAt: when - offset + i / buffer.sampleRate, stopAt: null };
                window.__notes.push(this.__note);
            }
            return start.call(this, when, offset, ...rest);
        };
        AudioScheduledSourceNode.prototype.stop = function (when = 0) {
            // The first stop is the one scheduling gave it; a later one is pausing.
            if (this.__note && this.__note.stopAt === null) this.__note.stopAt = when;
            return stop.call(this, when);
        };
    });

    await openSongFile(app, 'Dead Notes.atex', Buffer.from(SONG, 'utf8'));
    await page.waitForFunction(selector => document.querySelector(selector)?.querySelector('details.track-region'),
        VISIBLE_PANEL, { timeout: 30000 });
    await page.evaluate(selector => { document.querySelector(selector).querySelector('details.track-region').open = true; }, VISIBLE_PANEL);
    const play = page.locator(`${VISIBLE_PANEL} details.track-region button[aria-pressed]`).first();
    await play.waitFor();
    await play.click();
    await page.waitForFunction(() => window.__notes.length >= 24, null, { timeout: 60000 });
    await pause(500);
    await play.click();

    const notes = await page.evaluate(() => window.__notes);
    const first = Math.min(...notes.map(n => n.attackAt));
    // Rings in seconds, less the 10 ms the page lets a source run past its fade.
    const rings = notes.map(n => ({ beat: Math.round(n.attackAt - first) % 4, ring: n.stopAt - n.attackAt - 0.01 }));
    const onBeat1 = rings.filter(r => r.beat === 0);
    const onBeat3 = rings.filter(r => r.beat === 2);
    const show = list => [...new Set(list.map(r => r.ring.toFixed(3)))].join(', ');

    console.log(`${notes.length} notes scheduled`);
    check('the chuck sounds nothing: only the two strums of each measure are scheduled',
        rings.every(r => r.beat === 0 || r.beat === 2), show(rings));
    check('a strum before the chuck stops at it, one second on', onBeat1.length >= 12 &&
        onBeat1.every(r => Math.abs(r.ring - 1) < 0.005), show(onBeat1));
    check('a strum with no chuck after it rings to the next strum, two seconds on', onBeat3.length >= 6 &&
        onBeat3.every(r => Math.abs(r.ring - 2) < 0.005), show(onBeat3));
} finally {
    await close();
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exitCode = failures === 0 ? 0 : 1;

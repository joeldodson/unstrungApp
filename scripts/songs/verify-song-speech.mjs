// Checks Speak the next measure on a song's player (docs/one-player.md, decision 5): off by
// default, unavailable with a note for a track over which the file prints no chords, and when on,
// each measure's printed chords, carried forward, said one beat before it, with "repeat" for a
// measure carrying the same chord. Turning it on or off while playing carries on playing.
//
// Drives the Electron app on a scratch profile. Every buffer the page starts is recorded; a spoken
// phrase is the one started with a duration, and which phrase it is is told by its recording's
// length, found by fetching the same recordings in the page. The songs are alphaTex written here.
//
//   npm run build:renderer
//   node scripts/songs/verify-song-speech.mjs

import { launchApp, openSongFile, VISIBLE_PANEL } from '../lib/app-ui.mjs';

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

// At 60 beats a minute, four seconds a measure: G printed in measure 1 and carried through 2, then
// C, then D printed on the and of 2 of measure 4 under the carried C.
const G = '(3.6 2.5 0.4 0.3 0.2 3.1)';
const CHORDS = ['\\title "Spoken Chords"', '\\tempo 60',
    `${G}.4 {ch "G"} ${G}.4 ${G}.4 ${G}.4 |`,
    `${G}.4 ${G}.4 ${G}.4 ${G}.4 |`,
    `${G}.4 {ch "C"} ${G}.4 ${G}.4 ${G}.4 |`,
    `${G}.4 ${G}.8 ${G}.8 {ch "D"} ${G}.4 ${G}.4 |`].join('\n');
const NO_CHORDS = ['\\title "No Chords"', '\\tempo 60', `${G}.1 |`, `${G}.1 |`].join('\n');

const { app, page, close } = await launchApp();
try {
    await pause(800);
    await page.evaluate(() => {
        window.__starts = [];
        const start = AudioBufferSourceNode.prototype.start;
        AudioBufferSourceNode.prototype.start = function (when = 0, offset = 0, ...rest) {
            const buffer = this.buffer;
            let attackAt = null;
            if (rest.length === 0 && buffer.duration > 0.07) {
                const data = buffer.getChannelData(0);
                const end = Math.min(data.length, Math.round(0.25 * buffer.sampleRate));
                let peak = 0;
                for (let i = 0; i < end; i++) peak = Math.max(peak, Math.abs(data[i]));
                let i = 0;
                while (i < end && Math.abs(data[i]) < peak / 2) i++;
                attackAt = when - offset + i / buffer.sampleRate;
            }
            window.__starts.push({ when, speech: rest.length > 0, length: buffer.duration, attackAt, scheduledAt: this.context.currentTime });
            return start.call(this, when, offset, ...rest);
        };
    });
    // The length of each phrase's recording, in the voice Settings starts with.
    const lengths = await page.evaluate(async () => {
        const context = new AudioContext();
        const out = {};
        for (const entry of await window.unstrung.getSpokenPhrases('zira', ['G', 'C', 'D', 'repeat', 'at 2.5'])) {
            const bytes = entry.bytes.buffer.slice(entry.bytes.byteOffset, entry.bytes.byteOffset + entry.bytes.byteLength);
            out[entry.text] = (await context.decodeAudioData(bytes)).duration;
        }
        return out;
    });
    const phraseOf = length => Object.entries(lengths).find(([, l]) => Math.abs(l - length) < 1e-6)?.[0] ?? '?';
    check('the phrases can be told apart by length', new Set(Object.values(lengths)).size === Object.keys(lengths).length,
        JSON.stringify(lengths));

    const openSong = async (name, text) => {
        await openSongFile(app, name, Buffer.from(text, 'utf8'));
        await page.waitForFunction(title => document.querySelector('#open-items-list button[aria-current="true"]')?.textContent.includes(title),
            name.replace('.atex', ''), { timeout: 30000 });
        await page.evaluate(selector => {
            window.__region = document.querySelector(selector).querySelector('details.track-region');
            window.__region.open = true;
        }, VISIBLE_PANEL);
        await pause(300);
    };
    const read = () => page.evaluate(() => {
        const r = window.__region;
        const label = [...r.querySelectorAll('label')].find(l => l.textContent === 'Speak the next measure');
        const box = label && document.getElementById(label.htmlFor);
        const described = box?.getAttribute('aria-describedby');
        return {
            exists: !!box, checked: box?.checked, disabled: box?.disabled,
            note: described ? document.getElementById(described)?.textContent : null,
            afterTempo: label?.closest('p').previousElementSibling?.textContent.startsWith('Tempo'),
            playing: r.querySelector('.audio-track button[aria-pressed]').getAttribute('aria-pressed') === 'true'
        };
    });
    const setSpeak = on => page.evaluate(on => {
        const box = document.getElementById([...window.__region.querySelectorAll('label')]
            .find(l => l.textContent === 'Speak the next measure').htmlFor);
        box.checked = on;
        box.dispatchEvent(new Event('change'));
    }, on);
    const play = () => page.evaluate(() => window.__region.querySelector('.audio-track button[aria-pressed]').click());

    console.log('A song printing no chords');
    await openSong('No Chords.atex', NO_CHORDS);
    let r = await read();
    check('the checkbox is there, unchecked and unavailable', r.exists && !r.checked && r.disabled, JSON.stringify(r));
    check('described by why', r.note === 'The file prints no chord names over this part, so there is nothing to speak.', r.note);

    console.log('\nA song printing chords');
    await openSong('Spoken Chords.atex', CHORDS);
    r = await read();
    check('the checkbox is straight after the tempo, unchecked and available', r.exists && r.afterTempo && !r.checked && !r.disabled,
        JSON.stringify(r));
    await page.evaluate(() => { window.__starts = []; });
    await play();
    await page.waitForFunction(() => window.__starts.some(s => s.attackAt !== null), null, { timeout: 60000 });
    await pause(1500);
    check('off, nothing is said', !(await page.evaluate(() => window.__starts.some(s => s.speech))));
    await play();

    await setSpeak(true);
    await pause(1500);
    r = await read();
    check('turned on, it stays checked', r.checked && !r.disabled && r.note === null, JSON.stringify(r));
    // From the top, with the count-in, so the first measure's name falls in it.
    await page.evaluate(() => [...window.__region.querySelectorAll('button')].find(b => b.textContent === 'Restart Selection').click());
    await page.evaluate(() => { window.__starts = []; });
    await play();
    await page.waitForFunction(() => window.__starts.filter(s => s.speech).length >= 4, null, { timeout: 30000 });
    const starts = await page.evaluate(() => window.__starts);
    const spoken = starts.filter(s => s.speech).map(s => ({ phrase: phraseOf(s.length), when: s.when }))
        .sort((a, b) => a.when - b.when);
    console.log(`  said: ${spoken.map(s => s.phrase).join(', ')}`);
    check('G, repeat, C, then C and D at 2.5 together', spoken.map(s => s.phrase).join(', ') === 'G, repeat, C, C, D, at 2.5',
        spoken.map(s => s.phrase).join(', '));
    // Each measure's first strum, from the notes started: the first of each four seconds apart.
    const attacks = starts.filter(s => s.attackAt !== null).map(s => s.attackAt).sort((a, b) => a - b);
    const downbeat = measure => attacks[0] + measure * 4;
    const ahead = [0, 1, 2].map(m => downbeat(m) - spoken[m].when);
    check('a single name is said one beat before its measure', ahead.every(a => Math.abs(a - 1) < 0.005),
        ahead.map(a => a.toFixed(3)).join(', '));
    const together = spoken.slice(3);
    const lastEnds = together.at(-1).when + lengths['at 2.5'];
    check('several are said together, finishing before the measure', together[0].when < downbeat(3) - 1 &&
        lastEnds <= downbeat(3) - 0.099, `start ${(downbeat(3) - together[0].when).toFixed(3)} s ahead, end ${(downbeat(3) - lastEnds).toFixed(3)} s ahead`);
    check('the first name falls in the count-in, before the music', spoken[0].when < attacks[0]);

    console.log('\nWhile playing');
    await setSpeak(false);
    await pause(300);
    const offAt = await page.evaluate(() => Math.max(...window.__starts.map(s => s.scheduledAt)));
    await pause(2500);
    r = await read();
    check('turning it off carries on playing', r.playing);
    check('and says nothing more', !(await page.evaluate(at => window.__starts.some(s => s.speech && s.scheduledAt > at && s.when > at), offAt)));
    const onAt = await page.evaluate(() => Math.max(...window.__starts.map(s => s.scheduledAt)));
    await setSpeak(true);
    await pause(4500);
    r = await read();
    check('turning it on carries on playing', r.playing);
    check('and speaks again', await page.evaluate(at => window.__starts.some(s => s.speech && s.scheduledAt > at), onAt));
    await play();
} finally {
    await close();
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exitCode = failures === 0 ? 0 : 1;

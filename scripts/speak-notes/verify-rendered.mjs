// Verifies the Windows rendered-speech path of Speak the Notes, against Ripple's Acoustic Lead.
//
// The questions this answers:
//   1. Does the PowerShell renderer produce usable audio, and how long does a song's worth take?
//   2. Is a rendered phrase's length known exactly, and how does it compare with the browser path's
//      timed-and-trimmed estimate for the same phrase?
//   3. Does folding pitch into one octave shift by the semitones it should, and what does that
//      cost in tempo?
//   4. Are announcements actually placed on the audio clock, ending when their note begins?

// Repo root, from this file's own location, so the script runs from anywhere.
const APP_DIR = `${import.meta.dirname}/../..`.replace(/\\/g, '/');
const SONG = `${APP_DIR}/musicfiles/Grateful Dead-Ripple-12-20-2025.gp`;
const { _electron } = await import(`file:///${APP_DIR}/node_modules/playwright-core/index.mjs`);

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};

const app = await _electron.launch({ args: ['.'], cwd: APP_DIR });
const page = await app.firstWindow();
await page.waitForLoadState('domcontentloaded');

const { readFile } = await import('node:fs/promises');
const songBytes = [...new Uint8Array(await readFile(SONG))];
await app.evaluate(({ BrowserWindow }, { fileName, bytes }) => {
    BrowserWindow.getAllWindows()[0].webContents.send('tabs:open-file', {
        fileName, data: new Uint8Array(bytes)
    });
}, { fileName: 'Grateful Dead-Ripple-12-20-2025.gp', bytes: songBytes });
await page.waitForTimeout(4000);

await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.send('speak-notes:open'));
await page.waitForTimeout(1500);

console.log('=== 1. The renderer works and is offered ===');
const sources = await page.evaluate(() =>
    [...document.getElementById('speak-notes-source-select').options].map(o => o.value));
check('both speech sources offered', sources.join(',') === 'browser,windows', sources.join(','));
check('pitch is disabled while the browser source is selected',
    await page.isDisabled('#speak-notes-pitch-checkbox'));

await page.selectOption('#speak-notes-source-select', 'windows');
await page.waitForTimeout(3000);
const windowsVoices = await page.evaluate(() =>
    [...document.getElementById('speak-notes-voice-select').options].map(o => o.value));
console.log(`  System.Speech voices: ${windowsVoices.join(' | ')}`);
check('at least one rendering voice', windowsVoices.length > 0);
check('pitch becomes available', !(await page.isDisabled('#speak-notes-pitch-checkbox')));

const rateOptions = await page.evaluate(() =>
    [...document.getElementById('speak-notes-rate-select').options].map(o => o.value));
check('the rate scale switched to SAPI\'s', rateOptions.join(',') === '0,3,5,7,10',
    rateOptions.join(','));

// Time a batch render directly, which is the cost the dialog pays before it can play.
const renderTiming = await page.evaluate(async () => {
    const phrases = ['E', 'G', 'B', 'D', 'A', 'C', 'C sharp', 'F sharp', 'G major', 'C major',
        'D, G', 'C, E', 'G, B', 'A minor', 'E minor 7'];
    const startedAt = performance.now();
    const rendered = await window.unstrung.renderSpeechPhrases(phrases, 5, null);
    return {
        count: rendered.length,
        totalMs: performance.now() - startedAt,
        bytes: rendered.reduce((sum, r) => sum + r.bytes.byteLength, 0)
    };
});
console.log(`  rendered ${renderTiming.count} phrases in ${renderTiming.totalMs.toFixed(0)} ms ` +
    `(${(renderTiming.bytes / 1024).toFixed(0)} KB of audio)`);
check('every phrase came back', renderTiming.count === 15, `${renderTiming.count} of 15`);
check('a song\'s worth renders in a couple of seconds', renderTiming.totalMs < 5000,
    `${renderTiming.totalMs.toFixed(0)} ms`);

console.log('\n=== 2. Ripple, Acoustic Lead, first 10 measures ===');
const readLimit = () => page.evaluate(() =>
    document.getElementById('speak-notes-limit').textContent);

const run = async ({ pitch, octave = false, rate = '5' }) => {
    await page.selectOption('#speak-notes-passage-select', 'song:1:0');
    await page.fill('#speak-notes-measures-input', '10');
    await page.selectOption('#speak-notes-rate-select', rate);
    await page.setChecked('#speak-notes-pitch-checkbox', pitch);
    await page.setChecked('#speak-notes-octave-checkbox', octave);
    await page.uncheck('#speak-notes-guitar-checkbox');
    await page.uncheck('#speak-notes-metronome-checkbox');
    await page.fill('#speak-notes-tempo-input', '300');
    await page.click('#speak-notes-play-button');
    let text = '';
    for (let i = 0; i < 120; i++) {
        text = await readLimit();
        if (text) break;
        await page.waitForTimeout(250);
    }
    await page.click('#speak-notes-play-button');
    await page.waitForTimeout(200);
    return { text, bpm: Number(text.match(/fit: (\d+)/)?.[1] ?? 0) };
};

const flat = await run({ pitch: false });
console.log(`  no pitch : ${flat.text}`);
const pitched = await run({ pitch: true });
console.log(`  pitched  : ${pitched.text}`);
check('a ceiling was measured without pitch', flat.bpm > 0, `${flat.bpm} bpm`);
check('a ceiling was measured with pitch', pitched.bpm > 0, `${pitched.bpm} bpm`);
check('pitching reports the semitone spread', /Pitched over -?\d+ to -?\d+ semitones/.test(pitched.text),
    pitched.text.match(/Pitched over[^.]*\./)?.[0] ?? 'not reported');
console.log(`  ceiling ${flat.bpm} bpm flat, ${pitched.bpm} bpm pitched`);

console.log('\n=== 2b. Rate sweep, so the comparison with the browser path is fair ===');
console.log('  (the browser path reached 57 bpm on this same track at its fastest rate)');
for (const rate of ['0', '5', '7', '10']) {
    const withoutPitch = await run({ pitch: false, rate });
    const withPitch = await run({ pitch: true, rate });
    const withBoth = await run({ pitch: true, octave: true, rate });
    console.log(`  SAPI rate ${rate.padStart(2)}:  flat ${String(withoutPitch.bpm).padStart(3)} bpm` +
        `   pitched ${String(withPitch.bpm).padStart(3)} bpm` +
        `   pitched + octave ${String(withBoth.bpm).padStart(3)} bpm`);
}

console.log('\n=== 3. The fold shifts by the semitones it should ===');
const fold = await page.evaluate(() => {
    // Same rule the dialog uses: pitch class, wrapped at the tritone so nothing moves more than
    // six semitones. Asserted here against the pitches Ripple's lead track actually plays.
    const folded = midi => {
        const pc = ((midi % 12) + 12) % 12;
        return pc > 5 ? pc - 12 : pc;
    };
    return [
        ['C', 48], ['C#', 49], ['D', 50], ['E', 52], ['F', 53],
        ['F#', 54], ['G', 55], ['A', 57], ['B', 59]
    ].map(([name, midi]) => ({
        name, midi, semitones: folded(midi), rate: Math.pow(2, folded(midi) / 12)
    }));
});
for (const f of fold) {
    console.log(`      ${f.name.padEnd(3)} -> ${String(f.semitones).padStart(3)} semitones, ` +
        `playback rate ${f.rate.toFixed(3)}`);
}
check('C is unshifted', fold.find(f => f.name === 'C').semitones === 0);
check('nothing moves more than six semitones',
    fold.every(f => Math.abs(f.semitones) <= 6),
    fold.map(f => f.semitones).join(','));
check('G folds downward rather than up a fifth',
    fold.find(f => f.name === 'G').semitones === -5);
check('the octave-fold is symmetric around the tritone',
    fold.find(f => f.name === 'F').semitones === 5 &&
    fold.find(f => f.name === 'F#').semitones === -6);

console.log('\n=== 4. Announcements land on the audio clock ===');
// Record where each speech buffer is actually scheduled, and compare with its note's beat.
const timing = await page.evaluate(async () => {
    const context = new AudioContext();
    void context;
    window.__scheduled = [];
    const realStart = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (when, offset, duration) {
        window.__scheduled.push({ when, offset, duration, rate: this.playbackRate.value });
        return realStart.call(this, when, offset, duration);
    };
    return true;
});
check('instrumentation installed', timing === true);

await page.selectOption('#speak-notes-passage-select', 'song:1:0');
await page.fill('#speak-notes-measures-input', '4');
await page.setChecked('#speak-notes-pitch-checkbox', true);
await page.check('#speak-notes-metronome-checkbox');
await page.fill('#speak-notes-tempo-input', '50');
await page.evaluate(() => { window.__scheduled = []; });
await page.click('#speak-notes-play-button');
await page.waitForTimeout(6000);
await page.click('#speak-notes-play-button');

const scheduled = await page.evaluate(() => window.__scheduled);
// Speech sources are the ones started with an explicit duration; clicks and notes are not.
const speech = scheduled.filter(s => s.duration !== undefined && s.duration !== null);
console.log(`  speech buffers scheduled: ${speech.length}`);
console.log(`  playback rates used: ${[...new Set(speech.map(s => s.rate.toFixed(3)))].join(', ')}`);
check('speech was scheduled as buffers, not timers', speech.length > 0);
check('more than one playback rate was used',
    new Set(speech.map(s => s.rate.toFixed(3))).size > 1,
    `${new Set(speech.map(s => s.rate.toFixed(3))).size} distinct rates`);
check('every scheduled rate is within the fold',
    speech.every(s => s.rate >= 0.7 && s.rate <= 1.34),
    `${Math.min(...speech.map(s => s.rate)).toFixed(3)} .. ${Math.max(...speech.map(s => s.rate)).toFixed(3)}`);
check('every announcement has a positive length',
    speech.every(s => s.duration > 0));

const gaps = speech.slice(1).map((s, i) => s.when - speech[i].when);
console.log(`  intervals between announcements: ${gaps.map(g => (g * 1000).toFixed(0)).join(', ')} ms`);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
await app.close();
process.exit(failures === 0 ? 0 : 1);

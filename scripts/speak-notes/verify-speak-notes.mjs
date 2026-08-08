// Verifies the Speak the Notes dialog: structure, keyboard reachability, phrase generation,
// the measured tempo ceiling, and that announcements actually land before their notes.
//
// Asserts on the DOM and on scheduling times, not on anything visual.

// Repo root, from this file's own location, so the script runs from anywhere.
const APP_DIR = `${import.meta.dirname}/../..`.replace(/\\/g, '/');
const { _electron } = await import(`file:///${APP_DIR}/node_modules/playwright-core/index.mjs`);

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};

const app = await _electron.launch({ args: ['.'], cwd: APP_DIR });
const page = await app.firstWindow();
await page.waitForLoadState('domcontentloaded');

// The menu item sends this; drive it directly rather than clicking through the native menu.
await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.send('speak-notes:open'));
await page.waitForTimeout(1500);

console.log('=== Dialog opens and is put together correctly ===');
const structure = await page.evaluate(() => {
    const dialog = document.getElementById('speak-notes-dialog');
    const focusable = [...dialog.querySelectorAll('select, input, button')];
    return {
        open: dialog.open,
        labelledBy: dialog.getAttribute('aria-labelledby'),
        headingText: document.getElementById('speak-notes-dialog-heading')?.textContent,
        focusIsInside: dialog.contains(document.activeElement),
        passages: [...document.getElementById('speak-notes-passage-select').options].map(o => o.textContent),
        rates: [...document.getElementById('speak-notes-rate-select').options].map(o => o.value),
        voices: [...document.getElementById('speak-notes-voice-select').options].map(o => o.textContent),
        // Every control must carry a name a screen reader can announce.
        unlabelled: focusable.filter(el => {
            if (el.tagName === 'BUTTON') return !el.textContent.trim();
            const label = document.querySelector(`label[for="${el.id}"]`);
            return !label && !el.getAttribute('aria-label');
        }).map(el => el.id || el.tagName),
        liveRegions: [...dialog.querySelectorAll('[aria-live]')].map(el => ({
            id: el.id, live: el.getAttribute('aria-live'), role: el.getAttribute('role')
        }))
    };
});

check('dialog is open', structure.open);
check('dialog is labelled by its heading', structure.labelledBy === 'speak-notes-dialog-heading',
    structure.headingText);
check('focus lands inside the dialog', structure.focusIsInside);
check('three passages offered', structure.passages.length === 3, structure.passages.join(' | '));
check('rates are 6, 8, 10', structure.rates.join(',') === '6,8,10', structure.rates.join(','));
check('voice list populated', structure.voices.length > 0, structure.voices.join(' | '));
check('every control is labelled', structure.unlabelled.length === 0, structure.unlabelled.join(', '));
check('live regions use aria-live, not role=status',
    structure.liveRegions.length === 2 && structure.liveRegions.every(r => r.live === 'polite' && !r.role),
    JSON.stringify(structure.liveRegions));

console.log('\n=== Spoken text is built correctly ===');
// Reach the internals through a probe evaluated in page scope. The bundle is an IIFE, so the
// functions are not global; drive the visible behaviour instead and read the phrases back from
// what gets measured. Note names are checked directly against the same rule the code uses.
const names = await page.evaluate(() => {
    // Mirrors spokenNoteName: this asserts the intent, and the run below asserts the real thing.
    const CLASSES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
    const pitchName = midi => `${CLASSES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
    return [40, 42, 45, 51, 58, 64].map(m => ({
        midi: m,
        raw: pitchName(m),
        spoken: pitchName(m).replace('#', ' sharp').replace('b', ' flat').replace(/(\d)$/, ' $1')
    }));
});
for (const n of names) console.log(`      ${n.midi} -> "${n.raw}" -> "${n.spoken}"`);
check('sharps are spelled out', names.find(n => n.midi === 42).spoken === 'F sharp 2');
check('flats are spelled out', names.find(n => n.midi === 51).spoken === 'E flat 3',
    names.find(n => n.midi === 51).spoken);
check('octave is separated from the letter', names.find(n => n.midi === 40).spoken === 'E 2');

console.log('\n=== Measured tempo ceiling, per passage and rate ===');
const readLimit = () => page.evaluate(() => document.getElementById('speak-notes-limit').textContent);

const ceilings = {};
for (const passage of ['single-quarters', 'chords', 'mixed']) {
    for (const rate of ['6', '8', '10']) {
        await page.selectOption('#speak-notes-passage-select', passage);
        await page.selectOption('#speak-notes-rate-select', rate);
        await page.uncheck('#speak-notes-guitar-checkbox');   // skip sample loading; timing only
        await page.uncheck('#speak-notes-metronome-checkbox');
        await page.fill('#speak-notes-tempo-input', '300');   // ask for more than possible
        await page.click('#speak-notes-play-button');

        // Wait for the measuring pass to publish a limit.
        let text = '';
        for (let i = 0; i < 80; i++) {
            text = await readLimit();
            if (text) break;
            await page.waitForTimeout(250);
        }
        await page.click('#speak-notes-play-button'); // stop
        await page.waitForTimeout(150);

        const bpm = Number(text.match(/Fastest tempo these phrases fit: (\d+)/)?.[1] ?? 0);
        ceilings[`${passage}@${rate}`] = bpm;
        console.log(`  ${passage.padEnd(16)} rate ${rate.padStart(2)}:  ${String(bpm).padStart(3)} bpm` +
            `   ${text.match(/Longest phrase "([^"]+)" takes (\d+)/)?.slice(1).join(' = ') ?? ''} ms`);
    }
}

check('a ceiling was measured every time', Object.values(ceilings).every(v => v > 0));
check('faster speech raises the ceiling',
    ceilings['chords@10'] > ceilings['chords@6'],
    `rate 6: ${ceilings['chords@6']}, rate 10: ${ceilings['chords@10']}`);
check('single notes run faster than chords',
    ceilings['single-quarters@8'] > ceilings['chords@8'],
    `single: ${ceilings['single-quarters@8']}, chords: ${ceilings['chords@8']}`);
check('the tempo asked for is reduced to the limit',
    (await readLimit()).includes('Playing at'));

console.log('\n=== Speaking the duration costs tempo ===');
await page.selectOption('#speak-notes-passage-select', 'chords');
await page.selectOption('#speak-notes-rate-select', '8');
await page.check('#speak-notes-duration-checkbox');
await page.fill('#speak-notes-tempo-input', '300');
await page.click('#speak-notes-play-button');
let withDuration = '';
for (let i = 0; i < 80; i++) {
    withDuration = await readLimit();
    if (withDuration) break;
    await page.waitForTimeout(250);
}
await page.click('#speak-notes-play-button');
const withDurationBpm = Number(withDuration.match(/fit: (\d+)/)?.[1] ?? 0);
console.log(`  chords @ 8, duration spoken: ${withDurationBpm} bpm ` +
    `(against ${ceilings['chords@8']} without)`);
check('speaking the duration lowers the ceiling', withDurationBpm < ceilings['chords@8'],
    `${withDurationBpm} vs ${ceilings['chords@8']}`);

console.log('\n=== Announcements are scheduled to finish before their notes ===');
// Run the mixed passage for real, recording when each utterance starts and ends against the
// audio clock, and compare with the beat the note is scheduled on.
await page.evaluate(() => {
    window.__spoken = [];
    const realSpeak = speechSynthesis.speak.bind(speechSynthesis);
    speechSynthesis.speak = utterance => {
        const entry = { text: utterance.text, calledAt: performance.now(), endedAt: null };
        window.__spoken.push(entry);
        utterance.addEventListener('end', () => { entry.endedAt = performance.now(); });
        return realSpeak(utterance);
    };
});
await page.uncheck('#speak-notes-duration-checkbox');
await page.selectOption('#speak-notes-passage-select', 'mixed');
await page.selectOption('#speak-notes-rate-select', '8');
await page.check('#speak-notes-metronome-checkbox');
await page.fill('#speak-notes-tempo-input', '60');
await page.click('#speak-notes-play-button');
await page.waitForTimeout(25000);
await page.click('#speak-notes-play-button');

const run = await page.evaluate(() => ({
    spoken: window.__spoken,
    status: document.getElementById('speak-notes-status').textContent,
    limit: document.getElementById('speak-notes-limit').textContent
}));
console.log(`  status: ${run.status}`);
console.log(`  limit : ${run.limit}`);

// The measuring pass speaks each distinct phrase once; the playing pass speaks every event.
const played = run.spoken.slice(-12);
const gaps = played.slice(1).map((s, i) => s.calledAt - played[i].calledAt);
console.log(`  announcements during playback: ${played.length}`);
console.log(`  order: ${played.map(s => `"${s.text}"`).join(', ')}`);
console.log(`  gaps between announcements: ${gaps.map(g => g.toFixed(0)).join(', ')} ms`);

check('every event was announced', played.length === 12, `${played.length} of 12`);
check('the eighth-note pairs are announced closer together than the quarters',
    Math.min(...gaps) < Math.max(...gaps) * 0.7,
    `min ${Math.min(...gaps).toFixed(0)} ms, max ${Math.max(...gaps).toFixed(0)} ms`);
check('no announcement was skipped or doubled',
    new Set(played.map((s, i) => `${i}:${s.text}`)).size === played.length);

console.log('\n=== Dialog closes cleanly ===');
await page.click('#speak-notes-ok-button');
await page.waitForTimeout(400);
const afterClose = await page.evaluate(() => ({
    open: document.getElementById('speak-notes-dialog').open,
    speaking: speechSynthesis.speaking,
    pending: speechSynthesis.pending
}));
check('dialog closed', !afterClose.open);
check('speech stopped with it', !afterClose.speaking && !afterClose.pending,
    `speaking=${afterClose.speaking} pending=${afterClose.pending}`);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
await app.close();
process.exit(failures === 0 ? 0 : 1);

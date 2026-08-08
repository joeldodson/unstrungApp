// Verifies the Speak the Notes bench against a real song rather than a made-up sequence:
// that the open song's tracks are offered, that the announcements match what the file holds,
// that the octave option takes effect, and what tempo the first 10 measures actually allow.

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

// Open Ripple through the same path the File menu uses. The bytes are read here rather than in
// the main process: evaluate() runs without require, and only plain data crosses the bridge.
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

console.log('=== The open song is offered ===');
const passages = await page.evaluate(() =>
    [...document.getElementById('speak-notes-passage-select').options]
        .map(o => ({ value: o.value, text: o.textContent })));
for (const p of passages) console.log(`      ${p.value.padEnd(14)} ${p.text}`);
check('the song\'s tracks are listed first',
    passages[0].value.startsWith('song:') && passages[0].text.includes('Ripple'));
check('all four tracks are offered', passages.filter(p => p.value.startsWith('song:')).length === 4);
check('the built-in passages are still there',
    passages.some(p => p.value === 'chords'));
check('the octave checkbox exists and is off by default',
    await page.isVisible('#speak-notes-octave-checkbox') &&
    !(await page.isChecked('#speak-notes-octave-checkbox')));

// Capture what actually gets spoken, without waiting for playback.
await page.evaluate(() => {
    window.__spoken = [];
    const realSpeak = speechSynthesis.speak.bind(speechSynthesis);
    speechSynthesis.speak = utterance => {
        window.__spoken.push(utterance.text);
        return realSpeak(utterance);
    };
});

const measurePassage = async (passageValue, { octave, measures = '10' } = {}) => {
    await page.selectOption('#speak-notes-passage-select', passageValue);
    await page.fill('#speak-notes-measures-input', measures);
    await page.setChecked('#speak-notes-octave-checkbox', Boolean(octave));
    await page.uncheck('#speak-notes-guitar-checkbox');
    await page.uncheck('#speak-notes-metronome-checkbox');
    await page.fill('#speak-notes-tempo-input', '300');
    await page.evaluate(() => { window.__spoken = []; });
    await page.click('#speak-notes-play-button');

    let limit = '';
    for (let i = 0; i < 160; i++) {
        limit = await page.evaluate(() => document.getElementById('speak-notes-limit').textContent);
        if (limit) break;
        await page.waitForTimeout(250);
    }
    const phrases = await page.evaluate(() => [...new Set(window.__spoken)]);
    await page.click('#speak-notes-play-button');
    await page.waitForTimeout(200);
    return { limit, phrases };
};

console.log('\n=== Acoustic Lead, first 10 measures, no octave ===');
const lead = await measurePassage('song:1:0');
console.log(`  ${lead.limit}`);
console.log(`  distinct phrases (${lead.phrases.length}): ${lead.phrases.join(' | ')}`);

const leadBpm = Number(lead.limit.match(/fit: (\d+)/)?.[1] ?? 0);
check('a tempo ceiling was measured', leadBpm > 0, `${leadBpm} bpm`);
check('nothing came out as "unknown"', !lead.phrases.includes('unknown'),
    lead.limit.match(/(\d+) unknown/)?.[0] ?? '');
check('multi-note beats were named from their notes',
    /(\d+) named from their notes/.test(lead.limit) &&
    Number(lead.limit.match(/(\d+) named from their notes/)[1]) > 0);
check('no octave numbers in the phrases',
    !lead.phrases.some(p => /\d$/.test(p) && !/ 7$/.test(p)),
    lead.phrases.filter(p => /\d$/.test(p)).join(', '));

console.log('\n=== Same passage, octave spoken ===');
const leadOctave = await measurePassage('song:1:0', { octave: true });
console.log(`  ${leadOctave.limit}`);
console.log(`  distinct phrases (${leadOctave.phrases.length}): ${leadOctave.phrases.join(' | ')}`);
const leadOctaveBpm = Number(leadOctave.limit.match(/fit: (\d+)/)?.[1] ?? 0);
check('single notes now carry an octave',
    leadOctave.phrases.some(p => /^[A-G]( sharp| flat)? \d$/.test(p)),
    leadOctave.phrases.slice(0, 5).join(', '));
check('chord names never gain an octave',
    !leadOctave.phrases.some(p => /major \d|minor \d/.test(p)));
console.log(`  ceiling without octave ${leadBpm} bpm, with octave ${leadOctaveBpm} bpm`);

console.log('\n=== The other tracks ===');
for (const [index, name] of [[1, 'Acoustic Capo VII'], [2, 'Electric Bass'], [3, 'Mandolin']]) {
    const result = await measurePassage(`song:1:${index}`);
    const bpm = Number(result.limit.match(/fit: (\d+)/)?.[1] ?? 0);
    const counts = result.limit.match(/(\d+) beats: (.+)$/)?.[0] ?? '(nothing to play)';
    console.log(`  track ${index} ${name.padEnd(20)} ${String(bpm).padStart(3)} bpm   ${counts}`);
}

console.log('\n=== Longer selection, to see "unknown" if it ever fires ===');
const whole = await measurePassage('song:1:0', { measures: '102' });
console.log(`  ${whole.limit}`);
check('the whole song still measures a ceiling',
    Number(whole.limit.match(/fit: (\d+)/)?.[1] ?? 0) > 0);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
await app.close();
process.exit(failures === 0 ? 0 : 1);

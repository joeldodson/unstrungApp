// Checks a progression played on the audio track player (docs/one-player.md, stage 3, step 4):
//
// - Playback Settings are a track's, with Strumming pattern and Feel after the tempo: tempo 15 to
//   300, Times to play 1 to 50, Loop, Count in before every repeat always shown.
// - Playback Controls are a track's, Restart Selection included.
// - Times to play 2 plays twice and says so at the end; l turns Loop on and off.
// - The tempo keys step by 5 and say the tempo; a 6/8 progression's tempo counts eighths.
// - Changing the pattern or the feel while playing carries on playing.
// - The keys and the Playback Keys dialog are a track's, with d naming the progression's tempo.
//
// Drives the Electron app on a scratch profile, judged from the DOM, the announcement line and the
// times sounds are started at.
//
//   npm run build:renderer
//   node scripts/progressions/verify-progression-player.mjs

import { launchApp, runMenuCommand } from '../lib/app-ui.mjs';

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const { page, close } = await launchApp();
const errors = [];
page.on('pageerror', error => errors.push(error.message));

await page.evaluate(() => {
    window.__starts = [];
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (when, ...rest) {
        window.__starts.push({ when: when ?? 0, length: this.buffer?.duration ?? 0 });
        return start.call(this, when, ...rest);
    };
});

const read = () => page.evaluate(() => {
    const panel = document.querySelector('#item-panels > section:not([hidden])');
    const control = start => document.getElementById([...panel.querySelectorAll('label')]
        .find(l => l.textContent.startsWith(start))?.htmlFor);
    const play = [...panel.querySelectorAll('button')].find(b => b.getAttribute('aria-pressed') !== null);
    return {
        labels: [...panel.querySelectorAll('.audio-track > p > label')].map(l => l.textContent),
        buttons: [...panel.querySelectorAll('.audio-track button')].map(b => b.textContent),
        tempo: control('Tempo')?.value, tempoMin: control('Tempo')?.min, tempoMax: control('Tempo')?.max,
        times: control('Times to play')?.value, timesMin: control('Times to play')?.min,
        loop: control('Loop')?.checked,
        eachPassShown: !control('Count in before every repeat')?.closest('p').hidden,
        playing: play?.getAttribute('aria-pressed') === 'true',
        announce: panel.querySelector('.audio-track p[aria-live="polite"]:not([role])')?.textContent
    };
});
const setField = (labelStart, value) => page.evaluate(({ start, value }) => {
    const panel = document.querySelector('#item-panels > section:not([hidden])');
    const input = document.getElementById([...panel.querySelectorAll('label')].find(l => l.textContent.startsWith(start)).htmlFor);
    if (input.type === 'checkbox') { if (input.checked !== value) input.click(); }
    else { input.value = value; input.dispatchEvent(new Event('change')); }
}, { start: labelStart, value });
const choosePattern = text => page.evaluate(text => {
    const panel = document.querySelector('#item-panels > section:not([hidden])');
    const select = document.getElementById([...panel.querySelectorAll('label')].find(l => l.textContent === 'Strumming pattern').htmlFor);
    select.value = [...select.options].find(o => o.textContent.startsWith(text)).value;
    select.dispatchEvent(new Event('change'));
}, text);
const press = name => page.evaluate(name => {
    const panel = document.querySelector('#item-panels > section:not([hidden])');
    const button = [...panel.querySelectorAll('button')].find(b => b.textContent === name);
    button.focus();
    button.click();
}, name);
const key = async k => { await page.keyboard.press(k); await wait(250); };
const waitFor = async (test, seconds) => {
    for (let i = 0; i < seconds * 10; i++) {
        if (test(await read())) return true;
        await wait(100);
    }
    return false;
};
async function generate({ beats = 4, unit = 4, tempo = 240, count = 2 } = {}) {
    await runMenuCommand(page, 'chord-practice');
    await wait(1200);
    await page.fill('#chord-practice-beats-input', String(beats));
    await page.dispatchEvent('#chord-practice-beats-input', 'change');
    await page.fill('#chord-practice-beat-unit-input', String(unit));
    await page.dispatchEvent('#chord-practice-beat-unit-input', 'change');
    await page.fill('#chord-practice-tempo-input', String(tempo));
    await page.fill('#chord-practice-count-input', String(count));
    await page.uncheck('#chord-practice-speak-checkbox');
    await page.click('#chord-practice-generate-button');
    await wait(1500);
}

try {
    console.log('The Chord Practice dialog');
    await runMenuCommand(page, 'chord-practice');
    await wait(1200);
    const dialog = await page.evaluate(() => ({
        tempo: document.querySelector('label[for="chord-practice-tempo-input"]').textContent,
        tempoMin: document.getElementById('chord-practice-tempo-input').min,
        tempoMax: document.getElementById('chord-practice-tempo-input').max,
        times: document.querySelector('label[for="chord-practice-repeat-input"]').textContent,
        timesValue: document.getElementById('chord-practice-repeat-input').value,
        loop: document.querySelector('label[for="chord-practice-loop-checkbox"]')?.textContent,
        loopChecked: document.getElementById('chord-practice-loop-checkbox')?.checked
    }));
    check('tempo runs 15 to 300', dialog.tempoMin === '15' && dialog.tempoMax === '300' && dialog.tempo === 'Tempo in beats per minute, 15 to 300', JSON.stringify(dialog));
    check('Times to play, 1 to 50, starting at 1, then Loop, unchecked', dialog.times === 'Times to play, 1 to 50' &&
        dialog.timesValue === '1' && dialog.loop === 'Loop' && dialog.loopChecked === false, JSON.stringify(dialog));
    await page.click('#chord-practice-cancel-button');

    console.log('\nThe tab: two measures of 4/4 at 240, two seconds a time through');
    await generate();
    let r = await read();
    check('Playback Settings are a track\'s, with the pattern and Feel after the tempo', r.labels.join(' | ') ===
        'Tempo in beats per minute, 15 to 300 | Strumming pattern | Feel | Speak the next measure | ' +
        'Metronome | Count in, one measure of clicks before playing starts | Times to play, 1 to 50 | Loop | ' +
        'Count in before every repeat | Number of beats to count in', r.labels.join(' | '));
    check('tempo runs 15 to 300', r.tempoMin === '15' && r.tempoMax === '300', `${r.tempoMin}-${r.tempoMax}`);
    check('Times to play 1 and Loop off, from the dialog', r.times === '1' && r.loop === false);
    check('Count in before every repeat is shown', r.eachPassShown);
    check('Playback Controls are a track\'s', r.buttons.join(' | ') ===
        'Play | Where Am I | Slower | Faster | Default Tempo | Restart Selection | Previous Measure | Next Measure | Start of Measure',
        r.buttons.join(' | '));

    console.log('\nPlaying twice');
    await setField('Count in, one measure', false);
    await setField('Times to play', '2');
    await press('Play');
    check('it plays', await waitFor(s => s.playing, 30));
    check('and stops after two times through', await waitFor(s => !s.playing, 8));
    r = await read();
    check('saying it played twice', r.announce === 'End of progression, played 2 times.', r.announce);

    console.log('\nThe keys');
    await key('l');
    r = await read();
    check('l turns Loop on and says so', r.loop === true && r.announce === 'Loop on', `${r.loop} ${r.announce}`);
    await key('l');
    check('and off', (await read()).loop === false);
    await key('f');
    r = await read();
    check('f is 5 faster, said as the tempo', r.tempo === '245' && r.announce === '245 BPM', `${r.tempo} ${r.announce}`);
    await key('d');
    r = await read();
    check('d goes back to the tempo it opened with', r.tempo === '240' && r.announce === 'Default tempo, 240 BPM', `${r.tempo} ${r.announce}`);
    await key('?');
    const keys = await page.evaluate(() => ({
        intro: document.getElementById('playback-keys-intro').textContent,
        items: [...document.querySelectorAll('#playback-keys-list li')].map(li => li.textContent)
    }));
    check('? lists the track\'s keys for the progression, l included', keys.intro === 'These keys play the progression.' &&
        keys.items.includes('l: loop on or off.') &&
        keys.items.includes('d: back to the default tempo: the progression\'s own, or the one last typed into the Tempo field.'),
        keys.items.join(' | '));
    await page.click('#playback-keys-close-button');
    await wait(200);

    console.log('\nChanging the pattern and the feel while it plays');
    await setField('Loop', true);
    await press('Play');
    await waitFor(s => s.playing, 10);
    await wait(1000);
    await page.evaluate(() => { window.__starts = []; });
    await choosePattern('All Down-Up');
    await wait(1500);
    r = await read();
    // Notes at 240: All Down-Up strums every eighth, an eighth of a second apart.
    const notes = [...new Set((await page.evaluate(() => window.__starts)).filter(s => s.length >= 0.1).map(s => Math.round(s.when * 8) / 8))];
    check('a new pattern keeps playing, now strumming every eighth', r.playing && notes.length >= 10, `${notes.length} eighths`);
    await setField('Feel', 'triplet8th');
    await wait(800);
    check('a feel chosen keeps playing', (await read()).playing);
    await press('Pause');

    console.log('\nA 6/8 progression at 120: six eighths a measure, two a second');
    await generate({ beats: 6, unit: 8, tempo: 120, count: 2 });
    await setField('Count in, one measure', false);
    await setField('Metronome', true);
    await page.evaluate(() => { window.__starts = []; });
    await press('Play');
    await waitFor(s => s.playing, 30);
    await wait(2500);
    const clicks = (await page.evaluate(() => window.__starts)).filter(s => s.length < 0.1).map(s => s.when).sort((a, b) => a - b);
    const gaps = clicks.slice(1, 7).map((at, i) => Math.round((at - clicks[i]) * 1000) / 1000);
    check('the metronome clicks each eighth, half a second apart', gaps.length === 6 && gaps.every(g => Math.abs(g - 0.5) < 0.01), gaps.join(' '));
    await press('Pause');

    check('no errors in the page', errors.length === 0, errors.join(' | '));
} finally {
    await close();
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exitCode = failures === 0 ? 0 : 1;

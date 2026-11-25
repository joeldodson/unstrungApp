// Verifies the Tuner item in the real app, with Chromium's fake input device playing a generated
// recording in place of a microphone: no guitar, no listening.
//
// Four recordings of a string with harmonics, looped by the fake device:
//   A2 12 cents flat, steady: the reading in chromatic and string mode, the full reading spoken,
//   the feedback tone moved down by six times the error, in the pulse sound a whole tone down and
//   pulsing, and with no sound, the tone silent.
//   E2 in tune, steady, from an input that says it has one channel: the Input channel group stays
//   hidden, the reading, the tone resting on its centre, and the chime.
//   E2 gliding from 15 cents flat to 6 sharp: said once, in full, however far it goes.
//   E2 12 cents flat, plucked and plucked again 2.5 seconds later while still ringing: the same
//   full reading said again for the second pluck, the live region emptied at the pluck.
// Also the item's place on the menu, its headings, groups and labels, the Controls region before
// the keys, the Input channel group hidden until a two-channel input is opened, Start and Stop with
// aria-pressed, the keys and where they leave the arrows alone, and opening the input again when
// echo cancellation changes.
//
// The feedback is checked from data, not by ear: the page's createOscillator is wrapped before
// Start so the oscillators' frequencies can be read. Asserts on text, structure and those values.
//
//   node scripts/tuner/verify-tuner.mjs            the Electron app, on a scratch profile
//   node scripts/tuner/verify-tuner.mjs --web URL  the web build in Edge, for example
//                                                  http://localhost:8090/unstrung/app/
//                                                  after npm run build:web and serve:web

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { APP_DIR, launchApp, runMenuCommand } from '../lib/app-ui.mjs';

const webIndex = process.argv.indexOf('--web');
const webUrl = webIndex === -1 ? null : process.argv[webIndex + 1];

/** The app, or the web build in Edge, with the fake input device playing `file`. */
async function launch(file) {
    const args = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
        `--use-file-for-fake-audio-capture=${file}`];
    if (!webUrl) return launchApp({ args });  // { app, page, close }
    const { chromium } = await import(pathToFileURL(path.join(APP_DIR, 'node_modules', 'playwright-core', 'index.mjs')).href);
    const browser = await chromium.launch({ channel: 'msedge', args });
    const page = await browser.newPage();
    await page.goto(webUrl);
    await page.waitForSelector('#app-menu-button');
    return { page, close: () => browser.close() };
}

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};

/**
 * A mono 16-bit WAV of a string: a fundamental and six harmonics. `frequency` and `level` may be
 * numbers or functions of the time in seconds, for a glide or a pluck dying away.
 */
function stringWav(frequency, { seconds = 3, level = 1, rate = 48000 } = {}) {
    const frequencyAt = typeof frequency === 'function' ? frequency : () => frequency;
    const levelAt = typeof level === 'function' ? level : () => level;
    const frames = Math.round(seconds * rate);
    const buffer = Buffer.alloc(44 + frames * 2);
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + frames * 2, 4);
    buffer.write('WAVEfmt ', 8);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(rate, 24);
    buffer.writeUInt32LE(rate * 2, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(frames * 2, 40);
    const harmonics = [1, 1.2, 0.7, 0.4, 0.3, 0.15, 0.1];
    // The phase is summed sample by sample, so a changing frequency glides without clicks.
    let phase = 0;
    for (let i = 0; i < frames; i++) {
        const t = i / rate;
        let v = 0;
        harmonics.forEach((amp, h) => { v += amp * Math.sin((h + 1) * phase + h); });
        buffer.writeInt16LE(Math.round(v * 0.08 * levelAt(t) * 32767), 44 + i * 2);
        phase += 2 * Math.PI * frequencyAt(t) / rate;
    }
    return buffer;
}

const midiHz = midi => 440 * 2 ** ((midi - 69) / 12);
const folder = await mkdtemp(path.join(tmpdir(), 'unstrung-tuner-'));
const PANEL = '#item-panels > section:not([hidden])';

async function withRecording(name, wav, body) {
    const file = path.join(folder, `${name}.wav`);
    await writeFile(file, wav);
    const { page, close } = await launch(file);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    try {
        // Record every oscillator the page makes: the tuner's tone first, then its pulse, then chimes.
        await page.evaluate(() => {
            window.__oscillators = [];
            const original = AudioContext.prototype.createOscillator;
            AudioContext.prototype.createOscillator = function () {
                const oscillator = original.call(this);
                window.__oscillators.push(oscillator);
                return oscillator;
            };
            // And every gain: the tuner's are its sink, tremolo, pulse depth, envelope and volume.
            window.__gains = [];
            const createGain = AudioContext.prototype.createGain;
            AudioContext.prototype.createGain = function () {
                const gain = createGain.call(this);
                window.__gains.push(gain);
                return gain;
            };
            // Everything the live region says, in order.
            window.__said = [];
            // Every change to a live region with its time, emptying included.
            window.__liveEvents = [];
            // Only changes to a live region count: other text on the page changes all the time.
            new MutationObserver(mutations => {
                for (const mutation of mutations) {
                    const region = mutation.target.closest?.('p[aria-live]') ?? mutation.target.parentElement?.closest('p[aria-live]');
                    const text = region?.textContent.trim();
                    if (region) window.__liveEvents.push({ text, at: performance.now() });
                    if (text) window.__said.push(text);
                }
            }).observe(document.body, { subtree: true, childList: true, characterData: true });
            window.__streams = [];
            const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
            navigator.mediaDevices.getUserMedia = async constraints => {
                const stream = await getUserMedia(constraints);
                window.__streams.push(stream);
                // The fake input always has two channels. This makes it say it has one, as most
                // microphones do.
                if (window.__oneChannel) {
                    const track = stream.getAudioTracks()[0];
                    const getSettings = track.getSettings.bind(track);
                    track.getSettings = () => ({ ...getSettings(), channelCount: 1 });
                }
                return stream;
            };
        });
        await runMenuCommand(page, 'tuner');
        await page.waitForSelector(`${PANEL} h2`);
        // The Input list is filled once the inputs have been asked for.
        await page.waitForFunction(selector => document.querySelector(`${selector} select`)?.options.length > 0, PANEL);
        await body(page);
    } finally {
        check(`${name}: no errors on the page`, errors.length === 0, errors.slice(0, 3).join(' | '));
        await close();
    }
}

const text = (page, selector) => page.$eval(selector, el => el.textContent.trim());
const readout = page => page.$eval(`${PANEL} h2 + p`, el => el.textContent.trim());
const liveRegion = page => page.$eval(`${PANEL} p[aria-live]`, el => el.textContent.trim());
const button = (page, name) => page.locator(`${PANEL} button`, { hasText: new RegExp(`^${name}$`) });
const radio = (page, label) => page.getByLabel(label, { exact: true });
const oscillatorHz = (page, index) => page.evaluate(i => window.__oscillators[i]?.frequency.value, index);
const wait = (page, ms) => page.waitForTimeout(ms);
const said = page => page.evaluate(() => window.__said);
const steady = frequency => stringWav(frequency);
const HEADPHONES = 'Headphones or a plugged-in guitar, so the tuner\'s sounds can\'t reach its input';

console.log(webUrl ? `Web build in Edge: ${webUrl}` : 'Electron app');
console.log('=== A2, 12 cents flat ===');
await withRecording('a2-flat', steady(midiHz(45 - 0.12)), async page => {
    const structure = await page.evaluate(selector => {
        const panel = document.querySelector(selector);
        return {
            menuItem: document.querySelector('#menu-tuner')?.textContent,
            afterMetronome: document.querySelector('#menu-metronome').closest('li').nextElementSibling
                ?.querySelector('[role="menuitem"]')?.id,
            heading: panel.querySelector('h2').textContent,
            sections: [...panel.querySelectorAll('h3')].map(h => h.textContent),
            legends: [...panel.querySelectorAll('legend')].map(l => l.textContent),
            unlabelled: [...panel.querySelectorAll('input, select')].filter(c => !c.labels?.length).length,
            focused: document.activeElement?.textContent,
            current: document.querySelector('#open-items-list button[aria-current="true"]')?.textContent,
            inputs: [...panel.querySelectorAll('select')][0].options.length,
            controls: (() => {
                const region = panel.querySelector('section[aria-labelledby]');
                const heading = region && document.getElementById(region.getAttribute('aria-labelledby'));
                return region && {
                    name: heading?.textContent,
                    headingInside: heading?.parentElement === region,
                    buttons: [...region.querySelectorAll('button')].map(b => b.textContent),
                    liveInside: Boolean(region.querySelector('p[aria-live]')),
                    nextHeading: region.nextElementSibling?.textContent
                };
            })(),
            channelHidden: [...panel.querySelectorAll('fieldset')]
                .find(f => f.querySelector('legend').textContent === 'Input channel')?.hidden
        };
    }, PANEL);
    check('Tuner is on the menu after Metronome', structure.menuItem === 'Tuner' && structure.afterMetronome === 'menu-tuner');
    check('the item is called Tuner', structure.heading === 'Tuner' && structure.current === 'Tuner');
    const sections = ['Input', 'Mode', 'Feedback', 'Controls', 'Keyboard Control'];
    check('sections', JSON.stringify(structure.sections) === JSON.stringify(sections),
        structure.sections.join(', '));
    check('radio groups', JSON.stringify(structure.legends) ===
        JSON.stringify(['Input channel', 'Mode', 'Feedback sound']), structure.legends.join(', '));
    const feedbackBoxes = await page.evaluate(selector => [...document.querySelectorAll(`${selector} input[type="checkbox"]`)]
        .map(box => box.labels[0].textContent).filter(label => !/filter|echo/i.test(label)), PANEL);
    check('the feedback checkboxes', JSON.stringify(feedbackBoxes) === JSON.stringify([HEADPHONES, 'Chime when in tune',
        'Speak the note and how far off once it settles']), feedbackBoxes.join(', '));
    const controls = structure.controls;
    check('the buttons are in a region named Controls by its heading, before the keys',
        controls?.name === 'Controls' && controls.headingInside && controls.nextHeading === 'Keyboard Control'
            && JSON.stringify(controls.buttons) === JSON.stringify(['Start', 'Say Reading', 'Say Input Level', 'Quieter', 'Louder']),
        JSON.stringify(controls));
    check('with the live region after the buttons', controls?.liveInside);
    check('the Input channel group is hidden until an input is opened', structure.channelHidden === true);
    check('every control has a label', structure.unlabelled === 0, `${structure.unlabelled} without`);
    check('focus starts on Start', structure.focused === 'Start');
    check('the Input list has inputs', structure.inputs >= 1, `${structure.inputs}`);
    check('stopped to begin with', await readout(page) === 'Stopped.');

    await page.keyboard.press('Space');
    await page.waitForFunction(selector => document.querySelector(`${selector} h2 + p`).textContent !== 'Stopped.', PANEL);
    check('spaceBar starts it', await button(page, 'Stop').getAttribute('aria-pressed') === 'true');
    const inputChannels = await page.evaluate(selector => {
        const group = [...document.querySelectorAll(`${selector} fieldset`)]
            .find(f => f.querySelector('legend').textContent === 'Input channel');
        return { hidden: group.hidden };
    }, PANEL);
    // What the tuner's own input says it has.
    const reported = await page.evaluate(() => window.__streams[0].getAudioTracks()[0].getSettings().channelCount ?? null);
    check('the Input channel group shows only for an input with more than one channel',
        inputChannels.hidden === (reported === 1), `the fake input has ${reported} channels, group hidden ${inputChannels.hidden}`);
    await wait(page, 1800);
    const chromatic = await readout(page);
    const cents = Number(chromatic.match(/(\d+) cents flat/)?.[1]);
    check('reads A2, about 12 cents flat', chromatic.startsWith('A2, ') && Math.abs(cents - 12) <= 2, chromatic);
    check('the full reading is spoken', /^A2, 1[0-4] cents flat$/.test(await liveRegion(page)), await liveRegion(page));
    check('and only once while it holds steady', (await said(page)).filter(t => t.startsWith('A2')).length === 1,
        (await said(page)).join(' | '));
    const toneHz = await oscillatorHz(page, 0);
    const expectedHz = 2000 * 2 ** (-12 * 6 / 1200);
    check('the tone sits six times 12 cents below 2,000 Hz', Math.abs(toneHz - expectedHz) < 15,
        `${toneHz?.toFixed(1)} Hz, expected about ${expectedHz.toFixed(1)}`);

    await page.keyboard.press('r');
    await wait(page, 100);
    check('r says the reading', /^A2, \d+ cents flat$/.test(await liveRegion(page)), await liveRegion(page));
    await page.keyboard.press('l');
    await wait(page, 100);
    check('l says the input level', /^Input peak -\d+ dB\.$/.test(await liveRegion(page)), await liveRegion(page));
    await page.keyboard.press('ArrowUp');
    await wait(page, 100);
    check('upArrow is louder', await liveRegion(page) === 'Volume 6', await liveRegion(page));

    // String mode, from its radio button; the arrows there move through the group, not the volume.
    await radio(page, 'String: the nearest string of the tuning chosen below').check();
    await wait(page, 1600);
    check('string mode reads string 5', /^string 5, A2, \d+ cents flat$/.test(await readout(page)), await readout(page));
    check('string mode speaks the string in full', /^string 5, A2, 1[0-4] cents flat$/.test(await liveRegion(page)),
        await liveRegion(page));
    await radio(page, 'String: the nearest string of the tuning chosen below').focus();
    await page.keyboard.press('ArrowUp');
    await wait(page, 100);
    check('upArrow in a radio group moves through it',
        await radio(page, 'Chromatic: the nearest note').isChecked() && await liveRegion(page) !== 'Volume 7');

    await radio(page, 'Pulses that slow down').check();
    await wait(page, 600);
    const pulseTone = await oscillatorHz(page, 0);
    const pulseRate = await oscillatorHz(page, 1);
    check('pulses: the tone is a whole tone below the centre', Math.abs(pulseTone - 2000 * 2 ** (-200 / 1200)) < 5,
        `${pulseTone?.toFixed(1)} Hz`);
    check('pulses: about 4.5 a second at 12 cents', Math.abs(pulseRate - 4.5) < 0.6, `${pulseRate?.toFixed(2)}`);

    await page.getByLabel(HEADPHONES, { exact: true }).check();
    await wait(page, 400);
    check('with headphones the tone moves down near 660 Hz', Math.abs(await oscillatorHz(page, 0) - 660 * 2 ** (-200 / 1200)) < 5,
        `${(await oscillatorHz(page, 0))?.toFixed(1)} Hz`);

    // No sound: the envelope, the fourth gain, goes silent, and the reading goes on.
    const envelope = () => page.evaluate(() => window.__gains[3]?.gain.value);
    check('a sound is playing before None', await envelope() > 0.9, `${await envelope()}`);
    await radio(page, 'None').check();
    await wait(page, 400);
    check('None silences the tone', await envelope() < 0.01, `${await envelope()}`);
    await radio(page, 'Rising and falling tone').check();
    await wait(page, 200);
    check('and choosing a sound again brings it back', await envelope() > 0.9, `${await envelope()}`);

    await page.getByLabel('Echo cancellation').check();
    await page.waitForFunction(selector => document.querySelector(`${selector} p[aria-live]`).textContent === 'Listening.', PANEL);
    await wait(page, 1000);
    check('echo cancellation opens the input again and it keeps reading', /^A2, /.test(await readout(page)), await readout(page));
    const streams = await page.evaluate(() => window.__streams.map(s => s.getTracks()[0].readyState));
    check('the first input was let go', JSON.stringify(streams) === '["ended","live"]', streams.join(', '));

    await button(page, 'Stop').click();
    await wait(page, 100);
    check('Stop stops it', await readout(page) === 'Stopped.' && await button(page, 'Start').getAttribute('aria-pressed') === 'false');
    check('Stop is said', await liveRegion(page) === 'Stopped.', await liveRegion(page));
});

console.log('=== E2, in tune ===');
await withRecording('e2-in-tune', steady(midiHz(40)), async page => {
    // As an input with one channel.
    await page.evaluate(() => { window.__oneChannel = true; });
    await button(page, 'Start').click();
    await wait(page, 1500);
    const channelHidden = await page.evaluate(selector => [...document.querySelectorAll(`${selector} fieldset`)]
        .find(f => f.querySelector('legend').textContent === 'Input channel').hidden, PANEL);
    check('an input with one channel leaves the Input channel group hidden', channelHidden === true);
    check('reads E2, in tune', await readout(page) === 'E2, in tune', await readout(page));
    const toneHz = await oscillatorHz(page, 0);
    check('the tone rests on its centre', Math.abs(toneHz - 2000) < 10, `${toneHz?.toFixed(1)} Hz`);
    const chime = await page.evaluate(() => window.__oscillators.slice(2).map(o => Math.round(o.frequency.value)));
    check('the chime played once, rising a fifth', JSON.stringify(chime) === JSON.stringify([2000, 3000]), chime.join(', '));
    await page.getByRole('button', { name: /^Close Tuner/ }).click();
    await wait(page, 200);
    const ended = await page.evaluate(() => window.__streams.every(s => s.getTracks().every(t => t.readyState === 'ended')));
    check('closing the item lets go of the input', ended && await page.locator(PANEL).count() === 0);
});

console.log('=== E2, gliding from 15 cents flat to 6 sharp ===');
// Half a second at 15 flat, three and a half seconds to 6 sharp, then a second there.
const glideCents = t => (t < 0.5 ? -15 : t < 4 ? -15 + 21 * (t - 0.5) / 3.5 : 6);
await withRecording('e2-glide', stringWav(t => midiHz(40 + glideCents(t) / 100), { seconds: 5 }), async page => {
    await button(page, 'Start').click();
    await wait(page, 4800);
    await button(page, 'Stop').click();
    const words = (await said(page)).filter(t => t !== 'Listening.' && t !== 'Stopped.');
    check('a string still moving is said once, in full, and not again however far it goes',
        words.length === 1 && /^E2, (\d+ cents (flat|sharp)|in tune)$/.test(words[0]), words.join(' | '));
});

console.log('=== E2, 12 cents flat, plucked twice ===');
// Plucked at the start and again 2.5 seconds in, dying away by about 27 dB in between.
const pluckLevel = t => 3 * Math.exp(-(t < 2.5 ? t : t - 2.5) / 0.8);
await withRecording('e2-plucks', stringWav(midiHz(40 - 0.12), { seconds: 5, level: pluckLevel }), async page => {
    await button(page, 'Start').click();
    await wait(page, 4800);
    const words = (await said(page)).filter(t => t !== 'Listening.');
    const full = words.filter(w => /^E2, 1[0-4] cents flat$/.test(w));
    check('the full reading for each pluck', full.length >= 2, words.join(' | '));
    check('and nothing in between while it rings steady', words.every(w => full.includes(w)), words.join(' | '));
    // The second pluck empties the live region, well before the same words come again.
    const events = await page.evaluate(() => window.__liveEvents);
    const readings = events.filter(e => /^E2, /.test(e.text));
    const emptied = events.filter(e => e.text === '' && e.at > readings[0]?.at && e.at < readings[1]?.at - 500);
    check('the second pluck empties the live region before the reading comes again', emptied.length >= 1,
        events.map(e => `${e.text || '(empty)'} ${Math.round(e.at)}`).join(' | '));
});

await rm(folder, { recursive: true, force: true });
console.log(failures ? `${failures} FAILED` : 'All passed');
process.exit(failures ? 1 : 0);

// Verifies the Metronome item in the real app: its place on the menu, its headings, labels and
// buttons, the Start/Stop toggle's aria-pressed, the keys and where they work, the tempo and volume
// bounds, Default Tempo, what is said in the live region, and the clicks themselves.
//
// The clicks are checked from data, not by ear: before Start, the page's AudioBufferSourceNode
// start, stop and connect are wrapped to record when each sound is due, what its buffer holds
// (800 Hz down, 1200 Hz the first down of a measure, 2400 Hz up, 3200 Hz the first up, noise for
// a mute, and a hard attack on a strong down) and the gain it is played at. Asserts on text,
// structure, focus and those records, never on anything visual.
//
// Also checks the D key, back to the default tempo, in a chord practice progression, and in an
// audio track when a song file is named.
//
//   node scripts/metronome/verify-metronome.mjs              the Electron app, on a scratch profile
//   node scripts/metronome/verify-metronome.mjs --song FILE  the same, and an audio track of FILE
//   node scripts/metronome/verify-metronome.mjs --web URL    the web build in Edge, for example
//                                                            http://localhost:8090/unstrung/app/
//                                                            after npm run build:web and serve:web

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { APP_DIR, launchApp, runMenuCommand, openSongFile, CURRENT_ITEM_BUTTON } from '../lib/app-ui.mjs';

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};

const webIndex = process.argv.indexOf('--web');
const webUrl = webIndex === -1 ? null : process.argv[webIndex + 1];

let page, finish, electronApp = null;
if (webUrl) {
    // Edge, the copy installed with Windows, through Playwright's msedge channel, so there is no
    // browser to download. Playwright's WebKit for Windows has no Web Audio at all, so it cannot
    // stand in for Safari here.
    const { chromium } = await import(pathToFileURL(path.join(APP_DIR, 'node_modules', 'playwright-core', 'index.mjs')).href);
    const browser = await chromium.launch({ channel: 'msedge' });
    page = await browser.newPage();
    await page.goto(webUrl);
    await page.waitForSelector('#app-menu-button');
    finish = () => browser.close();
} else {
    const launched = await launchApp();
    page = launched.page;
    electronApp = launched.app;
    finish = launched.close;
}
console.log(webUrl ? `Web build in Edge: ${webUrl}` : 'Electron app');
const consoleErrors = [];
page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('pageerror', error => consoleErrors.push(error.message));

const PANEL = '#item-panels > section:not([hidden])';
const wait = ms => page.waitForTimeout(ms);

// The Metronome item's controls, found by their labels.
const item = () => page.evaluate(selector => {
    const panel = document.querySelector(selector);
    const byLabel = text => {
        const label = [...panel.querySelectorAll('label')].find(l => l.textContent.startsWith(text));
        return label ? document.getElementById(label.htmlFor) : null;
    };
    const signature = byLabel('Time signature');
    const pattern = byLabel('Strumming pattern');
    const tempo = byLabel('Tempo');
    const volume = byLabel('Volume');
    const start = [...panel.querySelectorAll('button')].find(b => b.hasAttribute('aria-pressed'));
    const live = panel.querySelector('[aria-live]');
    const focused = document.activeElement;
    return {
        heading: panel.querySelector('h2')?.textContent,
        headings: [...panel.querySelectorAll('h3')].map(h => h.textContent),
        labels: [...panel.querySelectorAll('label')].map(l => `${l.textContent} -> ${document.getElementById(l.htmlFor)?.tagName.toLowerCase()}`),
        signature: signature?.value,
        signatures: [...(signature?.options ?? [])].map(o => o.textContent),
        pattern: pattern?.selectedOptions[0]?.textContent,
        patterns: [...(pattern?.options ?? [])].map(o => o.textContent),
        about: pattern?.closest('p').nextElementSibling.textContent,
        tempo: tempo?.value, tempoMin: tempo?.min, tempoMax: tempo?.max, tempoType: tempo?.type,
        volume: volume?.value, volumeMin: volume?.min, volumeMax: volume?.max, volumeType: volume?.type,
        buttons: [...panel.querySelectorAll('button')].map(b => b.textContent),
        rows: [...panel.querySelectorAll('.button-row')].map(row => [...row.querySelectorAll('button')].map(b => b.textContent)),
        startText: start?.textContent, pressed: start?.getAttribute('aria-pressed'),
        live: live?.textContent ?? null, liveAtomic: live?.getAttribute('aria-atomic'),
        keys: [...panel.querySelectorAll('ul li')].map(li => li.textContent),
        keysNote: panel.querySelector('ul').previousElementSibling?.textContent ?? '',
        focusedOn: focused === signature ? 'time signature' : focused === pattern ? 'pattern' : focused === tempo ? 'tempo'
            : focused === volume ? 'volume' : focused?.tagName === 'BUTTON' ? `button ${focused.textContent}` : focused?.tagName
    };
}, PANEL);

const button = label => page.locator(`${PANEL} button`, { hasText: new RegExp(`^${label}$`) });
const field = label => page.locator(`${PANEL} input[type="number"]`).nth(label === 'Tempo' ? 0 : 1);
// Presses a key and gives the live region its next task to fill in.
const key = async name => { await page.keyboard.press(name); await wait(80); };

// Records every sound the page starts from here on: when it is due, its buffer's pitch, the gain
// of the node it plays into, and whether it was cancelled before it sounded.
await page.evaluate(() => {
    window.__sounds = [];
    const proto = AudioBufferSourceNode.prototype;
    const start = proto.start;
    const stop = proto.stop;
    const connect = proto.connect;
    proto.connect = function (destination, ...rest) {
        this.__destination = destination;
        return connect.call(this, destination, ...rest);
    };
    proto.start = function (when = 0, ...rest) {
        let frequency = null;
        let hardAttack = false;
        const buffer = this.buffer;
        if (buffer && buffer.duration < 0.1) {
            const data = buffer.getChannelData(0);
            const crossingsIn = (from, to) => {
                let crossings = 0;
                for (let i = from + 1; i < to; i++) if ((data[i - 1] < 0) !== (data[i] < 0)) crossings++;
                return crossings;
            };
            // The pitch from after the attack, and the attack alone. In the first two milliseconds
            // a pure tone changes smoothly from sample to sample, so its second difference is
            // tiny, about 0.01 for 800 Hz; noise on the attack makes it jump.
            const after = Math.round(buffer.sampleRate * 0.004);
            frequency = Math.round(crossingsIn(after, data.length) / 2 / ((data.length - after) / buffer.sampleRate) / 100) * 100;
            const attackEnd = Math.round(buffer.sampleRate * 0.002);
            let roughness = 0;
            for (let i = 2; i < attackEnd; i++) roughness += Math.abs(data[i] - 2 * data[i - 1] + data[i - 2]);
            hardAttack = roughness / (attackEnd - 2) > 0.1;
        }
        // Noise crosses zero far more often than any of the tones.
        const kind = frequency === 1200 ? 'high down' : frequency === 800 ? (hardAttack ? 'strong down' : 'down')
            : frequency === 2400 ? 'up' : frequency === 3200 ? 'high up' : frequency > 5000 ? 'mute' : null;
        this.__sound = {
            when, frequency, kind, gain: this.__destination?.gain?.value ?? null,
            cancelled: false, startedAt: this.context.currentTime
        };
        window.__sounds.push(this.__sound);
        return start.call(this, when, ...rest);
    };
    proto.stop = function (when, ...rest) {
        const stopAt = when ?? this.context.currentTime;
        window.__lastStopCall = this.context.currentTime;
        if (this.__sound && stopAt <= this.__sound.when) this.__sound.cancelled = true;
        return stop.call(this, when, ...rest);
    };
});
const clicks = () => page.evaluate(() => window.__sounds
    .filter(s => s.kind && !s.cancelled)
    .sort((a, b) => a.when - b.when));
const audioNow = () => page.evaluate(() => Math.max(0, ...window.__sounds.map(s => s.startedAt)));
// A click as the checks write it, by its sound: down, strong down, high down, up, high up or mute.
const describe = c => c.kind;
const isDown = c => ['down', 'strong down', 'high down'].includes(c.kind);
const near = (a, b, tolerance = 0.002) => Math.abs(a - b) < tolerance;

// --- The menu ---------------------------------------------------------------------------------
console.log('\nThe menu');
const menu = await page.evaluate(() => [...document.querySelectorAll('#app-menu-list > li > [role="menuitem"]')]
    .map(item => ({ text: item.textContent.trim(), command: item.dataset.command })));
const metronomeIndex = menu.findIndex(m => m.command === 'metronome');
check('Metronome is on the top level of the menu', metronomeIndex !== -1 && menu[metronomeIndex].text === 'Metronome',
    menu.map(m => m.text).join(', '));
check('it comes after Strumming Patterns', menu[metronomeIndex - 1]?.command === 'strumming-patterns');

// --- Opening ------------------------------------------------------------------------------------
console.log('\nOpening the item');
await runMenuCommand(page, 'metronome');
await wait(300);
let state = await item();
const current = await page.evaluate(selector => document.querySelector(selector)?.textContent, CURRENT_ITEM_BUTTON);
check('it opens as an item named Metronome in the list of open items', current === 'Metronome', current);
check('its heading is Metronome', state.heading === 'Metronome', state.heading);
check('its sections are Settings, Controls and Keyboard Control',
    state.headings.join('|') === 'Settings|Controls|Keyboard Control', state.headings.join('|'));
check('every control has a label', state.labels.join('|') ===
    'Time signature -> select|Strumming pattern -> select|Tempo, 30 to 240 BPM -> input|Volume, 1 to 5 -> input',
    state.labels.join('|'));
check('focus starts on Time signature', state.focusedOn === 'time signature', state.focusedOn);
check('it starts on 4/4, Down Only', state.signature === '4/4' && state.pattern === 'Down Only: D D D D', `${state.signature} ${state.pattern}`);
check('every time signature with patterns is offered', ['4/4', '3/4', '6/8', '2/4', '12/8'].every(s => state.signatures.includes(s)),
    state.signatures.join(', '));
check('the 4/4 patterns are the Strumming Patterns item\'s', state.patterns.includes('Old Faithful: D - D U - U D U') &&
    state.patterns.includes('Three-Three-Two: >D D D >D D D >D D'), `${state.patterns.length} patterns`);
check('the clicks are said in words after the list', state.about === 'Clicks on 1 high strong down, 2 down, 3 down, 4 down.',
    state.about);
check('Tempo is a number field from 30 to 240, at 60', state.tempoType === 'number' && state.tempoMin === '30' &&
    state.tempoMax === '240' && state.tempo === '60', `${state.tempoMin}-${state.tempoMax} at ${state.tempo}`);
check('Volume is a number field from 1 to 5, at 3', state.volumeType === 'number' && state.volumeMin === '1' &&
    state.volumeMax === '5' && state.volume === '3', `${state.volumeMin}-${state.volumeMax} at ${state.volume}`);
check('the buttons are Start; Slower, Faster, Default Tempo; Quieter, Louder',
    JSON.stringify(state.rows) === JSON.stringify([['Start'], ['Slower', 'Faster', 'Default Tempo'], ['Quieter', 'Louder']]),
    JSON.stringify(state.rows));
check('Start is a toggle, not pressed', state.pressed === 'false');
check('the live region is polite and atomic', state.live === '' && state.liveAtomic === 'true');
check('the keys are listed', state.keys.join('|') === 'Space - start and stop|F - faster by 5 BPM|S - slower by 5 BPM|' +
    'D - back to the default tempo, the one last typed into the Tempo field|Up arrow - louder|Down arrow - quieter',
    state.keys.join('|'));
check('the key note says f, s and d work in the lists', /lists, F, S and D still work/.test(state.keysNote), state.keysNote);

// --- Starting, and the clicks -------------------------------------------------------------------
console.log('\nStarting, and the clicks of Old Faithful at 80');
// Typed, so 80 is also the default tempo the checks below go back to.
await field('Tempo').fill('80');
await field('Tempo').press('Tab');
await wait(80);
await page.selectOption(`${PANEL} select >> nth=1`, { label: 'Old Faithful: D - D U - U D U' });
state = await item();
check('choosing Old Faithful says where its clicks fall',
    state.about === 'Clicks on 1 high strong down, 2 down, 2 and up, 3 and up, 4 down, 4 and up.', state.about);
await button('Start').click();
await wait(150);
state = await item();
check('Start becomes Stop, pressed', state.startText === 'Stop' && state.pressed === 'true', `${state.startText} ${state.pressed}`);
check('it says it started, and the tempo', state.live === 'Started, 80 BPM.', state.live);
await wait(2500);
let heard = await clicks();
const first = heard[0]?.when ?? 0;
const measure = heard.slice(0, 7).map(c => `${(c.when - first).toFixed(3)} ${describe(c)}`);
check('one measure clicks down on 1, 2 and 4, up on the ands of 2, 3 and 4, then 1 again',
    measure.join(', ') === '0.000 high down, 0.750 down, 1.125 up, 1.875 up, 2.250 down, 2.625 up, 3.000 high down',
    measure.join(', '));
const gainOf = kind => heard.find(c => describe(c) === kind)?.gain;
check('a plain down is quieter than a strong one, and an up quieter again',
    gainOf('high down') === 1 && gainOf('down') < 1 && gainOf('up') < gainOf('down'),
    `high down ${gainOf('high down')}, down ${gainOf('down')}, up ${gainOf('up')}`);

// --- Tempo keys and Default Tempo ---------------------------------------------------------------
console.log('\nTempo keys, with focus on the Start button');
let changedAt = await audioNow();
await key('f');
state = await item();
check('f is faster by 5, and says so', state.tempo === '85' && state.live === '85 BPM', `${state.tempo}, "${state.live}"`);
await wait(2000);
heard = (await clicks()).filter(c => c.when > changedAt + 0.2);
const slot85 = 60 / 85 / 2;
const gaps = heard.slice(1).map((c, i) => (c.when - heard[i].when) / slot85);
check('after it the clicks come at 85', gaps.length > 3 && gaps.every(g => near(g, Math.round(g), 0.01)),
    gaps.map(g => g.toFixed(3)).join(' '));
check('and none is late or doubled', gaps.every(g => g > 0.5));
await key('s');
await key('s');
state = await item();
check('s twice is 75', state.tempo === '75' && state.live === '75 BPM', `${state.tempo}, "${state.live}"`);
await key('d');
state = await item();
check('d goes back to 80, the tempo last typed', state.tempo === '80' && state.live === 'Default tempo, 80 BPM',
    `${state.tempo}, "${state.live}"`);
await button('Faster').click();
await wait(80);
check('the Faster button does what f does', (await item()).tempo === '85');
await button('Default Tempo').click();
await wait(80);
state = await item();
check('the Default Tempo button does what d does', state.tempo === '80' && state.live === 'Default tempo, 80 BPM', state.live);
await button('Slower').click();
await wait(80);
check('the Slower button does what s does', (await item()).tempo === '75');
await key('d');

// --- Volume ---------------------------------------------------------------------------------------
console.log('\nVolume keys');
await button('Stop').focus();
await key('ArrowUp');
state = await item();
check('upArrow is louder, and says so', state.volume === '4' && state.live === 'Volume 4', `${state.volume}, "${state.live}"`);
await key('ArrowUp');
await key('ArrowUp');
state = await item();
check('it stops at 5 and says so', state.volume === '5' && state.live === 'Volume 5 is the loudest.', `${state.volume}, "${state.live}"`);
for (let i = 0; i < 5; i++) await key('ArrowDown');
state = await item();
check('downArrow is quieter, stopping at 1 and saying so', state.volume === '1' && state.live === 'Volume 1 is the quietest.',
    `${state.volume}, "${state.live}"`);
await button('Louder').click();
await button('Louder').click();
await wait(80);
check('the Louder button does what upArrow does', (await item()).volume === '3');
await button('Quieter').click();
await wait(80);
check('the Quieter button does what downArrow does', (await item()).volume === '2');
await button('Louder').click();
check('no arrow moved the page focus', (await item()).focusedOn === 'button Louder');

// --- Space on a button --------------------------------------------------------------------------
console.log('\nspaceBar and Enter on a button');
await button('Faster').focus();
await key(' ');
await wait(100);
state = await item();
check('spaceBar on Faster stops the metronome rather than pressing Faster',
    state.pressed === 'false' && state.startText === 'Start' && state.tempo === '80', `${state.startText} ${state.pressed} ${state.tempo}`);
check('it says it stopped', state.live === 'Stopped.', state.live);
const afterStop = (await page.evaluate(() => window.__sounds.length));
await wait(600);
check('no sound is started after stopping', (await page.evaluate(() => window.__sounds.length)) === afterStop);
await key(' ');
await wait(100);
state = await item();
check('spaceBar again starts it', state.pressed === 'true' && state.startText === 'Stop' && state.live === 'Started, 80 BPM.',
    `${state.startText} ${state.pressed} "${state.live}"`);
await key('Enter');
await wait(80);
check('Enter still presses the button', (await item()).tempo === '85');
await key('d');

// --- Typing in the fields -----------------------------------------------------------------------
console.log('\nTyping in Tempo and Volume');
await field('Tempo').focus();
await page.keyboard.press('Control+A');
await page.keyboard.type('120');
state = await item();
check('digits typed into Tempo stay in it', state.tempo === '120' && state.focusedOn === 'tempo', `${state.tempo} ${state.focusedOn}`);
await page.keyboard.press('Tab');
await wait(80);
state = await item();
check('Tab commits it and moves on to Volume', state.focusedOn === 'volume' && state.tempo === '120', state.focusedOn);
await key('f');
state = await item();
check('f in the Volume field is still faster, since a number field takes no letters',
    state.tempo === '125' && state.volume === '3', `${state.tempo} ${state.volume}`);
await key('d');
state = await item();
check('d goes back to 120, the tempo last typed', state.tempo === '120' && state.live === 'Default tempo, 120 BPM', state.live);
await key('ArrowUp');
state = await item();
check('upArrow in the Volume field steps the field itself', state.volume === '4' && state.focusedOn === 'volume', state.volume);
await key('ArrowDown');
await field('Tempo').focus();
await key('ArrowUp');
state = await item();
check('upArrow in the Tempo field steps the tempo, not the volume', state.tempo === '121' && state.volume === '3',
    `${state.tempo} ${state.volume}`);
await key('ArrowDown');

console.log('\nKeys in the pattern lists');
await page.selectOption(`${PANEL} select >> nth=1`, { label: 'Old Faithful: D - D U - U D U' });
await page.locator(`${PANEL} select`).nth(1).focus();
await key('f');
state = await item();
check('f in the Strumming pattern list is faster', state.tempo === '125' && state.live === '125 BPM' &&
    state.pattern === 'Old Faithful: D - D U - U D U', `${state.tempo}, "${state.live}", ${state.pattern}`);
await key('s');
await key('s');
state = await item();
check('s there is slower', state.tempo === '115' && state.pattern === 'Old Faithful: D - D U - U D U', `${state.tempo} ${state.pattern}`);
await key('d');
state = await item();
check('d there is the default tempo', state.tempo === '120' && state.live === 'Default tempo, 120 BPM', state.live);
await key('ArrowDown');
state = await item();
check('downArrow there still moves to the next pattern, not quieter',
    state.pattern === 'Boom-Chicka: D - D U D - D U' && state.volume === '3', `${state.pattern} ${state.volume}`);
await key('ArrowUp');
state = await item();
check('upArrow there moves back, not louder', state.pattern === 'Old Faithful: D - D U - U D U' && state.volume === '3',
    `${state.pattern} ${state.volume}`);
await key('t');
state = await item();
check('another letter there still finds a pattern by its first letter',
    state.pattern === 'Three-Three-Two: >D D D >D D D >D D' && state.tempo === '120', `${state.pattern} ${state.tempo}`);
await page.locator(`${PANEL} select`).nth(0).focus();
await key('f');
state = await item();
check('f in the Time signature list is faster too', state.tempo === '125' && state.signature === '4/4', `${state.tempo} ${state.signature}`);
await key('d');
await page.selectOption(`${PANEL} select >> nth=1`, { label: 'Old Faithful: D - D U - U D U' });

// --- Bounds -------------------------------------------------------------------------------------
console.log('\nTempo bounds');
await field('Tempo').fill('300');
await field('Tempo').press('Tab');
await wait(80);
check('a tempo over 240 is brought down to 240', (await item()).tempo === '240');
await button('Faster').focus();
await key('f');
state = await item();
check('f at 240 stays there and says so', state.tempo === '240' && state.live === '240 BPM is the fastest.', state.live);
await field('Tempo').fill('10');
await field('Tempo').press('Tab');
await wait(80);
check('a tempo under 30 is brought up to 30', (await item()).tempo === '30');
await button('Faster').focus();
await key('s');
state = await item();
check('s at 30 stays there and says so', state.tempo === '30' && state.live === '30 BPM is the slowest.', state.live);
await field('Tempo').fill('');
await field('Tempo').press('Tab');
await wait(80);
check('an emptied Tempo field goes back to the tempo', (await item()).tempo === '30');
await field('Tempo').fill('80');
await field('Tempo').press('Tab');
await wait(80);

// --- Where the keys work ------------------------------------------------------------------------
console.log('\nWhere the keys work');
await page.locator(CURRENT_ITEM_BUTTON).focus();
await key('f');
check('not from the item\'s button in the list of open items', (await item()).tempo === '80');
await page.locator(PANEL).focus();
await key('f');
check('but from the item itself, as when it is shown', (await item()).tempo === '85');
await key('d');

// --- Changing pattern while it plays ------------------------------------------------------------
console.log('\nChanging pattern while it plays');
changedAt = await audioNow();
await page.selectOption(`${PANEL} select >> nth=1`, { label: 'Three-Three-Two: >D D D >D D D >D D' });
await wait(3500);
heard = (await clicks()).filter(c => c.when > changedAt + 0.6);
const slot80 = 60 / 80 / 2;
const accents = heard.filter(c => c.kind === 'strong down' || c.kind === 'high down');
const accentGaps = accents.slice(1).map((c, i) => Math.round((c.when - accents[i].when) / slot80));
check('strong clicks now fall three, three, two eighths apart', accentGaps.length >= 3 && accentGaps.every(g => g === 3 || g === 2),
    accentGaps.join(' '));
check('every click is a down, the strong ones louder', heard.every(isDown) &&
    accents.every(c => c.gain === 1) && heard.filter(c => c.kind === 'down').every(c => c.gain < 1));
const highs = heard.filter(c => c.kind === 'high down');
check('of the accents, only beat 1 is high', highs.length >= 1 && heard.some(c => c.kind === 'strong down') &&
    highs.slice(1).every((c, i) => near(c.when - highs[i].when, 8 * slot80, 0.01)), accents.map(c => c.kind).join(', '));
check('still on the eighths at 80', heard.slice(1).every((c, i) => near((c.when - heard[i].when) / slot80, 1, 0.01)));

changedAt = await audioNow();
await page.selectOption(`${PANEL} select >> nth=1`, { label: 'Eighth-Note Downs: D D D D D D D D' });
await wait(3500);
heard = (await clicks()).filter(c => c.when > changedAt + 0.6);
const strong = heard.filter(c => c.kind === 'high down');
check('Eighth-Note Downs is the down click on every eighth', heard.length >= 8 && heard.every(isDown) &&
    heard.slice(1).every((c, i) => near((c.when - heard[i].when) / slot80, 1, 0.01)), `${heard.length} clicks`);
check('only beat 1 is marked, high and strong', heard.every(c => c.kind !== 'strong down') && strong.length >= 1 && strong.slice(1).every((c, i) => near(c.when - strong[i].when, 8 * slot80, 0.01)),
    strong.map(c => c.when.toFixed(3)).join(' '));

changedAt = await audioNow();
await page.selectOption(`${PANEL} select >> nth=1`, { label: 'Backbeat Chuck: D - x U - U x U' });
await wait(3500);
heard = (await clicks()).filter(c => c.when > changedAt + 0.6);
check('Backbeat Chuck sounds its mutes with the mute click', heard.some(c => c.kind === 'mute') &&
    heard.some(isDown) && heard.some(c => c.kind === 'up'), [...new Set(heard.map(c => c.kind))].join(', '));

changedAt = await audioNow();
await page.selectOption(`${PANEL} select >> nth=1`, { label: 'Reggae Offbeat: - U - U - U - U' });
await wait(4500);
// From a beat and a little after the change, by when the new pattern has taken over.
heard = (await clicks()).filter(c => c.when > changedAt + 1);
const strongUps = heard.filter(c => c.kind === 'high up');
check('Reggae Offbeat, with nothing on beat 1, starts each measure with the high up',
    strongUps.length >= 1 && heard.every(c => c.kind === 'up' || c.kind === 'high up') &&
    strongUps.slice(1).every((c, i) => near(c.when - strongUps[i].when, 8 * slot80, 0.01)),
    heard.map(c => c.kind).join(', '));
check('the high up is louder than the others', strongUps.every(c => heard.filter(u => u.kind === 'up').every(u => c.gain > u.gain)),
    `${strongUps[0]?.gain} against ${heard.find(u => u.kind === 'up')?.gain}`);
await page.selectOption(`${PANEL} select`, '3/4');
await wait(100);
state = await item();
check('a new time signature chooses its first pattern, still playing', state.pattern === 'Down Only: D D D' && state.pressed === 'true',
    `${state.pattern} ${state.pressed}`);
await page.selectOption(`${PANEL} select`, '4/4');
await page.selectOption(`${PANEL} select >> nth=1`, { label: 'Old Faithful: D - D U - U D U' });

// --- Other items --------------------------------------------------------------------------------
console.log('\nWith another item in front');
await runMenuCommand(page, 'strumming-patterns');
await wait(500);
const before = (await clicks()).length;
const strummingFocus = await page.evaluate(() => document.activeElement?.tagName);
await page.keyboard.press('f');
await page.keyboard.press('ArrowDown');
await wait(1000);
check('it keeps playing', (await clicks()).length > before);
await runMenuCommand(page, 'metronome');
await wait(200);
state = await item();
check('the keys did nothing to it there', state.tempo === '80' && state.volume === '3', `${state.tempo} ${state.volume} (focus was on ${strummingFocus})`);
check('coming back finds it playing, focus on Time signature', state.pressed === 'true' && state.focusedOn === 'time signature');
const items = await page.evaluate(() => [...document.querySelectorAll('#open-items-list h1 > button')].map(b => b.textContent));
check('there is only one Metronome item', items.filter(n => n === 'Metronome').length === 1, items.join(', '));

// --- Closing ------------------------------------------------------------------------------------
console.log('\nClosing');
await page.evaluate(selector => document.querySelector(selector).closest('li').querySelector('button.close-item').click(), CURRENT_ITEM_BUTTON);
await wait(100);
const closedAt = await page.evaluate(() => window.__sounds.length);
// Stopping cuts what was laid out ahead, from a hundredth of a second after the close.
const leftAhead = await page.evaluate(() => window.__sounds.filter(s => s.kind &&
    !s.cancelled && s.when > window.__lastStopCall + 0.011).length);
await wait(800);
check('closing stops it: nothing new is started', (await page.evaluate(() => window.__sounds.length)) === closedAt);
check('and nothing laid out ahead is left to sound', leftAhead === 0, `${leftAhead} left`);
await runMenuCommand(page, 'metronome');
await wait(200);
state = await item();
check('opening it again keeps its pattern, tempo and volume, stopped',
    state.pattern === 'Old Faithful: D - D U - U D U' && state.tempo === '80' && state.volume === '3' && state.pressed === 'false',
    `${state.pattern} ${state.tempo} ${state.volume} ${state.pressed}`);

// --- Default tempo in chord practice ------------------------------------------------------------
console.log('\nd in a chord practice progression');
await runMenuCommand(page, 'chord-practice');
await wait(1500);
const dialogTempo = await page.inputValue('#chord-practice-tempo-input');
check('the Chord Practice dialog\'s tempo starts at 60', dialogTempo === '60', dialogTempo);
await page.fill('#chord-practice-tempo-input', '70');
await page.click('#chord-practice-generate-button');
await wait(1500);
const practiceTempo = () => page.evaluate(selector => {
    const panel = document.querySelector(selector);
    const label = [...panel.querySelectorAll('label')].find(l => /tempo/i.test(l.textContent));
    return { tempo: document.getElementById(label?.htmlFor)?.value, live: panel.querySelector('[aria-live][aria-atomic]')?.textContent,
        keys: [...panel.querySelectorAll('ul li')].map(li => li.textContent).filter(t => t.startsWith('D - ')) };
}, PANEL);
await page.locator(PANEL).focus();
await key('f');
await key('f');
check('f twice takes it from 70 to 80', (await practiceTempo()).tempo === '80');
await key('d');
const practice = await practiceTempo();
check('d takes it back to 70 and says so', practice.tempo === '70' && practice.live === 'Default tempo, 70 BPM',
    `${practice.tempo}, "${practice.live}"`);
check('its key list has D', practice.keys.length === 1, practice.keys.join(' | '));

// --- Default tempo in an audio track, given a song file -----------------------------------------
// Song files are kept outside the repository, so this runs only when one is named:
//   node scripts/metronome/verify-metronome.mjs --song path/to/song.gp5
const songIndex = process.argv.indexOf('--song');
if (songIndex !== -1 && !webUrl) {
    console.log('\nd in an audio track');
    const songPath = process.argv[songIndex + 1];
    await openSongFile(electronApp, path.basename(songPath), await readFile(songPath));
    await wait(2500);
    await page.evaluate(selector => {
        const details = [...document.querySelector(selector).querySelectorAll('details')]
            .find(d => d.querySelector('summary')?.textContent.startsWith('Audio Track - '));
        details.open = true;
    }, PANEL);
    await wait(300);
    const trackTempo = () => page.evaluate(selector => {
        const details = [...document.querySelector(selector).querySelectorAll('details')].find(d => d.open &&
            d.querySelector('summary')?.textContent.startsWith('Audio Track - '));
        const input = details.querySelector('input[type="number"]');
        return { tempo: input.value, live: details.querySelector('[aria-live][aria-atomic]')?.textContent, id: input.id };
    }, PANEL);
    const own = (await trackTempo()).tempo;
    await page.locator(`#${(await trackTempo()).id}`).focus();
    await key('f');
    await key('f');
    check(`f twice takes the song's ${own} up by 10`, Number((await trackTempo()).tempo) === Number(own) + 10);
    await key('d');
    let track = await trackTempo();
    check('d takes it back to the song\'s own and says so', track.tempo === own && track.live === `Default tempo, ${own} BPM`,
        `${track.tempo}, "${track.live}"`);
    await page.keyboard.press('Control+A');
    await page.keyboard.type('100');
    await page.keyboard.press('Tab');
    await page.locator(`#${track.id}`).focus();
    await key('s');
    await key('d');
    track = await trackTempo();
    check('after typing 100, d goes back to 100', track.tempo === '100' && track.live === 'Default tempo, 100 BPM',
        `${track.tempo}, "${track.live}"`);
}

check('no errors in the console', consoleErrors.length === 0, consoleErrors.join(' | '));
await finish();
console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exitCode = failures === 0 ? 0 : 1;

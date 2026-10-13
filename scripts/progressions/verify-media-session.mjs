// Verifies that a chord progression and a song's audio track answer the system's media controls,
// against the real app.
//
// Playwright cannot press a media key, so the commands go through Windows instead:
// list-media-sessions.ps1 finds the app's session among those Windows holds and sends it play/pause,
// next or previous, which is what Windows does when one of the keys is pressed and that session is
// the one it picks. Which session Windows picks is the one thing not tested: it is checked that
// the app's session is the current one, which is what decides it.
//
// The handlers are also captured, by wrapping navigator.mediaSession.setActionHandler, to see which
// are registered and to call the ones Windows has no command for: seekforward, seekbackward, stop.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const APP_DIR = `${import.meta.dirname}/../..`.replace(/\\/g, '/');
const { _electron } = await import(`file:///${APP_DIR}/node_modules/playwright-core/index.mjs`);

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};

// Run from source the app is electron.exe to Windows.
const APP_ID = 'electron.exe';

/** The app's session as Windows reports it, after sending it a command if one is given. */
const windowsSession = (send = '') => {
    const output = execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass',
        '-File', `${APP_DIR}/scripts/progressions/list-media-sessions.ps1`,
        ...(send ? ['-App', APP_ID, '-Send', send] : [])], { encoding: 'utf8' });
    const line = output.split(/\r?\n/).find(l => l.startsWith(`session: ${APP_ID} `));
    if (!line) return null;
    const field = name => new RegExp(`${name}: ([^|]*)`).exec(line)?.[1].trim();
    return { title: field('title'), status: field('status'), current: field('current') === 'True' };
};

const app = await _electron.launch({ args: ['.'], cwd: APP_DIR });
const page = await app.firstWindow();
await page.waitForLoadState('domcontentloaded');
await page.waitForTimeout(1500);

// The handlers are registered on the first play, so wrapping after load is soon enough.
await page.evaluate(() => {
    window.__media = { handlers: {}, elements: [] };
    const original = navigator.mediaSession.setActionHandler.bind(navigator.mediaSession);
    navigator.mediaSession.setActionHandler = (action, handler) => {
        window.__media.handlers[action] = handler;
        original(action, handler);
    };
    // Kept so an interruption can be imitated: suspending the context from here changes its state
    // the way a phone call does.
    window.__contexts = [];
    const OriginalAudioContext = window.AudioContext;
    window.AudioContext = class extends OriginalAudioContext {
        constructor(...args) {
            super(...args);
            window.__contexts.push(this);
            // Imitates a context the phone will not start: it reports itself suspended, asking it to
            // resume does nothing, and it never reports a change of state. Underneath it is an
            // ordinary context, whose own state changes must not reach the page.
            if (window.__refuseToStart) {
                Object.defineProperty(this, 'state', { get: () => 'suspended' });
                this.resume = () => Promise.resolve();
                this.addEventListener = () => {};
            }
        }
    };
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
        if (!window.__media.elements.includes(this)) window.__media.elements.push(this);
        return play.call(this);
    };
});

const snapshot = () => page.evaluate(() => {
    const panel = [...document.querySelectorAll('section[id^="item-panel-"]')].find(p => !p.hidden);
    const element = window.__media.elements[0];
    const metadata = navigator.mediaSession.metadata;
    return {
        registered: Object.entries(window.__media.handlers)
            .filter(([, handler]) => handler).map(([action]) => action).sort(),
        playbackState: navigator.mediaSession.playbackState,
        title: metadata?.title ?? null,
        artist: metadata?.artist ?? null,
        elementCount: window.__media.elements.length,
        elementPaused: element ? element.paused : null,
        elementLoops: element ? element.loop && element.duration >= 10 : null,
        playButton: panel?.querySelector('button[aria-pressed]')?.textContent ?? null,
        announcement: panel?.querySelector('[aria-live]')?.textContent ?? null
    };
});

const callHandler = action => page.evaluate(name => window.__media.handlers[name]?.({ action: name }),
    action);

const measureNow = async () => {
    await page.keyboard.press('b');
    await page.waitForTimeout(300);
    return Number(/^Measure (\d+)/.exec((await snapshot()).announcement ?? '')?.[1]);
};

console.log('=== Before anything plays ===');
await page.evaluate(() => document.getElementById('menu-chord-practice').click());
await page.waitForTimeout(1500);
await page.selectOption('#chord-practice-level-select', 'beginner');
await page.waitForTimeout(300);
await page.selectOption('#chord-practice-key-select', 'C|major');
await page.fill('#chord-practice-count-input', '8');
await page.click('#chord-practice-generate-button');
await page.waitForTimeout(1500);

let state = await snapshot();
check('a progression tab is in front', state.playButton === 'Play Progression', state.playButton);
check('no media handlers before the first play', state.registered.length === 0, state.registered.join(', '));
check('no metadata before the first play', state.title === null, state.title);
check('Windows has no session for the app', windowsSession() === null);

console.log('\n=== spaceBar starts it ===');
await page.keyboard.press(' ');
await page.waitForFunction(() =>
    [...document.querySelectorAll('section[id^="item-panel-"]')].find(p => !p.hidden)
        ?.querySelector('button[aria-pressed="true"]'), null, { timeout: 30000 });
await page.waitForTimeout(1500);
state = await snapshot();
const expected = ['nexttrack', 'pause', 'play', 'previoustrack', 'seekbackward', 'seekforward', 'stop'];
check('every action is registered', JSON.stringify(state.registered) === JSON.stringify(expected),
    state.registered.join(', '));
check('playbackState is playing', state.playbackState === 'playing', state.playbackState);
check('title is the item name', /^Practice - /.test(state.title ?? ''), state.title);
check('artist is unstrung', state.artist === 'unstrung', state.artist);
check('one media element, playing a silent loop',
    state.elementCount === 1 && state.elementPaused === false && state.elementLoops,
    `count ${state.elementCount}, paused ${state.elementPaused}, loops ${state.elementLoops}`);
let session = windowsSession();
check('Windows lists the app as playing, under the item name',
    session?.status === 'Playing' && session?.title === state.title, JSON.stringify(session));
check('the app is the session Windows sends the keys to', session?.current === true,
    JSON.stringify(session));

console.log('\n=== play/pause from Windows pauses ===');
windowsSession('PlayPause');
await page.waitForTimeout(800);
state = await snapshot();
check('playback stops', state.playButton === 'Play Progression', state.playButton);
check('playbackState is paused', state.playbackState === 'paused', state.playbackState);
check('the media element is paused', state.elementPaused === true, String(state.elementPaused));
check('pause says where it stopped', /^Paused at measure \d+\.$/.test(state.announcement ?? ''),
    state.announcement);
session = windowsSession();
check('Windows shows it paused', session?.status === 'Paused', JSON.stringify(session));
const pausedAt = Number(/measure (\d+)/.exec(state.announcement ?? '')?.[1]);

// Next goes to the start of the measure and previous to the start of the progression. Only the
// measure number can be read back, so next is checked from a pause partway through a measure,
// where moving on a measure would show.
console.log('\n=== Next goes to the start of the measure, previous restarts ===');
windowsSession('Next');
await page.waitForTimeout(500);
let measure = await measureNow();
check('next from Windows stays in the measure', measure === pausedAt, `${pausedAt} to ${measure}`);
await page.keyboard.press('ArrowRight');
await page.keyboard.press('ArrowRight');
await callHandler('seekforward');
measure = await measureNow();
check('seekforward stays in the measure', measure === pausedAt + 2, `to ${measure}`);
windowsSession('Previous');
await page.waitForTimeout(500);
measure = await measureNow();
check('previous from Windows goes to the first measure', measure === 1, `to ${measure}`);
await page.keyboard.press('ArrowRight');
await page.keyboard.press('ArrowRight');
await callHandler('seekbackward');
measure = await measureNow();
check('seekbackward goes to the first measure', measure === 1, `to ${measure}`);
state = await snapshot();
check('moving while paused stays paused', state.playButton === 'Play Progression', state.playButton);

console.log('\n=== play/pause from Windows resumes ===');
windowsSession('PlayPause');
await page.waitForTimeout(1000);
state = await snapshot();
check('playback resumes', state.playButton === 'Pause', state.playButton);
check('playbackState is playing again', state.playbackState === 'playing', state.playbackState);
check('the same media element is playing again',
    state.elementCount === 1 && state.elementPaused === false, `paused ${state.elementPaused}`);
await callHandler('play');
await page.waitForTimeout(300);
state = await snapshot();
check('play while playing does not pause', state.playButton === 'Pause', state.playButton);
await page.keyboard.press('ArrowRight');
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(300);
windowsSession('Previous');
await page.waitForTimeout(500);
measure = await measureNow();
state = await snapshot();
check('previous while playing restarts and keeps playing',
    measure === 1 && state.playButton === 'Pause', `measure ${measure}, ${state.playButton}`);
await callHandler('stop');
await page.waitForTimeout(300);
state = await snapshot();
check('stop stops playback', state.playButton === 'Play Progression', state.playButton);

console.log('\n=== Closing the tab clears it ===');
await page.click('button[aria-label^="Close Practice"]');
await page.waitForTimeout(800);
state = await snapshot();
check('no handlers left', state.registered.length === 0, state.registered.join(', '));
check('no metadata left', state.title === null, state.title);
check('playbackState is none', state.playbackState === 'none', state.playbackState);
check('the media element is paused', state.elementPaused === true, String(state.elementPaused));
session = windowsSession();
check('Windows no longer has a session for the app', session === null, JSON.stringify(session));

// The element is made again on the next play, so the keys come back with a new progression.
console.log('\n=== A new progression gets the keys back ===');
await page.evaluate(() => document.getElementById('menu-chord-practice').click());
await page.waitForTimeout(1500);
await page.click('#chord-practice-generate-button');
await page.waitForTimeout(1500);
await page.keyboard.press(' ');
await page.waitForTimeout(3000);
session = windowsSession();
check('Windows lists the app as playing again', session?.status === 'Playing' && session?.current,
    JSON.stringify(session));
windowsSession('PlayPause');
await page.waitForTimeout(800);
state = await snapshot();
check('play/pause from Windows reaches the new progression',
    state.playButton === 'Play Progression', state.playButton);

// The context stopping by itself is how an interruption reaches the page. Suspending it from here
// stands in for a call starting; resuming it from here, for the call ending.
console.log('\n=== Interruptions ===');
const interrupt = () => page.evaluate(() => window.__contexts.at(-1).suspend());
const endInterruption = () => page.evaluate(() => window.__contexts.at(-1).resume());
const contexts = () => page.evaluate(() => window.__contexts.map(c => c.state));
await page.keyboard.press(' ');
await page.waitForTimeout(1500);
check('playing before the interruption', (await snapshot()).playButton === 'Pause');
await interrupt();
await page.waitForTimeout(500);
state = await snapshot();
check('an interruption pauses', state.playButton === 'Play Progression', state.playButton);
check('and says where', /^Paused at measure \d+\.$/.test(state.announcement ?? ''), state.announcement);
check('and tells the system', state.playbackState === 'paused', state.playbackState);
await endInterruption();
await page.waitForTimeout(800);
state = await snapshot();
check('the context coming back by itself starts it again', state.playButton === 'Pause',
    state.playButton);
// Past the second after a start, when a stop still counts as part of starting.
await page.waitForTimeout(500);
await interrupt();
await page.waitForTimeout(500);
await page.keyboard.press(' ');
await page.waitForTimeout(1200);
state = await snapshot();
check('play after an interruption brings the sound back',
    state.playButton === 'Pause' && (await contexts()).at(-1) === 'running', state.playButton);
await page.keyboard.press(' ');
await page.waitForTimeout(500);
check('and spaceBar still pauses it', (await snapshot()).playButton === 'Play Progression');

// Paused, then the audio taken away: the case that left an iPhone silent until Chrome restarted.
// The next play makes a new context rather than trusting the old one.
let before = await contexts();
await interrupt();
await page.waitForTimeout(500);
await page.evaluate(() => {
    window.__startedOn = [];
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
        window.__startedOn.push(window.__contexts.indexOf(this.context));
        return start.apply(this, args);
    };
});
await page.keyboard.press(' ');
await page.waitForTimeout(1500);
let after = await contexts();
state = await snapshot();
check('play after losing the audio while paused makes a new context',
    after.length === before.length + 1 && after.at(-2) === 'closed' && after.at(-1) === 'running',
    after.join(', '));
const startedOn = await page.evaluate(() => [...new Set(window.__startedOn)]);
check('and the progression plays on it', state.playButton === 'Pause' &&
    startedOn.length === 1 && startedOn[0] === after.length - 1,
    `${state.playButton}, sources on context ${startedOn.join(', ')}`);
await page.keyboard.press(' ');
await page.waitForTimeout(500);

// A context that never starts: playback goes back to paused and says why, and the next play tries
// a new one.
await page.evaluate(() => { window.__refuseToStart = true; });
await interrupt();
await page.waitForTimeout(500);
await page.keyboard.press(' ');
await page.waitForTimeout(2000);
state = await snapshot();
check('a start that never gets going goes back to paused', state.playButton === 'Play Progression',
    state.playButton);
check('and says so', state.announcement === 'The sound could not start. Press play to try again.',
    state.announcement);
check('and tells the system', state.playbackState === 'paused', state.playbackState);
await page.evaluate(() => { window.__refuseToStart = false; });
before = await contexts();
await page.keyboard.press(' ');
await page.waitForTimeout(1500);
after = await contexts();
state = await snapshot();
check('the next play tries a new context, and plays',
    after.length === before.length + 1 && after.at(-1) === 'running' && state.playButton === 'Pause',
    `${after.join(', ')}; ${state.playButton}`);
await page.keyboard.press(' ');
await page.waitForTimeout(500);
check('and spaceBar pauses it', (await snapshot()).playButton === 'Play Progression');

// Taking the audio back from a playing podcast, an iPhone stopped the context once on its way to
// running. A stop just after play is pressed belongs to the start, so it is not an interruption.
const announcedBefore = (await snapshot()).announcement;
await page.keyboard.press(' ');
await page.waitForTimeout(100);
await interrupt();
await page.waitForTimeout(1500);
state = await snapshot();
check('a stop just after play does not pause it', state.playButton === 'Pause', state.playButton);
check('and says nothing', state.announcement === announcedBefore, state.announcement);
check('and the context is running again', (await contexts()).at(-1) === 'running',
    (await contexts()).at(-1));
await page.keyboard.press(' ');
await page.waitForTimeout(500);

// The same keys on a song's audio track. The progression above is left open and paused, so this
// also shows the keys moving to whatever played last.
console.log('\n=== An audio track ===');
const SONG_NAME = 'Grateful Dead-Ripple-12-20-2025.gp';
const songBytes = [...readFileSync(`${APP_DIR}/musicfiles/${SONG_NAME}`)];
await app.evaluate(({ BrowserWindow }, { fileName, bytes }) =>
    BrowserWindow.getAllWindows()[0].webContents.send('files:opened',
        { fileName, data: new Uint8Array(bytes) }), { fileName: SONG_NAME, bytes: songBytes });
await page.waitForTimeout(3000);

const trackState = () => page.evaluate(() => {
    const panel = [...document.querySelectorAll('section[id^="item-panel-"]')].find(p => !p.hidden);
    const details = panel?.querySelector('details.audio-track-disclosure');
    const play = details && [...details.querySelectorAll('button')]
        .find(b => /^(Play Track|Pause)$/.test(b.textContent));
    return {
        summary: details?.querySelector('summary')?.textContent ?? null,
        playLabel: play?.textContent ?? null,
        playDisabled: play?.disabled ?? null,
        announcement: details?.querySelector('[aria-live]')?.textContent ?? '',
        title: navigator.mediaSession.metadata?.title ?? null,
        playbackState: navigator.mediaSession.playbackState
    };
});
const trackMeasureNow = async () => {
    await page.keyboard.press('b');
    await page.waitForTimeout(400);
    return Number(/^Measure (\d+)/.exec((await trackState()).announcement)?.[1]);
};

await page.evaluate(() => {
    const panel = [...document.querySelectorAll('section[id^="item-panel-"]')].find(p => !p.hidden);
    panel.querySelector('details.audio-track-disclosure').open = true;
});
await page.waitForTimeout(500);
await page.evaluate(() => {
    const panel = [...document.querySelectorAll('section[id^="item-panel-"]')].find(p => !p.hidden);
    const details = panel.querySelector('details.audio-track-disclosure');
    [...details.querySelectorAll('button')].find(b => b.textContent === 'Create Track')?.click();
});
let track = await trackState();
for (let i = 0; i < 60 && track.playDisabled !== false; i++) {
    await page.waitForTimeout(1000);
    track = await trackState();
}
check('the track was created', track.playDisabled === false, `${track.summary}, ${track.playLabel}`);

await page.evaluate(() => {
    const panel = [...document.querySelectorAll('section[id^="item-panel-"]')].find(p => !p.hidden);
    [...panel.querySelector('details.audio-track-disclosure').querySelectorAll('button')]
        .find(b => b.textContent === 'Play Track').focus();
});
await page.keyboard.press(' ');
await page.waitForTimeout(1500);
track = await trackState();
check('spaceBar plays the track', track.playLabel === 'Pause', track.playLabel);
check('the title is the song and the track',
    / - /.test(track.title ?? '') && track.title.endsWith(track.summary.replace(/^Audio Track - /, '')),
    track.title);
session = windowsSession();
check('Windows lists the track as playing, and sends the keys to it',
    session?.status === 'Playing' && session?.current && session?.title === track.title,
    JSON.stringify(session));

// Partway into a later measure, so going back to its start can be told from moving on.
for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
await page.waitForTimeout(1000);
windowsSession('PlayPause');
await page.waitForTimeout(800);
track = await trackState();
check('play/pause from Windows pauses the track', track.playLabel === 'Play Track', track.playLabel);
check('playbackState is paused', track.playbackState === 'paused', track.playbackState);
let trackMeasure = await trackMeasureNow();
windowsSession('Next');
await page.waitForTimeout(500);
after = await trackMeasureNow();
check('next from Windows stays in the measure', after === trackMeasure, `${trackMeasure} to ${after}`);
windowsSession('Previous');
await page.waitForTimeout(500);
after = await trackMeasureNow();
check('previous from Windows goes back to the start', after === 1, `to ${after}`);
windowsSession('PlayPause');
await page.waitForTimeout(1000);
track = await trackState();
check('play/pause from Windows resumes the track', track.playLabel === 'Pause', track.playLabel);
// Past the second after a start, when a stop still counts as part of starting.
await page.waitForTimeout(500);
await interrupt();
await page.waitForTimeout(500);
track = await trackState();
check('an interruption pauses the track', track.playLabel === 'Play Track', track.playLabel);
await endInterruption();
await page.waitForTimeout(800);
track = await trackState();
check('and the context coming back starts it again', track.playLabel === 'Pause', track.playLabel);

// Collapsing stops the track, and closing the song removes it.
await page.click(`button[aria-label="Close ${SONG_NAME}"]`);
await page.waitForTimeout(800);
session = windowsSession();
check('closing the song ends the session', session === null, JSON.stringify(session));
check('no metadata left', (await snapshot()).title === null);

await app.close();
console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);

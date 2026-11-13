// Checks four things decided on 2026-11-13, after the review of the move to one player
// (docs/one-player.md, Review on 2026-11-13):
//
//   - The Chords item's Play strums as a progression does: down every string, up the four highest.
//   - A change made during the count-in starts the count-in again, instead of dropping the rest.
//   - A song's tracks and progressions are one group: starting one pauses the other. The Chords
//     item's Play is in it too: it pauses a track, and a track starting stops it. An interruption
//     stops it as well.
//   - The voice for spoken names follows Settings in a progression that is already open.
//
// What is scheduled is read by wrapping AudioBufferSourceNode.start and decodeAudioData in the
// page: a metronome click is a buffer a fraction of a second long, a guitar note a recording of
// several seconds. The rest is judged from the DOM.
//
//   npm run build:renderer
//   node scripts/songs/verify-review-decisions.mjs

import { launchApp, openSongFile, runMenuCommand, MENU, VISIBLE_PANEL, CURRENT_ITEM_BUTTON } from '../lib/app-ui.mjs';

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

const G = '(3.6 2.5 0.4 0.3 0.2 3.1)';
const MEASURE = `${G}.4 ${G}.4 ${G}.4 ${G}.4 |`;
const SONG = ['\\title "Count"', '\\tempo 60', '\\track "One"', MEASURE, MEASURE, MEASURE, MEASURE].join('\n');

const { app, page, close } = await launchApp();
try {
    await page.waitForTimeout(800);
    await page.evaluate(() => {
        window.__starts = [];
        window.__decodes = 0;
        const realStart = AudioBufferSourceNode.prototype.start;
        AudioBufferSourceNode.prototype.start = function (when = 0, ...rest) {
            window.__starts.push({ when, now: this.context.currentTime, seconds: this.buffer?.duration ?? 0 });
            // Kept so an interruption can be imitated, as verify-media-session.mjs does: suspending
            // the context changes its state the way a phone call does.
            window.__context = this.context;
            return realStart.call(this, when, ...rest);
        };
        const realDecode = BaseAudioContext.prototype.decodeAudioData;
        BaseAudioContext.prototype.decodeAudioData = function (...args) {
            window.__decodes++;
            return realDecode.apply(this, args);
        };
    });
    const startsFrom = index => page.evaluate(index => window.__starts.slice(index), index);
    const startCount = () => page.evaluate(() => window.__starts.length);
    const isClick = start => start.seconds < 0.2;
    const isNote = start => start.seconds > 1;
    const pressed = name => page.evaluate(name => window[name].getAttribute('aria-pressed') === 'true', name);
    const waitPressed = async (name, wanted = true) => {
        for (let i = 0; i < 300; i++) {
            if (await pressed(name) === wanted) return true;
            await pause(100);
        }
        return false;
    };
    /** Keeps the shown item's Play button in window[name]. */
    const keepPlayButton = name => page.evaluate(({ selector, name }) => {
        window[name] = [...document.querySelectorAll(`${selector} button[aria-pressed]`)]
            .find(button => ['Play', 'Pause'].includes(button.textContent.trim()));
        return Boolean(window[name]);
    }, { selector: VISIBLE_PANEL, name });

    // --- The Chords item ----------------------------------------------------------------------
    console.log('The Chords item\'s Play');
    await runMenuCommand(page, MENU.chordLibrary);
    await page.waitForSelector('#chords-search-input', { timeout: 15000 });
    await page.waitForTimeout(800);
    await page.evaluate(() => {
        const input = document.getElementById('chords-search-input');
        input.value = 'C';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        const speak = document.getElementById('chords-speak-names-checkbox');
        if (speak.checked) speak.click();
    });
    await page.waitForTimeout(300);
    // C major's first voicing only, x32010: five strings.
    const tickFirstC = () => page.evaluate(() => {
        const label = [...document.querySelectorAll('#chords-results-list label')].find(l => l.textContent.startsWith('C - '));
        const boxes = [...label.closest('li').querySelectorAll('details input[type="checkbox"]')];
        boxes.forEach((box, index) => { if (box.checked !== (index === 0)) box.click(); });
    });
    await tickFirstC();
    let mark = await startCount();
    const decodesBefore = await page.evaluate(() => window.__decodes);
    await page.evaluate(() => {
        document.getElementById('chords-status').textContent = '';
        document.getElementById('chords-play-button').click();
    });
    await page.waitForFunction(() => /^Playing/.test(document.getElementById('chords-status').textContent), null, { timeout: 30000 });
    await pause(300);
    let starts = await startsFrom(mark);
    const notes = starts.filter(isNote).sort((a, b) => a.when - b.when);
    check('a five-string chord sounds nine notes: five down, then four up', notes.length === 9, `${notes.length} notes`);
    const gap = notes.length === 9 ? notes[5].when - notes[0].when : 0;
    check('the upstroke comes 0.9 seconds after the downstroke', Math.abs(gap - 0.9) < 0.02, `${gap.toFixed(3)} s`);
    const decoded = await page.evaluate(() => window.__decodes) - decodesBefore;
    check('one recording is decoded for each of its five pitches', decoded === 5, `${decoded} decoded`);

    // An interruption while the chord still rings stops it, and it stays stopped when the sound is back.
    await page.evaluate(() => window.__context.suspend());
    await pause(500);
    let chordsStatus = await page.evaluate(() => document.getElementById('chords-status').textContent);
    check('an interruption stops Play Selected Chords, saying so', chordsStatus === 'Stopped: another app took the sound.',
        chordsStatus);
    mark = await startCount();
    await page.evaluate(() => window.__context.resume());
    await pause(800);
    chordsStatus = await page.evaluate(() => document.getElementById('chords-status').textContent);
    check('and it does not start again when the sound comes back',
        (await startsFrom(mark)).length === 0 && chordsStatus === 'Stopped: another app took the sound.', chordsStatus);
    await page.evaluate(() => document.getElementById('chords-clear-button')?.click());

    // --- The count-in -------------------------------------------------------------------------
    console.log('\nA change during the count-in');
    await openSongFile(app, 'Count.atex', Buffer.from(SONG, 'utf8'));
    await page.waitForFunction(selector => document.querySelectorAll(`${selector} details.track-region`).length === 1,
        VISIBLE_PANEL, { timeout: 30000 });
    await page.evaluate(selector => { document.querySelector(`${selector} details.track-region`).open = true; }, VISIBLE_PANEL);
    await pause(300);
    await keepPlayButton('__songPlay');
    mark = await startCount();
    await page.evaluate(() => { window.__songPlay.focus(); window.__songPlay.click(); });
    check('the track starts', await waitPressed('__songPlay'));
    starts = await startsFrom(mark);
    check('with four clicks of count-in', starts.filter(isClick).length === 4, `${starts.filter(isClick).length} clicks`);
    // A beat and a half into a count-in of four seconds, the tempo goes up by 5.
    await pause(1500);
    mark = await startCount();
    await page.keyboard.press('f');
    await pause(300);
    starts = await startsFrom(mark);
    const clicks = starts.filter(isClick);
    const firstNote = Math.min(...starts.filter(isNote).map(start => start.when - start.now));
    check('faster, pressed during the count-in, counts in again: four new clicks', clicks.length === 4, `${clicks.length} clicks`);
    // Four beats at 65 a minute are 3.69 seconds. Dropped, the first note came at once.
    check('and the first note waits for them', firstNote > 3.4 && firstNote < 4, `${firstNote.toFixed(2)} s ahead`);
    check('the track is still playing', await pressed('__songPlay'));
    await page.evaluate(() => window.__songPlay.click());
    await waitPressed('__songPlay', false);

    // --- One group ----------------------------------------------------------------------------
    // With the collapse setting on, showing another item pauses what was playing anyway, so it is
    // turned off: the two items then stay as they are, and only the group can pause one.
    console.log('\nA song and a progression');
    await runMenuCommand(page, MENU.settings);
    await page.waitForSelector('#settings-dialog[open]', { timeout: 5000 });
    await page.evaluate(() => {
        const box = document.getElementById('settings-auto-collapse-checkbox');
        if (box.checked) box.click();
    });
    await pause(300);
    await page.click('#settings-ok-button');
    await page.evaluate(() => window.__songPlay.click());
    check('the song\'s track plays', await waitPressed('__songPlay'));

    const itemsBefore = await page.evaluate(() => document.querySelectorAll('#open-items-list h1 > button').length);
    await runMenuCommand(page, MENU.chordPractice);
    await page.waitForSelector('#chord-practice-dialog[open]', { timeout: 5000 });
    const dialogLabel = await page.evaluate(() =>
        document.querySelector('label[for="chord-practice-count-in-each-pass-checkbox"]').textContent.trim());
    check('the dialog\'s label is the tab\'s: Count in before every repeat', dialogLabel === 'Count in before every repeat', dialogLabel);
    await page.click('#chord-practice-generate-button');
    await page.waitForFunction(count => document.querySelectorAll('#open-items-list h1 > button').length === count + 1,
        itemsBefore, { timeout: 15000 });
    await pause(500);
    await keepPlayButton('__progressionPlay');
    // Its button in the list of open items, to come back to it after the Chord Library.
    await page.evaluate(selector => { window.__progressionItem = document.querySelector(selector); }, CURRENT_ITEM_BUTTON);
    check('the song goes on playing behind the progression\'s tab', await pressed('__songPlay'));
    await page.evaluate(() => window.__progressionPlay.click());
    check('the progression plays', await waitPressed('__progressionPlay'));
    check('and the song\'s track is paused, its button saying Play',
        await waitPressed('__songPlay', false) && await page.evaluate(() => window.__songPlay.textContent.trim() === 'Play'));
    await page.evaluate(() => window.__songPlay.click());
    check('starting the song\'s track again plays it', await waitPressed('__songPlay'));
    check('and pauses the progression', await waitPressed('__progressionPlay', false));

    // The Chords item's Play is in the same group, since the review's fixes were checked.
    await runMenuCommand(page, MENU.chordLibrary);
    await page.waitForSelector('#chords-search-input', { timeout: 15000 });
    await pause(300);
    await tickFirstC();
    await page.evaluate(() => {
        document.getElementById('chords-status').textContent = '';
        document.getElementById('chords-play-button').click();
    });
    await page.waitForFunction(() => /^Playing/.test(document.getElementById('chords-status').textContent), null, { timeout: 30000 });
    check('Play Selected Chords pauses the song\'s track', await waitPressed('__songPlay', false));
    await page.evaluate(() => window.__songPlay.click());
    check('starting the track again plays it', await waitPressed('__songPlay'));
    const stoppedSaid = await page.waitForFunction(() =>
        document.getElementById('chords-status').textContent === 'Stopped: a track or progression started.',
    null, { timeout: 5000 }).then(() => true, () => false);
    check('and stops Play Selected Chords, its status line saying so', stoppedSaid,
        await page.evaluate(() => document.getElementById('chords-status').textContent));
    await page.evaluate(() => window.__songPlay.click());
    await waitPressed('__songPlay', false);

    // Started and at once overtaken by the track, Play does not start once its samples are in.
    await page.evaluate(() => {
        document.getElementById('chords-status').textContent = '';
        document.getElementById('chords-play-button').click();
        window.__songPlay.click();
    });
    check('a track started while Play loads plays', await waitPressed('__songPlay'));
    await pause(1500);
    const chordStatus = await page.evaluate(() => document.getElementById('chords-status').textContent);
    check('and Play stops loading and never starts, saying so',
        chordStatus === 'Stopped: a track or progression started.', chordStatus);
    await page.evaluate(() => window.__songPlay.click());
    await waitPressed('__songPlay', false);

    // --- The voice ----------------------------------------------------------------------------
    console.log('\nThe voice for spoken names');
    await page.evaluate(() => window.__progressionItem.click());
    await pause(500);
    const speaking = await page.evaluate(selector => {
        const label = [...document.querySelectorAll(`${selector} label`)].find(l => l.textContent.trim() === 'Speak the next measure');
        const box = label && document.getElementById(label.htmlFor);
        return Boolean(box && box.checked && !box.disabled);
    }, VISIBLE_PANEL);
    if (!speaking) {
        console.log('  skipped: this build has no recordings of chord names, or Speak the next measure is off.');
    } else {
        await page.evaluate(() => window.__progressionPlay.click());
        check('the progression plays, saying its chords', await waitPressed('__progressionPlay'));
        await pause(500);
        const setVoice = async voice => {
            const before = await page.evaluate(() => window.__decodes);
            await page.evaluate(voice => {
                const select = document.getElementById('settings-chord-voice-select');
                select.value = voice;
                select.dispatchEvent(new Event('change', { bubbles: true }));
            }, voice);
            await pause(2000);
            return await page.evaluate(() => window.__decodes) - before;
        };
        await runMenuCommand(page, MENU.settings);
        await page.waitForSelector('#settings-dialog[open]', { timeout: 5000 });
        const was = await page.evaluate(() => document.getElementById('settings-chord-voice-select').value);
        const other = was === 'zira' ? 'david' : 'zira';
        mark = await startCount();
        const loaded = await setVoice(other);
        check('another voice chosen in Settings is loaded for the open progression', loaded > 0, `${loaded} decoded`);
        check('which goes on playing', await pressed('__progressionPlay'));
        check('scheduled again from where it is', (await startsFrom(mark)).length > 0);
        const again = await setVoice(was);
        check('going back to the first voice decodes nothing: its names were kept', again === 0, `${again} decoded`);
        check('and it still plays', await pressed('__progressionPlay'));
        await page.click('#settings-ok-button');
        await page.evaluate(() => window.__progressionPlay.click());
    }
} finally {
    await close();
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exitCode = failures === 0 ? 0 : 1;

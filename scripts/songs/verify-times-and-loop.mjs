// Checks Times to play and Loop on a song's player, which replaced the Repeat checkbox on
// 2026-11-12 (docs/one-player.md, decision 1, and Where Am I in decision 8):
//
// - Times to play, 1 to 50, default 1; Loop, off by default, on l; Count in before every repeat
//   always shown.
// - Playing 3 times stops after the third and says so; Where Am I says "play 2 of 3".
// - Loop on while playing goes on past Times to play, and Where Am I says "play 4".
// - Loop off below Times to play goes on until it is reached.
// - Loop off past Times to play finishes the time through under way and stops, saying how many.
// - Changing Times to play while playing starts again from the top with the count at 1.
//
// Drives the Electron app on a scratch profile, judged from the DOM and the announcement line. The
// song is alphaTex written here: two measures at 240 beats a minute, two seconds a time through.
//
//   npm run build:renderer
//   node scripts/songs/verify-times-and-loop.mjs

import { launchApp, openSongFile, VISIBLE_PANEL } from '../lib/app-ui.mjs';

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

const G = '(3.6 2.5 0.4 0.3 0.2 3.1)';
const SONG = ['\\title "Times and Loop"', '\\tempo 240', `${G}.4 ${G}.4 ${G}.4 ${G}.4 |`, `${G}.4 ${G}.4 ${G}.4 ${G}.4 |`].join('\n');

const { app, page, close } = await launchApp();
try {
    await openSongFile(app, 'Times and Loop.atex', Buffer.from(SONG, 'utf8'));
    await page.waitForFunction(selector => document.querySelector(selector)?.querySelector('details.track-region'),
        VISIBLE_PANEL, { timeout: 30000 });
    await page.evaluate(selector => {
        window.__region = document.querySelector(selector).querySelector('details.track-region');
        window.__region.open = true;
    }, VISIBLE_PANEL);
    await pause(300);

    const read = () => page.evaluate(() => {
        const r = window.__region;
        const control = start => document.getElementById([...r.querySelectorAll('label')]
            .find(l => l.textContent.startsWith(start))?.htmlFor);
        const times = control('Times to play');
        return {
            labels: [...r.querySelectorAll('.audio-track > p > label')].map(l => l.textContent),
            times: times?.value, timesMin: times?.min, timesMax: times?.max,
            loop: control('Loop')?.checked,
            eachPassShown: !control('Count in before every repeat')?.closest('p').hidden,
            playing: r.querySelector('.audio-track button[aria-pressed]').getAttribute('aria-pressed') === 'true',
            announce: r.querySelector('p[aria-live="polite"]:not([role])').textContent
        };
    });
    const setTimes = value => page.evaluate(value => {
        const input = document.getElementById([...window.__region.querySelectorAll('label')]
            .find(l => l.textContent.startsWith('Times to play')).htmlFor);
        input.value = value;
        input.dispatchEvent(new Event('change'));
    }, value);
    const click = name => page.evaluate(name => {
        const button = [...window.__region.querySelectorAll('button')].find(b => b.textContent === name);
        button.focus();
        button.click();
    }, name);
    const whereAmI = async () => { await click('Where Am I'); await pause(200); return (await read()).announce; };
    const waitFor = async (test, seconds) => {
        for (let i = 0; i < seconds * 10; i++) {
            if (test(await read())) return true;
            await pause(100);
        }
        return false;
    };
    const passOf = text => Number(text.match(/play (\d+)/)?.[1] ?? 0);

    console.log('The controls');
    let r = await read();
    check('Times to play then Loop, after Count in', r.labels.join(' | ').includes(
        'Count in, one measure of clicks before playing starts | Times to play, 1 to 50 | Loop | Count in before every repeat'),
        r.labels.join(' | '));
    check('Times to play runs 1 to 50 and starts at 1', r.times === '1' && r.timesMin === '1' && r.timesMax === '50',
        `${r.times} ${r.timesMin}-${r.timesMax}`);
    check('Loop starts off', r.loop === false);
    check('Count in before every repeat is shown with Loop off', r.eachPassShown);
    await setTimes('80');
    check('80 is held to 50', (await read()).times === '50', (await read()).times);
    await setTimes('');
    check('an emptied field goes back to what it was', (await read()).times === '50', (await read()).times);

    console.log('\nThree times');
    await setTimes('3');
    await click('Play');
    // The first play loads the samples, then counts in for a second.
    await waitFor(s => s.playing, 30);
    await pause(3600);
    let said = await whereAmI();
    check('Where Am I says which of the three', /, play 2 of 3$/.test(said), said);
    check('stops after the third', await waitFor(s => !s.playing, 10));
    said = (await read()).announce;
    check('and says it played three times', said === 'End of track, played 3 times.', said);

    console.log('\nLoop on while playing');
    await setTimes('2');
    await click('Play');
    await waitFor(s => s.playing, 10);
    await page.keyboard.press('l');
    await pause(200);
    r = await read();
    check('l turns Loop on and says so', r.loop && r.announce === 'Loop on', `${r.loop} "${r.announce}"`);
    await pause(5500);
    said = await whereAmI();
    check('playing goes on past Times to play, counting on', (await read()).playing && passOf(said) >= 3 && !/play \d+ of/.test(said), said);

    console.log('\nLoop off past Times to play');
    const before = passOf(said);
    await page.keyboard.press('l');
    await pause(200);
    r = await read();
    check('l turns Loop off and says so', !r.loop && r.announce === 'Loop off', `${r.loop} "${r.announce}"`);
    check('the time through under way plays on', r.playing);
    check('then it stops', await waitFor(s => !s.playing, 8));
    said = (await read()).announce;
    const played = Number(said.match(/played (\d+) times/)?.[1] ?? 0);
    check('saying how many times it played', /^End of track, played \d+ times\.$/.test(said) && played >= before && played <= before + 1,
        `${said} (play ${before} when Loop went off)`);

    console.log('\nLoop off below Times to play');
    await setTimes('4');
    await click('Play');
    await waitFor(s => s.playing, 10);
    await page.keyboard.press('l');
    await pause(1500);
    await page.keyboard.press('l');
    await pause(200);
    check('plays on', (await read()).playing);
    // Four times through is eight seconds, with a second of count-in and two of ringing out.
    check('until all four are played', await waitFor(s => !s.playing, 14));
    said = (await read()).announce;
    check('and says four', said === 'End of track, played 4 times.', said);

    console.log('\nChanging Times to play while playing');
    await setTimes('3');
    await click('Play');
    await waitFor(s => s.playing, 10);
    await pause(4500);
    said = await whereAmI();
    check('is in its second or third time through first', passOf(said) >= 2, said);
    await setTimes('2');
    await pause(300);
    r = await read();
    check('keeps playing', r.playing);
    said = await whereAmI();
    check('from the top, with the count back at 1', /^Measure 1 of 2, play 1 of 2$/.test(said), said);
    await click('Pause');

    console.log('\nOnce');
    await setTimes('1');
    said = await whereAmI();
    check('Where Am I says no time through when it plays once', said === 'Measure 1 of 2', said);
} finally {
    await close();
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exitCode = failures === 0 ? 0 : 1;

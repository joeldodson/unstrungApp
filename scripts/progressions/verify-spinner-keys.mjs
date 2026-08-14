// A spinner must not eat the transport keys.
//
// Focus sitting in a tempo or repeat field quietly swallowed M, B, S and F, which reads as the
// shortcuts having stopped working rather than as the field claiming them. Letters do nothing to a
// number field; arrows and digits do, and those still belong to it.

const APP_DIR = `${import.meta.dirname}/../..`.replace(/\\/g, '/');
const { _electron } = await import(`file:///${APP_DIR}/node_modules/playwright-core/index.mjs`);

let failures = 0;
const check = (label, ok, detail = '') => {
    if (!ok) failures++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};

const app = await _electron.launch({ args: ['.'], cwd: APP_DIR });
const page = await app.firstWindow();
await page.waitForLoadState('domcontentloaded');

await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.send('chord-practice:open'));
await page.waitForTimeout(2500);
await page.selectOption('#chord-practice-key-select', 'C|major');
await page.fill('#chord-practice-count-input', '8');
await page.fill('#chord-practice-tempo-input', '90');
await page.uncheck('#chord-practice-speak-checkbox').catch(() => {});
await page.click('#chord-practice-generate-button');
await page.waitForTimeout(1500);

const read = () => page.evaluate(() => {
    const p = [...document.querySelectorAll('[role="tabpanel"]')].find(x => !x.hidden);
    return {
        announcement: p.querySelector('[aria-live]').textContent,
        tempo: p.querySelector('input[id^="chord-practice-tab-tempo"]').value,
        repeats: p.querySelector('input[id^="chord-practice-tab-repeat"]').value,
        // By label: the panel's first checkbox is the count-in one.
        metronome: [...p.querySelectorAll('input[type="checkbox"]')]
            .find(b => p.querySelector(`label[for="${b.id}"]`)?.textContent.startsWith('Metronome'))?.checked,
        focused: document.activeElement.id || document.activeElement.tagName
    };
});

const focusTempo = () => page.evaluate(() => {
    const p = [...document.querySelectorAll('[role="tabpanel"]')].find(x => !x.hidden);
    p.querySelector('input[id^="chord-practice-tab-tempo"]').focus();
});

console.log('=== With focus in the tempo spinner ===');
await focusTempo();
console.log(`  focus is on ${(await read()).focused}`);

await page.keyboard.press('b');
await page.waitForTimeout(500);
const afterB = await read();
console.log(`  B  -> "${afterB.announcement}", tempo still ${afterB.tempo}`);
check('B reaches playback', /^Measure \d+ of \d+/.test(afterB.announcement), afterB.announcement);
check('B does not change the tempo', afterB.tempo === '90', afterB.tempo);

const beforeM = await read();
await page.keyboard.press('m');
await page.waitForTimeout(500);
const afterM = await read();
console.log(`  M  -> metronome ${beforeM.metronome} to ${afterM.metronome}`);
check('M reaches playback', afterM.metronome !== beforeM.metronome,
    `${beforeM.metronome} -> ${afterM.metronome}`);
await page.keyboard.press('m');
await page.waitForTimeout(300);

await focusTempo();
await page.keyboard.press('s');
await page.waitForTimeout(500);
const afterS = await read();
console.log(`  S  -> tempo ${afterS.tempo}`);
check('S reaches playback and slows the tempo', afterS.tempo === '85', afterS.tempo);
await page.keyboard.press('f');
await page.waitForTimeout(400);

console.log('\n=== The spinner still works as a spinner ===');
await focusTempo();
const beforeArrow = (await read()).tempo;
await page.keyboard.press('ArrowUp');
await page.waitForTimeout(400);
const afterArrow = await read();
console.log(`  Up arrow in the field -> tempo ${beforeArrow} to ${afterArrow.tempo}`);
check('the arrow steps the field rather than restarting playback',
    Number(afterArrow.tempo) === Number(beforeArrow) + 1, `${beforeArrow} -> ${afterArrow.tempo}`);

await page.evaluate(() => {
    const p = [...document.querySelectorAll('[role="tabpanel"]')].find(x => !x.hidden);
    const box = p.querySelector('input[id^="chord-practice-tab-repeat"]');
    box.focus();
    box.value = '';
});
await page.keyboard.press('4');
await page.waitForTimeout(400);
const typed = await read();
console.log(`  typing 4 into the repeats field -> ${typed.repeats}`);
check('digits still reach the field', typed.repeats === '4', typed.repeats);

console.log('\n=== Focus never leaves the field ===');
const stillThere = await read();
check('focus is still in the spinner after all of that',
    /chord-practice-tab-repeat/.test(stillThere.focused), stillThere.focused);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
await app.close();
process.exit(failures === 0 ? 0 : 1);

// A seed has to carry everything needed to rebuild the progression.
//
// A bare number never could: the same number in another key, at another level or another length
// gives a different progression, so sharing one meant reciting four settings and hoping they were
// all entered correctly. The test that matters is pasting a code in with every other control set
// wrongly, and getting the original back anyway.

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

const openDialog = async () => {
    await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].webContents.send('chord-practice:open'));
    await page.waitForTimeout(1500);
};

const readTab = () => page.evaluate(() => {
    const p = [...document.querySelectorAll('[role="tabpanel"]')].find(x => !x.hidden);
    const meta = [...[...p.querySelectorAll('ul:not(.chord-progression)')]
        .find(ul => !ul.closest('details')).querySelectorAll('li')].map(li => li.textContent);
    return {
        seedLine: meta.find(m => m.startsWith('Seed - ')) ?? '',
        meta,
        chords: [...p.querySelectorAll('ul.progression-list > li')].map(li => li.textContent).join(' '),
        copyButton: [...p.querySelectorAll('button')].some(b => b.textContent === 'Copy Seed Information'),
        tabName: [...document.querySelectorAll('[role="tab"]')]
            .find(t => t.getAttribute('aria-selected') === 'true')?.textContent ?? '',
        status: document.getElementById('status').textContent
    };
});

console.log('=== A generated progression states a full seed ===');
await openDialog();
await page.selectOption('#chord-practice-level-select', 'advanced');
await page.waitForTimeout(400);
await page.selectOption('#chord-practice-key-select', 'Eb|minor');
await page.selectOption('#chord-practice-borrowing-select', 'frequent');
await page.fill('#chord-practice-count-input', '12');
await page.fill('#chord-practice-beats-input', '3');
await page.click('#chord-practice-generate-button');
await page.waitForTimeout(1500);

const first = await readTab();
const code = first.seedLine.replace('Seed - ', '').trim();
console.log(`  ${first.seedLine}`);
console.log(`  chords: ${first.chords}`);
check('the seed carries key, mode, level, borrowing, length, time signature and number',
    /^Eb-minor-advanced-frequent-12-3-4-\d+$/.test(code), code);
check('a Copy Seed Information button is offered', first.copyButton);

console.log('\n=== Pasting it back with every other control set wrongly ===');
await openDialog();
// Deliberately hostile: different level, key, borrowing and length.
await page.selectOption('#chord-practice-level-select', 'beginner');
await page.waitForTimeout(400);
await page.selectOption('#chord-practice-key-select', 'C|major');
await page.selectOption('#chord-practice-borrowing-select', 'none');
await page.fill('#chord-practice-count-input', '4');
await page.fill('#chord-practice-beats-input', '4');
await page.fill('#chord-practice-seed-input', code);
await page.click('#chord-practice-generate-button');
await page.waitForTimeout(1500);

const second = await readTab();
console.log(`  ${second.seedLine}`);
console.log(`  chords: ${second.chords}`);
check('the same chords come back', second.chords === first.chords, second.chords);
check('the seed line round-trips unchanged', second.seedLine === first.seedLine, second.seedLine);
check('the key came from the seed, not the dialog',
    second.meta.some(m => m.startsWith('Key - Eb minor')), second.meta[0]);
check('the time signature came from the seed, not the dialog',
    second.meta.some(m => m === 'Time signature - 3/4'), second.meta.join(' | '));
check('the length came from the seed, not the dialog',
    second.meta.some(m => m === 'Length - 12 measures'), second.meta.join(' | '));
// The tab strip is read far more often than the metadata, so a tab named after the control rather
// than the result is a wrong answer given repeatedly.
console.log(`  tab name: "${second.tabName}"`);
console.log(`  status  : "${second.status}"`);
check('the tab is named after the progression, not the dialog',
    second.tabName === 'Practice - Eb minor', second.tabName);
check('the status names the progression too',
    /in Eb minor\.$/.test(second.status), second.status);

console.log('\n=== A bare number still works, and nonsense is refused ===');
await openDialog();
await page.fill('#chord-practice-seed-input', '4242');
await page.selectOption('#chord-practice-key-select', 'C|major');
await page.fill('#chord-practice-count-input', '6');
await page.click('#chord-practice-generate-button');
await page.waitForTimeout(1500);
const bare = await readTab();
console.log(`  ${bare.seedLine}`);
check('a bare number is taken as the seed and the dialog supplies the rest',
    /^Seed - C-\w+-\w+-\w+-6-\d+-\d+-4242$/.test(bare.seedLine), bare.seedLine);

await openDialog();
await page.fill('#chord-practice-seed-input', 'not a seed at all');
const refused = await page.evaluate(async () => {
    document.getElementById('chord-practice-generate-button').click();
    await new Promise(r => setTimeout(r, 400));
    return {
        open: document.getElementById('chord-practice-dialog').open,
        status: document.getElementById('chord-practice-status').textContent
    };
});
console.log(`  nonsense -> ${refused.status}`);
check('nonsense is refused rather than ignored',
    refused.open && /not a seed/.test(refused.status), refused.status);

console.log('\n=== The copy button puts the seed on the clipboard ===');
await page.evaluate(() => document.getElementById('chord-practice-dialog').close());
await page.waitForTimeout(400);
const copied = await page.evaluate(async () => {
    const p = [...document.querySelectorAll('[role="tabpanel"]')].find(x => !x.hidden);
    [...p.querySelectorAll('button')].find(b => b.textContent === 'Copy Seed Information').click();
    await new Promise(r => setTimeout(r, 600));
    let clipboard = null;
    try { clipboard = await navigator.clipboard.readText(); } catch { /* denied */ }
    return { clipboard, said: p.querySelector('[aria-live]')?.textContent ?? '' };
});
console.log(`  clipboard now holds: ${copied.clipboard}`);
check('the clipboard holds a full seed',
    /^[A-G][#b]?-\w+-\w+-\w+-\d+-\d+-\d+-\d+$/.test(copied.clipboard ?? ''), String(copied.clipboard));

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
await app.close();
process.exit(failures === 0 ? 0 : 1);

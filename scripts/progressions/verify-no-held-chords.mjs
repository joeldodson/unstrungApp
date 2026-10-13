// Verifies the Chord Practice dialog's no-held-chords checkbox and the speak default, against the
// real app.
//
// The generator's own behaviour is checked thoroughly by scripts/check-no-held-chords.mjs; this
// checks the dialog: where the checkbox sits, that it is labelled and checked by default, that the
// names are spoken by default, and that what it asks for reaches the progression that opens.

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
await page.waitForTimeout(1500);

const openDialog = async () => {
    await page.evaluate(() => document.getElementById('menu-chord-practice').click());
    await page.waitForTimeout(1200);
};

/** The chords of the progression in front, as their names, and its speak checkbox. */
const progressionInFront = () => page.evaluate(() => {
    const panel = [...document.querySelectorAll('section[id^="item-panel-"]')].find(p => !p.hidden);
    const speak = [...panel.querySelectorAll('input[type="checkbox"]')]
        .find(box => /speak/i.test(panel.querySelector(`label[for="${box.id}"]`)?.textContent ?? ''));
    return {
        chords: [...panel.querySelectorAll('ul.progression-list > li')].map(li => li.textContent.trim()),
        speak: speak?.checked ?? null
    };
});

/** Whether two chord names share a root: the letter and any sharp or flat. */
const rootOf = name => /^[A-G][#b]?/.exec(name)?.[0];
const sameRootPairs = names => names.slice(1).filter((name, i) => rootOf(name) === rootOf(names[i])).length;

console.log('=== The dialog ===');
await openDialog();
const dialog = await page.evaluate(() => {
    const box = document.getElementById('chord-practice-no-held-checkbox');
    const controls = [...document.getElementById('chord-practice-dialog').querySelectorAll('input, select')]
        .map(el => el.id);
    return {
        exists: !!box,
        label: document.querySelector('label[for="chord-practice-no-held-checkbox"]')?.textContent.trim(),
        checked: box?.checked,
        follows: controls[controls.indexOf('chord-practice-no-held-checkbox') - 1],
        speakChecked: document.getElementById('chord-practice-speak-checkbox').checked,
        speakDisabled: document.getElementById('chord-practice-speak-checkbox').disabled
    };
});
check('the checkbox is there and labelled', dialog.exists && !!dialog.label, dialog.label);
check('it comes straight after Number of measures', dialog.follows === 'chord-practice-count-input',
    dialog.follows);
check('it is checked by default', dialog.checked === true);
check('speaking the chord names is checked by default',
    dialog.speakChecked === !dialog.speakDisabled,
    `checked ${dialog.speakChecked}, disabled ${dialog.speakDisabled}`);

console.log('\n=== Checked: every measure changes chord ===');
let worst = 0;
for (let run = 0; run < 5; run++) {
    if (run > 0) await openDialog();
    await page.fill('#chord-practice-count-input', '75');
    await page.click('#chord-practice-generate-button');
    await page.waitForTimeout(1200);
    const { chords } = await progressionInFront();
    worst = Math.max(worst, sameRootPairs(chords));
    if (run === 0) check('the progression has 75 measures', chords.length === 75, `${chords.length}`);
}
check('no neighbouring chords share a root, in five 75-measure progressions', worst === 0,
    `${worst} pairs at most`);
const generated = await progressionInFront();
check('the progression speaks the chord names', generated.speak === !dialog.speakDisabled,
    String(generated.speak));

console.log('\n=== Unchecked: held chords can happen again ===');
let held = 0;
for (let run = 0; run < 5; run++) {
    await openDialog();
    await page.uncheck('#chord-practice-no-held-checkbox');
    await page.fill('#chord-practice-count-input', '75');
    await page.click('#chord-practice-generate-button');
    await page.waitForTimeout(1200);
    held += sameRootPairs((await progressionInFront()).chords);
}
check('five 75-measure progressions hold a chord somewhere', held > 0, `${held} pairs`);

console.log('\n=== The dialog opens checked again ===');
await openDialog();
check('the checkbox is back to checked',
    await page.evaluate(() => document.getElementById('chord-practice-no-held-checkbox').checked));
await page.click('#chord-practice-cancel-button');

await app.close();
console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);

// Checks that section names written as beat text reach the measure headings.
//
// Ripple carries no section markers at all: its Intro, End Intro and Outro are beat text on the
// Acoustic Lead. They must appear on the measure heading, carry their beat when they do not fall
// on the first one, show on every track rather than only the one that wrote them, and stop being
// repeated at the end of the beat they came from.

const APP_DIR = `${import.meta.dirname}/../..`.split('\\').join('/');
const SONG = `${APP_DIR}/musicfiles/Grateful Dead-Ripple-12-20-2025.gp`;
const { _electron } = await import(`file:///${APP_DIR}/node_modules/playwright-core/index.mjs`);
const { readFile } = await import('node:fs/promises');

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};

const app = await _electron.launch({ args: ['.'], cwd: APP_DIR });
const page = await app.firstWindow();
await page.waitForLoadState('domcontentloaded');

const songBytes = [...new Uint8Array(await readFile(SONG))];
await app.evaluate(({ BrowserWindow }, { fileName, bytes }) => {
    BrowserWindow.getAllWindows()[0].webContents.send('tabs:open-file', {
        fileName, data: new Uint8Array(bytes)
    });
}, { fileName: 'Grateful Dead-Ripple-12-20-2025.gp', bytes: songBytes });
await page.waitForTimeout(6000);

// The measure lists are built lazily on first open, so every track's disclosure is opened first.
const opened = await page.evaluate(() => {
    const panel = document.querySelector('.tab-panel:not([hidden])') ?? document.body;
    const names = [];
    for (const details of panel.querySelectorAll('details')) {
        const summary = details.querySelector('summary')?.textContent ?? '';
        if (!/^Measures/.test(summary.trim())) continue;
        details.open = true;
        details.dispatchEvent(new Event('toggle'));
        let heading = details.previousElementSibling;
        while (heading && heading.tagName !== 'H3') heading = heading.previousElementSibling;
        names.push(heading ? heading.textContent.trim() : '(unnamed)');
    }
    return names;
});
console.log(`=== Tracks with a Measures list: ${opened.length}`);
for (const name of opened) console.log(`  ${name}`);

const read = await page.evaluate(() => {
    const panel = document.querySelector('.tab-panel:not([hidden])') ?? document.body;
    const perTrack = [];
    for (const details of panel.querySelectorAll('details')) {
        const summary = details.querySelector('summary')?.textContent ?? '';
        if (!/^Measures/.test(summary.trim())) continue;
        let heading = details.previousElementSibling;
        while (heading && heading.tagName !== 'H3') heading = heading.previousElementSibling;
        const measures = {};
        for (const h4 of details.querySelectorAll('h4')) {
            const match = h4.textContent.match(/^Measure (\d+)/);
            if (!match) continue;
            const list = h4.nextElementSibling;
            measures[match[1]] = {
                heading: h4.textContent,
                items: list ? [...list.querySelectorAll('li')].map(li => li.textContent) : []
            };
        }
        perTrack.push({ name: heading ? heading.textContent.trim() : '(unnamed)', measures });
    }
    return perTrack;
});

const lead = read.find(track => /Acoustic Lead/.test(track.name));
const other = read.find(track =>
    !/Acoustic Lead/.test(track.name) && Object.keys(track.measures).length > 0);

console.log('\n=== The track that wrote the text: Acoustic Lead ===');
for (const bar of ['1', '18', '86']) console.log(`  ${lead.measures[bar].heading}`);
check('bar 1 heading names the Intro', /Measure 1 - Intro/.test(lead.measures['1'].heading),
    lead.measures['1'].heading);
check('bar 18 heading names End Intro with its beat',
    /Measure 18 - End Intro during beat 3/.test(lead.measures['18'].heading),
    lead.measures['18'].heading);
check('bar 86 heading names the Outro', /Measure 86 - Outro/.test(lead.measures['86'].heading),
    lead.measures['86'].heading);

console.log('\n=== The beat no longer repeats it ===');
for (const bar of ['1', '18', '86']) {
    const repeated = lead.measures[bar].items.filter(item => /text "/.test(item));
    check(`bar ${bar} has no beat text left`, repeated.length === 0, repeated.join(' | '));
}

console.log(`\n=== A track that wrote nothing: ${other.name} ===`);
for (const bar of ['1', '18', '86']) console.log(`  ${other.measures[bar].heading}`);
check('the Intro reaches it too', /Intro/.test(other.measures['1'].heading),
    other.measures['1'].heading);
check('so does the Outro', /Outro/.test(other.measures['86'].heading),
    other.measures['86'].heading);

console.log('\n=== Nothing was promoted that should not be ===');
const stray = [];
for (const track of read) {
    for (const [bar, measure] of Object.entries(track.measures)) {
        if (['1', '18', '86'].includes(bar)) continue;
        const rest = measure.heading.replace(/^Measure \d+ ?-? ?/, '').trim();
        // Repeats and chord symbols legitimately head a measure; a bare section word would not.
        if (rest !== '' && !/repeat|ending|chord symbol/i.test(rest)) {
            stray.push(`${track.name} bar ${bar}: ${rest}`);
        }
    }
}
check('no other measure gained a section', stray.length === 0, stray.slice(0, 5).join(' | '));

console.log(`\n${failures === 0 ? 'all checks passed' : `${failures} FAILED`}`);
await app.close();
process.exit(failures === 0 ? 0 : 1);

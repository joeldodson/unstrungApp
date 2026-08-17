// Checks the layout of a track section on the parsed-file page.
//
// Order within a track: the track's data list, then the Chords Used region, then Measures, then
// the Create Audio Track button. Chords Used must be collapsed until opened, must build its rows
// on first open, and each row must be a list item whose summary is the chord name alone.

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
await page.waitForTimeout(5000);

console.log('=== Order of elements inside a track ===');
const order = await page.evaluate(() => {
    const panel = document.querySelector('.tab-panel:not([hidden])') ?? document.body;
    const nodes = [...panel.querySelectorAll('h3, details > summary, button')];
    const labels = [];
    for (const node of nodes) {
        const text = node.textContent.trim();
        if (node.tagName === 'H3') labels.push(`TRACK: ${text}`);
        else if (node.tagName === 'SUMMARY') labels.push(`REGION: ${text}`);
        else if (/Create Audio Track/.test(text)) labels.push('BUTTON: Create Audio Track');
    }
    return labels;
});
const firstTrack = order.slice(0, 4);
console.log(`  ${firstTrack.join('\n  ')}`);
check('the first track leads with its heading', /^TRACK: Track 1/.test(firstTrack[0] ?? ''), firstTrack[0]);
check('Chords Used comes first of the regions', /^REGION: Chords Used/.test(firstTrack[1] ?? ''), firstTrack[1]);
check('Measures follows it', /^REGION: Measures/.test(firstTrack[2] ?? ''), firstTrack[2]);
check('Create Audio Track is last', firstTrack[3] === 'BUTTON: Create Audio Track', firstTrack[3]);

console.log('\n=== Chords Used starts collapsed and empty ===');
const before = await page.evaluate(() => {
    const d = [...document.querySelectorAll('details')].find(x =>
        /Chords Used/.test(x.querySelector('summary')?.textContent ?? ''));
    return { open: d.open, summary: d.querySelector('summary').textContent, items: d.querySelectorAll('li').length };
});
check('collapsed on arrival', before.open === false);
check('nothing built yet', before.items === 0, `${before.items} list items`);
check('the count is on the summary', /Chords Used - \d+/.test(before.summary), before.summary);

console.log('\n=== Opening it builds the chords ===');
const after = await page.evaluate(async () => {
    const d = [...document.querySelectorAll('details')].find(x =>
        /Chords Used/.test(x.querySelector('summary')?.textContent ?? ''));
    d.open = true;
    // The rows wait on the chord library, which is fetched over IPC on first open.
    for (let i = 0; i < 50 && d.querySelectorAll(':scope > ul > li').length === 0; i++) {
        await new Promise(r => setTimeout(r, 100));
    }
    const rows = [...d.querySelectorAll(':scope > ul > li')];
    return {
        count: rows.length,
        summaries: rows.map(li => li.querySelector('summary')?.textContent ?? '(no summary)'),
        eachIsCollapsedDetails: rows.every(li => {
            const inner = li.querySelector('details');
            return inner && inner.open === false;
        }),
        firstRowFacts: [...(rows[0]?.querySelectorAll('details > ul > li') ?? [])].map(li => li.textContent)
    };
});
console.log(`  rows: ${after.count}`);
console.log(`  summaries: ${after.summaries.join(' | ')}`);
check('rows were built', after.count > 0, `${after.count} rows`);
check('every row is a collapsed details in a list item', after.eachIsCollapsedDetails);
check('summaries are chord names only, no extra text',
    after.summaries.every(s => /^[A-G][#b]?[^,;-]*$/.test(s)), after.summaries.join(' | '));
console.log(`  first chord's facts:\n    ${after.firstRowFacts.join('\n    ')}`);
check('the row carries chord information', after.firstRowFacts.length > 1);
check('the row says how much of the track it covers',
    after.firstRowFacts.some(t => /Sounds on \d+ beats? of this track/.test(t)));

console.log('\n=== Chord symbols ride on the measure heading ===');
const headings = await page.evaluate(async () => {
    const regions = [...document.querySelectorAll('details')].filter(x =>
        /^Measures - /.test(x.querySelector('summary')?.textContent ?? ''));
    // The capo track: bar 2 carries a C, bar 44 a G that arrives mid-measure.
    const measures = regions[1];
    measures.open = true;
    await new Promise(r => setTimeout(r, 500));
    const h4s = [...measures.querySelectorAll('h4')];
    return {
        withSymbol: h4s.filter(h => /chord symbol/.test(h.textContent)).map(h => h.textContent),
        plain: h4s.filter(h => !/chord symbol/.test(h.textContent)).length,
        beatsMentioningSymbol: [...measures.querySelectorAll('li')]
            .filter(li => /chord symbol/.test(li.textContent)).length
    };
});
console.log(`  headings carrying a symbol: ${headings.withSymbol.length}`);
console.log(`  first four: ${headings.withSymbol.slice(0, 4).join(' | ')}`);
check('a symbol reaches the measure heading',
    headings.withSymbol.some(h => /^Measure \d+ - chord symbol [A-G]/.test(h)), headings.withSymbol[0]);
check('every symbol is placed by beat, including the ones on beat 1',
    headings.withSymbol.every(h => / (at|during) beat \d/.test(h)),
    headings.withSymbol.find(h => !/ (at|during) beat \d/.test(h)) ?? 'all placed');
check('a mid-measure change reports the beat it starts on',
    headings.withSymbol.some(h => / at beat [2-9]/.test(h)),
    headings.withSymbol.find(h => / at beat [2-9]/.test(h)) ?? 'none found');
check('measures without a symbol keep a bare heading', headings.plain > 0, `${headings.plain} plain headings`);
check('no beat line mentions a chord symbol any more',
    headings.beatsMentioningSymbol === 0, `${headings.beatsMentioningSymbol} beats still do`);

console.log('\n=== A part with no chords says so ===');
const bass = await page.evaluate(async () => {
    const regions = [...document.querySelectorAll('details')].filter(x =>
        /Chords Used/.test(x.querySelector('summary')?.textContent ?? ''));
    const empty = regions.find(x => /Chords Used - 0/.test(x.querySelector('summary').textContent));
    if (!empty) return null;
    empty.open = true;
    await new Promise(r => setTimeout(r, 300));
    return empty.querySelector('p')?.textContent ?? '(nothing)';
});
check('the empty region explains itself', bass !== null && /No chords/.test(bass), bass ?? 'no empty region found');

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
await app.close();
process.exit(failures === 0 ? 0 : 1);

// Checks the layout of a track section on the parsed-file page.
//
// Order within a track: the track's data list, then the Chord Symbols region, then Measures, then
// the Create Audio Track button. Chord Symbols must be collapsed until opened, must build its rows
// on first open, and each row must be a list item whose summary is the chord name alone.

const APP_DIR = `${import.meta.dirname}/../..`.split('\\').join('/');
const SONG = `${APP_DIR}/musicfiles/Grateful Dead-Ripple-12-20-2025.gp`;
import { launchApp } from '../lib/app-ui.mjs';
const { readFile } = await import('node:fs/promises');

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};

// On a scratch profile, so nothing here reaches the real settings or recent files.
const { app, page, close } = await launchApp();

const songBytes = [...new Uint8Array(await readFile(SONG))];
await app.evaluate(({ BrowserWindow }, { fileName, bytes }) => {
    BrowserWindow.getAllWindows()[0].webContents.send('files:opened', {
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
check('Chord Symbols comes first of the regions', /^REGION: Chord Symbols/.test(firstTrack[1] ?? ''), firstTrack[1]);
check('Measures follows it', /^REGION: Measures/.test(firstTrack[2] ?? ''), firstTrack[2]);
// The Create Audio Track button became an Audio Track disclosure that builds the track in place.
check('the Audio Track disclosure is last', /^REGION: Audio Track - /.test(firstTrack[3] ?? ''), firstTrack[3]);

console.log('\n=== Chord Symbols starts collapsed and empty ===');
const before = await page.evaluate(() => {
    const d = [...document.querySelectorAll('details')].find(x =>
        /Chord Symbols/.test(x.querySelector('summary')?.textContent ?? ''));
    return { open: d.open, summary: d.querySelector('summary').textContent, items: d.querySelectorAll('li').length };
});
check('collapsed on arrival', before.open === false);
check('nothing built yet', before.items === 0, `${before.items} list items`);
check('the count is on the summary', /Chord Symbols - \d+/.test(before.summary), before.summary);

console.log('\n=== Opening it builds the chords ===');
const after = await page.evaluate(async () => {
    const d = [...document.querySelectorAll('details')].find(x =>
        /Chord Symbols/.test(x.querySelector('summary')?.textContent ?? ''));
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
check('the row says how often the file prints it',
    after.firstRowFacts.some(t => /Printed \d+ times? in this track/.test(t)));

// The chords the file prints head the measures, and nothing else does. See
// docs/chord-forms-in-scores.md.
console.log('\n=== Printed chords ride on the measure heading ===');
const headings = await page.evaluate(async () => {
    const regions = [...document.querySelectorAll('details')].filter(x =>
        /^Measures - /.test(x.querySelector('summary')?.textContent ?? ''));
    const read = async measures => {
        measures.open = true;
        await new Promise(r => setTimeout(r, 500));
        return {
            headings: [...measures.querySelectorAll('h4')].map(h => h.textContent),
            beatsMentioningSymbol: [...measures.querySelectorAll('li')].filter(li => /chord symbol/.test(li.textContent)).length
        };
    };
    // The capo track prints C over bar 2. The bass prints nothing.
    return { capo: await read(regions[1]), bass: await read(regions[2]) };
});
const capoHeadings = headings.capo.headings;
console.log(`  capo, bars 2 and 3: ${capoHeadings[1]} | ${capoHeadings[2]}`);
check('a printed chord reaches the heading', capoHeadings[1] === 'Measure 2 - chord C', capoHeadings[1]);
check('the next measure continues it', capoHeadings[2] === 'Measure 3 - continues C', capoHeadings[2]);
check('measures with nothing printed keep a bare heading', headings.bass.headings.some(h => /^Measure \d+$/.test(h)));
check('no beat line mentions a chord symbol any more',
    headings.capo.beatsMentioningSymbol + headings.bass.beatsMentioningSymbol === 0);

console.log('\n=== A part with no chords says so ===');
const bass = await page.evaluate(async () => {
    const regions = [...document.querySelectorAll('details')].filter(x =>
        /Chord Symbols/.test(x.querySelector('summary')?.textContent ?? ''));
    const empty = regions.find(x => /Chord Symbols - 0/.test(x.querySelector('summary').textContent));
    if (!empty) return null;
    empty.open = true;
    await new Promise(r => setTimeout(r, 300));
    return empty.querySelector('p')?.textContent ?? '(nothing)';
});
check('the empty region explains itself', bass !== null && /prints no chord symbols/.test(bass), bass ?? 'no empty region found');

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
await close();
process.exit(failures === 0 ? 0 : 1);

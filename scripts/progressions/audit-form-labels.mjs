// Every form control the app can put on screen, with the name a screen reader would compute.
//
// A control whose label is present in the source can still be nameless in the tree: a `for`
// attribute resolves to the first element in the document with that id, so a second copy of a
// page built with fixed ids leaves the later controls unlabelled while the earlier ones collect
// two labels. This walks the whole document and reports what each control actually resolves to.

const APP_DIR = `${import.meta.dirname}/../..`.split('\\').join('/');
const SONG = 'Grateful Dead-Ripple-12-20-2025.gp';
const { _electron } = await import(`file:///${APP_DIR}/node_modules/playwright-core/index.mjs`);
const { readFile } = await import('node:fs/promises');

const app = await _electron.launch({ args: ['.'], cwd: APP_DIR });
const page = await app.firstWindow();
await page.waitForLoadState('domcontentloaded');

// How a control gets its name, in the order the accessible-name calculation tries them.
// Everything in the document, not only what is on screen: a control in a tab that is not current
// is one keystroke from being read, and that is exactly where the fixed-id collision hid.
const AUDIT = `(() => {
    const idCounts = new Map();
    for (const el of document.querySelectorAll('[id]')) {
        idCounts.set(el.id, (idCounts.get(el.id) ?? 0) + 1);
    }
    const nameOf = el => {
        const labelledby = el.getAttribute('aria-labelledby');
        const fromLabelledby = labelledby
            ? labelledby.split(/\\s+/).map(id => document.getElementById(id)?.textContent?.trim() ?? '').join(' ').trim()
            : '';
        const ariaLabel = (el.getAttribute('aria-label') ?? '').trim();
        const fromLabels = [...(el.labels ?? [])].map(l => l.textContent.trim()).join(' ').trim();
        return {
            name: fromLabelledby || ariaLabel || fromLabels,
            source: fromLabelledby ? 'aria-labelledby' : ariaLabel ? 'aria-label' : fromLabels ? 'label' : 'NONE'
        };
    };

    const controls = [...document.querySelectorAll('input, select, textarea')].map(el => {
        const { name, source } = nameOf(el);
        return {
            kind: 'control',
            id: el.id || '(no id)',
            tag: el.tagName.toLowerCase(),
            type: el.type ?? '',
            duplicateId: el.id ? (idCounts.get(el.id) ?? 0) : 1,
            labelCount: (el.labels ?? []).length,
            name,
            source
        };
    });

    // Buttons take their name from their content, so this is only checking none are empty.
    const buttons = [...document.querySelectorAll('button, [role="button"]')].map(el => {
        const { name, source } = nameOf(el);
        return {
            kind: 'button',
            id: el.id || '(no id)',
            tag: el.tagName.toLowerCase(),
            type: '',
            duplicateId: el.id ? (idCounts.get(el.id) ?? 0) : 1,
            labelCount: 0,
            name: name || el.textContent.trim() || (el.getAttribute('title') ?? '').trim(),
            source: name ? source : el.textContent.trim() ? 'content' : 'NONE'
        };
    });

    // A dialog announces its own name when it opens.
    const dialogs = [...document.querySelectorAll('dialog, [role="dialog"]')].map(el => {
        const { name, source } = nameOf(el);
        return {
            kind: 'dialog',
            id: el.id || '(no id)',
            tag: el.tagName.toLowerCase(),
            type: '',
            duplicateId: el.id ? (idCounts.get(el.id) ?? 0) : 1,
            labelCount: 0,
            name,
            source
        };
    });

    const duplicates = [...idCounts.entries()].filter(([, count]) => count > 1);
    return { rows: [...controls, ...buttons, ...dialogs], duplicates };
})()`;

const report = async where => {
    const { rows, duplicates } = await page.evaluate(AUDIT);
    const bad = rows.filter(row => row.name === '' || row.duplicateId > 1);
    const counts = ['control', 'button', 'dialog']
        .map(kind => `${rows.filter(r => r.kind === kind).length} ${kind}s`).join(', ');
    console.log(`\n=== ${where}: ${counts}, ${bad.length} with a problem`);
    for (const row of bad) {
        const why = row.name === '' ? 'NO NAME' : `id used ${row.duplicateId} times`;
        console.log(`  ${why.padEnd(18)} ${row.kind} ${row.tag}/${row.type}  id=${row.id}  name=${JSON.stringify(row.name)}`);
    }
    if (duplicates.length > 0) {
        console.log(`  duplicate ids anywhere in the document: ${duplicates.map(([id, n]) => `${id} x${n}`).join(', ')}`);
    }
    return bad.length + duplicates.length;
};

let problems = 0;

// --- A song, then an audio track for two different tracks of it ---
const bytes = [...new Uint8Array(await readFile(`${APP_DIR}/musicfiles/${SONG}`))];
await app.evaluate(({ BrowserWindow }, payload) => {
    BrowserWindow.getAllWindows()[0].webContents.send('tabs:open-file', {
        fileName: payload.fileName, data: new Uint8Array(payload.bytes)
    });
}, { fileName: SONG, bytes });
await page.waitForTimeout(6000);

const trackCount = await page.evaluate(() => {
    const panel = document.querySelector('.tab-panel:not([hidden])') ?? document.body;
    return [...panel.querySelectorAll('button')].filter(b => /Create Audio Track/.test(b.textContent)).length;
});
console.log(`Song open, ${trackCount} tracks offering an audio track`);

for (const which of [0, 1]) {
    await page.evaluate(index => {
        const panel = document.querySelector('.tab-panel:not([hidden])') ?? document.body;
        const buttons = [...panel.querySelectorAll('button')].filter(b => /Create Audio Track/.test(b.textContent));
        buttons[index]?.click();
    }, which);
    await page.waitForTimeout(3000);
    problems += await report(`Audio track page ${which + 1} open`);
}

// --- The audio track page after its track has been built, in case that adds controls ---
await page.evaluate(() => {
    const panels = [...document.querySelectorAll('[role="tabpanel"]:not([hidden])')];
    for (const panel of panels) {
        const button = [...panel.querySelectorAll('button')].find(b => /^Create Track$/.test(b.textContent.trim()));
        button?.click();
    }
});
await page.waitForTimeout(8000);
problems += await report('Audio track page after Create Track');

// --- Dialogs, one at a time ---
const DIALOGS = [
    ['Chord Library', 'chords:open'],
    ['Frets to Chord', 'frets:open'],
    ['Guitar Samples', 'guitar-samples:open'],
    ['Chord Practice', 'chord-practice:open'],
    ['Settings', 'settings:open']
];
for (const [name, channel] of DIALOGS) {
    const sent = await app.evaluate(({ BrowserWindow }, ch) => {
        BrowserWindow.getAllWindows()[0].webContents.send(ch);
        return true;
    }, channel);
    if (!sent) continue;
    await page.waitForTimeout(2500);
    problems += await report(name);
    await page.evaluate(() => {
        for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
    });
    await page.waitForTimeout(500);
}

// --- Two chord practice tabs, which is the same collision risk the audio track page had ---
for (const pass of [1, 2]) {
    await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].webContents.send('chord-practice:open'));
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
        const dialog = document.querySelector('dialog[open]');
        const generate = [...(dialog?.querySelectorAll('button') ?? [])]
            .find(b => /Generate/i.test(b.textContent));
        generate?.click();
    });
    await page.waitForTimeout(4000);
    problems += await report(`Chord practice tab, ${pass} open`);
}

console.log(`\n${problems === 0 ? 'no problems found' : `${problems} problems found`}`);
await app.close();
process.exit(0);

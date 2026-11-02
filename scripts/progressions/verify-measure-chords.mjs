// Verifies more than one chord in a measure, against the real app: typing chord lists into the
// progression editor, the tab that results, saving and opening again, where-am-I, and what
// playback schedules -- each strum's chord and each spoken word, read from the page's audio
// sources rather than heard.
//
// Runs on a scratch profile (UNSTRUNG_TEST_PROFILE). Asserts on structure, text, focus, file
// contents and scheduled times -- never on anything visual.
//
//   node scripts/progressions/verify-measure-chords.mjs

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchApp, runMenuCommand, closeCurrentItem, openSongFile, VISIBLE_PANEL } from '../lib/app-ui.mjs';
import { readSongFromScore, describeMeasure } from '../../src/shared/songScore.mjs';

const APP_DIR = path.join(import.meta.dirname, '..', '..');
const alphaTab = await import(pathToFileURL(path.join(APP_DIR, 'node_modules', '@coderline', 'alphatab', 'dist', 'alphaTab.mjs')).href);
const library = JSON.parse(await readFile(path.join(APP_DIR, 'src', 'assets', 'chords', 'chord-library.json'), 'utf8'));

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${condition ? '' : `  -- ${detail}`}`);
};

const { app, page, profile, close } = await launchApp();
const wait = ms => page.waitForTimeout(ms);
const filePath = path.join(profile, 'Documents', 'Unstrung', 'Progressions', 'Changes.atex');

const editorState = () => page.evaluate(() => ({
    options: [...document.querySelectorAll('#progression-editor-measures [role="option"]')].map(o => o.textContent),
    label: document.getElementById('progression-editor-chord-label').textContent,
    status: document.getElementById('progression-editor-status').textContent,
    focusedId: document.activeElement?.id,
    field: document.getElementById('progression-editor-chord-input').value
}));
const typeChords = async text => {
    await page.fill('#progression-editor-chord-input', text);
    await page.focus('#progression-editor-chord-input');
    await page.keyboard.press('Enter');
    await wait(150);
    return editorState();
};
const panelState = () => page.evaluate(selector => {
    const panel = document.querySelector(selector);
    return {
        measures: [...panel.querySelectorAll('ul.progression-list li')].map(li => li.textContent),
        used: [...panel.querySelectorAll('ul.chords-used summary')].map(s => s.textContent),
        announcement: panel.querySelector('[aria-live]').textContent,
        tabName: document.querySelector('#open-items-list button[aria-current="true"]')?.textContent
    };
}, VISIBLE_PANEL);
const clickInPanel = label => page.evaluate(([selector, text]) => {
    [...document.querySelector(selector).querySelectorAll('button')].find(b => b.textContent === text).click();
}, [VISIBLE_PANEL, label]);

try {
    console.log('=== Typing chord lists into the editor ===');
    await runMenuCommand(page, 'new-progression');
    await wait(800);

    // A new progression starts at the key. Tabbing to the measure, Enter, a chord and Enter gives
    // the measure that chord, as it does when editing.
    let state = await editorState();
    check('a new progression starts at the key', state.focusedId === 'progression-editor-key-select', state.focusedId);
    const description = await page.evaluate(() => {
        const dialog = document.getElementById('progression-editor-dialog');
        return document.getElementById(dialog.getAttribute('aria-describedby'))?.textContent;
    });
    check('the dialog has a short description of its own, so NVDA does not read all of it',
        description === 'Key, time signature, strumming pattern, then the measures.', description);
    for (let tabs = 0; tabs < 10 && state.focusedId !== 'progression-editor-measure-0'; tabs++) {
        await page.keyboard.press('Tab');
        state = await editorState();
    }
    check('Tab reaches the empty measure', state.focusedId === 'progression-editor-measure-0', state.focusedId);
    await page.keyboard.press('Enter');
    state = await editorState();
    check('Enter on it goes to the chord field, labelled for measure 1',
        state.focusedId === 'progression-editor-chord-input' && state.label === 'Chords for measure 1, no chord yet',
        JSON.stringify(state));
    await page.keyboard.type('g');
    await page.keyboard.press('Enter');
    await wait(150);
    state = await editorState();
    check('g and Enter make it G and go back to the measure',
        state.options[0] === 'G' && state.focusedId === 'progression-editor-measure-0', JSON.stringify(state));

    // A screen reader in browse mode sends Enter as a click.
    await page.click('#progression-editor-measure-0');
    state = await editorState();
    check('a click on a measure goes to the chord field too',
        state.focusedId === 'progression-editor-chord-input' && state.label === 'Chords for measure 1, now G',
        JSON.stringify(state));

    // In browse mode NVDA shows the list as one line, and Enter on it clicks the list itself.
    await page.focus('#progression-editor-key-select');
    await page.evaluate(() => document.getElementById('progression-editor-measures').click());
    state = await editorState();
    check('a click on the list itself goes to the current measure',
        state.focusedId === 'progression-editor-measure-0', state.focusedId);

    await page.selectOption('#progression-editor-key-select', 'G|major');
    state = await typeChords('G D C@4');
    check('"G D C@4" is taken as written and focus goes back to the measure',
        state.options[0] === 'G D C@4' && state.focusedId === 'progression-editor-measure-0', JSON.stringify(state));
    check('the field\'s label names the measure\'s chords', state.label === 'Chords for measure 1, now G D C@4', state.label);

    state = await typeChords('G C@5');
    check('a chord past the end is refused, saying why, and focus stays in the field',
        /outside the measure, which has beats 1 to 4/.test(state.status) && state.focusedId === 'progression-editor-chord-input'
        && state.options[0] === 'G D C@4', JSON.stringify(state));
    state = await typeChords('G Q');
    check('an unknown chord is refused by name', /no chord named Q/.test(state.status), state.status);
    await page.fill('#progression-editor-chord-input', '');

    await page.click('#progression-editor-insert-button');
    state = await typeChords('C C G G');
    check('"C C G G" is written the shorter way, "C G@3"', state.options[1] === 'C G@3', state.options.join(' | '));

    await page.click('#progression-editor-insert-button');
    state = await typeChords('G C@2.5');
    check('a chord on an and is taken', state.options[2] === 'G C@2.5', state.options.join(' | '));
    check('and the editor says Down Only first strums it on 3', state.status === 'The pattern first strums C on 3.', state.status);

    await page.click('#progression-editor-duplicate-button');

    // The list offers chords for the last one typed: after "G " Down lists the key's chords.
    await page.click('#progression-editor-insert-button');
    await page.fill('#progression-editor-chord-input', 'G ');
    await page.focus('#progression-editor-chord-input');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    const offered = await page.evaluate(() =>
        document.querySelector('#progression-editor-suggestions [aria-selected="true"]')?.textContent);
    await page.keyboard.press('Enter');
    await wait(150);
    state = await editorState();
    check('after a space, Down offers the key\'s chords for the next one', offered === 'Am, degree 2', offered);
    check('choosing one adds it to the list', state.options[4] === 'G Am' && state.focusedId === 'progression-editor-measure-4',
        JSON.stringify(state));

    // A suggestion keeps the beat typed after it.
    await page.click('#progression-editor-insert-button');
    await page.fill('#progression-editor-chord-input', 'G E@3');
    await page.focus('#progression-editor-chord-input');
    await page.keyboard.press('ArrowDown');
    const firstForE = await page.evaluate(() =>
        document.querySelector('#progression-editor-suggestions [aria-selected="true"]')?.textContent);
    await page.keyboard.press('Enter');
    await wait(150);
    state = await editorState();
    check('suggestions are for the chord being typed, without its beat', /^E/.test(firstForE ?? ''), firstForE);
    check('the chosen chord keeps its beat', /^G E\S*@3/.test(state.options[5]), state.options[5]);
    await page.click('#progression-editor-remove-button');

    console.log('\n=== The progression tab ===');
    await page.click('#progression-editor-apply-button');
    await wait(1200);
    let panel = await panelState();
    console.log(`  measures: ${panel.measures.join(' | ')}`);
    check('the Progression list shows each measure as written',
        panel.measures.join('|') === 'G D C@4|C G@3|G C@2.5|G C@2.5|G Am', panel.measures.join(' | '));
    check('Chords Used lists every chord once', panel.used.join(' ') === 'G D C Am', panel.used.join(' '));

    await clickInPanel('Where Am I');
    await wait(200);
    panel = await panelState();
    check('Where Am I names the measure\'s chords and the beat',
        panel.announcement.startsWith('Measure 1 of 5, G D C@4, beat 1'), panel.announcement);

    console.log('\n=== Saving and opening again ===');
    await app.evaluate(({ dialog }, target) => {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath: target });
    }, filePath);
    await clickInPanel('Save Progression');
    await wait(800);
    const importer = new alphaTab.importer.AlphaTexImporter();
    importer.initFromString(await readFile(filePath, 'utf8'), new alphaTab.Settings());
    const saved = readSongFromScore(importer.readScore(), { library });
    const described = saved.measures.map((m, i) => describeMeasure(m, i + 1).replace(/^Measure \d+, /, ''));
    console.log(`  file: ${described.join(' | ')}`);
    check('the file holds every chord where it starts',
        described.join('|') === ['G D at 2 C at 4', 'C G at 3', 'G C at 2.5', 'G C at 2.5', 'G Am at 2']
            .map(chords => `${chords}, D D D D`).join('|'), described.join(' | '));

    await closeCurrentItem(page);
    await wait(400);
    await runMenuCommand(page, 'open-progression');
    await wait(1000);
    await page.keyboard.press('Enter');
    await wait(1500);
    panel = await panelState();
    check('opened again, it reads the same', panel.measures.join('|') === 'G D C@4|C G@3|G C@2.5|G C@2.5|G Am',
        `${panel.tabName}: ${panel.measures.join(' | ')}`);

    console.log('\n=== What playback schedules ===');
    // Every source the page starts from here on: guitar notes start with a time and an offset,
    // spoken words with a time, an offset and a length, metronome clicks with a time alone.
    await page.evaluate(() => {
        window.__started = [];
        const start = AudioBufferSourceNode.prototype.start;
        AudioBufferSourceNode.prototype.start = function (...args) {
            window.__started.push({ args, length: this.buffer?.length, sampleRate: this.buffer?.sampleRate });
            return start.apply(this, args);
        };
    });
    await page.evaluate(selector => {
        const tempo = document.querySelector(selector).querySelector('input[type="number"]');
        tempo.value = '120';
        tempo.dispatchEvent(new Event('change'));
    }, VISIBLE_PANEL);
    await clickInPanel('Play');
    await wait(4000);
    await clickInPanel('Pause');
    await wait(300);

    const record = await page.evaluate(async () => {
        const started = window.__started;
        const notes = started.filter(s => s.args.length === 2).map(s => s.args[0]).sort((a, b) => a - b);
        const words = started.filter(s => s.args.length === 3).map(s => ({ when: s.args[0], seconds: s.args[2], length: s.length, sampleRate: s.sampleRate }));
        // Which word each is, by decoding the recordings at the same rate and matching lengths.
        const names = ['G', 'D', 'C', 'A minor', 'repeat', 'at 4', 'at 3', 'at 2.5'];
        const rendered = await window.unstrung.getSpokenPhrases('zira', names);
        const context = new OfflineAudioContext(1, 1, words[0]?.sampleRate ?? 48000);
        const lengths = new Map();
        for (const entry of rendered) {
            const bytes = entry.bytes.buffer.slice(entry.bytes.byteOffset, entry.bytes.byteOffset + entry.bytes.byteLength);
            lengths.set((await context.decodeAudioData(bytes)).length, entry.text);
        }
        return { notes, words: words.map(w => ({ ...w, text: lengths.get(w.length) ?? `?${w.length}` })) };
    });

    // Strums: notes within a quarter of a second of the first, counted. A downstroke sweeps every
    // string of the shape: six for G, five for C and Am, four for D.
    const strums = [];
    for (const when of record.notes) {
        const last = strums[strums.length - 1];
        if (last && when - last.when < 0.25) last.count++;
        else strums.push({ when, count: 1 });
    }
    const shape = { 6: 'G', 5: 'C/Am', 4: 'D' };
    const heard = strums.map(s => shape[s.count] ?? `${s.count}?`);
    console.log(`  strums: ${heard.join(' ')}`);
    check('every beat strums the chord that has started by then',
        heard.slice(0, 20).join(' ') === 'G D D C/Am C/Am C/Am G G G G C/Am C/Am G G C/Am C/Am G C/Am C/Am C/Am',
        heard.join(' '));

    // Speech, against the downbeats: a beat is half a second at 120.
    const start = strums[0].when;
    const measureAt = index => start + index * 2;
    const spoken = [];
    for (const word of record.words) {
        const measure = Math.floor((word.when - start) / 2) + 1;
        const before = spoken[spoken.length - 1];
        if (before && before.measure === measure) before.words.push(word);
        else spoken.push({ measure, words: [word] });
    }
    console.log(`  spoken: ${spoken.map(s => `before ${s.measure + 1}: ${s.words.map(w => w.text).join(' ')} ` +
        `(${(s.words[0].when - measureAt(s.measure)).toFixed(2)})`).join('; ')}`);
    // The first time through only; it may go round again before Pause.
    spoken.splice(5);
    const said = spoken.map(s => s.words.map(w => w.text).join(' '));
    check('each measure\'s chords are said before it as written, @ beats included, and "repeat" before the same again',
        said.join(' | ') === 'G D C at 4 | C G at 3 | G C at 2.5 | repeat | G A minor', said.join(' | '));
    const finishes = spoken.map(s => {
        const last = s.words[s.words.length - 1];
        return measureAt(s.measure) - (last.when + last.seconds);
    });
    check('every list finishes before its measure starts', finishes.every(gap => gap > 0.05), finishes.map(g => g.toFixed(2)).join(', '));
    // Measured from the first strum, which starts early by its recording's attack.
    const repeatOffset = measureAt(spoken[3].measure) - spoken[3].words[0].when;
    check('"repeat" is said a beat ahead', Math.abs(repeatOffset - 0.5) < 0.04, repeatOffset.toFixed(3));

    console.log('\n=== The saved progression opened as a song ===');
    // Through Open File, the dialog answered with the saved file, keeping the filters it was given.
    await app.evaluate(({ dialog }, file) => {
        dialog.showOpenDialog = async (_window, options) => {
            globalThis.__openFilters = options.filters;
            return { canceled: false, filePaths: [file] };
        };
    }, filePath);
    await page.evaluate(() => document.getElementById('menu-open-file').click());
    await wait(2000);
    const filters = await app.evaluate(() => globalThis.__openFilters);
    check('Open File offers .atex among the song files',
        filters?.[0]?.extensions.includes('atex'), JSON.stringify(filters));
    const song = await page.evaluate(selector => {
        const panel = document.querySelector(selector);
        const details = [...panel.querySelectorAll('details')]
            .find(d => /^Measures/.test(d.querySelector('summary')?.textContent.trim() ?? ''));
        if (details) {
            details.open = true;
            details.dispatchEvent(new Event('toggle'));
        }
        return {
            tabName: document.querySelector('#open-items-list button[aria-current="true"]')?.textContent,
            text: panel.textContent,
            headings: [...(details?.querySelectorAll('h4') ?? [])].map(h => h.textContent)
        };
    }, VISIBLE_PANEL);
    await wait(500);
    const headings = await page.evaluate(selector => [...document.querySelector(selector).querySelectorAll('h4')]
        .map(h => h.textContent).filter(t => /^Measure \d/.test(t)), VISIBLE_PANEL);
    console.log(`  ${song.tabName}: ${headings.join(' | ')}`);
    check('it opens as a song, named by its file', song.tabName === 'Changes.atex', song.tabName);
    check('its title is the file name, as it has none of its own', /Changes/.test(song.text) && !/\(untitled\)/.test(song.text),
        song.text.slice(0, 200));
    check('its measure headings name every chord where it starts',
        /chord G, chord D at beat 2, chord C at beat 4/.test(headings[0] ?? '') &&
        /chord G at beat 3/.test(headings[1] ?? '') && /chord C during beat 2/.test(headings[2] ?? ''),
        headings.slice(0, 3).join(' | '));

    // A file that is not good alphaTex says where.
    await openSongFile(app, 'Broken.atex', new TextEncoder().encode('\\tempo 90\n.\n(0.3 2.2).4 {ch "G" |'));
    await wait(800);
    const broken = await page.evaluate(selector => document.querySelector(selector).textContent, VISIBLE_PANEL);
    check('a broken .atex file is reported with its line and column', /Could not read "Broken\.atex": line \d+, column \d+/.test(broken),
        broken.slice(0, 200));
} finally {
    console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
    await close();
}
process.exit(failures === 0 ? 0 : 1);

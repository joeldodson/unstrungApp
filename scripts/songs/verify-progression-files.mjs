// Verifies progressions saved and opened as alphaTex in the real app: generating, saving, reading
// the file back with alphaTab, opening a song with a strumming pattern, refusing what chord
// practice cannot show yet, and editing without losing the pattern.
//
// Runs on a scratch profile (UNSTRUNG_TEST_PROFILE), so nothing is written to the real Documents
// folder or settings. The system Save dialog is replaced in the main process with one that answers
// a chosen path. Commands are given through the page menu, as a player would. Asserts on text,
// structure and file contents, never on anything visual.
//
//   node scripts/songs/verify-progression-files.mjs

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readSongFromScore, describeMeasure } from '../../src/shared/songScore.mjs';
import { APP_DIR, launchApp, runMenuCommand } from '../lib/app-ui.mjs';

const alphaTab = await import(pathToFileURL(path.join(APP_DIR, 'node_modules', '@coderline', 'alphatab', 'dist', 'alphaTab.mjs')).href);
const library = JSON.parse(await readFile(path.join(APP_DIR, 'src', 'assets', 'chords', 'chord-library.json'), 'utf8'));

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};

const { app, page, profile, close } = await launchApp();
const folder = path.join(profile, 'Documents', 'Unstrung', 'Progressions');
const consoleErrors = [];
page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('pageerror', error => consoleErrors.push(error.message));

const answerSaveDialogWith = target => app.evaluate(({ dialog }, filePath) => {
    globalThis.__saveDialogCalls = globalThis.__saveDialogCalls ?? 0;
    dialog.showSaveDialog = async (_window, options) => {
        globalThis.__saveDialogCalls++;
        globalThis.__saveDialogOffered = options?.defaultPath ?? null;
        globalThis.__saveDialogFilters = options?.filters ?? null;
        return filePath ? { canceled: false, filePath } : { canceled: true };
    };
}, target);
const saveDialogCalls = () => app.evaluate(() => globalThis.__saveDialogCalls ?? 0);
const offeredName = async () => path.basename(await app.evaluate(() => globalThis.__saveDialogOffered ?? ''));

const menu = command => runMenuCommand(page, command);

const activePanel = () => page.evaluate(() => {
    const panel = document.querySelector('#item-panels > section:not([hidden])');
    if (!panel) return null;
    const metaList = [...panel.querySelectorAll('ul:not(.chord-progression)')].find(ul => !ul.closest('details'));
    return {
        heading: panel.querySelector('h2')?.textContent,
        meta: [...(metaList?.querySelectorAll('li') ?? [])].map(li => li.textContent),
        chords: [...panel.querySelectorAll('ul.progression-list li')].map(li => li.textContent),
        tempo: panel.querySelector('input[type="number"]')?.value ?? null,
        announcement: panel.querySelector('[aria-live]')?.textContent ?? ''
    };
});
const clickInPanel = label => page.evaluate(text => {
    const panel = document.querySelector('#item-panels > section:not([hidden])');
    [...panel.querySelectorAll('button')].find(b => b.textContent === text).click();
}, label);

function readAlphaTex(text) {
    const importer = new alphaTab.importer.AlphaTexImporter();
    importer.initFromString(text, new alphaTab.Settings());
    return readSongFromScore(importer.readScore(), { library });
}

try {
    console.log('=== A generated progression ===');
    await menu('chord-practice');
    await page.waitForTimeout(1500);
    await page.selectOption('#chord-practice-key-select', 'C|major');
    await page.fill('#chord-practice-count-input', '8');
    await page.fill('#chord-practice-tempo-input', '72');
    await page.click('#chord-practice-generate-button');
    await page.waitForTimeout(1500);
    let tab = await activePanel();
    console.log(`  meta: ${tab.meta.join(' | ')}`);
    check('the metadata names its strumming', tab.meta.includes('Strumming - Down Only: D D D D'), tab.meta.join(' | '));
    const generated = tab.chords;

    console.log('\n=== Saving writes alphaTex ===');
    await mkdir(path.join(folder, 'Blues'), { recursive: true });
    const firstSave = path.join(folder, 'Blues', 'Twelve bar.atex');
    await answerSaveDialogWith(firstSave);
    await clickInPanel('Save Progression');
    await page.waitForTimeout(800);
    const offered = await offeredName();
    const filters = await app.evaluate(() => globalThis.__saveDialogFilters);
    check('the Save dialog offers an .atex name', /^C-8-beginner-\w+\.atex$/.test(offered), offered);
    check('and filters on .atex', JSON.stringify(filters) === JSON.stringify([{ name: 'Chord progressions', extensions: ['atex'] }]),
        JSON.stringify(filters));
    const text = await readFile(firstSave, 'utf8');
    console.log(`  file begins: ${text.split('\n').slice(0, 3).join(' / ').slice(0, 140)}`);
    check('the file is alphaTex with the tempo', text.startsWith('\\tempo 72'), text.slice(0, 40));
    const song = readAlphaTex(text);
    const described = song.measures.map((m, i) => describeMeasure(m, i + 1));
    check('alphaTab reads it as 8 plain measures', song.measures.length === 8 && song.measures.every(m => m.form === 'plain'),
        described.join('; '));
    check('with the tab\'s chords in order', song.measures.map(m => describeMeasure(m, 0).replace('Measure 0, ', '')).join(' ') === generated.join(' '),
        `${described.join('; ')} vs ${generated.join(' ')}`);
    check('in C major, 4/4, a downstroke every beat',
        song.key === 'C' && song.mode === 'major' && song.beatsPerBar === 4 && song.pattern?.text === 'D D D D',
        `${song.key} ${song.mode} ${song.beatsPerBar}/${song.beatUnit} ${song.pattern?.text}`);
    tab = await activePanel();
    check('the tab says where it was saved', tab.meta.includes('Saved as - Twelve bar'), tab.meta.join(' | '));
    const fileButtons = await page.evaluate(() => [...document.querySelector('#item-panels > section:not([hidden]) ul.progression-list')
        .nextElementSibling.querySelectorAll('button')].map(b => b.textContent));
    check('after the progression: Edit, Save and Save As, and no Copy to Clipboard',
        fileButtons.join('|') === 'Edit Progression|Save Progression|Save Progression As', fileButtons.join(', '));

    console.log('\n=== Files to open ===');
    // A song with a pattern, and three that chord practice cannot show.
    await writeFile(path.join(folder, 'Strum.atex'), [
        '\\tempo 96',
        '\\ts (4 4) \\ks gmajor',
        '(3.6 2.5 0.4 0.3 0.2 3.1).4 {sd ch "G"} (3.6 2.5 0.4 0.3 0.2 3.1).8 {sd} (3.6 2.5 0.4 0.3 0.2 3.1).8 {su} (-.6 -.5 -.4 -.3 -.2 -.1).8 (3.6 2.5 0.4 0.3 0.2 3.1).8 {su} (3.6 2.5 0.4 0.3 0.2 3.1).8 {sd} (3.6 2.5 0.4 0.3 0.2 3.1).8 {su} |',
        '(3.5 2.4 0.3 1.2 0.1).4 {sd ch "C"} (3.5 2.4 0.3 1.2 0.1).8 {sd} (3.5 2.4 0.3 1.2 0.1).8 {su} (-.5 -.4 -.3 -.2 -.1).8 (3.5 2.4 0.3 1.2 0.1).8 {su} (3.5 2.4 0.3 1.2 0.1).8 {sd} (3.5 2.4 0.3 1.2 0.1).8 {su} |'
    ].join('\n'), 'utf8');
    await writeFile(path.join(folder, 'Melody.atex'), '\\tempo 90\n\\ts (4 4) 3.6.4 2.5.4 0.4.4 0.3.4 |\n', 'utf8');
    await writeFile(path.join(folder, 'Two chords.atex'),
        '\\tempo 90\n\\ts (4 4) (3.6 2.5 0.4 0.3 0.2 3.1).2 {sd ch "G"} (3.5 2.4 0.3 1.2 0.1).2 {sd ch "C"} |\n', 'utf8');
    await writeFile(path.join(folder, 'Broken.atex'), '\\tempo 90\n\\ts (4 4) (3.6 2.5 0.4.4 |\n', 'utf8');

    await menu('open-progression');
    await page.waitForTimeout(1200);
    const tree = await page.evaluate(() => ({
        top: [...document.getElementById('progression-open-tree').children].map(item => item.getAttribute('aria-labelledby')
            ? document.getElementById(item.getAttribute('aria-labelledby')).textContent : item.textContent),
        skipped: [...document.querySelectorAll('#progression-open-skipped-list li')].map(li => li.textContent)
    }));
    console.log(`  listed: ${tree.top.join(' | ')}`);
    for (const line of tree.skipped) console.log(`  skipped: ${line}`);
    check('the folder and the song are listed', tree.top.join('|') === 'Blues|Strum', tree.top.join(', '));
    check('a melody is refused as written out', tree.skipped.some(s => /^Melody\.atex - measure 1 is written out/.test(s)), tree.skipped.join(' ; '));
    check('two chords in a measure is refused for now', tree.skipped.some(s => /^Two chords\.atex - measure 1 has more than one chord/.test(s)), tree.skipped.join(' ; '));
    check('broken alphaTex says where', tree.skipped.some(s => /^Broken\.atex - it could not be read at line 2, column \d+/.test(s)), tree.skipped.join(' ; '));

    console.log('\n=== Opening an alphaTex song with a pattern ===');
    await page.evaluate(() => [...document.querySelectorAll('#progression-open-tree [role="treeitem"]')]
        .find(item => item.textContent === 'Strum').focus());
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1200);
    tab = await activePanel();
    console.log(`  meta: ${tab.meta.join(' | ')}`);
    check('its chords', tab.chords.join(' ') === 'G C', tab.chords.join(' '));
    check('its strumming pattern, by name', tab.meta.includes('Strumming - Old Faithful: D - D U - U D U'), tab.meta.join(' | '));
    check('its tempo', tab.tempo === '96', String(tab.tempo));
    check('its key', tab.meta.includes('Key - G major'), tab.meta.join(' | '));

    console.log('\n=== Playing it ===');
    const before = consoleErrors.length;
    await clickInPanel('Play');
    await page.waitForTimeout(4000);
    const playing = await page.evaluate(() => document.querySelector('#item-panels > section:not([hidden]) button[aria-pressed]')?.getAttribute('aria-pressed'));
    await clickInPanel('Pause');
    await page.waitForTimeout(300);
    check('it plays without errors', playing === 'true' && consoleErrors.length === before, consoleErrors.slice(before).join(' ; '));

    console.log('\n=== Saving it again keeps the pattern ===');
    const strumPath = path.join(folder, 'Strum.atex');
    const callsBefore = await saveDialogCalls();
    await clickInPanel('Save Progression');
    await page.waitForTimeout(800);
    const resaved = readAlphaTex(await readFile(strumPath, 'utf8'));
    check('no Save dialog for a file it opened', (await saveDialogCalls()) === callsBefore);
    check('the pattern and tempo survive', resaved.pattern?.text === 'D - D U - U D U' && resaved.tempo === 96 &&
        resaved.measures.every(m => m.form === 'plain'), `${resaved.pattern?.text} at ${resaved.tempo}`);

    console.log('\n=== Trying another pattern while it plays ===');
    const playbackPattern = () => page.evaluate(() => {
        const panel = document.querySelector('#item-panels > section:not([hidden])');
        const select = [...panel.querySelectorAll('select')].find(s => s.id.startsWith('chord-practice-tab-pattern'));
        return {
            label: panel.querySelector(`label[for="${select?.id}"]`)?.textContent,
            chosen: select?.selectedOptions[0]?.textContent,
            id: select?.id,
            playing: panel.querySelector('button[aria-pressed]')?.getAttribute('aria-pressed'),
            heading: panel.querySelector('h2').textContent,
            item: document.querySelector('#open-items-list button[aria-current="true"]')?.textContent
        };
    });
    let playback = await playbackPattern();
    check('Playback has a labelled pattern list', playback.label === 'Strumming pattern', playback.label);
    check('it starts on the progression\'s pattern', playback.chosen === 'Old Faithful: D - D U - U D U', playback.chosen);
    const errorsBefore = consoleErrors.length;
    await clickInPanel('Play');
    await page.waitForTimeout(2500);
    await page.selectOption(`#${playback.id}`, { label: 'All Down-Up: D U D U D U D U' });
    await page.waitForTimeout(2500);
    playback = await playbackPattern();
    tab = await activePanel();
    check('changing it keeps playing', playback.playing === 'true', playback.playing);
    check('the Metadata line follows', tab.meta.includes('Strumming - All Down-Up: D U D U D U D U'), tab.meta.join(' | '));
    check('it is not an unsaved change', !/unsaved/.test(playback.heading) && !/unsaved/.test(playback.item),
        `${playback.heading} / ${playback.item}`);
    check('no errors while changing it', consoleErrors.length === errorsBefore, consoleErrors.slice(errorsBefore).join(' ; '));
    await clickInPanel('Pause');
    await page.waitForTimeout(300);
    const savesBefore = await saveDialogCalls();
    await clickInPanel('Save Progression');
    await page.waitForTimeout(800);
    const triedPattern = readAlphaTex(await readFile(strumPath, 'utf8'));
    check('saving writes the pattern being played, without asking where', triedPattern.pattern?.text === 'D U D U D U D U' &&
        (await saveDialogCalls()) === savesBefore, triedPattern.pattern?.text);
    // Back to Old Faithful for the checks that follow.
    await page.selectOption(`#${playback.id}`, { label: 'Old Faithful: D - D U - U D U' });

    console.log('\n=== Editing keeps the pattern ===');
    await clickInPanel('Edit Progression');
    await page.waitForTimeout(800);
    const hasTextSection = await page.evaluate(() =>
        document.querySelectorAll('#progression-editor-dialog textarea').length);
    check('the editor has no progression text section', hasTextSection === 0, String(hasTextSection));
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.fill('#progression-editor-chord-input', 'Am');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    await page.click('#progression-editor-apply-button');
    await page.waitForTimeout(1000);
    tab = await activePanel();
    check('the changed chord is in, and the pattern stays', tab.chords.join(' ') === 'G Am' &&
        tab.meta.includes('Strumming - Old Faithful: D - D U - U D U'), `${tab.chords.join(' ')} | ${tab.meta.join(' | ')}`);

    console.log('\n=== Choosing a pattern in the editor ===');
    await clickInPanel('Edit Progression');
    await page.waitForTimeout(800);
    const editorPatterns = await page.evaluate(() => {
        const select = document.getElementById('progression-editor-pattern-select');
        return {
            labelled: document.querySelector('label[for="progression-editor-pattern-select"]')?.textContent,
            options: [...select.options].map(o => o.textContent),
            chosen: select.selectedOptions[0]?.textContent
        };
    });
    console.log(`  options: ${editorPatterns.options.join(' | ')}`);
    check('the editor has a labelled Strumming pattern list', editorPatterns.labelled === 'Strumming pattern', editorPatterns.labelled);
    check('it starts on the progression\'s own pattern', editorPatterns.chosen === 'Old Faithful: D - D U - U D U', editorPatterns.chosen);
    await page.selectOption('#progression-editor-pattern-select', { label: 'Boom-Chicka: D - D U D - D U' });
    await page.click('#progression-editor-apply-button');
    await page.waitForTimeout(1000);
    tab = await activePanel();
    check('applied, the progression strums the new pattern', tab.meta.includes('Strumming - Boom-Chicka: D - D U D - D U'),
        tab.meta.join(' | '));

    console.log('\n=== Choosing a pattern when generating ===');
    await menu('chord-practice');
    await page.waitForTimeout(1200);
    const fourFour = await page.evaluate(() => [...document.getElementById('chord-practice-pattern-select').options].map(o => o.textContent));
    console.log(`  4/4: ${fourFour.join(' | ')}`);
    check('4/4 offers its patterns, Down Only first and chosen', fourFour[0] === 'Down Only: D D D D' &&
        fourFour.includes('Old Faithful: D - D U - U D U') && fourFour.length === 8, fourFour.join(' | '));
    await page.fill('#chord-practice-beats-input', '3');
    await page.dispatchEvent('#chord-practice-beats-input', 'change');
    const threeFour = await page.evaluate(() => [...document.getElementById('chord-practice-pattern-select').options].map(o => o.textContent));
    console.log(`  3/4: ${threeFour.join(' | ')}`);
    check('changing the time signature to 3/4 offers 3/4 patterns', threeFour.includes('Waltz Strum: D - D U D U') &&
        !threeFour.some(t => t.startsWith('Old Faithful')), threeFour.join(' | '));
    await page.selectOption('#chord-practice-pattern-select', { label: 'Waltz Strum: D - D U D U' });
    await page.click('#chord-practice-generate-button');
    await page.waitForTimeout(1500);
    tab = await activePanel();
    check('the generated progression strums the chosen pattern', tab.meta.includes('Strumming - Waltz Strum: D - D U D U') &&
        tab.meta.includes('Time signature - 3/4'), tab.meta.join(' | '));
    const waltzPath = path.join(folder, 'Generated waltz.atex');
    await answerSaveDialogWith(waltzPath);
    await clickInPanel('Save Progression');
    await page.waitForTimeout(800);
    const waltz = readAlphaTex(await readFile(waltzPath, 'utf8'));
    check('and saves it', waltz.pattern?.text === 'D - D U D U' && waltz.beatsPerBar === 3, `${waltz.pattern?.text}`);

    check('no errors in the console', consoleErrors.length === 0, consoleErrors.join(' ; '));
} finally {
    console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
    // The last edit is unsaved; close ends the app without waiting on the question it would ask.
    await close();
}
process.exit(failures === 0 ? 0 : 1);

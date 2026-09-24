// Verifies saving, opening, editing and creating chord progressions, against the real app.
//
// Runs on a scratch profile (UNSTRUNG_TEST_PROFILE), so nothing is written to the real Documents
// folder or the real settings. The system Save dialog cannot be driven from here, so it is replaced
// in the main process with one that answers a chosen path; everything after it is the real code.
//
// Asserts on structure, names, focus and file contents -- never on anything visual.

import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const APP_DIR = `${import.meta.dirname}/../..`.replace(/\\/g, '/');
const { _electron } = await import(`file:///${APP_DIR}/node_modules/playwright-core/index.mjs`);

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};

const profile = await mkdtemp(path.join(tmpdir(), 'unstrung-progressions-'));
const folder = path.join(profile, 'Documents', 'Unstrung', 'Progressions');

const app = await _electron.launch({
    args: ['.'], cwd: APP_DIR, env: { ...process.env, UNSTRUNG_TEST_PROFILE: profile }
});
const page = await app.firstWindow();
await page.waitForLoadState('domcontentloaded');

const send = channel => app.evaluate(({ BrowserWindow }, name) =>
    BrowserWindow.getAllWindows()[0].webContents.send(name), channel);

// The Save dialog answers with whatever path is queued here, and counts how often it was asked.
const answerSaveDialogWith = target => app.evaluate(({ dialog }, filePath) => {
    globalThis.__saveDialogCalls = globalThis.__saveDialogCalls ?? 0;
    dialog.showSaveDialog = async (_window, options) => {
        globalThis.__saveDialogCalls++;
        globalThis.__saveDialogOffered = options?.defaultPath ?? null;
        return filePath ? { canceled: false, filePath } : { canceled: true };
    };
}, target);
const saveDialogCalls = () => app.evaluate(() => globalThis.__saveDialogCalls ?? 0);
// The file name the Save dialog was last offered, without its folder.
const offeredName = async () => path.basename(await app.evaluate(() => globalThis.__saveDialogOffered ?? ''));

const activePanel = () => page.evaluate(() => {
    const panel = [...document.querySelectorAll('[role="tabpanel"]')].find(p => !p.hidden);
    if (!panel) return null;
    const meta = [...[...panel.querySelectorAll('ul:not(.chord-progression)')]
        .find(ul => !ul.closest('details')).querySelectorAll('li')].map(li => li.textContent);
    const progressionList = panel.querySelector('ul.progression-list');
    return {
        heading: panel.querySelector('h2').textContent,
        tabName: [...document.querySelectorAll('#tablist [role="tab"]')]
            .find(t => t.getAttribute('aria-selected') === 'true')?.textContent,
        windowTitle: document.title,
        meta,
        chords: [...progressionList.querySelectorAll('li')].map(li => li.textContent),
        afterList: [...(progressionList.nextElementSibling?.querySelectorAll('button') ?? [])].map(b => ({
            text: b.textContent, shortcut: b.getAttribute('aria-keyshortcuts')
        })),
        announcement: panel.querySelector('[aria-live]').textContent,
        focused: document.activeElement?.textContent ?? '',
        tabCount: document.querySelectorAll('#tablist [role="tab"]').length
    };
});

// A measure option, without the note a chord outside the key carries.
const bare = text => String(text ?? '').replace(', outside the key', '');

const clickInPanel = label => page.evaluate(text => {
    const panel = [...document.querySelectorAll('[role="tabpanel"]')].find(p => !p.hidden);
    [...panel.querySelectorAll('button')].find(b => b.textContent === text).click();
}, label);

try {
    console.log('=== Settings, General: the progressions folder ===');
    await send('settings:open');
    await page.waitForTimeout(800);
    const settings = await page.evaluate(() => ({
        value: document.getElementById('settings-progressions-directory-input').value,
        labelled: Boolean(document.querySelector('label[for="settings-progressions-directory-input"]')),
        hint: document.getElementById('settings-progressions-directory-hint').textContent,
        inGeneral: Boolean(document.querySelector(
            '#settings-panel-general #settings-progressions-directory-input'))
    }));
    console.log(`  field: ${settings.value}`);
    console.log(`  hint : ${settings.hint}`);
    check('the field is on the General tab, and labelled', settings.inGeneral && settings.labelled);
    check('it defaults to Documents/Unstrung/Progressions', settings.value === folder, settings.value);
    check('the hint names the default', settings.hint === `Default: ${folder}`, settings.hint);

    await page.fill('#settings-progressions-directory-input', path.join(profile, 'no such folder'));
    await page.evaluate(() => document.getElementById('settings-progressions-directory-input')
        .dispatchEvent(new Event('change')));
    await page.waitForTimeout(500);
    const refused = await page.evaluate(() => ({
        errorOpen: document.getElementById('directory-error-dialog').open,
        message: document.getElementById('directory-error-message').textContent
    }));
    check('a folder that does not exist is refused', refused.errorOpen, refused.message);
    await page.click('#directory-error-ok-button');
    await page.waitForTimeout(300);
    const focusBack = await page.evaluate(() => document.activeElement?.id);
    check('focus goes back to the progressions field', focusBack === 'settings-progressions-directory-input',
        focusBack);

    await page.click('#settings-progressions-default-button');
    await page.waitForTimeout(400);
    const reset = await page.evaluate(() => ({
        value: document.getElementById('settings-progressions-directory-input').value,
        status: document.getElementById('settings-general-status').textContent
    }));
    check('Use Default Folder puts the default back', reset.value === folder, reset.value);
    console.log(`  status: ${reset.status}`);
    await page.click('#settings-ok-button');
    await page.waitForTimeout(300);

    console.log('\n=== The chord practice dialog offers saved and hand-made progressions ===');
    await send('chord-practice:open');
    await page.waitForTimeout(1500);
    const practiceButtons = await page.evaluate(() =>
        [...document.querySelectorAll('#chord-practice-dialog button')].map(b => b.textContent));
    check('Open Saved Progression is offered',
        practiceButtons.includes('Open Saved Progression…'), practiceButtons.join(', '));
    check('Create Progression by Hand is offered',
        practiceButtons.includes('Create Progression by Hand…'), practiceButtons.join(', '));

    console.log('\n=== A generated progression can be saved ===');
    await page.selectOption('#chord-practice-key-select', 'C|major');
    await page.fill('#chord-practice-count-input', '8');
    await page.click('#chord-practice-generate-button');
    await page.waitForTimeout(1500);
    let tab = await activePanel();
    console.log(`  heading: ${tab.heading}`);
    console.log(`  after the progression list: ${tab.afterList.map(b => b.text).join(', ')}`);
    check('Edit, Save and Save As come straight after the progression list',
        tab.afterList.map(b => b.text).join('|') === 'Edit Progression|Save Progression|Save Progression As',
        tab.afterList.map(b => b.text).join(', '));
    check('Save and Save As name their shortcuts',
        tab.afterList[1]?.shortcut === 'Control+S' && tab.afterList[2]?.shortcut === 'Control+Shift+S');
    check('a generated progression is not marked as having unsaved changes',
        !/unsaved/.test(tab.heading) && !/unsaved/.test(tab.tabName), `${tab.heading} / ${tab.tabName}`);
    check('the metadata says it is not saved', tab.meta.includes('Not saved'), tab.meta.join(' | '));
    check('there is no Made line', !tab.meta.some(m => m.startsWith('Made')), tab.meta.join(' | '));
    const generatedChords = tab.chords;
    // A generated progression may already borrow a chord, which stays outside the key once edited.
    const borrowedLine = tab.meta.find(m => m.startsWith('Chords from outside the key'));
    const generatedOutside = Number(/, (\d+) used$/.exec(borrowedLine)?.[1] ?? 0);

    await mkdir(path.join(folder, 'Blues'), { recursive: true });
    const firstSave = path.join(folder, 'Blues', 'Twelve bar.json');
    await answerSaveDialogWith(firstSave);
    await clickInPanel('Save Progression');
    await page.waitForTimeout(800);
    tab = await activePanel();
    const saved = JSON.parse(await readFile(firstSave, 'utf8'));
    console.log(`  file: ${JSON.stringify(saved).slice(0, 160)}…`);
    const offered = await offeredName();
    console.log(`  the Save dialog offered: ${offered}`);
    check('the Save dialog offers key, measures, level and borrowing as the name',
        offered === 'C-8-beginner-occasional.json', offered);
    check('the file holds the chords in order',
        saved.chords.length === 8 && saved.chords.every(c => c.root && c.suffix));
    check('the file says it was generated, and at which level',
        saved.origin?.made === 'generated' && typeof saved.origin.levelId === 'string',
        JSON.stringify(saved.origin));
    check('the file carries no seed and no tempo',
        !('seed' in saved) && !('tempo' in saved) && !JSON.stringify(saved).includes('seed'));
    check('the time signature is saved', saved.timeSignature?.beatsPerBar === 4 && saved.timeSignature?.beatUnit === 4);
    console.log(`  tab now: ${tab.tabName} | ${tab.heading} | ${tab.announcement}`);
    check('the tab is named after the file', tab.tabName === 'Practice - Twelve bar', tab.tabName);
    check('the heading is named after the file', tab.heading === 'Chord practice - Twelve bar', tab.heading);
    check('the window title follows', tab.windowTitle === 'Unstrung - Practice - Twelve bar', tab.windowTitle);
    check('the metadata says where it was saved', tab.meta.includes('Saved as - Twelve bar'), tab.meta.join(' | '));
    check('saving is announced', tab.announcement === 'Saved as Twelve bar.', tab.announcement);

    console.log('\n=== Editing: the measure list and the chord field ===');
    await clickInPanel('Edit Progression');
    await page.waitForTimeout(800);
    const editorOpen = await page.evaluate(() => {
        const dialog = document.getElementById('progression-editor-dialog');
        const list = document.getElementById('progression-editor-measures');
        const controls = [...dialog.querySelectorAll('select, input')];
        return {
            open: dialog.open,
            heading: document.getElementById('progression-editor-heading').textContent,
            options: [...list.querySelectorAll('[role="option"]')].map(o => o.textContent),
            focusedRole: document.activeElement?.getAttribute('role'),
            focusedText: document.activeElement?.textContent,
            selected: list.querySelector('[aria-selected="true"]')?.textContent,
            listName: list.getAttribute('aria-labelledby'),
            key: document.getElementById('progression-editor-key-select').value,
            chordLabel: document.getElementById('progression-editor-chord-label').textContent,
            chordValue: document.getElementById('progression-editor-chord-input').value,
            unlabelled: controls.filter(el => !document.querySelector(`label[for="${el.id}"]`)).map(el => el.id)
        };
    });
    console.log(`  measures: ${editorOpen.options.join(' | ')}`);
    check('the editor opens titled Edit Progression', editorOpen.open && editorOpen.heading === 'Edit Progression');
    check('one option per measure, named by its chord',
        editorOpen.options.map(o => o.replace(', outside the key', '')).join(' ') === generatedChords.join(' '),
        editorOpen.options.join(' | '));
    check('focus starts on the first measure', editorOpen.focusedRole === 'option' &&
        bare(editorOpen.focusedText) === generatedChords[0], `${editorOpen.focusedRole}: ${editorOpen.focusedText}`);
    check('the key is the progression\'s', editorOpen.key === 'C|major', editorOpen.key);
    check('the chord field names its measure and what it holds, and starts empty',
        editorOpen.chordLabel === `Chord for measure 1, now ${generatedChords[0]}` && editorOpen.chordValue === '',
        `${editorOpen.chordLabel}: "${editorOpen.chordValue}"`);
    check('every field is labelled', editorOpen.unlabelled.length === 0, editorOpen.unlabelled.join(', '));

    const layout = await page.evaluate(() => {
        const list = document.getElementById('progression-editor-measures');
        const notes = list.previousElementSibling;
        const field = document.getElementById('progression-editor-chord-input');
        const row = field.closest('.field-row');
        return {
            describedBy: list.getAttribute('aria-describedby'),
            notesSummary: notes?.tagName === 'DETAILS' ? notes.querySelector('summary').textContent : null,
            notesOpen: notes?.open,
            afterHeading: notes?.previousElementSibling?.id === 'progression-editor-measures-heading',
            rowHolds: row ? [...row.children].map(c => c.tagName === 'DETAILS'
                ? c.querySelector('summary').textContent : c.textContent.trim()) : []
        };
    });
    check('the measures list carries no description to repeat on every visit', layout.describedBy === null,
        String(layout.describedBy));
    check('its keyboard commands are a collapsed disclosure between the heading and the list',
        layout.afterHeading &&
        layout.notesSummary === 'Keyboard commands for the measures list' && layout.notesOpen === false,
        String(layout.notesSummary));
    check('the chord field and How the chord field works share one row',
        layout.rowHolds.length === 2 && layout.rowHolds[1] === 'How the chord field works',
        layout.rowHolds.join(' | '));

    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(150);
    const second = await page.evaluate(() => ({
        focused: document.activeElement?.textContent,
        chordLabel: document.getElementById('progression-editor-chord-label').textContent
    }));
    check('Down moves to the next measure and the chord field follows',
        bare(second.focused) === generatedChords[1] &&
        second.chordLabel === `Chord for measure 2, now ${generatedChords[1].replace(', outside the key', '')}`,
        `${second.focused} / ${second.chordLabel}`);

    // Enter goes to the chord field, which is empty; Down lists the key's own chords.
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    const arrived = await page.evaluate(() => document.getElementById('progression-editor-chord-input').value);
    check('the chord field is empty on arriving', arrived === '', `"${arrived}"`);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);
    const keyChords = await page.evaluate(() => ({
        focusedId: document.activeElement?.id,
        expanded: document.getElementById('progression-editor-chord-input').getAttribute('aria-expanded'),
        active: document.getElementById('progression-editor-chord-input').getAttribute('aria-activedescendant'),
        options: [...document.querySelectorAll('#progression-editor-suggestions [role="option"]')]
            .map(o => o.textContent)
    }));
    console.log(`  with the field empty: ${keyChords.options.join(' | ')}`);
    check('Enter in the measure list moves to the chord field', keyChords.focusedId === 'progression-editor-chord-input');
    check('an empty field offers the key\'s chords with their degrees as numbers',
        keyChords.options[0] === 'C, degree 1' && keyChords.options.includes('G, degree 5'),
        keyChords.options.join(', '));
    check('the list is expanded and the first one highlighted',
        keyChords.expanded === 'true' && keyChords.active === 'progression-editor-suggestion-0');
    await page.keyboard.press('Escape');

    await page.fill('#progression-editor-chord-input', 'Hmaj');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    const nonsense = await page.evaluate(() => ({
        option: document.querySelector('#progression-editor-measures [aria-selected="true"]').textContent,
        focusedId: document.activeElement?.id,
        status: document.getElementById('progression-editor-status').textContent
    }));
    check('a name that is not a chord is refused, the measure keeps its chord, and focus stays to fix it',
        bare(nonsense.option) === generatedChords[1] && nonsense.focusedId === 'progression-editor-chord-input' &&
        /no chord named Hmaj/.test(nonsense.status), `${nonsense.focusedId}: ${nonsense.status}`);

    // Anything can be typed, and a chord outside the key is marked but allowed.
    // Typing must not open the list: NVDA announces the field becoming expanded, and that
    // announcement replaced the echo of the first character typed.
    await page.fill('#progression-editor-chord-input', '');
    await page.keyboard.type('B');
    await page.waitForTimeout(150);
    const afterFirstKey = await page.evaluate(() => ({
        value: document.getElementById('progression-editor-chord-input').value,
        expanded: document.getElementById('progression-editor-chord-input').getAttribute('aria-expanded'),
        listHidden: document.getElementById('progression-editor-suggestions').hidden
    }));
    check('typing a character does not open the list or change the expanded state',
        afterFirstKey.value === 'B' && afterFirstKey.expanded === 'false' && afterFirstKey.listHidden,
        JSON.stringify(afterFirstKey));
    await page.keyboard.type('b');
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);
    const typed = await page.evaluate(() =>
        [...document.querySelectorAll('#progression-editor-suggestions [role="option"]')].map(o => o.textContent));
    const downState = await page.evaluate(() => ({
        expanded: document.getElementById('progression-editor-chord-input').getAttribute('aria-expanded'),
        active: document.getElementById('progression-editor-chord-input').getAttribute('aria-activedescendant')
    }));
    check('Down then opens the list, filtered by what was typed, first one highlighted',
        downState.expanded === 'true' && downState.active === 'progression-editor-suggestion-0' &&
        typed.every(label => label.startsWith('Bb')), `${downState.expanded} / ${typed.slice(0, 3).join(', ')}`);

    // Typing more with the list open updates it without changing the expanded state, even when
    // nothing matches.
    await page.keyboard.type('zz');
    await page.waitForTimeout(150);
    const noMatch = await page.evaluate(() => ({
        expanded: document.getElementById('progression-editor-chord-input').getAttribute('aria-expanded'),
        options: [...document.querySelectorAll('#progression-editor-suggestions [role="option"]')]
            .map(o => `${o.textContent}${o.getAttribute('aria-disabled') === 'true' ? ' (disabled)' : ''}`)
    }));
    check('an open list stays open and says nothing matches',
        noMatch.expanded === 'true' && noMatch.options.join('|') === 'No chords match (disabled)',
        JSON.stringify(noMatch));
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(150);
    console.log(`  typing Bb: ${typed.slice(0, 5).join(' | ')}`);
    check('a chord outside the key says so', typed[0] === 'Bb, outside the key', typed[0]);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    const afterBb = await page.evaluate(() => ({
        option: document.querySelector('#progression-editor-measures [aria-selected="true"]').textContent,
        focusedId: document.activeElement?.id,
        label: document.getElementById('progression-editor-chord-label').textContent,
        value: document.getElementById('progression-editor-chord-input').value
    }));
    check('Enter takes the typed chord for the measure', afterBb.option === 'Bb, outside the key', afterBb.option);
    check('and puts focus back on that measure in the list', afterBb.focusedId === 'progression-editor-measure-1',
        afterBb.focusedId);
    check('the field is empty again and its label names the new chord',
        afterBb.value === '' && afterBb.label === 'Chord for measure 2, now Bb', `${afterBb.label}: "${afterBb.value}"`);

    // Enter on an empty field goes back to the list and changes nothing.
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    const unchanged = await page.evaluate(() => ({
        option: document.querySelector('#progression-editor-measures [aria-selected="true"]').textContent,
        focusedId: document.activeElement?.id
    }));
    check('Enter with the field empty returns to the measure and leaves its chord',
        unchanged.option === 'Bb, outside the key' && unchanged.focusedId === 'progression-editor-measure-1',
        `${unchanged.focusedId}: ${unchanged.option}`);

    // Move, insert, duplicate, remove.
    await page.keyboard.press('Alt+ArrowUp');
    await page.waitForTimeout(150);
    const moved = await page.evaluate(() => ({
        options: [...document.querySelectorAll('#progression-editor-measures [role="option"]')].map(o => o.textContent),
        focused: document.activeElement?.id,
        status: document.getElementById('progression-editor-status').textContent
    }));
    check('Alt+Up moves the measure up and focus goes with it',
        moved.options[0] === 'Bb, outside the key' && moved.focused === 'progression-editor-measure-0',
        `${moved.options.slice(0, 2).join(' | ')} / ${moved.focused}`);
    check('the move is announced', moved.status === 'Moved Bb to measure 1.', moved.status);
    await page.waitForTimeout(4500);
    const cleared = await page.evaluate(() => document.getElementById('progression-editor-status').textContent);
    check('the announcement empties itself, so reading the dialog later does not meet it',
        cleared === '', cleared);

    await page.keyboard.press('Control+d');
    await page.waitForTimeout(150);
    await page.keyboard.press('Control+i');
    await page.waitForTimeout(150);
    const inserted = await page.evaluate(() => ({
        options: [...document.querySelectorAll('#progression-editor-measures [role="option"]')].map(o => o.textContent),
        focused: document.activeElement?.textContent
    }));
    console.log(`  after duplicate and insert: ${inserted.options.join(' | ')}`);
    check('Control+D duplicates and Control+I inserts an empty measure after it',
        inserted.options.length === 10 && inserted.options[1] === 'Bb, outside the key' &&
        inserted.options[2] === 'no chord' && inserted.focused === 'no chord', inserted.options.join(', '));

    await page.click('#progression-editor-apply-button');
    await page.waitForTimeout(300);
    const blocked = await page.evaluate(() => ({
        open: document.getElementById('progression-editor-dialog').open,
        focused: document.activeElement?.id,
        status: document.getElementById('progression-editor-status').textContent
    }));
    check('Apply with an empty measure is refused, with focus on that measure',
        blocked.open && blocked.focused === 'progression-editor-measure-2' && /Measure 3 has no chord/.test(blocked.status),
        `${blocked.focused}: ${blocked.status}`);

    await page.keyboard.press('Delete');
    await page.waitForTimeout(150);
    const removed = await page.evaluate(() =>
        document.querySelectorAll('#progression-editor-measures [role="option"]').length);
    check('Delete removes the measure', removed === 9, `${removed}`);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const escaped = await page.evaluate(() => ({
        open: document.getElementById('progression-editor-dialog').open,
        status: document.getElementById('progression-editor-status').textContent
    }));
    check('Escape with changes made does not throw them away', escaped.open, escaped.status);

    await page.click('#progression-editor-apply-button');
    await page.waitForTimeout(800);
    tab = await activePanel();
    console.log(`  applied: ${tab.heading} | ${tab.tabName}`);
    console.log(`  chords : ${tab.chords.join(' ')}`);
    console.log(`  meta   : ${tab.meta.join(' | ')}`);
    check('the same tab now holds the edited progression',
        tab.chords.length === 9 && tab.chords[0] === 'Bb' && tab.chords[1] === 'Bb' && tab.tabCount === 1,
        tab.chords.join(' '));
    check('the heading and tab say there are unsaved changes',
        tab.heading === 'Chord practice - Twelve bar (unsaved changes)' &&
        tab.tabName === 'Practice - Twelve bar (unsaved changes)', `${tab.heading} / ${tab.tabName}`);
    check('the metadata counts the chords outside the key, with no Made line',
        !tab.meta.some(m => m.startsWith('Made')) &&
        tab.meta.includes(`Chords from outside the key - ${2 + generatedOutside}`), tab.meta.join(' | '));
    check('focus is back on Edit Progression', tab.focused === 'Edit Progression', tab.focused);
    const bbRow = await page.evaluate(() => {
        const panel = [...document.querySelectorAll('[role="tabpanel"]')].find(p => !p.hidden);
        const details = [...panel.querySelectorAll('ul.chords-used > li > details')]
            .find(d => d.querySelector('summary').textContent === 'Bb');
        return details ? [...details.querySelectorAll('li')].map(li => li.textContent) : [];
    });
    check('the chord row says it is from outside the key',
        bbRow.includes('From outside the key of C major'), bbRow.join(' | '));

    console.log('\n=== Control+S saves over the file without asking where ===');
    const callsBefore = await saveDialogCalls();
    await page.evaluate(() => [...document.querySelectorAll('[role="tabpanel"]')].find(p => !p.hidden).focus());
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(800);
    tab = await activePanel();
    const resaved = JSON.parse(await readFile(firstSave, 'utf8'));
    check('no Save dialog was shown', (await saveDialogCalls()) === callsBefore);
    check('the file now holds the edited chords', resaved.chords.length === 9 && resaved.chords[0].root === 'Bb');
    check('the file says it was edited', resaved.origin.made === 'edited', resaved.origin.made);
    check('the unsaved marker is gone', !/unsaved/.test(tab.heading) && !/unsaved/.test(tab.tabName), tab.tabName);

    console.log('\n=== Open Saved Progression: the tree ===');
    // Two files that cannot open, and one more good one, at the top level.
    await writeFile(path.join(folder, 'Broken.json'), '{ not json', 'utf8');
    await writeFile(path.join(folder, 'Unknown chord.json'), JSON.stringify({
        format: 1, key: 'C', mode: 'major', timeSignature: { beatsPerBar: 4, beatUnit: 4 },
        chords: [{ root: 'C', suffix: 'major' }, { root: 'H', suffix: 'major' }], origin: { made: 'hand' }
    }), 'utf8');
    await writeFile(path.join(folder, 'Waltz.json'), JSON.stringify({
        format: 1, key: 'G', mode: 'major', timeSignature: { beatsPerBar: 3, beatUnit: 4 },
        chords: [{ root: 'G', suffix: 'major' }, { root: 'D', suffix: '7' }, { root: 'G', suffix: 'major' }],
        origin: { made: 'hand' }
    }), 'utf8');
    await mkdir(path.join(folder, 'Empty'), { recursive: true });

    await send('progressions:open-dialog');
    await page.waitForTimeout(1000);
    const tree = await page.evaluate(() => {
        const root = document.getElementById('progression-open-tree');
        const top = [...root.children].map(item => ({
            role: item.getAttribute('role'),
            expanded: item.getAttribute('aria-expanded'),
            kind: item.dataset.kind,
            name: item.getAttribute('aria-labelledby')
                ? document.getElementById(item.getAttribute('aria-labelledby')).textContent
                : item.textContent
        }));
        return {
            open: document.getElementById('progression-open-dialog').open,
            role: root.getAttribute('role'),
            label: root.getAttribute('aria-label'),
            folderText: document.getElementById('progression-open-folder').textContent,
            top,
            focused: document.getElementById(document.activeElement?.getAttribute('aria-labelledby'))?.textContent
                ?? document.activeElement?.textContent,
            skippedHidden: document.getElementById('progression-open-skipped').hidden,
            skippedSummary: document.getElementById('progression-open-skipped-summary').textContent,
            skipped: [...document.querySelectorAll('#progression-open-skipped-list li')].map(li => li.textContent)
        };
    });
    console.log(`  ${tree.folderText}`);
    console.log(`  top level: ${tree.top.map(t => `${t.name}${t.expanded ? ` [${t.expanded}]` : ''}`).join(' | ')}`);
    console.log(`  ${tree.skippedSummary} ${tree.skipped.join(' ; ')}`);
    check('the dialog shows a labelled tree', tree.open && tree.role === 'tree' && tree.label === 'Saved progressions');
    check('folders come first, then progressions',
        tree.top.map(t => t.name).join('|') === 'Blues|Empty (empty)|Waltz', tree.top.map(t => t.name).join(', '));
    check('a folder starts collapsed', tree.top[0].expanded === 'false');
    check('an empty folder has no expanded state', tree.top[1].expanded === null);
    check('focus starts on the first item', tree.focused === 'Blues', tree.focused);
    check('files that cannot open are listed with the reason',
        !tree.skippedHidden && tree.skipped.length === 2 &&
        tree.skipped.some(s => s === 'Broken.json - not valid JSON') &&
        tree.skipped.some(s => /Unknown chord\.json - .*H in measure 2 is not in the chord library/.test(s)),
        tree.skipped.join(' ; '));

    const treeFocus = () => page.evaluate(() => ({
        text: document.activeElement?.getAttribute('aria-labelledby')
            ? document.getElementById(document.activeElement.getAttribute('aria-labelledby')).textContent
            : document.activeElement?.textContent,
        expanded: document.activeElement?.getAttribute('aria-expanded')
    }));
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);
    const expanded = await treeFocus();
    check('Right opens a folder and stays on it', expanded.text === 'Blues' && expanded.expanded === 'true',
        JSON.stringify(expanded));
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);
    check('Down then reaches the progression inside it', (await treeFocus()).text === 'Twelve bar');
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(100);
    check('Left from inside goes back to the folder', (await treeFocus()).text === 'Blues');
    await page.keyboard.press('w');
    await page.waitForTimeout(100);
    check('typing a letter moves to the next item starting with it', (await treeFocus()).text === 'Waltz');

    await page.keyboard.press('Enter');
    await page.waitForTimeout(1200);
    tab = await activePanel();
    console.log(`  opened: ${tab.tabName} | ${tab.meta.join(' | ')}`);
    check('Enter opens the progression in a new tab, named after the file',
        tab.tabName === 'Practice - Waltz' && tab.tabCount === 2, `${tab.tabName}, ${tab.tabCount} tabs`);
    check('its time signature comes from the file', tab.meta.includes('Time signature - 3/4'), tab.meta.join(' | '));
    check('nothing is outside the key, and it says where it was saved',
        tab.meta.includes('Saved as - Waltz') && tab.meta.includes('Chords from outside the key - none'),
        tab.meta.join(' | '));
    check('the chords are the file\'s', tab.chords.join(' ') === 'G D7 G', tab.chords.join(' '));
    const beatsInState = await page.evaluate(() => {
        const panel = [...document.querySelectorAll('[role="tabpanel"]')].find(p => !p.hidden);
        return panel.querySelector('[aria-live]') !== null;
    });
    check('the tab has its live region', beatsInState);

    // The same file again goes to the tab it is already in.
    await send('progressions:open-dialog');
    await page.waitForTimeout(1000);
    const remembered = await treeFocus();
    check('the tree reopens on the progression last opened', remembered.text === 'Waltz', remembered.text);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);
    tab = await activePanel();
    const status = await page.evaluate(() => document.getElementById('status').textContent);
    check('opening it again shows the tab it is already in', tab.tabCount === 2 && tab.tabName === 'Practice - Waltz',
        `${tab.tabCount} tabs`);
    check('and says so', status === 'Waltz is already open.', status);

    console.log('\n=== The chord practice dialog hands over to Open Saved Progression ===');
    await send('chord-practice:open');
    await page.waitForTimeout(1200);
    await page.click('#chord-practice-open-saved-button');
    await page.waitForTimeout(1000);
    const handOff = await page.evaluate(() => ({
        practiceOpen: document.getElementById('chord-practice-dialog').open,
        openOpen: document.getElementById('progression-open-dialog').open,
        focusInTree: document.getElementById('progression-open-tree').contains(document.activeElement)
    }));
    check('the practice dialog closes and the tree opens with focus in it',
        !handOff.practiceOpen && handOff.openOpen && handOff.focusInTree, JSON.stringify(handOff));
    await page.click('#progression-open-cancel-button');
    await page.waitForTimeout(300);

    console.log('\n=== Creating a progression by hand ===');
    await send('progressions:new');
    await page.waitForTimeout(800);
    const fresh = await page.evaluate(() => ({
        heading: document.getElementById('progression-editor-heading').textContent,
        apply: document.getElementById('progression-editor-apply-button').textContent,
        focused: document.activeElement?.id,
        options: [...document.querySelectorAll('#progression-editor-measures [role="option"]')].map(o => o.textContent)
    }));
    check('the same editor opens, titled for creating',
        fresh.heading === 'Create Progression by Hand' && fresh.apply === 'Create Progression', fresh.heading);
    check('focus starts on the key', fresh.focused === 'progression-editor-key-select', fresh.focused);
    check('it starts with one empty measure', fresh.options.join('|') === 'no chord', fresh.options.join(', '));

    await page.selectOption('#progression-editor-key-select', 'A|minor');
    await page.focus('#progression-editor-chord-input');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    const picked = await page.evaluate(() => ({
        focusedId: document.activeElement?.id,
        option: document.activeElement?.textContent
    }));
    check('a chord chosen with the arrows also goes back to the measure',
        picked.focusedId === 'progression-editor-measure-0' && picked.option === 'Am', JSON.stringify(picked));
    await page.click('#progression-editor-duplicate-button');
    await page.click('#progression-editor-insert-button');
    await page.fill('#progression-editor-chord-input', 'E7');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    const built = await page.evaluate(() =>
        [...document.querySelectorAll('#progression-editor-measures [role="option"]')].map(o => o.textContent));
    console.log(`  measures: ${built.join(' | ')}`);
    check('the buttons build it up', built.join('|') === 'Am|Am|E7', built.join(', '));
    await page.click('#progression-editor-apply-button');
    await page.waitForTimeout(1000);
    tab = await activePanel();
    console.log(`  created: ${tab.tabName} | ${tab.meta.join(' | ')}`);
    check('it opens in a new tab with unsaved changes',
        tab.tabCount === 3 && tab.tabName === 'Practice - A minor (unsaved changes)', tab.tabName);
    check('E7 counts as in A minor, which plays its fifth chord major',
        tab.meta.includes('Chords from outside the key - none'), tab.meta.join(' | '));

    // Cancelled, so the tab keeps its unsaved changes for the checks that follow.
    await answerSaveDialogWith(null);
    await clickInPanel('Save Progression');
    await page.waitForTimeout(600);
    const handName = await offeredName();
    tab = await activePanel();
    check('a hand-made progression is offered key, measures and "hand"', handName === 'Am-3-hand.json', handName);
    check('cancelling the Save dialog says so and saves nothing',
        tab.announcement === 'Not saved.' && /unsaved/.test(tab.tabName), `${tab.announcement} / ${tab.tabName}`);

    console.log('\n=== Closing a tab with unsaved changes asks first ===');
    await send('tabs:close-current');
    await page.waitForTimeout(500);
    const asked = await page.evaluate(() => ({
        open: document.getElementById('unsaved-dialog').open,
        message: document.getElementById('unsaved-dialog-message').textContent,
        describedBy: document.getElementById('unsaved-dialog').getAttribute('aria-describedby'),
        buttons: [...document.querySelectorAll('#unsaved-dialog button')].map(b => b.textContent)
    }));
    console.log(`  ${asked.message}`);
    check('the question is asked, naming the tab',
        asked.open && asked.message === 'Practice - A minor has unsaved changes. Save them before closing the tab?',
        asked.message);
    check('it offers Save, Don\'t Save and Cancel', asked.buttons.join('|') === "Save|Don't Save|Cancel");
    await page.click('#unsaved-dialog-cancel-button');
    await page.waitForTimeout(400);
    tab = await activePanel();
    check('Cancel keeps the tab', tab.tabCount === 3 && /A minor/.test(tab.tabName), tab.tabName);

    console.log('\n=== Quitting with unsaved changes asks too ===');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
    await page.waitForTimeout(800);
    const quitAsked = await page.evaluate(() => ({
        open: document.getElementById('unsaved-dialog').open,
        message: document.getElementById('unsaved-dialog-message').textContent
    }));
    check('the window does not close without asking', quitAsked.open, quitAsked.message);
    check('the question is about quitting', /before quitting\?$/.test(quitAsked.message), quitAsked.message);
    await page.click('#unsaved-dialog-cancel-button');
    await page.waitForTimeout(400);
    const stillOpen = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
    check('Cancel keeps the app open', stillOpen === 1);

    // Don't Save closes the tab, which leaves nothing unsaved and lets the app close normally.
    await send('tabs:close-current');
    await page.waitForTimeout(400);
    await page.click('#unsaved-dialog-discard-button');
    await page.waitForTimeout(400);
    tab = await activePanel();
    check('Don\'t Save closes the tab', tab.tabCount === 2, `${tab.tabCount} tabs`);

    const files = await readdir(folder, { recursive: true });
    console.log(`  files in the progressions folder: ${files.join(', ')}`);
} finally {
    console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
    await app.close();
    await rm(profile, { recursive: true, force: true });
}
process.exit(failures === 0 ? 0 : 1);

// Verifies the Strumming Patterns item in the real app: the list of built-in and own patterns,
// making, copying, editing and deleting patterns of your own, what is refused and why, exporting
// and importing them as text, and your own patterns reaching the Chord Practice dialog.
//
// Runs on a scratch profile. The system Save and Open dialogs are replaced in the main process
// with ones that answer a chosen path. Asserts on text, structure, focus and file contents, never
// on anything visual.
//
//   node scripts/songs/verify-strumming-patterns.mjs

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { launchApp, runMenuCommand } from '../lib/app-ui.mjs';

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};

const { app, page, profile, close } = await launchApp();
const consoleErrors = [];
page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('pageerror', error => consoleErrors.push(error.message));

const answerDialogsWith = ({ save = null, open = null }) => app.evaluate(({ dialog }, paths) => {
    dialog.showSaveDialog = async () => (paths.save ? { canceled: false, filePath: paths.save } : { canceled: true });
    dialog.showOpenDialog = async () => (paths.open ? { canceled: false, filePaths: [paths.open] } : { canceled: true, filePaths: [] });
}, { save, open });

// The item's two lists: time signatures, then that time signature's patterns.
const item = () => page.evaluate(() => {
    const panel = document.querySelector('#item-panels > section:not([hidden])');
    const [signatures, list] = panel.querySelectorAll('select');
    const live = panel.querySelector('[aria-live]');
    return {
        heading: panel.querySelector('h2')?.textContent,
        headings: [...panel.querySelectorAll('h3')].map(h => h.textContent),
        label: panel.querySelector(`label[for="${list.id}"]`)?.textContent,
        signatureLabel: panel.querySelector(`label[for="${signatures.id}"]`)?.textContent,
        groups: [...signatures.options].map(o => o.textContent),
        signature: signatures.value,
        options: [...list.options].map(o => o.textContent),
        chosen: list.selectedOptions[0]?.textContent,
        about: list.closest('p').nextElementSibling.textContent,
        buttons: [...panel.querySelectorAll('button')].map(b => b.textContent),
        status: live?.textContent ?? '',
        notes: [...(live?.nextElementSibling?.querySelectorAll('li') ?? [])].map(li => li.textContent),
        focused: document.activeElement?.tagName,
        focusedOn: document.activeElement === signatures ? 'time signature' : document.activeElement === list ? 'pattern' : document.activeElement?.tagName
    };
});
// Every pattern in every time signature, by going through the time signature list.
const allOptions = () => page.evaluate(() => {
    const [signatures, list] = document.querySelector('#item-panels > section:not([hidden])').querySelectorAll('select');
    const was = signatures.value;
    const all = [];
    for (const option of [...signatures.options]) {
        signatures.value = option.value;
        signatures.dispatchEvent(new Event('change'));
        all.push(...[...list.options].map(o => o.textContent));
    }
    signatures.value = was;
    signatures.dispatchEvent(new Event('change'));
    return all;
});
const choose = (signature, label) => page.evaluate(({ signature, text }) => {
    const [signatures, list] = document.querySelector('#item-panels > section:not([hidden])').querySelectorAll('select');
    signatures.value = signature;
    signatures.dispatchEvent(new Event('change'));
    const option = [...list.options].find(o => o.textContent === text);
    if (!option) throw new Error(`No option "${text}" in ${signature}`);
    list.value = option.value;
    list.dispatchEvent(new Event('change'));
}, { signature, text: label });
const press = label => page.evaluate(text => {
    const panel = document.querySelector('#item-panels > section:not([hidden])');
    [...panel.querySelectorAll('button')].find(b => b.textContent === text).click();
}, label);
const dialogState = () => page.evaluate(() => ({
    open: document.getElementById('pattern-dialog').open,
    heading: document.getElementById('pattern-dialog-heading').textContent,
    name: document.getElementById('pattern-name-input').value,
    strokes: document.getElementById('pattern-strokes-input').value,
    readback: document.getElementById('pattern-readback').textContent,
    describedBy: document.getElementById('pattern-strokes-input').getAttribute('aria-describedby'),
    status: document.getElementById('pattern-status').textContent,
    focused: document.activeElement?.id
}));
const typeStrokes = async text => {
    await page.fill('#pattern-strokes-input', text);
    await page.dispatchEvent('#pattern-strokes-input', 'input');
};
const ownInSettings = async () => JSON.parse(await readFile(path.join(profile, 'userData', 'app-state.json'), 'utf8')).strummingPatterns;
const wait = ms => page.waitForTimeout(ms);

try {
    console.log('=== The item ===');
    await runMenuCommand(page, 'strumming-patterns');
    await wait(1200);
    let state = await item();
    console.log(`  groups: ${state.groups.join(', ')}; ${state.options.length} patterns`);
    console.log(`  about: ${state.about}`);
    check('it opens as Strumming Patterns, with a Time signature list then a Pattern list', state.heading === 'Strumming Patterns' &&
        state.signatureLabel === 'Time signature' && state.label === 'Pattern', `${state.signatureLabel} / ${state.label}`);
    check('the time signatures', state.groups.join('|') === '4/4|3/4|6/8|2/4|12/8', state.groups.join('|'));
    check('focus is on the time signature, 4/4, with Down Only chosen', state.focusedOn === 'time signature' && state.signature === '4/4' &&
        state.chosen === 'Down Only: D D D D' && state.options.length === 8, `${state.focusedOn}, ${state.signature}, ${state.chosen}`);
    await choose('3/4', 'Down Only: D D D');
    state = await item();
    check('choosing 3/4 lists only its patterns', state.options.length === 5 && state.options.includes('Waltz Strum: D - D U D U'), state.options.join(' | '));
    check('it says what the chosen pattern is, in words', state.about === 'A downstroke on each beat. In words: 1 down, 2 down, 3 down.', state.about);
    check('the buttons', state.buttons.join('|') ===
        'Play|New Pattern|Copy to My Patterns|Edit|Delete|Export My Patterns|Import Patterns', state.buttons.join('|'));

    console.log('\n=== Built-in patterns stay as they are ===');
    await choose('4/4', 'Old Faithful: D - D U - U D U');
    await press('Edit');
    await wait(300);
    state = await item();
    check('Edit says how to change one', state.status === 'Old Faithful is built in. Copy to My Patterns makes one you can change.', state.status);
    await press('Delete');
    await wait(300);
    state = await item();
    check('Delete says it stays', state.status === 'Old Faithful is built in, and stays.' && state.options.includes('Old Faithful: D - D U - U D U'), state.status);

    console.log('\n=== A new pattern ===');
    await press('New Pattern');
    await wait(400);
    let dialog = await dialogState();
    check('the dialog opens for a new pattern, on its name', dialog.open && dialog.heading === 'New Strumming Pattern Dialog Box' &&
        dialog.focused === 'pattern-name-input', `${dialog.heading}, focus ${dialog.focused}`);
    check('the strokes field is described by the read-back', dialog.describedBy === 'pattern-readback');
    await page.fill('#pattern-name-input', 'Busy Folk');
    await typeStrokes('d - d u');
    dialog = await dialogState();
    check('too few strokes are explained under the field', /^Not yet a pattern: The pattern has 4 slots/.test(dialog.readback) === false &&
        /^Not yet a pattern:/.test(dialog.readback) || dialog.readback.startsWith('In words'), dialog.readback);
    await typeStrokes('d - d u d u d u');
    dialog = await dialogState();
    console.log(`  read-back: ${dialog.readback}`);
    check('the strokes are read back in words', dialog.readback === 'In words: 1 down, and miss, 2 down, and up, 3 down, and up, 4 down, and up.', dialog.readback);

    await page.fill('#pattern-name-input', 'old faithful');
    await page.click('#pattern-save-button');
    await wait(300);
    dialog = await dialogState();
    check('a built-in name is refused, with focus on the name', dialog.open && /already the name of a built-in pattern/.test(dialog.status) &&
        dialog.focused === 'pattern-name-input', `${dialog.status} / ${dialog.focused}`);
    await page.fill('#pattern-name-input', 'Busy Folk');
    await typeStrokes('D U D');
    await page.click('#pattern-save-button');
    await wait(300);
    dialog = await dialogState();
    check('strokes that do not fill the measure are refused, with focus on them', dialog.open && /needs 4, 8, 16/.test(dialog.status) &&
        dialog.focused === 'pattern-strokes-input', `${dialog.status} / ${dialog.focused}`);
    await typeStrokes('d - d u d u d u');
    await page.click('#pattern-save-button');
    await wait(600);
    dialog = await dialogState();
    state = await item();
    check('saved, the dialog closes and the list is on the new pattern', !dialog.open && state.chosen === 'Busy Folk: D - D U D U D U, yours' &&
        state.focused === 'SELECT', state.chosen);
    check('and says so', state.status === 'Saved Busy Folk.', state.status);
    check('it is kept in settings, tidied', JSON.stringify(await ownInSettings()) ===
        JSON.stringify([{ name: 'Busy Folk', timeSignature: '4/4', text: 'D - D U D U D U' }]), JSON.stringify(await ownInSettings()));
    check('one of yours says so', state.about.startsWith('One of yours. In words:'), state.about);

    console.log('\n=== Copying a built-in pattern ===');
    await choose('3/4', 'Waltz Strum: D - D U D U');
    await press('Copy to My Patterns');
    await wait(400);
    dialog = await dialogState();
    check('the copy starts with its name and strokes', dialog.name === 'Waltz Strum (copy)' && dialog.strokes === 'D - D U D U', `${dialog.name}: ${dialog.strokes}`);
    await page.fill('#pattern-name-input', 'Lilting Waltz');
    await typeStrokes('>D - D U D U');
    await page.click('#pattern-save-button');
    await wait(600);
    state = await item();
    check('the copy is listed under 3/4', state.chosen === 'Lilting Waltz: >D - D U D U, yours', state.chosen);

    console.log('\n=== Editing and deleting your own ===');
    await choose('4/4', 'Busy Folk: D - D U D U D U, yours');
    await press('Edit');
    await wait(400);
    dialog = await dialogState();
    check('Edit opens it, titled for editing', dialog.heading === 'Edit Strumming Pattern Dialog Box' && dialog.name === 'Busy Folk', dialog.heading);
    await page.fill('#pattern-name-input', 'Busier Folk');
    await page.click('#pattern-save-button');
    await wait(600);
    state = await item();
    check('renamed in place, not added', state.chosen === 'Busier Folk: D - D U D U D U, yours' &&
        !state.options.some(o => o.startsWith('Busy Folk:')), state.options.filter(o => o.endsWith('yours')).join(' | '));
    await press('Delete');
    await wait(600);
    state = await item();
    check('Delete removes it and says so', state.status === 'Deleted Busier Folk.' && !state.options.some(o => o.startsWith('Busier Folk')), state.status);
    check('settings keep only the waltz', JSON.stringify((await ownInSettings()).map(p => p.name)) === '["Lilting Waltz"]');

    console.log('\n=== Export and import ===');
    const exported = path.join(profile, 'my patterns.txt');
    await answerDialogsWith({ save: exported });
    await press('Export My Patterns');
    await wait(600);
    state = await item();
    const exportedText = await readFile(exported, 'utf8');
    console.log(`  file:\n${exportedText.trimEnd().split('\n').map(line => `    ${line}`).join('\n')}`);
    check('export writes one line a pattern, after a note', exportedText.split('\n')[1] === '3/4, Lilting Waltz: >D - D U D U', exportedText);
    check('and says where', state.status === 'Exported 1 pattern as my patterns.txt.', state.status);

    const toImport = path.join(profile, 'from a friend.txt');
    await writeFile(toImport, [
        '# From a friend',
        '4/4, Island Shuffle: D - D U D U - U',
        '3/4, Lilting Waltz: >D - D U D U',
        '3/4, Lilting Waltz: D U - U D U',
        '4/4, Broken: D U',
        'not a pattern at all'
    ].join('\n'), 'utf8');
    await answerDialogsWith({ open: toImport });
    await press('Import Patterns');
    await wait(800);
    state = await item();
    console.log(`  ${state.status}`);
    for (const note of state.notes) console.log(`    ${note}`);
    check('import says what it did', state.status ===
        'Imported 2 patterns from from a friend.txt. 1 was already here. 3 lines need a note, listed next.', state.status);
    check('each note names its line', state.notes.join(' | ') === [
        'Line 4: kept as Lilting Waltz (imported), since Lilting Waltz is already a pattern with other strokes.',
        'Line 5: the pattern has 2 slots; a measure of 4 beats needs 4, 8, 16.',
        'Line 6: it is not written as time signature, name, colon, strokes.'
    ].join(' | '), state.notes.join(' | '));
    const everything = await allOptions();
    check('the imported patterns are listed', everything.includes('Island Shuffle: D - D U D U - U, yours') &&
        everything.includes('Lilting Waltz (imported): D U - U D U, yours'), everything.filter(o => o.endsWith('yours')).join(' | '));

    // Somewhere other than the first pattern of the first time signature, so coming back to it is
    // a claim that can fail.
    await choose('3/4', 'Lilting Waltz (imported): D U - U D U, yours');
    state = await item();
    const chosenBeforeLeaving = `${state.signature}, ${state.chosen}`;

    console.log('\n=== Your own patterns reach the Chord Practice dialog ===');
    await runMenuCommand(page, 'chord-practice');
    await wait(1200);
    const practice = await page.evaluate(() => [...document.getElementById('chord-practice-pattern-select').options].map(o => o.textContent));
    check('4/4 lists Island Shuffle after the built-in patterns', practice.at(-1) === 'Island Shuffle: D - D U D U - U', practice.join(' | '));
    await page.selectOption('#chord-practice-pattern-select', { label: 'Island Shuffle: D - D U D U - U' });
    await page.click('#chord-practice-generate-button');
    await wait(1500);
    const meta = await page.evaluate(() => {
        const panel = document.querySelector('#item-panels > section:not([hidden])');
        return [...[...panel.querySelectorAll('ul:not(.chord-progression)')].find(ul => !ul.closest('details')).querySelectorAll('li')].map(li => li.textContent);
    });
    check('a progression strumming it names it', meta.includes('Strumming - Island Shuffle: D - D U D U - U'), meta.join(' | '));

    console.log('\n=== Play ===');
    await runMenuCommand(page, 'strumming-patterns');
    await wait(600);
    state = await item();
    check('coming back, the lists are where they were left', `${state.signature}, ${state.chosen}` === chosenBeforeLeaving,
        `${state.signature}, ${state.chosen} vs ${chosenBeforeLeaving}`);
    await choose('4/4', 'Island Shuffle: D - D U D U - U, yours');
    // Counts every sound started, strums and clicks, to tell a loop that carries on from one that
    // stops after its first time round.
    await page.evaluate(() => {
        window.__started = 0;
        const realStart = AudioBufferSourceNode.prototype.start;
        AudioBufferSourceNode.prototype.start = function (...args) {
            window.__started++;
            return realStart.apply(this, args);
        };
    });
    const started = () => page.evaluate(() => window.__started);
    const playButtonState = () => page.evaluate(() => {
        const button = [...document.querySelector('#item-panels > section:not([hidden])').querySelectorAll('button')]
            .find(b => b.getAttribute('aria-pressed') !== null);
        return { label: button?.textContent, pressed: button?.getAttribute('aria-pressed') };
    });
    // And every level a strum's notes are set to, to hear the downbeat's lift in numbers.
    await page.evaluate(() => {
        window.__levels = [];
        const realSet = AudioParam.prototype.setValueAtTime;
        AudioParam.prototype.setValueAtTime = function (value, time) {
            if (value > 0.1) window.__levels.push(Math.round(value * 1000) / 1000);
            return realSet.call(this, value, time);
        };
    });
    const errorsBefore = consoleErrors.length;
    let play = await playButtonState();
    check('Play is a toggle button, not pressed', play.label === 'Play' && play.pressed === 'false', JSON.stringify(play));
    await press('Play');
    await wait(3000);
    state = await item();
    play = await playButtonState();
    check('pressed, it reads Pause and says what it plays', play.label === 'Pause' && play.pressed === 'true' &&
        state.status === 'Playing Island Shuffle.', `${JSON.stringify(play)} ${state.status}`);
    // Island Shuffle has no accents: downstrokes at the note level, the one on beat 1 a little
    // above it, upstrokes a little below.
    const levels = [...new Set(await page.evaluate(() => window.__levels))].sort((a, b) => a - b);
    console.log(`  strum levels: ${levels.join(', ')}`);
    check('a pattern without accents leans a little on beat 1', levels.join(',') === '0.44,0.55,0.616', levels.join(','));
    // G, C, D and F, two measures each of 4/4 at 60, is 32 seconds a time round.
    const afterFirstRound = await started();
    await wait(32000);
    const intoSecondRound = await started();
    play = await playButtonState();
    // A whole time round is laid out at once, so the second doubles the count.
    console.log(`  sounds laid out: ${afterFirstRound} in the first 3 seconds, ${intoSecondRound} after 35`);
    check('it goes round again, still playing', play.label === 'Pause' && intoSecondRound >= afterFirstRound * 2,
        `${afterFirstRound} then ${intoSecondRound}`);
    await choose('4/4', 'Old Faithful: D - D U - U D U');
    await wait(1500);
    play = await playButtonState();
    check('choosing another pattern while it plays keeps playing', play.label === 'Pause', JSON.stringify(play));
    await press('Pause');
    await wait(500);
    play = await playButtonState();
    const atPause = await started();
    await wait(4000);
    check('Pause stops it, and the button reads Play again', play.label === 'Play' && play.pressed === 'false' &&
        (await started()) === atPause, `${JSON.stringify(play)}, ${atPause} then ${await started()}`);

    console.log('\n=== Play in the dialog ===');
    await press('New Pattern');
    await wait(400);
    await typeStrokes('D - D U - U - U');
    await page.click('#pattern-play-button');
    await wait(1500);
    const dialogPlay = await page.evaluate(() => {
        const button = document.getElementById('pattern-play-button');
        return { label: button.textContent, pressed: button.getAttribute('aria-pressed') };
    });
    check('the dialog\'s Play is the same toggle', dialogPlay.label === 'Pause' && dialogPlay.pressed === 'true', JSON.stringify(dialogPlay));
    await page.click('#pattern-cancel-button');
    await wait(300);
    const atClose = await started();
    await wait(3000);
    const dialogAfter = await page.evaluate(() => document.getElementById('pattern-play-button').textContent);
    check('closing the dialog stops it', (await started()) === atClose && dialogAfter === 'Play', `${atClose} then ${await started()}, ${dialogAfter}`);

    console.log('\n=== The menu ===');
    const placement = await page.evaluate(() => document.getElementById('menu-strumming-patterns').closest('ul').id);
    check('Strumming Patterns is at the top level of the menu', placement === 'app-menu-list', placement);
    check('no errors while playing', consoleErrors.length === errorsBefore, consoleErrors.slice(errorsBefore).join(' ; '));

    check('no errors in the console', consoleErrors.length === 0, consoleErrors.join(' ; '));
} finally {
    console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
    await close();
}
process.exit(failures === 0 ? 0 : 1);

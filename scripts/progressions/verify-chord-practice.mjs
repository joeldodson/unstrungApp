// Verifies the Chord Practice dialog and the tab it opens, against the real app.
//
// Asserts on structure, labelling and scheduling rather than on anything visual: that every key
// offered is one the level can actually play, that each chord is a collapsed region with only its
// name as the summary, that a chord with no fingering says so inside, and that the spoken name of
// a chord is scheduled on the last beat of the bar before it.

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

await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.send('chord-practice:open'));
await page.waitForTimeout(3000);

console.log('=== The dialog ===');
const dialog = await page.evaluate(() => {
    const element = document.getElementById('chord-practice-dialog');
    const controls = [...element.querySelectorAll('select, input, button')];
    return {
        open: element.open,
        focusInside: element.contains(document.activeElement),
        levels: [...document.getElementById('chord-practice-level-select').options].map(o => o.value),
        keys: [...document.getElementById('chord-practice-key-select').options].map(o => o.textContent),
        levelDescription: document.getElementById('chord-practice-level-description').textContent,
        speechNote: document.getElementById('chord-practice-speech-note').textContent,
        speakDisabled: document.getElementById('chord-practice-speak-checkbox').disabled,
        unlabelled: controls.filter(el => el.tagName === 'BUTTON'
            ? !el.textContent.trim()
            : !document.querySelector(`label[for="${el.id}"]`) && !el.getAttribute('aria-label')
        ).map(el => el.id || el.tagName)
    };
});
check('dialog is open and focused', dialog.open && dialog.focusInside);
check('three levels offered', dialog.levels.length === 3, dialog.levels.join(', '));
check('every control is labelled', dialog.unlabelled.length === 0, dialog.unlabelled.join(', '));
check('the level describes itself', dialog.levelDescription.length > 20);
console.log(`  speech: ${dialog.speakDisabled ? 'disabled' : 'available'} -- ${dialog.speechNote}`);

console.log(`\n  beginner keys (${dialog.keys.length}): ${dialog.keys.join(', ')}`);
check('beginner offers fewer than all 24 key and mode pairs', dialog.keys.length < 24,
    `${dialog.keys.length}`);
check('C major is offered at beginner level', dialog.keys.includes('C major'));
check('C# major is not offered at beginner level', !dialog.keys.includes('C# major'));

await page.selectOption('#chord-practice-level-select', 'advanced');
await page.waitForTimeout(500);
const advancedKeys = await page.evaluate(() =>
    [...document.getElementById('chord-practice-key-select').options].map(o => o.textContent));
check('advanced offers every key and mode', advancedKeys.length === 24, `${advancedKeys.length}`);
await page.selectOption('#chord-practice-level-select', 'beginner');
await page.waitForTimeout(300);

console.log('\n=== Borrowing is offered and reaches the tab ===');
const borrowing = await page.evaluate(() =>
    [...document.getElementById('chord-practice-borrowing-select').options]
        .map(o => ({ value: o.value, selected: o.selected })));
console.log(`  tiers: ${borrowing.map(b => b.value).join(', ')}`);
check('three borrowing tiers offered', borrowing.length === 3, borrowing.map(b => b.value).join(','));
check('occasional is the default', borrowing.find(b => b.selected)?.value === 'occasional',
    borrowing.find(b => b.selected)?.value);

// Advanced in C major with frequent borrowing, long enough that something is very likely to fire.
await page.selectOption('#chord-practice-level-select', 'advanced');
await page.waitForTimeout(400);
await page.selectOption('#chord-practice-key-select', 'C|major');
await page.selectOption('#chord-practice-borrowing-select', 'frequent');
await page.fill('#chord-practice-count-input', '16');
await page.fill('#chord-practice-seed-input', '');
await page.click('#chord-practice-generate-button');
await page.waitForTimeout(1500);

const borrowedTab = await page.evaluate(() => {
    const panel = [...document.querySelectorAll('[role="tabpanel"]')].find(p => !p.hidden);
    const meta = [...[...panel.querySelectorAll('ul:not(.chord-progression)')]
        .find(ul => !ul.closest('details')).querySelectorAll('li')].map(li => li.textContent);
    const rows = [...panel.querySelectorAll('ul.chords-used > li > details')].map(d => ({
        name: d.querySelector('summary').textContent,
        rows: [...d.querySelectorAll('li')].map(li => li.textContent)
    }));
    return { meta, rows };
});
const borrowedRows = borrowedTab.rows.filter(r => r.rows.some(x => x.startsWith('From outside the key')));
console.log(`  ${borrowedTab.meta.find(m => m.startsWith('Chords from outside the key'))}`);
console.log(`  chords: ${borrowedTab.rows.map(r => r.name).join('  ')}`);
check('the metadata names the borrowing setting',
    borrowedTab.meta.some(m => /Chords from outside the key - Frequent/.test(m)),
    borrowedTab.meta.find(m => m.startsWith('Chords from outside')));
check('at least one chord came from outside the key', borrowedRows.length > 0,
    `${borrowedRows.length}`);
if (borrowedRows.length > 0) {
    const first = borrowedRows[0];
    console.log(`  ${first.name}: ${first.rows.find(x => x.startsWith('From outside the key'))}`);
    check('a borrowed chord explains itself inside, not on its name',
        !/outside|borrow/i.test(first.name), first.name);
    const pointer = first.rows.find(x => x.startsWith('Points at'));
    if (pointer) console.log(`  ${pointer}`);
}

// Generating closed the dialog, so the sections below have to open it again before they can set
// anything. Everything after this point expects beginner, C major and no borrowing.
await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.send('chord-practice:open'));
await page.waitForTimeout(1200);
await page.selectOption('#chord-practice-borrowing-select', 'none');
await page.selectOption('#chord-practice-level-select', 'beginner');
await page.waitForTimeout(400);

console.log('\n=== Generating opens a tab ===');
await page.selectOption('#chord-practice-key-select', 'C|major');
await page.fill('#chord-practice-beats-input', '4');
    await page.fill('#chord-practice-beat-unit-input', '4');
await page.fill('#chord-practice-tempo-input', '70');
await page.fill('#chord-practice-count-input', '8');
await page.setChecked('#chord-practice-speak-checkbox', true).catch(() => {});
await page.click('#chord-practice-generate-button');
await page.waitForTimeout(1500);

const tab = await page.evaluate(() => {
    const panel = [...document.querySelectorAll('[role="tabpanel"]')].find(p => !p.hidden);
    if (!panel) return null;
    // Only the chord rows, which are the one list carrying that class.
    const details = [...panel.querySelectorAll('ul.chords-used > li > details')];
    return {
        dialogClosed: !document.getElementById('chord-practice-dialog').open,
        tabName: [...document.querySelectorAll('[role="tab"]')]
            .find(t => t.getAttribute('aria-selected') === 'true')?.textContent,
        headings: [...panel.querySelectorAll('h2, h3')].map(h => `${h.tagName}: ${h.textContent}`),
        // The metadata list: the only plain list outside a chord's own disclosure.
        summaryItems: [...[...panel.querySelectorAll('ul:not(.chord-progression)')]
            .find(ul => !ul.closest('details')).querySelectorAll('li')].map(li => li.textContent),
        buttons: [...panel.querySelectorAll('button')].map(b => b.textContent),
        liveRegions: [...panel.querySelectorAll('[aria-live]')].length,
        chordCount: panel.querySelectorAll('ul.progression-list > li').length,
        progressionNames: [...panel.querySelectorAll('ul.progression-list > li')].map(li => li.textContent),
        progressionHasDetails: panel.querySelectorAll('ul.progression-list details').length,
        summaries: details.map(d => d.querySelector('summary').textContent),
        // Collapsed content must stay out of the accessibility tree, which is what keeps the
        // progression readable as a plain list of chord names.
        allCollapsed: details.every(d => !d.open),
        firstDetailRows: [...details[0].querySelectorAll('li')].map(li => li.textContent)
    };
});

check('a tab opened and the dialog closed', tab !== null && tab.dialogClosed);
console.log(`  tab: ${tab.tabName}`);
console.log(`  headings: ${tab.headings.join(' | ')}`);
// The same shape as the audio track panel: a heading per section, keyboard commands last. How many
// distinct chords a seed produces varies, so the counts are matched rather than spelled out.
const headingShape = tab.headings.map(h => h.replace(/\(\d+[^)]*\)/, '(n)')).join(' | ');
check('the sections are laid out in order',
    headingShape ===
    'H2: Chord practice - C major | H3: Metadata | H3: Chords Used (n) | H3: Progression (n) | ' +
    'H3: Playback | H3: Move around the progression | H3: Keyboard control',
    headingShape);
check('keyboard control is the last heading',
    tab.headings[tab.headings.length - 1] === 'H3: Keyboard control');
check('playback has a transport', tab.buttons.includes('Play Progression'), tab.buttons.join(', '));
check('there is a live region for playback state', tab.liveRegions >= 1);

console.log(`  summary: ${tab.summaryItems.join(' | ')}`);
check('the seed is stated so the progression can be regenerated',
    tab.summaryItems.some(row => row.startsWith('Seed - ')));
// Tempo is no longer in the summary: it is adjustable during playback, so it lives in a field
// where it can be changed and read back rather than in text that would go stale.
check('the time signature is stated', tab.summaryItems.some(r => r.includes('4/4')),
    tab.summaryItems.join(' | '));

console.log(`\n  chords used: ${tab.summaries.join('  ')}`);
console.log(`  progression: ${tab.progressionNames.join('  ')}`);
check('the progression lists all eight measures', tab.chordCount === 8, `${tab.chordCount}`);
// The fingerings live once in Chords Used; repeating them per measure would mean reading the same
// shape four times to get through eight measures.
check('the progression is names only, with nothing to expand',
    tab.progressionHasDetails === 0, `${tab.progressionHasDetails} disclosures`);
check('every distinct chord in the progression appears in Chords Used',
    [...new Set(tab.progressionNames)].every(name => tab.summaries.includes(name)),
    `${[...new Set(tab.progressionNames)].join(', ')} against ${tab.summaries.join(', ')}`);
check('Chords Used lists each chord once', tab.summaries.length === new Set(tab.summaries).size,
    tab.summaries.join(', '));
check('every chord is collapsed', tab.allCollapsed);
check('a summary is the chord name and nothing else',
    tab.summaries.every(s => /^[A-G](#|b)?[^\s]*$/.test(s)), tab.summaries.join(', '));
console.log(`  first chord details: ${tab.firstDetailRows.join(' | ')}`);
check('the details carry the fingering or say it is missing',
    tab.firstDetailRows.some(r => r.startsWith('String ')) ||
    tab.firstDetailRows.some(r => r.includes('no fingering configured')));

console.log('\n=== A chord with no fingering says so inside, not on its name ===');
const unfingered = await page.evaluate(() => {
    // Generated at the advanced level, which admits chords the library has no shape for.
    const panel = [...document.querySelectorAll('[role="tabpanel"]')].find(p => !p.hidden);
    return [...panel.querySelectorAll('ul.chords-used > li > details')].map(d => ({
        summary: d.querySelector('summary').textContent,
        rows: [...d.querySelectorAll('li')].map(li => li.textContent)
    }));
});
const missing = unfingered.filter(d => d.rows.some(r => r.includes('no fingering configured')));
console.log(`  chords without a fingering in this progression: ${missing.length}`);
check('no summary mentions a missing fingering',
    unfingered.every(d => !/fingering/i.test(d.summary)),
    unfingered.map(d => d.summary).join(', '));

console.log('\n=== Spoken names land on the last beat of the previous bar ===');
const timing = await page.evaluate(async () => {
    window.__starts = [];
    const realStart = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (when, offset, duration) {
        window.__starts.push({ when, hasDuration: duration !== undefined, channels: this.buffer?.numberOfChannels });
        return realStart.call(this, when, offset, duration);
    };
    return true;
});
check('instrumentation installed', timing === true);

// One button toggles: it reads Play, then Pause once running.
const clickTransport = () => page.evaluate(() => {
    const panel = [...document.querySelectorAll('[role="tabpanel"]')].find(p => !p.hidden);
    [...panel.querySelectorAll('button')].find(b => /^(Play Progression|Pause)$/.test(b.textContent)).click();
});
await clickTransport();
await page.waitForTimeout(9000);
await clickTransport();

const starts = await page.evaluate(() => window.__starts);
// Speech sources are the only ones started with an explicit duration.
const speech = starts.filter(s => s.hasDuration);
const secondsPerBeat = 60 / 70;
console.log(`  buffers scheduled: ${starts.length}, of which spoken names: ${speech.length}`);
check('something was scheduled', starts.length > 0);
if (speech.length >= 2) {
    const gaps = speech.slice(1).map((s, i) => s.when - speech[i].when);
    const expected = 4 * secondsPerBeat;
    console.log(`  gaps between spoken names: ${gaps.map(g => g.toFixed(2)).join(', ')} s ` +
        `(one bar at 70 bpm in 4/4 is ${expected.toFixed(2)} s)`);
    check('spoken names are one bar apart',
        gaps.every(g => Math.abs(g - expected) < 0.05), gaps.map(g => g.toFixed(3)).join(', '));
} else {
    console.log('  (speech unavailable or off; the timing assertion needs it)');
}

console.log('\n=== Transport matches the audio track ===');
const panelState = () => page.evaluate(() => {
    const panel = [...document.querySelectorAll('[role="tabpanel"]')].find(p => !p.hidden);
    const play = [...panel.querySelectorAll('button')].find(b => /^(Play Progression|Pause)$/.test(b.textContent));
    return {
        playLabel: play.textContent,
        pressed: play.getAttribute('aria-pressed'),
        announcement: panel.querySelector('[aria-live]').textContent,
        // Both are number inputs now, so pick them by id rather than by position.
        tempo: panel.querySelector('input[id^="chord-practice-tab-tempo"]').value,
        repeats: panel.querySelector('input[id^="chord-practice-tab-repeat"]').value,
        metronome: panel.querySelector('input[type="checkbox"]').checked
    };
});

const controls = await page.evaluate(() => {
    const panel = [...document.querySelectorAll('[role="tabpanel"]')].find(p => !p.hidden);
    const labelled = [...panel.querySelectorAll('input, select')].every(el =>
        panel.querySelector(`label[for="${el.id}"]`));
    // The key list is the last plain list in the panel, under the Keyboard control heading.
    const lists = [...panel.querySelectorAll('ul:not(.chord-progression)')]
        .filter(ul => !ul.closest('details'));
    const keyRows = [...lists[lists.length - 1].querySelectorAll('li')].map(li => li.textContent);
    const listStyle = getComputedStyle(panel.querySelector('ul.chord-progression')).listStyleType;
    return {
        buttons: [...panel.querySelectorAll('button')].map(b => b.textContent),
        labelled, keyRows, listStyle
    };
});
check('the chord list carries no bullet or number', controls.listStyle === 'none',
    controls.listStyle);
check('the panel has tempo, repeats and metronome, all labelled', controls.labelled);
check('the transport buttons match the audio track',
    controls.buttons.includes('Play Progression') && controls.buttons.includes('Restart'),
    controls.buttons.join(', '));
console.log(`  keyboard commands listed: ${controls.keyRows.length}`);
// Nine rows, one per key, worded as the audio track words them.
check('the audio track keys are documented', controls.keyRows.length === 9,
    `${controls.keyRows.length} rows`);
check('the tempo keys name their step size',
    controls.keyRows.some(r => r === 'S - slower by 5 BPM') &&
    controls.keyRows.some(r => r === 'F - faster by 5 BPM'),
    controls.keyRows.filter(r => /^[SF] /.test(r)).join(' | '));

// Focus the panel itself so the bare keys reach the transport.
await page.evaluate(() => {
    [...document.querySelectorAll('[role="tabpanel"]')].find(p => !p.hidden).focus();
});

const press = async key => {
    await page.keyboard.press(key);
    await page.waitForTimeout(700);
    return panelState();
};

// The speech timing run above left the position partway in, so start from a known bar rather
// than assuming one.
await press('ArrowUp');

const afterB = await press('b');
console.log(`  B  -> ${afterB.announcement}`);
// Which time round is deliberately left out: a progression repeating until stopped has no total
check('B announces the measure, the chord and which play this is',
    /^Measure 1 of 8, [A-G][^,]*, play 1\.$/.test(afterB.announcement), afterB.announcement);

// Moving around is silent, as in the audio track. Where a seek landed is confirmed with B, which
// is the key that exists to ask.
const beforeSeek = (await panelState()).announcement;
const afterRight = await press('ArrowRight');
check('Right says nothing', afterRight.announcement === beforeSeek, afterRight.announcement);
const rightThenB = await press('b');
console.log(`  Right then B -> ${rightThenB.announcement}`);
check('Right moved forward a measure', /^Measure 2 of 8, /.test(rightThenB.announcement),
    rightThenB.announcement);

await press('ArrowLeft');
const leftThenB = await press('b');
check('Left moved back a measure', /^Measure 1 of 8, /.test(leftThenB.announcement),
    leftThenB.announcement);

await press('ArrowDown');
const downThenB = await press('b');
check('Down returns to the start of this measure', /^Measure 1 of 8, /.test(downThenB.announcement),
    downThenB.announcement);

// The one deliberate divergence from the audio track: a measure there can hold anything, so the
// number is all that can be said. Here a measure is exactly one chord, and which chord it is is
// the thing worth knowing.
check('B names the chord as well as the measure, unlike the audio track',
    /^Measure \d+ of \d+, [A-G][^,]*, play \d+\.$/.test(downThenB.announcement), downThenB.announcement);

const afterSlower = await press('s');
console.log(`  S  -> "${afterSlower.announcement}", tempo box now ${afterSlower.tempo}`);
check('S slows the tempo by five', afterSlower.tempo === '65', afterSlower.tempo);
check('the tempo announcement is the value alone, as the audio track does it',
    afterSlower.announcement === '65 BPM', afterSlower.announcement);
const afterFaster = await press('f');
check('F speeds it back up', afterFaster.tempo === '70', afterFaster.tempo);

// Pressing B twice on the same measure has to speak twice. It did not: clearing a live region and
// refilling it in one task is coalesced into a single mutation, so an unchanged string looked like
// no change. It worked while playing, where the answer keeps moving, and went silent when paused.
await page.evaluate(() => {
    const panel = [...document.querySelectorAll('[role="tabpanel"]')].find(p => !p.hidden);
    const region = panel.querySelector('[aria-live]');
    window.__announcements = [];
    new MutationObserver(() => {
        const text = region.textContent;
        if (text) window.__announcements.push(text);
    }).observe(region, { childList: true, characterData: true, subtree: true });
});
await press('b');
await press('b');
await press('b');
const repeated = await page.evaluate(() => window.__announcements);
console.log(`  B pressed three times while paused -> ${repeated.length} announcements`);
check('the same answer is spoken every time it is asked for',
    repeated.length === 3 && new Set(repeated).size === 1,
    `${repeated.length} announcements: ${[...new Set(repeated)].join(' | ')}`);

const afterM = await press('m');
console.log(`  M  -> metronome ${afterM.metronome}, announcement "${afterM.announcement}"`);
check('M toggles the metronome and the checkbox follows', afterM.metronome === false);
// The checkbox carries the state and the clicks stopping is its own answer.
check('M says nothing', !/metronome/i.test(afterM.announcement), afterM.announcement);
await press('m');

console.log('\n=== Space plays and pauses, Up restarts ===');
const afterSpace = await press(' ');
await page.waitForTimeout(2500);
const playing = await panelState();
console.log(`  Space -> button "${playing.playLabel}", ${playing.announcement}`);
check('Space starts playback and the button becomes Pause',
    playing.playLabel === 'Pause' && playing.pressed === 'true',
    `${playing.playLabel} / ${playing.pressed}`);
void afterSpace;

const afterPause = await press(' ');
console.log(`  Space -> button "${afterPause.playLabel}", ${afterPause.announcement}`);
check('Space pauses and says where it stopped',
    afterPause.playLabel === 'Play Progression' && /^Paused at measure \d+\./.test(afterPause.announcement),
    afterPause.announcement);

// Up says nothing, as the audio track's restart says nothing: the count-in is the answer.
const beforeUp = (await panelState()).announcement;
const afterUp = await press('ArrowUp');
console.log(`  Up -> announcement unchanged: "${afterUp.announcement}"`);
check('Up says nothing', afterUp.announcement === beforeUp, afterUp.announcement);
const afterUpB = await press('b');
check('but B still confirms it went back to measure 1',
    /^Measure 1 of 8, /.test(afterUpB.announcement), afterUpB.announcement);

console.log('\n=== Looping ===');
const loopState = await panelState();
console.log(`  repeats field reads "${loopState.repeats}"`);
check('repeats defaults to 0, meaning until stopped', loopState.repeats === '0', loopState.repeats);

// Eight bars of 4/4 at 70 bpm is 27.4 s, too long to wait for a wrap; push the tempo up so a
// whole pass fits inside the check, then confirm playback survives past the end of pass one.
await page.evaluate(() => {
    const panel = [...document.querySelectorAll('[role="tabpanel"]')].find(p => !p.hidden);
    const tempo = panel.querySelector('input[id^="chord-practice-tab-tempo"]');
    tempo.value = '240';
    tempo.dispatchEvent(new Event('change'));
});
await page.waitForTimeout(500);
await page.evaluate(() => {
    [...document.querySelectorAll('[role="tabpanel"]')].find(p => !p.hidden).focus();
});
await page.keyboard.press(' ');
// One pass at 240 bpm is 8 s; wait past it and confirm it is still going.
await page.waitForTimeout(13000);
const looping = await panelState();
console.log(`  after 13 s at 240 bpm: button "${looping.playLabel}", announcement "${looping.announcement}"`);
check('playback is still running past the end of the first pass',
    looping.playLabel === 'Pause', looping.playLabel);
// A live region firing every time round would talk over the music it is counting.
check('nothing is announced on a repeat', !/repeat/i.test(looping.announcement),
    looping.announcement);
const afterLoopB = await press('b');
console.log(`  B while looping -> ${afterLoopB.announcement}`);
check('B says which time round you are on while looping',
    /, play [2-9]\d*\.$/.test(afterLoopB.announcement), afterLoopB.announcement);
await page.keyboard.press(' ');
await page.waitForTimeout(400);

console.log('\n=== A seed rebuilds the same progression ===');
const firstChords = tab.summaries.join(' ');
// The whole line, not a bare number: the seed carries the key, level, borrowing, length and time
// signature along with it.
const seedRow = tab.summaryItems.find(row => row.startsWith('Seed - '));
const seed = seedRow.replace('Seed - ', '').trim();
console.log(`  seed from the first tab: ${seed}`);

await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.send('chord-practice:open'));
await page.waitForTimeout(1200);
await page.fill('#chord-practice-seed-input', seed);
await page.selectOption('#chord-practice-key-select', 'C|major');
await page.fill('#chord-practice-count-input', '8');
await page.click('#chord-practice-generate-button');
await page.waitForTimeout(1500);

const rebuilt = await page.evaluate(() => {
    const panel = [...document.querySelectorAll('[role="tabpanel"]')].find(p => !p.hidden);
    return [...panel.querySelectorAll('ul.chords-used > li > details')]
        .map(d => d.querySelector('summary').textContent).join(' ');
});
console.log(`  original: ${firstChords}`);
console.log(`  rebuilt : ${rebuilt}`);
check('the same seed gives the same chords', rebuilt === firstChords, rebuilt);

await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.send('chord-practice:open'));
await page.waitForTimeout(1000);
const seedRejected = await page.evaluate(async () => {
    document.getElementById('chord-practice-seed-input').value = 'not a number';
    document.getElementById('chord-practice-generate-button').click();
    await new Promise(r => setTimeout(r, 400));
    return {
        stillOpen: document.getElementById('chord-practice-dialog').open,
        status: document.getElementById('chord-practice-status').textContent
    };
});
console.log(`  bad seed -> ${seedRejected.status}`);
check('a seed that cannot be read is refused rather than ignored',
    seedRejected.stillOpen && /not a seed/.test(seedRejected.status), seedRejected.status);
await page.evaluate(() => document.getElementById('chord-practice-dialog').close());

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
await app.close();
process.exit(failures === 0 ? 0 : 1);

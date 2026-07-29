import * as alphaTab from '@coderline/alphatab';
import { extractScoreMetadata } from '../shared/scoreMetadata.mjs';
import {
    STANDARD_TUNING_MIDI, STRING_NUMBERS, fretToMidi, identifyChordFromNotes, midiToPitchClassName
} from '../shared/musicTheory.mjs';

const statusElement = document.getElementById('status');
const emptyStateElement = document.getElementById('empty-state');
const tabStripElement = document.getElementById('tab-strip');
const tablistElement = document.getElementById('tablist');
const tabpanelsElement = document.getElementById('tabpanels');
const aboutDialog = document.getElementById('about-dialog');
const aboutVersionElement = document.getElementById('about-version');
const aboutYearElement = document.getElementById('about-year');
const aboutOkButton = document.getElementById('about-ok-button');

/** @type {{ id: number, fileName: string, buttonEl: HTMLButtonElement, panelEl: HTMLElement, score: object|undefined }[]} */
const tabs = [];
let nextTabId = 1;
let activeTabId = null;

function setStatus(message) {
    statusElement.textContent = message;
}

function updateEmptyState() {
    const hasTabs = tabs.length > 0;
    emptyStateElement.hidden = hasTabs;
    tabStripElement.hidden = !hasTabs;
}

function addSummaryRow(ul, label, value) {
    const li = document.createElement('li');
    li.textContent = `${label} - ${value}`;
    ul.append(li);
}

function buildSummaryPanel(meta) {
    const container = document.createElement('div');

    const summaryHeading = document.createElement('h2');
    summaryHeading.textContent = 'Song summary';
    container.append(summaryHeading);

    const ul = document.createElement('ul');
    addSummaryRow(ul, 'Title', meta.title);
    if (meta.artist) addSummaryRow(ul, 'Artist', meta.artist);
    if (meta.album) addSummaryRow(ul, 'Album', meta.album);
    if (meta.tempo) addSummaryRow(ul, 'Tempo', `${meta.tempo} BPM`);
    addSummaryRow(ul, 'Bars', String(meta.barCount));
    addSummaryRow(
        ul,
        'Time signature',
        meta.timeSignature
            ? meta.timeSignature + (meta.timeSignatureVaries ? ' (first bar; changes later in the song)' : '')
            : 'Unknown'
    );
    addSummaryRow(
        ul,
        'Key signature',
        meta.keySignature
            ? meta.keySignature + (meta.keySignatureVaries ? ' (first bar; changes later in the song)' : '')
            : 'Unknown'
    );
    addSummaryRow(ul, 'Tracks', String(meta.tracks.length));
    container.append(ul);

    const tracksHeading = document.createElement('h2');
    tracksHeading.textContent = `Tracks - ${meta.tracks.length}`;
    container.append(tracksHeading);

    meta.tracks.forEach((track, index) => {
        const trackHeading = document.createElement('h3');
        trackHeading.textContent = `Track ${index + 1} - ${track.name}`;
        container.append(trackHeading);

        const trackList = document.createElement('ul');
        addSummaryRow(trackList, 'Instrument', track.instrument);
        addSummaryRow(trackList, 'Tuning', track.tuningName || 'Not applicable');
        addSummaryRow(trackList, 'Capo', track.capo ? `Fret ${track.capo}` : 'None');
        container.append(trackList);

        const measuresHeading = document.createElement('h4');
        measuresHeading.textContent = `Measures - ${track.measures.length}`;
        container.append(measuresHeading);

        track.measures.forEach((measure, measureIndex) => {
            const measureHeading = document.createElement('h5');
            measureHeading.textContent = `Measure ${measureIndex + 1}`;
            container.append(measureHeading);

            const measureList = document.createElement('ul');
            for (const beatText of measure.beats) {
                const li = document.createElement('li');
                li.textContent = beatText;
                measureList.append(li);
            }
            container.append(measureList);
        });
    });

    return container;
}

function buildErrorPanel(message) {
    const container = document.createElement('div');
    const p = document.createElement('p');
    p.setAttribute('role', 'alert');
    p.textContent = message;
    container.append(p);
    return container;
}

function createTab(fileName, contentEl, { isError = false, score = undefined, kind = 'file', onClose = undefined } = {}) {
    const id = nextTabId++;
    const tabElementId = `tab-${id}`;
    const panelElementId = `tabpanel-${id}`;

    const button = document.createElement('button');
    button.type = 'button';
    button.id = tabElementId;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', 'false');
    button.setAttribute('aria-controls', panelElementId);
    button.tabIndex = -1;
    button.textContent = isError ? `${fileName} (could not be read)` : fileName;
    button.addEventListener('click', () => activateTab(id));

    const panel = document.createElement('section');
    panel.id = panelElementId;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tabElementId);
    panel.tabIndex = 0;
    panel.hidden = true;
    panel.append(contentEl);

    tablistElement.append(button);
    tabpanelsElement.append(panel);

    const tab = { id, fileName, buttonEl: button, panelEl: panel, score, kind, onClose };
    tabs.push(tab);
    updateEmptyState();
    return tab;
}

function activateTab(id) {
    const tab = tabs.find(t => t.id === id);
    if (!tab) return;

    for (const t of tabs) {
        const isActive = t.id === id;
        t.buttonEl.setAttribute('aria-selected', String(isActive));
        t.buttonEl.tabIndex = isActive ? 0 : -1;
        t.panelEl.hidden = !isActive;
    }
    activeTabId = id;
    tab.buttonEl.focus();
}

function closeTab(id) {
    const index = tabs.findIndex(t => t.id === id);
    if (index === -1) return;

    const [closed] = tabs.splice(index, 1);
    closed.onClose?.();
    closed.buttonEl.remove();
    closed.panelEl.remove();
    updateEmptyState();

    if (tabs.length === 0) {
        activeTabId = null;
        setStatus(`Closed "${closed.fileName}". No files are open.`);
        emptyStateElement.focus();
        return;
    }

    if (activeTabId === id) {
        const nextIndex = Math.min(index, tabs.length - 1);
        activateTab(tabs[nextIndex].id);
    }
}

function shiftActiveTab(delta) {
    if (tabs.length === 0) return;
    const currentIndex = tabs.findIndex(t => t.id === activeTabId);
    const newIndex = (currentIndex + delta + tabs.length) % tabs.length;
    activateTab(tabs[newIndex].id);
}

tablistElement.addEventListener('keydown', event => {
    if (tabs.length === 0) return;

    if (event.key === 'ArrowRight') {
        event.preventDefault();
        shiftActiveTab(1);
    } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        shiftActiveTab(-1);
    } else if (event.key === 'Home') {
        event.preventDefault();
        activateTab(tabs[0].id);
    } else if (event.key === 'End') {
        event.preventDefault();
        activateTab(tabs[tabs.length - 1].id);
    }
});

function handleFileOpened({ fileName, data }) {
    let contentEl;
    let isError = false;

    let score;
    try {
        score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(data);
        const meta = extractScoreMetadata(score);
        contentEl = buildSummaryPanel(meta);
        setStatus(`Opened "${fileName}". Found ${meta.tracks.length} track${meta.tracks.length === 1 ? '' : 's'}.`);
    } catch (error) {
        isError = true;
        const message = `Could not read "${fileName}": ${error && error.message ? error.message : 'unrecognized file format.'}`;
        contentEl = buildErrorPanel(message);
        setStatus(message);
    }

    const tab = createTab(fileName, contentEl, { isError, score });
    activateTab(tab.id);
}

function handleFileOpenError({ fileName, message }) {
    const fullMessage = `Could not open "${fileName}": ${message}`;
    const tab = createTab(fileName, buildErrorPanel(fullMessage), { isError: true });
    activateTab(tab.id);
    setStatus(fullMessage);
}

let aboutDialogOpener = null;

function openAboutDialog({ version }) {
    aboutVersionElement.textContent = version;
    aboutYearElement.textContent = String(new Date().getFullYear());
    aboutDialogOpener = document.activeElement;
    aboutDialog.showModal();
    aboutDialog.focus();
}

aboutOkButton.addEventListener('click', () => aboutDialog.close());

aboutDialog.addEventListener('close', () => {
    if (aboutDialogOpener && typeof aboutDialogOpener.focus === 'function') {
        aboutDialogOpener.focus();
    }
    aboutDialogOpener = null;
});

aboutDialog.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link) return;
    event.preventDefault();
    const href = link.href;
    aboutDialog.close();
    window.unstrung.openExternalLink(href);
});

window.unstrung.onFileOpened(handleFileOpened);
window.unstrung.onFileOpenError(handleFileOpenError);
window.unstrung.onCloseCurrentTab(() => {
    if (activeTabId != null) closeTab(activeTabId);
});
window.unstrung.onAboutOpen(openAboutDialog);

// --- Green Gretsch guitar sample playback (Tools menu) ---
const guitarSamplesDialog = document.getElementById('guitar-samples-dialog');
const guitarSamplesVelocitySelect = document.getElementById('guitar-samples-velocity-select');
const guitarSamplesRoundRobinSelect = document.getElementById('guitar-samples-roundrobin-select');
const guitarSamplesDurationInput = document.getElementById('guitar-samples-duration-input');
const guitarSamplesAnnounceCheckbox = document.getElementById('guitar-samples-announce-checkbox');
const guitarSamplesStatusElement = document.getElementById('guitar-samples-status');
const guitarSamplesPlayButton = document.getElementById('guitar-samples-play-button');
const guitarSamplesOkButton = document.getElementById('guitar-samples-ok-button');

const GUITAR_SAMPLES_PLAY_LABEL = 'Play Normal Notes';
const GUITAR_SAMPLES_STOP_LABEL = 'Stop';

// "p" (soft) only ever has 2 recorded round-robins; "mf"/"f" have up to 4.
const MAX_ROUND_ROBINS_BY_VELOCITY = { p: 2, mf: 4, f: 4 };

let guitarSampleNotes = null;
let guitarSamplesDialogOpener = null;
let guitarSamplesPlaybackToken = 0;

// How long a note stays audible, as a multiple of the gap between note onsets. A real
// string keeps ringing after the next note is struck, so notes overlap and decay instead
// of being cut off: at a 0.5s spacing each note rings for 1.5s and fades under its
// successor. Cutting a note dead mid-sustain is what produces an audible click.
const GUITAR_SAMPLES_RING_MULTIPLE = 3;
const GUITAR_SAMPLES_RELEASE_SECONDS = 0.25; // musical fade at the end of a note's ring
const GUITAR_SAMPLES_STOP_FADE_SECONDS = 0.04; // quick fade when the user presses Stop
const GUITAR_SAMPLES_GAIN = 0.7;

let guitarSamplesContext = null;
let guitarSamplesMasterGain = null;
let guitarSamplesSources = [];

function getGuitarSamplesContext() {
    if (!guitarSamplesContext) guitarSamplesContext = new AudioContext();
    return guitarSamplesContext;
}

function waitSeconds(seconds) {
    return new Promise(resolve => setTimeout(resolve, Math.max(0, seconds * 1000)));
}

async function loadGuitarSampleNotesOnce() {
    if (!guitarSampleNotes) {
        guitarSampleNotes = await window.unstrung.getGuitarSampleNotes();
    }
    return guitarSampleNotes;
}

function populateRoundRobinOptions() {
    const max = MAX_ROUND_ROBINS_BY_VELOCITY[guitarSamplesVelocitySelect.value] ?? 4;
    const previousValue = Number(guitarSamplesRoundRobinSelect.value) || 1;
    guitarSamplesRoundRobinSelect.replaceChildren();
    for (let i = 1; i <= max; i++) {
        const option = document.createElement('option');
        option.value = String(i);
        option.textContent = String(i);
        guitarSamplesRoundRobinSelect.append(option);
    }
    guitarSamplesRoundRobinSelect.value = String(Math.min(previousValue, max));
}

function stopGuitarSamplePlayback() {
    guitarSamplesPlaybackToken++;

    // Fade the run out over a few milliseconds rather than stopping the sources dead:
    // silencing a sample mid-waveform steps the signal straight to zero, which clicks.
    if (guitarSamplesMasterGain && guitarSamplesContext) {
        const now = guitarSamplesContext.currentTime;
        const gain = guitarSamplesMasterGain.gain;
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(gain.value, now);
        gain.linearRampToValueAtTime(0, now + GUITAR_SAMPLES_STOP_FADE_SECONDS);
        for (const source of guitarSamplesSources) {
            try { source.stop(now + GUITAR_SAMPLES_STOP_FADE_SECONDS); } catch { /* already done */ }
        }
    }
    guitarSamplesMasterGain = null;
    guitarSamplesSources = [];

    guitarSamplesPlayButton.textContent = GUITAR_SAMPLES_PLAY_LABEL;
    guitarSamplesPlayButton.setAttribute('aria-pressed', 'false');
}

/** Never rejects: a failed note is reported so one bad sample can't abort the sequence. */
async function loadGuitarSampleBuffer(key, velocity, seconds) {
    try {
        const bytes = await window.unstrung.getGuitarSampleAudio(key, velocity, seconds);
        const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        return { buffer: await getGuitarSamplesContext().decodeAudioData(arrayBuffer) };
    } catch (error) {
        return { error };
    }
}

function scheduleGuitarSampleNote(buffer, at, ringSeconds, masterGain) {
    const context = getGuitarSamplesContext();
    const source = context.createBufferSource();
    source.buffer = buffer;

    const release = Math.min(GUITAR_SAMPLES_RELEASE_SECONDS, ringSeconds / 2);
    const gain = context.createGain();
    gain.gain.setValueAtTime(GUITAR_SAMPLES_GAIN, at);
    gain.gain.setValueAtTime(GUITAR_SAMPLES_GAIN, at + ringSeconds - release);
    gain.gain.linearRampToValueAtTime(0, at + ringSeconds);

    source.connect(gain).connect(masterGain);
    source.start(at);
    source.stop(at + ringSeconds + 0.01);
    guitarSamplesSources.push(source);
}

async function playGuitarSamples() {
    const myToken = guitarSamplesPlaybackToken;
    const velocity = guitarSamplesVelocitySelect.value;
    const roundRobinCount = Number(guitarSamplesRoundRobinSelect.value) || 1;
    const announceNoteNames = guitarSamplesAnnounceCheckbox.checked;

    // The duration field sets how often a new note starts. Each note then rings longer
    // than that and fades out underneath the following note.
    const onsetSeconds = Math.max(0.05, Number(guitarSamplesDurationInput.value) || 1);
    const ringSeconds = onsetSeconds * GUITAR_SAMPLES_RING_MULTIPLE;

    const context = getGuitarSamplesContext();
    if (context.state === 'suspended') await context.resume();

    const masterGain = context.createGain();
    masterGain.gain.value = 1;
    masterGain.connect(context.destination);
    guitarSamplesMasterGain = masterGain;
    guitarSamplesSources = [];

    const notes = await loadGuitarSampleNotesOnce();
    if (myToken !== guitarSamplesPlaybackToken) return;

    // One entry per note per round-robin take; each fetch picks its own random take.
    const sequence = notes.flatMap(note => Array.from({ length: roundRobinCount }, () => note));

    // Fetch a little more audio than the ring needs so a note never ends on the slice point.
    const requestSeconds = ringSeconds + 0.15;
    let pending = loadGuitarSampleBuffer(sequence[0].key, velocity, requestSeconds);
    let onset = context.currentTime + 0.1;

    for (let i = 0; i < sequence.length; i++) {
        const note = sequence[i];
        const { buffer, error } = await pending;
        if (myToken !== guitarSamplesPlaybackToken) return;

        // Start loading the next note now, so it is ready while this one is still ringing.
        if (i + 1 < sequence.length) {
            pending = loadGuitarSampleBuffer(sequence[i + 1].key, velocity, requestSeconds);
        }

        if (error) {
            guitarSamplesStatusElement.textContent = `Error playing ${note.label}: ${error.message}`;
        } else {
            if (announceNoteNames) guitarSamplesStatusElement.textContent = note.label;
            // Keep onsets on a steady grid, but never schedule in the past if loading fell behind.
            onset = Math.max(onset, context.currentTime);
            scheduleGuitarSampleNote(buffer, onset, ringSeconds, masterGain);
        }

        const nextOnset = onset + onsetSeconds;
        await waitSeconds(nextOnset - context.currentTime);
        onset = nextOnset;
    }

    // Let the final note ring out before offering "Play" again.
    await waitSeconds(ringSeconds);
    if (myToken === guitarSamplesPlaybackToken) {
        guitarSamplesStatusElement.textContent = `Finished playing ${notes.length} notes.`;
        guitarSamplesPlayButton.textContent = GUITAR_SAMPLES_PLAY_LABEL;
        guitarSamplesPlayButton.setAttribute('aria-pressed', 'false');
    }
}

guitarSamplesVelocitySelect.addEventListener('change', populateRoundRobinOptions);

guitarSamplesPlayButton.addEventListener('click', () => {
    const wasPlaying = guitarSamplesPlayButton.getAttribute('aria-pressed') === 'true';
    stopGuitarSamplePlayback();

    if (wasPlaying) {
        guitarSamplesStatusElement.textContent = 'Stopped.';
        return;
    }

    guitarSamplesPlayButton.textContent = GUITAR_SAMPLES_STOP_LABEL;
    guitarSamplesPlayButton.setAttribute('aria-pressed', 'true');
    playGuitarSamples();
});

guitarSamplesOkButton.addEventListener('click', () => guitarSamplesDialog.close());

guitarSamplesDialog.addEventListener('close', () => {
    stopGuitarSamplePlayback();
    if (guitarSamplesDialogOpener && typeof guitarSamplesDialogOpener.focus === 'function') {
        guitarSamplesDialogOpener.focus();
    }
    guitarSamplesDialogOpener = null;
});

guitarSamplesDialog.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link) return;
    event.preventDefault();
    const href = link.href;
    guitarSamplesDialog.close();
    window.unstrung.openExternalLink(href);
});

async function openGuitarSamplesDialog() {
    guitarSamplesDialogOpener = document.activeElement;
    populateRoundRobinOptions();
    guitarSamplesDialog.showModal();
    guitarSamplesDialog.focus();
    guitarSamplesStatusElement.textContent = '';
    await loadGuitarSampleNotesOnce();
}

window.unstrung.onGuitarSamplesOpen(openGuitarSamplesDialog);
// --- end Green Gretsch guitar sample playback ---

// --- Settings dialog (File menu) ---
const settingsDialog = document.getElementById('settings-dialog');
const settingsDirectoryInput = document.getElementById('settings-default-directory-input');
const settingsBrowseButton = document.getElementById('settings-browse-button');
const settingsClearRecentButton = document.getElementById('settings-clear-recent-button');
const settingsRemoveStaleButton = document.getElementById('settings-remove-stale-button');
const settingsFilesStatusElement = document.getElementById('settings-files-status');
const settingsOkButton = document.getElementById('settings-ok-button');
const settingsTablistElement = document.getElementById('settings-tablist');

const directoryErrorDialog = document.getElementById('directory-error-dialog');
const directoryErrorMessageElement = document.getElementById('directory-error-message');
const directoryErrorOkButton = document.getElementById('directory-error-ok-button');

let settingsDialogOpener = null;

const settingsTabs = [
    { id: 'general', buttonEl: document.getElementById('settings-tab-general'), panelEl: document.getElementById('settings-panel-general') },
    { id: 'files', buttonEl: document.getElementById('settings-tab-files'), panelEl: document.getElementById('settings-panel-files') }
];

function activateSettingsTab(id) {
    for (const tab of settingsTabs) {
        const isActive = tab.id === id;
        tab.buttonEl.setAttribute('aria-selected', String(isActive));
        tab.buttonEl.tabIndex = isActive ? 0 : -1;
        tab.panelEl.hidden = !isActive;
    }
    settingsTabs.find(tab => tab.id === id).buttonEl.focus();
}

for (const tab of settingsTabs) {
    tab.buttonEl.addEventListener('click', () => activateSettingsTab(tab.id));
}

settingsTablistElement.addEventListener('keydown', event => {
    const currentIndex = settingsTabs.findIndex(tab => tab.buttonEl === document.activeElement);
    if (currentIndex === -1) return;

    if (event.key === 'ArrowRight') {
        event.preventDefault();
        activateSettingsTab(settingsTabs[(currentIndex + 1) % settingsTabs.length].id);
    } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        activateSettingsTab(settingsTabs[(currentIndex - 1 + settingsTabs.length) % settingsTabs.length].id);
    } else if (event.key === 'Home') {
        event.preventDefault();
        activateSettingsTab(settingsTabs[0].id);
    } else if (event.key === 'End') {
        event.preventDefault();
        activateSettingsTab(settingsTabs[settingsTabs.length - 1].id);
    }
});

function showDirectoryErrorDialog(directoryText) {
    directoryErrorMessageElement.textContent = `Directory "${directoryText}" does not exist.`;
    directoryErrorDialog.showModal();
    directoryErrorDialog.focus();
}

directoryErrorOkButton.addEventListener('click', () => directoryErrorDialog.close());

directoryErrorDialog.addEventListener('close', () => {
    settingsDirectoryInput.focus();
});

async function validateAndSaveSettingsDirectory() {
    const { valid } = await window.unstrung.validateAndSaveSettingsDirectory(settingsDirectoryInput.value);
    if (!valid) {
        showDirectoryErrorDialog(settingsDirectoryInput.value);
    }
    return valid;
}

settingsDirectoryInput.addEventListener('blur', () => validateAndSaveSettingsDirectory());

settingsBrowseButton.addEventListener('click', async () => {
    const chosen = await window.unstrung.chooseSettingsDirectory();
    if (chosen) {
        settingsDirectoryInput.value = chosen;
        await validateAndSaveSettingsDirectory();
    }
});

settingsClearRecentButton.addEventListener('click', async () => {
    const { removedCount } = await window.unstrung.clearRecentFiles();
    settingsFilesStatusElement.textContent = removedCount === 0
        ? 'There were no recent files to clear.'
        : `Cleared ${removedCount} recent file${removedCount === 1 ? '' : 's'}.`;
});

settingsRemoveStaleButton.addEventListener('click', async () => {
    const { removedCount } = await window.unstrung.removeStaleRecentFiles();
    settingsFilesStatusElement.textContent = removedCount === 0
        ? 'No stale files were found in the recent files list.'
        : `Removed ${removedCount} stale file${removedCount === 1 ? '' : 's'} from the recent files list.`;
});

settingsOkButton.addEventListener('click', () => settingsDialog.close());

settingsDialog.addEventListener('close', () => {
    if (settingsDialogOpener && typeof settingsDialogOpener.focus === 'function') {
        settingsDialogOpener.focus();
    }
    settingsDialogOpener = null;
});

async function openSettingsDialog() {
    settingsDialogOpener = document.activeElement;
    const settings = await window.unstrung.getSettings();
    settingsDirectoryInput.value = settings.defaultOpenDirectory ?? '';
    settingsFilesStatusElement.textContent = '';
    activateSettingsTab('general');
    settingsDialog.showModal();
    settingsTabs[0].buttonEl.focus();
}

window.unstrung.onSettingsOpen(openSettingsDialog);
// --- end Settings dialog ---
// --- Chord library (Tools menu) ---
// Lives in a tab, not a dialog. The markup comes from a <template> and is cloned into the
// tab panel, so element references are resolved when the tab opens rather than at load time.

// A wider difficulty setting includes everything below it.
const CONFIDENCE_TIERS = { canonical: ['canonical'], common: ['canonical', 'common'], advanced: ['canonical', 'common', 'advanced'] };
const CONFIDENCE_LABELS = { canonical: 'standard shape', common: 'common alternative', advanced: 'advanced voicing' };

// Chord types a learner meets first, in teaching order; anything else sorts after these.
const TYPE_ORDER = ['major', 'minor', '7', 'm7', 'maj7', 'sus2', 'sus4', '5', '6', 'm6', 'add9',
    '9', 'm9', 'maj9', 'dim', 'dim7', 'aug', 'm7b5'];

let chordLibrary = null;
let chordsUi = null;
let chordsTabId = null;
let chordsMatches = [];

// Which chords, and which of their voicings, are queued for playback. Keyed by chord name so
// a queue survives re-filtering: ticking a box only ever means "play this", never "expand
// this", which is why it is right for it to persist while you move around.
const chordsSelection = new Map();

// One entry per rendered result row, so a single row can be updated without rebuilding the
// list. Rebuilding under the cursor destroys the focused element, which drops focus out of
// the panel entirely and makes a screen reader re-announce the whole container.
const chordRowsByName = new Map();

// Suggestion popup state for the search combobox.
let chordsSuggestions = [];
let chordsSuggestionIndex = -1;

function allowedConfidences() {
    return CONFIDENCE_TIERS[chordsUi.levelSelect.value] ?? CONFIDENCE_TIERS.canonical;
}

/** Voicings of a chord that pass the current difficulty setting. */
function visibleVoicings(chord) {
    const allowed = allowedConfidences();
    return chord.voicings.filter(v => allowed.includes(v.confidence));
}

function addOption(select, value, label) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.append(option);
}

/** Strips the ", with X in the bass" tail so slash chords group under their base quality. */
function baseQualityLabel(chord) {
    return chord.quality.replace(/,\s*with .* in the bass$/, '');
}

function populateFilterOptions() {
    const roots = [...new Set(chordLibrary.chords.map(c => c.root))];
    addOption(chordsUi.rootSelect, 'all', 'All roots');
    for (const root of roots) addOption(chordsUi.rootSelect, root, root);

    const typeLabels = new Map();
    for (const chord of chordLibrary.chords) {
        if (!typeLabels.has(chord.suffix)) typeLabels.set(chord.suffix, baseQualityLabel(chord));
    }
    const types = [...typeLabels.keys()].sort((a, b) => {
        const ia = TYPE_ORDER.indexOf(a), ib = TYPE_ORDER.indexOf(b);
        if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
        return a.localeCompare(b);
    });
    addOption(chordsUi.typeSelect, 'all', 'All types');
    for (const suffix of types) {
        const label = typeLabels.get(suffix);
        addOption(chordsUi.typeSelect, suffix, label === suffix ? suffix : `${label} (${suffix})`);
    }

    const genres = [...new Set(chordLibrary.chords.flatMap(c => c.genres))].sort();
    addOption(chordsUi.genreSelect, 'all', 'All genres');
    for (const genre of genres) addOption(chordsUi.genreSelect, genre, genre);
}

/** Chords passing the filters and, if the search box has text, matching it as a prefix. */
function matchingChords() {
    if (!chordLibrary || !chordsUi) return [];

    const root = chordsUi.rootSelect.value;
    const type = chordsUi.typeSelect.value;
    const genre = chordsUi.genreSelect.value;
    const prefix = chordsUi.searchInput.value.trim().toLowerCase();

    const matches = chordLibrary.chords.filter(chord => {
        if (root !== 'all' && chord.root !== root) return false;
        if (type !== 'all' && chord.suffix !== type) return false;
        if (genre !== 'all' && !chord.genres.includes(genre)) return false;
        if (prefix && !chord.name.toLowerCase().startsWith(prefix)) return false;
        return visibleVoicings(chord).length > 0;
    });

    // When searching, put what was actually typed at the top: looking for "Am" should not
    // begin with "Am/F". Without a search term the library's own root-grouped order is more
    // useful for browsing, so leave it alone.
    if (prefix) {
        matches.sort((a, b) => {
            const aExact = a.name.toLowerCase() === prefix;
            const bExact = b.name.toLowerCase() === prefix;
            return Number(bExact) - Number(aExact) || a.name.length - b.name.length
                || a.name.localeCompare(b.name);
        });
    }
    return matches;
}

function voicingLabel(voicing, index) {
    const where = voicing.lowestFret === 0 ? 'open position' : `from fret ${voicing.lowestFret}`;
    return `Voicing option ${index + 1}: ${voicing.shape ?? where}, ${CONFIDENCE_LABELS[voicing.confidence]}`;
}

function appendTextItems(list, rows) {
    for (const row of rows) {
        const li = document.createElement('li');
        li.textContent = row;
        list.append(li);
    }
}

function describeVoicingRows(chord, voicing) {
    return [
        `Notes: ${voicing.notes.join(', ')}`,
        voicing.shape
            ? `Shape: ${voicing.shape}`
            : `Position: ${voicing.lowestFret === 0 ? 'open' : 'from fret ' + voicing.lowestFret}`,
        `Genres: ${chord.genres.join(', ')}`,
        ...voicing.description
    ];
}

/** The string-by-string description, collapsed so it never clutters navigation. */
function buildVoicingDetails(chord, voicing) {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'Fingering and notes';
    const list = document.createElement('ul');
    appendTextItems(list, describeVoicingRows(chord, voicing));
    details.append(summary, list);
    return details;
}

/**
 * Builds one complete result row: the chord's own checkbox, then every one of its voicings
 * inside a collapsed <details>.
 *
 * Everything is built up front and never rebuilt. Ticking a box only ever flips `checked`
 * properties, so the DOM shape never changes under the cursor and there is no focus to save
 * and restore. The voicings stay out of the way because a collapsed <details> keeps its
 * contents out of the accessibility tree: navigating by checkbox passes straight over them
 * until you expand the region yourself.
 */
function buildChordRow(chord, chordIndex) {
    const queued = chordsSelection.get(chord.name);
    const voicings = visibleVoicings(chord);

    const item = document.createElement('li');

    const box = document.createElement('input');
    box.type = 'checkbox';
    box.id = `chords-result-${chordIndex}`;
    box.checked = queued !== undefined;

    const label = document.createElement('label');
    label.htmlFor = box.id;
    label.textContent = `${chord.name} - ${baseQualityLabel(chord)}`;

    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = `${voicings.length} voicing option${voicings.length === 1 ? '' : 's'}`;
    const list = document.createElement('ul');
    const voicingBoxes = [];

    for (const [voicingIndex, voicing] of voicings.entries()) {
        const voicingItem = document.createElement('li');

        const voicingBox = document.createElement('input');
        voicingBox.type = 'checkbox';
        voicingBox.id = `${box.id}-voicing-${voicingIndex}`;
        voicingBox.checked = queued?.has(voicingIndex) ?? false;

        const voicingLabelEl = document.createElement('label');
        voicingLabelEl.htmlFor = voicingBox.id;
        voicingLabelEl.textContent = voicingLabel(voicing, voicingIndex);

        voicingBox.addEventListener('change', () => {
            const set = chordsSelection.get(chord.name) ?? new Set();
            if (voicingBox.checked) set.add(voicingIndex);
            else set.delete(voicingIndex);

            if (set.size === 0) chordsSelection.delete(chord.name);
            else chordsSelection.set(chord.name, set);

            // Keep the chord's own box in step with its voicings.
            box.checked = set.size > 0;
            updateChordResultsHeading();
        });

        voicingItem.append(voicingBox, voicingLabelEl, buildVoicingDetails(chord, voicing));
        list.append(voicingItem);
        voicingBoxes.push(voicingBox);
    }
    details.append(summary, list);

    box.addEventListener('change', () => {
        // Queue the simplest voicing by default: the library lists standard shapes first,
        // then lowest on the neck, so the first one is it.
        if (box.checked) chordsSelection.set(chord.name, new Set([0]));
        else chordsSelection.delete(chord.name);

        const set = chordsSelection.get(chord.name);
        for (const [index, voicingBox] of voicingBoxes.entries()) {
            voicingBox.checked = set?.has(index) ?? false;
        }
        updateChordResultsHeading();
    });

    item.append(box, label, details);
    return { item, box, voicingBoxes };
}

/** Full rebuild. Only when the match set itself changes, never on ticking a box. */
function rebuildChordResults() {
    if (!chordLibrary || !chordsUi) return;

    chordsMatches = matchingChords();
    chordRowsByName.clear();
    chordsUi.resultsList.replaceChildren();

    for (const [chordIndex, chord] of chordsMatches.entries()) {
        const row = buildChordRow(chord, chordIndex);
        chordsUi.resultsList.append(row.item);
        chordRowsByName.set(chord.name, row);
    }

    updateChordResultsHeading();
}

/**
 * The count lives in the heading rather than a live region: it is there to be read when you
 * navigate to the heading, not announced every time a value changes under the cursor.
 */
function updateChordResultsHeading() {
    if (!chordsUi) return;
    const chordCount = chordsMatches.length;
    const queuedCount = [...chordsSelection.values()].reduce((total, set) => total + set.size, 0);

    let text = chordCount === 0
        ? 'Search Results: no matching chords'
        : `Search Results: ${chordCount} chord${chordCount === 1 ? '' : 's'}`;
    if (queuedCount > 0) text += `, ${queuedCount} selected for playback`;
    chordsUi.resultsHeading.textContent = text;
}

// --- Search combobox ----------------------------------------------------------------
function closeChordSuggestions() {
    if (!chordsUi) return;
    chordsSuggestions = [];
    chordsSuggestionIndex = -1;
    chordsUi.searchListbox.replaceChildren();
    chordsUi.searchListbox.hidden = true;
    chordsUi.searchInput.setAttribute('aria-expanded', 'false');
    chordsUi.searchInput.removeAttribute('aria-activedescendant');
}

function renderChordSuggestions() {
    const prefix = chordsUi.searchInput.value.trim().toLowerCase();
    if (prefix === '') return closeChordSuggestions();

    chordsSuggestions = matchingChords().slice(0, 20);
    if (chordsSuggestions.length === 0) return closeChordSuggestions();

    chordsSuggestionIndex = -1;
    chordsUi.searchListbox.replaceChildren();
    for (const [index, chord] of chordsSuggestions.entries()) {
        const option = document.createElement('li');
        option.id = `chords-suggestion-${index}`;
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', 'false');
        option.textContent = `${chord.name} - ${baseQualityLabel(chord)}`;
        option.addEventListener('mousedown', event => {
            event.preventDefault(); // keep focus in the field so blur handling stays predictable
            commitChordSuggestion(index);
        });
        chordsUi.searchListbox.append(option);
    }
    chordsUi.searchListbox.hidden = false;
    chordsUi.searchInput.setAttribute('aria-expanded', 'true');
}

function highlightChordSuggestion(index) {
    const options = [...chordsUi.searchListbox.children];
    if (options.length === 0) return;
    chordsSuggestionIndex = (index + options.length) % options.length;
    for (const [i, option] of options.entries()) {
        option.setAttribute('aria-selected', String(i === chordsSuggestionIndex));
    }
    const active = options[chordsSuggestionIndex];
    chordsUi.searchInput.setAttribute('aria-activedescendant', active.id);
    active.scrollIntoView({ block: 'nearest' });
}

function commitChordSuggestion(index) {
    const chord = chordsSuggestions[index];
    if (!chord) return;
    chordsUi.searchInput.value = chord.name;
    closeChordSuggestions();
    rebuildChordResults();
    queueDefaultChordIfNoneQueued();
}

/**
 * Queues the most obvious match so the simple case needs nothing further: type "C", leave the
 * field, and C major with its simplest voicing is ready to play. Shortest matching name wins,
 * so "C" beats "C7" and "C#".
 *
 * Only flips `checked` properties, so this is safe to run at any time, including while focus
 * is moving.
 */
function queueDefaultChordIfNoneQueued() {
    if (!chordLibrary || !chordsUi) return;
    if (chordsMatches.length === 0) return;
    if ([...chordsSelection.values()].some(set => set.size > 0)) return;

    const shortest = chordsMatches.reduce((best, chord) =>
        chord.name.length < best.name.length ? chord : best, chordsMatches[0]);
    chordsSelection.set(shortest.name, new Set([0]));

    const row = chordRowsByName.get(shortest.name);
    if (row) {
        row.box.checked = true;
        if (row.voicingBoxes[0]) row.voicingBoxes[0].checked = true;
    }
    updateChordResultsHeading();
}

// --- Chord playback -----------------------------------------------------------------
// Strums are built by scheduling the individual string samples a few milliseconds apart,
// the way a real pick sweeps across the strings rather than hitting them all at once.
//
// How long each note lasts is decided by the guitar, not by a fixed length: a string rings
// until that same string is struck again, or until it decays away on its own. So every
// downstroke note ends when the upstroke re-strikes its own string, and the upstroke notes
// simply ring out. Because each string is re-struck at a different moment in the sweep,
// the downstroke notes all have slightly different lengths.
const STRUM_STRING_DELAY_MS = 20;
const UPSTROKE_DELAY_MS = 900;
const CHORD_NOTE_GAIN = 0.45; // headroom so six stacked samples don't clip
const CHORD_RESTRIKE_FADE_SECONDS = 0.025; // brief fade as a string is re-struck
const CHORD_DECAY_FADE_SECONDS = 0.15; // fade at the tail of a note left to ring out
const CHORD_SEQUENCE_GAP_SECONDS = 2.2; // start of one chord to the next when comparing

let chordAudioContext = null;
let chordMasterGain = null;
let chordActiveSources = [];
let chordPlaybackToken = 0;
const chordSampleCache = new Map();

function getChordAudioContext() {
    if (!chordAudioContext) chordAudioContext = new AudioContext();
    return chordAudioContext;
}

function stopChordPlayback() {
    chordPlaybackToken++;

    // Notes may be ringing for several seconds now, so cutting the sources dead would
    // click. Fade the whole strum out instead.
    if (chordMasterGain && chordAudioContext) {
        const now = chordAudioContext.currentTime;
        const gain = chordMasterGain.gain;
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(gain.value, now);
        gain.linearRampToValueAtTime(0, now + CHORD_RESTRIKE_FADE_SECONDS);
        for (const source of chordActiveSources) {
            try { source.stop(now + CHORD_RESTRIKE_FADE_SECONDS); } catch { /* already finished */ }
        }
    }
    chordMasterGain = null;
    chordActiveSources = [];
}

/**
 * Orders the strings the pick actually crosses and assigns each a delay and a velocity
 * layer. The last two strings in the sweep use a softer layer: the pick has lost energy
 * by the time it reaches them, so on a downstroke the treble strings sound lighter and on
 * an upstroke the bass strings do.
 */
function buildStrokePlan(voicing, direction) {
    const sounded = voicing.strings.filter(s => s.play !== 'muted');
    const ordered = direction === 'down'
        ? [...sounded].sort((a, b) => b.string - a.string)  // string 6 first, down to string 1
        : [...sounded].sort((a, b) => a.string - b.string); // string 1 first, up to string 6

    return ordered.map((entry, index) => ({
        string: entry.string,
        midi: STANDARD_TUNING_MIDI[entry.string] + entry.fret,
        velocity: index >= ordered.length - 2 ? 'mf' : 'f',
        delaySeconds: (index * STRUM_STRING_DELAY_MS) / 1000
    }));
}

/**
 * Lays out one or more chords as a single timeline of notes.
 *
 * Ring length is never chosen: a note lasts until that same string is struck again anywhere
 * later in the sequence, and rings out naturally if it never is. That one rule covers the
 * upstroke cutting off the downstroke and, when comparing several chords, each chord cutting
 * off the one before it, because re-strumming really does stop the strings you re-strike.
 */
function buildStrumSequence(voicings) {
    const strokes = [];
    let chordStart = 0;
    for (const voicing of voicings) {
        strokes.push({ at: chordStart, voicing, direction: 'down' });
        strokes.push({ at: chordStart + UPSTROKE_DELAY_MS / 1000, voicing, direction: 'up' });
        chordStart += CHORD_SEQUENCE_GAP_SECONDS;
    }

    const notes = [];
    for (const stroke of strokes) {
        for (const note of buildStrokePlan(stroke.voicing, stroke.direction)) {
            notes.push({ ...note, at: stroke.at + note.delaySeconds });
        }
    }
    notes.sort((a, b) => a.at - b.at);

    for (const [index, note] of notes.entries()) {
        const restrike = notes.find((later, laterIndex) =>
            laterIndex > index && later.string === note.string);
        note.ringSeconds = restrike ? restrike.at - note.at : null;
    }
    return notes;
}

/** Only fetch the audio a note will actually use; a ringing note needs the whole recording. */
function chordSampleRequestSeconds(note) {
    return note.ringSeconds === null
        ? undefined
        : note.ringSeconds + CHORD_DECAY_FADE_SECONDS;
}

function chordSampleKey(note) {
    return `${note.midi}:${note.velocity}:${chordSampleRequestSeconds(note) ?? 'full'}`;
}

async function loadChordSample(note) {
    const cacheKey = chordSampleKey(note);
    if (!chordSampleCache.has(cacheKey)) {
        const bytes = await window.unstrung.getGuitarSampleAudio(
            note.midi, note.velocity, chordSampleRequestSeconds(note));
        const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        chordSampleCache.set(cacheKey, await getChordAudioContext().decodeAudioData(arrayBuffer));
    }
    return chordSampleCache.get(cacheKey);
}

async function playChordSelection(voicings, label) {
    stopChordPlayback();
    const myToken = chordPlaybackToken;
    const context = getChordAudioContext();
    if (context.state === 'suspended') await context.resume();

    const plan = buildStrumSequence(voicings);

    // Resolve each distinct note once; several strings can share a sample and length.
    const buffers = new Map();
    setChordStatus('Loading samples…');
    try {
        await Promise.all([...new Map(plan.map(n => [chordSampleKey(n), n])).values()]
            .map(async note => buffers.set(chordSampleKey(note), await loadChordSample(note))));
    } catch (error) {
        setChordStatus(`Could not load samples: ${error.message}`);
        return;
    }
    if (myToken !== chordPlaybackToken) return;

    const masterGain = context.createGain();
    masterGain.gain.value = 1;
    masterGain.connect(context.destination);
    chordMasterGain = masterGain;
    chordActiveSources = [];

    const start = context.currentTime + 0.05;
    for (const note of plan) {
        const buffer = buffers.get(chordSampleKey(note));
        if (!buffer) continue;

        const source = context.createBufferSource();
        source.buffer = buffer;
        const gain = context.createGain();
        const at = start + note.at;

        // A note either gets cut off as its string is re-struck, or rings out to the end of
        // the recording. Either way it fades rather than stopping on a non-zero sample.
        const ends = at + (note.ringSeconds ?? buffer.duration);
        const fade = note.ringSeconds === null ? CHORD_DECAY_FADE_SECONDS : CHORD_RESTRIKE_FADE_SECONDS;
        gain.gain.setValueAtTime(CHORD_NOTE_GAIN, at);
        gain.gain.setValueAtTime(CHORD_NOTE_GAIN, Math.max(at, ends - fade));
        gain.gain.linearRampToValueAtTime(0, ends);

        source.connect(gain).connect(masterGain);
        source.start(at);
        source.stop(ends + 0.01);
        chordActiveSources.push(source);
    }

    setChordStatus(`Playing ${label}.`);
}

/** Every ticked voicing, in the order they appear in the results. */
function chordPlaybackSelection() {
    const picked = [];
    for (const chord of chordsMatches) {
        const selected = chordsSelection.get(chord.name);
        if (!selected) continue;
        const voicings = visibleVoicings(chord);
        for (const index of [...selected].sort((a, b) => a - b)) {
            if (voicings[index]) picked.push({ chord, voicing: voicings[index], index });
        }
    }
    return picked;
}

function setChordStatus(text) {
    if (chordsUi) chordsUi.status.textContent = text;
}

// --- Wiring -------------------------------------------------------------------------
function wireChordLibrary() {
    // A filter or search change alters the match set, so a full rebuild is correct here.
    // Focus is in the control being used, which the rebuild never touches.
    for (const select of [chordsUi.levelSelect, chordsUi.rootSelect, chordsUi.typeSelect, chordsUi.genreSelect]) {
        select.addEventListener('change', rebuildChordResults);
    }

    chordsUi.searchInput.addEventListener('input', () => {
        renderChordSuggestions();
        rebuildChordResults();
    });

    // Leaving the field closes the suggestions and settles on an obvious default, so that
    // typing a name and pressing Play needs nothing else.
    //
    // All of it has to be deferred. Changing the DOM while the browser is still deciding where
    // Tab should land makes it abandon sequential navigation entirely: focus leaves the field
    // and nothing receives it, dropping a screen reader out of the panel and onto the
    // document. Hiding the open suggestion list is enough on its own to trigger that, so the
    // whole handler waits for the focus move to finish.
    chordsUi.searchInput.addEventListener('blur', () => {
        setTimeout(() => {
            closeChordSuggestions();
            queueDefaultChordIfNoneQueued();
        }, 0);
    });

    chordsUi.searchInput.addEventListener('keydown', event => {
        const isOpen = !chordsUi.searchListbox.hidden;
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (!isOpen) renderChordSuggestions();
            highlightChordSuggestion(chordsSuggestionIndex + 1);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (isOpen) highlightChordSuggestion(chordsSuggestionIndex - 1);
        } else if (event.key === 'Enter' && isOpen && chordsSuggestionIndex >= 0) {
            event.preventDefault();
            commitChordSuggestion(chordsSuggestionIndex);
        } else if (event.key === 'Escape' && isOpen) {
            event.preventDefault();
            closeChordSuggestions();
        } else if (event.key === 'Tab' && isOpen) {
            // Dismiss the popup here, while this is still just a keypress. An open listbox
            // sitting in the tab order between this field and the next control derails
            // Chromium's sequential navigation: focus leaves the field and nothing takes it.
            // Closing during keydown happens before the focus move starts, so Tab behaves.
            // No preventDefault: Tab should still move on, as it does in any combobox.
            closeChordSuggestions();
        }
    });

    chordsUi.playButton.addEventListener('click', () => {
        const picked = chordPlaybackSelection();
        if (picked.length === 0) {
            setChordStatus('Tick a chord in the search results first.');
            return;
        }
        const label = picked.length === 1
            ? `${picked[0].chord.name}, voicing option ${picked[0].index + 1}`
            : `${picked.length} selections in turn: ` +
              picked.map(p => `${p.chord.name} option ${p.index + 1}`).join(', ');
        playChordSelection(picked.map(p => p.voicing), label);
    });

    chordsUi.clearButton.addEventListener('click', () => {
        stopChordPlayback();
        chordsSelection.clear();
        rebuildChordResults(); // focus is on this button, which the rebuild leaves alone
        setChordStatus('Cleared the playback selection.');
    });
}

async function openChordLibraryTab() {
    // Only ever one chord library tab, which keeps the template's element ids unique.
    const existing = tabs.find(tab => tab.id === chordsTabId);
    if (existing) {
        activateTab(existing.id);
        return;
    }

    const content = document.getElementById('chord-library-template').content.cloneNode(true);
    const tab = createTab('Chord Library', content, {
        kind: 'chord-library',
        onClose: () => {
            stopChordPlayback();
            chordsUi = null;
            chordsTabId = null;
            chordRowsByName.clear();
        }
    });
    chordsTabId = tab.id;

    chordsUi = {
        searchInput: document.getElementById('chords-search-input'),
        searchListbox: document.getElementById('chords-search-listbox'),
        levelSelect: document.getElementById('chords-level-select'),
        rootSelect: document.getElementById('chords-root-select'),
        typeSelect: document.getElementById('chords-type-select'),
        genreSelect: document.getElementById('chords-genre-select'),
        resultsHeading: document.getElementById('chords-results-heading'),
        resultsList: document.getElementById('chords-results-list'),
        status: document.getElementById('chords-status'),
        playButton: document.getElementById('chords-play-button'),
        clearButton: document.getElementById('chords-clear-button')
    };
    wireChordLibrary();
    activateTab(tab.id);

    if (!chordLibrary) {
        chordsUi.resultsHeading.textContent = 'Search Results: loading chord library…';
        chordLibrary = await window.unstrung.getChordLibrary();
    }
    populateFilterOptions();
    rebuildChordResults();
    setStatus('Opened the Chord Library. Close it with Ctrl+W.');
    // Land on the search field: it is the first thing you do here every time.
    chordsUi.searchInput.focus();
}

/**
 * Opens the library focused on one chord by name. Widens the difficulty filter only if the
 * chord would otherwise be filtered out, so arriving here never silently hides the very chord
 * you asked to see, but also does not reset a setting that was already showing it.
 */
async function showChordInLibrary(chordName) {
    await openChordLibraryTab();

    chordsUi.searchInput.value = chordName;
    rebuildChordResults();

    if (!chordsMatches.some(chord => chord.name === chordName)) {
        chordsUi.levelSelect.value = 'advanced';
        rebuildChordResults();
    }

    closeChordSuggestions();
    chordsUi.searchInput.focus();
    setStatus(`Showing ${chordName} in the Chord Library.`);
}

window.unstrung.onChordLibraryOpen(openChordLibraryTab);
// --- end chord library ---

// --- Frets to Chord (Tools menu) -----------------------------------------------------
// The reverse of the chord library: you know the shape under your fingers but not its name.
const FRETS_MAX_FRET = 15; // the highest fret any voicing in the library uses

const fretsDialog = document.getElementById('frets-dialog');
const fretsResultHeading = document.getElementById('frets-result-heading');
const fretsResultList = document.getElementById('frets-result-list');
const fretsViewButton = document.getElementById('frets-view-button');
const fretsOkButton = document.getElementById('frets-ok-button');
const fretsSelects = new Map(STRING_NUMBERS.map(
    stringNumber => [stringNumber, document.getElementById(`frets-string-${stringNumber}`)]));

let fretsDialogOpener = null;
let fretsIdentifiedName = null;

function populateFretSelects() {
    for (const select of fretsSelects.values()) {
        if (select.options.length > 0) continue;
        addOption(select, '0', 'open');
        addOption(select, '-1', 'not played');
        for (let fret = 1; fret <= FRETS_MAX_FRET; fret++) addOption(select, String(fret), String(fret));
        select.value = '0';
    }
}

/** What the selectors currently describe, as absolute frets keyed by string number. */
function currentFretSelection() {
    const selection = new Map();
    for (const [stringNumber, select] of fretsSelects) {
        selection.set(stringNumber, Number(select.value));
    }
    return selection;
}

function voicingMatchesFretSelection(voicing, selection) {
    for (const stringNumber of STRING_NUMBERS) {
        const entry = voicing.strings.find(s => s.string === stringNumber);
        const played = entry.play === 'muted' ? -1 : entry.fret;
        if (played !== selection.get(stringNumber)) return false;
    }
    return true;
}

/** Library voicings whose shape is exactly what the selectors describe. */
function findLibraryShapeMatches(selection) {
    const matches = [];
    if (!chordLibrary) return matches;
    for (const chord of chordLibrary.chords) {
        for (const [index, voicing] of chord.voicings.entries()) {
            if (voicingMatchesFretSelection(voicing, selection)) matches.push({ chord, voicing, index });
        }
    }
    return matches;
}

function renderFretsResult() {
    const selection = currentFretSelection();
    const sounded = STRING_NUMBERS
        .filter(stringNumber => selection.get(stringNumber) >= 0)
        .map(stringNumber => ({
            string: stringNumber,
            fret: selection.get(stringNumber),
            midi: fretToMidi(stringNumber, selection.get(stringNumber))
        }));

    fretsResultList.replaceChildren();
    fretsIdentifiedName = null;

    if (sounded.length === 0) {
        fretsResultHeading.textContent = 'Identified Chord: no strings are being played';
        fretsViewButton.disabled = true;
        return;
    }

    const noteNames = [...new Set(sounded.map(n => midiToPitchClassName(n.midi)))];
    const rows = [
        `Notes played: ${noteNames.join(', ')}`,
        `Strings sounding: ${sounded.length} of 6`
    ];

    const shapeMatches = findLibraryShapeMatches(selection);

    if (shapeMatches.length > 0) {
        const best = shapeMatches[0];
        fretsIdentifiedName = best.chord.name;
        fretsResultHeading.textContent = `Identified Chord: ${best.chord.name}`;
        rows.unshift(`${best.chord.name} - ${best.chord.quality}`);
        rows.push(`This exact shape is in the chord library as voicing option ${best.index + 1}.`);
        if (best.voicing.shape) rows.push(`Shape: ${best.voicing.shape}`);
        rows.push(`Difficulty: ${CONFIDENCE_LABELS[best.voicing.confidence]}`);
        rows.push(`Genres: ${best.chord.genres.join(', ')}`);
        if (shapeMatches.length > 1) {
            const others = shapeMatches.slice(1).map(m => m.chord.name).join(', ');
            rows.push(`This shape is also filed under: ${others}`);
        }
        rows.push(...best.voicing.description);
    } else {
        // Nothing in the library has this exact shape, so work it out from the notes instead.
        const candidates = identifyChordFromNotes(sounded.map(n => n.midi));
        if (candidates.length === 0) {
            fretsResultHeading.textContent = 'Identified Chord: no chord matches these notes';
            rows.push('These notes do not spell a chord Unstrung recognises.');
        } else {
            const best = candidates[0];
            fretsIdentifiedName = best.name;
            fretsResultHeading.textContent = `Identified Chord: ${best.name}`;
            rows.unshift(`${best.name}${best.rootInBass ? '' : `, with ${best.bass} in the bass`}`);
            rows.push('This exact shape is not in the chord library, but these notes spell it.');
            if (candidates.length > 1) {
                rows.push(`Could also be read as: ${candidates.slice(1, 4).map(c => c.name).join(', ')}`);
            }
        }
        for (const stringNumber of STRING_NUMBERS) {
            const fret = selection.get(stringNumber);
            rows.push(`String ${stringNumber}: ${fret === -1 ? 'not played' : fret === 0 ? 'open' : `fret ${fret}`}`);
        }
    }

    appendTextItems(fretsResultList, rows);
    fretsViewButton.disabled = fretsIdentifiedName === null;
}

for (const select of fretsSelects.values()) {
    select.addEventListener('change', renderFretsResult);
}

fretsOkButton.addEventListener('click', () => fretsDialog.close());

fretsDialog.addEventListener('close', () => {
    if (fretsDialogOpener && typeof fretsDialogOpener.focus === 'function') {
        fretsDialogOpener.focus();
    }
    fretsDialogOpener = null;
});

fretsViewButton.addEventListener('click', async () => {
    if (!fretsIdentifiedName) return;
    const name = fretsIdentifiedName;
    // Closing first means focus is not restored to the dialog's opener afterwards, which would
    // fight with the library tab taking focus.
    fretsDialogOpener = null;
    fretsDialog.close();
    await showChordInLibrary(name);
});

async function openFretsToChordDialog() {
    fretsDialogOpener = document.activeElement;
    populateFretSelects();
    fretsDialog.showModal();
    fretsDialog.focus();

    if (!chordLibrary) {
        fretsResultHeading.textContent = 'Identified Chord: loading chord library…';
        chordLibrary = await window.unstrung.getChordLibrary();
    }
    renderFretsResult();
}

window.unstrung.onFretsToChordOpen(openFretsToChordDialog);
// --- end Frets to Chord ---

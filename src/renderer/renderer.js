import * as alphaTab from '@coderline/alphatab';
import { extractScoreMetadata } from '../shared/scoreMetadata.mjs';

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

function createTab(fileName, contentEl, { isError = false, score = undefined } = {}) {
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

    const tab = { id, fileName, buttonEl: button, panelEl: panel, score };
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
let guitarSamplesAudio = null;

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
    if (guitarSamplesAudio) {
        guitarSamplesAudio.pause();
        guitarSamplesAudio.src = '';
        guitarSamplesAudio = null;
    }
    guitarSamplesPlayButton.textContent = GUITAR_SAMPLES_PLAY_LABEL;
    guitarSamplesPlayButton.setAttribute('aria-pressed', 'false');
}

async function playOneGuitarSample(key, velocity, maxPlayMs, myToken) {
    const bytes = await window.unstrung.getGuitarSampleAudio(key, velocity);
    if (myToken !== guitarSamplesPlaybackToken) return;

    const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
    const audio = new Audio(url);
    guitarSamplesAudio = audio;
    await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            audio.pause();
            resolve();
        }, maxPlayMs);
        audio.addEventListener('ended', () => { clearTimeout(timer); resolve(); }, { once: true });
        audio.addEventListener('error', () => { clearTimeout(timer); reject(new Error('playback error')); }, { once: true });
        audio.play().catch(reject);
    });
    URL.revokeObjectURL(url);
}

async function playGuitarSamples() {
    const myToken = guitarSamplesPlaybackToken;
    const velocity = guitarSamplesVelocitySelect.value;
    const roundRobinCount = Number(guitarSamplesRoundRobinSelect.value) || 1;
    const durationSeconds = Number(guitarSamplesDurationInput.value) || 1;
    const maxPlayMs = Math.max(50, durationSeconds * 1000);
    const announceNoteNames = guitarSamplesAnnounceCheckbox.checked;

    const notes = await loadGuitarSampleNotesOnce();

    for (let i = 0; i < notes.length; i++) {
        if (myToken !== guitarSamplesPlaybackToken) return;
        const note = notes[i];
        for (let take = 0; take < roundRobinCount; take++) {
            if (myToken !== guitarSamplesPlaybackToken) return;
            if (announceNoteNames) {
                guitarSamplesStatusElement.textContent = note.label;
            }
            try {
                await playOneGuitarSample(note.key, velocity, maxPlayMs, myToken);
            } catch (error) {
                if (myToken !== guitarSamplesPlaybackToken) return;
                guitarSamplesStatusElement.textContent = `Error playing ${note.label}: ${error.message}`;
            }
        }
    }

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

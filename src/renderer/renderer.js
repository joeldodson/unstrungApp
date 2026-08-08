import * as alphaTab from '@coderline/alphatab';
import { extractScoreMetadata } from '../shared/scoreMetadata.mjs';
import {
    FINGER_NAMES, QUALITY_LABELS, STANDARD_TUNING_MIDI, STRING_NUMBERS, TUNINGS, fretToMidi,
    identifyChordFromNotes, midiToPitchClassName, midiToPitchName
} from '../shared/musicTheory.mjs';
import { buildAudioTrack, resolveRingLengths } from '../shared/audioTrack.mjs';
import helpContent from '../assets/help/help-content.json';

const statusElement = document.getElementById('status');
const introElement = document.getElementById('intro');
const emptyStateElement = document.getElementById('empty-state');
const tabStripElement = document.getElementById('tab-strip');
const tablistElement = document.getElementById('tablist');
const tabpanelsElement = document.getElementById('tabpanels');
const aboutDialog = document.getElementById('about-dialog');
const aboutVersionElement = document.getElementById('about-version');
const aboutYearElement = document.getElementById('about-year');
const aboutOkButton = document.getElementById('about-ok-button');
const whatIsDialog = document.getElementById('what-is-dialog');
const whatIsBodyElement = document.getElementById('what-is-body');
const whatIsOkButton = document.getElementById('what-is-ok-button');
const screenReaderDialog = document.getElementById('screen-reader-dialog');
const screenReaderBodyElement = document.getElementById('screen-reader-body');
const screenReaderOkButton = document.getElementById('screen-reader-ok-button');
const feedbackDialog = document.getElementById('feedback-dialog');
const feedbackBodyElement = document.getElementById('feedback-body');
const feedbackOkButton = document.getElementById('feedback-ok-button');

/** @type {{ id: number, fileName: string, buttonEl: HTMLButtonElement, panelEl: HTMLElement, score: object|undefined }[]} */
const tabs = [];
let nextTabId = 1;
let activeTabId = null;

// Read at startup rather than fetched when needed: a tab can be built before the settings dialog
// has ever been opened, and the beat descriptions have to be right the first time.
let screenReaderSettings = { terseBeatDescriptions: false, autoCollapseOnTabChange: true };

function setStatus(message) {
    statusElement.textContent = message;
}

function updateEmptyState() {
    const hasTabs = tabs.length > 0;
    emptyStateElement.hidden = hasTabs;
    tabStripElement.hidden = !hasTabs;
    // Both blocks of guidance are for an empty window. Hiding them once files are open keeps
    // the path from the top of the document to the tabs and their content short.
    if (introElement) introElement.hidden = hasTabs;
}

function addSummaryRow(ul, label, value) {
    const li = document.createElement('li');
    li.textContent = `${label} - ${value}`;
    ul.append(li);
}

function buildSummaryPanel(meta, { onCreateAudioTrack } = {}) {
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
        // The file's own tuning label is often empty even when the tuning is unusual, so the
        // pitches decide what is reported and the label is only extra detail when it exists.
        const tuningText = track.tuning
            ? (track.tuning.label && !track.tuning.isStandard
                ? `${track.tuning.label} - ${track.tuning.summary}`
                : track.tuning.summary)
            : 'Not applicable';
        addSummaryRow(trackList, 'Tuning', tuningText);
        addSummaryRow(trackList, 'Capo', track.capo ? `Fret ${track.capo}` : 'None');
        container.append(trackList);

        // Placed with the track's own details rather than after its measures, so reaching it
        // does not mean travelling past every bar in the song.
        if (onCreateAudioTrack) {
            const actions = document.createElement('p');
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = 'Create Audio Track';
            button.addEventListener('click', () => onCreateAudioTrack(index));
            actions.append(button);
            container.append(actions);
        }

        // The measures are almost all of a song's content: hundreds of short text lines per
        // track. They sit behind a collapsed disclosure, and are only built when it is first
        // opened, for more than tidiness. A screen reader's browse buffer pays a per-text-line
        // cost walking newly exposed content, so a panel that exposes every beat of every
        // measure took seconds to enter each time the tab was visited. Collapsed content stays
        // out of the accessibility tree entirely, so entering the document is immediate and the
        // cost is only paid if and when the measures are opened.
        const measuresDetails = document.createElement('details');
        const measuresSummary = document.createElement('summary');
        measuresSummary.textContent = `Measures - ${track.measures.length}`;
        measuresDetails.append(measuresSummary);

        let measuresBuilt = false;
        measuresDetails.addEventListener('toggle', () => {
            if (!measuresDetails.open || measuresBuilt) return;
            measuresBuilt = true;

            track.measures.forEach((measure, measureIndex) => {
                // h4: the next level under the track's h3, now that the old "Measures" h4
                // has become the disclosure's summary rather than a heading.
                const measureHeading = document.createElement('h4');
                measureHeading.textContent = `Measure ${measureIndex + 1}`;
                measuresDetails.append(measureHeading);

                const measureList = document.createElement('ul');
                for (const beatText of measure.beats) {
                    const li = document.createElement('li');
                    li.textContent = beatText;
                    measureList.append(li);
                }
                measuresDetails.append(measureList);
            });
        });

        container.append(measuresDetails);
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

function createTab(fileName, contentEl, {
    isError = false, score = undefined, kind = 'file', onClose = undefined, insertAfterTabId = null
} = {}) {
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
    button.addEventListener('click', () => activateTab(id, { focusContent: true }));

    const panel = document.createElement('section');
    panel.id = panelElementId;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tabElementId);
    panel.tabIndex = 0;
    panel.hidden = true;
    panel.append(contentEl);

    const tab = { id, fileName, buttonEl: button, panelEl: panel, score, kind, onClose };

    // An audio track belongs beside the song it came from rather than at the end of the strip.
    const anchorIndex = insertAfterTabId === null
        ? -1
        : tabs.findIndex(existing => existing.id === insertAfterTabId);

    if (anchorIndex >= 0) {
        tabs[anchorIndex].buttonEl.after(button);
        tabs[anchorIndex].panelEl.after(panel);
        tabs.splice(anchorIndex + 1, 0, tab);
    } else {
        tablistElement.append(button);
        tabpanelsElement.append(panel);
        tabs.push(tab);
    }

    updateEmptyState();
    return tab;
}

/**
 * Makes a tab current and moves focus.
 *
 * `focusContent` puts focus on the panel itself rather than the tab button, which is what a
 * screen reader needs to drop into its document-reading mode with the cursor at the top of the
 * content: landing on a non-form-control inside a document does that across screen readers,
 * with nothing vendor-specific. Every way of reaching a tab uses it except arrowing within the
 * tab strip, where focus has to stay on the buttons or moving across several tabs would be
 * impossible.
 */
/**
 * Closes every expanded disclosure in a panel.
 *
 * Collapsed content is out of the accessibility tree, so this hands a screen reader back a small
 * panel. Coming back to a tab that still has a track's measures expanded means taking in every
 * beat again, which can leave the reader unresponsive for seconds -- and it happens even when
 * returning to the very tab just left, since re-showing the panel is what triggers the re-read.
 * Collapsing on the way out is what makes returning cheap.
 */
function collapseDisclosures(panelEl) {
    for (const details of panelEl.querySelectorAll('details[open]')) details.open = false;
}

function activateTab(id, { focusContent = false } = {}) {
    const tab = tabs.find(t => t.id === id);
    if (!tab) return;

    // Collapse before anything is shown or hidden, so the DOM settles in one pass rather than
    // mutating a panel that a screen reader is already being pointed at.
    if (screenReaderSettings.autoCollapseOnTabChange) {
        for (const t of tabs) {
            if (t.id !== id) collapseDisclosures(t.panelEl);
        }
    }

    for (const t of tabs) {
        const isActive = t.id === id;
        t.buttonEl.setAttribute('aria-selected', String(isActive));
        t.buttonEl.tabIndex = isActive ? 0 : -1;
        t.panelEl.hidden = !isActive;
    }
    activeTabId = id;
    if (focusContent) tab.panelEl.focus();
    else tab.buttonEl.focus();
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
        activateTab(tabs[nextIndex].id, { focusContent: true });
    }
}

function shiftActiveTab(delta, { focusContent = false } = {}) {
    if (tabs.length === 0) return;
    const currentIndex = tabs.findIndex(t => t.id === activeTabId);
    const newIndex = (currentIndex + delta + tabs.length) % tabs.length;
    activateTab(tabs[newIndex].id, { focusContent });
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

// Ctrl+Tab and Ctrl+Shift+Tab cycle tabs from anywhere in the window, not only when focus
// happens to be in the tab strip. These used to come from menu accelerators on the Tabs menu;
// that menu is gone, so the renderer owns them now.
document.addEventListener('keydown', event => {
    if (event.key !== 'Tab' || !event.ctrlKey || event.altKey || event.metaKey) return;
    if (tabs.length < 2) return;
    // A modal dialog owns the keyboard while it is up; switching tabs underneath it would
    // leave focus somewhere the user cannot see.
    if (document.querySelector('dialog[open]')) return;

    event.preventDefault();
    shiftActiveTab(event.shiftKey ? -1 : 1, { focusContent: true });
});

function buildSongMetadata(score) {
    return extractScoreMetadata(score, { terseBeats: screenReaderSettings.terseBeatDescriptions });
}

/**
 * Rebuilds the summary of every open song tab. Called when the beat-description setting changes,
 * so the change is visible in files already open rather than only in the next one. Cheap enough to
 * do outright: extracting the metadata and building the panel measure in fractions of a
 * millisecond, and the measures themselves are still only built when a disclosure is opened.
 */
function rebuildOpenSongPanels() {
    for (const tab of tabs) {
        if (!tab.score) continue;
        const meta = buildSongMetadata(tab.score);
        const content = buildSummaryPanel(meta, {
            onCreateAudioTrack: trackIndex => openAudioTrackTab(tab.score, trackIndex, tab.id)
        });
        tab.panelEl.replaceChildren(content);
    }
}

function handleFileOpened({ fileName, data }) {
    let contentEl;
    let isError = false;

    let score;
    // Resolved when the tab exists, so an audio track can be inserted next to its song.
    let songTabId = null;

    try {
        score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(data);
        const meta = buildSongMetadata(score);
        contentEl = buildSummaryPanel(meta, {
            onCreateAudioTrack: trackIndex => openAudioTrackTab(score, trackIndex, songTabId)
        });
        setStatus(`Opened "${fileName}". Found ${meta.tracks.length} track${meta.tracks.length === 1 ? '' : 's'}.`);
    } catch (error) {
        isError = true;
        const message = `Could not read "${fileName}": ${error && error.message ? error.message : 'unrecognized file format.'}`;
        contentEl = buildErrorPanel(message);
        setStatus(message);
    }

    const tab = createTab(fileName, contentEl, { isError, score });
    songTabId = tab.id;
    activateTab(tab.id, { focusContent: true });
}

function handleFileOpenError({ fileName, message }) {
    const fullMessage = `Could not open "${fileName}": ${message}`;
    const tab = createTab(fileName, buildErrorPanel(fullMessage), { isError: true });
    activateTab(tab.id, { focusContent: true });
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

// --- Help documents (Help menu) ---
// The content is generated from README.md at build time by scripts/build-help.mjs and bundled here,
// so a copy of the app shows the README as it stood when that copy was built. The file in the
// repository moves on independently; editing it changes nothing here until `npm run build:help` is
// run, which keeps a release and its documentation in step.
//
// All of them are dialogs. A tab was tried for the long one, but a tab persists, and a panel holding
// a whole document costs a screen reader time on every visit to it -- the same reason a track's
// measures sit behind a disclosure. A dialog is read and dismissed, so the cost is paid once and
// nothing is left behind among the song and playback tabs.

const HELP_DIALOGS = {
    'what-is': { dialog: whatIsDialog, body: whatIsBodyElement, ok: whatIsOkButton, html: 'whatIsHtml' },
    'screen-reader': { dialog: screenReaderDialog, body: screenReaderBodyElement, ok: screenReaderOkButton, html: 'screenReaderHtml' },
    feedback: { dialog: feedbackDialog, body: feedbackBodyElement, ok: feedbackOkButton, html: 'feedbackHtml' }
};

let helpDialogOpener = null;

for (const spec of Object.values(HELP_DIALOGS)) {
    spec.ok.addEventListener('click', () => spec.dialog.close());

    spec.dialog.addEventListener('close', () => {
        if (helpDialogOpener && typeof helpDialogOpener.focus === 'function') helpDialogOpener.focus();
        helpDialogOpener = null;
    });

    // Following a link dismisses the dialog: it is modal, so leaving it up over a browser window
    // that has just taken focus would trap the keyboard here. Escape closes it too, from <dialog>.
    spec.dialog.addEventListener('click', event => {
        const link = event.target.closest('a');
        if (!link) return;
        event.preventDefault();
        const href = link.href;
        spec.dialog.close();
        window.unstrung.openExternalLink(href);
    });
}

function openHelpDialog(topic) {
    const spec = HELP_DIALOGS[topic] ?? HELP_DIALOGS['what-is'];
    // Filled once, on first opening: the content is fixed at build time and cannot change while
    // the app is running.
    if (spec.body.childElementCount === 0) {
        spec.body.innerHTML = helpContent[spec.html] ?? '';
    }
    helpDialogOpener = document.activeElement;
    spec.dialog.showModal();
    spec.dialog.focus();
}

window.unstrung.onHelpOpen(({ topic }) => openHelpDialog(topic));
// --- end Help documents ---

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

// --- Spoken note names (Tools menu, experimental) --------------------------------------
//
// Speaks each note or chord immediately before it sounds, so a passage can be followed by ear.
//
// THE MUSIC KEEPS TIME, NOT THE SPEECH. Notes and clicks are scheduled in the audio graph up
// front, exactly as the audio track does, and nothing the speech does can move them. Speech is
// started on an ordinary timer sized to finish before its note. An announcement that starts late
// or runs long overlaps its note; the beat does not shift. That is the whole reason the tempo
// stays steady while the speech does not.
//
// Two measured facts shape the rest, both from driving this engine and timing it:
//
// 1. A third to a half of every utterance is silence after the last word. Waiting for the `end`
//    event therefore throws away that much of the tempo. Instead each phrase is timed once to
//    find where its speech actually stops -- the last word boundary plus that word's length --
//    and the utterance is abandoned there. Cancelling mid-utterance and immediately speaking the
//    next one is reliable: over a sustained run every announcement still reached its last word.
//
// 2. Phrase timings are extremely stable, within about ten milliseconds run to run, so timing a
//    phrase once is enough to schedule every later use of it.
//
// The speech engine is the browser's own, so this carries no dependency and no platform code, at
// the cost of not being able to pitch the speech: the API hands out no audio, only sound.

const speakNotesDialog = document.getElementById('speak-notes-dialog');
const speakNotesPassageSelect = document.getElementById('speak-notes-passage-select');
const speakNotesRateSelect = document.getElementById('speak-notes-rate-select');
const speakNotesVoiceSelect = document.getElementById('speak-notes-voice-select');
const speakNotesTempoInput = document.getElementById('speak-notes-tempo-input');
const speakNotesMetronomeCheckbox = document.getElementById('speak-notes-metronome-checkbox');
const speakNotesDurationCheckbox = document.getElementById('speak-notes-duration-checkbox');
const speakNotesGuitarCheckbox = document.getElementById('speak-notes-guitar-checkbox');
const speakNotesLimitElement = document.getElementById('speak-notes-limit');
const speakNotesStatusElement = document.getElementById('speak-notes-status');
const speakNotesPlayButton = document.getElementById('speak-notes-play-button');
const speakNotesOkButton = document.getElementById('speak-notes-ok-button');

const SPEAK_NOTES_PLAY_LABEL = 'Play Passage';
const SPEAK_NOTES_STOP_LABEL = 'Stop';

// Allowed for the final word to finish after its boundary event fires. Closing words measured
// 75-150 ms at rate 4 and less above that, so this is generous at every offered rate. Erring
// long costs tempo; erring short clips the end of the last word, which is the better failure.
const SPEAK_NOTES_TAIL_MS = 140;

// Head start on each announcement, covering the gap between calling speak() and the engine
// starting. Measured at 20-30 ms typical and about 50 ms at worst once the voice is warm.
const SPEAK_NOTES_LATENCY_MS = 60;

const SPEAK_NOTES_VELOCITY = 'mf';
const SPEAK_NOTES_STRUM_DELAY_SECONDS = 0.02; // matches the audio track's strum spread
const SPEAK_NOTES_NOTE_GAIN = 0.7;
const SPEAK_NOTES_RING_SECONDS = 2.2;

let speakNotesToken = 0;
let speakNotesMasterGain = null;
let speakNotesSources = [];
let speakNotesTimers = [];
// Measured speech lengths, keyed by voice, rate and text. Timings do not change within a
// session, so a phrase met again in another passage costs nothing the second time.
const speakNotesPhraseCache = new Map();
let speakNotesDialogOpener = null;
let speakNotesVoicesLoaded = false;

/**
 * The built-in passages.
 *
 * `beat` is in quarter notes from the start. `midi` is one note, or several for a strum, given
 * low string to high. `phrase` overrides the spoken text, which is how a chord announces its name
 * rather than its notes. `duration` is the word used when durations are being spoken.
 *
 * Deliberately covers the two ends of the range: single notes are short to say and run fast,
 * while a chord with a quality and a strum direction is the longest thing that ever has to fit.
 */
const SPEAK_NOTES_PASSAGES = [
    {
        id: 'single-quarters',
        name: 'Single notes, one per beat',
        beatsPerBar: 4,
        events: [
            { beat: 0, midi: [40], duration: 'quarter' },
            { beat: 1, midi: [43], duration: 'quarter' },
            { beat: 2, midi: [45], duration: 'quarter' },
            { beat: 3, midi: [47], duration: 'quarter' },
            { beat: 4, midi: [50], duration: 'quarter' },
            { beat: 5, midi: [52], duration: 'quarter' },
            { beat: 6, midi: [55], duration: 'quarter' },
            { beat: 7, midi: [57], duration: 'quarter' },
            { beat: 8, midi: [59], duration: 'quarter' },
            { beat: 9, midi: [62], duration: 'quarter' },
            { beat: 10, midi: [64], duration: 'quarter' },
            { beat: 11, midi: [62], duration: 'quarter' },
            { beat: 12, midi: [59], duration: 'quarter' },
            { beat: 13, midi: [55], duration: 'quarter' },
            { beat: 14, midi: [50], duration: 'quarter' },
            { beat: 15, midi: [40], duration: 'quarter' }
        ]
    },
    {
        id: 'chords',
        name: 'Chords, one per beat (the slowest case)',
        beatsPerBar: 4,
        events: [
            { beat: 0, midi: [40, 47, 52, 55, 59, 64], phrase: 'E minor 7 up', duration: 'quarter' },
            { beat: 1, midi: [45, 52, 57, 60, 64], phrase: 'A minor down', duration: 'quarter' },
            { beat: 2, midi: [43, 47, 50, 55, 59, 67], phrase: 'G major up', duration: 'quarter' },
            { beat: 3, midi: [48, 52, 55, 60, 64], phrase: 'C major down', duration: 'quarter' },
            { beat: 4, midi: [42, 49, 54, 57, 61, 66], phrase: 'F sharp minor 7 up', duration: 'quarter' },
            { beat: 5, midi: [45, 52, 57, 60, 64], phrase: 'A minor down', duration: 'quarter' },
            { beat: 6, midi: [40, 47, 52, 56, 59, 64], phrase: 'E major up', duration: 'quarter' },
            { beat: 7, midi: [40, 47, 52, 55, 59, 64], phrase: 'E minor 7 down', duration: 'quarter' }
        ]
    },
    {
        id: 'mixed',
        name: 'Mixed: chords with eighth-note runs',
        beatsPerBar: 4,
        events: [
            { beat: 0, midi: [43, 47, 50, 55, 59, 67], phrase: 'G major up', duration: 'quarter' },
            { beat: 1, midi: [55], duration: 'eighth' },
            { beat: 1.5, midi: [57], duration: 'eighth' },
            { beat: 2, midi: [59], duration: 'eighth' },
            { beat: 2.5, midi: [62], duration: 'eighth' },
            { beat: 3, midi: [64], duration: 'quarter' },
            { beat: 4, midi: [48, 52, 55, 60, 64], phrase: 'C major down', duration: 'quarter' },
            { beat: 5, midi: [60], duration: 'eighth' },
            { beat: 5.5, midi: [59], duration: 'eighth' },
            { beat: 6, midi: [57], duration: 'eighth' },
            { beat: 6.5, midi: [55], duration: 'eighth' },
            { beat: 7, midi: [52], duration: 'quarter' }
        ]
    }
];

/** "C#3" as the speech engine needs it said: "C sharp 3". */
function spokenNoteName(midi) {
    const name = midiToPitchName(midi);
    return name.replace('#', ' sharp').replace('b', ' flat').replace(/(\d)$/, ' $1');
}

function speakNotesPhraseFor(event, withDuration) {
    const body = event.phrase ?? spokenNoteName(event.midi[0]);
    return withDuration && event.duration ? `${event.duration} ${body}` : body;
}

function speakNotesSelectedPassage() {
    return SPEAK_NOTES_PASSAGES.find(p => p.id === speakNotesPassageSelect.value) ?? SPEAK_NOTES_PASSAGES[0];
}

/**
 * Waits for the voice list, which starts empty and fills asynchronously.
 *
 * Listening for `voiceschanged` is a trap: it fires once while the list is still empty, so a
 * one-shot listener reads zero voices and concludes the machine has none. Poll instead.
 */
async function speakNotesLoadVoices() {
    const deadline = performance.now() + 5000;
    while (performance.now() < deadline) {
        const voices = speechSynthesis.getVoices();
        if (voices.length > 0) return voices;
        await waitSeconds(0.1);
    }
    return speechSynthesis.getVoices();
}

function speakNotesSelectedVoice() {
    const name = speakNotesVoiceSelect.value;
    return speechSynthesis.getVoices().find(v => v.name === name) ?? null;
}

/**
 * Times one phrase: how long until its speech actually stops, ignoring the trailing silence.
 *
 * Spoken at zero volume, which measures the same as speaking aloud to within a fifth of a percent.
 * The utterance is abandoned as soon as the last word has been reached, so timing a phrase costs
 * about what saying it costs rather than the full utterance with its dead air.
 *
 * Boundary events can repeat a position, so words are counted by distinct character index. If the
 * engine gives no usable boundaries the full utterance length is used, which is safe but slower.
 */
function speakNotesMeasurePhrase(text, rate, voice) {
    return new Promise(resolve => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = rate;
        utterance.volume = 0;
        if (voice) utterance.voice = voice;

        const wordCount = text.trim().split(/\s+/).length;
        const seen = new Set();
        let startedAt = null, lastWordAt = null, settled = false;

        const finish = ms => {
            if (settled) return;
            settled = true;
            clearTimeout(guard);
            speechSynthesis.cancel();
            resolve(ms);
        };
        // Never let a phrase hang the run: 6 s is far beyond any announcement.
        const guard = setTimeout(() => finish(6000), 6000);

        utterance.onstart = () => { startedAt = performance.now(); };
        utterance.onboundary = event => {
            if (startedAt === null || seen.has(event.charIndex)) return;
            seen.add(event.charIndex);
            lastWordAt = performance.now() - startedAt;
            if (seen.size >= wordCount) finish(lastWordAt + SPEAK_NOTES_TAIL_MS);
        };
        utterance.onerror = () => finish(0);
        utterance.onend = () => finish(
            lastWordAt === null
                ? (startedAt === null ? 0 : performance.now() - startedAt)
                : lastWordAt + SPEAK_NOTES_TAIL_MS);

        speechSynthesis.cancel();
        speechSynthesis.speak(utterance);
    });
}

/** Measures every phrase the passage needs, reusing anything already timed this session. */
async function speakNotesMeasureAll(phrases, rate, voice, myToken) {
    const measured = new Map();
    for (const text of phrases) {
        if (myToken !== speakNotesToken) return null;
        const cacheKey = `${voice ? voice.name : 'default'}:${rate}:${text}`;
        if (!speakNotesPhraseCache.has(cacheKey)) {
            speakNotesPhraseCache.set(cacheKey, await speakNotesMeasurePhrase(text, rate, voice));
        }
        measured.set(text, speakNotesPhraseCache.get(cacheKey));
    }
    return measured;
}

/**
 * The fastest tempo at which every announcement still finishes before its note.
 *
 * Each event needs its phrase, plus a head start for the engine, to fit in the gap since the
 * previous announcement began. The tightest of those gaps sets the limit for the whole passage,
 * which is why a passage of single notes runs so much faster than one full of chords.
 */
function speakNotesMaxTempo(events, measured) {
    let worstBeatsPerMs = Infinity;
    for (let i = 1; i < events.length; i++) {
        const beats = events[i].beat - events[i - 1].beat;
        const needed = measured.get(events[i].text) + SPEAK_NOTES_LATENCY_MS;
        worstBeatsPerMs = Math.min(worstBeatsPerMs, beats / needed);
    }
    if (!Number.isFinite(worstBeatsPerMs)) return 300;
    return Math.floor(worstBeatsPerMs * 60000);
}

function speakNotesStop() {
    speakNotesToken++;
    speechSynthesis.cancel();

    for (const timer of speakNotesTimers) clearTimeout(timer);
    speakNotesTimers = [];

    if (speakNotesMasterGain && sharedAudioContext) {
        const now = sharedAudioContext.currentTime;
        const gain = speakNotesMasterGain.gain;
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(gain.value, now);
        gain.linearRampToValueAtTime(0, now + 0.04);
        for (const source of speakNotesSources) {
            try { source.stop(now + 0.04); } catch { /* already stopped */ }
        }
    }
    speakNotesMasterGain = null;
    speakNotesSources = [];

    speakNotesPlayButton.textContent = SPEAK_NOTES_PLAY_LABEL;
    speakNotesPlayButton.setAttribute('aria-pressed', 'false');
}

/**
 * Fetches one guitar note, decoded into the shared context this dialog schedules against.
 *
 * The Tools sample player keeps its own context, so its loader cannot be reused here: a buffer
 * has to be decoded by the context that will play it back at that context's sample rate.
 * Never rejects, so one missing sample cannot abort the passage.
 */
async function speakNotesLoadNoteBuffer(key, seconds) {
    try {
        const bytes = await window.unstrung.getGuitarSampleAudio(key, SPEAK_NOTES_VELOCITY, seconds);
        const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        return await getSharedAudioContext().decodeAudioData(arrayBuffer);
    } catch {
        return null;
    }
}

/** Snaps a wanted pitch to the nearest note the sample pack actually recorded. */
function speakNotesNearestSampleKey(notes, midi) {
    let best = notes[0].key;
    for (const note of notes) {
        if (Math.abs(note.key - midi) < Math.abs(best - midi)) best = note.key;
    }
    return best;
}

function speakNotesScheduleNote(buffer, at) {
    const context = getSharedAudioContext();
    const source = context.createBufferSource();
    source.buffer = buffer;

    const ring = Math.min(SPEAK_NOTES_RING_SECONDS, buffer.duration);
    const gain = context.createGain();
    gain.gain.setValueAtTime(SPEAK_NOTES_NOTE_GAIN, at);
    gain.gain.setValueAtTime(SPEAK_NOTES_NOTE_GAIN, at + ring - 0.2);
    gain.gain.linearRampToValueAtTime(0, at + ring);

    source.connect(gain).connect(speakNotesMasterGain);
    source.start(at);
    source.stop(at + ring + 0.01);
    speakNotesSources.push(source);
}

async function speakNotesPlay() {
    const myToken = speakNotesToken;
    const passage = speakNotesSelectedPassage();
    const rate = Number(speakNotesRateSelect.value) || 8;
    const voice = speakNotesSelectedVoice();
    const withDuration = speakNotesDurationCheckbox.checked;

    const events = passage.events.map(event => ({
        ...event,
        text: speakNotesPhraseFor(event, withDuration)
    }));

    // --- Time every phrase before anything is scheduled ---------------------------------
    speakNotesStatusElement.textContent = 'Timing the phrases…';
    const distinct = [...new Set(events.map(e => e.text))];
    const measured = await speakNotesMeasureAll(distinct, rate, voice, myToken);
    if (myToken !== speakNotesToken || !measured) return;

    const maxTempo = speakNotesMaxTempo(events, measured);
    const wanted = Math.max(20, Number(speakNotesTempoInput.value) || 90);
    // A floor of 20 keeps an absurdly long phrase from stalling the passage entirely; at that
    // point the announcement overlaps its note, which is the documented failure rather than a bug.
    const tempo = Math.max(20, Math.min(wanted, maxTempo));

    const longest = distinct.reduce((a, b) => (measured.get(a) >= measured.get(b) ? a : b));
    speakNotesLimitElement.textContent =
        `Longest phrase "${longest}" takes ${Math.round(measured.get(longest))} milliseconds. ` +
        `Fastest tempo these phrases fit: ${maxTempo}.` +
        (tempo < wanted ? ` Playing at ${tempo} instead of ${wanted}.` : '');

    const secondsPerBeat = 60 / tempo;

    // --- Schedule the music. Nothing after this point can move it. ----------------------
    const context = getSharedAudioContext();
    if (context.state === 'suspended') await context.resume();
    if (myToken !== speakNotesToken) return;

    speakNotesMasterGain = context.createGain();
    speakNotesMasterGain.gain.value = 1;
    speakNotesMasterGain.connect(context.destination);
    speakNotesSources = [];

    // Buffers first, so no note is waiting on a fetch once the clock is running.
    const buffersByMidi = new Map();
    if (speakNotesGuitarCheckbox.checked) {
        speakNotesStatusElement.textContent = 'Loading guitar notes…';
        const sampleNotes = await loadGuitarSampleNotesOnce();
        if (myToken !== speakNotesToken) return;

        const wantedMidi = [...new Set(events.flatMap(e => e.midi))];
        for (const midi of wantedMidi) {
            const key = speakNotesNearestSampleKey(sampleNotes, midi);
            const buffer = await speakNotesLoadNoteBuffer(key, SPEAK_NOTES_RING_SECONDS + 0.15);
            if (myToken !== speakNotesToken) return;
            if (buffer) buffersByMidi.set(midi, buffer);
        }
    }
    if (myToken !== speakNotesToken) return;

    // A count-in bar, so the first announcement has somewhere to happen before the music starts.
    const lastBeat = events[events.length - 1].beat;
    const countInBeats = passage.beatsPerBar;
    const zero = context.currentTime + 0.3;
    const musicStart = zero + countInBeats * secondsPerBeat;
    const beatTime = beat => musicStart + beat * secondsPerBeat;

    if (speakNotesMetronomeCheckbox.checked) {
        const totalBeats = countInBeats + Math.ceil(lastBeat) + 1;
        for (let beat = 0; beat < totalBeats; beat++) {
            const at = zero + beat * secondsPerBeat;
            const accent = (beat % passage.beatsPerBar) === 0;
            speakNotesSources.push(
                scheduleMetronomeClick(context, speakNotesMasterGain, at, accent));
        }
    }

    for (const event of events) {
        const at = beatTime(event.beat);
        for (const [index, midi] of event.midi.entries()) {
            const buffer = buffersByMidi.get(midi);
            if (buffer) speakNotesScheduleNote(buffer, at + index * SPEAK_NOTES_STRUM_DELAY_SECONDS);
        }
    }

    // --- Speech runs alongside on ordinary timers, and cannot disturb the above ---------
    for (const event of events) {
        const speakAt = beatTime(event.beat)
            - (measured.get(event.text) + SPEAK_NOTES_LATENCY_MS) / 1000;
        const delayMs = (speakAt - context.currentTime) * 1000;

        speakNotesTimers.push(setTimeout(() => {
            if (myToken !== speakNotesToken) return;
            const utterance = new SpeechSynthesisUtterance(event.text);
            utterance.rate = rate;
            if (voice) utterance.voice = voice;
            // Abandon whatever is still in its trailing silence rather than queueing behind it.
            speechSynthesis.cancel();
            speechSynthesis.speak(utterance);
        }, Math.max(0, delayMs)));
    }

    speakNotesStatusElement.textContent =
        `Playing ${passage.name} at ${tempo} beats per minute.`;

    const endsAt = beatTime(lastBeat) + SPEAK_NOTES_RING_SECONDS;
    speakNotesTimers.push(setTimeout(() => {
        if (myToken !== speakNotesToken) return;
        speechSynthesis.cancel();
        speakNotesStatusElement.textContent = 'Finished.';
        speakNotesPlayButton.textContent = SPEAK_NOTES_PLAY_LABEL;
        speakNotesPlayButton.setAttribute('aria-pressed', 'false');
    }, Math.max(0, (endsAt - context.currentTime) * 1000)));
}

speakNotesPlayButton.addEventListener('click', () => {
    const wasPlaying = speakNotesPlayButton.getAttribute('aria-pressed') === 'true';
    speakNotesStop();

    if (wasPlaying) {
        speakNotesStatusElement.textContent = 'Stopped.';
        return;
    }
    speakNotesPlayButton.textContent = SPEAK_NOTES_STOP_LABEL;
    speakNotesPlayButton.setAttribute('aria-pressed', 'true');
    speakNotesPlay();
});

speakNotesOkButton.addEventListener('click', () => speakNotesDialog.close());

speakNotesDialog.addEventListener('close', () => {
    speakNotesStop();
    if (speakNotesDialogOpener && typeof speakNotesDialogOpener.focus === 'function') {
        speakNotesDialogOpener.focus();
    }
    speakNotesDialogOpener = null;
});

// Changing anything that affects the timing invalidates the figure on screen.
for (const control of [speakNotesPassageSelect, speakNotesRateSelect, speakNotesVoiceSelect,
    speakNotesDurationCheckbox]) {
    control.addEventListener('change', () => { speakNotesLimitElement.textContent = ''; });
}

async function openSpeakNotesDialog() {
    speakNotesDialogOpener = document.activeElement;

    if (speakNotesPassageSelect.options.length === 0) {
        for (const passage of SPEAK_NOTES_PASSAGES) {
            const option = document.createElement('option');
            option.value = passage.id;
            option.textContent = passage.name;
            speakNotesPassageSelect.append(option);
        }
    }

    speakNotesDialog.showModal();
    speakNotesDialog.focus();
    speakNotesLimitElement.textContent = '';
    speakNotesStatusElement.textContent = '';

    if (!speakNotesVoicesLoaded) {
        const voices = await speakNotesLoadVoices();
        speakNotesVoiceSelect.replaceChildren();
        if (voices.length === 0) {
            speakNotesStatusElement.textContent =
                'No speech voices are available, so nothing can be spoken.';
        }
        for (const voice of voices) {
            const option = document.createElement('option');
            option.value = voice.name;
            option.textContent = voice.name + (voice.default ? ' (default)' : '');
            if (voice.default) option.selected = true;
            speakNotesVoiceSelect.append(option);
        }
        speakNotesVoicesLoaded = true;
    }
}

window.unstrung.onSpeakNotesOpen(openSpeakNotesDialog);
// --- end spoken note names ---

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

const settingsTerseBeatsCheckbox = document.getElementById('settings-terse-beats-checkbox');
const settingsAutoCollapseCheckbox = document.getElementById('settings-auto-collapse-checkbox');

const settingsTabs = [
    { id: 'general', buttonEl: document.getElementById('settings-tab-general'), panelEl: document.getElementById('settings-panel-general') },
    { id: 'files', buttonEl: document.getElementById('settings-tab-files'), panelEl: document.getElementById('settings-panel-files') },
    { id: 'screenreader', buttonEl: document.getElementById('settings-tab-screenreader'), panelEl: document.getElementById('settings-panel-screenreader') }
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

async function saveScreenReaderSettings() {
    screenReaderSettings = await window.unstrung.saveScreenReaderSettings({
        terseBeatDescriptions: settingsTerseBeatsCheckbox.checked,
        autoCollapseOnTabChange: settingsAutoCollapseCheckbox.checked
    });
}

settingsTerseBeatsCheckbox.addEventListener('change', async () => {
    await saveScreenReaderSettings();
    // Rebuilt while the dialog is up, so no focus is disturbed: the panels being replaced are
    // behind the modal, and the user returns to them afterwards.
    rebuildOpenSongPanels();
});

// Nothing to rebuild: this one only changes what happens on the next tab switch.
settingsAutoCollapseCheckbox.addEventListener('change', saveScreenReaderSettings);

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
    settingsTerseBeatsCheckbox.checked = settings.terseBeatDescriptions === true;
    settingsAutoCollapseCheckbox.checked = settings.autoCollapseOnTabChange !== false;
    settingsFilesStatusElement.textContent = '';
    activateSettingsTab('general');
    settingsDialog.showModal();
    settingsTabs[0].buttonEl.focus();
}

window.unstrung.onSettingsOpen(openSettingsDialog);

// Loaded once at startup so the first file opened is described according to the saved setting,
// rather than needing the Settings dialog to have been visited first.
(async () => {
    const settings = await window.unstrung.getSettings();
    screenReaderSettings = {
        terseBeatDescriptions: settings.terseBeatDescriptions === true,
        autoCollapseOnTabChange: settings.autoCollapseOnTabChange !== false
    };
})();
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

/**
 * A chord the parser can name in a measure but that no fingering is known for. It is listed
 * so that looking it up answers the question rather than returning nothing, which is what
 * used to happen. The difficulty setting cannot hide it, because that setting filters
 * voicings and there are none to filter.
 */
function isUnfingered(chord) {
    return chord.voicings.length === 0;
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
        return isUnfingered(chord) || visibleVoicings(chord).length > 0;
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
 * The body of a result row for a chord with no known fingering.
 *
 * The missing fingering is stated on the chord's own line, so it is known before the row is
 * opened. Its notes are certain, since they come from the chord's interval formula rather than
 * from any dataset, so they and the rest of what is known sit in the disclosure below.
 */
function buildUnfingeredChordRow(chord) {
    const fragment = document.createDocumentFragment();

    const name = document.createElement('span');
    name.textContent = `${chord.name} - ${baseQualityLabel(chord)}, fingering unknown`;

    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = `Metadata for ${chord.name}`;
    const list = document.createElement('ul');
    appendTextItems(list, [
        `Notes: ${(chord.notes ?? []).join(', ')}`,
        `Genres: ${chord.genres.join(', ')}`,
        'Cannot play sample without voicing (fingering)'
    ]);
    details.append(summary, list);

    fragment.append(name, details);
    return fragment;
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

    // Nothing to tick when there is no fingering: a checkbox here would offer a playback
    // that cannot happen. The row states what the chord is and says the fingering is not
    // known, which is the whole reason it is listed.
    if (isUnfingered(chord)) {
        item.append(buildUnfingeredChordRow(chord));
        return { item, box: null, voicingBoxes: [] };
    }

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

    // Only chords that can actually be played are worth queueing.
    const playable = chordsMatches.filter(chord => !isUnfingered(chord));
    if (playable.length === 0) return;

    const shortest = playable.reduce((best, chord) =>
        chord.name.length < best.name.length ? chord : best, playable[0]);
    chordsSelection.set(shortest.name, new Set([0]));

    const row = chordRowsByName.get(shortest.name);
    if (row?.box) {
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

let sharedAudioContext = null;
let chordMasterGain = null;
let chordActiveSources = [];
let chordPlaybackToken = 0;
const sampleBufferCache = new Map();

function getSharedAudioContext() {
    if (!sharedAudioContext) sharedAudioContext = new AudioContext();
    return sharedAudioContext;
}

function stopChordPlayback() {
    chordPlaybackToken++;

    // Notes may be ringing for several seconds now, so cutting the sources dead would
    // click. Fade the whole strum out instead.
    if (chordMasterGain && sharedAudioContext) {
        const now = sharedAudioContext.currentTime;
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
    if (!sampleBufferCache.has(cacheKey)) {
        const bytes = await window.unstrung.getGuitarSampleAudio(
            note.midi, note.velocity, chordSampleRequestSeconds(note));
        const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        sampleBufferCache.set(cacheKey, await getSharedAudioContext().decodeAudioData(arrayBuffer));
    }
    return sampleBufferCache.get(cacheKey);
}

async function playChordSelection(voicings, label) {
    stopChordPlayback();
    const myToken = chordPlaybackToken;
    const context = getSharedAudioContext();
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
        // Same landing as when the tab was first opened: the search field is the first
        // thing you use here, so returning to the tab puts you straight back on it.
        chordsUi?.searchInput.focus();
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
const fretsTuningSelect = document.getElementById('frets-tuning-select');

let fretsDialogOpener = null;
let fretsIdentifiedName = null;

function fretsTuning() {
    return TUNINGS.find(t => t.id === fretsTuningSelect.value) ?? TUNINGS[0];
}

/**
 * Names each string by the note it actually sounds open, so the labels follow the tuning
 * instead of asserting standard. Octaves are always given: in most tunings a note letter
 * appears on more than one string, and "String 6, D2" says which D without the reader having
 * to work it out.
 */
function updateFretStringLabels() {
    const tuning = fretsTuning();
    for (const stringNumber of STRING_NUMBERS) {
        const label = document.getElementById(`frets-string-${stringNumber}-label`);
        if (label) label.textContent = `String ${stringNumber}, ${midiToPitchName(tuning.midi[stringNumber])}`;
    }
}

function populateFretSelects() {
    if (fretsTuningSelect.options.length === 0) {
        for (const tuning of TUNINGS) addOption(fretsTuningSelect, tuning.id, tuning.name);
        fretsTuningSelect.value = TUNINGS[0].id;
    }
    for (const select of fretsSelects.values()) {
        if (select.options.length > 0) continue;
        addOption(select, '0', 'open');
        addOption(select, '-1', 'not played');
        for (let fret = 1; fret <= FRETS_MAX_FRET; fret++) addOption(select, String(fret), String(fret));
        select.value = '0';
    }
    updateFretStringLabels();
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

/**
 * The names the chord library could be filing a theory reading under.
 *
 * The two describe the same chord differently when the root is not the lowest note: theory
 * reports "Am" and separately that C is in the bass, where the library writes that as "Am/C".
 * Without treating the slash form as the same reading, the library's own correct entry would
 * look like a disagreement and its fingering would go uncredited.
 */
function libraryNamesFor(candidate) {
    const names = [candidate.name];
    if (!candidate.rootInBass && candidate.bass) {
        const shorthand = candidate.suffix === 'major' ? ''
            : candidate.suffix === 'minor' ? 'm'
            : candidate.suffix;
        names.push(`${candidate.root}${shorthand}/${candidate.bass}`);
    }
    return names;
}

function renderFretsResult() {
    const selection = currentFretSelection();
    const tuning = fretsTuning();
    const isStandard = tuning.id === 'standard';
    const sounded = STRING_NUMBERS
        .filter(stringNumber => selection.get(stringNumber) >= 0)
        .map(stringNumber => ({
            string: stringNumber,
            fret: selection.get(stringNumber),
            midi: fretToMidi(stringNumber, selection.get(stringNumber), tuning.midi)
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
    if (!isStandard) rows.push(`Tuning: ${tuning.name}`);

    // The name always comes from the notes. The chord library is a record of which shapes are
    // conventional and how they are fingered, not an authority on what a set of notes is called:
    // its voicings are filed under every chord whose formula they do not contradict, so a shape
    // can sit under a name it only partly spells, and picking the first such entry means picking
    // by array order. Naming from pitch instead is both defensible and tuning-independent.
    const candidates = identifyChordFromNotes(sounded.map(n => n.midi));

    // Library shapes are frets in standard tuning, so in any other tuning the same positions
    // sound different notes and none of this applies.
    const shapeMatches = isStandard ? findLibraryShapeMatches(selection) : [];

    // A library entry counts as agreeing only if the notes really do spell the name it is filed
    // under. Where it agrees, everything it knows is worth having.
    const aligned = shapeMatches.find(m =>
        candidates.some(c => libraryNamesFor(c).includes(m.chord.name))) ?? null;

    // Fingering is the exception: it describes the physical shape, which is the same whatever
    // name the shape is filed under, so it stays useful even when the name does not agree.
    const fingering = aligned ?? shapeMatches[0] ?? null;

    if (candidates.length === 0) {
        fretsResultHeading.textContent = 'Identified Chord: no chord matches these notes';
        rows.push('These notes do not spell a chord Unstrung recognises.');
        if (fingering) {
            rows.push(`The chord library files this shape under ${fingering.chord.name}, ` +
                'but these notes do not spell that chord completely.');
        }
    } else {
        const best = candidates[0];
        fretsIdentifiedName = best.name;
        fretsResultHeading.textContent = `Identified Chord: ${best.name}`;
        // The bass note is already stated in the name, so the quality gives only the quality.
        const quality = aligned ? baseQualityLabel(aligned.chord)
            : (QUALITY_LABELS[best.suffix] ?? best.suffix);
        rows.unshift(`${best.name}${best.rootInBass ? '' : `, with ${best.bass} in the bass`}` +
            ` - ${quality}`);

        if (aligned) {
            rows.push(`This is a standard shape: chord library voicing option ${aligned.index + 1}.`);
            if (aligned.voicing.shape) rows.push(`Shape: ${aligned.voicing.shape}`);
            rows.push(`Difficulty: ${CONFIDENCE_LABELS[aligned.voicing.confidence]}`);
            rows.push(`Genres: ${aligned.chord.genres.join(', ')}`);
        } else if (fingering) {
            // Which name the library uses is reported below, with the other filings.
            rows.push('This shape is in the chord library, but not under a name these notes ' +
                'spell, so it is named from the notes here.');
        } else if (isStandard) {
            rows.push('This shape is not in the chord library, but these notes spell it.');
        } else {
            rows.push('The chord library lists fingerings for standard tuning only, so its ' +
                'shapes do not apply here.');
        }

        if (candidates.length > 1) {
            rows.push(`Could also be read as: ${candidates.slice(1, 4).map(c => c.name).join(', ')}`);
        }

        // Names the library files this shape under that naming from pitch cannot produce. The
        // useful case is a triad over a bass note outside it: identification always finds some
        // complete formula, so it reports F G C E as Fmaj7sus2 and can never say C/F, which is
        // how the shape is more often written. Worth having, but attributed rather than merged.
        const otherFilings = [...new Set(shapeMatches.map(m => m.chord.name)
            .filter(name => !candidates.some(c => libraryNamesFor(c).includes(name))))];
        if (otherFilings.length > 0) {
            rows.push(`The chord library also files this shape as: ${otherFilings.join(', ')}`);
        }
    }

    if (aligned) {
        rows.push(...aligned.voicing.description);
    } else {
        if (fingering) rows.push('Suggested fingering for this shape:');
        for (const stringNumber of STRING_NUMBERS) {
            const fret = selection.get(stringNumber);
            const suggested = fingering
                ? fingering.voicing.strings.find(s => s.string === stringNumber)
                : null;
            const finger = suggested && suggested.play === 'fretted' && suggested.finger
                ? `, ${FINGER_NAMES[suggested.finger]}`
                : '';
            rows.push(`String ${stringNumber}: ` +
                (fret === -1 ? 'not played' : fret === 0 ? 'open' : `fret ${fret}${finger}`));
        }
    }

    appendTextItems(fretsResultList, rows);
    fretsViewButton.disabled = fretsIdentifiedName === null;
}

for (const select of fretsSelects.values()) {
    select.addEventListener('change', renderFretsResult);
}

fretsTuningSelect.addEventListener('change', () => {
    updateFretStringLabels();
    renderFretsResult();
});

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

// --- Audio track playback (Create Audio Track) ---------------------------------------
// Renders a track from the parsed score into audible guitar samples. Timing, pitch, string
// and fret all come from the data model, never from the displayed text.
const AUDIO_TRACK_NOTE_GAIN = 0.4; // headroom: up to six strings can sound at once
const AUDIO_TRACK_RESTRIKE_FADE_SECONDS = 0.025; // fade as a string is struck again
const AUDIO_TRACK_DECAY_FADE_SECONDS = 0.15; // fade at the tail of a note left to ring out

let audioTrackPlaybackToken = 0;
let audioTrackMasterGain = null;
let audioTrackSources = [];
let audioTrackEndTimer = null;

function stopAudioTrackPlayback() {
    audioTrackPlaybackToken++;
    if (audioTrackMasterGain && sharedAudioContext) {
        const now = sharedAudioContext.currentTime;
        const gain = audioTrackMasterGain.gain;
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(gain.value, now);
        gain.linearRampToValueAtTime(0, now + AUDIO_TRACK_RESTRIKE_FADE_SECONDS);
        // Entries carry their scheduled end so a repeating loop can prune finished ones.
        for (const entry of audioTrackSources) {
            try { entry.source.stop(now + AUDIO_TRACK_RESTRIKE_FADE_SECONDS); } catch { /* already done */ }
        }
    }
    audioTrackMasterGain = null;
    audioTrackSources = [];
}

/**
 * Fetches one full recording per distinct pitch and velocity. A single AudioBuffer is reused by
 * every note of that pitch, so a track of hundreds of notes still only transfers a handful of
 * samples, and the per-note gain envelope decides how long each one actually sounds.
 */
async function loadFullSample(midi, velocity) {
    const cacheKey = `${midi}:${velocity}:full`;
    if (!sampleBufferCache.has(cacheKey)) {
        const bytes = await window.unstrung.getGuitarSampleAudio(midi, velocity, undefined);
        const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        sampleBufferCache.set(cacheKey, await getSharedAudioContext().decodeAudioData(arrayBuffer));
    }
    return sampleBufferCache.get(cacheKey);
}
// Practice tempo bounds. A student slows a song down far more often than speeds it up, so the
// range runs well below a typical written tempo and only a little above it.
const AUDIO_TRACK_MIN_BPM = 15;
const AUDIO_TRACK_MAX_BPM = 300;

// One panel per track, so returning to a track finds the settings left as they were.
// Keyed by song tab and track index, the same way the chord library is a single tab.
const audioTrackPanels = new Map();

// Timelines already derived, keyed additionally by tempo so stepping a tempo up and down is
// instant. The parsed score is held on its tab from the moment the file opens, so neither
// opening a song nor rebuilding a track at a new tempo ever re-reads the file on disk.
const audioTrackCache = new Map();

function deriveAudioTrack(state) {
    const cacheKey = `${state.songTabId}:${state.trackIndex}:${state.targetTempo}`;
    let audioTrack = audioTrackCache.get(cacheKey);
    if (!audioTrack) {
        audioTrack = buildAudioTrack(state.score, state.trackIndex, { targetTempo: state.targetTempo });
        if (audioTrack) {
            resolveRingLengths(audioTrack.notes);
            audioTrackCache.set(cacheKey, audioTrack);
        }
    }
    return audioTrack;
}

function formatMinutesSeconds(totalSeconds) {
    const rounded = Math.round(totalSeconds);
    const minutes = Math.floor(rounded / 60);
    const seconds = String(rounded % 60).padStart(2, '0');
    return `${minutes}:${seconds} (${rounded} seconds)`;
}

function describeAudioTrack(state) {
    const { audioTrack } = state;
    const rows = [
        `Notes - ${audioTrack.notes.length}`,
        `Bars - ${audioTrack.barCount}`,
        `Length - ${formatMinutesSeconds(audioTrack.totalSeconds)}`,
        `Tempo - ${audioTrack.tempo} BPM` +
            (audioTrack.tempo === audioTrack.scoreTempo
                ? ' (the tempo written in the file)'
                : ` (the file is written at ${audioTrack.scoreTempo} BPM)`)
    ];
    if (state.metronome) {
        const firstBar = audioTrack.bars[0];
        const beats = firstBar ? firstBar.beatsPerBar : 4;
        rows.push(`Metronome - on, ${beats} clicks per measure,` +
            ' with one measure counting in at the start of the song');
    }
    if (audioTrack.skipped.tiedContinuations > 0) {
        rows.push(`Tied notes held over - ${audioTrack.skipped.tiedContinuations}` +
            ' (not struck again, left ringing)');
    }
    if (audioTrack.completedChords.length > 0) {
        const names = [...new Set(audioTrack.completedChords.map(c => c.chord))].join(', ');
        rows.push(`Named chords strummed in full - ${audioTrack.completedChords.length} (${names}),` +
            ' voiced as the song writes them elsewhere');
    }
    return rows;
}

function refreshAudioTrackSummary(state) {
    state.ui.summary.replaceChildren();
    appendTextItems(state.ui.summary, describeAudioTrack(state));
}
// --- Transport -----------------------------------------------------------------------
// Playback is scheduled ahead of time on the audio thread, so there is no running clock to
// query. Position is tracked by remembering where a scheduling run began and how much context
// time has passed since, wrapping around the selected measures when they repeat. Pausing
// captures that position and stops the sources; resuming schedules a fresh run from it.
//
// Audio is scheduled through a rolling window rather than all at once (see the scheduler
// further down): a cursor walks music time, wrapping from the end of the selection back to its
// start while repeats remain, and a timer tops the schedule up to a fixed lookahead. Windows
// are anchored to exact context times carried forward, so repeats join sample-accurately.

let audioTrackPassTimer = null;

function clearAudioTrackTimers() {
    if (audioTrackEndTimer !== null) {
        clearTimeout(audioTrackEndTimer);
        audioTrackEndTimer = null;
    }
    if (audioTrackPassTimer !== null) {
        clearTimeout(audioTrackPassTimer);
        audioTrackPassTimer = null;
    }
}

function setAudioTrackPlayingState(state, playing) {
    state.playing = playing;
    state.ui.playButton.textContent = playing ? 'Pause' : 'Play Track';
    state.ui.playButton.setAttribute('aria-pressed', String(playing));
}

// --- Metronome ------------------------------------------------------------------------
// The clicks are synthesized rather than recorded, so switching the metronome on costs nothing:
// no samples to fetch, and the note timeline is untouched. A short sine burst with a fast decay
// reads as a click, pitched higher and louder on the first beat of the bar so the downbeat is
// obvious. Gains sit below the note gain, loud enough to follow but not to play over.
const METRONOME_ACCENT_GAIN = 0.18;
const METRONOME_BEAT_GAIN = 0.096;
const METRONOME_CLICK_SECONDS = 0.06;

const metronomeClickBuffers = new Map();

function metronomeClickBuffer(accent) {
    const cacheKey = accent ? 'accent' : 'beat';
    if (metronomeClickBuffers.has(cacheKey)) return metronomeClickBuffers.get(cacheKey);

    const context = getSharedAudioContext();
    const frameCount = Math.ceil(METRONOME_CLICK_SECONDS * context.sampleRate);
    const buffer = context.createBuffer(1, frameCount, context.sampleRate);
    const data = buffer.getChannelData(0);

    const frequency = accent ? 1600 : 1000;
    const decay = accent ? 55 : 75;
    for (let i = 0; i < frameCount; i++) {
        const t = i / context.sampleRate;
        // Starting at zero phase keeps the attack clean; the decay brings it to near silence well
        // inside the buffer, so the end needs no separate fade.
        data[i] = Math.sin(2 * Math.PI * frequency * t) * Math.exp(-t * decay);
    }

    metronomeClickBuffers.set(cacheKey, buffer);
    return buffer;
}

/**
 * One measure of clicks before the music, the way a band counts itself in.
 *
 * For the first time through, and for later repeats only if asked. Resuming from a pause or landing
 * on a measure mid-song always plays straight away.
 *
 * The metronome decides this outright: with no clicks running, a silent measure of waiting before
 * the music would be a delay with nothing to show for it.
 */
function audioTrackLeadInSeconds(state, fromSeconds, countIn) {
    if (!state.metronome || !countIn) return 0;
    const bar = state.audioTrack.bars[measureIndexAt(state, fromSeconds)];
    return bar ? bar.endSeconds - bar.startSeconds : 0;
}

/**
 * Schedules the clicks of one count-in measure, shaped like the measure about to be played, and
 * returns how long it lasts.
 *
 * Returns 0 without scheduling anything when there should be no count-in, so a caller can add the
 * result to its cursor either way.
 */
function scheduleAudioTrackCountIn(state, destination, atContextTime, forSeconds, wanted) {
    const seconds = audioTrackLeadInSeconds(state, forSeconds, wanted);
    if (seconds <= 0) return 0;

    const context = getSharedAudioContext();
    const bar = state.audioTrack.bars[measureIndexAt(state, forSeconds)];
    for (const beatSeconds of bar.beats) {
        const offset = beatSeconds - bar.startSeconds;
        audioTrackSources.push({
            source: scheduleMetronomeClick(context, destination, atContextTime + offset, offset === 0),
            endsAt: atContextTime + offset + METRONOME_CLICK_SECONDS
        });
    }
    return seconds;
}

function scheduleMetronomeClick(context, destination, when, accent) {
    const source = context.createBufferSource();
    source.buffer = metronomeClickBuffer(accent);
    const gain = context.createGain();
    gain.gain.value = accent ? METRONOME_ACCENT_GAIN : METRONOME_BEAT_GAIN;
    source.connect(gain).connect(destination);
    source.start(when);
    return source;
}

/**
 * Says something only when the player asked to be told.
 *
 * Moving around the track stays silent: a screen reader talking over the music defeats the point
 * of listening to it. Position and tempo are reported only on the keys that exist to ask for
 * them, so speech happens when it is wanted and not otherwise.
 */
function announceAudioTrack(state, message) {
    // Re-announce the same text by clearing first, otherwise a repeated value stays silent.
    state.ui.announce.textContent = '';
    state.ui.announce.textContent = message;
}

/** The selected measures as zero-based bar indices and their second boundaries. */
function audioTrackRange(state) {
    const bars = state.audioTrack.bars;
    const firstIndex = Math.min(bars.length - 1, Math.max(0, state.firstMeasure - 1));
    const lastIndex = Math.min(bars.length - 1, Math.max(firstIndex, state.lastMeasure - 1));
    return {
        firstIndex,
        lastIndex,
        startSeconds: bars[firstIndex].startSeconds,
        endSeconds: bars[lastIndex].endSeconds
    };
}

/** Passes still to come after the given one; Infinity when repeating until stopped. */
function remainingPassesAfter(state, passNumber) {
    if (state.repeatCount === 0) return Infinity;
    return Math.max(0, state.repeatCount - passNumber);
}

/**
 * Where in the track we are, in seconds, whether playing or paused.
 *
 * When the selection repeats, elapsed time past the end of the selection wraps back to its
 * start, so the reported position always lies inside the selected measures.
 */
/**
 * Where playback has reached, and which play-through of the selection it is on, starting at 1.
 *
 * Both come from one walk over the timeline, because they are the same question asked twice and
 * working them out separately invites the two answers disagreeing.
 *
 * A count-in occupies context time without advancing music time, so once repeats can be counted in,
 * the cycle a wrap consumes is the selection plus that count-in. Leaving that out would push the
 * reported position further ahead of what is actually sounding with every repeat. Where there is no
 * count-in the lead is zero and this reduces to plain elapsed time, as it was before.
 */
function audioTrackTimeline(state) {
    if (!state.playing || state.anchorContextTime === null || !sharedAudioContext) {
        return { position: state.anchorSeconds, pass: state.anchorPass };
    }

    const range = audioTrackRange(state);
    const passDuration = range.endSeconds - range.startSeconds;
    const elapsed = sharedAudioContext.currentTime - state.anchorContextTime;
    // Still inside the count-in: the music has not started.
    if (elapsed <= 0) return { position: state.anchorSeconds, pass: state.anchorPass };
    if (passDuration <= 0) {
        return { position: state.anchorSeconds + elapsed, pass: state.anchorPass };
    }

    const cap = pass => (state.repeatCount === 0 ? pass : Math.min(pass, state.repeatCount));

    // The first leg is short when playback began part way into the selection.
    const firstLeg = range.endSeconds - state.anchorSeconds;
    if (elapsed < firstLeg) {
        return { position: state.anchorSeconds + elapsed, pass: state.anchorPass };
    }

    const lead = audioTrackLeadInSeconds(state, range.startSeconds, state.countInEachPass);
    const cycle = passDuration + lead;
    const since = elapsed - firstLeg;
    const wraps = 1 + Math.floor(since / cycle);
    const pass = cap(state.anchorPass + wraps);

    if (wraps > remainingPassesAfter(state, state.anchorPass)) {
        // Past the final pass; the finish timer lands shortly.
        return { position: range.endSeconds, pass };
    }

    const within = since - (wraps - 1) * cycle;
    // Inside a repeat's count-in, waiting at the top of the selection.
    if (within < lead) return { position: range.startSeconds, pass };
    return { position: range.startSeconds + (within - lead), pass };
}

function audioTrackPosition(state) {
    return audioTrackTimeline(state).position;
}

function currentPassAt(state) {
    return audioTrackTimeline(state).pass;
}

/** Zero-based index of the measure containing a position. */
function measureIndexAt(state, positionSeconds) {
    const starts = state.audioTrack.barStartSeconds;
    let index = 0;
    for (let i = 0; i < starts.length; i++) {
        if (starts[i] <= positionSeconds + 1e-6) index = i;
        else break;
    }
    return index;
}

/**
 * The selection's notes with ring lengths worked out for looping.
 *
 * The rule is the usual one: a note rings until its own string is struck again. Inside a
 * repeating selection the next strike may be in the next pass, so the ring wraps: the time left
 * to the end of the selection plus the time from the selection's start to that string's first
 * strike. On the final pass there is no next strike, so `ringFinal` is used and the last notes
 * decay naturally.
 */
function rangeNotesFor(state) {
    const range = audioTrackRange(state);
    const cacheKey = `${state.targetTempo}:${state.firstMeasure}:${state.lastMeasure}`;
    if (state.rangeCache && state.rangeCache.key === cacheKey) return state.rangeCache.notes;

    const inRange = state.audioTrack.notes.filter(note =>
        note.startSeconds >= range.startSeconds - 1e-9 && note.startSeconds < range.endSeconds - 1e-9);

    const strikesByString = new Map();
    for (const note of inRange) {
        if (!strikesByString.has(note.string)) strikesByString.set(note.string, []);
        strikesByString.get(note.string).push(note.startSeconds);
    }
    for (const strikes of strikesByString.values()) strikes.sort((a, b) => a - b);

    const notes = inRange.map(note => {
        const strikes = strikesByString.get(note.string);
        const next = strikes.find(t => t > note.startSeconds + 1e-9);
        const ringFinal = next !== undefined ? next - note.startSeconds : null;
        const ringLoop = next !== undefined
            ? next - note.startSeconds
            : (range.endSeconds - note.startSeconds) + (strikes[0] - range.startSeconds);
        return { ...note, ringFinal, ringLoop };
    });

    state.rangeCache = { key: cacheKey, notes };
    return notes;
}
// The scheduler keeps only a short horizon of audio in the graph. Scheduling a whole track up
// front puts one source and one gain node per note in the graph at once, and the audio thread
// visits every scheduled node each render quantum: a dense track's several thousand nodes blow
// its budget and the missed deadlines are audible as crackling. A rolling window keeps the node
// count bounded no matter how long or dense the track is.
const AUDIO_TRACK_LOOKAHEAD_SECONDS = 12;
const AUDIO_TRACK_TOPUP_INTERVAL_MS = 3000;

/**
 * Schedules the notes and metronome clicks that begin in [fromSeconds, toSeconds) of the
 * current pass, anchored so that `fromSeconds` sounds at `baseContext`.
 *
 * `includeRinging` also picks up notes that started before the window but are still sounding at
 * its start, entered partway into their recording. That is wanted only for the first window
 * after a start or seek: for later windows those notes were scheduled when their own start fell
 * inside an earlier window.
 */
function scheduleAudioTrackChunk(state, { fromSeconds, toSeconds, baseContext, hasNextPass, includeRinging }) {
    const context = getSharedAudioContext();

    if (state.metronome) {
        for (const bar of state.audioTrack.bars) {
            for (const [beatInBar, beatSeconds] of bar.beats.entries()) {
                if (beatSeconds < fromSeconds - 1e-6 || beatSeconds >= toSeconds - 1e-6) continue;
                const when = baseContext + (beatSeconds - fromSeconds);
                audioTrackSources.push({
                    source: scheduleMetronomeClick(context, audioTrackMasterGain, when, beatInBar === 0),
                    endsAt: when + METRONOME_CLICK_SECONDS
                });
            }
        }
    }

    for (const note of rangeNotesFor(state)) {
        const startsInWindow = note.startSeconds >= fromSeconds - 1e-9 && note.startSeconds < toSeconds - 1e-9;
        if (!startsInWindow && !(includeRinging && note.startSeconds < fromSeconds)) continue;

        const buffer = sampleBufferCache.get(`${note.midi}:${note.velocity}:full`);
        if (!buffer) continue;

        const ring = hasNextPass ? note.ringLoop : note.ringFinal;
        const ringSeconds = Math.min(ring ?? buffer.duration, buffer.duration);
        const noteEnd = note.startSeconds + ringSeconds;
        if (noteEnd <= fromSeconds) continue; // finished before this window's starting point

        const intoNote = Math.max(0, fromSeconds - note.startSeconds);
        const when = baseContext + Math.max(0, note.startSeconds - fromSeconds);
        const remaining = ringSeconds - intoNote;
        if (remaining <= 0) continue;

        const source = context.createBufferSource();
        source.buffer = buffer;
        const gain = context.createGain();
        const ends = when + remaining;
        const fade = ring === null
            ? AUDIO_TRACK_DECAY_FADE_SECONDS
            : AUDIO_TRACK_RESTRIKE_FADE_SECONDS;
        gain.gain.setValueAtTime(AUDIO_TRACK_NOTE_GAIN, when);
        gain.gain.setValueAtTime(AUDIO_TRACK_NOTE_GAIN, Math.max(when, ends - fade));
        gain.gain.linearRampToValueAtTime(0, ends);

        source.connect(gain).connect(audioTrackMasterGain);
        source.start(when, intoNote);
        source.stop(ends + 0.01);
        audioTrackSources.push({ source, endsAt: ends + 0.01 });
    }
}

/**
 * Fills the schedule up to the lookahead horizon and arms the next top-up.
 *
 * The scheduler cursor walks music time, wrapping from the end of the selection to its start
 * while passes remain, so repeats join sample-accurately: each window is anchored to an exact
 * context time carried forward from the previous one, never re-derived from a timer. When the
 * final pass has been fully scheduled, the end timer takes over.
 */
function audioTrackTopUp(state, myToken) {
    if (myToken !== audioTrackPlaybackToken) return;
    const context = getSharedAudioContext();
    const sched = state.scheduler;
    const horizon = context.currentTime + AUDIO_TRACK_LOOKAHEAD_SECONDS;

    while (true) {
        // A meaningful minimum chunk, not just > 0: a sliver below float resolution would
        // advance the cursor by nothing and spin this loop forever, freezing the renderer.
        const available = horizon - sched.cursorContext;
        if (available < 0.05) break;

        const range = audioTrackRange(state);
        const hasNextPass = remainingPassesAfter(state, sched.pass) > 0;
        const chunkEnd = Math.min(range.endSeconds, sched.cursorSeconds + available);

        if (chunkEnd > sched.cursorSeconds + 1e-6) {
            scheduleAudioTrackChunk(state, {
                fromSeconds: sched.cursorSeconds,
                toSeconds: chunkEnd,
                baseContext: sched.cursorContext,
                hasNextPass,
                includeRinging: sched.firstChunk
            });
            sched.firstChunk = false;
            sched.cursorContext += chunkEnd - sched.cursorSeconds;
            sched.cursorSeconds = chunkEnd;
        }

        if (sched.cursorSeconds >= range.endSeconds - 1e-9) {
            if (!hasNextPass) {
                const remainingMs = (sched.cursorContext - context.currentTime + 2) * 1000;
                audioTrackEndTimer = setTimeout(() => {
                    if (myToken !== audioTrackPlaybackToken) return;
                    state.anchorSeconds = range.startSeconds;
                    state.anchorContextTime = null;
                    state.anchorPass = 1;
                    // A finished run starts over from the top next time: a first play again.
                    state.countInArmed = true;
                    setAudioTrackPlayingState(state, false);
                    announceAudioTrack(state, 'End of track.');
                }, remainingMs);
                return;
            }
            sched.pass += 1;
            sched.cursorSeconds = range.startSeconds;

            // A repeat is counted in only when asked for, and only with the metronome running.
            // Read now rather than when playback started, so ticking the box mid-loop takes effect
            // from the next repeat instead of needing the track rebuilt.
            sched.cursorContext += scheduleAudioTrackCountIn(
                state, audioTrackMasterGain, sched.cursorContext, range.startSeconds,
                state.countInEachPass);
        }
    }

    const now = context.currentTime;
    audioTrackSources = audioTrackSources.filter(entry => entry.endsAt > now);
    audioTrackPassTimer = setTimeout(
        () => audioTrackTopUp(state, myToken), AUDIO_TRACK_TOPUP_INTERVAL_MS);
}

function startAudioTrackPlayback(state, fromSeconds, { countIn = false } = {}) {
    if (!state.ready) return;
    stopAudioTrackPlayback();
    clearAudioTrackTimers();

    const range = audioTrackRange(state);
    let from = Math.max(range.startSeconds, Math.min(range.endSeconds, fromSeconds));
    if (from >= range.endSeconds - 1e-3) from = range.startSeconds;

    const myToken = audioTrackPlaybackToken;
    const context = getSharedAudioContext();

    const masterGain = context.createGain();
    masterGain.gain.value = 1;
    masterGain.connect(context.destination);
    audioTrackMasterGain = masterGain;
    audioTrackSources = [];

    const contextStart = context.currentTime + 0.12;
    const leadIn = scheduleAudioTrackCountIn(state, masterGain, contextStart, from, countIn);

    state.scheduler = {
        pass: state.anchorPass,
        cursorSeconds: from,
        cursorContext: contextStart + leadIn,
        firstChunk: true
    };

    state.anchorSeconds = from;
    state.anchorContextTime = contextStart + leadIn;
    state.countInArmed = false; // used up by this run
    setAudioTrackPlayingState(state, true);

    audioTrackTopUp(state, myToken);
}
function pauseAudioTrackPlayback(state) {
    const position = audioTrackPosition(state);
    const pass = currentPassAt(state);
    // Pausing during the count-in never reached the music, so the count-in is owed again.
    const inLeadIn = state.playing && state.anchorContextTime !== null &&
        sharedAudioContext && sharedAudioContext.currentTime < state.anchorContextTime;

    stopAudioTrackPlayback();
    clearAudioTrackTimers();
    state.anchorSeconds = position;
    state.anchorContextTime = null;
    state.anchorPass = pass;
    if (inLeadIn) state.countInArmed = true;
    setAudioTrackPlayingState(state, false);
}

function toggleAudioTrackPlayback(state) {
    if (state.playing) pauseAudioTrackPlayback(state);
    // Only a start that was armed by creating the track, finishing a run, restarting, or
    // changing the selection counts in; resuming after a pause carries straight on.
    else startAudioTrackPlayback(state, state.anchorSeconds, { countIn: state.countInArmed });
}

/** Moves the play position within the selection, continuing to play if playing. Says nothing. */
function seekAudioTrack(state, toSeconds) {
    const range = audioTrackRange(state);
    const target = Math.max(range.startSeconds, Math.min(range.endSeconds, toSeconds));
    if (state.playing) {
        state.anchorPass = currentPassAt(state); // seeking moves within the same play-through
        startAudioTrackPlayback(state, target);
    } else {
        state.anchorSeconds = target;
        state.anchorContextTime = null;
    }
}

function seekAudioTrackByMeasure(state, delta) {
    const range = audioTrackRange(state);
    const current = measureIndexAt(state, audioTrackPosition(state));
    const target = Math.max(range.firstIndex, Math.min(range.lastIndex, current + delta));
    seekAudioTrack(state, state.audioTrack.barStartSeconds[target]);
}

function seekToStartOfCurrentMeasure(state) {
    const starts = state.audioTrack.barStartSeconds;
    seekAudioTrack(state, starts[measureIndexAt(state, audioTrackPosition(state))]);
}

/**
 * Back to the start of the selection, counting in again, without losing our place in the
 * repeats: restarting during the third of five plays replays the third, then the remaining two.
 */
function restartAudioTrackSelection(state) {
    const range = audioTrackRange(state);
    const pass = state.playing ? currentPassAt(state) : state.anchorPass;
    state.anchorPass = pass;

    if (state.playing) {
        startAudioTrackPlayback(state, range.startSeconds, { countIn: true });
    } else {
        state.anchorSeconds = range.startSeconds;
        state.anchorContextTime = null;
        state.countInArmed = true;
    }
}

/** Steps the tempo, keeping the music playing from the measure we are in. */
function stepAudioTrackTempo(state, deltaBpm) {
    applyAudioTrackTempo(state, state.targetTempo + deltaBpm, { silent: true });
    announceAudioTrack(state, `${state.targetTempo} BPM`);
}

function announceCurrentMeasure(state) {
    const measure = measureIndexAt(state, audioTrackPosition(state)) + 1;
    let text = `Measure ${measure} of ${state.audioTrack.barCount}`;
    // When the selection repeats, which play-through we are on matters just as much.
    if (state.repeatCount !== 1) {
        const pass = currentPassAt(state);
        text += state.repeatCount === 0 ? `, play ${pass}` : `, play ${pass} of ${state.repeatCount}`;
    }
    announceAudioTrack(state, text);
}

/**
 * Turns the metronome on or off, in place.
 *
 * Nothing has to be rebuilt: the clicks are synthesized and the note timeline does not change, so
 * a track that is playing simply carries on from where it is with clicks added or removed.
 *
 * Says nothing either way. Whether the clicks are running is audible, and the checkbox reports its
 * own state when that is how it was changed, so an announcement would only talk over the music.
 */
function setAudioTrackMetronome(state, enabled) {
    state.metronome = enabled;
    state.ui.metronomeCheckbox.checked = enabled;

    if (state.playing) {
        const position = audioTrackPosition(state);
        pauseAudioTrackPlayback(state);
        startAudioTrackPlayback(state, position);
    }
    refreshAudioTrackSummary(state);
}

/** The audio track panel on the tab currently in view, or null. */
function activeAudioTrackState() {
    for (const entry of audioTrackPanels.values()) {
        if (entry.tabId === activeTabId) return entry.state;
    }
    return null;
}

// How much one press of the tempo keys moves the tempo.
const AUDIO_TRACK_TEMPO_STEP_BPM = 5;

// Playback shortcuts. These only reach the app while the screen reader is passing keys straight
// through, which is focus mode in NVDA. No modifier variants are offered: which combinations a
// screen reader lets through is not consistent between them, so a Ctrl alternative would work in
// some and not others. The buttons cover the same ground for when you are not in focus mode.
//
// `needsTrack` marks the moves that only mean something once the track has been created; tempo
// can be adjusted before that.
const AUDIO_TRACK_SHORTCUTS = {
    ' ': { needsTrack: true, run: state => toggleAudioTrackPlayback(state) },
    ArrowLeft: { needsTrack: true, run: state => seekAudioTrackByMeasure(state, -1) },
    ArrowRight: { needsTrack: true, run: state => seekAudioTrackByMeasure(state, 1) },
    ArrowDown: { needsTrack: true, run: state => seekToStartOfCurrentMeasure(state) },
    // Back to the top of the selection, counting in again, keeping the repeat count.
    ArrowUp: { needsTrack: true, run: state => restartAudioTrackSelection(state) },
    b: { needsTrack: false, run: state => announceCurrentMeasure(state) },
    m: { needsTrack: false, run: state => setAudioTrackMetronome(state, !state.metronome) },
    s: { needsTrack: false, run: state => stepAudioTrackTempo(state, -AUDIO_TRACK_TEMPO_STEP_BPM) },
    f: { needsTrack: false, run: state => stepAudioTrackTempo(state, AUDIO_TRACK_TEMPO_STEP_BPM) }
};

// Only a field you type into should swallow these keys. A checkbox is an input too, but nothing is
// being typed there, so the shortcuts must still reach playback: focus sitting on the metronome
// checkbox should not disable the transport. Space is the exception, since it is how a checkbox is
// toggled.
const TEXT_ENTRY_INPUT_TYPES = new Set([
    'text', 'number', 'search', 'email', 'url', 'tel', 'password',
    'date', 'time', 'datetime-local', 'month', 'week', 'range', 'color', 'file'
]);

function eventTargetSwallowsKey(target, key) {
    const tag = target && target.tagName ? target.tagName.toLowerCase() : '';
    if (tag === 'select' || tag === 'textarea') return true;
    if (tag !== 'input') return false;

    const type = (target.type || 'text').toLowerCase();
    if (TEXT_ENTRY_INPUT_TYPES.has(type)) return true;
    // Checkbox or radio: let space toggle it, but pass everything else through.
    return key === ' ';
}

document.addEventListener('keydown', event => {
    const shortcut = AUDIO_TRACK_SHORTCUTS[event.key];
    if (!shortcut || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
    if (document.querySelector('dialog[open]')) return;

    // Typing in a field always wins; everywhere else these keys belong to playback. That includes
    // space while a button has focus: pausing has to be dependable, and Enter still presses the
    // button.
    if (eventTargetSwallowsKey(event.target, event.key)) return;

    const state = activeAudioTrackState();
    if (!state) return;
    if (shortcut.needsTrack && !state.ready) return;

    event.preventDefault();
    shortcut.run(state);
});

/** Measure numbers as compact ranges: "2 to 4, 6, 9 to 12", capped so it never runs long. */
function summarizeMeasureNumbers(measureNumbers) {
    const groups = [];
    let start = null, previous = null;
    for (const measure of measureNumbers) {
        if (start === null) { start = previous = measure; continue; }
        if (measure === previous + 1) { previous = measure; continue; }
        groups.push(start === previous ? `${start}` : `${start} to ${previous}`);
        start = previous = measure;
    }
    if (start !== null) groups.push(start === previous ? `${start}` : `${start} to ${previous}`);
    return groups.length > 6 ? groups.slice(0, 6).join(', ') + ', and more' : groups.join(', ');
}

/** Notes in the current selection whose sample failed to load, i.e. cannot be played. */
function unplayableSelectionNotes(state) {
    if (!state.failedSampleKeys || state.failedSampleKeys.size === 0) return [];
    return rangeNotesFor(state).filter(n => state.failedSampleKeys.has(`${n.midi}:${n.velocity}`));
}

/**
 * Puts the panel into its error shape: everything below the buttons goes away so the message
 * is the next thing after the Create Track button, not buried under controls that cannot be
 * used and a list of shortcuts that will not work.
 */
function showAudioTrackError(state, message) {
    state.ready = false;
    state.ui.playButton.disabled = true;
    for (const button of state.ui.transportButtons) button.disabled = true;
    state.ui.extraControls.hidden = true;
    state.ui.status.textContent = '';
    state.ui.error.textContent = message;
}

function clearAudioTrackError(state) {
    state.ui.error.textContent = '';
    state.ui.extraControls.hidden = false;
}

/**
 * Loads every sample the track needs, which is the slow part of getting ready to play.
 *
 * The whole track's samples are attempted so that later selection changes stay instant, but
 * only the selected measures decide success: a track whose low notes have no guitar sample can
 * still be created for the measures that avoid them.
 */
async function prepareAudioTrack(state) {
    const { ui } = state;
    const needed = [...new Set(state.audioTrack.notes.map(n => `${n.midi}:${n.velocity}`))];

    ui.createButton.disabled = true;
    ui.playButton.disabled = true;
    ui.error.textContent = '';
    ui.status.textContent = `Creating the track: loading ${needed.length} guitar samples…`;

    const results = await Promise.allSettled(needed.map(key => {
        const [midi, velocity] = key.split(':');
        return loadFullSample(Number(midi), velocity);
    }));
    ui.createButton.disabled = false;

    state.failedSampleKeys = new Set();
    results.forEach((result, index) => {
        if (result.status === 'rejected') state.failedSampleKeys.add(needed[index]);
    });

    const unplayable = unplayableSelectionNotes(state);
    if (unplayable.length > 0) {
        const measures = [...new Set(unplayable.map(n => n.bar + 1))].sort((a, b) => a - b);
        const selectionSize = rangeNotesFor(state).length;
        showAudioTrackError(state,
            `Could not create the track: ${unplayable.length} of the ${selectionSize} notes in the` +
            ` selected measures have no guitar sample; this track goes outside the range the` +
            ` bundled samples cover. The first is in measure ${measures[0]}; affected measures are` +
            ` ${summarizeMeasureNumbers(measures)}. Choose different measures and press Create` +
            ` Track again.`);
        return;
    }

    clearAudioTrackError(state);
    state.ready = true;
    state.countInArmed = true; // a fresh track starts from the top, so count it in
    ui.playButton.disabled = false;
    for (const button of ui.transportButtons) button.disabled = false;

    let readyText = `Track ready: ${rangeNotesFor(state).length} notes at ` +
        `${state.audioTrack.tempo} BPM, ${formatMinutesSeconds(state.audioTrack.totalSeconds)}.` +
        ' Press Play Track, or press space.';
    if (state.failedSampleKeys.size > 0) {
        const affectedBars = [...new Set(state.audioTrack.notes
            .filter(n => state.failedSampleKeys.has(`${n.midi}:${n.velocity}`))
            .map(n => n.bar + 1))].sort((a, b) => a - b);
        readyText += ` Note: measures ${summarizeMeasureNumbers(affectedBars)} contain notes with` +
            ' no guitar sample and cannot be selected.';
    }
    ui.status.textContent = readyText;
}

/**
 * Rebuilds the timeline at a new tempo, holding our place in the music.
 *
 * The same measure falls at a different second once the tempo changes, so the position is carried
 * across by measure rather than by seconds. If the track was playing it keeps playing from there,
 * which is what makes nudging the tempo while playing along useful. `silent` suppresses the
 * written status, for the tempo keys that report through the announcement region instead.
 */
function applyAudioTrackTempo(state, requestedTempo, { silent = false } = {}) {
    // An empty field converts to 0, which would otherwise clamp to the minimum tempo rather than
    // leaving the setting alone, so anything not a positive number puts the field back.
    if (!Number.isFinite(requestedTempo) || requestedTempo <= 0) {
        state.ui.tempoInput.value = String(state.targetTempo);
        return;
    }
    const clamped = Math.min(AUDIO_TRACK_MAX_BPM,
        Math.max(AUDIO_TRACK_MIN_BPM, Math.round(requestedTempo)));

    const wasPlaying = state.playing;
    let measure = measureIndexAt(state, audioTrackPosition(state));
    if (wasPlaying) pauseAudioTrackPlayback(state);

    state.targetTempo = clamped;
    state.audioTrack = deriveAudioTrack(state);
    state.rangeCache = null;

    const range = audioTrackRange(state);
    measure = Math.max(range.firstIndex, Math.min(range.lastIndex, measure));
    state.anchorSeconds = state.audioTrack.barStartSeconds[measure] ?? range.startSeconds;
    state.anchorContextTime = null;
    state.ui.tempoInput.value = String(clamped);
    refreshAudioTrackSummary(state);

    // The samples needed depend on pitch, not tempo, so a prepared track stays playable.
    if (wasPlaying && state.ready) startAudioTrackPlayback(state, state.anchorSeconds);

    if (silent) return;
    state.ui.status.textContent = state.ready
        ? `Tempo is now ${clamped} BPM, ` +
          `${formatMinutesSeconds(state.audioTrack.totalSeconds)}, at measure ${measure + 1}.`
        : `Tempo is now ${clamped} BPM. Press Create Track to prepare it.`;
}

// --- Measure selection ------------------------------------------------------------------
function audioTrackSelectionText(state) {
    const rangeText = state.firstMeasure === 1 && state.lastMeasure === state.audioTrack.barCount
        ? 'all'
        : `${state.firstMeasure} to ${state.lastMeasure}`;
    const repeatText = state.repeatCount === 1
        ? ''
        : state.repeatCount === 0 ? ', repeat until stopped' : `, repeat ${state.repeatCount} times`;
    return `${rangeText}${repeatText}`;
}

function updateAudioTrackSelectionSummary(state) {
    state.ui.measuresSummary.textContent = `Measures selected - ${audioTrackSelectionText(state)}`;
}

/**
 * Applies the measure-selection fields.
 *
 * Values are clamped rather than rejected: the last measure cannot come before the first, and
 * repeats run 0 (until stopped) to 50. Changing the selection is a fresh start, so playback
 * stops, the position moves to the start of the new selection, the repeat count goes back to the
 * first play-through, and the next play counts in again.
 */
function applyAudioTrackSelection(state) {
    const { firstInput, lastInput, repeatInput } = state.ui;
    const barCount = state.audioTrack.barCount;

    const firstRaw = Number(firstInput.value);
    const lastRaw = Number(lastInput.value);
    const repeatRaw = Number(repeatInput.value);

    const first = Number.isFinite(firstRaw) && firstRaw >= 1
        ? Math.min(barCount, Math.round(firstRaw))
        : state.firstMeasure;
    const last = Number.isFinite(lastRaw) && lastRaw >= 1
        ? Math.max(first, Math.min(barCount, Math.round(lastRaw)))
        : Math.max(first, state.lastMeasure);
    const repeat = Number.isFinite(repeatRaw) && repeatRaw >= 0
        ? Math.min(50, Math.round(repeatRaw))
        : state.repeatCount;

    if (state.playing) pauseAudioTrackPlayback(state);

    state.firstMeasure = first;
    state.lastMeasure = last;
    state.repeatCount = repeat;
    state.rangeCache = null;
    state.anchorSeconds = audioTrackRange(state).startSeconds;
    state.anchorContextTime = null;
    state.anchorPass = 1;
    state.countInArmed = true;

    firstInput.value = String(first);
    lastInput.value = String(last);
    repeatInput.value = String(repeat);
    updateAudioTrackSelectionSummary(state);

    // Moving the selection onto notes with no sample must not silently skip them: the track
    // goes back to needing Create Track, which will explain exactly which measures are wrong.
    const unplayable = unplayableSelectionNotes(state);
    if (unplayable.length > 0) {
        const measures = [...new Set(unplayable.map(n => n.bar + 1))].sort((a, b) => a - b);
        showAudioTrackError(state,
            `Measures ${summarizeMeasureNumbers(measures)} contain notes with no guitar sample,` +
            ' so this selection cannot be played. Choose different measures and press Create' +
            ' Track again.');
        return;
    }
    if (state.ui.error.textContent !== '' && state.failedSampleKeys) {
        // A previous error is resolved by this selection; creating again restores the panel.
        state.ui.error.textContent = '';
    }

    state.ui.status.textContent =
        `Measures ${audioTrackSelectionText(state)}. ` +
        (state.ready ? 'Press Play Track.' : 'Press Create Track to prepare it.');
}

function buildAudioTrackPanel(state) {
    const container = document.createElement('div');
    container.className = 'audio-track';

    const heading = document.createElement('h2');
    heading.textContent =
        `Audio Track - ${state.audioTrack.songTitle}, ${state.audioTrack.trackName}`;
    container.append(heading);

    const settingsHeading = document.createElement('h3');
    settingsHeading.textContent = 'Playback settings';
    container.append(settingsHeading);

    const tempoParagraph = document.createElement('p');
    const tempoLabel = document.createElement('label');
    tempoLabel.htmlFor = 'audio-track-tempo-input';
    tempoLabel.textContent =
        `Tempo in beats per minute, ${AUDIO_TRACK_MIN_BPM} to ${AUDIO_TRACK_MAX_BPM}`;
    const tempoInput = document.createElement('input');
    tempoInput.type = 'number';
    tempoInput.id = 'audio-track-tempo-input';
    tempoInput.min = String(AUDIO_TRACK_MIN_BPM);
    tempoInput.max = String(AUDIO_TRACK_MAX_BPM);
    tempoInput.step = '1';
    tempoInput.value = String(state.targetTempo);
    tempoParagraph.append(tempoLabel, tempoInput);
    container.append(tempoParagraph);

    // Which measures to play, collapsed behind a summary that reads out the current selection.
    const measuresDetails = document.createElement('details');
    const measuresSummary = document.createElement('summary');
    measuresDetails.append(measuresSummary);

    const firstParagraph = document.createElement('p');
    const firstLabel = document.createElement('label');
    firstLabel.htmlFor = 'audio-track-first-measure-input';
    firstLabel.textContent = 'First measure to play';
    const firstInput = document.createElement('input');
    firstInput.type = 'number';
    firstInput.id = 'audio-track-first-measure-input';
    firstInput.min = '1';
    firstInput.max = String(state.audioTrack.barCount);
    firstInput.step = '1';
    firstInput.value = String(state.firstMeasure);
    firstParagraph.append(firstLabel, firstInput);
    measuresDetails.append(firstParagraph);

    const lastParagraph = document.createElement('p');
    const lastLabel = document.createElement('label');
    lastLabel.htmlFor = 'audio-track-last-measure-input';
    lastLabel.textContent = 'Last measure to play';
    const lastInput = document.createElement('input');
    lastInput.type = 'number';
    lastInput.id = 'audio-track-last-measure-input';
    lastInput.min = '1';
    lastInput.max = String(state.audioTrack.barCount);
    lastInput.step = '1';
    lastInput.value = String(state.lastMeasure);
    lastParagraph.append(lastLabel, lastInput);
    measuresDetails.append(lastParagraph);

    const repeatParagraph = document.createElement('p');
    const repeatLabel = document.createElement('label');
    repeatLabel.htmlFor = 'audio-track-repeat-input';
    repeatLabel.textContent = 'Times to play the selection, up to 50; 0 repeats until stopped';
    const repeatInput = document.createElement('input');
    repeatInput.type = 'number';
    repeatInput.id = 'audio-track-repeat-input';
    repeatInput.min = '0';
    repeatInput.max = '50';
    repeatInput.step = '1';
    repeatInput.value = String(state.repeatCount);
    repeatParagraph.append(repeatLabel, repeatInput);
    measuresDetails.append(repeatParagraph);

    // Only ever relevant to a selection that repeats, so it belongs in here with the repeat count
    // rather than beside the metronome. The metronome itself still decides whether any clicks
    // happen at all; this only says whether a repeat gets counted in like the first pass did.
    const countInEachPassParagraph = document.createElement('p');
    const countInEachPassCheckbox = document.createElement('input');
    countInEachPassCheckbox.type = 'checkbox';
    countInEachPassCheckbox.id = 'audio-track-count-in-each-pass-checkbox';
    countInEachPassCheckbox.checked = state.countInEachPass;
    const countInEachPassLabel = document.createElement('label');
    countInEachPassLabel.htmlFor = countInEachPassCheckbox.id;
    countInEachPassLabel.textContent =
        'Count in before every repeat, not just the first time through. Needs the metronome on.';
    countInEachPassParagraph.append(countInEachPassCheckbox, countInEachPassLabel);
    measuresDetails.append(countInEachPassParagraph);

    container.append(measuresDetails);

    const metronomeParagraph = document.createElement('p');
    const metronomeCheckbox = document.createElement('input');
    metronomeCheckbox.type = 'checkbox';
    metronomeCheckbox.id = 'audio-track-metronome-checkbox';
    metronomeCheckbox.checked = state.metronome;
    const metronomeLabel = document.createElement('label');
    metronomeLabel.htmlFor = metronomeCheckbox.id;
    metronomeLabel.textContent =
        'Metronome, with one measure of clicks counting in the first time through';
    metronomeParagraph.append(metronomeCheckbox, metronomeLabel);
    container.append(metronomeParagraph);

    const summaryHeading = document.createElement('h3');
    summaryHeading.textContent = 'Track';
    container.append(summaryHeading);
    const summary = document.createElement('ul');
    container.append(summary);

    const actions = document.createElement('p');
    const createButton = document.createElement('button');
    createButton.type = 'button';
    createButton.textContent = 'Create Track';
    const playButton = document.createElement('button');
    playButton.type = 'button';
    playButton.textContent = 'Play Track';
    playButton.setAttribute('aria-pressed', 'false');
    // Nothing to play until the samples are in hand.
    playButton.disabled = true;
    actions.append(createButton, playButton);
    container.append(actions);

    // When creation fails, the message lands right here, straight after the buttons, and
    // everything below is hidden so the failure is the next thing encountered, not a footnote
    // beneath controls that cannot be used.
    const error = document.createElement('p');
    error.setAttribute('role', 'alert');
    container.append(error);

    // Everything below the buttons lives in one container so the error state can remove it.
    const extraControls = document.createElement('div');
    container.append(extraControls);

    // The same moves the shortcuts make, as buttons, so nothing here is keyboard-only.
    const transportHeading = document.createElement('h3');
    transportHeading.textContent = 'Move around the track';
    extraControls.append(transportHeading);

    const transportParagraph = document.createElement('p');
    const transportButtons = [];
    const transportActions = [
        ['Previous Measure', state2 => seekAudioTrackByMeasure(state2, -1)],
        ['Next Measure', state2 => seekAudioTrackByMeasure(state2, 1)],
        ['Start of Measure', state2 => seekToStartOfCurrentMeasure(state2)],
        ['Restart', state2 => restartAudioTrackSelection(state2)]
    ];
    for (const [label, action] of transportActions) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.disabled = true;
        button.addEventListener('click', () => action(state));
        transportButtons.push(button);
        transportParagraph.append(button);
    }
    extraControls.append(transportParagraph);

    const keysHeading = document.createElement('h3');
    keysHeading.textContent = 'Keyboard control';
    extraControls.append(keysHeading);

    const keysNote = document.createElement('p');
    keysNote.textContent =
        'These keys only work while your screen reader is passing keystrokes straight through to' +
        ' Unstrung, which is focus mode in NVDA. Outside that, use the buttons above, which do the' +
        ' same things.';
    extraControls.append(keysNote);

    // Worth stating outright, because the consequence shows up in a different tab from the cause
    // and looks like a bug there. Nothing in the page can turn this mode off: a mode the reader
    // was told to enter stays entered until it is told otherwise, which is the whole point of it
    // being a manual choice.
    const keysModeNote = document.createElement('p');
    keysModeNote.textContent =
        'You turn that mode on yourself, so you have to turn it off yourself as well. Unstrung' +
        ' cannot do it for you. If you switch tabs while it is still on, the tab you arrive at will' +
        ' not be navigable, because your screen reader is still handing every key to Unstrung' +
        ' instead of using them to move around the document. Turn the mode off and the new tab' +
        ' behaves normally again.';
    extraControls.append(keysModeNote);

    const keysList = document.createElement('ul');
    appendTextItems(keysList, [
        'Space - pause and resume',
        'Left arrow - back one measure',
        'Right arrow - forward one measure',
        'Down arrow - back to the start of the current measure',
        'Up arrow - restart the selected measures, counting in again;' +
            ' keeps count of which repeat you are on',
        'B - say which measure you are in, and which repeat',
        'M - metronome on or off',
        `S - slower by ${AUDIO_TRACK_TEMPO_STEP_BPM} BPM`,
        `F - faster by ${AUDIO_TRACK_TEMPO_STEP_BPM} BPM`
    ]);
    extraControls.append(keysList);

    // Moving around stays silent so the music is not talked over. This is where the keys that
    // exist to ask a question put their answer. Deliberately not role="status", which maps to a
    // status bar on Windows and reads oddly mid-panel.
    const announce = document.createElement('p');
    announce.setAttribute('aria-live', 'polite');
    announce.setAttribute('aria-atomic', 'true');
    container.append(announce);

    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.textContent = 'Set a tempo if you want one, then press Create Track.';
    container.append(status);

    state.ui = {
        tempoInput, metronomeCheckbox, countInEachPassCheckbox, createButton, playButton, error,
        extraControls, firstInput, lastInput, repeatInput, measuresSummary,
        status, announce, summary, transportButtons
    };
    refreshAudioTrackSummary(state);
    updateAudioTrackSelectionSummary(state);

    metronomeCheckbox.addEventListener('change', () =>
        setAudioTrackMetronome(state, metronomeCheckbox.checked));

    // Re-anchors while playing, the same way the metronome does. Repeats are already scheduled
    // ahead, and the reported position is worked out from how long a repeat takes, so leaving the
    // old schedule running under the new setting would put the two out of step.
    countInEachPassCheckbox.addEventListener('change', () => {
        state.countInEachPass = countInEachPassCheckbox.checked;
        if (state.playing) {
            const position = audioTrackPosition(state);
            pauseAudioTrackPlayback(state);
            startAudioTrackPlayback(state, position);
        }
    });

    // Committing on change rather than on every keystroke: a number field fires input for each
    // digit typed, and rebuilding the timeline mid-number would be wasted work.
    tempoInput.addEventListener('change', () =>
        applyAudioTrackTempo(state, Number(tempoInput.value)));

    for (const input of [firstInput, lastInput, repeatInput]) {
        input.addEventListener('change', () => applyAudioTrackSelection(state));
    }

    createButton.addEventListener('click', () => {
        stopAudioTrackPlayback();
        clearAudioTrackTimers();
        setAudioTrackPlayingState(state, false);
        state.anchorSeconds = audioTrackRange(state).startSeconds;
        state.anchorContextTime = null;
        state.anchorPass = 1;
        prepareAudioTrack(state);
    });

    playButton.addEventListener('click', () => toggleAudioTrackPlayback(state));

    return container;
}

function openAudioTrackTab(score, trackIndex, songTabId) {
    const panelKey = `${songTabId}:${trackIndex}`;

    // Already open: go to it rather than making a second one, so its settings are preserved.
    const existing = audioTrackPanels.get(panelKey);
    if (existing && tabs.some(tab => tab.id === existing.tabId)) {
        activateTab(existing.tabId, { focusContent: true });
        setStatus(`Showing the existing audio track for ${existing.state.audioTrack.trackName}.`);
        return;
    }

    const state = {
        score,
        trackIndex,
        songTabId,
        targetTempo: score.tempo || 120,
        audioTrack: null,
        ready: false,
        ui: null,
        // Transport: where we are in the track, and the context time that position was anchored at.
        playing: false,
        anchorSeconds: 0,
        anchorContextTime: null,
        metronome: false,
        countInArmed: false,
        // Off by default: a count-in before every repeat is occasionally wanted, but it interrupts
        // a loop being used to drill a phrase, which is the usual reason for looping at all.
        countInEachPass: false,
        // Which measures play, how many times, and which play-through we are on.
        firstMeasure: 1,
        lastMeasure: 1,
        repeatCount: 1,
        anchorPass: 1,
        rangeCache: null,
        failedSampleKeys: null
    };
    state.audioTrack = deriveAudioTrack(state);

    if (!state.audioTrack || state.audioTrack.notes.length === 0) {
        setStatus('That track has no playable notes.');
        return;
    }
    state.lastMeasure = state.audioTrack.barCount;

    const container = buildAudioTrackPanel(state);
    const tab = createTab(`${state.audioTrack.trackName} (audio)`, container, {
        kind: 'audio-track',
        insertAfterTabId: songTabId,
        onClose: () => {
            stopAudioTrackPlayback();
            clearAudioTrackTimers();
            audioTrackPanels.delete(panelKey);
        }
    });

    audioTrackPanels.set(panelKey, { tabId: tab.id, state });
    activateTab(tab.id, { focusContent: true });
    setStatus(`Opened the audio track settings for ${state.audioTrack.trackName}.`);
}
// --- end audio track playback ---

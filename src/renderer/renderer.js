import * as alphaTab from '@coderline/alphatab';
import { extractScoreMetadata } from '../shared/scoreMetadata.mjs';

const statusElement = document.getElementById('status');
const emptyStateElement = document.getElementById('empty-state');
const tabStripElement = document.getElementById('tab-strip');
const tablistElement = document.getElementById('tablist');
const tabpanelsElement = document.getElementById('tabpanels');
const audioSectionElement = document.getElementById('audio-section');
const playAudioButton = document.getElementById('play-audio-button');
const audioPlayerElement = document.getElementById('audio-player');

/** @type {{ id: number, fileName: string, buttonEl: HTMLButtonElement, panelEl: HTMLElement, score: object|undefined, audioUrl: string|undefined }[]} */
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
    audioSectionElement.hidden = !hasTabs;
}

function resetAudioPlayer() {
    audioPlayerElement.pause();
    audioPlayerElement.hidden = true;
    audioPlayerElement.removeAttribute('src');
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

    const tab = { id, fileName, buttonEl: button, panelEl: panel, score, audioUrl: undefined };
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
    resetAudioPlayer();
}

function closeTab(id) {
    const index = tabs.findIndex(t => t.id === id);
    if (index === -1) return;

    const [closed] = tabs.splice(index, 1);
    closed.buttonEl.remove();
    closed.panelEl.remove();
    if (closed.audioUrl) URL.revokeObjectURL(closed.audioUrl);
    if (activeTabId === id) resetAudioPlayer();
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

let cachedSoundFontPromise = null;
function loadSoundFont() {
    if (!cachedSoundFontPromise) {
        cachedSoundFontPromise = fetch('./sonivox.sf2')
            .then(response => {
                if (!response.ok) throw new Error(`Failed to load sound font (HTTP ${response.status})`);
                return response.arrayBuffer();
            })
            .then(buffer => new Uint8Array(buffer));
    }
    return cachedSoundFontPromise;
}

function createNoopSynthOutput() {
    const noopEmitter = { on: () => () => {}, off: () => {} };
    return {
        sampleRate: 44100,
        open() {},
        play() {},
        pause() {},
        destroy() {},
        addSamples() {},
        resetSamples() {},
        activate() {},
        ready: noopEmitter,
        samplesPlayed: noopEmitter,
        sampleRequest: noopEmitter,
        async enumerateOutputDevices() {
            return [];
        },
        async setOutputDevice() {},
        async getOutputDevice() {
            return null;
        }
    };
}

function encodeWav(interleavedFloat32, sampleRate, numChannels) {
    const bytesPerSample = 2;
    const blockAlign = numChannels * bytesPerSample;
    const dataSize = interleavedFloat32.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (offset, text) => {
        for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bytesPerSample * 8, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < interleavedFloat32.length; i++) {
        const clamped = Math.max(-1, Math.min(1, interleavedFloat32[i]));
        view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
        offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
}

async function renderAudioForScore(score) {
    const midiFile = new alphaTab.midi.MidiFile();
    const handler = new alphaTab.midi.AlphaSynthMidiFileHandler(midiFile);
    const generator = new alphaTab.midi.MidiFileGenerator(score, null, handler);
    generator.generate();

    const soundFont = await loadSoundFont();

    const options = new alphaTab.synth.AudioExportOptions();
    options.sampleRate = 44100;
    options.soundFonts = [soundFont];

    const synth = new alphaTab.synth.AlphaSynth(createNoopSynthOutput(), 100);
    const exporter = synth.exportAudio(options, midiFile, generator.syncPoints, generator.transpositionPitches);

    const chunks = [];
    let totalSamples = 0;
    let chunkCount = 0;
    let chunk;
    while ((chunk = exporter.render(500))) {
        chunks.push(chunk.samples);
        totalSamples += chunk.samples.length;
        chunkCount++;
        if (chunkCount % 10 === 0) {
            // Yield periodically so a long song doesn't freeze the UI thread while rendering.
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    const interleaved = new Float32Array(totalSamples);
    let offset = 0;
    for (const samples of chunks) {
        interleaved.set(samples, offset);
        offset += samples.length;
    }

    return encodeWav(interleaved, options.sampleRate, 2);
}

playAudioButton.addEventListener('click', async () => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;

    if (!tab.score) {
        setStatus(`No parsed data is available to generate audio for "${tab.fileName}".`);
        return;
    }

    playAudioButton.disabled = true;
    setStatus(`Generating audio for "${tab.fileName}"…`);
    try {
        if (!tab.audioUrl) {
            const blob = await renderAudioForScore(tab.score);
            tab.audioUrl = URL.createObjectURL(blob);
        }
        audioPlayerElement.src = tab.audioUrl;
        audioPlayerElement.hidden = false;
        await audioPlayerElement.play();
        setStatus(`Playing audio for "${tab.fileName}".`);
    } catch (error) {
        setStatus(`Could not generate audio for "${tab.fileName}": ${error && error.message ? error.message : error}`);
    } finally {
        playAudioButton.disabled = false;
    }
});

window.unstrung.onFileOpened(handleFileOpened);
window.unstrung.onFileOpenError(handleFileOpenError);
window.unstrung.onCloseCurrentTab(() => {
    if (activeTabId != null) closeTab(activeTabId);
});
window.unstrung.onNextTab(() => shiftActiveTab(1));
window.unstrung.onPreviousTab(() => shiftActiveTab(-1));

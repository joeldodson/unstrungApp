/**
 * The browser implementation of window.unstrung, the one object through which the page reaches
 * the platform. src/main/preload.js is the Electron implementation; the page cannot tell them
 * apart except through `platform` and `capabilities`.
 *
 * Written for Chromium (Chrome and Edge). Files use the File System Access API, which Firefox and
 * Safari do not have; there, opening a file says so instead of failing silently.
 *
 * Never asks the browser for permission. A file or folder kept from an earlier visit needs the
 * browser's permission again before it can be used, and Chrome asks with a question by the address
 * bar that NVDA does not announce and that is hard to find even knowing it is there: Joel found it
 * only by moving through the tab strip with F6. Waiting on it made Open Saved Progression, Save and
 * recent files look as if they did nothing. So every file is reached through the Windows Open and
 * Save dialogs, which a screen reader reads like any other dialog, and nothing needs permission:
 *   - Opening a song or a progression: the Open dialog. The browser remembers the last folder used
 *     for each kind of file, which is what the desktop app's folder settings were for.
 *   - Saving: straight to the file when the browser already allows it in this visit, as it does
 *     after a Save dialog; otherwise the Save dialog, with the file's name filled in.
 *   - Recent files: a copy of each song is kept when it is opened, and reopened from there unless
 *     the browser already allows reading the original.
 *
 * Where things live: settings in localStorage; recent files, with their copies, in IndexedDB;
 * samples and spoken chord names fetched from audio/ next to this page, as Opus, the first time
 * each is needed, and kept in the Cache API.
 *
 * Every URL is relative, because the page is served from a folder (/unstrung/app/), not the root.
 */

// The version is put in at build time by scripts/build-web.mjs.
/* global __UNSTRUNG_VERSION__ */
const VERSION = typeof __UNSTRUNG_VERSION__ === 'string' ? __UNSTRUNG_VERSION__ : 'unknown';

const MAX_RECENT_FILES = 10;
// A song larger than this is still listed, but not copied, so it can be reopened only while the
// browser allows reading the original. Guitar Pro files are well under a megabyte.
const MAX_RECENT_COPY_BYTES = 8 * 1024 * 1024;
const VELOCITY_LABELS = ['p', 'mf', 'f'];
const NOTE_LETTER_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const SONG_FILE_TYPES = [{
    description: 'Music notation files',
    accept: { 'application/octet-stream': ['.gp', '.gpx', '.gp5', '.gp4', '.gp3', '.musicxml', '.xml'] }
}];
const PROGRESSION_FILE_TYPES = [{
    description: 'Chord progressions',
    accept: { 'application/json': ['.json'] }
}];
// The browser remembers the last folder used with each id, separately.
const SONG_PICKER_ID = 'unstrung-songs';
const PROGRESSION_PICKER_ID = 'unstrung-progressions';

// --- Small helpers ------------------------------------------------------------------------

function listeners() {
    const callbacks = [];
    return {
        add: callback => callbacks.push(callback),
        emit: payload => { for (const callback of callbacks) callback(payload); }
    };
}

const fileOpened = listeners();
const fileOpenError = listeners();
const recentFilesChanged = listeners();

/** Whether a picker was dismissed, which is not an error worth reporting. */
const isCancel = error => error?.name === 'AbortError';

/** Whether the browser already allows this, without asking. Asking is never done. */
async function isAllowed(handle, mode) {
    try {
        return await handle.queryPermission({ mode }) === 'granted';
    } catch {
        return false;
    }
}

const noFilePickers = () => !window.showOpenFilePicker;
const NO_FILE_PICKERS_MESSAGE = 'this browser cannot open files. Use Chrome or Edge.';

// --- IndexedDB: one store of keyed values ---------------------------------------------------

const DB_NAME = 'unstrung';
const STORE = 'kv';
let dbPromise = null;

function openDb() {
    dbPromise ??= new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    return dbPromise;
}

async function dbGet(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const request = db.transaction(STORE).objectStore(STORE).get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function dbSet(key, value) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE, 'readwrite');
        transaction.objectStore(STORE).put(value, key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

// --- Settings -------------------------------------------------------------------------------

const SETTINGS_KEY = 'unstrung-settings';
const DEFAULT_SETTINGS = {
    terseBeatDescriptions: false, autoCollapseOnTabChange: true, chordVoice: 'zira', chordVoicePercent: 75
};

function readSettings() {
    try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

function writeSettings(changes) {
    const settings = { ...readSettings(), ...changes };
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch { /* storage unavailable: the setting lasts for this visit only */ }
    return settings;
}

// --- Recent files ---------------------------------------------------------------------------
// Each is { id, name, handle, copy }: the id stands in for the desktop app's path, handed back by
// the menu to open it; `copy` is the file's bytes when it was last opened.

async function readRecent() {
    return (await dbGet('recent-files')) ?? [];
}

async function writeRecent(list) {
    await dbSet('recent-files', list);
    recentFilesChanged.emit(list.map(({ id, name }) => ({ path: id, name })));
}

async function addRecent(handle, bytes) {
    const list = await readRecent();
    const kept = [];
    for (const entry of list) {
        if (!await entry.handle.isSameEntry(handle)) kept.push(entry);
    }
    const id = `recent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const copy = bytes.byteLength <= MAX_RECENT_COPY_BYTES ? bytes : null;
    await writeRecent([{ id, name: handle.name, handle, copy }, ...kept].slice(0, MAX_RECENT_FILES));
}

async function openSongHandle(handle) {
    let bytes;
    try {
        bytes = new Uint8Array(await (await handle.getFile()).arrayBuffer());
    } catch (error) {
        fileOpenError.emit({ fileName: handle.name, message: error.message });
        return;
    }
    fileOpened.emit({ fileName: handle.name, data: bytes });
    await addRecent(handle, bytes);
}

// --- Audio: samples and spoken chord names --------------------------------------------------

// One cache per release, so a re-encode in a later release is fetched again; older ones are
// removed the first time audio is needed.
const AUDIO_CACHE = `unstrung-audio-${VERSION}`;
let audioCachePromise = null;

function audioCache() {
    audioCachePromise ??= (async () => {
        if (!('caches' in window)) return null;
        for (const name of await caches.keys()) {
            if (name.startsWith('unstrung-audio-') && name !== AUDIO_CACHE) await caches.delete(name);
        }
        // Without this the browser may clear the cache when space runs short.
        navigator.storage?.persist?.().catch(() => {});
        return caches.open(AUDIO_CACHE);
    })();
    return audioCachePromise;
}

async function fetchAudio(relativePath) {
    const url = new URL(`audio/${relativePath}`, document.baseURI).href;
    const cache = await audioCache();
    let response = await cache?.match(url);
    if (!response) {
        response = await fetch(url);
        if (!response.ok) throw new Error(`Could not fetch ${relativePath}: ${response.status}`);
        await cache?.put(url, response.clone());
    }
    return new Uint8Array(await response.arrayBuffer());
}

let sampleMapPromise = null;
const sampleMap = () => (sampleMapPromise ??= fetch('audio/sample-map.json').then(r => r.json()));

// Where each note and velocity has reached in its round-robin cycle, as in the desktop app.
const roundRobinCursors = new Map();

let voicesPromise = null;
const voices = () => (voicesPromise ??= fetch('audio/speech/voices.json').then(r => r.json()));
const speechManifests = new Map();

function speechManifest(voice) {
    if (!speechManifests.has(voice)) {
        speechManifests.set(voice, fetch(`audio/speech/${voice}/manifest.json`).then(r => {
            if (!r.ok) throw new Error(`No speech assets for voice "${voice}"`);
            return r.json();
        }));
    }
    return speechManifests.get(voice);
}

let chordLibraryPromise = null;

// --- Saved progressions ---------------------------------------------------------------------
// Files opened or saved this visit are kept in memory by an id, which stands in for the desktop
// app's file path and is how the page asks to save over one.

const knownProgressionFiles = new Map(); // id -> FileSystemFileHandle
let nextProgressionFileId = 1;

async function idForProgressionFile(handle) {
    for (const [id, known] of knownProgressionFiles) {
        if (await known.isSameEntry(handle)) return id;
    }
    const id = `progression-${nextProgressionFileId++}`;
    knownProgressionFiles.set(id, handle);
    return id;
}

const baseName = name => name.replace(/\.[^.]*$/, '');

function safeFileName(name) {
    const cleaned = String(name ?? '')
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[. ]+$/, '')
        .slice(0, 100);
    return cleaned || 'Chord progression';
}

// --- Leaving the page -----------------------------------------------------------------------
// A page cannot show its own Save, Don't Save, Cancel on the way out; it can only ask the browser
// for its generic "Leave site?" prompt. Asked for whenever anything is open, since leaving closes
// every open item, saved or not.

let unsavedProgressions = false;
window.addEventListener('beforeunload', event => {
    if (unsavedProgressions || document.querySelector('#open-items-list li')) {
        event.preventDefault();
        event.returnValue = '';
    }
});

// --- The object -----------------------------------------------------------------------------

window.unstrung = {
    platform: 'web',
    // What the browser cannot do that the desktop app can. The page hides the controls for them.
    // There is no progressions folder: saved progressions are opened through the Open dialog
    // rather than a tree of the folder, since reading a folder from an earlier visit needs the
    // browser's permission, which is never asked for. See the top of this file.
    capabilities: {
        typedFolderPaths: false, openFolderInFileManager: false, defaultOpenFolder: false,
        progressionsFolder: false
    },

    getAppVersion: async () => VERSION,
    openExternalLink: url => { window.open(url, '_blank', 'noopener,noreferrer'); },

    // Song files.
    openFileDialog: async () => {
        if (noFilePickers()) {
            fileOpenError.emit({ fileName: 'Open File', message: NO_FILE_PICKERS_MESSAGE });
            return;
        }
        let handle;
        try {
            [handle] = await window.showOpenFilePicker({ id: SONG_PICKER_ID, types: SONG_FILE_TYPES });
        } catch (error) {
            if (!isCancel(error)) fileOpenError.emit({ fileName: 'Open File', message: error.message });
            return;
        }
        await openSongHandle(handle);
    },
    // The original when the browser already allows reading it, which it does for a file opened in
    // this visit; otherwise the copy kept when it was last opened.
    openRecentFile: async id => {
        const entry = (await readRecent()).find(recent => recent.id === id);
        if (!entry) return;
        if (await isAllowed(entry.handle, 'read')) {
            await openSongHandle(entry.handle);
        } else if (entry.copy) {
            fileOpened.emit({ fileName: entry.name, data: entry.copy });
        } else {
            fileOpenError.emit({
                fileName: entry.name,
                message: 'Unstrung has no copy of it, so open it again with Open File.'
            });
        }
    },
    getRecentFiles: async () => (await readRecent()).map(({ id, name }) => ({ path: id, name })),
    onRecentFilesChanged: recentFilesChanged.add,
    onFileOpened: fileOpened.add,
    onFileOpenError: fileOpenError.add,

    // Samples.
    getGuitarSampleNotes: async () => Object.keys((await sampleMap()).notes).map(Number).sort((a, b) => a - b)
        .map(key => ({ key, label: `${NOTE_LETTER_NAMES[key % 12]}${Math.floor(key / 12) - 1}` })),
    // The whole recording, whatever `maxSeconds` asks: Opus cannot be cut by bytes the way a WAV
    // can, and the playback code already stops a note when it wants it to stop.
    getGuitarSampleAudio: async (key, velocity) => {
        if (!VELOCITY_LABELS.includes(velocity)) throw new Error(`Unknown velocity "${velocity}"`);
        const candidates = (await sampleMap()).notes[key]?.[velocity];
        if (!candidates || candidates.length === 0) throw new Error(`No "${velocity}" sample for key ${key}`);
        const cursorKey = `${key}:${velocity}`;
        const next = ((roundRobinCursors.get(cursorKey) ?? -1) + 1) % candidates.length;
        roundRobinCursors.set(cursorKey, next);
        return fetchAudio(candidates[next]);
    },

    // Spoken chord names.
    listSpokenVoices: async () => {
        const list = await voices().catch(() => []);
        return { supported: list.length > 0, voices: list };
    },
    getSpokenPhrases: async (voice, phrases) => {
        const manifest = await speechManifest(voice);
        const rendered = [];
        for (const text of phrases ?? []) {
            const file = manifest.phrases[text];
            if (!file) continue;
            rendered.push({ text, bytes: await fetchAudio(`speech/${voice}/${file}`) });
        }
        return rendered;
    },

    // Saved progressions. The Open dialog, called before anything else is awaited: a browser shows
    // it only while it is still handling the key press or click that asked. Null when cancelled.
    pickProgression: async () => {
        if (noFilePickers()) throw new Error(NO_FILE_PICKERS_MESSAGE);
        let handle;
        try {
            [handle] = await window.showOpenFilePicker({ id: PROGRESSION_PICKER_ID, types: PROGRESSION_FILE_TYPES });
        } catch (error) {
            if (isCancel(error)) return null;
            throw error;
        }
        const text = await (await handle.getFile()).text();
        return { filePath: await idForProgressionFile(handle), name: baseName(handle.name), text };
    },
    /**
     * Save writes straight to the file when the browser already allows it, which it does after a
     * Save dialog in this visit. Otherwise, and for Save As, it is the Save dialog, starting beside
     * the file with its name filled in, so saving over it is Enter and confirming the replacement.
     * The dialog is asked for before anything else that could take long is awaited, for the same
     * reason as the Open dialog.
     */
    saveProgression: async ({ text, filePath, suggestedName }) => {
        const known = filePath ? knownProgressionFiles.get(filePath) : null;
        let handle = known && await isAllowed(known, 'readwrite') ? known : null;
        if (!handle) {
            if (noFilePickers()) throw new Error(NO_FILE_PICKERS_MESSAGE);
            try {
                handle = await window.showSaveFilePicker({
                    id: PROGRESSION_PICKER_ID,
                    suggestedName: known ? known.name : `${safeFileName(suggestedName)}.json`,
                    ...(known ? { startIn: known } : {}),
                    types: PROGRESSION_FILE_TYPES
                });
            } catch (error) {
                if (isCancel(error)) return null;
                throw error;
            }
        }
        // Chrome writes to a temporary file and swaps it in when the stream closes, so a failed
        // save never leaves half a file.
        const writable = await handle.createWritable();
        await writable.write(String(text));
        await writable.close();
        return {
            filePath: await idForProgressionFile(handle),
            name: baseName(handle.name),
            // There is no folder that Open Saved Progression lists, so nothing to warn about.
            insideFolder: true
        };
    },
    // Only the desktop app lists a folder; the page does not call these in a browser.
    listProgressions: async () => ({ directory: null, exists: false, tree: [] }),
    readProgression: async () => { throw new Error('a browser opens saved progressions with the Open dialog'); },
    openProgressionsFolder: async () => ({ directory: null, error: 'a web page cannot open a folder in your file manager' }),
    setUnsavedProgressions: value => { unsavedProgressions = value === true; },
    // Nothing to confirm: the browser's own prompt covers leaving.
    onConfirmQuit: () => {},
    confirmQuit: () => {},

    // Chord library.
    getChordLibrary: () => (chordLibraryPromise ??= fetch('chord-library.json').then(r => r.json())),

    // Settings.
    getSettings: async () => ({
        ...readSettings(),
        defaultOpenDirectory: '',
        progressionsDirectory: '',
        defaultProgressionsDirectory: ''
    }),
    chooseSettingsDirectory: async () => null,
    validateAndSaveSettingsDirectory: async () => ({ valid: true }),
    chooseProgressionsDirectory: async () => null,
    saveProgressionsDirectory: async () => ({ valid: true, directory: '' }),
    clearRecentFiles: async () => {
        const removedCount = (await readRecent()).length;
        await writeRecent([]);
        return { removedCount };
    },
    // Only files the browser already allows reading can be checked; the rest are kept, with their
    // copies, since asking is never done.
    removeStaleRecentFiles: async () => {
        const list = await readRecent();
        const kept = [];
        for (const entry of list) {
            let stale = false;
            if (await isAllowed(entry.handle, 'read')) {
                try { await entry.handle.getFile(); } catch { stale = true; }
            }
            if (!stale) kept.push(entry);
        }
        await writeRecent(kept);
        return { removedCount: list.length - kept.length };
    },
    saveScreenReaderSettings: async settings => {
        const saved = writeSettings({
            terseBeatDescriptions: settings?.terseBeatDescriptions === true,
            autoCollapseOnTabChange: settings?.autoCollapseOnTabChange !== false
        });
        return { terseBeatDescriptions: saved.terseBeatDescriptions, autoCollapseOnTabChange: saved.autoCollapseOnTabChange };
    },
    saveChordVoiceSettings: async settings => {
        const changes = {};
        if (typeof settings?.chordVoice === 'string') changes.chordVoice = settings.chordVoice;
        const percent = Number(settings?.chordVoicePercent);
        if (Number.isFinite(percent)) changes.chordVoicePercent = Math.max(0, Math.min(100, Math.round(percent)));
        const saved = writeSettings(changes);
        return { chordVoice: saved.chordVoice, chordVoicePercent: saved.chordVoicePercent };
    }
};

/**
 * The browser implementation of window.unstrung, the one object through which the page reaches
 * the platform. src/main/preload.js is the Electron implementation; the page cannot tell them
 * apart except through `platform` and `capabilities`.
 *
 * Written for Chromium (Chrome and Edge). Files and folders use the File System Access API,
 * which Firefox and Safari do not have; there, opening a file says so instead of failing silently.
 *
 * Where things live:
 *   - Settings: localStorage.
 *   - Recent files and the progressions folder: file and folder handles, in IndexedDB. Chrome may
 *     ask permission again on a later visit before one of them can be used.
 *   - Samples and spoken chord names: fetched from audio/ next to this page, as Opus, the first
 *     time each is needed, and kept in the Cache API so a later visit does not fetch them again.
 *
 * Every URL is relative, because the page is served from a folder (/unstrung/app/), not the root.
 */

// The version is put in at build time by scripts/build-web.mjs.
/* global __UNSTRUNG_VERSION__ */
const VERSION = typeof __UNSTRUNG_VERSION__ === 'string' ? __UNSTRUNG_VERSION__ : 'unknown';

const MAX_RECENT_FILES = 10;
const MAX_PROGRESSION_FILE_BYTES = 1024 * 1024;
const MAX_PROGRESSION_FOLDER_DEPTH = 12;
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

// --- Asking the browser for permission again --------------------------------------------------
//
// A file or folder chosen on an earlier visit cannot be used again until the browser is given
// permission again, unless the player chose "Allow on every visit". The browser asks with its own
// question, which appears by the address bar, outside the page, where a screen reader may well not
// announce it. Asked for without warning, it looked as if Unstrung had simply stopped: Open Saved
// Progression did nothing and Save did nothing, each waiting on an answer nobody knew was wanted.
//
// So the page asks first, in a dialog of its own that says what is about to happen and how to reach
// the browser's question. Its Continue button is also what lets the request through: the browser
// asks only while it is handling a key press or click, and that press is the one.

const permissionDialog = document.createElement('dialog');
permissionDialog.id = 'permission-dialog';
permissionDialog.tabIndex = -1;
permissionDialog.setAttribute('aria-labelledby', 'permission-dialog-heading-name');
permissionDialog.setAttribute('aria-describedby', 'permission-dialog-message');
permissionDialog.innerHTML = `
    <h1 id="permission-dialog-heading"><span id="permission-dialog-heading-name">Permission Needed</span> Dialog Box</h1>
    <p id="permission-dialog-message"></p>
    <p>
        When you press Continue, the browser asks its own question, which appears by the address
        bar. If your screen reader does not read it, press Alt+Shift+A to move to it. If it offers
        Allow on every visit, choosing that stops this coming back each time Unstrung is opened.
    </p>
    <div class="button-row">
        <button type="button" id="permission-dialog-continue">Continue</button>
        <button type="button" id="permission-dialog-cancel">Cancel</button>
    </div>`;
// Before the renderer runs, so it sees this dialog along with its own: it names an open dialog in
// the window title.
document.body.append(permissionDialog);

let permissionAnswer = null;
permissionDialog.querySelector('#permission-dialog-continue').addEventListener('click', () => {
    const answer = permissionAnswer;
    permissionAnswer = null;
    permissionDialog.close();
    answer?.(true);
});
permissionDialog.querySelector('#permission-dialog-cancel').addEventListener('click', () => permissionDialog.close());
// Escape and Cancel both end up here, with no answer given.
permissionDialog.addEventListener('close', () => {
    const answer = permissionAnswer;
    permissionAnswer = null;
    answer?.(false);
});

/**
 * Whether a file or folder handle may be used, asking for permission if a previous visit had it.
 * `what` names it for the dialog: "the file Ripple.gp5".
 */
async function ensurePermission(handle, mode, what) {
    if (await handle.queryPermission({ mode }) === 'granted') return true;
    const returnFocus = document.activeElement;
    document.getElementById('permission-dialog-message').textContent =
        `The browser needs your permission again before Unstrung can use ${what}.`;
    const proceed = await new Promise(resolve => {
        permissionAnswer = resolve;
        permissionDialog.showModal();
        permissionDialog.focus();
    });
    if (returnFocus?.isConnected) returnFocus.focus();
    if (!proceed) return false;
    try {
        return await handle.requestPermission({ mode }) === 'granted';
    } catch {
        return false;
    }
}

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
// Each is { id, name, handle }. The id stands in for the desktop app's path: it is what the menu
// hands back to open one.

async function readRecent() {
    return (await dbGet('recent-files')) ?? [];
}

async function writeRecent(list) {
    await dbSet('recent-files', list);
    recentFilesChanged.emit(list.map(({ id, name }) => ({ path: id, name })));
}

async function addRecent(handle) {
    const list = await readRecent();
    const kept = [];
    for (const entry of list) {
        if (!await entry.handle.isSameEntry(handle)) kept.push(entry);
    }
    const id = `recent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await writeRecent([{ id, name: handle.name, handle }, ...kept].slice(0, MAX_RECENT_FILES));
}

async function openSongHandle(handle) {
    let file;
    try {
        file = await handle.getFile();
    } catch (error) {
        fileOpenError.emit({ fileName: handle.name, message: error.message });
        return;
    }
    fileOpened.emit({ fileName: file.name, data: new Uint8Array(await file.arrayBuffer()) });
    await addRecent(handle);
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
// The folder is a directory handle the player chose, kept in IndexedDB. Files opened from it or
// saved this visit are kept in memory by an id, which stands in for the desktop app's file path:
// only those can be saved over without the Save dialog.

const knownProgressionFiles = new Map(); // id -> FileSystemFileHandle
let nextProgressionFileId = 1;

// The chosen folder, read from IndexedDB as the page loads and kept here, so saving can name it as
// the place to start without waiting on anything. See saveProgression.
let storedProgressionsFolder = null;
dbGet('progressions-folder').then(handle => { storedProgressionsFolder = handle ?? null; }).catch(() => {});

/**
 * The progressions folder, ready to use, or null. A stored folder whose permission is refused is
 * reported as `denied` rather than replaced: the player chose it, and asking for another would be
 * a surprise.
 */
async function progressionsFolder({ ask }) {
    let handle = await dbGet('progressions-folder');
    if (handle) {
        if (await ensurePermission(handle, 'readwrite', `your folder for saved progressions, ${handle.name}`)) return handle;
        const denied = new Error(`permission to use the folder ${handle.name} was not given`);
        denied.folderName = handle.name;
        throw denied;
    }
    if (!ask) return null;
    try {
        handle = await window.showDirectoryPicker({ id: 'unstrung-progressions', mode: 'readwrite', startIn: 'documents' });
    } catch (error) {
        if (isCancel(error)) return null;
        throw error;
    }
    await dbSet('progressions-folder', handle);
    storedProgressionsFolder = handle;
    return handle;
}

async function idForProgressionFile(handle) {
    for (const [id, known] of knownProgressionFiles) {
        if (await known.isSameEntry(handle)) return id;
    }
    const id = `progression-${nextProgressionFileId++}`;
    knownProgressionFiles.set(id, handle);
    return id;
}

const baseName = name => name.replace(/\.[^.]*$/, '');

async function scanProgressionFolder(folder, relative, depth) {
    const entries = [];
    for await (const entry of folder.values()) entries.push(entry);
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    entries.sort((a, b) => collator.compare(a.name, b.name));

    const folders = [];
    const files = [];
    for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const entryRelative = relative ? `${relative}/${entry.name}` : entry.name;
        if (entry.kind === 'directory') {
            if (depth >= MAX_PROGRESSION_FOLDER_DEPTH) continue;
            folders.push({
                type: 'folder', name: entry.name, path: entryRelative,
                children: await scanProgressionFolder(entry, entryRelative, depth + 1)
            });
        } else if (entry.name.toLowerCase().endsWith('.json')) {
            const file = { type: 'file', name: baseName(entry.name), path: entryRelative };
            try {
                const blob = await entry.getFile();
                if (blob.size > MAX_PROGRESSION_FILE_BYTES) file.error = 'too large to be a saved progression';
                else file.text = await blob.text();
            } catch (error) {
                file.error = `could not be read: ${error.message}`;
            }
            files.push(file);
        }
    }
    return [...folders, ...files];
}

async function handleAtPath(folder, relativePath) {
    const parts = String(relativePath ?? '').split('/').filter(Boolean);
    if (parts.length === 0 || parts.some(part => part === '..' || part === '.')) {
        throw new Error('That file is not in the progressions folder.');
    }
    let current = folder;
    for (const part of parts.slice(0, -1)) current = await current.getDirectoryHandle(part);
    return current.getFileHandle(parts[parts.length - 1]);
}

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
    capabilities: { typedFolderPaths: false, openFolderInFileManager: false, defaultOpenFolder: false },

    getAppVersion: async () => VERSION,
    openExternalLink: url => { window.open(url, '_blank', 'noopener,noreferrer'); },

    // Song files.
    openFileDialog: async () => {
        if (!window.showOpenFilePicker) {
            fileOpenError.emit({
                fileName: 'Open File', message: 'this browser cannot open files. Use Chrome or Edge.'
            });
            return;
        }
        let handle;
        try {
            [handle] = await window.showOpenFilePicker({ id: 'unstrung-songs', types: SONG_FILE_TYPES, excludeAcceptAllOption: false });
        } catch (error) {
            if (!isCancel(error)) fileOpenError.emit({ fileName: 'Open File', message: error.message });
            return;
        }
        await openSongHandle(handle);
    },
    openRecentFile: async id => {
        const entry = (await readRecent()).find(recent => recent.id === id);
        if (!entry) return;
        try {
            if (!await ensurePermission(entry.handle, 'read', `the file ${entry.name}`)) {
                fileOpenError.emit({ fileName: entry.name, message: 'permission to read it was not given.' });
                return;
            }
        } catch (error) {
            fileOpenError.emit({ fileName: entry.name, message: error.message });
            return;
        }
        await openSongHandle(entry.handle);
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

    // Saved progressions.
    listProgressions: async () => {
        let folder;
        try {
            folder = await progressionsFolder({ ask: true });
        } catch (error) {
            if (!error.folderName) throw error;
            return { directory: error.folderName, exists: false, denied: true, tree: [] };
        }
        if (!folder) return { directory: null, exists: false, tree: [] };
        return { directory: folder.name, exists: true, tree: await scanProgressionFolder(folder, '', 0) };
    },
    readProgression: async relativePath => {
        const folder = await progressionsFolder({ ask: false });
        if (!folder) throw new Error('No folder for saved progressions has been chosen.');
        const handle = await handleAtPath(folder, relativePath);
        const text = await (await handle.getFile()).text();
        return { filePath: await idForProgressionFile(handle), name: baseName(handle.name), text };
    },
    // The Save dialog is asked for before anything else is awaited. A browser shows it only while
    // it is still handling the key press or click that asked, and anything in between can use that
    // up: above all a permission prompt for the progressions folder, which also appears where a
    // screen reader may not announce it. So the folder is only suggested as the place to start,
    // which needs no permission, and is never asked about here.
    saveProgression: async ({ text, filePath, suggestedName }) => {
        let handle = filePath ? knownProgressionFiles.get(filePath) : null;
        if (!handle) {
            try {
                handle = await window.showSaveFilePicker({
                    id: 'unstrung-progressions',
                    suggestedName: `${safeFileName(suggestedName)}.json`,
                    startIn: storedProgressionsFolder ?? 'documents',
                    types: PROGRESSION_FILE_TYPES
                });
            } catch (error) {
                if (isCancel(error)) return null;
                throw error;
            }
        } else if (!await ensurePermission(handle, 'readwrite', `the file ${handle.name}`)) {
            throw new Error('permission to save it was not given');
        }
        const folder = storedProgressionsFolder;
        // Chrome writes to a temporary file and swaps it in when the stream closes, so a failed
        // save never leaves half a file.
        const writable = await handle.createWritable();
        await writable.write(String(text));
        await writable.close();
        return {
            filePath: await idForProgressionFile(handle),
            name: baseName(handle.name),
            insideFolder: folder ? (await folder.resolve(handle).catch(() => null)) !== null : false
        };
    },
    openProgressionsFolder: async () => ({ directory: null, error: 'a web page cannot open a folder in your file manager' }),
    setUnsavedProgressions: value => { unsavedProgressions = value === true; },
    // Nothing to confirm: the browser's own prompt covers leaving.
    onConfirmQuit: () => {},
    confirmQuit: () => {},

    // Chord library.
    getChordLibrary: () => (chordLibraryPromise ??= fetch('chord-library.json').then(r => r.json())),

    // Settings.
    getSettings: async () => {
        const settings = readSettings();
        const folder = await dbGet('progressions-folder').catch(() => null);
        return {
            ...settings,
            defaultOpenDirectory: '',
            progressionsDirectory: folder?.name ?? '',
            defaultProgressionsDirectory: ''
        };
    },
    chooseSettingsDirectory: async () => null,
    validateAndSaveSettingsDirectory: async () => ({ valid: true }),
    // Choosing is saving: the picker hands back a handle, and the name is all that can be shown.
    chooseProgressionsDirectory: async () => {
        try {
            const handle = await window.showDirectoryPicker({ id: 'unstrung-progressions', mode: 'readwrite', startIn: 'documents' });
            await dbSet('progressions-folder', handle);
            storedProgressionsFolder = handle;
            return handle.name;
        } catch (error) {
            if (isCancel(error)) return null;
            throw error;
        }
    },
    saveProgressionsDirectory: async () => {
        const folder = await dbGet('progressions-folder');
        return { valid: true, directory: folder?.name ?? '' };
    },
    clearRecentFiles: async () => {
        const removedCount = (await readRecent()).length;
        await writeRecent([]);
        return { removedCount };
    },
    // Only files already allowed this visit can be checked without asking; the rest are kept.
    removeStaleRecentFiles: async () => {
        const list = await readRecent();
        const kept = [];
        for (const entry of list) {
            let stale = false;
            if (await entry.handle.queryPermission({ mode: 'read' }) === 'granted') {
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

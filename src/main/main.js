const { app, BrowserWindow, Menu, dialog, shell, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

const OPEN_FILE_FILTERS = [
    { name: 'Music notation files', extensions: ['gp', 'gpx', 'gp5', 'gp4', 'gp3', 'musicxml', 'xml'] },
    { name: 'All files', extensions: ['*'] }
];

const ALLOWED_EXTERNAL_URLS = [
    'https://eyesunstrung.vip',
    'https://github.com/joeldodson/unstrungApp',
    'https://claude.ai',
    'https://github.com/sfzinstruments/karoryfer.black-and-green-guitars'
];

ipcMain.on('shell:open-external', (_event, url) => {
    if (ALLOWED_EXTERNAL_URLS.includes(url)) {
        shell.openExternal(url);
    }
});

// Keep this in sync with the About dialog content in src/renderer/index.html.
const HELP_TEXT = `Unstrung ${app.getVersion()}

Unstrung is an accessible, screen-reader-friendly viewer for song
composition files, such as Guitar Pro tablature. It parses a file into
its underlying data model - tracks, tuning, measures, time and key
signatures, and more - and presents that information as plain, semantic
text and headings instead of a visual score, so it can be read and
navigated entirely with a screen reader.

Usage:
  unstrung [file...]
  unstrung -h | --help

  file...        One or more song files to open on startup, each in its
                 own tab. If omitted, Unstrung starts with no files open.
  -h, --help     Show this help text and exit.

Supported file formats:
  Guitar Pro: .gp, .gpx, .gp5, .gp4, .gp3
  MusicXML: .musicxml, .xml

Unstrung is part of the eyesunstrung project:
  https://eyesunstrung.vip

Unstrung is free and open source software, released under the MIT
License. Source code:
  https://github.com/joeldodson/unstrungApp

Unstrung's code is almost entirely written by Claude Code
(https://claude.ai), based on prompting and direction from Joel Dodson.

Copyright (c) ${new Date().getFullYear()} Joel Dodson
`;

// --- Persisted app state: recently opened files and settings ---
const APP_STATE_PATH = path.join(app.getPath('userData'), 'app-state.json');
const MAX_RECENT_FILES = 10;

let appState = { recentFiles: [], defaultOpenDirectory: '' };

async function loadAppState() {
    try {
        const parsed = JSON.parse(await fs.readFile(APP_STATE_PATH, 'utf8'));
        return {
            recentFiles: Array.isArray(parsed.recentFiles) ? parsed.recentFiles : [],
            defaultOpenDirectory: typeof parsed.defaultOpenDirectory === 'string' ? parsed.defaultOpenDirectory : ''
        };
    } catch {
        return { recentFiles: [], defaultOpenDirectory: '' };
    }
}

async function saveAppState() {
    await fs.writeFile(APP_STATE_PATH, JSON.stringify(appState, null, 2), 'utf8');
}

async function addRecentFile(filePath) {
    appState.recentFiles = [filePath, ...appState.recentFiles.filter(p => p !== filePath)].slice(0, MAX_RECENT_FILES);
    await saveAppState();
}

async function isExistingDirectory(dirPath) {
    try {
        return (await fs.stat(dirPath)).isDirectory();
    } catch {
        return false;
    }
}

async function pathExists(candidatePath) {
    try {
        await fs.stat(candidatePath);
        return true;
    } catch {
        return false;
    }
}

ipcMain.handle('settings:get', () => ({ defaultOpenDirectory: appState.defaultOpenDirectory }));

ipcMain.handle('settings:clear-recent-files', async event => {
    const removedCount = appState.recentFiles.length;
    appState.recentFiles = [];
    await saveAppState();
    buildMenu(BrowserWindow.fromWebContents(event.sender));
    return { removedCount };
});

ipcMain.handle('settings:remove-stale-recent-files', async event => {
    const checks = await Promise.all(appState.recentFiles.map(async filePath => ({ filePath, exists: await pathExists(filePath) })));
    const removedCount = checks.filter(c => !c.exists).length;
    appState.recentFiles = checks.filter(c => c.exists).map(c => c.filePath);
    await saveAppState();
    buildMenu(BrowserWindow.fromWebContents(event.sender));
    return { removedCount };
});

ipcMain.handle('settings:choose-directory', async event => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(window, {
        title: 'Choose default folder for Open File',
        properties: ['openDirectory']
    });
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
});

ipcMain.handle('settings:validate-and-save-directory', async (_event, dirPath) => {
    const trimmed = (dirPath ?? '').trim();
    if (trimmed !== '' && !(await isExistingDirectory(trimmed))) {
        return { valid: false };
    }
    appState.defaultOpenDirectory = trimmed;
    await saveAppState();
    return { valid: true };
});
// --- end persisted app state ---

async function openFilePath(window, filePath) {
    const fileName = path.basename(filePath);

    try {
        const buffer = await fs.readFile(filePath);
        window.webContents.send('tabs:open-file', { fileName, data: new Uint8Array(buffer) });
        await addRecentFile(filePath);
        buildMenu(window);
    } catch (error) {
        window.webContents.send('tabs:open-file-error', { fileName, message: error.message });
    }
}

async function openFileAndCreateTab(window) {
    const options = {
        title: 'Choose a song file',
        properties: ['openFile'],
        filters: OPEN_FILE_FILTERS
    };
    if (appState.defaultOpenDirectory && await isExistingDirectory(appState.defaultOpenDirectory)) {
        options.defaultPath = appState.defaultOpenDirectory;
    }

    const result = await dialog.showOpenDialog(window, options);

    if (result.canceled || result.filePaths.length === 0) {
        return;
    }

    await openFilePath(window, result.filePaths[0]);
}

// --- Green Gretsch guitar sample playback (Tools menu) ---
// Samples are bundled with the app under src/assets/samples/green-gretsch, copied from the
// Black And Green Guitars pack (https://github.com/sfzinstruments/karoryfer.black-and-green-guitars),
// preserving that repo's own relative folder structure so its .sfz path resolution rules
// (sample= paths resolve relative to the Programs/ directory) keep working unmodified.
const GREEN_GRETSCH_ROOT = path.join(__dirname, '..', 'assets', 'samples', 'green-gretsch');
const GREEN_GRETSCH_PROGRAMS_DIR = path.join(GREEN_GRETSCH_ROOT, 'Programs');
const GREEN_ORD_MAP_PATH = path.join(GREEN_GRETSCH_PROGRAMS_DIR, 'modules', 'maps_green', 'ord.sfz');

const NOTE_LETTER_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function midiKeyToPitchName(midiKey) {
    const octave = Math.floor(midiKey / 12) - 1;
    return `${NOTE_LETTER_NAMES[midiKey % 12]}${octave}`;
}

// Parses <region> blocks, honoring opcodes set on an enclosing <group> header (some .sfz files
// set lokey/pitch_keycenter/trigger once per group rather than repeating it on every region).
async function parseSfzRegions(sfzPath) {
    const text = await fs.readFile(sfzPath, 'utf8');
    const parts = text.split(/<(region|group)>/);

    const regions = [];
    let group = {};
    for (let i = 1; i < parts.length; i += 2) {
        const headerType = parts[i];
        const body = parts[i + 1] ?? '';
        const getOpcode = key => {
            const match = body.match(new RegExp(`${key}=([^\\s]+)`));
            return match ? match[1] : undefined;
        };

        if (headerType === 'group') {
            group = {
                lokey: getOpcode('lokey'),
                pitch_keycenter: getOpcode('pitch_keycenter'),
                trigger: getOpcode('trigger')
            };
            continue;
        }

        const sample = getOpcode('sample');
        if (!sample || sample.startsWith('*')) continue;
        const key = Number(getOpcode('pitch_keycenter') ?? group.pitch_keycenter ?? getOpcode('lokey') ?? group.lokey);
        if (!Number.isFinite(key)) continue;
        regions.push({
            key,
            sample,
            trigger: getOpcode('trigger') ?? group.trigger,
            hivel: Number(getOpcode('hivel') ?? 127),
            // Round-robin ordering as the sample pack itself specifies it. A region with no
            // seq_position is the first step in the cycle.
            seqPosition: Number(getOpcode('seq_position') ?? 1),
            seqLength: Number(getOpcode('seq_length') ?? 1)
        });
    }
    return regions;
}

function resolveSamplePath(resolveBase, sample) {
    return path.resolve(resolveBase, sample.replace(/\\/g, '/'));
}

/**
 * Returns a WAV containing only the first `maxSeconds` of audio.
 *
 * The samples on disk run 6 to 7 seconds each so a note can ring for as long as the music
 * asks. Most playback needs far less than that, and sending the whole file costs both IPC
 * bandwidth and decode time. This trims per request, so a caller that genuinely needs the
 * full sustain simply asks for it; nothing is lost from the stored samples.
 *
 * Returns the buffer untouched if it isn't a WAV we recognise, or if the requested length
 * already covers the whole recording, so a bad request degrades to current behaviour.
 */
function sliceWavToDuration(buffer, maxSeconds) {
    if (!Number.isFinite(maxSeconds) || maxSeconds <= 0) return buffer;
    if (buffer.length < 12) return buffer;
    if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') return buffer;

    let byteRate = 0;
    let blockAlign = 0;
    let factValueOffset = -1;
    let dataOffset = -1;
    let dataSize = 0;

    let offset = 12;
    while (offset + 8 <= buffer.length) {
        const chunkId = buffer.toString('ascii', offset, offset + 4);
        const chunkSize = buffer.readUInt32LE(offset + 4);

        if (chunkId === 'fmt ' && offset + 24 <= buffer.length) {
            byteRate = buffer.readUInt32LE(offset + 16);
            blockAlign = buffer.readUInt16LE(offset + 20);
        } else if (chunkId === 'fact') {
            factValueOffset = offset + 8;
        } else if (chunkId === 'data') {
            dataOffset = offset + 8;
            dataSize = Math.min(chunkSize, buffer.length - dataOffset);
            break; // Anything after the audio data is dropped along with the tail we trim.
        }
        offset += 8 + chunkSize + (chunkSize % 2);
    }

    if (dataOffset < 0 || byteRate <= 0 || blockAlign <= 0) return buffer;

    // Keep whole sample frames, otherwise the decoder sees a torn final frame.
    const wantedBytes = Math.ceil((maxSeconds * byteRate) / blockAlign) * blockAlign;
    if (wantedBytes >= dataSize) return buffer;

    const out = Buffer.alloc(dataOffset + wantedBytes);
    buffer.copy(out, 0, 0, dataOffset + wantedBytes);
    out.writeUInt32LE(out.length - 8, 4);          // RIFF chunk size
    out.writeUInt32LE(wantedBytes, dataOffset - 4); // data chunk size
    if (factValueOffset >= 0 && factValueOffset + 4 <= out.length) {
        out.writeUInt32LE(wantedBytes / blockAlign, factValueOffset); // frame count
    }
    return out;
}

// Green Gretsch "ord" (normal picking) velocity tiers, confirmed directly against the sample
// filenames (twang_<note>_<p|mf|f>_rr<N>.wav): "p" (soft) always has 2 round-robins; "mf" and
// "f" have 4 for most notes but only 2 for the ten highest notes in range.
const VELOCITY_LABELS = ['p', 'mf', 'f'];

let cachedOrdRegionsByKey = null;

// Where each note+velocity has reached in its round-robin cycle. Keyed "<midi>:<velocity>",
// so every note advances through its own takes independently.
const roundRobinCursors = new Map();

async function getOrdRegionsByKey() {
    if (!cachedOrdRegionsByKey) {
        const regions = await parseSfzRegions(GREEN_ORD_MAP_PATH);
        const byKey = new Map();
        for (const region of regions) {
            const match = region.sample.match(/_(p|mf|f)_rr\d+\.wav$/i);
            if (!match) continue;
            const velocity = match[1].toLowerCase();
            if (!byKey.has(region.key)) byKey.set(region.key, {});
            const forKey = byKey.get(region.key);
            (forKey[velocity] ??= []).push(region);
        }
        // Play the takes in the order the pack specifies. Note that a cycle can revisit the
        // same file: several notes alternate two recordings across four sequence positions,
        // so a "4 round robin" note does not necessarily have four distinct takes.
        for (const byVelocity of byKey.values()) {
            for (const candidates of Object.values(byVelocity)) {
                candidates.sort((a, b) => a.seqPosition - b.seqPosition);
            }
        }
        cachedOrdRegionsByKey = byKey;
    }
    return cachedOrdRegionsByKey;
}

ipcMain.handle('guitar-samples:get-notes', async () => {
    const byKey = await getOrdRegionsByKey();
    return [...byKey.keys()].sort((a, b) => a - b).map(key => ({ key, label: midiKeyToPitchName(key) }));
});

// Advances this note+velocity to its next round-robin take, cycling in the order the sample
// pack's seq_position opcodes define. Sequential cycling is the point of round robins: it
// guarantees a repeated note varies, which random selection cannot, since random draws
// regularly return the same recording twice in a row.
// `maxSeconds` is optional: callers that only need a short note get a correspondingly
// smaller WAV instead of the full sustain.
ipcMain.handle('guitar-samples:get-audio', async (_event, { key, velocity, maxSeconds }) => {
    if (!VELOCITY_LABELS.includes(velocity)) throw new Error(`Unknown velocity "${velocity}"`);
    const byKey = await getOrdRegionsByKey();
    const candidates = byKey.get(key)?.[velocity];
    if (!candidates || candidates.length === 0) throw new Error(`No "${velocity}" sample for key ${key}`);

    const cursorKey = `${key}:${velocity}`;
    const next = ((roundRobinCursors.get(cursorKey) ?? -1) + 1) % candidates.length;
    roundRobinCursors.set(cursorKey, next);
    const region = candidates[next];
    const filePath = resolveSamplePath(GREEN_GRETSCH_PROGRAMS_DIR, region.sample);
    const buffer = await fs.readFile(filePath);
    return new Uint8Array(sliceWavToDuration(buffer, maxSeconds));
});
// --- end Green Gretsch guitar sample playback ---

// --- Chord library (Tools menu) ---
// Generated by scripts/build-chord-library.mjs. Every voicing in it has already been
// verified against its chord's interval formula at build time, so nothing here re-checks
// the theory; this just serves the file.
const CHORD_LIBRARY_PATH = path.join(__dirname, '..', 'assets', 'chords', 'chord-library.json');

let cachedChordLibrary = null;

ipcMain.handle('chords:get-library', async () => {
    if (!cachedChordLibrary) {
        cachedChordLibrary = JSON.parse(await fs.readFile(CHORD_LIBRARY_PATH, 'utf8'));
    }
    return cachedChordLibrary;
});
// --- end chord library ---

function buildMenu(window) {
    const template = [];

    if (process.platform === 'darwin') {
        template.push({ label: app.name, submenu: [{ role: 'quit' }] });
    }

    const recentFileItems = appState.recentFiles.map(filePath => ({
        label: path.basename(filePath),
        click: () => openFilePath(window, filePath)
    }));

    template.push(
        {
            label: '&File',
            submenu: [
                { label: '&Open File…', accelerator: 'CmdOrCtrl+T', click: () => openFileAndCreateTab(window) },
                { label: '&Close Tab', accelerator: 'CmdOrCtrl+W', click: () => window.webContents.send('tabs:close-current') },
                ...(recentFileItems.length > 0 ? [{ type: 'separator' }, ...recentFileItems] : []),
                { type: 'separator' },
                { label: '&Settings…', click: () => window.webContents.send('settings:open') },
                { type: 'separator' },
                { label: 'E&xit', role: 'quit' }
            ]
        },
        {
            label: '&Tools',
            submenu: [
                { label: '&Chord Library…', click: () => window.webContents.send('chords:open') },
                { label: '&Frets to Chord…', click: () => window.webContents.send('frets:open') },
                { label: '&Listen to Guitar Samples…', click: () => window.webContents.send('guitar-samples:open') }
            ]
        },
        {
            label: '&Help',
            submenu: [
                { label: '&About Unstrung', click: () => window.webContents.send('about:open', { version: app.getVersion() }) }
            ]
        }
    );

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow(filesToOpen = []) {
    const window = new BrowserWindow({
        width: 900,
        height: 700,
        title: 'Unstrung',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });

    buildMenu(window);
    await window.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

    for (const filePath of filesToOpen) {
        await openFilePath(window, filePath);
    }
}

// When packaged, process.argv is [exePath, ...userArgs]. When running unpackaged
// (e.g. `electron .`), it's [electronPath, appPath, ...userArgs].
const cliArgs = process.argv.slice(app.isPackaged ? 1 : 2);
const helpRequested = cliArgs.includes('-h') || cliArgs.includes('--help');

if (helpRequested) {
    // Wait for the write to actually complete before exiting: on Windows, when stdout is
    // a pipe or redirected file, the write is asynchronous, and app.exit()/process.exit()
    // can tear the process down before it flushes, silently dropping the output.
    process.stdout.write(HELP_TEXT, () => app.exit(0));
} else {
    app.whenReady().then(async () => {
        // This app is built for screen reader users. Force full Chromium accessibility
        // support unconditionally instead of relying on Electron's own runtime detection
        // of whether a screen reader is active, since that detection has had real gaps
        // (e.g. https://github.com/electron/electron/issues/48039).
        app.setAccessibilitySupportEnabled(true);
        appState = await loadAppState();
        createWindow(cliArgs);
    });
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

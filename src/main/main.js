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
            hivel: Number(getOpcode('hivel') ?? 127)
        });
    }
    return regions;
}

function resolveSamplePath(resolveBase, sample) {
    return path.resolve(resolveBase, sample.replace(/\\/g, '/'));
}

// Green Gretsch "ord" (normal picking) velocity tiers, confirmed directly against the sample
// filenames (twang_<note>_<p|mf|f>_rr<N>.wav): "p" (soft) always has 2 round-robins; "mf" and
// "f" have 4 for most notes but only 2 for the ten highest notes in range.
const VELOCITY_LABELS = ['p', 'mf', 'f'];

let cachedOrdRegionsByKey = null;

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
        cachedOrdRegionsByKey = byKey;
    }
    return cachedOrdRegionsByKey;
}

ipcMain.handle('guitar-samples:get-notes', async () => {
    const byKey = await getOrdRegionsByKey();
    return [...byKey.keys()].sort((a, b) => a - b).map(key => ({ key, label: midiKeyToPitchName(key) }));
});

// Picks one random round-robin take for the given note+velocity (the renderer calls this
// once per round-robin it wants to play, so repeated calls naturally give repeated random picks).
ipcMain.handle('guitar-samples:get-audio', async (_event, { key, velocity }) => {
    if (!VELOCITY_LABELS.includes(velocity)) throw new Error(`Unknown velocity "${velocity}"`);
    const byKey = await getOrdRegionsByKey();
    const candidates = byKey.get(key)?.[velocity];
    if (!candidates || candidates.length === 0) throw new Error(`No "${velocity}" sample for key ${key}`);
    const region = candidates[Math.floor(Math.random() * candidates.length)];
    const filePath = resolveSamplePath(GREEN_GRETSCH_PROGRAMS_DIR, region.sample);
    return new Uint8Array(await fs.readFile(filePath));
});
// --- end Green Gretsch guitar sample playback ---

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

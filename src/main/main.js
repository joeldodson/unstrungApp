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
    'https://claude.ai'
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

async function openFilePath(window, filePath) {
    const fileName = path.basename(filePath);

    try {
        const buffer = await fs.readFile(filePath);
        window.webContents.send('tabs:open-file', { fileName, data: new Uint8Array(buffer) });
    } catch (error) {
        window.webContents.send('tabs:open-file-error', { fileName, message: error.message });
    }
}

async function openFileAndCreateTab(window) {
    const result = await dialog.showOpenDialog(window, {
        title: 'Choose a song file',
        properties: ['openFile'],
        filters: OPEN_FILE_FILTERS
    });

    if (result.canceled || result.filePaths.length === 0) {
        return;
    }

    await openFilePath(window, result.filePaths[0]);
}

function buildMenu(window) {
    const template = [];

    if (process.platform === 'darwin') {
        template.push({ label: app.name, submenu: [{ role: 'quit' }] });
    }

    template.push(
        {
            label: '&File',
            submenu: [
                { label: '&Open File…', accelerator: 'CmdOrCtrl+T', click: () => openFileAndCreateTab(window) },
                { label: '&Close Tab', accelerator: 'CmdOrCtrl+W', click: () => window.webContents.send('tabs:close-current') },
                { type: 'separator' },
                { label: 'E&xit', role: 'quit' }
            ]
        },
        {
            label: '&Tabs',
            submenu: [
                { label: '&Next Tab', accelerator: 'Control+Tab', click: () => window.webContents.send('tabs:next') },
                { label: '&Previous Tab', accelerator: 'Control+Shift+Tab', click: () => window.webContents.send('tabs:previous') }
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
    app.whenReady().then(() => {
        // This app is built for screen reader users. Force full Chromium accessibility
        // support unconditionally instead of relying on Electron's own runtime detection
        // of whether a screen reader is active, since that detection has had real gaps
        // (e.g. https://github.com/electron/electron/issues/48039).
        app.setAccessibilitySupportEnabled(true);
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

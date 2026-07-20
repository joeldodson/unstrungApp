const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

const OPEN_FILE_FILTERS = [
    { name: 'Music notation files', extensions: ['gp', 'gpx', 'gp5', 'gp4', 'gp3', 'musicxml', 'xml'] },
    { name: 'All files', extensions: ['*'] }
];

async function openFileAndCreateTab(window) {
    const result = await dialog.showOpenDialog(window, {
        title: 'Choose a song file',
        properties: ['openFile'],
        filters: OPEN_FILE_FILTERS
    });

    if (result.canceled || result.filePaths.length === 0) {
        return;
    }

    const filePath = result.filePaths[0];
    const fileName = path.basename(filePath);

    try {
        const buffer = await fs.readFile(filePath);
        window.webContents.send('tabs:open-file', { fileName, data: new Uint8Array(buffer) });
    } catch (error) {
        window.webContents.send('tabs:open-file-error', { fileName, message: error.message });
    }
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
        }
    );

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
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
    window.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

app.whenReady().then(() => {
    // This app is built for screen reader users. Force full Chromium accessibility
    // support unconditionally instead of relying on Electron's own runtime detection
    // of whether a screen reader is active, since that detection has had real gaps
    // (e.g. https://github.com/electron/electron/issues/48039).
    app.setAccessibilitySupportEnabled(true);
    createWindow();
});

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

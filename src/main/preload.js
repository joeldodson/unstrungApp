const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('unstrung', {
    onFileOpened: (callback) => ipcRenderer.on('tabs:open-file', (_event, payload) => callback(payload)),
    onFileOpenError: (callback) => ipcRenderer.on('tabs:open-file-error', (_event, payload) => callback(payload)),
    onCloseCurrentTab: (callback) => ipcRenderer.on('tabs:close-current', () => callback()),
    onAboutOpen: (callback) => ipcRenderer.on('about:open', (_event, payload) => callback(payload)),
    openExternalLink: (url) => ipcRenderer.send('shell:open-external', url),

    // Green Gretsch guitar sample playback (Tools menu).
    onGuitarSamplesOpen: (callback) => ipcRenderer.on('guitar-samples:open', () => callback()),
    getGuitarSampleNotes: () => ipcRenderer.invoke('guitar-samples:get-notes'),
    getGuitarSampleAudio: (key, velocity, maxSeconds) =>
        ipcRenderer.invoke('guitar-samples:get-audio', { key, velocity, maxSeconds }),

    // Chord library (Tools menu).
    onChordLibraryOpen: (callback) => ipcRenderer.on('chords:open', () => callback()),
    onFretsToChordOpen: (callback) => ipcRenderer.on('frets:open', () => callback()),
    getChordLibrary: () => ipcRenderer.invoke('chords:get-library'),

    // Settings (File menu).
    onSettingsOpen: (callback) => ipcRenderer.on('settings:open', () => callback()),
    getSettings: () => ipcRenderer.invoke('settings:get'),
    chooseSettingsDirectory: () => ipcRenderer.invoke('settings:choose-directory'),
    validateAndSaveSettingsDirectory: (dirPath) => ipcRenderer.invoke('settings:validate-and-save-directory', dirPath),
    clearRecentFiles: () => ipcRenderer.invoke('settings:clear-recent-files'),
    removeStaleRecentFiles: () => ipcRenderer.invoke('settings:remove-stale-recent-files'),
    saveScreenReaderSettings: (settings) => ipcRenderer.invoke('settings:save-screen-reader', settings),

    // Help documents (Help menu), built from README.md.
    onHelpOpen: (callback) => ipcRenderer.on('help:open', (_event, payload) => callback(payload)),
    getReadme: () => ipcRenderer.invoke('help:get-readme')
});

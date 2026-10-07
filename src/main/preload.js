const { contextBridge, ipcRenderer } = require('electron');

// Everything the page needs from the platform. There is no native menu: the page's own menu calls
// the functions below directly, so a browser build only has to supply this same object.
contextBridge.exposeInMainWorld('unstrung', {
    platform: 'electron',
    // What the page may offer. src/web/platform.js turns these off in a browser.
    capabilities: { typedFolderPaths: true, openFolderInFileManager: true, defaultOpenFolder: true },

    getAppVersion: () => ipcRenderer.invoke('app:get-version'),
    openExternalLink: (url) => ipcRenderer.send('shell:open-external', url),

    // Song files. Opening one, from the dialog or the recent list, arrives
    // through onFileOpened with the file's bytes.
    openFileDialog: () => ipcRenderer.invoke('files:open-dialog'),
    openRecentFile: (filePath) => ipcRenderer.invoke('files:open-recent', filePath),
    getRecentFiles: () => ipcRenderer.invoke('files:get-recent'),
    onRecentFilesChanged: (callback) => ipcRenderer.on('files:recent-changed', (_event, files) => callback(files)),
    onFileOpened: (callback) => ipcRenderer.on('files:opened', (_event, payload) => callback(payload)),
    onFileOpenError: (callback) => ipcRenderer.on('files:open-error', (_event, payload) => callback(payload)),

    // Green Gretsch guitar sample playback.
    getGuitarSampleNotes: () => ipcRenderer.invoke('guitar-samples:get-notes'),
    getGuitarSampleAudio: (key, velocity, maxSeconds) =>
        ipcRenderer.invoke('guitar-samples:get-audio', { key, velocity, maxSeconds }),

    // Spoken phrases, read from the recordings committed under src/assets/speech. Nothing is
    // synthesized at run time, which is what lets this work on an installed app and off Windows.
    listSpokenVoices: () => ipcRenderer.invoke('speech:list-voices'),
    getSpokenPhrases: (voice, phrases) => ipcRenderer.invoke('speech:get-phrases', { voice, phrases }),

    // Saved chord progressions.
    listProgressions: () => ipcRenderer.invoke('progressions:list'),
    readProgression: (relativePath) => ipcRenderer.invoke('progressions:read', relativePath),
    saveProgression: (request) => ipcRenderer.invoke('progressions:save', request),
    openProgressionsFolder: () => ipcRenderer.invoke('progressions:open-folder'),
    setUnsavedProgressions: (value) => ipcRenderer.send('progressions:set-unsaved', value),
    onConfirmQuit: (callback) => ipcRenderer.on('app:confirm-quit', () => callback()),
    confirmQuit: () => ipcRenderer.send('app:quit-confirmed'),

    // Chord library.
    getChordLibrary: () => ipcRenderer.invoke('chords:get-library'),

    // Settings.
    getSettings: () => ipcRenderer.invoke('settings:get'),
    chooseSettingsDirectory: () => ipcRenderer.invoke('settings:choose-directory'),
    validateAndSaveSettingsDirectory: (dirPath) => ipcRenderer.invoke('settings:validate-and-save-directory', dirPath),
    chooseProgressionsDirectory: () => ipcRenderer.invoke('settings:choose-progressions-directory'),
    saveProgressionsDirectory: (dirPath) => ipcRenderer.invoke('settings:save-progressions-directory', dirPath),
    clearRecentFiles: () => ipcRenderer.invoke('settings:clear-recent-files'),
    removeStaleRecentFiles: () => ipcRenderer.invoke('settings:remove-stale-recent-files'),
    saveScreenReaderSettings: (settings) => ipcRenderer.invoke('settings:save-screen-reader', settings),
    saveChordVoiceSettings: (settings) => ipcRenderer.invoke('settings:save-chord-voice', settings)
});

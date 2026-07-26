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
    getGuitarSampleAudio: (key, velocity) => ipcRenderer.invoke('guitar-samples:get-audio', { key, velocity })
});

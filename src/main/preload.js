const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('unstrung', {
    onFileOpened: (callback) => ipcRenderer.on('tabs:open-file', (_event, payload) => callback(payload)),
    onFileOpenError: (callback) => ipcRenderer.on('tabs:open-file-error', (_event, payload) => callback(payload)),
    onCloseCurrentTab: (callback) => ipcRenderer.on('tabs:close-current', () => callback()),
    onNextTab: (callback) => ipcRenderer.on('tabs:next', () => callback()),
    onPreviousTab: (callback) => ipcRenderer.on('tabs:previous', () => callback()),
    onAboutOpen: (callback) => ipcRenderer.on('about:open', (_event, payload) => callback(payload)),
    openExternalLink: (url) => ipcRenderer.send('shell:open-external', url)
});

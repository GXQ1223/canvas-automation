"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // Config
    config: {
        get: () => electron_1.ipcRenderer.invoke('config:get'),
        set: (config) => electron_1.ipcRenderer.invoke('config:set', config),
        getField: (field) => electron_1.ipcRenderer.invoke('config:getField', field),
        setField: (field, value) => electron_1.ipcRenderer.invoke('config:setField', field, value),
    },
    // Credentials (keychain)
    credentials: {
        get: (key) => electron_1.ipcRenderer.invoke('credentials:get', key),
        set: (key, value) => electron_1.ipcRenderer.invoke('credentials:set', key, value),
        delete: (key) => electron_1.ipcRenderer.invoke('credentials:delete', key),
    },
    // Files
    files: {
        readProgress: () => electron_1.ipcRenderer.invoke('files:readProgress'),
        readDoneList: () => electron_1.ipcRenderer.invoke('files:readDoneList'),
        readSkipList: () => electron_1.ipcRenderer.invoke('files:readSkipList'),
        listNotes: () => electron_1.ipcRenderer.invoke('files:listNotes'),
        readNote: (path) => electron_1.ipcRenderer.invoke('files:readNote', path),
        listReports: () => electron_1.ipcRenderer.invoke('files:listReports'),
        readReport: (path) => electron_1.ipcRenderer.invoke('files:readReport', path),
    },
    // CLI
    cli: {
        start: (args) => electron_1.ipcRenderer.invoke('cli:start', args),
        stop: () => electron_1.ipcRenderer.invoke('cli:stop'),
        isRunning: () => electron_1.ipcRenderer.invoke('cli:isRunning'),
        sendInput: (input) => electron_1.ipcRenderer.invoke('cli:sendInput', input),
        onOutput: (callback) => {
            electron_1.ipcRenderer.on('cli-output', (_, output) => callback(output));
        },
    },
    // Shell
    shell: {
        openExternal: (url) => electron_1.ipcRenderer.invoke('shell:openExternal', url),
        openPath: (path) => electron_1.ipcRenderer.invoke('shell:openPath', path),
    },
    // Window controls
    window: {
        setAlwaysOnTop: (value) => electron_1.ipcRenderer.invoke('window:setAlwaysOnTop', value),
        isAlwaysOnTop: () => electron_1.ipcRenderer.invoke('window:isAlwaysOnTop'),
        minimize: () => electron_1.ipcRenderer.invoke('window:minimize'),
        close: () => electron_1.ipcRenderer.invoke('window:close'),
        setSize: (width, height) => electron_1.ipcRenderer.invoke('window:setSize', width, height),
        getSize: () => electron_1.ipcRenderer.invoke('window:getSize'),
    },
    // File change events
    onFileChange: (callback) => {
        electron_1.ipcRenderer.on('file-change', (_, { event, data }) => callback(event, data));
    },
});
//# sourceMappingURL=preload.js.map
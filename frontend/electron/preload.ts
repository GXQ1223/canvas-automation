import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Config
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (config: Record<string, unknown>) => ipcRenderer.invoke('config:set', config),
    getField: (field: string) => ipcRenderer.invoke('config:getField', field),
    setField: (field: string, value: unknown) => ipcRenderer.invoke('config:setField', field, value),
  },

  // Credentials (keychain)
  credentials: {
    get: (key: string) => ipcRenderer.invoke('credentials:get', key),
    set: (key: string, value: string) => ipcRenderer.invoke('credentials:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('credentials:delete', key),
  },

  // Files
  files: {
    readProgress: () => ipcRenderer.invoke('files:readProgress'),
    readDoneList: () => ipcRenderer.invoke('files:readDoneList'),
    readSkipList: () => ipcRenderer.invoke('files:readSkipList'),
    listNotes: () => ipcRenderer.invoke('files:listNotes'),
    readNote: (path: string) => ipcRenderer.invoke('files:readNote', path),
    listReports: () => ipcRenderer.invoke('files:listReports'),
    readReport: (path: string) => ipcRenderer.invoke('files:readReport', path),
  },

  // CLI
  cli: {
    start: (args?: string[]) => ipcRenderer.invoke('cli:start', args),
    stop: () => ipcRenderer.invoke('cli:stop'),
    isRunning: () => ipcRenderer.invoke('cli:isRunning'),
    sendInput: (input: string) => ipcRenderer.invoke('cli:sendInput', input),
    onOutput: (callback: (output: string) => void) => {
      ipcRenderer.on('cli-output', (_, output) => callback(output))
    },
  },

  // Shell
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
    openPath: (path: string) => ipcRenderer.invoke('shell:openPath', path),
  },

  // Window controls
  window: {
    setAlwaysOnTop: (value: boolean) => ipcRenderer.invoke('window:setAlwaysOnTop', value),
    isAlwaysOnTop: () => ipcRenderer.invoke('window:isAlwaysOnTop'),
    minimize: () => ipcRenderer.invoke('window:minimize'),
    close: () => ipcRenderer.invoke('window:close'),
    setSize: (width: number, height: number) => ipcRenderer.invoke('window:setSize', width, height),
    getSize: () => ipcRenderer.invoke('window:getSize'),
  },

  // File change events
  onFileChange: (callback: (event: string, data: unknown) => void) => {
    ipcRenderer.on('file-change', (_, { event, data }) => callback(event, data))
  },
})

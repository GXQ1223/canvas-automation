import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'path'
import { ConfigManager } from './services/configManager'
import { CredentialManager } from './services/credentialManager'
import { FileWatcher } from './services/fileWatcher'
import { CliRunner } from './services/cliRunner'

let mainWindow: BrowserWindow | null = null
let fileWatcher: FileWatcher | null = null
let cliRunner: CliRunner | null = null

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// Get the project root (parent of frontend/)
const projectRoot = path.join(__dirname, '..', '..')

// Widget dimensions
const WIDGET_WIDTH = 280
const WIDGET_HEIGHT = 500

function createWindow() {
  // Get screen dimensions to position widget on right edge
  const { screen } = require('electron')
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize

  mainWindow = new BrowserWindow({
    width: WIDGET_WIDTH,
    height: WIDGET_HEIGHT,
    minWidth: WIDGET_WIDTH,
    minHeight: 400,
    maxWidth: WIDGET_WIDTH,
    x: screenWidth - WIDGET_WIDTH - 20,
    y: Math.floor((screenHeight - WIDGET_HEIGHT) / 2),
    backgroundColor: '#0f0f1a',
    frame: false,
    transparent: false,
    resizable: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Initialize services
  const configManager = new ConfigManager(projectRoot)
  cliRunner = new CliRunner(projectRoot)
  fileWatcher = new FileWatcher(projectRoot, (event, data) => {
    mainWindow?.webContents.send('file-change', { event, data })
  })

  // Start watching files
  fileWatcher.start()

  // IPC Handlers - Config
  ipcMain.handle('config:get', () => configManager.getConfig())
  ipcMain.handle('config:set', (_, config) => configManager.setConfig(config))
  ipcMain.handle('config:getField', (_, field) => configManager.getField(field))
  ipcMain.handle('config:setField', (_, field, value) => configManager.setField(field, value))

  // IPC Handlers - Credentials (keychain)
  const credentialManager = new CredentialManager()
  ipcMain.handle('credentials:get', (_, key) => credentialManager.get(key))
  ipcMain.handle('credentials:set', (_, key, value) => credentialManager.set(key, value))
  ipcMain.handle('credentials:delete', (_, key) => credentialManager.delete(key))

  // IPC Handlers - Files
  ipcMain.handle('files:readProgress', () => {
    const fs = require('fs')
    const progressPath = path.join(projectRoot, 'progress.json')
    try {
      const content = fs.readFileSync(progressPath, 'utf-8')
      return JSON.parse(content)
    } catch {
      return null
    }
  })

  ipcMain.handle('files:readDoneList', () => {
    const fs = require('fs')
    const donePath = path.join(projectRoot, 'done_list.txt')
    try {
      const content = fs.readFileSync(donePath, 'utf-8')
      return content.split('\n').filter((line: string) => line.trim() && !line.startsWith('#'))
    } catch {
      return []
    }
  })

  ipcMain.handle('files:readSkipList', () => {
    const fs = require('fs')
    const skipPath = path.join(projectRoot, 'skip_list.txt')
    try {
      const content = fs.readFileSync(skipPath, 'utf-8')
      return content.split('\n').filter((line: string) => line.trim() && !line.startsWith('#'))
    } catch {
      return []
    }
  })

  ipcMain.handle('files:listNotes', () => {
    const fs = require('fs')
    const notesDir = path.join(projectRoot, 'notes')
    try {
      const files = fs.readdirSync(notesDir)
      return files
        .filter((f: string) => f.endsWith('.md'))
        .map((f: string) => {
          const stats = fs.statSync(path.join(notesDir, f))
          return {
            name: f,
            path: path.join(notesDir, f),
            modified: stats.mtime,
          }
        })
        .sort((a: { modified: Date }, b: { modified: Date }) =>
          b.modified.getTime() - a.modified.getTime()
        )
    } catch {
      return []
    }
  })

  ipcMain.handle('files:readNote', (_, notePath) => {
    const fs = require('fs')
    try {
      return fs.readFileSync(notePath, 'utf-8')
    } catch {
      return null
    }
  })

  ipcMain.handle('files:listReports', () => {
    const fs = require('fs')
    const reportsDir = path.join(projectRoot, 'reports')
    try {
      const files = fs.readdirSync(reportsDir)
      return files
        .filter((f: string) => f.endsWith('.md'))
        .map((f: string) => {
          const stats = fs.statSync(path.join(reportsDir, f))
          return {
            name: f,
            path: path.join(reportsDir, f),
            modified: stats.mtime,
          }
        })
        .sort((a: { modified: Date }, b: { modified: Date }) =>
          b.modified.getTime() - a.modified.getTime()
        )
    } catch {
      return []
    }
  })

  ipcMain.handle('files:readReport', (_, reportPath) => {
    const fs = require('fs')
    try {
      return fs.readFileSync(reportPath, 'utf-8')
    } catch {
      return null
    }
  })

  // IPC Handlers - CLI
  ipcMain.handle('cli:start', (_, args) => {
    cliRunner?.start(args, (output) => {
      mainWindow?.webContents.send('cli-output', output)
    })
    return true
  })

  ipcMain.handle('cli:stop', () => {
    cliRunner?.stop()
    return true
  })

  ipcMain.handle('cli:isRunning', () => cliRunner?.isRunning() ?? false)

  ipcMain.handle('cli:sendInput', (_, input: string) => {
    cliRunner?.sendInput(input)
    return true
  })

  // IPC Handlers - Shell
  ipcMain.handle('shell:openExternal', (_, url) => {
    shell.openExternal(url)
    return true
  })

  ipcMain.handle('shell:openPath', (_, filePath) => {
    shell.openPath(filePath)
    return true
  })

  // IPC Handlers - Window
  ipcMain.handle('window:setAlwaysOnTop', (_, value: boolean) => {
    mainWindow?.setAlwaysOnTop(value)
    return true
  })

  ipcMain.handle('window:isAlwaysOnTop', () => {
    return mainWindow?.isAlwaysOnTop() ?? false
  })

  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize()
    return true
  })

  ipcMain.handle('window:close', () => {
    mainWindow?.close()
    return true
  })

  ipcMain.handle('window:setSize', (_, width: number, height: number) => {
    mainWindow?.setSize(width, height)
    return true
  })

  ipcMain.handle('window:getSize', () => {
    return mainWindow?.getSize() ?? [WIDGET_WIDTH, WIDGET_HEIGHT]
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  fileWatcher?.stop()
  cliRunner?.stop()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

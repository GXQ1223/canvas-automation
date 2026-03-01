"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const configManager_1 = require("./services/configManager");
const credentialManager_1 = require("./services/credentialManager");
const fileWatcher_1 = require("./services/fileWatcher");
const cliRunner_1 = require("./services/cliRunner");
let mainWindow = null;
let fileWatcher = null;
let cliRunner = null;
const isDev = process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged;
// Get the project root (parent of frontend/)
const projectRoot = path_1.default.join(__dirname, '..', '..');
// Widget dimensions
const WIDGET_WIDTH = 280;
const WIDGET_HEIGHT = 500;
function createWindow() {
    // Get screen dimensions to position widget on right edge
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    mainWindow = new electron_1.BrowserWindow({
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
            preload: path_1.default.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, '../dist/index.html'));
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
    // Initialize services
    const configManager = new configManager_1.ConfigManager(projectRoot);
    cliRunner = new cliRunner_1.CliRunner(projectRoot);
    fileWatcher = new fileWatcher_1.FileWatcher(projectRoot, (event, data) => {
        mainWindow?.webContents.send('file-change', { event, data });
    });
    // Start watching files
    fileWatcher.start();
    // IPC Handlers - Config
    electron_1.ipcMain.handle('config:get', () => configManager.getConfig());
    electron_1.ipcMain.handle('config:set', (_, config) => configManager.setConfig(config));
    electron_1.ipcMain.handle('config:getField', (_, field) => configManager.getField(field));
    electron_1.ipcMain.handle('config:setField', (_, field, value) => configManager.setField(field, value));
    // IPC Handlers - Credentials (keychain)
    const credentialManager = new credentialManager_1.CredentialManager();
    electron_1.ipcMain.handle('credentials:get', (_, key) => credentialManager.get(key));
    electron_1.ipcMain.handle('credentials:set', (_, key, value) => credentialManager.set(key, value));
    electron_1.ipcMain.handle('credentials:delete', (_, key) => credentialManager.delete(key));
    // IPC Handlers - Files
    electron_1.ipcMain.handle('files:readProgress', () => {
        const fs = require('fs');
        const progressPath = path_1.default.join(projectRoot, 'progress.json');
        try {
            const content = fs.readFileSync(progressPath, 'utf-8');
            return JSON.parse(content);
        }
        catch {
            return null;
        }
    });
    electron_1.ipcMain.handle('files:readDoneList', () => {
        const fs = require('fs');
        const donePath = path_1.default.join(projectRoot, 'done_list.txt');
        try {
            const content = fs.readFileSync(donePath, 'utf-8');
            return content.split('\n').filter((line) => line.trim() && !line.startsWith('#'));
        }
        catch {
            return [];
        }
    });
    electron_1.ipcMain.handle('files:readSkipList', () => {
        const fs = require('fs');
        const skipPath = path_1.default.join(projectRoot, 'skip_list.txt');
        try {
            const content = fs.readFileSync(skipPath, 'utf-8');
            return content.split('\n').filter((line) => line.trim() && !line.startsWith('#'));
        }
        catch {
            return [];
        }
    });
    electron_1.ipcMain.handle('files:listNotes', () => {
        const fs = require('fs');
        const notesDir = path_1.default.join(projectRoot, 'notes');
        try {
            const files = fs.readdirSync(notesDir);
            return files
                .filter((f) => f.endsWith('.md'))
                .map((f) => {
                const stats = fs.statSync(path_1.default.join(notesDir, f));
                return {
                    name: f,
                    path: path_1.default.join(notesDir, f),
                    modified: stats.mtime,
                };
            })
                .sort((a, b) => b.modified.getTime() - a.modified.getTime());
        }
        catch {
            return [];
        }
    });
    electron_1.ipcMain.handle('files:readNote', (_, notePath) => {
        const fs = require('fs');
        try {
            return fs.readFileSync(notePath, 'utf-8');
        }
        catch {
            return null;
        }
    });
    electron_1.ipcMain.handle('files:listReports', () => {
        const fs = require('fs');
        const reportsDir = path_1.default.join(projectRoot, 'reports');
        try {
            const files = fs.readdirSync(reportsDir);
            return files
                .filter((f) => f.endsWith('.md'))
                .map((f) => {
                const stats = fs.statSync(path_1.default.join(reportsDir, f));
                return {
                    name: f,
                    path: path_1.default.join(reportsDir, f),
                    modified: stats.mtime,
                };
            })
                .sort((a, b) => b.modified.getTime() - a.modified.getTime());
        }
        catch {
            return [];
        }
    });
    electron_1.ipcMain.handle('files:readReport', (_, reportPath) => {
        const fs = require('fs');
        try {
            return fs.readFileSync(reportPath, 'utf-8');
        }
        catch {
            return null;
        }
    });
    // IPC Handlers - CLI
    electron_1.ipcMain.handle('cli:start', (_, args) => {
        cliRunner?.start(args, (output) => {
            mainWindow?.webContents.send('cli-output', output);
        });
        return true;
    });
    electron_1.ipcMain.handle('cli:stop', () => {
        cliRunner?.stop();
        return true;
    });
    electron_1.ipcMain.handle('cli:isRunning', () => cliRunner?.isRunning() ?? false);
    electron_1.ipcMain.handle('cli:sendInput', (_, input) => {
        cliRunner?.sendInput(input);
        return true;
    });
    // IPC Handlers - Shell
    electron_1.ipcMain.handle('shell:openExternal', (_, url) => {
        electron_1.shell.openExternal(url);
        return true;
    });
    electron_1.ipcMain.handle('shell:openPath', (_, filePath) => {
        electron_1.shell.openPath(filePath);
        return true;
    });
    // IPC Handlers - Window
    electron_1.ipcMain.handle('window:setAlwaysOnTop', (_, value) => {
        mainWindow?.setAlwaysOnTop(value);
        return true;
    });
    electron_1.ipcMain.handle('window:isAlwaysOnTop', () => {
        return mainWindow?.isAlwaysOnTop() ?? false;
    });
    electron_1.ipcMain.handle('window:minimize', () => {
        mainWindow?.minimize();
        return true;
    });
    electron_1.ipcMain.handle('window:close', () => {
        mainWindow?.close();
        return true;
    });
    electron_1.ipcMain.handle('window:setSize', (_, width, height) => {
        mainWindow?.setSize(width, height);
        return true;
    });
    electron_1.ipcMain.handle('window:getSize', () => {
        return mainWindow?.getSize() ?? [WIDGET_WIDTH, WIDGET_HEIGHT];
    });
}
electron_1.app.whenReady().then(createWindow);
electron_1.app.on('window-all-closed', () => {
    fileWatcher?.stop();
    cliRunner?.stop();
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
//# sourceMappingURL=main.js.map